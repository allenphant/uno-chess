import type { CardInstance, DiscardFace, GameState, GameStatus, PlayerId, PlayerStatus, TurnState } from '@uno-chess/protocol'
import { getLegalActionMoves, getLegalBasicMoves } from './legal-intents.js'
import { applyIntent, getLegalReinforcementOptions, type ReinforcementOption } from './reducer.js'
import type { LegalChessMove } from '../chess/adapter.js'

export interface PlayerGameView {
  gameId: string
  rules: GameState['rules']
  activePlayerId: PlayerId
  controllerByArmy: GameState['controllerByArmy']
  board: Pick<GameState['board'], 'fen' | 'enPassantWindow' | 'capturedByArmy' | 'activePieces' | 'halfmoveClock'>
  discardFace: DiscardFace | null
  discardPile: CardInstance[]
  drawPileCount: number
  turn: TurnState
  status: GameStatus
  self: { id: PlayerId; hand: CardInstance[]; statuses: PlayerStatus[] }
  opponent: { id: PlayerId; hand: { count: number }; statuses: PlayerStatus[] }
  legal: {
    basicMoves: LegalChessMove[]
    actionMoves: LegalChessMove[]
    playableCardIds: string[]
    reinforcementOptions: ReinforcementOption[]
  }
}

export function projectPlayerView(state: GameState, playerId: PlayerId): PlayerGameView {
  const self = state.players[playerId]
  if (!self) throw new Error('PLAYER_NOT_FOUND')
  const [firstPlayerId, secondPlayerId] = state.playerOrder
  const opponentId = playerId === firstPlayerId ? secondPlayerId : firstPlayerId
  const opponent = state.players[opponentId]
  if (!opponent) throw new Error('PLAYER_NOT_FOUND')

  return structuredClone({
    gameId: state.gameId,
    rules: state.rules,
    activePlayerId: state.activePlayerId,
    controllerByArmy: state.controllerByArmy,
    board: {
      fen: state.board.fen,
      enPassantWindow: state.board.enPassantWindow,
      capturedByArmy: state.board.capturedByArmy,
      activePieces: state.board.activePieces,
      halfmoveClock: state.board.halfmoveClock,
    },
    discardFace: state.discardFace,
    discardPile: state.discardPile,
    drawPileCount: state.drawPile.length,
    turn: state.turn,
    status: state.status,
    self: { id: self.id, hand: self.hand, statuses: self.statuses },
    opponent: { id: opponent.id, hand: { count: opponent.hand.length }, statuses: opponent.statuses },
    legal: legalOptions(state, playerId),
  })
}

function legalOptions(state: GameState, playerId: PlayerId): PlayerGameView['legal'] {
  if (state.activePlayerId !== playerId || state.status.kind !== 'active') return emptyLegalOptions()
  return {
    basicMoves: getLegalBasicMoves(state),
    actionMoves: getLegalActionMoves(state),
    playableCardIds: playableCardIds(state, playerId),
    reinforcementOptions: state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce'
      ? getLegalReinforcementOptions(state, playerId)
      : [],
  }
}

function playableCardIds(state: GameState, playerId: PlayerId): string[] {
  if (state.turn.phase !== 'await-action') return []
  const player = state.players[playerId]
  if (!player) return []
  return player.hand.flatMap((card) => {
    const definition = state.rules.cards.find((candidate) => candidate.kind === card.kind)
    if (!definition?.enabled) return []
    let intentId = `__server-legal-probe:${card.id}`
    while (state.acceptedIntentIds.includes(intentId)) intentId = `${intentId}:next`
    const intent = definition.category === 'action'
      ? { type: 'play-action-card' as const, playerId, intentId, cardId: card.id }
      : { type: 'play-function-card' as const, playerId, intentId, cardId: card.id }
    try {
      applyIntent(state, intent)
      return [card.id]
    } catch {
      return []
    }
  })
}

function emptyLegalOptions(): PlayerGameView['legal'] {
  return { basicMoves: [], actionMoves: [], playableCardIds: [], reinforcementOptions: [] }
}
