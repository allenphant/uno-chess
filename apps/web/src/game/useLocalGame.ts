import type { GameEvent, GameIntent, GameState } from '@uno-chess/protocol'
import { applyIntent, createGame, defaultRules, projectPlayerView } from '@uno-chess/rules'
import { useEffect, useMemo, useReducer, useRef } from 'react'

export interface GameCheckpoint {
  sequence: number
  state: GameState
}

type LocalState = { game: GameState; error: string | null; events: GameEvent[]; checkpoints: GameCheckpoint[] }

const checkpointEventTypes = new Set<GameEvent['type']>(['card-played', 'piece-moved', 'piece-reinforced'])

export function useLocalGame(seed: string) {
  const intentSequence = useRef(0)
  const [local, dispatch] = useReducer(
    (current: LocalState, intent: GameIntent): LocalState => {
      try {
        const result = applyIntent(current.game, intent)
        const visibleEvents = result.events.filter((event) => checkpointEventTypes.has(event.type))
        return {
          game: result.state,
          error: null,
          events: [...current.events, ...result.events],
          checkpoints: [...current.checkpoints, ...visibleEvents.map((event) => ({
            sequence: event.sequence,
            state: structuredClone(result.state),
          }))],
        }
      } catch (error) {
        return { ...current, error: error instanceof Error ? error.message : 'UNKNOWN_GAME_ERROR' }
      }
    },
    undefined,
    (): LocalState => {
      const game = createGame({ gameId: `local:${seed}`, playerIds: ['p1', 'p2'], rules: defaultRules, seed })
      return { game, error: null, events: [], checkpoints: [{ sequence: 0, state: structuredClone(game) }] }
    },
  )
  const view = useMemo(() => projectPlayerView(local.game, local.game.activePlayerId), [local.game])
  const nextIntentId = (kind: string) => `${seed}:${kind}:${intentSequence.current++}`

  useEffect(() => {
    if (local.game.turn.phase !== 'turn-start') return
    dispatch({
      type: 'draw-for-turn',
      playerId: local.game.activePlayerId,
      intentId: `${seed}:auto-draw:${local.game.turn.number}:${local.game.activePlayerId}`,
    })
  }, [local.game.activePlayerId, local.game.turn.number, local.game.turn.phase, seed])

  return { state: local.game, view, error: local.error, events: local.events, checkpoints: local.checkpoints, dispatch, nextIntentId }
}
