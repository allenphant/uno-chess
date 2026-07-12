import type { GameState } from '@uno-chess/protocol'

export function positionKey(state: GameState): string {
  const [placement, , castling] = state.board.fen.split(' ')
  if (!placement || !castling) throw new Error('INVALID_FEN')
  const players = state.playerOrder.map((playerId) => {
    const player = state.players[playerId]
    if (!player) throw new Error('PLAYER_NOT_FOUND')
    return { id: player.id, hand: player.hand, statuses: player.statuses }
  })

  return JSON.stringify({
    board: { placement, castling, enPassantWindow: state.board.enPassantWindow },
    controllerByArmy: state.controllerByArmy,
    activePlayerId: state.activePlayerId,
    players,
    drawPile: state.drawPile,
    discardPile: state.discardPile,
    discardFace: state.discardFace,
    turn: {
      phase: state.turn.phase,
      drewCard: state.turn.drewCard,
      playedCardId: state.turn.playedCardId,
      actionBudget: state.turn.actionBudget,
      actionMinimum: state.turn.actionMinimum,
      actionsUsed: state.turn.actionsUsed,
      pendingEffect: state.turn.pendingEffect,
    },
  })
}
