import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'
import { buildTestState, projectPlayerView } from '../index.js'

describe('player projections', () => {
  it('exposes a player-safe state projection API', () => {
    const api = rules as Record<string, unknown>

    expect(api.projectPlayerView).toBeTypeOf('function')
  })

  it('shows the requesting hand while hiding the opponent hand and draw-pile cards', () => {
    const state = buildTestState({})
    const view = projectPlayerView(state, 'p1') as unknown as {
      self: { hand: unknown[] }
      opponent: { hand: { count: number } }
      drawPileCount: number
    }

    expect(view).toMatchObject({
      self: { hand: state.players.p1?.hand },
      opponent: { hand: { count: state.players.p2?.hand.length } },
      drawPileCount: state.drawPile.length,
    })
    expect(view).not.toHaveProperty('drawPile')
    expect(view).not.toHaveProperty('players')
  })
})
