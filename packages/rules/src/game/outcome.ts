import type { GameState, PlayerId } from '@uno-chess/protocol'
import { isArmyInCheck, legalChessMoves } from '../chess/adapter.js'
import { controlledArmy } from './legal-intents.js'
import { applyIntent } from './reducer.js'

export type GameOutcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winnerId: PlayerId; reason: 'checkmate' | 'resignation' | 'timeout' }
  | { kind: 'draw'; reason: 'stalemate' | 'repetition' | 'halfmove-limit' }

export function evaluateOutcome(state: GameState): GameOutcome {
  if (state.board.halfmoveClock >= state.rules.chess.halfmoveLimit) {
    return { kind: 'draw', reason: 'halfmove-limit' }
  }
  const army = controlledArmy(state, state.activePlayerId)
  const enPassantTarget = state.board.enPassantWindow?.captureByArmy === army
    ? state.board.enPassantWindow.target
    : null
  if (legalChessMoves({ fen: state.board.fen, army, enPassantTarget }).length > 0) return { kind: 'ongoing' }
  if (hasLegalFunctionCard(state)) return { kind: 'ongoing' }
  if (isArmyInCheck({ fen: state.board.fen, army, enPassantTarget })) {
    return { kind: 'win', winnerId: opponentId(state, state.activePlayerId), reason: 'checkmate' }
  }
  return { kind: 'draw', reason: 'stalemate' }
}

function hasLegalFunctionCard(state: GameState): boolean {
  const player = state.players[state.activePlayerId]
  if (!player) throw new Error('PLAYER_NOT_FOUND')
  for (const card of player.hand) {
    const definition = state.rules.cards.find((candidate) => candidate.kind === card.kind)
    if (!definition || !definition.enabled || definition.category !== 'function') continue
    const candidate = structuredClone(state)
    candidate.turn.phase = 'await-action'
    try {
      applyIntent(candidate, {
        type: 'play-function-card', playerId: candidate.activePlayerId,
        intentId: `outcome:${card.id}`, cardId: card.id,
      })
      return true
    } catch {
      // A non-resolving card is not a legal escape from a terminal position.
    }
  }
  return false
}

function opponentId(state: GameState, playerId: PlayerId): PlayerId {
  const [firstPlayerId, secondPlayerId] = state.playerOrder
  return playerId === firstPlayerId ? secondPlayerId : firstPlayerId
}
