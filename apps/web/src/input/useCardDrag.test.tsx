/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCardDrag } from './useCardDrag.js'

describe('useCardDrag', () => {
  it('commits only when a dragged card is released on the board drop zone', () => {
    const onCommit = vi.fn()
    const board = document.createElement('div')
    board.dataset.cardDropZone = 'true'
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent))
    act(() => result.current.onPointerUp({ clientX: 120, clientY: 80, target: board } as unknown as React.PointerEvent))

    expect(onCommit).toHaveBeenCalledWith('c1')
  })

  it('cancels a release outside the board without committing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent))
    act(() => result.current.onPointerUp({ clientX: 120, clientY: 80, target: document.createElement('div') } as unknown as React.PointerEvent))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.dragging).toBe(false)
  })
})
