import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./game.css', import.meta.url), 'utf8')

describe('game board and card geometry', () => {
  it('locks the board to eight equal rows and columns regardless of piece content', () => {
    expect(css).toContain('grid-template-rows: repeat(8, minmax(0, 1fr))')
    expect(css).toContain('min-height: 0')
  })

  it('uses a portrait playing-card ratio', () => {
    expect(css).toContain('aspect-ratio: 5 / 7')
  })
})
