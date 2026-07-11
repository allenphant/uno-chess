/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLocalGame } from './useLocalGame.js'

describe('useLocalGame automatic draw', () => {
  it('draws exactly once when a turn starts', async () => {
    const { result } = renderHook(() => useLocalGame('auto-draw'))

    await waitFor(() => expect(result.current.state.turn.phase).toBe('await-action'))
    expect(result.current.view.self.hand).toHaveLength(4)
    expect(result.current.state.turn.drewCard).toBe(true)
  })

  it('keeps events and immutable checkpoints for visible actions', async () => {
    const { result } = renderHook(() => useLocalGame('timeline'))
    const initialFen = result.current.state.board.fen

    await waitFor(() => expect(result.current.state.turn.phase).toBe('await-action'))
    expect(result.current.events.map((event) => event.type)).toEqual(['card-drawn', 'turn-action-opened'])
    expect(result.current.checkpoints).toHaveLength(1)

    act(() => result.current.dispatch({
      type: 'basic-move', playerId: 'p1', intentId: result.current.nextIntentId('move'), from: 'e2', to: 'e4',
    }))

    await waitFor(() => expect(result.current.state.activePlayerId).toBe('p2'))
    expect(result.current.checkpoints).toHaveLength(2)
    expect(result.current.checkpoints[0]?.state.board.fen).toBe(initialFen)
    expect(result.current.checkpoints[1]?.sequence).toBe(
      result.current.events.find((event) => event.type === 'piece-moved')?.sequence,
    )
  })
})
