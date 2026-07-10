import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'
import { applyIntent, buildTestState, hashGameState, replayGame } from '../index.js'

describe('deterministic replay', () => {
  it('exposes replay and canonical state-hash APIs', () => {
    const api = rules as Record<string, unknown>

    expect(api.replayGame).toBeTypeOf('function')
    expect(api.hashGameState).toBeTypeOf('function')
  })

  it('reapplies accepted intents to the same state, events, and canonical hash', () => {
    const initial = buildTestState({ phase: 'await-action' })
    const intent = { type: 'basic-move', playerId: 'p1', intentId: 'replay-opening', from: 'e2', to: 'e4' } as const
    const recorded = applyIntent(initial, intent)

    const replayed = replayGame(initial, [intent])

    expect(replayed.state).toEqual(recorded.state)
    expect(replayed.events).toEqual(recorded.events)
    expect(hashGameState(replayed.state)).toBe(hashGameState(recorded.state))
  })

  it('produces distinct canonical hashes when authoritative state differs', () => {
    const initial = buildTestState({ phase: 'await-action' })
    const moved = applyIntent(initial, {
      type: 'basic-move', playerId: 'p1', intentId: 'hash-opening', from: 'e2', to: 'e4',
    })

    expect(hashGameState(initial)).not.toBe(hashGameState(moved.state))
    expect(hashGameState(structuredClone(moved.state))).toBe(hashGameState(moved.state))
  })
})
