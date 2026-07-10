import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('position repetition tracking', () => {
  it('counts a return to the same authoritative position even when FEN move counters changed', () => {
    let state = buildTestState({ phase: 'await-action' })
    const moves = [
      { playerId: 'p1', intentId: 'white-out', from: 'g1', to: 'f3' },
      { playerId: 'p2', intentId: 'black-out', from: 'g8', to: 'f6' },
      { playerId: 'p1', intentId: 'white-back', from: 'f3', to: 'g1' },
      { playerId: 'p2', intentId: 'black-back', from: 'f6', to: 'g8' },
    ] as const

    for (const move of moves) {
      state.turn.phase = 'await-action'
      state = applyIntent(state, { type: 'basic-move', ...move }).state
    }

    expect(Math.max(...Object.values(state.positionOccurrences))).toBe(2)
  })

  it('ends the game when the same authoritative position is reached for the third time', () => {
    let state = buildTestState({ phase: 'await-action' })
    const moves = [
      { playerId: 'p1', from: 'g1', to: 'f3' },
      { playerId: 'p2', from: 'g8', to: 'f6' },
      { playerId: 'p1', from: 'f3', to: 'g1' },
      { playerId: 'p2', from: 'f6', to: 'g8' },
    ] as const

    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (const [index, move] of moves.entries()) {
        state.turn.phase = 'await-action'
        state = applyIntent(state, {
          type: 'basic-move', ...move, intentId: `repetition:${cycle}:${index}`,
        }).state
      }
    }

    expect(state.status).toEqual({ kind: 'finished', winnerId: null, reason: 'repetition' })
  })
})
