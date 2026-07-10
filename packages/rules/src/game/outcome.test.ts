import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'
import { buildTestState, evaluateOutcome } from '../index.js'

describe('hybrid outcomes', () => {
  it('exposes an outcome evaluator for a complete UNO Chess state', () => {
    const api = rules as Record<string, unknown>

    expect(api.evaluateOutcome).toBeTypeOf('function')
  })

  it('declares stalemate when the active army is not checked and has no legal chess move or card', () => {
    const state = buildTestState({ phase: 'turn-start' })
    state.activePlayerId = 'p2'
    state.board.fen = 'k7/2Q5/2K5/8/8/8/8/8 b - - 0 1'
    state.players.p2!.hand = []

    expect(evaluateOutcome(state)).toEqual({ kind: 'draw', reason: 'stalemate' })
  })

  it('stays ongoing when a matching function card is a legal turn option despite no chess move', () => {
    const state = buildTestState({ phase: 'turn-start' })
    state.activePlayerId = 'p2'
    state.board.fen = 'k7/2Q5/2K5/8/8/8/8/8 b - - 0 1'
    state.discardFace = { kind: 'action-2', color: 'red' }
    state.players.p2!.hand = [{ id: 'reverse:red:test', kind: 'reverse', color: 'red' }]

    expect(evaluateOutcome(state)).toEqual({ kind: 'ongoing' })
  })

  it('declares a draw when the configured individual-move limit is reached', () => {
    const state = buildTestState({ phase: 'turn-start' })
    state.board.halfmoveClock = state.rules.chess.halfmoveLimit

    expect(evaluateOutcome(state)).toEqual({ kind: 'draw', reason: 'halfmove-limit' })
  })

  it('declares a draw when the current authoritative position has occurred three times', () => {
    const state = buildTestState({ phase: 'turn-start' })
    state.positionOccurrences = { 'current-position': 3 }

    expect(evaluateOutcome(state)).toEqual({ kind: 'draw', reason: 'repetition' })
  })
})
