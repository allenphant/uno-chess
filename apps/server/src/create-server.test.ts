import { afterEach, describe, expect, it } from 'vitest'
import { io as createClient, type Socket } from 'socket.io-client'
import { createGameServer, type SocketAuth } from './create-server.js'

describe('game server', () => {
  let client: Socket | undefined
  let closeServer: (() => Promise<void>) | undefined

  afterEach(async () => {
    client?.close()
    await closeServer?.()
  })

  it('answers health and rejects a socket without verified auth', async () => {
    const server = await createGameServer({ port: 0, auth: rejectingAuth })
    closeServer = server.close
    const response = await fetch(`${server.url}/health`)
    expect(await response.json()).toEqual({ ok: true, protocolVersion: 1 })

    client = createClient(server.url, { auth: {}, transports: ['websocket'] })
    const error = await new Promise<Error>((resolve) => client?.once('connect_error', resolve))
    expect(error.message).toBe('UNAUTHORIZED')
  })

  it('injects the verified actor and never trusts a handshake player id', async () => {
    const auth: SocketAuth = {
      async verify(token) {
        return token === 'valid' ? { playerId: 'verified-player', accountKind: 'guest' } : null
      },
    }
    const server = await createGameServer({ port: 0, auth })
    closeServer = server.close
    client = createClient(server.url, {
      auth: { token: 'valid', playerId: 'attacker-controlled' },
      transports: ['websocket'],
    })
    await new Promise<void>((resolve) => client?.once('connect', resolve))

    const sockets = await server.io.fetchSockets()
    expect(sockets).toHaveLength(1)
    expect(sockets[0]?.data.actor.playerId).toBe('verified-player')
  })
})

const rejectingAuth: SocketAuth = { async verify() { return null } }
