import { describe, expect, it } from 'vitest'
import { promotionChoicesForMove } from './promotion.js'

describe('promotionChoicesForMove', () => {
  it('returns every promotion variant for a shared source and destination', () => {
    const moves = [
      { from: 'a7', to: 'a8', promotion: 'q' },
      { from: 'a7', to: 'a8', promotion: 'r' },
      { from: 'a7', to: 'a8', promotion: 'b' },
      { from: 'a7', to: 'a8', promotion: 'n' },
      { from: 'b2', to: 'b3' },
    ] as const

    expect(promotionChoicesForMove(moves, 'a7', 'a8')).toEqual(['q', 'r', 'b', 'n'])
    expect(promotionChoicesForMove(moves, 'b2', 'b3')).toEqual([])
  })
})
