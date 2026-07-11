/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCardDrag } from './useCardDrag.js'

const mockElementFromPoint = (element: Element) => Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: vi.fn(() => element),
})

beforeEach(() => mockElementFromPoint(document.createElement('div')))
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'elementFromPoint')
})

const pointer = (clientX: number, clientY: number) => ({
  clientX,
  clientY,
  pointerId: 1,
  currentTarget: { setPointerCapture: vi.fn() },
  target: document.createElement('button'),
}) as unknown as React.PointerEvent

function dragHook({ enabled = true, onCommit = vi.fn(), onStateChange = vi.fn() } = {}) {
  return {
    onCommit,
    onStateChange,
    ...renderHook(() => useCardDrag({ cardId: 'c1', enabled, onCommit, onStateChange })),
  }
}

describe('useCardDrag', () => {
  it('treats a short pointer gesture as a click instead of a drag', () => {
    const { result, onCommit, onStateChange } = dragHook()

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 13, clientY: 13 })))

    expect(result.current.dragging).toBe(false)
    expect(onStateChange).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('starts after eight pixels and reports entry into the play zone', () => {
    const zone = document.createElement('div')
    zone.dataset.cardDropZone = 'true'
    mockElementFromPoint(zone)
    const { result, onStateChange } = dragHook()

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 20 })))

    expect(result.current.dragging).toBe(true)
    expect(result.current.overDropZone).toBe(true)
    expect(result.current.offset).toEqual({ x: 10, y: 10 })
    expect(onStateChange).toHaveBeenLastCalledWith({ cardId: 'c1', overDropZone: true })
    act(() => result.current.onPointerCancel())
  })

  it('commits exactly once when released inside the play zone', () => {
    const zone = document.createElement('div')
    zone.dataset.cardDropZone = 'true'
    mockElementFromPoint(zone)
    const { result, onCommit } = dragHook()

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 30 })))

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('c1')
    expect(result.current.dragging).toBe(false)
  })

  it('cancels a release outside the play zone', () => {
    const { result, onCommit, onStateChange } = dragHook()

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 50 })))

    expect(onCommit).not.toHaveBeenCalled()
    expect(onStateChange).toHaveBeenLastCalledWith(null)
    expect(result.current.offset).toBeNull()
  })

  it('never starts when the card is not playable', () => {
    const { result, onStateChange } = dragHook({ enabled: false })

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 80 })))

    expect(result.current.dragging).toBe(false)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('cleans up an active drag when pointer input is cancelled', () => {
    const { result, onCommit, onStateChange } = dragHook()

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new Event('pointercancel')))

    expect(result.current.dragging).toBe(false)
    expect(result.current.offset).toBeNull()
    expect(onCommit).not.toHaveBeenCalled()
    expect(onStateChange).toHaveBeenLastCalledWith(null)
  })
})
