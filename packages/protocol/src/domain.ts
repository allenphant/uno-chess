export type PlayerId = string
export type ArmyColor = 'white' | 'black'
export type CardColor = 'red' | 'yellow' | 'green' | 'blue'
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q'

export const coreCardKinds = ['action-2', 'action-3', 'reinforce', 'seal', 'reverse', 'betray'] as const
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
  | { type: 'start-action'; budget: 2 | 3 }
  | { type: 'set-status'; target: 'opponent'; status: 'sealed'; turns: 1 }
  | { type: 'swap-hands' }
  | { type: 'swap-army-controllers' }
  | { type: 'request-reinforcement' }
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
