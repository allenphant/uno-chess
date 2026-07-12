import { DEFAULT_POSITION } from 'chess.js'
import type { ArmyColor, CardInstance, ChessPieceKind, GameState, PieceRecord, PlayerId, PlayerState, RuleSnapshot, Square } from '@uno-chess/protocol'
import { buildDeck } from '../cards/deck.js'
import { positionKey } from './position-key.js'
import { shuffleWithSeed } from '../random/seeded.js'
import { parseRuleSnapshot } from '../ruleset/schema.js'

export interface CreateGameInput {
  gameId: string
  playerIds: [PlayerId, PlayerId]
  rules: RuleSnapshot
  seed: string
}

export function createGame(input: CreateGameInput): GameState {
  const rules = parseRuleSnapshot(structuredClone(input.rules))
  const { items: drawPile, cursor } = shuffleWithSeed(buildDeck(rules), input.seed)
  const [firstPlayerId, secondPlayerId] = input.playerIds
  const players: Record<PlayerId, PlayerState> = {
    [firstPlayerId]: { id: firstPlayerId, hand: [], statuses: [] },
    [secondPlayerId]: { id: secondPlayerId, hand: [], statuses: [] },
  }

  for (let round = 0; round < rules.hand.startingSize; round += 1) {
    for (const playerId of input.playerIds) {
      const player = players[playerId]
      if (!player) throw new Error('PLAYER_NOT_FOUND')
      player.hand.push(drawCard(drawPile))
    }
  }

  const initialDiscardIndex = findInitialDiscardIndex(drawPile)
  const initialDiscard = drawPile.splice(initialDiscardIndex, 1)[0]
  if (!initialDiscard || initialDiscard.color === null) throw new Error('INITIAL_DISCARD_UNAVAILABLE')

  const state: GameState = {
    gameId: input.gameId,
    rules,
    seed: input.seed,
    rngCursor: cursor,
    board: {
      fen: DEFAULT_POSITION,
      enPassantWindow: null,
      capturedByArmy: { white: [], black: [] },
      activePieces: initialActivePieces(),
      halfmoveClock: 0,
    },
    playerOrder: input.playerIds,
    players,
    controllerByArmy: { white: firstPlayerId, black: secondPlayerId },
    activePlayerId: firstPlayerId,
    drawPile,
    discardPile: [initialDiscard],
    discardFace: { kind: initialDiscard.kind, color: initialDiscard.color },
    turn: {
      number: 1,
      phase: 'turn-start',
      drewCard: false,
      playedCardId: null,
      actionBudget: 0,
      actionMinimum: 0,
      actionsUsed: 0,
      pendingEffect: null,
    },
    status: { kind: 'active' },
    eventSequence: 0,
    positionOccurrences: {},
    acceptedIntentIds: [],
  }
  state.positionOccurrences[positionKey(state)] = 1
  return state
}

function initialActivePieces(): Partial<Record<Square, PieceRecord>> {
  const pieces: Partial<Record<Square, PieceRecord>> = {}
  const backRank: Array<[Square, ChessPieceKind]> = [
    ['a1', 'r'], ['b1', 'n'], ['c1', 'b'], ['d1', 'q'], ['e1', 'k'], ['f1', 'b'], ['g1', 'n'], ['h1', 'r'],
    ['a8', 'r'], ['b8', 'n'], ['c8', 'b'], ['d8', 'q'], ['e8', 'k'], ['f8', 'b'], ['g8', 'n'], ['h8', 'r'],
  ]
  for (const [square, kind] of backRank) addInitialPiece(pieces, square, kind)
  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) {
    addInitialPiece(pieces, `${file}2`, 'p')
    addInitialPiece(pieces, `${file}7`, 'p')
  }
  return pieces
}

function addInitialPiece(
  pieces: Partial<Record<Square, PieceRecord>>,
  square: Square,
  kind: ChessPieceKind,
): void {
  const army: ArmyColor = square[1] === '1' || square[1] === '2' ? 'white' : 'black'
  const name = ({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } as const)[kind]
  pieces[square] = { id: `${army}-${name}:${square}`, army, kind, originalSquare: square }
}

function drawCard(drawPile: CardInstance[]): CardInstance {
  const card = drawPile.pop()
  if (!card) throw new Error('DRAW_PILE_EMPTY')
  return card
}

function findInitialDiscardIndex(drawPile: CardInstance[]): number {
  for (let index = drawPile.length - 1; index >= 0; index -= 1) {
    if (drawPile[index]?.color !== null) return index
  }
  throw new Error('INITIAL_DISCARD_UNAVAILABLE')
}
