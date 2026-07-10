import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

describe('legalChessMoves', () => {
  it('returns standard opening moves for only the requested army', () => {
    const api = rules as Record<string, unknown>
    expect(api.legalChessMoves).toBeTypeOf('function')
    if (typeof api.legalChessMoves !== 'function') return

    const legalChessMoves = api.legalChessMoves as (input: unknown) => Array<{ from: string; to: string }>
    const moves = legalChessMoves({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      army: 'white',
      enPassantTarget: null,
    })

    expect(moves).toContainEqual(expect.objectContaining({ from: 'e2', to: 'e4' }))
    expect(moves).not.toContainEqual(expect.objectContaining({ from: 'e7', to: 'e5' }))
  })
})
