import type { GameState, TurnPhase } from '@uno-chess/protocol'
import { createGame } from '../game/create-game.js'
import { defaultRules } from '../ruleset/default-preset.js'

export interface BuildTestStateOptions {
  activeHandSize?: number
  phase?: TurnPhase
  seed?: string
}

export function buildTestState(options: BuildTestStateOptions = {}): GameState {
  const state = createGame({
    gameId: 'test-game',
    playerIds: ['p1', 'p2'],
    rules: defaultRules,
    seed: options.seed ?? 'test-seed',
  })
  const player = state.players.p1
  if (!player) throw new Error('PLAYER_NOT_FOUND')
  const desiredHandSize = options.activeHandSize ?? player.hand.length
  while (player.hand.length < desiredHandSize) {
    const card = state.drawPile.pop()
    if (!card) throw new Error('DRAW_PILE_EMPTY')
    player.hand.push(card)
  }
  while (player.hand.length > desiredHandSize) player.hand.pop()
  state.turn.phase = options.phase ?? state.turn.phase
  return state
}
