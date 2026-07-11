/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChessBoard } from './ChessBoard.js'

afterEach(cleanup)

const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('ChessBoard presentation', () => {
  it('keeps 64 logical cells while showing file and rank coordinates', () => {
    render(<ChessBoard fen={initialFen} perspective="white" cardReady={false} selectedSquare={null} legalTargets={[]} onSquareClick={() => undefined} />)

    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
    expect(screen.getByRole('gridcell', { name: 'a1' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: 'h8' })).toBeTruthy()
    expect(screen.getByTestId('coordinate-file-a')).toBeTruthy()
    expect(screen.getByTestId('coordinate-rank-1')).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: 'a1' }).querySelector('.piece.white')).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: 'a8' }).querySelector('.piece.black')).toBeTruthy()
  })

  it('places black perspective coordinates on the corresponding visual edges', () => {
    render(<ChessBoard fen={initialFen} perspective="black" cardReady={false} selectedSquare={null} legalTargets={[]} onSquareClick={() => undefined} />)

    expect(screen.getByTestId('coordinate-file-h')).toBeTruthy()
    expect(screen.getByTestId('coordinate-rank-8')).toBeTruthy()
  })
})
