import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

type Card = { id: string; kind: string; color: 'red' | 'yellow' | 'green' | 'blue' | null }
type State = {
  players: Record<string, { hand: Card[] }>
  activePlayerId: string
  turn: { phase: string }
}
type ApplyResult = { state: State; events: Array<{ type: string }> }

describe('turn flow', () => {
  it('draws once then requires the player to choose an overflow discard above five cards', () => {
    const api = rules as Record<string, unknown>
    expect(api.buildTestState).toBeTypeOf('function')
    expect(api.applyIntent).toBeTypeOf('function')
    if (typeof api.buildTestState !== 'function' || typeof api.applyIntent !== 'function') return

    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ activeHandSize: 5, phase: 'turn-start' })
    const drawn = applyIntent(state, { type: 'draw-for-turn', playerId: 'p1', intentId: 'draw-1' })

    expect(drawn.state.players.p1?.hand).toHaveLength(6)
    expect(drawn.state.turn.phase).toBe('await-overflow-discard')
    expect(drawn.events.map((event) => event.type)).toEqual(['card-drawn'])

    const result = applyIntent(drawn.state, {
      type: 'discard-overflow', playerId: 'p1', intentId: 'overflow-1', cardId: drawn.state.players.p1?.hand[0]?.id,
    })
    expect(result.state.players.p1?.hand).toHaveLength(5)
    expect(result.state.turn.phase).toBe('await-action')
    expect(result.events.map((event) => event.type)).toEqual(['card-overflow-discarded', 'turn-action-opened'])
  })

  it('matches colored cards by color or face and treats Betray as wild', () => {
    const api = rules as Record<string, unknown>
    expect(api.canPlayCard).toBeTypeOf('function')
    if (typeof api.canPlayCard !== 'function') return

    const canPlayCard = api.canPlayCard as (card: Card, top: Pick<Card, 'kind' | 'color'>, snapshot: unknown) => boolean
    const snapshot = api.defaultRules
    expect(canPlayCard({ id: 'a', kind: 'action-2', color: 'red' }, { kind: 'action-3', color: 'red' }, snapshot)).toBe(true)
    expect(canPlayCard({ id: 'b', kind: 'action-2', color: 'blue' }, { kind: 'action-2', color: 'red' }, snapshot)).toBe(true)
    expect(canPlayCard({ id: 'c', kind: 'seal', color: 'blue' }, { kind: 'reverse', color: 'red' }, snapshot)).toBe(false)
    expect(canPlayCard({ id: 'd', kind: 'betray', color: null }, { kind: 'reverse', color: 'red' }, snapshot)).toBe(true)
  })

  it('allows one legal chess move without playing a card and then hands over the turn', () => {
    const api = rules as Record<string, unknown>
    expect(api.buildTestState).toBeTypeOf('function')
    expect(api.applyIntent).toBeTypeOf('function')
    if (typeof api.buildTestState !== 'function' || typeof api.applyIntent !== 'function') return

    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ phase: 'await-action' })
    const result = applyIntent(state, {
      type: 'basic-move', playerId: 'p1', intentId: 'move-1', from: 'e2', to: 'e4',
    })

    expect(result.state.activePlayerId).toBe('p2')
    expect(result.state.turn.phase).toBe('turn-start')
    expect(result.events.at(-1)?.type).toBe('turn-ended')
  })

  it('records renderable card metadata when a card is played', () => {
    const state = rules.buildTestState({ phase: 'await-action' })
    const card = { id: 'action-red', kind: 'action-2', color: 'red' as const }
    state.players.p1!.hand = [card]
    state.discardFace = { kind: 'seal', color: 'red' }

    const result = rules.applyIntent(state, {
      type: 'play-action-card', playerId: 'p1', intentId: 'play-renderable-card', cardId: card.id,
    })

    expect(result.events.find((event) => event.type === 'card-played')).toMatchObject({
      type: 'card-played', playerId: 'p1', cardId: card.id, kind: 'action-2', color: 'red',
    })
  })
})
