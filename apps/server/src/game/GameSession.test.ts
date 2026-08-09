import type { GameIntent } from '@uno-chess/protocol'
import { createGame, defaultRules } from '@uno-chess/rules'
import { describe, expect, it, vi } from 'vitest'
import { GameSession, SessionError, type SessionPersistence } from './GameSession.js'

describe('GameSession', () => {
  it('deduplicates concurrent submissions and hides the opponent hand', async () => {
    const session = createTestSession()
    const intent: GameIntent = { type: 'draw-for-turn', playerId: 'spoofed', intentId: 'same-id' }
    const [accepted, replayed] = await Promise.all([
      session.submit('p1', intent, 0),
      session.submit('p1', intent, 0),
    ])

    expect(accepted).toEqual(replayed)
    expect(session.revision).toBe(1)
    expect(session.viewFor('p1').opponent.hand).toEqual({ count: expect.any(Number) })
    expect('drawPile' in session.viewFor('p1')).toBe(false)
    const activeView = session.viewFor('p1')
    expect(activeView).toMatchObject({
      rules: { presetId: 'standard-v1' },
      board: { activePieces: expect.any(Object) },
      legal: {
        actionMoves: [],
        reinforcementOptions: [],
      },
    })
    expect(activeView.legal.basicMoves.length).toBeGreaterThan(0)
    expect(session.viewFor('p2').legal).toEqual({
      basicMoves: [],
      actionMoves: [],
      playableCardIds: [],
      reinforcementOptions: [],
    })
  })

  it('serializes different submissions and rejects the second stale revision', async () => {
    const session = createTestSession()
    const first = session.submit('p1', draw('first'), 0)
    const second = session.submit('p1', draw('second'), 0)

    await expect(first).resolves.toMatchObject({ revision: 1 })
    await expect(second).rejects.toMatchObject({ code: 'STALE_REVISION' })
    expect(session.revision).toBe(1)
  })

  it('overwrites the payload player id with the authenticated actor', async () => {
    const appendIntent = vi.fn<SessionPersistence['appendIntent']>().mockResolvedValue(undefined)
    const session = createTestSession({ appendIntent })

    await session.submit('p1', { type: 'draw-for-turn', playerId: 'p2', intentId: 'spoof' }, 0)

    expect(appendIntent).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'p1',
      intent: expect.objectContaining({ playerId: 'p1' }),
    }))
  })

  it('persists before advancing and can safely retry after persistence failure', async () => {
    const appendIntent = vi.fn<SessionPersistence['appendIntent']>()
      .mockRejectedValueOnce(new Error('DATABASE_DOWN'))
      .mockResolvedValueOnce(undefined)
    const session = createTestSession({ appendIntent })

    await expect(session.submit('p1', draw('retry-id'), 0)).rejects.toThrow('DATABASE_DOWN')
    expect(session.revision).toBe(0)
    await expect(session.submit('p1', draw('retry-id'), 0)).resolves.toMatchObject({ revision: 1 })
  })

  it('rejects non-participants before applying an intent', async () => {
    await expect(createTestSession().submit('outsider', draw('bad'), 0)).rejects.toEqual(
      expect.objectContaining<Partial<SessionError>>({ code: 'NOT_FOUND' }),
    )
  })

  it('does not replay an acknowledgement to another participant with a colliding intent id', async () => {
    const session = createTestSession()
    await session.submit('p1', draw('collision'), 0)
    await expect(session.submit('p2', draw('collision'), 0)).rejects.toMatchObject({
      code: 'ILLEGAL_INTENT',
      message: 'INTENT_ID_CONFLICT',
    })
  })
})

function createTestSession(persistence?: SessionPersistence): GameSession {
  const state = createGame({ gameId: 'game-1', playerIds: ['p1', 'p2'], rules: defaultRules, seed: 'session-test' })
  return persistence ? new GameSession(state, persistence) : new GameSession(state)
}

function draw(intentId: string): GameIntent {
  return { type: 'draw-for-turn', playerId: 'untrusted', intentId }
}
