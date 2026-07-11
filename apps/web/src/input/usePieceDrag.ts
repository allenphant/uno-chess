import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Square } from '@uno-chess/protocol'

const DRAG_THRESHOLD = 8

export function usePieceDrag({ enabled = true, from, legalTargets, onStart = () => undefined, onCommit }: {
  enabled?: boolean
  from: Square
  legalTargets: Square[]
  onStart?: (from: Square) => void
  onCommit: (move: { from: Square; to: Square }) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const armedRef = useRef(false)
  const draggingRef = useRef(false)
  const didDragRef = useRef(false)
  const committedRef = useRef(false)
  const originRef = useRef({ x: 0, y: 0 })
  const globalPointerUpRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const globalPointerMoveRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const globalPointerCancelRef = useRef<(() => void) | null>(null)

  const removeGlobalListeners = () => {
    if (globalPointerUpRef.current) window.removeEventListener('pointerup', globalPointerUpRef.current)
    if (globalPointerMoveRef.current) window.removeEventListener('pointermove', globalPointerMoveRef.current)
    if (globalPointerCancelRef.current) window.removeEventListener('pointercancel', globalPointerCancelRef.current)
    globalPointerUpRef.current = null
    globalPointerMoveRef.current = null
    globalPointerCancelRef.current = null
  }

  const cancel = () => {
    removeGlobalListeners()
    armedRef.current = false
    draggingRef.current = false
    committedRef.current = false
    setDragging(false)
    setOffset(null)
  }

  const targetAt = (clientX: number, clientY: number, fallbackTarget?: EventTarget | null) => {
    const pointed = document.elementFromPoint?.(clientX, clientY)
    const target = pointed ?? (fallbackTarget instanceof Element ? fallbackTarget : null)
    return target?.closest<HTMLElement>('[data-square]')?.dataset.square as Square | undefined
  }

  const publishMove = (clientX: number, clientY: number) => {
    if (!armedRef.current) return
    const nextOffset = { x: clientX - originRef.current.x, y: clientY - originRef.current.y }
    if (!draggingRef.current && Math.hypot(nextOffset.x, nextOffset.y) < DRAG_THRESHOLD) return
    if (!draggingRef.current) onStart(from)
    draggingRef.current = true
    didDragRef.current = true
    setDragging(true)
    setOffset(nextOffset)
  }

  const finish = (clientX: number, clientY: number, fallbackTarget: EventTarget | null) => {
    if (!armedRef.current) return
    const target = targetAt(clientX, clientY, fallbackTarget)
    if (draggingRef.current && target && legalTargets.includes(target) && !committedRef.current) {
      committedRef.current = true
      onCommit({ from, to: target })
    }
    cancel()
  }

  useEffect(() => () => removeGlobalListeners(), [])

  return {
    dragging,
    offset,
    consumeClick: () => {
      const didDrag = didDragRef.current
      didDragRef.current = false
      return didDrag
    },
    onPointerDown: (event: PointerEvent) => {
      if (!enabled) return
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      armedRef.current = true
      didDragRef.current = false
      committedRef.current = false
      originRef.current = { x: event.clientX, y: event.clientY }
      const handlePointerUp = (pointerEvent: globalThis.PointerEvent) => finish(pointerEvent.clientX, pointerEvent.clientY, pointerEvent.target)
      const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => publishMove(pointerEvent.clientX, pointerEvent.clientY)
      const handlePointerCancel = () => cancel()
      globalPointerUpRef.current = handlePointerUp
      globalPointerMoveRef.current = handlePointerMove
      globalPointerCancelRef.current = handlePointerCancel
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointercancel', handlePointerCancel)
    },
    onPointerMove: (event: PointerEvent) => publishMove(event.clientX, event.clientY),
    onPointerUp: (event: PointerEvent) => finish(event.clientX, event.clientY, event.target),
    onPointerCancel: cancel,
  }
}
