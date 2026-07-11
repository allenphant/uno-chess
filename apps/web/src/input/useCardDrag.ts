import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

export interface CardDragController {
  dragging: boolean
  offset: { x: number; y: number } | null
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: () => void
}

export function useCardDrag({ cardId, onCommit }: { cardId: string; onCommit: (cardId: string) => void }): CardDragController {
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
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
    draggingRef.current = false
    setDragging(false)
    setOffset(null)
  }
  const finish = (clientX: number, clientY: number, fallbackTarget: EventTarget | null) => {
    if (!draggingRef.current) return
    const target = document.elementFromPoint?.(clientX, clientY) ?? fallbackTarget as Element | null
    if (target?.closest('[data-card-drop-zone="true"]')) onCommit(cardId)
    cancel()
  }

  useEffect(() => () => removeGlobalListeners(), [])

  return {
    dragging,
    offset,
    onPointerDown: (event) => {
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      draggingRef.current = true
      originRef.current = { x: event.clientX, y: event.clientY }
      setDragging(true)
      setOffset({ x: 0, y: 0 })
      const handlePointerUp = (pointerEvent: globalThis.PointerEvent) => finish(pointerEvent.clientX, pointerEvent.clientY, pointerEvent.target)
      const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => setOffset({ x: pointerEvent.clientX - originRef.current.x, y: pointerEvent.clientY - originRef.current.y })
      const handlePointerCancel = () => cancel()
      globalPointerUpRef.current = handlePointerUp
      globalPointerMoveRef.current = handlePointerMove
      globalPointerCancelRef.current = handlePointerCancel
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointercancel', handlePointerCancel)
    },
    onPointerMove: (event) => setOffset({ x: event.clientX - originRef.current.x, y: event.clientY - originRef.current.y }),
    onPointerUp: (event) => {
      finish(event.clientX, event.clientY, event.target)
    },
    onPointerCancel: cancel,
  }
}
