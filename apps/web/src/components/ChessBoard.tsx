import type { ArmyColor, Square } from '@uno-chess/protocol'
import type { CSSProperties } from 'react'
import { usePieceDrag } from '../input/usePieceDrag.js'

const glyphs: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

export interface ChessBoardProps {
  fen: string
  perspective: ArmyColor
  cardReady?: boolean
  interactionLocked?: boolean
  legalMoves: ReadonlyArray<{ from: Square; to: Square }>
  selectedSquare: Square | null
  legalTargets: Square[]
  onMove: (from: Square, to: Square) => void
  onSquareClick: (square: Square) => void
}

export function ChessBoard({ fen, perspective, interactionLocked = false, legalMoves, selectedSquare, legalTargets, onMove, onSquareClick }: ChessBoardProps) {
  const pieces = piecesFromFen(fen)
  const ranks = perspective === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = perspective === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']

  return (
    <div className="board" data-testid="board" role="grid" aria-label="西洋棋盤">
      {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
        const square = `${file}${rank}` as Square
        const dark = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 1
        const selected = selectedSquare === square
        const target = legalTargets.includes(square)
        const pieceToken = pieces[square] ?? ''
        const pieceArmy = pieceToken ? pieceToken === pieceToken.toUpperCase() ? 'white' : 'black' : null
        const directTargets = legalMoves.filter((move) => move.from === square).map((move) => move.to)
        return <BoardSquare dark={dark} directTargets={directTargets} fileLabel={rankIndex === ranks.length - 1 ? file : null} glyph={glyphs[pieceToken] ?? ''} interactionLocked={interactionLocked} key={square} pieceArmy={pieceArmy} rankLabel={fileIndex === 0 ? rank : null} selected={selected} square={square} target={target} onMove={onMove} onSquareClick={onSquareClick} />
      }))}
    </div>
  )
}

function BoardSquare({ dark, directTargets, fileLabel, glyph, interactionLocked, pieceArmy, rankLabel, selected, square, target, onMove, onSquareClick }: { dark: boolean; directTargets: Square[]; fileLabel: string | null; glyph: string; interactionLocked: boolean; pieceArmy: ArmyColor | null; rankLabel: number | null; selected: boolean; square: Square; target: boolean; onMove: (from: Square, to: Square) => void; onSquareClick: (square: Square) => void }) {
  const movable = glyph.length > 0 && directTargets.length > 0
  const drag = usePieceDrag({ enabled: movable && !interactionLocked, from: square, legalTargets: directTargets, onStart: onSquareClick, onCommit: ({ from, to }) => onMove(from, to) })
  const dragStyle = drag.offset ? { '--piece-x': `${drag.offset.x}px`, '--piece-y': `${drag.offset.y}px` } as CSSProperties : undefined
  return <button className={`square ${dark ? 'dark' : 'light'}${movable ? ' movable' : ''}${selected ? ' selected' : ''}${target ? ' legal-target' : ''}`} data-square={square} disabled={interactionLocked} role="gridcell" aria-label={square} onClick={() => { if (!interactionLocked && !drag.consumeClick()) onSquareClick(square) }} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp}>
    <span className={`piece${pieceArmy ? ` ${pieceArmy}` : ''}${drag.dragging ? ' dragging' : ''}`} {...(dragStyle ? { style: dragStyle } : {})} aria-hidden="true">{glyph}</span>
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
