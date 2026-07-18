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
  discardMode?: boolean
  onDiscard?: (cardId: string) => void
  onDiscardDrop?: (cardId: string) => void
  selectedDiscardCardId?: string | null
}

export function CardHand({ cards, playableCardIds, unavailableReasonByCardId, onCommit, onDragStateChange, discardMode = false, onDiscard, onDiscardDrop, selectedDiscardCardId = null }: CardHandProps) {
  const [previewedCardId, setPreviewedCardId] = useState<string | null>(null)
  const handRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !handRef.current?.contains(event.target)) setPreviewedCardId(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  useEffect(() => {
    if (discardMode) setPreviewedCardId(null)
  }, [discardMode])

  return <section className={`hand${discardMode ? ' discard-mode' : ''}`} aria-label={discardMode ? '選擇要棄掉的手牌' : '你的手牌'} ref={handRef}>
    {cards.map((card, index) => <DraggableCard
      card={card}
      cardCount={cards.length}
      cardIndex={index}
      discardMode={discardMode}
      key={card.id}
      onCommit={onCommit}
      onDiscard={onDiscard}
      onDiscardDrop={onDiscardDrop}
      onDragStateChange={onDragStateChange}
      onPreview={() => setPreviewedCardId((current) => current === card.id ? null : card.id)}
      playable={playableCardIds.includes(card.id)}
      previewing={previewedCardId === card.id}
      selectedForDiscard={selectedDiscardCardId === card.id}
      unavailableReason={unavailableReasonByCardId[card.id]}
    />)}
  </section>
}

function DraggableCard({ card, cardCount, cardIndex, discardMode, onCommit, onDiscard, onDiscardDrop, onDragStateChange, onPreview, playable, previewing, selectedForDiscard, unavailableReason }: {
  card: CardInstance
  cardCount: number
  cardIndex: number
  discardMode: boolean
  onCommit: (cardId: string) => void
  onDiscard: ((cardId: string) => void) | undefined
  onDiscardDrop: ((cardId: string) => void) | undefined
  onDragStateChange: (state: CardDragVisualState | null) => void
  onPreview: () => void
  playable: boolean
  previewing: boolean
  selectedForDiscard: boolean
  unavailableReason: string | undefined
}) {
  const wasDraggedRef = useRef(false)
  const drag = useCardDrag({
    cardId: card.id,
    enabled: discardMode || playable,
    onCommit: discardMode ? onDiscardDrop ?? (() => undefined) : onCommit,
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
    discardMode ? 'discardable' : playable ? 'playable' : 'unplayable',
    selectedForDiscard ? 'discard-selected' : '',
    previewing ? 'previewing' : '',
    drag.dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ')

  return <button
    aria-disabled={!discardMode && !playable}
    aria-label={discardMode ? `棄掉${cardAccessibleLabel(card)}` : cardAccessibleLabel(card)}
    aria-pressed={discardMode ? selectedForDiscard : previewing}
    className={classes}
    style={cardStyle}
    onClick={() => {
      if (wasDraggedRef.current) {
        wasDraggedRef.current = false
        return
      }
      if (discardMode) {
        onDiscard?.(card.id)
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
    {!discardMode && previewing && unavailableReason ? <span className="card-unavailable-reason">{unavailableReason}</span> : null}
  </button>
}
