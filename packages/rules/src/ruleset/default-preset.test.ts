import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

type Card = { kind: string }
type RuleSnapshotView = {
  schemaVersion: number
  presetId: string
  reinforce: { mode: string }
}

describe('default rules v1', () => {
  it('contains both reinforcement strengths and no action-1 card', () => {
    const api = rules as Record<string, unknown>
    expect(api.defaultRules).toBeDefined()
    expect(api.buildDeck).toBeTypeOf('function')
    if (!api.defaultRules || typeof api.buildDeck !== 'function') return

    const deck = (api.buildDeck as (snapshot: unknown) => Card[])(api.defaultRules)
    expect(deck).toHaveLength(38)
    expect(deck.filter((card) => card.kind === 'action-2')).toHaveLength(12)
    expect(deck.filter((card) => card.kind === 'action-3')).toHaveLength(8)
    expect(deck.filter((card) => card.kind === 'reinforce')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'reinforce-1')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'seal')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'reverse')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'betray')).toHaveLength(2)
    expect(deck.some((card) => card.kind === 'action-1')).toBe(false)
  })

  it('resolves the standard snapshot and only permits whitelisted friend overrides', () => {
    const api = rules as Record<string, unknown>
    expect(api.resolveRuleSnapshot).toBeTypeOf('function')
    if (typeof api.resolveRuleSnapshot !== 'function') return

    const resolveRuleSnapshot = api.resolveRuleSnapshot as (
      presetId: string,
      overrides: Record<string, unknown>,
    ) => RuleSnapshotView
    const snapshot = resolveRuleSnapshot('standard-v1', { 'reinforce.mode': 'chaos-anywhere' })

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.presetId).toBe('standard-v1')
    expect(snapshot.reinforce.mode).toBe('chaos-anywhere')
    expect(() => resolveRuleSnapshot('standard-v1', { schemaVersion: 99 })).toThrow('OVERRIDE_NOT_ALLOWED')
  })
})
