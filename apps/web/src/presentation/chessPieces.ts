import type { ArmyColor, ChessPieceKind } from '@uno-chess/protocol'

const glyphs: Record<ArmyColor, Record<ChessPieceKind, string>> = {
  white: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  black: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

const values: Record<ChessPieceKind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export function pieceGlyph(army: ArmyColor, kind: ChessPieceKind): string {
  return glyphs[army][kind]
}

export function materialValue(kind: ChessPieceKind): number {
  return values[kind]
}
