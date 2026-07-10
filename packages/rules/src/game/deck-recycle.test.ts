import type { CardInstance } from '@uno-chess/protocol'
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('draw pile recycling', () => {
  it('reshuffles only the non-top discard cards when the draw pile is exhausted', () => {
    const state = buildTestState({ phase: 'turn-start' })
    const recyclable: CardInstance = { id: 'action-2:red:recycle', kind: 'action-2', color: 'red' }
    const secondRecyclable: CardInstance = { id: 'action-3:green:recycle', kind: 'action-3', color: 'green' }
    const retainedTop: CardInstance = { id: 'seal:blue:top', kind: 'seal', color: 'blue' }
    state.drawPile = []
    state.discardPile = [recyclable, secondRecyclable, retainedTop]
    state.discardFace = { kind: retainedTop.kind, color: 'blue' }

    const result = applyIntent(state, { type: 'draw-for-turn', playerId: 'p1', intentId: 'recycle-draw' })

    expect(result.state.players.p1?.hand).toContainEqual(expect.objectContaining({ id: expect.stringMatching(/recycle$/) }))
    expect(result.state.discardPile).toEqual([retainedTop])
    expect(result.state.discardFace).toEqual({ kind: 'seal', color: 'blue' })
    expect(result.state.rngCursor).toBeGreaterThan(state.rngCursor)
  })
})
