import type { CardColor } from '@uno-chess/protocol'
import { parseRuleSnapshot } from './schema.js'

const standardColors: CardColor[] = ['red', 'yellow', 'green', 'blue']

export const defaultRules = parseRuleSnapshot({
  schemaVersion: 1,
  presetId: 'standard-v1',
  presetVersion: 1,
  cardCatalogVersion: 1,
  hand: { startingSize: 3, maximumSize: 5, drawPerTurn: 1 },
  matching: { byColor: true, byMatchKey: true, wildCardKinds: ['betray'], wildChoosesColor: true },
  cards: [
    { kind: 'action-2', displayNameKey: 'card.action2', matchKey: 'action-2', category: 'action', enabled: true, colors: standardColors, copies: 3, program: [{ type: 'start-action', budget: 2, minimumMoves: 1 }] },
    { kind: 'action-3', displayNameKey: 'card.action3', matchKey: 'action-3', category: 'action', enabled: true, colors: standardColors, copies: 2, program: [{ type: 'start-action', budget: 3, minimumMoves: 1 }] },
    { kind: 'reinforce-1', displayNameKey: 'card.reinforce1', matchKey: 'reinforce', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'request-reinforcement', maximumPieces: 1 }, { type: 'end-turn' }] },
    { kind: 'reinforce', displayNameKey: 'card.reinforce2', matchKey: 'reinforce', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'request-reinforcement', maximumPieces: 2 }, { type: 'end-turn' }] },
    { kind: 'seal', displayNameKey: 'card.seal', matchKey: 'seal', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'set-status', target: 'opponent', status: 'sealed', turns: 1 }, { type: 'start-action', budget: 1, minimumMoves: 0 }] },
    { kind: 'reverse', displayNameKey: 'card.reverse', matchKey: 'reverse', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'swap-hands' }, { type: 'end-turn' }] },
    { kind: 'betray', displayNameKey: 'card.betray', matchKey: 'betray', category: 'function', enabled: true, colors: [], copies: 2, program: [{ type: 'swap-army-controllers' }, { type: 'request-wild-color' }, { type: 'end-turn' }] },
  ],
  reinforce: { maximumPieces: 2, allowedPieceKinds: ['p', 'n', 'b', 'r', 'q'], mode: 'tactical-own-half' },
  chess: { checkInterruptsAction: true, repetition: true, halfmoveLimit: 100, insufficientMaterial: false },
  timing: { turnSeconds: null, disconnectGraceSeconds: 60, disconnectExpiry: 'forfeit' },
})
