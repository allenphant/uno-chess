import type { CardColor, PieceKind, RuleSnapshot } from '@uno-chess/protocol'
import { defaultRules } from './default-preset.js'
import { parseRuleSnapshot } from './schema.js'

export interface RulePreset {
  id: string
  version: number
  snapshot: RuleSnapshot
  friendOverridePaths: readonly string[]
}

export const standardPreset: RulePreset = {
  id: 'standard-v1',
  version: 1,
  snapshot: defaultRules,
  friendOverridePaths: [
    'hand.startingSize',
    'hand.maximumSize',
    'hand.drawPerTurn',
    'matching.byColor',
    'matching.byMatchKey',
    'cards.*.enabled',
    'cards.*.colors',
    'cards.*.copies',
    'reinforce.maximumPieces',
    'reinforce.allowedPieceKinds',
    'reinforce.mode',
    'chess.checkInterruptsAction',
    'chess.repetition',
    'chess.halfmoveLimit',
    'timing.turnSeconds',
    'timing.disconnectGraceSeconds',
  ],
}

const presets: Record<string, RulePreset> = { [standardPreset.id]: standardPreset }

export function resolveRuleSnapshot(presetId: string, overrides: Record<string, unknown> = {}): RuleSnapshot {
  const preset = presets[presetId]
  if (!preset) throw new Error('UNKNOWN_PRESET')

  const snapshot = structuredClone(preset.snapshot)
  for (const [path, value] of Object.entries(overrides)) applyOverride(snapshot, path, value)
  return deepFreeze(parseRuleSnapshot(snapshot))
}

function applyOverride(snapshot: RuleSnapshot, path: string, value: unknown): void {
  switch (path) {
    case 'hand.startingSize': snapshot.hand.startingSize = value as number; return
    case 'hand.maximumSize': snapshot.hand.maximumSize = value as number; return
    case 'hand.drawPerTurn': snapshot.hand.drawPerTurn = value as number; return
    case 'matching.byColor': snapshot.matching.byColor = value as boolean; return
    case 'matching.byMatchKey': snapshot.matching.byMatchKey = value as boolean; return
    case 'reinforce.maximumPieces': snapshot.reinforce.maximumPieces = value as number; return
    case 'reinforce.allowedPieceKinds': snapshot.reinforce.allowedPieceKinds = value as PieceKind[]; return
    case 'reinforce.mode': snapshot.reinforce.mode = value as RuleSnapshot['reinforce']['mode']; return
    case 'chess.checkInterruptsAction': snapshot.chess.checkInterruptsAction = value as boolean; return
    case 'chess.repetition': snapshot.chess.repetition = value as boolean; return
    case 'chess.halfmoveLimit': snapshot.chess.halfmoveLimit = value as number; return
    case 'timing.turnSeconds': snapshot.timing.turnSeconds = value as number | null; return
    case 'timing.disconnectGraceSeconds': snapshot.timing.disconnectGraceSeconds = value as number; return
    default: {
      const match = /^cards\.([^.]*)\.(enabled|colors|copies)$/.exec(path)
      if (!match) throw new Error('OVERRIDE_NOT_ALLOWED')
      const [, kind, property] = match
      const card = snapshot.cards.find((candidate) => candidate.kind === kind)
      if (!card) throw new Error('OVERRIDE_NOT_ALLOWED')
      if (property === 'enabled') card.enabled = value as boolean
      if (property === 'colors') card.colors = value as CardColor[]
      if (property === 'copies') card.copies = value as number
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item)
  }
  return value
}
