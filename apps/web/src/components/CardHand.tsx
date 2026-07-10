import type { CardInstance } from '@uno-chess/protocol'

export interface CardHandProps {
  cards: CardInstance[]
  selectedCardId: string | null
  playableCardIds: string[]
  onSelect: (cardId: string) => void
}

export function CardHand({ cards, selectedCardId, playableCardIds, onSelect }: CardHandProps) {
  return <section className="hand" aria-label="Active player hand">
    {cards.map((card) => <button aria-pressed={selectedCardId === card.id} className={`card ${card.color ?? 'wild'}`} disabled={!playableCardIds.includes(card.id)} key={card.id} onClick={() => onSelect(card.id)}>{card.kind}</button>)}
  </section>
}
