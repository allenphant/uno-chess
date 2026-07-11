import type { CardInstance } from '@uno-chess/protocol'
import type { CSSProperties } from 'react'
import { useCardDrag } from '../input/useCardDrag.js'
import { CardFace, cardAccessibleLabel } from './CardFace.js'

export interface CardHandProps {
  cards: CardInstance[]
  selectedCardId: string | null
  playableCardIds: string[]
  onSelect: (cardId: string) => void
  onCommit?: (cardId: string) => void
}

export function CardHand({ cards, selectedCardId, playableCardIds, onSelect, onCommit }: CardHandProps) {
  return <section className="hand" aria-label="目前玩家手牌">
    {cards.map((card) => <DraggableCard card={card} disabled={!playableCardIds.includes(card.id)} key={card.id} selected={selectedCardId === card.id} {...(onCommit ? { onCommit } : {})} onSelect={onSelect} />)}
  </section>
}

function DraggableCard({ card, disabled, selected, onCommit, onSelect }: { card: CardInstance; disabled: boolean; selected: boolean; onCommit?: (cardId: string) => void; onSelect: (cardId: string) => void }) {
  const drag = useCardDrag({ cardId: card.id, onCommit: (cardId) => onCommit?.(cardId) })
  const dragStyle = drag.offset ? { '--drag-x': `${drag.offset.x}px`, '--drag-y': `${drag.offset.y}px` } as CSSProperties : undefined
  return <button aria-label={cardAccessibleLabel(card)} aria-pressed={selected} className={`card ${card.color ?? 'wild'}${drag.dragging ? ' dragging' : ''}`} disabled={disabled} {...(dragStyle ? { style: dragStyle } : {})} onClick={() => onSelect(card.id)} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp}><CardFace card={card} /></button>
}
