/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePieceDrag } from './usePieceDrag.js'

describe('usePieceDrag', () => {
  it('commits a legal target square after dragging from the selected source', () => {
    const onCommit = vi.fn()
    const target = document.createElement('button')
    target.dataset.square = 'e4'
    const { result } = renderHook(() => usePieceDrag({ from: 'e2', legalTargets: ['e4'], onCommit }))

    act(() => result.current.onPointerDown())
    act(() => result.current.onPointerUp({ target } as unknown as React.PointerEvent))

    expect(onCommit).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  })

  it('does not start a drag from an unselected square', () => {
    const onCommit = vi.fn()
    const target = document.createElement('button')
    target.dataset.square = 'e4'
    const { result } = renderHook(() => usePieceDrag({ enabled: false, from: 'e2', legalTargets: ['e4'], onCommit }))

    act(() => result.current.onPointerDown())
    act(() => result.current.onPointerUp({ target } as unknown as React.PointerEvent))

    expect(onCommit).not.toHaveBeenCalled()
  })
})
