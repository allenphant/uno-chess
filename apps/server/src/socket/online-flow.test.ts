import type { ClientToServerEvents, ServerToClientEvents } from '@uno-chess/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { io as createClient, type Socket } from 'socket.io-client'
import { createGameServer } from '../create-server.js'
import { GameRegistry } from '../game/GameRegistry.js'
import { FriendRoomService } from '../lobby/FriendRoomService.js'

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>

describe('online friend match socket flow', () => {
  const clients: TestClient[] = []
  let closeServer: (() => Promise<void>) | undefined

  afterEach(async () => {
    for (const client of clients) client.close()
    clients.length = 0
    await closeServer?.()
  })

  it('creates, joins, readies, projects private state, and applies an authenticated intent', async () => {
    const registry = new GameRegistry({ idSource: () => 'game-1', seedSource: () => 'socket-flow' })
    const rooms = new FriendRoomService({ codeSource: () => 'PVX234', createMatch: (input) => registry.create(input) })
    const server = await createGameServer({
      port: 0,
      registry,
      rooms,
      auth: {
        async verify(token) {
          if (token === 'token-p1') return { playerId: 'p1', accountKind: 'guest' }
          if (token === 'token-p2') return { playerId: 'p2', accountKind: 'guest' }
          return null
        },
      },
    })
    closeServer = server.close
    const p1 = await connect(server.url, 'token-p1')
    const p2 = await connect(server.url, 'token-p2')
    clients.push(p1, p2)

    const created = await new Promise<Parameters<Parameters<ClientToServerEvents['room:create']>[1]>[0]>((resolve) => {
      p1.emit('room:create', { presetId: 'standard-v1', overrides: {} }, resolve)
    })
    expect(created).toEqual({ ok: true, data: { code: 'PVX234' } })
    const joined = await new Promise<Parameters<Parameters<ClientToServerEvents['room:join']>[1]>[0]>((resolve) => {
      p2.emit('room:join', { code: 'pvx234' }, resolve)
    })
    expect(joined).toEqual({ ok: true, data: { gameId: null } })

    const rulesHash = rooms.get('PVX234').rulesHash
    const firstReady = await new Promise<Parameters<Parameters<ClientToServerEvents['room:ready']>[1]>[0]>((resolve) => {
      p1.emit('room:ready', { code: 'PVX234', rulesHash }, resolve)
    })
    expect(firstReady).toEqual({ ok: true, data: { ready: true, gameId: null } })

    const p1ProjectionPromise = once(p1, 'game:projection')
    const p2ProjectionPromise = once(p2, 'game:projection')
    const secondReady = await new Promise<Parameters<Parameters<ClientToServerEvents['room:ready']>[1]>[0]>((resolve) => {
      p2.emit('room:ready', { code: 'PVX234', rulesHash }, resolve)
    })
    expect(secondReady).toEqual({ ok: true, data: { ready: true, gameId: 'game-1' } })
    const [p1Initial, p2Initial] = await Promise.all([p1ProjectionPromise, p2ProjectionPromise])
    expect(p1Initial.view.self.id).toBe('p1')
    expect(p1Initial.view.opponent).toMatchObject({ id: 'p2', hand: { count: 3 } })
    expect(p2Initial.view.self.id).toBe('p2')
    expect(Array.isArray(p2Initial.view.opponent.hand)).toBe(false)

    const p1NextProjection = once(p1, 'game:projection')
    const p2NextProjection = once(p2, 'game:projection')
    const intentAck = await new Promise<Parameters<Parameters<ClientToServerEvents['game:intent']>[1]>[0]>((resolve) => {
      p1.emit('game:intent', {
        gameId: 'game-1',
        revision: 0,
        intent: { type: 'draw-for-turn', playerId: 'p2', intentId: 'socket-intent-1' },
      }, resolve)
    })
    expect(intentAck).toEqual({ ok: true, data: { revision: 1 } })
    const [p1Next, p2Next] = await Promise.all([p1NextProjection, p2NextProjection])
    expect(p1Next.view.self.hand).toHaveLength(4)
    expect(p2Next.view.opponent.hand).toEqual({ count: 4 })

    const stale = await new Promise<Parameters<Parameters<ClientToServerEvents['game:intent']>[1]>[0]>((resolve) => {
      p1.emit('game:intent', {
        gameId: 'game-1',
        revision: 0,
        intent: { type: 'draw-for-turn', playerId: 'p1', intentId: 'socket-intent-2' },
      }, resolve)
    })
    expect(stale).toMatchObject({ ok: false, error: { code: 'STALE_REVISION' } })
  })
})

async function connect(url: string, token: string): Promise<TestClient> {
  const client: TestClient = createClient(url, { auth: { token }, transports: ['websocket'] })
  await new Promise<void>((resolve, reject) => {
    client.once('connect', resolve)
    client.once('connect_error', reject)
  })
  return client
}

function once<EventName extends keyof ServerToClientEvents>(
  socket: TestClient,
  event: EventName,
): Promise<Parameters<ServerToClientEvents[EventName]>[0]> {
  return new Promise((resolve) => socket.once(event, resolve as never))
}
