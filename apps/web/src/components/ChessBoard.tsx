import type { ArmyColor, Square } from '@uno-chess/protocol'

const glyphs: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

export interface ChessBoardProps {
  fen: string
  perspective: ArmyColor
  cardReady: boolean
}

export function ChessBoard({ fen, perspective, cardReady }: ChessBoardProps) {
  const pieces = piecesFromFen(fen)
  const ranks = perspective === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = perspective === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']

  return (
    <div className="board" data-testid="board" data-card-ready={String(cardReady)} role="grid" aria-label="Chess board">
      {ranks.flatMap((rank) => files.map((file) => {
        const square = `${file}${rank}` as Square
        const dark = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 1
        return <button className={`square ${dark ? 'dark' : 'light'}`} key={square} role="gridcell" aria-label={square}>{glyphs[pieces[square] ?? ''] ?? ''}</button>
      }))}
    </div>
  )
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
