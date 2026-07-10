import type { GameEvent, GameIntent, GameState } from '@uno-chess/protocol'
import { applyIntent } from './reducer.js'

export interface ReplayResult {
  state: GameState
  events: GameEvent[]
}

export interface ReplayCheckpoint {
  stateHash: string
  events: GameEvent[]
}

export function hashGameState(state: GameState): string {
  let hash = 2166136261
  for (const character of stableSerialize(state)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function replayGame(
  initial: GameState,
  intents: readonly GameIntent[],
  checkpoints: readonly ReplayCheckpoint[] = [],
): ReplayResult {
  let state = structuredClone(initial)
  const events: GameEvent[] = []
  for (const [index, intent] of intents.entries()) {
    const result = applyIntent(state, intent)
    state = result.state
    events.push(...result.events)
    const checkpoint = checkpoints[index]
    if (checkpoint) verifyCheckpoint(index, state, result.events, checkpoint)
  }
  return { state, events }
}

function verifyCheckpoint(index: number, state: GameState, events: GameEvent[], checkpoint: ReplayCheckpoint): void {
  if (hashGameState(state) !== checkpoint.stateHash) throw new Error(`REPLAY_STATE_HASH_MISMATCH:${index}`)
  if (stableSerialize(events) !== stableSerialize(checkpoint.events)) throw new Error(`REPLAY_EVENT_MISMATCH:${index}`)
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
