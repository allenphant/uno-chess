import type { CardInstance } from '@uno-chess/protocol'

export interface CardHandProps {
  cards: CardInstance[]
}

export function CardHand({ cards }: CardHandProps) {
  return <section className="hand" aria-label="Active player hand">
    {cards.map((card) => <button className={`card ${card.color ?? 'wild'}`} key={card.id} disabled>{card.kind}</button>)}
  </section>
}
