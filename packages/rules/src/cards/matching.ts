import type { CardInstance, DiscardFace, RuleSnapshot } from '@uno-chess/protocol'

export function canPlayCard(card: CardInstance, top: DiscardFace, rules: RuleSnapshot): boolean {
  if (rules.matching.wildCardKinds.includes(card.kind)) return true
  const cardDefinition = rules.cards.find((definition) => definition.kind === card.kind)
  const topDefinition = rules.cards.find((definition) => definition.kind === top.kind)
  if (!cardDefinition || !topDefinition) return false

  const colorMatches = rules.matching.byColor && card.color !== null && card.color === top.color
  const faceMatches = rules.matching.byMatchKey && cardDefinition.matchKey === topDefinition.matchKey
  return colorMatches || faceMatches
}
