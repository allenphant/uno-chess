import type { CardId, PlayerId, Square } from './domain.js'

interface GameEventBase {
  gameId: string
  sequence: number
}

export type GameEvent =
  | (GameEventBase & { type: 'game-created' })
  | (GameEventBase & { type: 'turn-started'; playerId: PlayerId; turnNumber: number })
  | (GameEventBase & { type: 'card-drawn'; playerId: PlayerId; cardId: CardId })
  | (GameEventBase & { type: 'card-overflow-discarded'; playerId: PlayerId; cardId: CardId })
  | (GameEventBase & { type: 'turn-action-opened'; playerId: PlayerId })
  | (GameEventBase & { type: 'card-played'; playerId: PlayerId; cardId: CardId })
  | (GameEventBase & { type: 'piece-moved'; playerId: PlayerId; from: Square; to: Square; san: string })
  | (GameEventBase & { type: 'piece-captured'; playerId: PlayerId; at: Square; piece: string })
  | (GameEventBase & { type: 'piece-promoted'; playerId: PlayerId; at: Square; piece: string })
  | (GameEventBase & { type: 'check-given'; playerId: PlayerId })
  | (GameEventBase & { type: 'turn-ended'; playerId: PlayerId; nextPlayerId: PlayerId })
  | (GameEventBase & { type: 'game-ended'; winnerId: PlayerId | null; reason: string })
