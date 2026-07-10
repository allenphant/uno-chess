import { DEFAULT_POSITION } from 'chess.js'
import type { CardInstance, GameState, PlayerId, PlayerState, RuleSnapshot } from '@uno-chess/protocol'
import { buildDeck } from '../cards/deck.js'
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

  return {
    gameId: input.gameId,
    rules,
    seed: input.seed,
    rngCursor: cursor,
    board: {
      fen: DEFAULT_POSITION,
      enPassantWindow: null,
      capturedByArmy: { white: [], black: [] },
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
      actionsUsed: 0,
      pendingEffect: null,
    },
    status: { kind: 'active' },
    eventSequence: 0,
    positionOccurrences: {},
    acceptedIntentIds: [],
  }
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
