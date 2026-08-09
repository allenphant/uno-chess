import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  protocolVersion,
  type AuthenticatedActor,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from '@uno-chess/protocol'
import { Server } from 'socket.io'
import { GameRegistry, type GameRegistryOptions } from './game/GameRegistry.js'
import { FriendRoomService } from './lobby/FriendRoomService.js'
import { registerGameHandlers } from './socket/register-game-handlers.js'
import { registerLobbyHandlers } from './socket/register-lobby-handlers.js'

export interface SocketAuth {
  verify(token: unknown): Promise<AuthenticatedActor | null>
}

export interface GameServerOptions {
  port: number
  host?: string
  webOrigin?: string | string[] | true
  auth: SocketAuth
  registry?: GameRegistry
  registryOptions?: GameRegistryOptions
  rooms?: FriendRoomService
}

export async function createGameServer(options: GameServerOptions) {
  const http = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ ok: true, protocolVersion }))
      return
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'NOT_FOUND' }))
  })

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(http, {
    cors: { origin: options.webOrigin ?? true },
  })
  const registry = options.registry ?? new GameRegistry(options.registryOptions)
  const rooms = options.rooms ?? new FriendRoomService({
    createMatch: (input) => registry.create(input),
  })

  io.use(async (socket, next) => {
    try {
      const actor = await options.auth.verify(socket.handshake.auth.token)
      if (!actor) return next(new Error('UNAUTHORIZED'))
      socket.data.actor = actor
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket, rooms, registry)
    registerGameHandlers(io, socket, registry)
  })

  await listen(http, options.port, options.host ?? '127.0.0.1')
  return {
    io,
    registry,
    rooms,
    url: addressUrl(http),
    close: () => closeAll(io, http),
  }
}

function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve()
    })
  })
}

function addressUrl(server: HttpServer): string {
  const address = server.address() as AddressInfo | null
  if (!address) throw new Error('SERVER_NOT_LISTENING')
  const host = address.family === 'IPv6' ? `[${address.address}]` : address.address
  return `http://${host}:${address.port}`
}

async function closeAll(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  http: HttpServer,
): Promise<void> {
  await new Promise<void>((resolve) => io.close(() => resolve()))
  if (!http.listening) return
  await new Promise<void>((resolve, reject) => http.close((error) => error ? reject(error) : resolve()))
}
