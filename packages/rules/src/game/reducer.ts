import type { CardId, GameEvent, GameIntent, GameState, PlayerId, PromotionPiece, Square } from '@uno-chess/protocol'
import { applyChessMove, legalChessMoves, type AppliedChessMove } from '../chess/adapter.js'
import { canPlayCard } from '../cards/matching.js'
import { controlledArmy } from './legal-intents.js'

export type ApplyResult = { state: GameState; events: GameEvent[] }

export function applyIntent(input: GameState, intent: GameIntent): ApplyResult {
  if (input.acceptedIntentIds.includes(intent.intentId)) return { state: input, events: [] }
  if (intent.playerId !== input.activePlayerId) throw new Error('NOT_ACTIVE_PLAYER')

  const state = structuredClone(input)
  const events: GameEvent[] = []
  reduceValidatedIntent(state, intent, events)
  state.acceptedIntentIds = [...state.acceptedIntentIds.slice(-127), intent.intentId]
  return { state, events }
}

function reduceValidatedIntent(state: GameState, intent: GameIntent, events: GameEvent[]): void {
  switch (intent.type) {
    case 'draw-for-turn':
      drawForTurn(state, intent.playerId, events)
      return
    case 'discard-overflow':
      discardOverflow(state, intent.playerId, intent.cardId, events)
      return
    case 'basic-move':
      basicMove(state, intent.playerId, intent.from, intent.to, intent.promotion, events)
      return
    case 'play-action-card':
      playActionCard(state, intent.playerId, intent.cardId, events)
      return
    case 'action-move':
      actionMove(state, intent.playerId, intent.from, intent.to, intent.promotion, events)
      return
    case 'finish-action-card':
      finishActionCard(state, intent.playerId, events)
      return
    default:
      throw new Error('INTENT_NOT_AVAILABLE_IN_CURRENT_PHASE')
  }
}

function drawForTurn(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (state.turn.phase !== 'turn-start' || state.turn.drewCard) throw new Error('TURN_DRAW_NOT_AVAILABLE')
  const player = getPlayer(state, playerId)
  const card = state.drawPile.pop()
  if (!card) throw new Error('DRAW_PILE_EMPTY')

  player.hand.push(card)
  state.turn.drewCard = true
  emit(state, events, 'card-drawn', { playerId, cardId: card.id })
  if (player.hand.length > state.rules.hand.maximumSize) {
    state.turn.phase = 'await-overflow-discard'
    return
  }
  state.turn.phase = 'await-action'
  emit(state, events, 'turn-action-opened', { playerId })
}

function discardOverflow(state: GameState, playerId: PlayerId, cardId: CardId, events: GameEvent[]): void {
  if (state.turn.phase !== 'await-overflow-discard') throw new Error('OVERFLOW_DISCARD_NOT_AVAILABLE')
  const player = getPlayer(state, playerId)
  if (player.hand.length <= state.rules.hand.maximumSize) throw new Error('HAND_NOT_OVERFLOWING')
  const index = player.hand.findIndex((card) => card.id === cardId)
  if (index < 0) throw new Error('CARD_NOT_IN_HAND')
  const [discarded] = player.hand.splice(index, 1)
  if (!discarded) throw new Error('CARD_NOT_IN_HAND')

  state.discardPile.push(discarded)
  state.turn.phase = 'await-action'
  emit(state, events, 'card-overflow-discarded', { playerId, cardId: discarded.id })
  emit(state, events, 'turn-action-opened', { playerId })
}

function basicMove(
  state: GameState,
  playerId: PlayerId,
  from: Square,
  to: Square,
  promotion: PromotionPiece | undefined,
  events: GameEvent[],
): void {
  if (state.turn.phase !== 'await-action') throw new Error('BASIC_MOVE_NOT_AVAILABLE')
  performChessMove(state, playerId, from, to, promotion, events)
  endTurn(state, playerId, events)
}

function playActionCard(state: GameState, playerId: PlayerId, cardId: CardId, events: GameEvent[]): void {
  if (state.turn.phase !== 'await-action') throw new Error('ACTION_CARD_NOT_AVAILABLE')
  const player = getPlayer(state, playerId)
  const cardIndex = player.hand.findIndex((card) => card.id === cardId)
  if (cardIndex < 0) throw new Error('CARD_NOT_IN_HAND')
  const card = player.hand[cardIndex]
  if (!card) throw new Error('CARD_NOT_IN_HAND')
  const definition = state.rules.cards.find((candidate) => candidate.kind === card.kind)
  if (!definition || !definition.enabled || definition.category !== 'action') throw new Error('CARD_IS_NOT_ACTION')
  if (!state.discardFace || !canPlayCard(card, state.discardFace, state.rules)) throw new Error('CARD_DOES_NOT_MATCH')
  if (card.color === null) throw new Error('ACTION_CARD_REQUIRES_COLOR')

  const army = controlledArmy(state, playerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  if (legalChessMoves({ fen: state.board.fen, army, enPassantTarget }).length === 0) {
    throw new Error('ACTION_CARD_HAS_NO_LEGAL_FIRST_MOVE')
  }
  const actionProgram = definition.program[0]
  if (!actionProgram || actionProgram.type !== 'start-action') throw new Error('ACTION_PROGRAM_INVALID')

  player.hand.splice(cardIndex, 1)
  state.discardPile.push(card)
  state.discardFace = { kind: card.kind, color: card.color }
  state.turn.playedCardId = card.id
  state.turn.actionBudget = actionProgram.budget
  state.turn.actionsUsed = 0
  state.turn.phase = 'await-action-move'
  emit(state, events, 'card-played', { playerId, cardId: card.id })
}

function actionMove(
  state: GameState,
  playerId: PlayerId,
  from: Square,
  to: Square,
  promotion: PromotionPiece | undefined,
  events: GameEvent[],
): void {
  if (state.turn.phase !== 'await-action-move' || state.turn.actionBudget === 0) {
    throw new Error('ACTION_MOVE_NOT_AVAILABLE')
  }
  const applied = performChessMove(state, playerId, from, to, promotion, events)
  state.turn.actionsUsed += 1
  if (applied.givesCheck && state.rules.chess.checkInterruptsAction) {
    emit(state, events, 'check-given', { playerId })
    endTurn(state, playerId, events)
    return
  }
  if (state.turn.actionsUsed >= state.turn.actionBudget) endTurn(state, playerId, events)
}

function finishActionCard(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (state.turn.phase !== 'await-action-move' || state.turn.actionsUsed < 1) {
    throw new Error('ACTION_CARD_CANNOT_FINISH_YET')
  }
  endTurn(state, playerId, events)
}

function performChessMove(
  state: GameState,
  playerId: PlayerId,
  from: Square,
  to: Square,
  promotion: PromotionPiece | undefined,
  events: GameEvent[],
): AppliedChessMove {
  const army = controlledArmy(state, playerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  const applied = applyChessMove({ fen: state.board.fen, army, enPassantTarget, from, to, ...(promotion ? { promotion } : {}) })

  state.board.fen = applied.fen
  state.board.halfmoveClock = Number(applied.fen.split(' ')[4] ?? 0)
  updateEnPassantWindow(state, army, from, to, applied)
  emit(state, events, 'piece-moved', { playerId, from, to, san: applied.move.san })
  if (applied.move.captured) emit(state, events, 'piece-captured', { playerId, at: to, piece: applied.move.captured })
  if (applied.move.promotion) emit(state, events, 'piece-promoted', { playerId, at: to, piece: applied.move.promotion })
  return applied
}

function updateEnPassantWindow(
  state: GameState,
  army: ReturnType<typeof controlledArmy>,
  from: Square,
  to: Square,
  applied: AppliedChessMove,
): void {
  if (applied.move.flags.includes('e')) {
    state.board.enPassantWindow = null
    return
  }
  if (applied.move.piece !== 'p' || !applied.move.flags.includes('b')) return

  const fromRank = Number(from[1])
  const toRank = Number(to[1])
  const target = `${from[0]}${(fromRank + toRank) / 2}` as Square
  state.board.enPassantWindow = {
    target,
    captureByArmy: army === 'white' ? 'black' : 'white',
    expiresAfterTurnNumber: state.turn.number + 1,
  }
}

function endTurn(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const playerArmy = controlledArmy(state, playerId)
  if (
    state.board.enPassantWindow
    && state.board.enPassantWindow.captureByArmy === playerArmy
    && state.turn.number >= state.board.enPassantWindow.expiresAfterTurnNumber
  ) {
    state.board.enPassantWindow = null
  }
  const [firstPlayerId, secondPlayerId] = state.playerOrder
  const nextPlayerId = playerId === firstPlayerId ? secondPlayerId : firstPlayerId
  state.activePlayerId = nextPlayerId
  state.turn = {
    number: state.turn.number + 1,
    phase: 'turn-start',
    drewCard: false,
    playedCardId: null,
    actionBudget: 0,
    actionsUsed: 0,
    pendingEffect: null,
  }
  emit(state, events, 'turn-ended', { playerId, nextPlayerId })
}

function getPlayer(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId]
  if (!player) throw new Error('PLAYER_NOT_FOUND')
  return player
}

function emit(
  state: GameState,
  events: GameEvent[],
  type: GameEvent['type'],
  details: Record<string, unknown>,
): void {
  state.eventSequence += 1
  events.push({ gameId: state.gameId, sequence: state.eventSequence, type, ...details } as GameEvent)
}
