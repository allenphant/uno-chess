import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

export interface CardDragVisualState {
  cardId: string
  overDropZone: boolean
}

export interface CardDragController {
  dragging: boolean
  overDropZone: boolean
  offset: { x: number; y: number } | null
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: () => void
}

const DRAG_THRESHOLD = 8

export function useCardDrag({ cardId, enabled = true, onCommit, onStateChange = () => undefined }: {
  cardId: string
  enabled?: boolean
  onCommit: (cardId: string) => void
  onStateChange?: (state: CardDragVisualState | null) => void
}): CardDragController {
  const [dragging, setDragging] = useState(false)
  const [overDropZone, setOverDropZone] = useState(false)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const armedRef = useRef(false)
  const draggingRef = useRef(false)
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

  const hitZone = (clientX: number, clientY: number, fallbackTarget?: EventTarget | null) => {
    const pointed = document.elementFromPoint?.(clientX, clientY)
    const target = pointed ?? (fallbackTarget instanceof Element ? fallbackTarget : null)
    return Boolean(target?.closest('[data-card-drop-zone="true"]'))
  }

  const cancel = () => {
    const wasDragging = draggingRef.current
    removeGlobalListeners()
    armedRef.current = false
    draggingRef.current = false
    committedRef.current = false
    setDragging(false)
    setOverDropZone(false)
    setOffset(null)
    if (wasDragging) onStateChange(null)
  }

  const publishMove = (clientX: number, clientY: number) => {
    if (!armedRef.current) return
    const nextOffset = { x: clientX - originRef.current.x, y: clientY - originRef.current.y }
    if (!draggingRef.current && Math.hypot(nextOffset.x, nextOffset.y) < DRAG_THRESHOLD) return
    draggingRef.current = true
    setDragging(true)
    setOffset(nextOffset)
    const nextOverDropZone = hitZone(clientX, clientY)
    setOverDropZone(nextOverDropZone)
    onStateChange({ cardId, overDropZone: nextOverDropZone })
  }

  const finish = (clientX: number, clientY: number, fallbackTarget: EventTarget | null) => {
    if (!armedRef.current) return
    if (draggingRef.current && !committedRef.current && hitZone(clientX, clientY, fallbackTarget)) {
      committedRef.current = true
      onCommit(cardId)
    }
    cancel()
  }

  useEffect(() => () => removeGlobalListeners(), [])

  return {
    dragging,
    overDropZone,
    offset,
    onPointerDown: (event) => {
      if (!enabled) return
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      armedRef.current = true
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
    onPointerMove: (event) => publishMove(event.clientX, event.clientY),
    onPointerUp: (event) => finish(event.clientX, event.clientY, event.target),
    onPointerCancel: cancel,
  }
}
