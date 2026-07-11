import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { Square } from '@uno-chess/protocol'

export function usePieceDrag({ enabled = true, from, legalTargets, onCommit }: { enabled?: boolean; from: Square; legalTargets: Square[]; onCommit: (move: { from: Square; to: Square }) => void }) {
  const [dragging, setDragging] = useState(false)
  return {
    dragging,
    onPointerDown: () => { if (enabled) setDragging(true) },
    onPointerUp: (event: PointerEvent) => {
      const square = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-square]')?.dataset.square as Square | undefined
      if (dragging && square && legalTargets.includes(square)) onCommit({ from, to: square })
      setDragging(false)
    },
    onPointerCancel: () => setDragging(false),
  }
}
