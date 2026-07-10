import type { CardColor, CardInstance, RuleSnapshot } from '@uno-chess/protocol'

export function buildDeck(rules: RuleSnapshot): CardInstance[] {
  const cards: CardInstance[] = []
  for (const definition of rules.cards.filter((card) => card.enabled)) {
    const colors: Array<CardColor | null> = definition.colors.length > 0 ? definition.colors : [null]
    for (const color of colors) {
      for (let copy = 0; copy < definition.copies; copy += 1) {
        cards.push({ id: `${definition.kind}:${color ?? 'wild'}:${copy}`, kind: definition.kind, color })
      }
    }
  }
  return cards
}
