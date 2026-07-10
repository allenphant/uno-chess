import { Chess } from 'chess.js'
import type { ArmyColor, PromotionPiece, Square } from '@uno-chess/protocol'

export interface LegalChessMove {
  from: Square
  to: Square
  san: string
  flags: string
  piece: string
  promotion?: PromotionPiece
  captured?: string
}

export interface ChessMoveInput {
  fen: string
  army: ArmyColor
  enPassantTarget: Square | null
  from: Square
  to: Square
  promotion?: PromotionPiece
}

export interface AppliedChessMove {
  fen: string
  move: LegalChessMove
  givesCheck: boolean
}

export function fenForArmy(fen: string, army: ArmyColor, enPassantTarget: Square | null): string {
  const [placement, , castling, , halfmove, fullmove] = fen.split(' ')
  if (!placement || !castling || !halfmove || !fullmove) throw new Error('INVALID_FEN')
  return [placement, army === 'white' ? 'w' : 'b', castling, enPassantTarget ?? '-', halfmove, fullmove].join(' ')
}

export function legalChessMoves(input: Pick<ChessMoveInput, 'fen' | 'army' | 'enPassantTarget'>): LegalChessMove[] {
  const chess = new Chess(fenForArmy(input.fen, input.army, input.enPassantTarget))
  return chess.moves({ verbose: true }).map(toLegalChessMove)
}

export function applyChessMove(input: ChessMoveInput): AppliedChessMove {
  const chess = new Chess(fenForArmy(input.fen, input.army, input.enPassantTarget))
  const request = {
    from: input.from,
    to: input.to,
    ...(input.promotion ? { promotion: input.promotion } : {}),
  }
  const move = chess.move(request)
  return { fen: chess.fen(), move: toLegalChessMove(move), givesCheck: chess.isCheck() }
}

export function isArmyInCheck(input: Pick<ChessMoveInput, 'fen' | 'army' | 'enPassantTarget'>): boolean {
  const chess = new Chess(fenForArmy(input.fen, input.army, input.enPassantTarget))
  return chess.isCheck()
}

function toLegalChessMove(move: {
  from: string
  to: string
  san: string
  flags: string
  piece: string
  promotion?: string
  captured?: string
}): LegalChessMove {
  return {
    from: move.from as Square,
    to: move.to as Square,
    san: move.san,
    flags: move.flags,
    piece: move.piece,
    ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
    ...(move.captured ? { captured: move.captured } : {}),
  }
}
