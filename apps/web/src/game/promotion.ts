import type { PromotionPiece, Square } from '@uno-chess/protocol'

export type PromotionMove = { from: Square; to: Square; promotion?: PromotionPiece }

export function promotionChoicesForMove(moves: ReadonlyArray<PromotionMove>, from: Square, to: Square): PromotionPiece[] {
  return moves.flatMap((move) => move.from === from && move.to === to && move.promotion ? [move.promotion] : [])
}
