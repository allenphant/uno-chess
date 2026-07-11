import type { CardInstance } from '@uno-chess/protocol'
import { useCardDrag } from '../input/useCardDrag.js'

export interface CardHandProps {
  cards: CardInstance[]
  selectedCardId: string | null
  playableCardIds: string[]
  onSelect: (cardId: string) => void
  onCommit?: (cardId: string) => void
}

export function CardHand({ cards, selectedCardId, playableCardIds, onSelect, onCommit }: CardHandProps) {
  return <section className="hand" aria-label="Active player hand">
    {cards.map((card) => <DraggableCard card={card} disabled={!playableCardIds.includes(card.id)} key={card.id} selected={selectedCardId === card.id} {...(onCommit ? { onCommit } : {})} onSelect={onSelect} />)}
  </section>
}

function DraggableCard({ card, disabled, selected, onCommit, onSelect }: { card: CardInstance; disabled: boolean; selected: boolean; onCommit?: (cardId: string) => void; onSelect: (cardId: string) => void }) {
  const drag = useCardDrag({ cardId: card.id, onCommit: (cardId) => onCommit?.(cardId) })
  return <button aria-pressed={selected} className={`card ${card.color ?? 'wild'}${drag.dragging ? ' dragging' : ''}`} disabled={disabled} onClick={() => onSelect(card.id)} onPointerCancel={drag.onPointerCancel} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp}>{card.kind}</button>
}
