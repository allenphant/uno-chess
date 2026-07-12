import type { ArmyColor, BoardState, ChessPieceKind, PieceRecord, Square } from '@uno-chess/protocol'
import type { CSSProperties } from 'react'
import { usePieceDrag } from '../input/usePieceDrag.js'
import { pieceGlyph } from '../presentation/chessPieces.js'

const tokenKinds: Record<string, ChessPieceKind> = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' }

type LegalMove = { from: Square; to: Square }
type GhostPiece = { square: Square; army: ArmyColor; kind: ChessPieceKind; status: 'target' | 'assigned' }

export interface ChessBoardProps {
  fen: string
  activePieces?: BoardState['activePieces']
  perspective: ArmyColor
  cardReady?: boolean
  interactionLocked?: boolean
  legalMoves: ReadonlyArray<LegalMove>
  selectedSquare: Square | null
  legalTargets: Square[]
  ghostPieces?: GhostPiece[]
  onMove: (from: Square, to: Square) => void
  onSquareClick: (square: Square) => void
}

export function ChessBoard({ fen, activePieces, perspective, interactionLocked = false, legalMoves, selectedSquare, legalTargets, ghostPieces = [], onMove, onSquareClick }: ChessBoardProps) {
  const ranks = perspective === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = perspective === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
  const pieces = visualPieces(fen, activePieces)

  return <div className="board" data-testid="board" role="grid" aria-label="西洋棋盤">
    <div className="board-squares">
      {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
        const square = `${file}${rank}` as Square
        const directTargets = legalMoves.filter((move) => move.from === square).map((move) => move.to)
        return <BoardSquare dark={(fileIndex + rankIndex) % 2 === 1} fileLabel={rankIndex === ranks.length - 1 ? file : null} interactionLocked={interactionLocked} key={square} movable={directTargets.length > 0} rankLabel={fileIndex === 0 ? rank : null} selected={selectedSquare === square} square={square} target={legalTargets.includes(square)} onSquareClick={onSquareClick} />
      }))}
    </div>
    <div className="piece-layer">
      {pieces.map((piece) => <PieceSprite interactionLocked={interactionLocked} key={piece.id} legalTargets={legalMoves.filter((move) => move.from === piece.square).map((move) => move.to)} perspective={perspective} piece={piece} onMove={onMove} onSquareClick={onSquareClick} />)}
      {ghostPieces.map((ghost, index) => <span className={`piece-sprite piece ghost ${ghost.status} ${ghost.army}`} data-square={ghost.square} aria-hidden="true" key={`${ghost.status}:${ghost.square}:${index}`} style={positionStyle(ghost.square, perspective)}><span className="piece-glyph">{pieceGlyph(ghost.army, ghost.kind)}</span></span>)}
    </div>
  </div>
}

function BoardSquare({ dark, fileLabel, interactionLocked, movable, rankLabel, selected, square, target, onSquareClick }: { dark: boolean; fileLabel: string | null; interactionLocked: boolean; movable: boolean; rankLabel: number | null; selected: boolean; square: Square; target: boolean; onSquareClick: (square: Square) => void }) {
  return <button className={`square ${dark ? 'dark' : 'light'}${movable ? ' movable' : ''}${selected ? ' selected' : ''}${target ? ' legal-target' : ''}`} data-square={square} disabled={interactionLocked} role="gridcell" aria-label={square} onClick={() => { if (!interactionLocked) onSquareClick(square) }}>
    {rankLabel !== null ? <span className="coordinate coordinate-rank" data-testid={`coordinate-rank-${rankLabel}`} aria-hidden="true">{rankLabel}</span> : null}
    {fileLabel !== null ? <span className="coordinate coordinate-file" data-testid={`coordinate-file-${fileLabel}`} aria-hidden="true">{fileLabel}</span> : null}
  </button>
}

function PieceSprite({ interactionLocked, legalTargets, perspective, piece, onMove, onSquareClick }: { interactionLocked: boolean; legalTargets: Square[]; perspective: ArmyColor; piece: VisualPiece; onMove: (from: Square, to: Square) => void; onSquareClick: (square: Square) => void }) {
  const movable = legalTargets.length > 0
  const drag = usePieceDrag({ enabled: movable && !interactionLocked, from: piece.square, legalTargets, onStart: onSquareClick, onCommit: ({ from, to }) => onMove(from, to) })
  const dragOffsets = drag.offset ? { '--piece-x': `${drag.offset.x}px`, '--piece-y': `${drag.offset.y}px` } : {}
  const style = { ...positionStyle(piece.square, perspective), ...dragOffsets } as CSSProperties
  return <button className={`piece-sprite piece ${piece.army}${movable ? ' movable' : ''}${drag.dragging ? ' dragging' : ''}`} data-piece-id={piece.id} data-square={piece.square} data-testid={`piece-${piece.id}`} disabled={interactionLocked} tabIndex={-1} style={style} aria-label={`${piece.square} 的棋子`} onClick={() => { if (!interactionLocked && !drag.consumeClick()) onSquareClick(piece.square) }} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp}>
    <span className="piece-glyph" aria-hidden="true">{pieceGlyph(piece.army, piece.kind)}</span>
  </button>
}

function positionStyle(square: Square, perspective: ArmyColor): CSSProperties {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const fileIndex = perspective === 'white' ? file : 7 - file
  const rankIndex = perspective === 'white' ? 7 - rank : rank
  return { '--piece-left': `${fileIndex * 100}%`, '--piece-top': `${rankIndex * 100}%` } as CSSProperties
}

interface VisualPiece extends PieceRecord { square: Square }

function visualPieces(fen: string, activePieces: BoardState['activePieces'] | undefined): VisualPiece[] {
  return Object.entries(piecesFromFen(fen)).flatMap(([square, token]) => {
    if (!token) return []
    const typedSquare = square as Square
    const army: ArmyColor = token === token.toUpperCase() ? 'white' : 'black'
    const kind = tokenKinds[token.toLowerCase()]
    if (!kind) return []
    const record = activePieces?.[typedSquare]
    return [{ id: record?.id ?? `fen-${army}-${kind}-${typedSquare}`, army, kind: record?.kind ?? kind, originalSquare: record?.originalSquare ?? typedSquare, square: typedSquare }]
  })
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
