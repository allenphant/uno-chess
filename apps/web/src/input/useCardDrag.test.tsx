/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCardDrag } from './useCardDrag.js'

describe('useCardDrag', () => {
  it('commits only when a dragged card is released on the board drop zone', () => {
    const onCommit = vi.fn()
    const board = document.createElement('div')
    board.dataset.cardDropZone = 'true'
    const cardButton = document.createElement('button')
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => board) })
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent))
    act(() => result.current.onPointerUp({ clientX: 120, clientY: 80, target: cardButton } as unknown as React.PointerEvent))

    expect(onCommit).toHaveBeenCalledWith('c1')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
  })

  it('cancels a release outside the board without committing', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent))
    act(() => result.current.onPointerUp({ clientX: 120, clientY: 80, target: document.createElement('div') } as unknown as React.PointerEvent))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.dragging).toBe(false)
  })

  it('commits from the window pointerup when pointer capture is unavailable', () => {
    const onCommit = vi.fn()
    const board = document.createElement('div')
    board.dataset.cardDropZone = 'true'
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => board) })
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 120, clientY: 80 })))

    expect(onCommit).toHaveBeenCalledWith('c1')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
  })

  it('does not miss a quick release before React can render again', () => {
    const onCommit = vi.fn()
    const board = document.createElement('div')
    board.dataset.cardDropZone = 'true'
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => board) })
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))

    act(() => {
      result.current.onPointerDown({ clientX: 10, clientY: 10 } as React.PointerEvent)
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 20 }))
    })

    expect(onCommit).toHaveBeenCalledWith('c1')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
  })

  it('tracks pointer movement so the card visibly follows the drag', () => {
    const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit: () => undefined }))

    act(() => result.current.onPointerDown({ clientX: 10, clientY: 20 } as React.PointerEvent))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 55, clientY: 80 })))

    expect(result.current.offset).toEqual({ x: 45, y: 60 })
    act(() => result.current.onPointerCancel())
  })
})
