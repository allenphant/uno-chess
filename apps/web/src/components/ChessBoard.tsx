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
    <div className="board" data-testid="board" data-card-drop-zone="true" data-card-ready={String(cardReady)} role="grid" aria-label="西洋棋盤">
      {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
        const square = `${file}${rank}` as Square
        const dark = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 1
        const selected = selectedSquare === square
        const target = legalTargets.includes(square)
        const pieceToken = pieces[square] ?? ''
        const pieceArmy = pieceToken ? pieceToken === pieceToken.toUpperCase() ? 'white' : 'black' : null
        return <BoardSquare dark={dark} fileLabel={rankIndex === ranks.length - 1 ? file : null} glyph={glyphs[pieceToken] ?? ''} key={square} legalTargets={legalTargets} pieceArmy={pieceArmy} rankLabel={fileIndex === 0 ? rank : null} selected={selected} square={square} target={target} onSquareClick={onSquareClick} />
      }))}
    </div>
  )
}

function BoardSquare({ dark, fileLabel, glyph, legalTargets, pieceArmy, rankLabel, selected, square, target, onSquareClick }: { dark: boolean; fileLabel: string | null; glyph: string; legalTargets: Square[]; pieceArmy: ArmyColor | null; rankLabel: number | null; selected: boolean; square: Square; target: boolean; onSquareClick: (square: Square) => void }) {
  const drag = usePieceDrag({ enabled: selected, from: square, legalTargets, onCommit: ({ from, to }) => { onSquareClick(from); onSquareClick(to) } })
  return <button className={`square ${dark ? 'dark' : 'light'}${selected ? ' selected' : ''}${target ? ' legal-target' : ''}${drag.dragging ? ' dragging' : ''}`} data-square={square} role="gridcell" aria-label={square} onClick={() => onSquareClick(square)} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerUp={drag.onPointerUp}>
    <span className={`piece${pieceArmy ? ` ${pieceArmy}` : ''}`} aria-hidden="true">{glyph}</span>
    {rankLabel !== null ? <span className="coordinate coordinate-rank" data-testid={`coordinate-rank-${rankLabel}`} aria-hidden="true">{rankLabel}</span> : null}
    {fileLabel !== null ? <span className="coordinate coordinate-file" data-testid={`coordinate-file-${fileLabel}`} aria-hidden="true">{fileLabel}</span> : null}
  </button>
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
