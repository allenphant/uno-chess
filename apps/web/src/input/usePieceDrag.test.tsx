/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePieceDrag } from './usePieceDrag.js'

const mockElementFromPoint = (element: Element) => Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: vi.fn(() => element),
})

const pointer = (clientX: number, clientY: number) => ({
  clientX,
  clientY,
  pointerId: 1,
  currentTarget: { setPointerCapture: vi.fn() },
  target: document.createElement('button'),
}) as unknown as React.PointerEvent

beforeEach(() => mockElementFromPoint(document.createElement('div')))
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'elementFromPoint')
})

describe('usePieceDrag', () => {
  it('starts only after eight pixels and selects the source', () => {
    const onStart = vi.fn()
    const { result } = renderHook(() => usePieceDrag({ enabled: true, from: 'e2', legalTargets: ['e4'], onStart, onCommit: vi.fn() }))

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 15, clientY: 15 })))
    expect(result.current.dragging).toBe(false)

    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 20 })))
    expect(result.current.dragging).toBe(true)
    expect(result.current.offset).toEqual({ x: 10, y: 10 })
    expect(onStart).toHaveBeenCalledWith('e2')
    act(() => result.current.onPointerCancel())
  })

  it('commits a legal target resolved from elementFromPoint and consumes the next click', () => {
    const target = document.createElement('button')
    target.dataset.square = 'e4'
    mockElementFromPoint(target)
    const onCommit = vi.fn()
    const { result } = renderHook(() => usePieceDrag({ enabled: true, from: 'e2', legalTargets: ['e4'], onStart: vi.fn(), onCommit }))

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 30 })))

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    expect(result.current.consumeClick()).toBe(true)
    expect(result.current.consumeClick()).toBe(false)
  })

  it('returns to the source when released on an illegal square', () => {
    const target = document.createElement('button')
    target.dataset.square = 'e5'
    mockElementFromPoint(target)
    const onCommit = vi.fn()
    const { result } = renderHook(() => usePieceDrag({ enabled: true, from: 'e2', legalTargets: ['e4'], onStart: vi.fn(), onCommit }))

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 30 })))

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.dragging).toBe(false)
    expect(result.current.offset).toBeNull()
  })

  it('does not arm a piece without legal moves', () => {
    const onStart = vi.fn()
    const { result } = renderHook(() => usePieceDrag({ enabled: false, from: 'e2', legalTargets: [], onStart, onCommit: vi.fn() }))

    act(() => result.current.onPointerDown(pointer(10, 10)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))

    expect(result.current.dragging).toBe(false)
    expect(onStart).not.toHaveBeenCalled()
  })
})
