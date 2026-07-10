import type { CardInstance, PieceRecord, RuleSnapshot, Square } from '@uno-chess/protocol'
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

function beginReinforcement(input: {
  mode: RuleSnapshot['reinforce']['mode']
  piece: PieceRecord
  fen?: string
}) {
  const state = buildTestState({ phase: 'await-action' })
  const card: CardInstance = { id: 'reinforce:red:test', kind: 'reinforce', color: 'red' }
  state.rules.reinforce.mode = input.mode
  state.board.fen = input.fen ?? '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
  state.board.capturedByArmy.white = [input.piece]
  state.discardFace = { kind: 'action-2', color: 'red' }
  state.players.p1!.hand = [card]
  return applyIntent(state, {
    type: 'play-function-card', playerId: 'p1', intentId: `open:${input.mode}`, cardId: card.id,
  }).state
}

function choose(state: ReturnType<typeof buildTestState>, pieceId: string, square: Square) {
  return applyIntent(state, {
    type: 'choose-reinforcement', playerId: 'p1', intentId: `place:${square}`,
    capturedPieceIds: [pieceId], squares: [square],
  })
}

describe('Reinforce placement rules', () => {
  it('rejects a tactical-mode placement outside the currently controlled army half', () => {
    const piece: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const pending = beginReinforcement({ mode: 'tactical-own-half', piece })

    expect(() => choose(pending, piece.id, 'e5')).toThrow('REINFORCEMENT_SQUARE_NOT_ALLOWED')
  })

  it('requires a classic-mode revival to use the captured piece original square', () => {
    const piece: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const pending = beginReinforcement({ mode: 'classic-start-square', piece })

    expect(() => choose(pending, piece.id, 'c3')).toThrow('REINFORCEMENT_SQUARE_NOT_ALLOWED')
    expect(choose(pending, piece.id, 'b1').state.board.fen.split(' ')[0]).toBe('4k3/8/8/8/8/8/8/1N2K3')
  })

  it('allows a chaos-mode revival on an otherwise legal square anywhere on the board', () => {
    const piece: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const pending = beginReinforcement({ mode: 'chaos-anywhere', piece })

    expect(choose(pending, piece.id, 'e5').state.board.fen.split(' ')[0]).toBe('4k3/8/8/4N3/8/8/8/4K3')
  })

  it('never permits a pawn revival on the first or eighth rank', () => {
    const piece: PieceRecord = { id: 'white-pawn:a2', army: 'white', kind: 'p', originalSquare: 'a2' }
    const pending = beginReinforcement({ mode: 'chaos-anywhere', piece })

    expect(() => choose(pending, piece.id, 'a8')).toThrow('REINFORCEMENT_SQUARE_NOT_ALLOWED')
  })

  it('rejects a revival square occupied by any army', () => {
    const piece: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const pending = beginReinforcement({
      mode: 'chaos-anywhere', piece,
      fen: '4k3/8/8/8/8/2p5/8/4K3 w - - 0 1',
    })

    expect(() => choose(pending, piece.id, 'c3')).toThrow('REINFORCEMENT_SQUARE_NOT_ALLOWED')
  })

  it('rejects a completed placement that leaves the controlled king in check', () => {
    const piece: PieceRecord = { id: 'white-knight:b1', army: 'white', kind: 'n', originalSquare: 'b1' }
    const pending = beginReinforcement({
      mode: 'tactical-own-half', piece,
      fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1',
    })

    expect(() => choose(pending, piece.id, 'c3')).toThrow('REINFORCEMENT_LEAVES_KING_IN_CHECK')
  })

  it('does not restore castling rights when a classic-mode rook returns to its original square', () => {
    const piece: PieceRecord = { id: 'white-rook:h1', army: 'white', kind: 'r', originalSquare: 'h1' }
    const pending = beginReinforcement({ mode: 'classic-start-square', piece })

    expect(choose(pending, piece.id, 'h1').state.board.fen.split(' ')[2]).toBe('-')
  })
})
