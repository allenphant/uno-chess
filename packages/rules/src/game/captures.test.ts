import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('captured pieces', () => {
  it('records the captured army, kind, and original square for later reinforcement', () => {
    const opening = buildTestState({ phase: 'await-action' })
    const whiteAdvance = applyIntent(opening, {
      type: 'basic-move', playerId: 'p1', intentId: 'white-advance', from: 'e2', to: 'e4',
    })
    whiteAdvance.state.turn.phase = 'await-action'
    const blackAdvance = applyIntent(whiteAdvance.state, {
      type: 'basic-move', playerId: 'p2', intentId: 'black-advance', from: 'd7', to: 'd5',
    })
    blackAdvance.state.turn.phase = 'await-action'

    const captured = applyIntent(blackAdvance.state, {
      type: 'basic-move', playerId: 'p1', intentId: 'white-captures', from: 'e4', to: 'd5',
    })

    expect(captured.state.board.capturedByArmy.black).toContainEqual({
      id: 'black-pawn:d7', army: 'black', kind: 'p', originalSquare: 'd7',
    })
  })
})
