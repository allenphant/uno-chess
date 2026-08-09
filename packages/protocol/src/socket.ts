import type {
  CardInstance,
  DiscardFace,
  GameState,
  GameStatus,
  PlayerId,
  PlayerStatus,
  RuleSnapshot,
  Square,
  TurnState,
} from './domain.js'
import type { GameEvent } from './events.js'
import type { GameIntent } from './intents.js'
import type { CreateFriendRoomInput, FriendRoomView, UpdateFriendRoomInput } from './lobby.js'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_PAYLOAD'
  | 'NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_ACTIVE_PLAYER'
  | 'ILLEGAL_INTENT'
  | 'STALE_REVISION'
  | 'INTERNAL_ERROR'

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } }

export interface PlayerView {
  gameId: string
  rules: RuleSnapshot
  activePlayerId: PlayerId
  controllerByArmy: GameState['controllerByArmy']
  board: Pick<GameState['board'], 'fen' | 'enPassantWindow' | 'capturedByArmy' | 'activePieces' | 'halfmoveClock'>
  discardFace: DiscardFace | null
  discardPile: CardInstance[]
  drawPileCount: number
  turn: TurnState
  status: GameStatus
  self: { id: PlayerId; hand: CardInstance[]; statuses: PlayerStatus[] }
  opponent: { id: PlayerId; hand: { count: number }; statuses: PlayerStatus[] }
  legal: {
    basicMoves: LegalMoveView[]
    actionMoves: LegalMoveView[]
    playableCardIds: string[]
    reinforcementOptions: ReinforcementOptionView[]
  }
}

export interface LegalMoveView {
  from: Square
  to: Square
  san: string
  flags: string
  piece: string
  promotion?: 'q' | 'r' | 'b' | 'n'
  captured?: string
}

export interface ReinforcementOptionView {
  pieceId: string
  kind: string
  squares: Square[]
}

export interface ClientToServerEvents {
  'room:create': (input: CreateFriendRoomInput, ack: (value: Ack<{ code: string }>) => void) => void
  'room:join': (input: { code: string }, ack: (value: Ack<{ gameId: string | null }>) => void) => void
  'room:update': (input: UpdateFriendRoomInput, ack: (value: Ack<{ updated: true }>) => void) => void
  'room:ready': (input: { code: string; rulesHash: string }, ack: (value: Ack<{ ready: true; gameId: string | null }>) => void) => void
  'matchmaking:join': (input: { presetId: string }, ack: (value: Ack<{ queued: true }>) => void) => void
  'matchmaking:leave': (input: Record<string, never>, ack: (value: Ack<{ queued: false }>) => void) => void
  'game:resume': (input: { gameId: string }, ack: (value: Ack<{ view: PlayerView; revision: number }>) => void) => void
  'game:intent': (input: { gameId: string; revision: number; intent: GameIntent }, ack: (value: Ack<{ revision: number }>) => void) => void
}

export interface ServerToClientEvents {
  'room:updated': (payload: FriendRoomView) => void
  'room:started': (payload: { code: string; gameId: string }) => void
  'matchmaking:matched': (payload: { gameId: string }) => void
  'game:projection': (payload: { gameId: string; revision: number; view: PlayerView; events: GameEvent[] }) => void
  'game:paused': (payload: { gameId: string; disconnectedPlayerId: string; resumeDeadline: string }) => void
  'game:resumed': (payload: { gameId: string }) => void
}

export interface InterServerEvents {}

export interface AuthenticatedActor {
  playerId: PlayerId
  accountKind: 'guest' | 'registered'
}

export interface SocketData {
  actor: AuthenticatedActor
}

export interface MatchDescriptor {
  gameId: string
  playerIds: [PlayerId, PlayerId]
  presetId: string
  rules: RuleSnapshot
  rulesHash: string
  seed: string
}
