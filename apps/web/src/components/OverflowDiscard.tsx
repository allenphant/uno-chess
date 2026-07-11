import type { CardInstance } from '@uno-chess/protocol'

export function OverflowDiscard({ cards, onDiscard }: { cards: CardInstance[]; onDiscard: (cardId: string) => void }) {
  return <section className="overflow-discard" aria-label="Overflow discard">
    <p>Hand limit reached: discard one card.</p>
    {cards.map((card) => <button key={card.id} onClick={() => onDiscard(card.id)}>Discard {card.kind}</button>)}
  </section>
}
