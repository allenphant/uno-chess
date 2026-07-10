import type { CardColor, CardInstance, PieceRecord } from '@uno-chess/protocol'
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

function functionCard(kind: 'reinforce' | 'seal' | 'reverse' | 'betray', color: CardColor | null): CardInstance {
  return { id: `${kind}:${color ?? 'wild'}:test`, kind, color }
}

function actionCard(color: CardColor): CardInstance {
  return { id: `action-2:${color}:test`, kind: 'action-2', color }
}

describe('function cards', () => {
  it('Seal blocks card use for the opponent turn but still permits draw and a basic move', () => {
    const state = buildTestState({ phase: 'await-action' })
    const color = state.discardFace?.color
    if (!color) throw new Error('TEST_REQUIRES_DISCARD_FACE')
    const seal = functionCard('seal', color)
    state.players.p1!.hand = [seal]
    state.players.p2!.hand = [actionCard(color)]

    const sealed = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'seal-play', cardId: seal.id,
    })

    expect(sealed.state.players.p2?.statuses).toContainEqual({ kind: 'sealed', remainingTurns: 1 })
    expect(sealed.state.activePlayerId).toBe('p2')

    const drawn = applyIntent(sealed.state, { type: 'draw-for-turn', playerId: 'p2', intentId: 'seal-draw' })
    expect(() => applyIntent(drawn.state, {
      type: 'play-action-card', playerId: 'p2', intentId: 'sealed-card', cardId: `action-2:${color}:test`,
    })).toThrow('CARDS_SEALED')

    const moved = applyIntent(drawn.state, {
      type: 'basic-move', playerId: 'p2', intentId: 'sealed-basic-move', from: 'e7', to: 'e5',
    })
    expect(moved.state.players.p2?.statuses).toEqual([])
  })

  it('Reverse swaps the remaining hands and ends the turn', () => {
    const state = buildTestState({ phase: 'await-action' })
    const color = state.discardFace?.color
    if (!color) throw new Error('TEST_REQUIRES_DISCARD_FACE')
    const reverse = functionCard('reverse', color)
    state.players.p1!.hand = [reverse, actionCard(color)]
    state.players.p2!.hand = [functionCard('seal', 'blue')]

    const result = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'reverse-play', cardId: reverse.id,
    })

    expect(result.state.players.p1?.hand.map((card) => card.kind)).toEqual(['seal'])
    expect(result.state.players.p2?.hand.map((card) => card.kind)).toEqual(['action-2'])
    expect(result.state.activePlayerId).toBe('p2')
    expect(result.state.turn.phase).toBe('turn-start')
  })

  it('Betray swaps army controllers, preserves player hands, and needs a wild color before ending', () => {
    const state = buildTestState({ phase: 'await-action' })
    const betray = functionCard('betray', null)
    state.players.p1!.hand = [betray]
    state.players.p2!.hand = [functionCard('seal', 'blue')]

    const played = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'betray-play', cardId: betray.id,
    })

    expect(played.state.controllerByArmy).toEqual({ white: 'p2', black: 'p1' })
    expect(played.state.players.p2?.hand.map((card) => card.id)).toEqual(['seal:blue:test'])
    expect(played.state.turn).toMatchObject({ phase: 'await-effect-choice', pendingEffect: { kind: 'wild-color' } })

    const resolved = applyIntent(played.state, {
      type: 'choose-wild-color', playerId: 'p1', intentId: 'betray-color', color: 'blue',
    })
    expect(resolved.state.discardFace).toEqual({ kind: 'betray', color: 'blue' })
    expect(resolved.state.activePlayerId).toBe('p2')
  })

  it('Reinforce restores one captured piece to a legal tactical square and then ends the turn', () => {
    const state = buildTestState({ phase: 'await-action' })
    const color = state.discardFace?.color
    if (!color) throw new Error('TEST_REQUIRES_DISCARD_FACE')
    const knight: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const reinforce = functionCard('reinforce', color)
    state.board.fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    state.board.capturedByArmy.white = [knight]
    state.players.p1!.hand = [reinforce]

    const played = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'reinforce-play', cardId: reinforce.id,
    })
    expect(played.state.turn).toMatchObject({ phase: 'await-effect-choice', pendingEffect: { kind: 'reinforce' } })

    const resolved = applyIntent(played.state, {
      type: 'choose-reinforcement', playerId: 'p1', intentId: 'reinforce-place',
      capturedPieceIds: [knight.id], squares: ['c3'],
    })
    expect(resolved.state.board.fen.split(' ')[0]).toBe('4k3/8/8/8/8/2N5/8/4K3')
    expect(resolved.state.board.capturedByArmy.white).toEqual([])
    expect(resolved.events.map((event) => event.type)).toContain('piece-reinforced')
    expect(resolved.state.activePlayerId).toBe('p2')
  })

  it('executes a data-defined draw-cards operation without a card-kind reducer branch', () => {
    const state = buildTestState({ phase: 'await-action' })
    const drawOne: CardInstance = { id: 'draw-one:red:test', kind: 'draw-one', color: 'red' }
    const drawn: CardInstance = { id: 'action-2:green:drawn', kind: 'action-2', color: 'green' }
    state.rules.cards.push({
      kind: 'draw-one', displayNameKey: 'card.drawOne', matchKey: 'draw-one', category: 'function', enabled: true,
      colors: ['red'], copies: 1, program: [{ type: 'draw-cards', target: 'self', count: 1 }, { type: 'end-turn' }],
    })
    state.discardFace = { kind: 'action-2', color: 'red' }
    state.players.p1!.hand = [drawOne]
    state.drawPile.push(drawn)

    const result = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'draw-one-play', cardId: drawOne.id,
    })

    expect(result.state.players.p1?.hand).toEqual([drawn])
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'card-drawn', playerId: 'p1', cardId: drawn.id }))
    expect(result.state.activePlayerId).toBe('p2')
  })
})
