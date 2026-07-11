import type { CardInstance } from '@uno-chess/protocol'
import { cardName } from '../presentation/uiText.js'

export function OverflowDiscard({ cards, onDiscard }: { cards: CardInstance[]; onDiscard: (cardId: string) => void }) {
  return <section className="overflow-discard" aria-label="手牌超額棄牌">
    <p>手牌已滿，請選一張牌棄掉。</p>
    {cards.map((card) => <button key={card.id} onClick={() => onDiscard(card.id)}>棄掉「{cardName(card.kind)}」</button>)}
  </section>
}
