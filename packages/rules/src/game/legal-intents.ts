import type { ArmyColor, GameState, PlayerId } from '@uno-chess/protocol'
import { legalChessMoves, type LegalChessMove } from '../chess/adapter.js'

export function controlledArmy(state: GameState, playerId: PlayerId): ArmyColor {
  const entry = (Object.entries(state.controllerByArmy) as Array<[ArmyColor, PlayerId]>).find(([, controller]) => controller === playerId)
  if (!entry) throw new Error('PLAYER_CONTROLS_NO_ARMY')
  return entry[0]
}

export function getLegalBasicMoves(state: GameState): LegalChessMove[] {
  if (state.turn.phase !== 'await-action') return []
  return getLegalMovesForActiveArmy(state)
}

export function getLegalActionMoves(state: GameState): LegalChessMove[] {
  if (state.turn.phase !== 'await-action-move') return []
  return getLegalMovesForActiveArmy(state)
}

function getLegalMovesForActiveArmy(state: GameState): LegalChessMove[] {
  const army = controlledArmy(state, state.activePlayerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  return legalChessMoves({ fen: state.board.fen, army, enPassantTarget })
}
