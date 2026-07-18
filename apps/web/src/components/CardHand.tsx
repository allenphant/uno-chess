import type { CardInstance } from '@uno-chess/protocol'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useCardDrag } from '../input/useCardDrag.js'
import type { CardDragVisualState } from '../input/useCardDrag.js'
import { CardFace, cardAccessibleLabel } from './CardFace.js'

export interface CardHandProps {
  cards: CardInstance[]
  playableCardIds: string[]
  unavailableReasonByCardId: Partial<Record<string, string>>
  onCommit: (cardId: string) => void
  onDragStateChange: (state: CardDragVisualState | null) => void
}

export function CardHand({ cards, playableCardIds, unavailableReasonByCardId, onCommit, onDragStateChange }: CardHandProps) {
  const [previewedCardId, setPreviewedCardId] = useState<string | null>(null)
  const handRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !handRef.current?.contains(event.target)) setPreviewedCardId(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return <section className="hand" aria-label="你的手牌" ref={handRef}>
    {cards.map((card, index) => <DraggableCard
      card={card}
      cardCount={cards.length}
      cardIndex={index}
      key={card.id}
      onCommit={onCommit}
      onDragStateChange={onDragStateChange}
      onPreview={() => setPreviewedCardId((current) => current === card.id ? null : card.id)}
      playable={playableCardIds.includes(card.id)}
      previewing={previewedCardId === card.id}
      unavailableReason={unavailableReasonByCardId[card.id]}
    />)}
  </section>
}

function DraggableCard({ card, cardCount, cardIndex, onCommit, onDragStateChange, onPreview, playable, previewing, unavailableReason }: {
  card: CardInstance
  cardCount: number
  cardIndex: number
  onCommit: (cardId: string) => void
  onDragStateChange: (state: CardDragVisualState | null) => void
  onPreview: () => void
  playable: boolean
  previewing: boolean
  unavailableReason: string | undefined
}) {
  const wasDraggedRef = useRef(false)
  const drag = useCardDrag({
    cardId: card.id,
    enabled: playable,
    onCommit,
    onStateChange: (state) => {
      if (state) wasDraggedRef.current = true
      onDragStateChange(state)
    },
  })
  const distanceFromCenter = cardIndex - (cardCount - 1) / 2
  const cardStyle = {
    '--card-angle': `${Math.max(-4.5, Math.min(4.5, distanceFromCenter * 1.6))}deg`,
    '--card-arc': `${Math.abs(distanceFromCenter) * 3}px`,
    ...(drag.offset ? { '--drag-x': `${drag.offset.x}px`, '--drag-y': `${drag.offset.y}px` } : {}),
  } as CSSProperties
  const classes = [
    'card',
    card.color ?? 'wild',
    playable ? 'playable' : 'unplayable',
    previewing ? 'previewing' : '',
    drag.dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  return <button
    aria-disabled={!playable}
    aria-label={cardAccessibleLabel(card)}
    aria-pressed={previewing}
    className={classes}
    style={cardStyle}
    onClick={() => {
      if (wasDraggedRef.current) {
        wasDraggedRef.current = false
        return
      }
      onPreview()
    }}
    onPointerCancel={drag.onPointerCancel}
    onPointerDown={drag.onPointerDown}
    onPointerMove={drag.onPointerMove}
    onPointerUp={drag.onPointerUp}
  >
    <CardFace card={card} />
    {previewing && unavailableReason ? <span className="card-unavailable-reason">{unavailableReason}</span> : null}
  </button>
}
