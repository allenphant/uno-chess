import type { CardKind, EffectOperationSpec, RuleSnapshot } from '@uno-chess/protocol'

export function programFor(rules: RuleSnapshot, kind: CardKind): EffectOperationSpec[] {
  const definition = rules.cards.find((card) => card.kind === kind)
  if (!definition) throw new Error('UNKNOWN_CARD_KIND')
  return definition.program
}
