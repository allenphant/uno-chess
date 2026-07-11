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

  it('layers the temporary play zone without changing board layout', () => {
    expect(css).toContain('.board-stage { position: relative;')
    expect(css).toContain('.card-play-zone { position: absolute;')
    expect(css).toContain('.card-play-zone.ready')
  })

  it('supports lifted preview, playable touch gestures, and reduced motion', () => {
    expect(css).toContain('.card.previewing')
    expect(css).toContain('.card.playable')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('.card-play-zone { transition: none; }')
  })

  it('uses the complete board as the card drop zone and drags the glyph instead of a square', () => {
    expect(css).toContain('.card-play-zone { position: absolute; inset: 0;')
    expect(css).toContain('.piece.dragging')
  })
})
