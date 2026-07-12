/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChessBoard } from './ChessBoard.js'
import type { PieceRecord } from '@uno-chess/protocol'

afterEach(cleanup)

const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('ChessBoard presentation', () => {
  it('keeps 64 logical cells while showing file and rank coordinates', () => {
    render(<ChessBoard fen={initialFen} perspective="white" legalMoves={[]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={() => undefined} />)

    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
    expect(screen.getByRole('gridcell', { name: 'a1' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: 'h8' })).toBeTruthy()
    expect(screen.getByTestId('coordinate-file-a')).toBeTruthy()
    expect(screen.getByTestId('coordinate-rank-1')).toBeTruthy()
    expect(screen.getByTestId('board').querySelector('.piece.white[data-square="a1"]')).toBeTruthy()
    expect(screen.getByTestId('board').querySelector('.piece.black[data-square="a8"]')).toBeTruthy()
  })

  it('places black perspective coordinates on the corresponding visual edges', () => {
    render(<ChessBoard fen={initialFen} perspective="black" legalMoves={[]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={() => undefined} />)

    expect(screen.getByTestId('coordinate-file-h')).toBeTruthy()
    expect(screen.getByTestId('coordinate-rank-8')).toBeTruthy()
  })

  it('ignores square clicks while a card drag locks the board', async () => {
    const onSquareClick = vi.fn()
    render(<ChessBoard fen={initialFen} perspective="white" interactionLocked legalMoves={[]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={onSquareClick} />)

    await userEvent.click(screen.getByRole('gridcell', { name: 'e2' }))

    expect(onSquareClick).not.toHaveBeenCalled()
  })

  it('marks a piece square movable only when it has a legal destination', () => {
    render(<ChessBoard fen={initialFen} perspective="white" interactionLocked={false} legalMoves={[{ from: 'e2', to: 'e4' }]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={() => undefined} />)

    expect(screen.getByRole('gridcell', { name: 'e2' }).classList.contains('movable')).toBe(true)
    expect(screen.getByRole('gridcell', { name: 'd2' }).classList.contains('movable')).toBe(false)
  })

  it('shows selected and assigned reinforcement pieces as board ghosts', () => {
    render(<ChessBoard fen={initialFen} perspective="white" legalMoves={[]} selectedSquare={null} legalTargets={['c3']} ghostPieces={[{ square: 'c3', army: 'white', kind: 'n', status: 'target' }, { square: 'd4', army: 'white', kind: 'p', status: 'assigned' }]} onMove={() => undefined} onSquareClick={() => undefined} />)

    expect(screen.getByTestId('board').querySelector('.piece.ghost.target[data-square="c3"]')?.textContent).toBe('♘')
    expect(screen.getByTestId('board').querySelector('.piece.ghost.assigned[data-square="d4"]')?.textContent).toBe('♙')
  })

  it('keeps a stable piece element while its square changes', () => {
    const pawn: PieceRecord = { id: 'white-pawn-e', army: 'white', kind: 'p', originalSquare: 'e2' }
    const props = { perspective: 'white' as const, legalMoves: [], selectedSquare: null, legalTargets: [], onMove: () => undefined, onSquareClick: () => undefined }
    const { rerender } = render(<ChessBoard {...props} fen={initialFen} activePieces={{ e2: pawn }} />)
    const before = screen.getByTestId('piece-white-pawn-e')

    rerender(<ChessBoard {...props} fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" activePieces={{ e4: pawn }} />)

    const after = screen.getByTestId('piece-white-pawn-e')
    expect(after).toBe(before)
    expect(after.getAttribute('data-square')).toBe('e4')
  })

  it('keeps piece controls exposed to assistive technology', () => {
    render(<ChessBoard fen={initialFen} perspective="white" legalMoves={[]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={() => undefined} />)

    expect(screen.getByRole('button', { name: 'a1 的棋子' })).toBeTruthy()
  })
})
