import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

type Card = { kind: string; color: string | null }
type GameView = {
  players: Record<string, { hand: Card[]; statuses: unknown[] }>
  drawPile: Card[]
  discardPile: Card[]
  controllerByArmy: { white: string; black: string }
  activePlayerId: string
  turn: { phase: string }
}

describe('createGame', () => {
  it('deals identical hands and draw piles for the same seed', () => {
    const api = rules as Record<string, unknown>
    expect(api.createGame).toBeTypeOf('function')
    if (typeof api.createGame !== 'function') return

    const createGame = api.createGame as (input: unknown) => GameView
    const input = { gameId: 'game-1', playerIds: ['p1', 'p2'], rules: api.defaultRules, seed: 'seed-7' }
    const first = createGame(input)
    const second = createGame(input)

    expect(first.players).toEqual(second.players)
    expect(first.drawPile).toEqual(second.drawPile)
    expect(first.players.p1?.hand).toHaveLength(3)
    expect(first.players.p2?.hand).toHaveLength(3)
  })

  it('uses a non-wild initial discard without resolving it', () => {
    const api = rules as Record<string, unknown>
    expect(api.createGame).toBeTypeOf('function')
    if (typeof api.createGame !== 'function') return

    const game = (api.createGame as (input: unknown) => GameView)({
      gameId: 'game-2', playerIds: ['p1', 'p2'], rules: api.defaultRules, seed: 'initial-discard',
    })

    expect(game.discardPile).toHaveLength(1)
    expect(game.discardPile[0]?.kind).not.toBe('betray')
    expect(game.controllerByArmy).toEqual({ white: 'p1', black: 'p2' })
    expect(game.players.p2?.statuses).toEqual([])
    expect(game.activePlayerId).toBe('p1')
    expect(game.turn.phase).toBe('turn-start')
  })
})
