import type { CardInstance, DiscardFace, GameState, GameStatus, PlayerId, PlayerStatus, TurnState } from '@uno-chess/protocol'

export interface PlayerGameView {
  gameId: string
  activePlayerId: PlayerId
  controllerByArmy: GameState['controllerByArmy']
  board: Pick<GameState['board'], 'fen' | 'enPassantWindow' | 'capturedByArmy' | 'halfmoveClock'>
  discardFace: DiscardFace | null
  discardPile: CardInstance[]
  drawPileCount: number
  turn: TurnState
  status: GameStatus
  self: { id: PlayerId; hand: CardInstance[]; statuses: PlayerStatus[] }
  opponent: { id: PlayerId; hand: { count: number }; statuses: PlayerStatus[] }
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
    activePlayerId: state.activePlayerId,
    controllerByArmy: state.controllerByArmy,
    board: {
      fen: state.board.fen,
      enPassantWindow: state.board.enPassantWindow,
      capturedByArmy: state.board.capturedByArmy,
      halfmoveClock: state.board.halfmoveClock,
    },
    discardFace: state.discardFace,
    discardPile: state.discardPile,
    drawPileCount: state.drawPile.length,
    turn: state.turn,
    status: state.status,
    self: { id: self.id, hand: self.hand, statuses: self.statuses },
    opponent: { id: opponent.id, hand: { count: opponent.hand.length }, statuses: opponent.statuses },
  })
}
