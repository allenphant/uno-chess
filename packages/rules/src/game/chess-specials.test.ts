import { describe, expect, it } from 'vitest'
import * as rules from '../index.js'

type Card = { id: string; kind: string; color: 'red' | 'yellow' | 'green' | 'blue' }
type State = {
  activePlayerId: string
  players: Record<string, { hand: Card[] }>
  discardFace: { color: Card['color'] }
  board: { fen: string; enPassantWindow: null | { target: string; captureByArmy: string } }
  turn: { phase: string }
}
type ApplyResult = { state: State; events: Array<{ type: string }> }

function actionTwo(color: Card['color']): Card {
  return { id: `action-2:${color}:test`, kind: 'action-2', color }
}

describe('special chess rules', () => {
  it('keeps a double-pawn en-passant window through the remaining action moves', () => {
    const api = rules as Record<string, unknown>
    if (typeof api.applyIntent !== 'function' || typeof api.buildTestState !== 'function') return
    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ phase: 'await-action' })
    state.activePlayerId = 'p2'
    state.board.fen = '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'
    const card = actionTwo(state.discardFace.color)
    state.players.p2!.hand = [card]

    const opened = applyIntent(state, { type: 'play-action-card', playerId: 'p2', intentId: 'ep-open', cardId: card.id })
    const moved = applyIntent(opened.state, { type: 'action-move', playerId: 'p2', intentId: 'ep-double', from: 'd7', to: 'd5' })

    expect(moved.state.turn.phase).toBe('await-action-move')
    expect(moved.state.board.enPassantWindow).toMatchObject({ target: 'd6', captureByArmy: 'white' })
  })

  it('applies promotion immediately and lets a non-checking promotion use remaining action budget', () => {
    const api = rules as Record<string, unknown>
    if (typeof api.applyIntent !== 'function' || typeof api.buildTestState !== 'function') return
    const buildTestState = api.buildTestState as (options: unknown) => State
    const applyIntent = api.applyIntent as (state: State, intent: unknown) => ApplyResult
    const state = buildTestState({ phase: 'await-action' })
    state.board.fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'
    const card = actionTwo(state.discardFace.color)
    state.players.p1!.hand = [card]

    const opened = applyIntent(state, { type: 'play-action-card', playerId: 'p1', intentId: 'promotion-open', cardId: card.id })
    const promoted = applyIntent(opened.state, { type: 'action-move', playerId: 'p1', intentId: 'promotion-move', from: 'a7', to: 'a8', promotion: 'n' })

    expect(promoted.events.some((event) => event.type === 'piece-promoted')).toBe(true)
    expect(promoted.state.turn.phase).toBe('await-action-move')
  })
})
