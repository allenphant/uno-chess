export type PlayerId = string
export type ArmyColor = 'white' | 'black'
export type CardColor = 'red' | 'yellow' | 'green' | 'blue'
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q'

export const coreCardKinds = ['action-2', 'action-3', 'reinforce-1', 'reinforce', 'seal', 'reverse', 'betray'] as const
export type CoreCardKind = typeof coreCardKinds[number]
export type CardKind = string
export type CardId = string
export type Square = `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`

export interface CardInstance {
  id: CardId
  kind: CardKind
  color: CardColor | null
}

export type EffectOperationSpec =
  | { type: 'start-action'; budget: 1 | 2 | 3; minimumMoves: 0 | 1 }
  | { type: 'set-status'; target: 'opponent'; status: 'sealed'; turns: 1 }
  | { type: 'swap-hands' }
  | { type: 'swap-army-controllers' }
  | { type: 'request-reinforcement'; maximumPieces: 1 | 2 }
  | { type: 'request-wild-color' }
  | { type: 'draw-cards'; target: 'self' | 'opponent'; count: number }
  | { type: 'end-turn' }

export interface CardDefinitionSnapshot {
  kind: CardKind
  displayNameKey: string
  matchKey: string
  category: 'action' | 'function'
  enabled: boolean
  colors: CardColor[]
  copies: number
  program: EffectOperationSpec[]
}

export interface RuleSnapshot {
  schemaVersion: 1
  presetId: string
  presetVersion: 1
  cardCatalogVersion: 1
  hand: {
    startingSize: number
    maximumSize: number
    drawPerTurn: number
  }
  matching: {
    byColor: boolean
    byMatchKey: boolean
    wildCardKinds: CardKind[]
    wildChoosesColor: boolean
  }
  cards: CardDefinitionSnapshot[]
  reinforce: {
    maximumPieces: number
    allowedPieceKinds: PieceKind[]
    mode: 'tactical-own-half' | 'classic-start-square' | 'chaos-anywhere'
  }
  chess: {
    checkInterruptsAction: boolean
    repetition: boolean
    halfmoveLimit: number
    insufficientMaterial: boolean
  }
  timing: {
    turnSeconds: number | null
    disconnectGraceSeconds: number
    disconnectExpiry: 'forfeit'
  }
}

export type ChessPieceKind = PieceKind | 'k'

export interface PieceRecord {
  id: string
  army: ArmyColor
  kind: ChessPieceKind
  originalSquare: Square
}

export interface EnPassantWindow {
  target: Square
  captureByArmy: ArmyColor
  expiresAfterTurnNumber: number
}

export interface BoardState {
  fen: string
  enPassantWindow: EnPassantWindow | null
  capturedByArmy: Record<ArmyColor, PieceRecord[]>
  activePieces: Partial<Record<Square, PieceRecord>>
  halfmoveClock: number
}

export type PlayerStatus = { kind: 'sealed'; remainingTurns: number }

export interface PlayerState {
  id: PlayerId
  hand: CardInstance[]
  statuses: PlayerStatus[]
}

export interface DiscardFace {
  kind: CardKind
  color: CardColor
}

export type TurnPhase = 'turn-start' | 'await-overflow-discard' | 'await-action' | 'await-action-move' | 'await-effect-choice'

export interface TurnState {
  number: number
  phase: TurnPhase
  drewCard: boolean
  playedCardId: CardId | null
  actionBudget: 0 | 1 | 2 | 3
  actionMinimum: 0 | 1
  actionsUsed: number
  pendingEffect: null
    | { kind: 'reinforce'; cardId: CardId; nextOperationIndex: number; maximumPieces: 1 | 2 }
    | { kind: 'wild-color'; cardId: CardId; nextOperationIndex: number }
}

export type GameStatus =
  | { kind: 'active' }
  | { kind: 'finished'; winnerId: PlayerId | null; reason: 'checkmate' | 'stalemate' | 'repetition' | 'halfmove-limit' | 'resignation' | 'timeout' }

export interface GameState {
  gameId: string
  rules: RuleSnapshot
  seed: string
  rngCursor: number
  board: BoardState
  playerOrder: [PlayerId, PlayerId]
  players: Record<PlayerId, PlayerState>
  controllerByArmy: Record<ArmyColor, PlayerId>
  activePlayerId: PlayerId
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  discardFace: DiscardFace | null
  turn: TurnState
  status: GameStatus
  eventSequence: number
  positionOccurrences: Record<string, number>
  acceptedIntentIds: string[]
}
