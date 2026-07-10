import type { CardId, GameEvent, GameIntent, GameState, PlayerId, PromotionPiece, Square } from '@uno-chess/protocol'
import { Chess } from 'chess.js'
import { applyChessMove, isArmyInCheck, legalChessMoves, type AppliedChessMove } from '../chess/adapter.js'
import { programFor } from '../cards/effects.js'
import { canPlayCard } from '../cards/matching.js'
import { controlledArmy } from './legal-intents.js'
import { evaluateOutcome } from './outcome.js'
import { positionKey } from './position-key.js'
import { shuffleWithSeed } from '../random/seeded.js'

export type ApplyResult = { state: GameState; events: GameEvent[] }
export type ReinforcementOption = { pieceId: string; kind: string; squares: Square[] }

export function applyIntent(input: GameState, intent: GameIntent): ApplyResult {
  if (input.acceptedIntentIds.includes(intent.intentId)) return { state: input, events: [] }
  if (input.status.kind === 'finished') throw new Error('GAME_FINISHED')
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
    case 'play-function-card':
      playFunctionCard(state, intent.playerId, intent.cardId, events)
      return
    case 'choose-wild-color':
      chooseWildColor(state, intent.playerId, intent.color, events)
      return
    case 'choose-reinforcement':
      chooseReinforcement(state, intent.playerId, intent.capturedPieceIds, intent.squares, events)
      return
    default:
      throw new Error('INTENT_NOT_AVAILABLE_IN_CURRENT_PHASE')
  }
}

function drawForTurn(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (state.turn.phase !== 'turn-start' || state.turn.drewCard) throw new Error('TURN_DRAW_NOT_AVAILABLE')
  const player = getPlayer(state, playerId)
  const card = drawCardFromState(state)

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
  assertCardsAvailable(state, playerId)
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

function playFunctionCard(state: GameState, playerId: PlayerId, cardId: CardId, events: GameEvent[]): void {
  if (state.turn.phase !== 'await-action') throw new Error('FUNCTION_CARD_NOT_AVAILABLE')
  assertCardsAvailable(state, playerId)
  const player = getPlayer(state, playerId)
  const cardIndex = player.hand.findIndex((card) => card.id === cardId)
  if (cardIndex < 0) throw new Error('CARD_NOT_IN_HAND')
  const card = player.hand[cardIndex]
  if (!card) throw new Error('CARD_NOT_IN_HAND')
  const definition = state.rules.cards.find((candidate) => candidate.kind === card.kind)
  if (!definition || !definition.enabled || definition.category !== 'function') throw new Error('CARD_IS_NOT_FUNCTION')
  if (!state.discardFace || !canPlayCard(card, state.discardFace, state.rules)) throw new Error('CARD_DOES_NOT_MATCH')
  const program = programFor(state.rules, card.kind)
  const army = controlledArmy(state, playerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  const requestsReinforcement = program.some((operation) => operation.type === 'request-reinforcement')
  if (
    isArmyInCheck({ fen: state.board.fen, army, enPassantTarget })
    && requestsReinforcement
    && !hasLegalReinforcement(state, playerId)
  ) {
    throw new Error('REINFORCEMENT_HAS_NO_LEGAL_TARGET')
  }
  if (
    isArmyInCheck({ fen: state.board.fen, army, enPassantTarget })
    && !functionProgramCanResolveCheck(state, playerId, program)
  ) {
    throw new Error('FUNCTION_CARD_DOES_NOT_RESOLVE_CHECK')
  }

  player.hand.splice(cardIndex, 1)
  state.discardPile.push(card)
  if (card.color !== null) state.discardFace = { kind: card.kind, color: card.color }
  state.turn.playedCardId = card.id
  emit(state, events, 'card-played', { playerId, cardId: card.id })

  executeFunctionProgram(state, playerId, card.id, program, 0, events)
}

function functionProgramCanResolveCheck(
  state: GameState,
  playerId: PlayerId,
  program: ReturnType<typeof programFor>,
): boolean {
  if (program.some((operation) => operation.type === 'request-reinforcement')) {
    return hasLegalReinforcement(state, playerId)
  }
  let army = controlledArmy(state, playerId)
  for (const operation of program) {
    if (operation.type === 'swap-army-controllers') army = army === 'white' ? 'black' : 'white'
  }
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  return !isArmyInCheck({ fen: state.board.fen, army, enPassantTarget })
}

function executeFunctionProgram(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  program: ReturnType<typeof programFor>,
  startOperationIndex: number,
  events: GameEvent[],
): void {
  for (let operationIndex = startOperationIndex; operationIndex < program.length; operationIndex += 1) {
    const operation = program[operationIndex]
    if (!operation) throw new Error('FUNCTION_PROGRAM_OPERATION_MISSING')
    switch (operation.type) {
      case 'set-status':
        getPlayer(state, opponentId(state, playerId)).statuses.push({ kind: operation.status, remainingTurns: operation.turns })
        break
      case 'swap-hands': {
        const player = getPlayer(state, playerId)
        const opponent = getPlayer(state, opponentId(state, playerId))
        ;[player.hand, opponent.hand] = [opponent.hand, player.hand]
        break
      }
      case 'swap-army-controllers':
        state.controllerByArmy = { white: state.controllerByArmy.black, black: state.controllerByArmy.white }
        break
      case 'request-wild-color':
        state.turn.pendingEffect = { kind: 'wild-color', cardId, nextOperationIndex: operationIndex + 1 }
        state.turn.phase = 'await-effect-choice'
        return
      case 'request-reinforcement':
        if (!hasLegalReinforcement(state, playerId)) throw new Error('REINFORCEMENT_HAS_NO_LEGAL_TARGET')
        state.turn.pendingEffect = { kind: 'reinforce', cardId, nextOperationIndex: operationIndex + 1 }
        state.turn.phase = 'await-effect-choice'
        return
      case 'draw-cards':
        drawEffectCards(state, playerId, operation.target, operation.count, events)
        break
      case 'end-turn':
        endTurn(state, playerId, events)
        return
      default:
        throw new Error('FUNCTION_PROGRAM_OPERATION_UNSUPPORTED')
    }
  }
  throw new Error('FUNCTION_PROGRAM_MISSING_END_TURN')
}

function chooseWildColor(
  state: GameState,
  playerId: PlayerId,
  color: 'red' | 'yellow' | 'green' | 'blue',
  events: GameEvent[],
): void {
  if (state.turn.phase !== 'await-effect-choice' || state.turn.pendingEffect?.kind !== 'wild-color') {
    throw new Error('WILD_COLOR_NOT_AVAILABLE')
  }
  const card = state.discardPile.at(-1)
  if (!card || card.id !== state.turn.pendingEffect.cardId) throw new Error('WILD_CARD_NOT_ON_DISCARD')
  state.discardFace = { kind: card.kind, color }
  const nextOperationIndex = state.turn.pendingEffect.nextOperationIndex
  state.turn.pendingEffect = null
  executeFunctionProgram(state, playerId, card.id, programFor(state.rules, card.kind), nextOperationIndex, events)
}

function chooseReinforcement(
  state: GameState,
  playerId: PlayerId,
  capturedPieceIds: string[],
  squares: Square[],
  events: GameEvent[],
): void {
  if (state.turn.phase !== 'await-effect-choice' || state.turn.pendingEffect?.kind !== 'reinforce') {
    throw new Error('REINFORCEMENT_NOT_AVAILABLE')
  }
  if (capturedPieceIds.length === 0) throw new Error('REINFORCEMENT_REQUIRES_PIECE')
  if (capturedPieceIds.length !== squares.length) throw new Error('REINFORCEMENT_SELECTION_MISMATCH')
  if (capturedPieceIds.length > state.rules.reinforce.maximumPieces) throw new Error('REINFORCEMENT_LIMIT_EXCEEDED')
  if (new Set(capturedPieceIds).size !== capturedPieceIds.length) throw new Error('REINFORCEMENT_DUPLICATE_PIECE')
  if (new Set(squares).size !== squares.length) throw new Error('REINFORCEMENT_DUPLICATE_SQUARE')

  const army = controlledArmy(state, playerId)
  const available = state.board.capturedByArmy[army]
  const selected = capturedPieceIds.map((pieceId) => {
    const piece = available.find((candidate) => candidate.id === pieceId)
    if (!piece) throw new Error('REINFORCEMENT_PIECE_NOT_AVAILABLE')
    if (!state.rules.reinforce.allowedPieceKinds.includes(piece.kind as 'p' | 'n' | 'b' | 'r' | 'q')) {
      throw new Error('REINFORCEMENT_PIECE_KIND_NOT_ALLOWED')
    }
    return piece
  })

  let fen = state.board.fen
  for (let index = 0; index < selected.length; index += 1) {
    const piece = selected[index]
    const square = squares[index]
    if (!piece || !square) throw new Error('REINFORCEMENT_SELECTION_MISMATCH')
    assertReinforcementSquare(fen, state.rules.reinforce.mode, piece, square)
    fen = putPiece(fen, piece, square)
  }
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  if (isArmyInCheck({ fen, army, enPassantTarget })) throw new Error('REINFORCEMENT_LEAVES_KING_IN_CHECK')

  state.board.fen = fen
  state.board.halfmoveClock = 0
  for (let index = 0; index < selected.length; index += 1) {
    const piece = selected[index]
    const square = squares[index]
    if (!piece || !square) throw new Error('REINFORCEMENT_SELECTION_MISMATCH')
    state.board.activePieces[square] = piece
    emit(state, events, 'piece-reinforced', { playerId, pieceId: piece.id, piece: piece.kind, at: square })
  }
  state.board.capturedByArmy[army] = available.filter((piece) => !capturedPieceIds.includes(piece.id))
  const pending = state.turn.pendingEffect
  const card = state.discardPile.at(-1)
  if (!card || card.id !== pending.cardId) throw new Error('REINFORCEMENT_CARD_NOT_ON_DISCARD')
  state.turn.pendingEffect = null
  executeFunctionProgram(state, playerId, card.id, programFor(state.rules, card.kind), pending.nextOperationIndex, events)
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
  trackPieceMove(state, army, from, to, applied)
  updateEnPassantWindow(state, army, from, to, applied)
  emit(state, events, 'piece-moved', { playerId, from, to, san: applied.move.san })
  if (applied.move.captured) emit(state, events, 'piece-captured', { playerId, at: to, piece: applied.move.captured })
  if (applied.move.promotion) emit(state, events, 'piece-promoted', { playerId, at: to, piece: applied.move.promotion })
  return applied
}

function trackPieceMove(
  state: GameState,
  army: ReturnType<typeof controlledArmy>,
  from: Square,
  to: Square,
  applied: AppliedChessMove,
): void {
  const moved = state.board.activePieces[from] ?? observedPiece(army, applied.move.piece, from)
  if (applied.move.captured) {
    const capturedSquare = applied.move.flags.includes('e') ? `${to[0]}${from[1]}` as Square : to
    const captured = state.board.activePieces[capturedSquare]
      ?? observedPiece(army === 'white' ? 'black' : 'white', applied.move.captured, capturedSquare)
    state.board.capturedByArmy[captured.army].push(captured)
    delete state.board.activePieces[capturedSquare]
  }
  delete state.board.activePieces[from]
  state.board.activePieces[to] = applied.move.promotion ? { ...moved, kind: applied.move.promotion } : moved
  if (applied.move.flags.includes('k') || applied.move.flags.includes('q')) {
    moveCastledRook(state, army, from, to)
  }
}

function moveCastledRook(state: GameState, army: ReturnType<typeof controlledArmy>, from: Square, to: Square): void {
  const rank = army === 'white' ? '1' : '8'
  const isKingSide = from === `e${rank}` && to === `g${rank}`
  const rookFrom = `${isKingSide ? 'h' : 'a'}${rank}` as Square
  const rookTo = `${isKingSide ? 'f' : 'd'}${rank}` as Square
  const rook = state.board.activePieces[rookFrom] ?? observedPiece(army, 'r', rookFrom)
  delete state.board.activePieces[rookFrom]
  state.board.activePieces[rookTo] = rook
}

function observedPiece(
  army: ReturnType<typeof controlledArmy>,
  kind: string,
  square: Square,
) {
  return { id: `observed-${army}-${kind}:${square}`, army, kind: kind as 'p' | 'n' | 'b' | 'r' | 'q' | 'k', originalSquare: square }
}

function hasLegalReinforcement(state: GameState, playerId: PlayerId): boolean {
  return getLegalReinforcementOptions(state, playerId).length > 0
}

export function getLegalReinforcementOptions(state: GameState, playerId = state.activePlayerId): ReinforcementOption[] {
  const army = controlledArmy(state, playerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  return state.board.capturedByArmy[army].flatMap((piece) => {
    if (!state.rules.reinforce.allowedPieceKinds.includes(piece.kind as 'p' | 'n' | 'b' | 'r' | 'q')) return []
    const squares = legalReinforcementSquares(state.board.fen, state.rules.reinforce.mode, piece, army).filter((square) => (
      !isArmyInCheck({ fen: putPiece(state.board.fen, piece, square), army, enPassantTarget })
    ))
    return squares.length > 0 ? [{ pieceId: piece.id, kind: piece.kind, squares }] : []
  })
}

function legalReinforcementSquares(
  fen: string,
  mode: GameState['rules']['reinforce']['mode'],
  piece: GameState['board']['capturedByArmy']['white'][number],
  army: ReturnType<typeof controlledArmy>,
): Square[] {
  const candidates = mode === 'classic-start-square' ? [piece.originalSquare] : allSquares()
  return candidates.filter((square) => canReinforceOnSquare(fen, mode, piece, square, army))
}

function assertReinforcementSquare(
  fen: string,
  mode: GameState['rules']['reinforce']['mode'],
  piece: GameState['board']['capturedByArmy']['white'][number],
  square: Square,
): void {
  if (!canReinforceOnSquare(fen, mode, piece, square, piece.army)) throw new Error('REINFORCEMENT_SQUARE_NOT_ALLOWED')
}

function canReinforceOnSquare(
  fen: string,
  mode: GameState['rules']['reinforce']['mode'],
  piece: GameState['board']['capturedByArmy']['white'][number],
  square: Square,
  army: ReturnType<typeof controlledArmy>,
): boolean {
  if (piece.kind === 'p' && (square[1] === '1' || square[1] === '8')) return false
  if (mode === 'classic-start-square' && square !== piece.originalSquare) return false
  if (mode === 'tactical-own-half') {
    const rank = Number(square[1])
    if (army === 'white' ? rank > 4 : rank < 5) return false
  }
  return new Chess(fen).get(square) === undefined
}

function putPiece(
  fen: string,
  piece: GameState['board']['capturedByArmy']['white'][number],
  square: Square,
): string {
  const chess = new Chess(fen)
  chess.put({ type: piece.kind, color: piece.army === 'white' ? 'w' : 'b' }, square)
  return chess.fen()
}

function allSquares(): Square[] {
  const squares: Square[] = []
  for (const rank of ['1', '2', '3', '4', '5', '6', '7', '8'] as const) {
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) squares.push(`${file}${rank}`)
  }
  return squares
}

function drawEffectCards(
  state: GameState,
  playerId: PlayerId,
  target: 'self' | 'opponent',
  count: number,
  events: GameEvent[],
): void {
  const targetPlayerId = target === 'self' ? playerId : opponentId(state, playerId)
  const player = getPlayer(state, targetPlayerId)
  for (let index = 0; index < count; index += 1) {
    const card = drawCardFromState(state)
    player.hand.push(card)
    emit(state, events, 'card-drawn', { playerId: targetPlayerId, cardId: card.id })
  }
}

function drawCardFromState(state: GameState) {
  if (state.drawPile.length === 0) recycleDiscardPile(state)
  const card = state.drawPile.pop()
  if (!card) throw new Error('DRAW_PILE_EMPTY')
  return card
}

function recycleDiscardPile(state: GameState): void {
  const retainedTop = state.discardPile.pop()
  if (!retainedTop || state.discardPile.length === 0) {
    if (retainedTop) state.discardPile.push(retainedTop)
    throw new Error('DRAW_PILE_EMPTY')
  }
  const shuffled = shuffleWithSeed(state.discardPile, state.seed, state.rngCursor)
  state.drawPile = shuffled.items
  state.rngCursor = shuffled.cursor
  state.discardPile = [retainedTop]
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
  const finishingPlayer = getPlayer(state, playerId)
  finishingPlayer.statuses = finishingPlayer.statuses.flatMap((status) => (
    status.remainingTurns > 1 ? [{ ...status, remainingTurns: status.remainingTurns - 1 }] : []
  ))
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
  const key = positionKey(state)
  state.positionOccurrences[key] = (state.positionOccurrences[key] ?? 0) + 1
  emit(state, events, 'turn-ended', { playerId, nextPlayerId })
  const outcome = evaluateOutcome(state)
  if (outcome.kind === 'ongoing') return
  state.status = outcome.kind === 'win'
    ? { kind: 'finished', winnerId: outcome.winnerId, reason: outcome.reason }
    : { kind: 'finished', winnerId: null, reason: outcome.reason }
  emit(state, events, 'game-ended', {
    winnerId: outcome.kind === 'win' ? outcome.winnerId : null,
    reason: outcome.reason,
  })
}

function getPlayer(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId]
  if (!player) throw new Error('PLAYER_NOT_FOUND')
  return player
}

function opponentId(state: GameState, playerId: PlayerId): PlayerId {
  const [firstPlayerId, secondPlayerId] = state.playerOrder
  return playerId === firstPlayerId ? secondPlayerId : firstPlayerId
}

function assertCardsAvailable(state: GameState, playerId: PlayerId): void {
  if (getPlayer(state, playerId).statuses.some((status) => status.kind === 'sealed')) {
    throw new Error('CARDS_SEALED')
  }
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
