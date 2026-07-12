import { z } from 'zod'
import type { RuleSnapshot } from '@uno-chess/protocol'

const CardColorSchema = z.enum(['red', 'yellow', 'green', 'blue'])
const PieceKindSchema = z.enum(['p', 'n', 'b', 'r', 'q'])

const EffectOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start-action'), budget: z.union([z.literal(1), z.literal(2), z.literal(3)]), minimumMoves: z.union([z.literal(0), z.literal(1)]) }).strict(),
  z.object({ type: z.literal('set-status'), target: z.literal('opponent'), status: z.literal('sealed'), turns: z.literal(1) }).strict(),
  z.object({ type: z.literal('swap-hands') }).strict(),
  z.object({ type: z.literal('swap-army-controllers') }).strict(),
  z.object({ type: z.literal('request-reinforcement'), maximumPieces: z.union([z.literal(1), z.literal(2)]) }).strict(),
  z.object({ type: z.literal('request-wild-color') }).strict(),
  z.object({ type: z.literal('draw-cards'), target: z.enum(['self', 'opponent']), count: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('end-turn') }).strict(),
])

const CardDefinitionSchema = z.object({
  kind: z.string().min(1),
  displayNameKey: z.string().min(1),
  matchKey: z.string().min(1),
  category: z.enum(['action', 'function']),
  enabled: z.boolean(),
  colors: z.array(CardColorSchema),
  copies: z.number().int().nonnegative(),
  program: z.array(EffectOperationSchema).min(1),
}).strict()

const RuleSnapshotBaseSchema = z.object({
  schemaVersion: z.literal(1),
  presetId: z.string().min(1),
  presetVersion: z.literal(1),
  cardCatalogVersion: z.literal(1),
  hand: z.object({
    startingSize: z.number().int().positive(),
    maximumSize: z.number().int().positive(),
    drawPerTurn: z.number().int().positive(),
  }).strict(),
  matching: z.object({
    byColor: z.boolean(),
    byMatchKey: z.boolean(),
    wildCardKinds: z.array(z.string().min(1)),
    wildChoosesColor: z.boolean(),
  }).strict(),
  cards: z.array(CardDefinitionSchema).min(1),
  reinforce: z.object({
    maximumPieces: z.number().int().positive(),
    allowedPieceKinds: z.array(PieceKindSchema).min(1),
    mode: z.enum(['tactical-own-half', 'classic-start-square', 'chaos-anywhere']),
  }).strict(),
  chess: z.object({
    checkInterruptsAction: z.boolean(),
    repetition: z.boolean(),
    halfmoveLimit: z.number().int().positive(),
    insufficientMaterial: z.boolean(),
  }).strict(),
  timing: z.object({
    turnSeconds: z.number().int().positive().nullable(),
    disconnectGraceSeconds: z.number().int().nonnegative(),
    disconnectExpiry: z.literal('forfeit'),
  }).strict(),
}).strict()

export const RuleSnapshotSchema = RuleSnapshotBaseSchema.superRefine((rules, context) => {
  const issue = (message: string, path: Array<string | number>) => {
    context.addIssue({ code: 'custom', message, path })
  }
  const kinds = rules.cards.map((card) => card.kind)
  if (new Set(kinds).size !== kinds.length) issue('CARD_KIND_DUPLICATE', ['cards'])
  if (rules.hand.maximumSize < rules.hand.startingSize) {
    issue('HAND_MAXIMUM_BELOW_STARTING_SIZE', ['hand', 'maximumSize'])
  }
  if (rules.matching.byColor && !rules.cards.some((card) => card.enabled && card.colors.length > 0 && card.copies > 0)) {
    issue('COLOR_MATCHING_WITHOUT_COLORED_CARD', ['matching', 'byColor'])
  }
  if (new Set(rules.reinforce.allowedPieceKinds).size !== rules.reinforce.allowedPieceKinds.length) {
    issue('REINFORCE_PIECE_KIND_DUPLICATE', ['reinforce', 'allowedPieceKinds'])
  }

  for (const wildKind of rules.matching.wildCardKinds) {
    const wild = rules.cards.find((card) => card.kind === wildKind)
    if (!wild || !wild.enabled || wild.colors.length > 0) {
      issue('INVALID_WILD_CARD_KIND', ['matching', 'wildCardKinds'])
    }
  }

  for (const [index, card] of rules.cards.entries()) {
    const actionOperations = card.program.filter((operation) => operation.type === 'start-action')
    if (card.category === 'action' && (card.program.length !== 1 || actionOperations.length !== 1)) {
      issue('ACTION_PROGRAM_INVALID', ['cards', index, 'program'])
    }
    if (card.category === 'function' && !['end-turn', 'start-action'].includes(card.program.at(-1)?.type ?? '')) {
      issue('FUNCTION_PROGRAM_MUST_RESOLVE_TURN', ['cards', index, 'program'])
    }
    if (new Set(card.colors).size !== card.colors.length) {
      issue('CARD_COLOR_DUPLICATE', ['cards', index, 'colors'])
    }
  }
})

export function parseRuleSnapshot(input: unknown): RuleSnapshot {
  return RuleSnapshotSchema.parse(input) as RuleSnapshot
}
