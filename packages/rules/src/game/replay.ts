import type { GameEvent, GameIntent, GameState } from '@uno-chess/protocol'
import { applyIntent } from './reducer.js'

export interface ReplayResult {
  state: GameState
  events: GameEvent[]
}

export function hashGameState(state: GameState): string {
  let hash = 2166136261
  for (const character of stableSerialize(state)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function replayGame(initial: GameState, intents: GameIntent[]): ReplayResult {
  let state = structuredClone(initial)
  const events: GameEvent[] = []
  for (const intent of intents) {
    const result = applyIntent(state, intent)
    state = result.state
    events.push(...result.events)
  }
  return { state, events }
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
  }
  throw new Error('STATE_HASH_UNSUPPORTED_VALUE')
}
