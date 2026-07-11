import type { ArmyColor, Square } from '@uno-chess/protocol'
import { usePieceDrag } from '../input/usePieceDrag.js'

const glyphs: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

export interface ChessBoardProps {
  fen: string
  perspective: ArmyColor
  cardReady: boolean
  selectedSquare: Square | null
  legalTargets: Square[]
  onSquareClick: (square: Square) => void
}

export function ChessBoard({ fen, perspective, cardReady, selectedSquare, legalTargets, onSquareClick }: ChessBoardProps) {
  const pieces = piecesFromFen(fen)
  const ranks = perspective === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = perspective === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']

  return (
    <div className="board" data-testid="board" data-card-drop-zone="true" data-card-ready={String(cardReady)} role="grid" aria-label="Chess board">
      {ranks.flatMap((rank) => files.map((file) => {
        const square = `${file}${rank}` as Square
        const dark = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 1
        const selected = selectedSquare === square
        const target = legalTargets.includes(square)
        return <BoardSquare dark={dark} glyph={glyphs[pieces[square] ?? ''] ?? ''} key={square} legalTargets={legalTargets} selected={selected} square={square} target={target} onSquareClick={onSquareClick} />
      }))}
    </div>
  )
}

function BoardSquare({ dark, glyph, legalTargets, selected, square, target, onSquareClick }: { dark: boolean; glyph: string; legalTargets: Square[]; selected: boolean; square: Square; target: boolean; onSquareClick: (square: Square) => void }) {
  const drag = usePieceDrag({ enabled: selected, from: square, legalTargets, onCommit: ({ from, to }) => { onSquareClick(from); onSquareClick(to) } })
  return <button className={`square ${dark ? 'dark' : 'light'}${selected ? ' selected' : ''}${target ? ' legal-target' : ''}${drag.dragging ? ' dragging' : ''}`} data-square={square} role="gridcell" aria-label={square} onClick={() => onSquareClick(square)} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerUp={drag.onPointerUp}>{glyph}</button>
}

function piecesFromFen(fen: string): Partial<Record<Square, string>> {
  const placement = fen.split(' ')[0]
  if (!placement) return {}
  const pieces: Partial<Record<Square, string>> = {}
  for (const [rankIndex, rank] of placement.split('/').entries()) {
    let fileIndex = 0
    for (const token of rank) {
      if (/\d/.test(token)) fileIndex += Number(token)
      else {
        const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}` as Square
        pieces[square] = token
        fileIndex += 1
      }
    }
  }
  return pieces
}
