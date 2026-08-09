import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@uno-chess/protocol'
import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import type { GameRegistry } from '../game/GameRegistry.js'
import type { FriendRoomService } from '../lobby/FriendRoomService.js'
import { normalizeRoomCode } from '../lobby/FriendRoomService.js'
import { failure } from './errors.js'
import { gameRoom, publishProjections } from './register-game-handlers.js'

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

const roomRulesSchema = z.object({
  presetId: z.string().min(1).max(64),
  overrides: z.record(z.string(), z.unknown()),
}).strict()
const roomCodeSchema = z.object({ code: z.string().min(1).max(12) }).strict()
const roomUpdateSchema = roomRulesSchema.extend({ code: z.string().min(1).max(12) }).strict()
const roomReadySchema = z.object({ code: z.string().min(1).max(12), rulesHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()

export function registerLobbyHandlers(
  io: GameServer,
  socket: GameSocket,
  rooms: FriendRoomService,
  registry: GameRegistry,
): void {
  socket.on('room:create', async (untrusted, acknowledge) => {
    try {
      const input = roomRulesSchema.parse(untrusted)
      const room = rooms.create(socket.data.actor.playerId, input)
      await socket.join(friendRoom(room.code))
      socket.emit('room:updated', room)
      acknowledge({ ok: true, data: { code: room.code } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })

  socket.on('room:join', async (untrusted, acknowledge) => {
    try {
      const { code: rawCode } = roomCodeSchema.parse(untrusted)
      const code = normalizeRoomCode(rawCode)
      const result = rooms.join(socket.data.actor.playerId, code)
      await socket.join(friendRoom(code))
      io.to(friendRoom(code)).emit('room:updated', result.room)
      acknowledge({ ok: true, data: { gameId: null } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })

  socket.on('room:update', (untrusted, acknowledge) => {
    try {
      const { code: rawCode, presetId, overrides } = roomUpdateSchema.parse(untrusted)
      const code = normalizeRoomCode(rawCode)
      const room = rooms.updateRules(socket.data.actor.playerId, code, { presetId, overrides })
      io.to(friendRoom(code)).emit('room:updated', room)
      acknowledge({ ok: true, data: { updated: true } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })

  socket.on('room:ready', async (untrusted, acknowledge) => {
    try {
      const { code: rawCode, rulesHash } = roomReadySchema.parse(untrusted)
      const code = normalizeRoomCode(rawCode)
      const result = await rooms.ready(socket.data.actor.playerId, code, rulesHash)
      io.to(friendRoom(code)).emit('room:updated', result.room)

      if (result.gameId) {
        const session = registry.require(result.gameId)
        const roomSockets = await io.in(friendRoom(code)).fetchSockets()
        for (const participantSocket of roomSockets) {
          if (!session.hasPlayer(participantSocket.data.actor.playerId)) continue
          await participantSocket.join(gameRoom(result.gameId))
          participantSocket.emit('room:started', { code, gameId: result.gameId })
        }
        await publishProjections(io, session, [])
      }

      acknowledge({ ok: true, data: { ready: true, gameId: result.gameId } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })
}

export function friendRoom(code: string): string {
  return `friend:${code}`
}
