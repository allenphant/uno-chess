import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('outcome integration', () => {
  it('finishes the game and emits an event when a completed move checkmates the next player', () => {
    const state = buildTestState({ phase: 'await-action' })
    state.board.fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1'
    state.players.p2!.hand = []

    const result = applyIntent(state, {
      type: 'basic-move', playerId: 'p1', intentId: 'mate-in-one', from: 'g6', to: 'g7',
    })

    expect(result.state.status).toEqual({ kind: 'finished', winnerId: 'p1', reason: 'checkmate' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'game-ended', winnerId: 'p1', reason: 'checkmate' }))
  })

  it('rejects new intents once the game is finished', () => {
    const state = buildTestState({ phase: 'await-action' })
    state.board.fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1'
    state.players.p2!.hand = []
    const finished = applyIntent(state, {
      type: 'basic-move', playerId: 'p1', intentId: 'mate-again', from: 'g6', to: 'g7',
    }).state

    expect(() => applyIntent(finished, {
      type: 'basic-move', playerId: 'p2', intentId: 'after-mate', from: 'h8', to: 'h7',
    })).toThrow('GAME_FINISHED')
  })
})
