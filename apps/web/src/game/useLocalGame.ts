import type { GameIntent, GameState } from '@uno-chess/protocol'
import { applyIntent, createGame, defaultRules, projectPlayerView } from '@uno-chess/rules'
import { useMemo, useReducer, useRef } from 'react'

type LocalState = { game: GameState; error: string | null }

export function useLocalGame(seed: string) {
  const intentSequence = useRef(0)
  const [local, dispatch] = useReducer(
    (current: LocalState, intent: GameIntent): LocalState => {
      try {
        return { game: applyIntent(current.game, intent).state, error: null }
      } catch (error) {
        return { ...current, error: error instanceof Error ? error.message : 'UNKNOWN_GAME_ERROR' }
      }
    },
    undefined,
    (): LocalState => ({
      game: createGame({ gameId: `local:${seed}`, playerIds: ['p1', 'p2'], rules: defaultRules, seed }),
      error: null,
    }),
  )
  const view = useMemo(() => projectPlayerView(local.game, local.game.activePlayerId), [local.game])
  const nextIntentId = (kind: string) => `${seed}:${kind}:${intentSequence.current++}`

  return { state: local.game, view, error: local.error, dispatch, nextIntentId }
}
