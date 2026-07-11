/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLocalGame } from './useLocalGame.js'

describe('useLocalGame automatic draw', () => {
  it('draws exactly once when a turn starts', async () => {
    const { result } = renderHook(() => useLocalGame('auto-draw'))

    await waitFor(() => expect(result.current.state.turn.phase).toBe('await-action'))
    expect(result.current.view.self.hand).toHaveLength(4)
    expect(result.current.state.turn.drewCard).toBe(true)
  })
})
