import type { CardColor, CardId, PlayerId, Square } from './domain.js'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export type GameIntent =
  | { type: 'draw-for-turn'; playerId: PlayerId; intentId: string }
  | { type: 'discard-overflow'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'basic-move'; playerId: PlayerId; intentId: string; from: Square; to: Square; promotion?: PromotionPiece }
  | { type: 'play-action-card'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'action-move'; playerId: PlayerId; intentId: string; from: Square; to: Square; promotion?: PromotionPiece }
  | { type: 'finish-action-card'; playerId: PlayerId; intentId: string }
  | { type: 'play-function-card'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'choose-reinforcement'; playerId: PlayerId; intentId: string; capturedPieceIds: string[]; squares: Square[] }
  | { type: 'choose-wild-color'; playerId: PlayerId; intentId: string; color: CardColor }
