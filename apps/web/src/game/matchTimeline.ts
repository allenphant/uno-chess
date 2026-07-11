import type { CardColor, CardKind, ChessPieceKind, GameEvent, PlayerId, Square } from '@uno-chess/protocol'

export type TimelineEntry =
  | { sequence: number; turnNumber: number; playerId: PlayerId; kind: 'card'; cardKind: CardKind; color: CardColor | null }
  | { sequence: number; turnNumber: number; playerId: PlayerId; kind: 'move'; san: string }
  | { sequence: number; turnNumber: number; playerId: PlayerId; kind: 'reinforcement'; piece: ChessPieceKind; square: Square }

export function buildTimeline(events: GameEvent[]): TimelineEntry[] {
  let turnNumber = 1
  const entries: TimelineEntry[] = []
  for (const event of events) {
    if (event.type === 'turn-started') turnNumber = event.turnNumber
    if (event.type === 'card-played') {
      entries.push({ sequence: event.sequence, turnNumber, playerId: event.playerId, kind: 'card', cardKind: event.kind, color: event.color })
    }
    if (event.type === 'piece-moved') {
      entries.push({ sequence: event.sequence, turnNumber, playerId: event.playerId, kind: 'move', san: event.san })
    }
    if (event.type === 'piece-reinforced') {
      entries.push({ sequence: event.sequence, turnNumber, playerId: event.playerId, kind: 'reinforcement', piece: event.piece, square: event.at })
    }
    if (event.type === 'turn-ended') turnNumber += 1
  }
  return entries
}
