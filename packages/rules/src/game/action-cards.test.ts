import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

type Card = { id: string; kind: string; color: 'red' | 'yellow' | 'green' | 'blue' }
type State = {
  activePlayerId: string
  players: Record<string, { hand: Card[] }>
  discardFace: { color: Card['color'] }
  board: { fen: string }
  turn: { phase: string; actionBudget: number; actionsUsed: number }
}
type ApplyResult = { state: State; events: Array<{ type: string }> }

function actionCard(kind: 'action-2' | 'action-3', color: Card['color']): Card {
  return { id: `${kind}:${color}:test`, kind, color }
}

describe('action cards', () => {
  it('permits one to N moves and lets the player stop early', () => {
    const api = rules as Record<string, unknown>
    expect(api.applyIntent).toBeTypeOf('function')
    if (typeof api.applyIntent !== 'function' || typeof api.buildTestState !== 'function') return
    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ phase: 'await-action' })
    const card = actionCard('action-3', state.discardFace.color)
    state.players.p1!.hand = [card]

    const opened = applyIntent(state, { type: 'play-action-card', playerId: 'p1', intentId: 'action-open', cardId: card.id })
    expect(opened.state.turn).toMatchObject({ phase: 'await-action-move', actionBudget: 3, actionsUsed: 0 })
    const moved = applyIntent(opened.state, { type: 'action-move', playerId: 'p1', intentId: 'action-move', from: 'e2', to: 'e4' })
    const stopped = applyIntent(moved.state, { type: 'finish-action-card', playerId: 'p1', intentId: 'action-stop' })

    expect(stopped.state.activePlayerId).toBe('p2')
    expect(stopped.state.turn.phase).toBe('turn-start')
  })

  it('ends remaining moves immediately when an action move gives check', () => {
    const api = rules as Record<string, unknown>
    if (typeof api.applyIntent !== 'function' || typeof api.buildTestState !== 'function') return
    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ phase: 'await-action' })
    state.board.fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
    const card = actionCard('action-2', state.discardFace.color)
    state.players.p1!.hand = [card]

    const opened = applyIntent(state, { type: 'play-action-card', playerId: 'p1', intentId: 'check-open', cardId: card.id })
    const result = applyIntent(opened.state, { type: 'action-move', playerId: 'p1', intentId: 'check-move', from: 'd1', to: 'h5' })

    expect(result.state.activePlayerId).toBe('p2')
    expect(result.events.some((event) => event.type === 'check-given')).toBe(true)
  })
})
