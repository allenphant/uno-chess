import { useState } from 'react'
import type { PointerEvent } from 'react'

export interface CardDragController {
  dragging: boolean
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: () => void
}

export function useCardDrag({ cardId, onCommit }: { cardId: string; onCommit: (cardId: string) => void }): CardDragController {
  const [dragging, setDragging] = useState(false)
  const cancel = () => setDragging(false)

  return {
    dragging,
    onPointerDown: () => setDragging(true),
    onPointerMove: () => undefined,
    onPointerUp: (event) => {
      const target = event.target as HTMLElement | null
      if (dragging && target?.closest('[data-card-drop-zone="true"]')) onCommit(cardId)
      cancel()
    },
    onPointerCancel: cancel,
  }
}
