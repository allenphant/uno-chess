/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PieceRecord } from '@uno-chess/protocol'
import { PlayerGraveyard } from './PlayerGraveyard.js'
import { materialValue, pieceGlyph } from '../presentation/chessPieces.js'

afterEach(cleanup)

const pieces: PieceRecord[] = [
  { id: 'white-pawn-a', army: 'white', kind: 'p', originalSquare: 'a2' },
  { id: 'white-knight-b', army: 'white', kind: 'n', originalSquare: 'b1' },
]

describe('PlayerGraveyard', () => {
  it('shows captured pieces, material advantage and eligible selection', async () => {
    const onSelect = vi.fn()
    render(<PlayerGraveyard army="white" pieces={pieces} materialDelta={3} eligiblePieceIds={['white-knight-b']} selectedPieceId="white-knight-b" onSelect={onSelect} />)

    expect(screen.getByRole('region', { name: '白方墓地' })).toBeTruthy()
    expect(screen.getByText('+3')).toBeTruthy()
    expect(screen.getByText('♙')).toBeTruthy()
    expect(screen.getByRole('button', { name: '選擇復活白方馬' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: '選擇復活白方馬' }))
    expect(onSelect).toHaveBeenCalledWith('white-knight-b')
  })

  it('uses conventional material values and army-specific glyphs', () => {
    expect((['p', 'n', 'b', 'r', 'q', 'k'] as const).map(materialValue)).toEqual([1, 3, 3, 5, 9, 0])
    expect(pieceGlyph('black', 'q')).toBe('♛')
    expect(pieceGlyph('white', 'q')).toBe('♕')
  })
})
