import type { CardInstance, PieceRecord } from '@uno-chess/protocol'
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

function matchingFunctionCard(kind: 'reinforce' | 'seal'): CardInstance {
  return { id: `${kind}:red:test`, kind, color: 'red' }
}

function checkedState() {
  const state = buildTestState({ phase: 'await-action' })
  state.board.fen = '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1'
  state.discardFace = { kind: 'action-2', color: 'red' }
  return state
}

describe('check response', () => {
  it('rejects Seal while the current controlled army is in check', () => {
    const state = checkedState()
    const seal = matchingFunctionCard('seal')
    state.players.p1!.hand = [seal]

    expect(() => applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'checked-seal', cardId: seal.id,
    })).toThrow('FUNCTION_CARD_DOES_NOT_RESOLVE_CHECK')
  })

  it('does not open Reinforce when none of its legal-looking placements resolve a knight check', () => {
    const state = checkedState()
    state.board.fen = '4k3/8/8/8/8/5n2/8/4K3 w - - 0 1'
    const reinforce = matchingFunctionCard('reinforce')
    const knight: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    state.board.capturedByArmy.white = [knight]
    state.players.p1!.hand = [reinforce]

    expect(() => applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'checked-reinforce', cardId: reinforce.id,
    })).toThrow('REINFORCEMENT_HAS_NO_LEGAL_TARGET')
  })

  it('allows Betray when swapping army control leaves the player with an unchecked king', () => {
    const state = checkedState()
    const betray: CardInstance = { id: 'betray:wild:test', kind: 'betray', color: null }
    state.players.p1!.hand = [betray]

    const result = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'checked-betray', cardId: betray.id,
    })

    expect(result.state.controllerByArmy).toEqual({ white: 'p2', black: 'p1' })
    expect(result.state.turn.pendingEffect?.kind).toBe('wild-color')
  })
})
