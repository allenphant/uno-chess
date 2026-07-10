# Rules Core and Local Game Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, data-driven UNO Chess rules engine and a responsive two-player local web client that exercises every first-release card and chess interaction without networking.

**Architecture:** Use an npm-workspace monorepo. `@uno-chess/protocol` owns serializable domain contracts, `@uno-chess/rules` is a pure command reducer plus read-only projections, and `@uno-chess/web` renders a React client. chess.js validates one standard chess move at a time; our engine owns player/army control, multi-move turns, persistent en-passant windows, cards, outcomes, and replay events.

**Tech Stack:** Node.js 24 LTS, npm 11 workspaces, TypeScript strict mode, React, Vite, chess.js, Zod, Vitest, Testing Library, Playwright.

## Global Constraints

- Product source: `docs/superpowers/specs/2026-07-10-uno-chess-online-game-design.md`.
- Execute this plan before the PvP, tutorial, and AI plans.
- Use `npm.cmd`, not `npm`, in this Windows PowerShell workspace because script execution policy blocks `npm.ps1`.
- Keep `@uno-chess/rules` pure: no clock reads, random globals, database calls, sockets, React state, or mutation of the input state.
- Store the resolved `RuleSnapshot`, seed, and ordered domain events with every game. Never reconstruct a historical game from a newer preset.
- All card/effect identities are stable string IDs. UI labels are presentation data and may change without invalidating replays.
- chess.js is an adapter for a single army move only. Do not use its normal alternating-turn game-over result as UNO Chess truth.
- Every behavior change starts with a failing test. After each task, run its focused tests and the whole affected workspace before committing.

## Target File Map

```text
package.json
package-lock.json
tsconfig.base.json
playwright.config.ts
apps/web/
  package.json
  index.html
  src/App.tsx
  src/game/LocalGamePage.tsx
  src/game/useLocalGame.ts
  src/components/ChessBoard.tsx
  src/components/CardHand.tsx
  src/components/TurnPanel.tsx
  src/styles/game.css
  src/test/setup.ts
packages/protocol/
  package.json
  src/domain.ts
  src/intents.ts
  src/events.ts
  src/index.ts
packages/rules/
  package.json
  src/ruleset/schema.ts
  src/ruleset/default-preset.ts
  src/ruleset/preset-catalog.ts
  src/cards/deck.ts
  src/cards/matching.ts
  src/cards/effects.ts
  src/chess/adapter.ts
  src/chess/en-passant.ts
  src/game/create-game.ts
  src/game/legal-intents.ts
  src/game/reducer.ts
  src/game/outcome.ts
  src/game/projection.ts
  src/game/replay.ts
  src/testing/build-state.ts
e2e/local-game.spec.ts
```

---

### Task 1: Scaffold the strict TypeScript workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/rules/package.json`
- Create: `packages/rules/tsconfig.json`
- Create: `packages/rules/src/smoke.test.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`

- [ ] **Write the failing workspace smoke test**

```ts
// packages/rules/src/smoke.test.ts
import { describe, expect, it } from 'vitest'
import { protocolVersion } from '@uno-chess/protocol'

describe('workspace', () => {
  it('links local packages through npm workspaces', () => {
    expect(protocolVersion).toBe(1)
  })
})
```

- [ ] **Run the test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run`

Expected: failure because the workspace packages and `protocolVersion` do not exist.

- [ ] **Create root workspace configuration**

```json
{
  "name": "uno-chess",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=24.14.0 <25" },
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present -- --run",
    "test:e2e": "playwright test",
    "dev:web": "npm run dev --workspace @uno-chess/web"
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

```text
# .gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.env
.env.local
```

- [ ] **Create the three package manifests and minimal exports**

```json
// packages/protocol/package.json
{
  "name": "@uno-chess/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

```json
// packages/rules/package.json
{
  "name": "@uno-chess/rules",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@uno-chess/protocol": "0.0.0" },
  "scripts": {
    "test": "vitest --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@uno-chess/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@uno-chess/protocol": "0.0.0",
    "@uno-chess/rules": "0.0.0",
    "react": "latest",
    "react-dom": "latest"
  },
  "scripts": {
    "dev": "vite",
    "test": "vitest --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build"
  }
}
```

```json
// packages/protocol/tsconfig.json and packages/rules/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": true },
  "include": ["src"]
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

```ts
// packages/protocol/src/index.ts
export const protocolVersion = 1 as const
```

```html
<!-- apps/web/index.html -->
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

```tsx
// apps/web/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
```

```tsx
// apps/web/src/App.tsx
export function App() {
  return <main><h1>UNO Chess</h1></main>
}
```

- [ ] **Install and lock dependencies**

Run:

```powershell
npm.cmd install
npm.cmd install --save-dev typescript vitest @playwright/test
npm.cmd install chess.js zod --workspace @uno-chess/rules
npm.cmd install zod --workspace @uno-chess/protocol
npm.cmd install --save-dev vite @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @types/react @types/react-dom --workspace @uno-chess/web
```

Expected: `package-lock.json` is created and npm reports zero install errors.

- [ ] **Run tests and type checking to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: one smoke test passes and all three workspaces type-check.

- [ ] **Commit**

```powershell
git add package.json package-lock.json tsconfig.base.json .gitignore apps packages
git commit -m "chore: scaffold UNO chess workspace"
```

---

### Task 2: Define serializable contracts and a versioned default ruleset

**Files:**
- Create: `packages/protocol/src/domain.ts`
- Create: `packages/protocol/src/intents.ts`
- Create: `packages/protocol/src/events.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/rules/src/ruleset/schema.ts`
- Create: `packages/rules/src/ruleset/default-preset.ts`
- Create: `packages/rules/src/ruleset/preset-catalog.ts`
- Create: `packages/rules/src/cards/deck.ts`
- Create: `packages/rules/src/ruleset/default-preset.test.ts`

- [ ] **Write failing contract and deck tests**

```ts
// packages/rules/src/ruleset/default-preset.test.ts
import { describe, expect, it } from 'vitest'
import { buildDeck, defaultRules, resolveRuleSnapshot } from '../index.js'

describe('default rules v1', () => {
  it('contains the approved 34-card distribution and no action-1 card', () => {
    const deck = buildDeck(defaultRules)
    expect(deck).toHaveLength(34)
    expect(deck.filter((card) => card.kind === 'action-2')).toHaveLength(12)
    expect(deck.filter((card) => card.kind === 'action-3')).toHaveLength(8)
    expect(deck.filter((card) => card.kind === 'reinforce')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'seal')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'reverse')).toHaveLength(4)
    expect(deck.filter((card) => card.kind === 'betray')).toHaveLength(2)
    expect(deck.some((card) => card.kind === 'action-1')).toBe(false)
  })

  it('round-trips through the runtime schema', () => {
    expect(defaultRules.schemaVersion).toBe(1)
    expect(defaultRules.presetId).toBe('standard-v1')
    expect(defaultRules.reinforce.mode).toBe('tactical-own-half')
  })

  it('resolves only whitelisted friend-room overrides into a full snapshot', () => {
    const snapshot = resolveRuleSnapshot('standard-v1', { 'reinforce.mode': 'chaos-anywhere' })
    expect(snapshot.reinforce.mode).toBe('chaos-anywhere')
    expect(() => resolveRuleSnapshot('standard-v1', { schemaVersion: 99 })).toThrow('OVERRIDE_NOT_ALLOWED')
  })
})
```

- [ ] **Run focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/ruleset/default-preset.test.ts --run`

Expected: failure because `buildDeck` and `defaultRules` are not exported.

- [ ] **Add stable domain types**

```ts
// packages/protocol/src/domain.ts
export type PlayerId = string
export type ArmyColor = 'white' | 'black'
export type CardColor = 'red' | 'yellow' | 'green' | 'blue'
export const coreCardKinds = ['action-2', 'action-3', 'reinforce', 'seal', 'reverse', 'betray'] as const
export type CoreCardKind = typeof coreCardKinds[number]
export type CardKind = string
export type CardId = string
export type Square = `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${1|2|3|4|5|6|7|8}`

export interface CardInstance {
  id: CardId
  kind: CardKind
  color: CardColor | null
}

export type EffectOperationSpec =
  | { type: 'start-action'; budget: 2 | 3 }
  | { type: 'set-status'; target: 'opponent'; status: 'sealed'; turns: 1 }
  | { type: 'swap-hands' }
  | { type: 'swap-army-controllers' }
  | { type: 'request-reinforcement' }
  | { type: 'request-wild-color' }
  | { type: 'draw-cards'; target: 'self' | 'opponent'; count: number }
  | { type: 'end-turn' }

export interface CardDefinitionSnapshot {
  kind: CardKind
  displayNameKey: string
  matchKey: string
  category: 'action' | 'function'
  enabled: boolean
  colors: CardColor[]
  copies: number
  program: EffectOperationSpec[]
}

export interface RuleSnapshot {
  schemaVersion: 1
  presetId: string
  presetVersion: 1
  cardCatalogVersion: 1
  hand: { startingSize: number; maximumSize: number; drawPerTurn: number }
  matching: { byColor: boolean; byMatchKey: boolean; wildCardKinds: CardKind[]; wildChoosesColor: boolean }
  cards: CardDefinitionSnapshot[]
  reinforce: { maximumPieces: number; allowedPieceKinds: Array<'p'|'n'|'b'|'r'|'q'>; mode: 'tactical-own-half' | 'classic-start-square' | 'chaos-anywhere' }
  chess: { checkInterruptsAction: boolean; repetition: boolean; halfmoveLimit: number; insufficientMaterial: boolean }
  timing: { turnSeconds: number | null; disconnectGraceSeconds: number; disconnectExpiry: 'forfeit' }
}
```

For a definition with colors, `copies` means copies per listed color; for a definition with an empty color list, it means total wild copies. This makes the default five colored faces total 32 cards and Betray total two.

```ts
// packages/protocol/src/intents.ts
import type { ArmyColor, CardColor, CardId, PlayerId, Square } from './domain.js'

export type GameIntent =
  | { type: 'draw-for-turn'; playerId: PlayerId; intentId: string }
  | { type: 'discard-overflow'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'basic-move'; playerId: PlayerId; intentId: string; from: Square; to: Square; promotion?: 'q'|'r'|'b'|'n' }
  | { type: 'play-action-card'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'action-move'; playerId: PlayerId; intentId: string; from: Square; to: Square; promotion?: 'q'|'r'|'b'|'n' }
  | { type: 'finish-action-card'; playerId: PlayerId; intentId: string }
  | { type: 'play-function-card'; playerId: PlayerId; intentId: string; cardId: CardId }
  | { type: 'choose-reinforcement'; playerId: PlayerId; intentId: string; capturedPieceIds: string[]; squares: Square[] }
  | { type: 'choose-wild-color'; playerId: PlayerId; intentId: string; color: CardColor }
```

- [ ] **Implement the Zod snapshot schema and default preset**

```ts
// packages/rules/src/ruleset/default-preset.ts
import type { RuleSnapshot } from '@uno-chess/protocol'

const standardColors: Array<'red'|'yellow'|'green'|'blue'> = ['red', 'yellow', 'green', 'blue']

export const defaultRules = {
  schemaVersion: 1,
  presetId: 'standard-v1',
  presetVersion: 1,
  cardCatalogVersion: 1,
  hand: { startingSize: 3, maximumSize: 5, drawPerTurn: 1 },
  matching: { byColor: true, byMatchKey: true, wildCardKinds: ['betray'], wildChoosesColor: true },
  cards: [
    { kind: 'action-2', displayNameKey: 'card.action2', matchKey: 'action-2', category: 'action', enabled: true, colors: standardColors, copies: 3, program: [{ type: 'start-action', budget: 2 }] },
    { kind: 'action-3', displayNameKey: 'card.action3', matchKey: 'action-3', category: 'action', enabled: true, colors: standardColors, copies: 2, program: [{ type: 'start-action', budget: 3 }] },
    { kind: 'reinforce', displayNameKey: 'card.reinforce', matchKey: 'reinforce', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'request-reinforcement' }, { type: 'end-turn' }] },
    { kind: 'seal', displayNameKey: 'card.seal', matchKey: 'seal', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'set-status', target: 'opponent', status: 'sealed', turns: 1 }, { type: 'end-turn' }] },
    { kind: 'reverse', displayNameKey: 'card.reverse', matchKey: 'reverse', category: 'function', enabled: true, colors: standardColors, copies: 1, program: [{ type: 'swap-hands' }, { type: 'end-turn' }] },
    { kind: 'betray', displayNameKey: 'card.betray', matchKey: 'betray', category: 'function', enabled: true, colors: [], copies: 2, program: [{ type: 'swap-army-controllers' }, { type: 'request-wild-color' }, { type: 'end-turn' }] },
  ],
  reinforce: { maximumPieces: 2, allowedPieceKinds: ['p','n','b','r','q'], mode: 'tactical-own-half' },
  chess: { checkInterruptsAction: true, repetition: true, halfmoveLimit: 100, insufficientMaterial: false },
  timing: { turnSeconds: null, disconnectGraceSeconds: 60, disconnectExpiry: 'forfeit' },
} satisfies RuleSnapshot
```

```ts
// packages/rules/src/ruleset/preset-catalog.ts
export const standardPreset = {
  id: 'standard-v1',
  version: 1,
  snapshot: defaultRules,
  friendOverridePaths: [
    'hand.startingSize', 'hand.maximumSize', 'hand.drawPerTurn',
    'matching.byColor', 'matching.byMatchKey',
    'cards.*.enabled', 'cards.*.colors', 'cards.*.copies',
    'reinforce.maximumPieces', 'reinforce.allowedPieceKinds', 'reinforce.mode',
    'chess.checkInterruptsAction', 'chess.repetition', 'chess.halfmoveLimit',
    'timing.turnSeconds', 'timing.disconnectGraceSeconds',
  ],
} as const
```

`resolveRuleSnapshot` loads a named/versioned preset, applies only these typed paths, runs full cross-field validation, deep-clones/freezes the result, and returns the complete snapshot. Adding an official mode means adding another versioned preset, not branching in the reducer or UI.

```ts
// packages/rules/src/cards/deck.ts
import type { CardColor, CardInstance, RuleSnapshot } from '@uno-chess/protocol'

export function buildDeck(rules: RuleSnapshot): CardInstance[] {
  const cards: CardInstance[] = []
  for (const definition of rules.cards.filter((card) => card.enabled)) {
    const cardColors: Array<CardColor | null> = definition.colors.length > 0 ? definition.colors : [null]
    for (const color of cardColors) {
      for (let copy = 0; copy < definition.copies; copy += 1) {
        cards.push({ id: `${definition.kind}:${color ?? 'wild'}:${copy}`, kind: definition.kind, color })
      }
    }
  }
  return cards
}
```

- [ ] **Export contracts and validate the preset at module load**

`packages/rules/src/ruleset/schema.ts` must use Zod to reject unknown fields, duplicate card kinds, empty/invalid programs, invalid counts, unsupported schema/catalog versions, and `halfmoveLimit < 1`. Cross-field validation must reject color matching with no enabled colored cards, wild kinds that are absent/colored, a maximum hand below starting hand size, Reinforce without any permitted piece kind, action categories without exactly one `start-action`, and function programs that do not end the turn. Validate operation arguments and require `end-turn` as the final operation for function-card programs. `packages/protocol/src/index.ts` and `packages/rules/src/index.ts` must export only public contracts and functions.

```ts
// packages/rules/src/index.ts
export { buildDeck } from './cards/deck.js'
export { defaultRules } from './ruleset/default-preset.js'
export { resolveRuleSnapshot, standardPreset } from './ruleset/preset-catalog.js'
export { RuleSnapshotSchema } from './ruleset/schema.js'
```

- [ ] **Run tests and type checking to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: the deck has 34 cards, schema tests pass, and there are no TypeScript errors.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: define versioned UNO chess rules"
```

---

### Task 3: Add deterministic game creation and single-move chess legality

**Files:**
- Create: `packages/rules/src/random/seeded.ts`
- Create: `packages/rules/src/chess/adapter.ts`
- Create: `packages/rules/src/game/create-game.ts`
- Create: `packages/rules/src/testing/build-state.ts`
- Create: `packages/rules/src/chess/adapter.test.ts`
- Create: `packages/rules/src/game/create-game.test.ts`
- Modify: `packages/protocol/src/domain.ts`
- Modify: `packages/rules/src/index.ts`

- [ ] **Write failing determinism and legality tests**

```ts
// packages/rules/src/game/create-game.test.ts
import { describe, expect, it } from 'vitest'
import { createGame, defaultRules } from '../index.js'

describe('createGame', () => {
  it('deals identical hands for the same seed', () => {
    const first = createGame({ gameId: 'g1', playerIds: ['p1', 'p2'], rules: defaultRules, seed: 'seed-7' })
    const second = createGame({ gameId: 'g1', playerIds: ['p1', 'p2'], rules: defaultRules, seed: 'seed-7' })
    expect(first.players).toEqual(second.players)
    expect(first.drawPile).toEqual(second.drawPile)
  })

  it('uses a non-wild initial discard without resolving its program', () => {
    const game = createGame({ gameId: 'g2', playerIds: ['p1', 'p2'], rules: defaultRules, seed: 'initial-discard' })
    expect(game.discardPile[0]?.kind).not.toBe('betray')
    expect(game.controllerByArmy).toEqual({ white: 'p1', black: 'p2' })
    expect(game.players.p2.statuses).toEqual([])
  })
})
```

```ts
// packages/rules/src/chess/adapter.test.ts
import { describe, expect, it } from 'vitest'
import { legalChessMoves } from '../index.js'

describe('legalChessMoves', () => {
  it('allows standard opening moves for the requested army', () => {
    const moves = legalChessMoves({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      army: 'white',
      enPassantTarget: null,
    })
    expect(moves).toContainEqual(expect.objectContaining({ from: 'e2', to: 'e4' }))
    expect(moves).not.toContainEqual(expect.objectContaining({ from: 'e7', to: 'e5' }))
  })
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/game/create-game.test.ts src/chess/adapter.test.ts --run`

Expected: failures because `createGame` and `legalChessMoves` do not exist.

- [ ] **Define complete serializable game state**

Add `PieceRecord`, `BoardState`, `PlayerState`, `TurnState`, `DiscardFace`, `GameStatus`, and `GameState` to `packages/protocol/src/domain.ts`. Use explicit records instead of class instances.

```ts
export interface GameState {
  gameId: string
  rules: RuleSnapshot
  seed: string
  rngCursor: number
  board: BoardState
  playerOrder: [PlayerId, PlayerId]
  players: Record<PlayerId, PlayerState>
  controllerByArmy: Record<ArmyColor, PlayerId>
  activePlayerId: PlayerId
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  discardFace: { kind: CardKind; color: CardColor } | null
  turn: TurnState
  status: GameStatus
  eventSequence: number
  positionOccurrences: Record<string, number>
  acceptedIntentIds: string[]
}
```

- [ ] **Implement seed-based shuffle with an explicit cursor**

```ts
// packages/rules/src/random/seeded.ts
export function hashSeed(seed: string): number {
  let value = 2166136261
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

export function nextRandom(seed: string, cursor: number): number {
  let value = (hashSeed(seed) + Math.imul(cursor + 1, 0x9e3779b1)) >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 0x1_0000_0000
}
```

Use Fisher-Yates with `nextRandom(seed, cursor)` and store the final cursor. The same seed and rules snapshot must create byte-equivalent piles and hands.

- [ ] **Implement the single-army chess adapter**

```ts
// packages/rules/src/chess/adapter.ts
import { Chess } from 'chess.js'
import type { ArmyColor, Square } from '@uno-chess/protocol'

export interface LegalChessMove {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
  san: string
  captured?: string
}

export function fenForArmy(fen: string, army: ArmyColor, enPassantTarget: Square | null): string {
  const [placement, , castling, , halfmove, fullmove] = fen.split(' ')
  if (!placement || !castling || !halfmove || !fullmove) throw new Error('INVALID_FEN')
  return [placement, army === 'white' ? 'w' : 'b', castling, enPassantTarget ?? '-', halfmove, fullmove].join(' ')
}

export function legalChessMoves(input: {
  fen: string
  army: ArmyColor
  enPassantTarget: Square | null
}): LegalChessMove[] {
  const chess = new Chess(fenForArmy(input.fen, input.army, input.enPassantTarget))
  return chess.moves({ verbose: true }).map((move) => ({
    from: move.from as Square,
    to: move.to as Square,
    ...(move.promotion ? { promotion: move.promotion as 'q'|'r'|'b'|'n' } : {}),
    san: move.san,
    ...(move.captured ? { captured: move.captured } : {}),
  }))
}
```

Also add `applyChessMove` and `isArmyInCheck`; both rebuild a chess.js instance for the requested army and return plain data. Never leak the mutable `Chess` instance.

- [ ] **Implement `createGame`**

It must clone and schema-validate the snapshot, build/shuffle the 34-card deck, deal three cards to each player, choose a non-wild initial discard, suppress that discard's effect, assign player 1 to white/player 2 to black, and enter `turn-start` before the first draw.

- [ ] **Run tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: deterministic creation and chess adapter suites pass.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: create deterministic chess card games"
```

---

### Task 4: Implement turn draw, UNO matching, and the basic no-card move

**Files:**
- Create: `packages/rules/src/cards/matching.ts`
- Create: `packages/rules/src/game/legal-intents.ts`
- Create: `packages/rules/src/game/reducer.ts`
- Create: `packages/rules/src/game/reducer-turn.test.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/rules/src/index.ts`

- [ ] **Write failing turn tests**

```ts
// packages/rules/src/game/reducer-turn.test.ts
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState, canPlayCard, defaultRules } from '../index.js'

describe('turn flow', () => {
  it('draws exactly once and requires the player to choose an overflow discard above five', () => {
    const state = buildTestState({ activeHandSize: 5, phase: 'turn-start' })
    const drawn = applyIntent(state, { type: 'draw-for-turn', playerId: 'p1', intentId: 'i1' })
    expect(drawn.state.players.p1.hand).toHaveLength(6)
    expect(drawn.state.turn.phase).toBe('await-overflow-discard')
    const result = applyIntent(drawn.state, {
      type: 'discard-overflow', playerId: 'p1', intentId: 'i1b', cardId: drawn.state.players.p1.hand[0]!.id,
    })
    expect(result.state.players.p1.hand).toHaveLength(5)
    expect(result.events.map((event) => event.type)).toEqual(['card-overflow-discarded', 'turn-action-opened'])
  })

  it('matches colored cards by color or face and wild betrayal unconditionally', () => {
    expect(canPlayCard({ id: 'a', kind: 'action-2', color: 'red' }, { kind: 'action-3', color: 'red' }, defaultRules)).toBe(true)
    expect(canPlayCard({ id: 'b', kind: 'action-2', color: 'blue' }, { kind: 'action-2', color: 'red' }, defaultRules)).toBe(true)
    expect(canPlayCard({ id: 'c', kind: 'seal', color: 'blue' }, { kind: 'reverse', color: 'red' }, defaultRules)).toBe(false)
    expect(canPlayCard({ id: 'd', kind: 'betray', color: null }, { kind: 'reverse', color: 'red' }, defaultRules)).toBe(true)
  })

  it('allows one legal move without playing a card and ends the turn', () => {
    const state = buildTestState({ phase: 'await-action' })
    const result = applyIntent(state, { type: 'basic-move', playerId: 'p1', intentId: 'i2', from: 'e2', to: 'e4' })
    expect(result.state.activePlayerId).toBe('p2')
    expect(result.events.at(-1)?.type).toBe('turn-ended')
  })
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/game/reducer-turn.test.ts --run`

Expected: failure because matching, reducer, and test builders do not exist.

- [ ] **Implement UNO matching as a total function**

```ts
// packages/rules/src/cards/matching.ts
import type { CardInstance, CardKind, CardColor, RuleSnapshot } from '@uno-chess/protocol'

export interface DiscardFace { kind: CardKind; color: CardColor }

export function canPlayCard(card: CardInstance, top: DiscardFace, rules: RuleSnapshot): boolean {
  if (rules.matching.wildCardKinds.includes(card.kind)) return true
  const cardDefinition = rules.cards.find((definition) => definition.kind === card.kind)
  const topDefinition = rules.cards.find((definition) => definition.kind === top.kind)
  if (!cardDefinition || !topDefinition) return false
  const colorMatches = rules.matching.byColor && card.color !== null && card.color === top.color
  const faceMatches = rules.matching.byMatchKey && cardDefinition.matchKey === topDefinition.matchKey
  return colorMatches || faceMatches
}
```

- [ ] **Implement the reducer boundary and idempotency**

```ts
// packages/rules/src/game/reducer.ts
import type { GameEvent, GameIntent, GameState } from '@uno-chess/protocol'

export type ApplyResult = { state: GameState; events: GameEvent[] }

export function applyIntent(input: GameState, intent: GameIntent): ApplyResult {
  if (input.acceptedIntentIds.includes(intent.intentId)) return { state: input, events: [] }
  if (intent.playerId !== input.activePlayerId) throw new Error('NOT_ACTIVE_PLAYER')
  const state = structuredClone(input)
  const events: GameEvent[] = []
  reduceValidatedIntent(state, intent, events)
  state.acceptedIntentIds = [...state.acceptedIntentIds.slice(-127), intent.intentId]
  return { state, events }
}
```

`reduceValidatedIntent` must enforce phase-specific intent types. `draw-for-turn` draws once even under Seal. If the hand exceeds the configured limit, enter `await-overflow-discard` and accept only a player-selected `discard-overflow`; otherwise open the action phase immediately. `basic-move` is legal only from `await-action`, uses the currently controlled army, emits the move/capture/promotion events, and ends the turn.

- [ ] **Make event contracts exhaustive**

Define `GameEvent` as a discriminated union including `game-created`, `turn-started`, `card-drawn`, `card-overflow-discarded`, `turn-action-opened`, `card-played`, `piece-moved`, `piece-captured`, `piece-promoted`, `check-given`, `turn-ended`, and `game-ended`. Each event includes `sequence`, `gameId`, and enough payload to rebuild state without UI inference.

- [ ] **Run focused and workspace tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: turn-flow, matching, prior tests, and type checking pass.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: add draw and basic turn flow"
```

---

### Task 5: Implement Action 2/3, check interruption, and special chess windows

**Files:**
- Create: `packages/rules/src/chess/en-passant.ts`
- Create: `packages/rules/src/game/action-cards.test.ts`
- Create: `packages/rules/src/game/chess-specials.test.ts`
- Modify: `packages/rules/src/game/reducer.ts`
- Modify: `packages/rules/src/game/legal-intents.ts`
- Modify: `packages/protocol/src/domain.ts`

- [ ] **Write failing multi-action tests**

```ts
// packages/rules/src/game/action-cards.test.ts
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('action cards', () => {
  it('permits one to N moves and lets the player stop early', () => {
    const opened = applyIntent(buildTestState({ playableCard: 'action-3' }), {
      type: 'play-action-card', playerId: 'p1', intentId: 'a1', cardId: 'test-card',
    })
    const moved = applyIntent(opened.state, {
      type: 'action-move', playerId: 'p1', intentId: 'a2', from: 'e2', to: 'e4',
    })
    const stopped = applyIntent(moved.state, {
      type: 'finish-action-card', playerId: 'p1', intentId: 'a3',
    })
    expect(stopped.state.activePlayerId).toBe('p2')
  })

  it('ends remaining moves immediately when any move gives check', () => {
    const state = buildTestState({ fixture: 'action-two-one-move-to-check' })
    const result = applyIntent(state, {
      type: 'action-move', playerId: 'p1', intentId: 'a4', from: 'b5', to: 'e8',
    })
    expect(result.state.activePlayerId).toBe('p2')
    expect(result.events.some((event) => event.type === 'check-given')).toBe(true)
  })
})
```

Also test that Action 2/3 is not playable when it has no legal first move, that the first move while checked must resolve the checked controlled king, and that the same or different piece may consume later action points.

- [ ] **Write failing en-passant and promotion tests**

Test these exact invariants in `chess-specials.test.ts`:

1. A double pawn advance during move one creates an en-passant window only for the opposing army.
2. That window survives the current player's remaining Action 2/3 moves.
3. It expires after the opponent's whole next turn if unused.
4. Promotion is chosen and applied on the move that reaches the back rank.
5. The promoted piece may use remaining action budget when no check was given.

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/game/action-cards.test.ts src/game/chess-specials.test.ts --run`

Expected: multi-action and special-window assertions fail.

- [ ] **Add action budget to the turn state**

```ts
export interface TurnState {
  number: number
  phase: 'turn-start' | 'await-overflow-discard' | 'await-action' | 'await-action-move' | 'await-effect-choice'
  drewCard: boolean
  playedCardId: CardId | null
  actionBudget: 0 | 2 | 3
  actionsUsed: number
  pendingEffect: null | { kind: 'reinforce'; cardId: CardId } | { kind: 'wild-color'; cardId: CardId }
}
```

Playing Action 2/3 consumes the card and sets its budget. `finish-action-card` is illegal before one move and legal after one or two moves. Reaching the budget ends the turn automatically.

- [ ] **Make check interruption a reducer invariant**

After each chess move, compute check against the opposing army. With `rules.chess.checkInterruptsAction=true`, emit `check-given` and call the same `endTurn` path used by normal completion; never leave the state in `await-action-move` after a check. With the setting false, the adapter may continue the same army using chess.js `skipValidation` for the nonstandard side-to-move FEN, but it must still generate a legal piece move, preserve both kings, forbid king capture, and keep the moving army's own king safe. Add a dedicated fixture before exposing this override in friend rooms.

- [ ] **Persist en-passant independently of normal alternation**

```ts
export interface EnPassantWindow {
  target: Square
  captureByArmy: ArmyColor
  expiresAfterTurnNumber: number
}
```

Pass the target to chess.js only when `captureByArmy` equals the army requesting legal moves. Clear it at the end of that army's whole turn unless the current move created a replacement window.

- [ ] **Run all rules tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: Action 2/3, check interruption, en-passant, promotion, and prior suites pass.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: support multi-move chess turns"
```

---

### Task 6: Implement all function-card effects as composable operations

**Files:**
- Create: `packages/rules/src/cards/effects.ts`
- Create: `packages/rules/src/cards/effects.test.ts`
- Create: `packages/rules/src/game/check-response.test.ts`
- Modify: `packages/rules/src/game/reducer.ts`
- Modify: `packages/rules/src/game/legal-intents.ts`
- Modify: `packages/protocol/src/events.ts`

- [ ] **Write failing effect tests**

```ts
// packages/rules/src/cards/effects.test.ts
import { describe, expect, it } from 'vitest'
import { applyIntent, buildTestState } from '../index.js'

describe('function cards', () => {
  it('Seal blocks card use next turn but not draw or the basic move', () => {
    const result = applyIntent(buildTestState({ playableCard: 'seal' }), {
      type: 'play-function-card', playerId: 'p1', intentId: 'f1', cardId: 'test-card',
    })
    expect(result.state.players.p2.statuses).toContainEqual({ kind: 'sealed', remainingTurns: 1 })
    expect(result.state.activePlayerId).toBe('p2')
  })

  it('Reverse swaps whole hands and ends the turn', () => {
    const state = buildTestState({ playableCard: 'reverse', p1Hand: ['reverse', 'action-2'], p2Hand: ['seal'] })
    const result = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'f2', cardId: 'test-card',
    })
    expect(result.state.players.p1.hand.map((card) => card.kind)).toEqual(['seal'])
    expect(result.state.players.p2.hand.map((card) => card.kind)).toEqual(['action-2'])
  })

  it('Betray swaps army controllers, preserves player hands, then requests a color', () => {
    const state = buildTestState({ playableCard: 'betray' })
    const result = applyIntent(state, {
      type: 'play-function-card', playerId: 'p1', intentId: 'f3', cardId: 'test-card',
    })
    expect(result.state.controllerByArmy).toEqual({ white: 'p2', black: 'p1' })
    expect(result.state.turn.pendingEffect?.kind).toBe('wild-color')
  })
})
```

Also test all three Reinforce modes, selection of one or two non-king captured pieces, rejection of zero pieces, pawn rank restrictions, occupied squares, king safety, and no restored castling rights for a revived rook.

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/cards/effects.test.ts src/game/check-response.test.ts --run`

Expected: failures for unimplemented card effects and check-response filtering.

- [ ] **Define composable effect operations**

```ts
// packages/rules/src/cards/effects.ts
import type { CardKind, EffectOperationSpec, RuleSnapshot } from '@uno-chess/protocol'

export function programFor(rules: RuleSnapshot, kind: CardKind): EffectOperationSpec[] {
  const definition = rules.cards.find((card) => card.kind === kind)
  if (!definition) throw new Error('UNKNOWN_CARD_KIND')
  return definition.program
}
```

The interpreter reads the program from the stored rule snapshot, applies operations in order, pauses on a player choice, resumes after a validated choice, and executes `end-turn` only after all choices resolve. `request-reinforcement` reads maximum, piece kinds, and placement mode from the same snapshot. Implement and unit-test the unused `draw-cards` operation against a synthetic custom card definition so a future draw-card face can be added through versioned rule data instead of a reducer branch.

- [ ] **Filter legal cards while responding to check**

For each candidate card, simulate its fully selected effect against cloned state and keep only choices that leave the active player's controlled army out of check. Seal and Reverse normally remain illegal while checked; Reinforce and Betray are legal only when their actual result resolves the check. Action 2/3 remains legal only when its first move resolves check.

- [ ] **Apply the approved function-card turn wording as behavior**

Every function program finishes the turn after resolution. If it gives check, the next player begins in check and their first legal action must resolve it. No function card grants a chess move afterward.

- [ ] **Run all rules tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

Expected: every card effect, in-check legality, and earlier rule test passes.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: implement UNO chess function cards"
```

---

### Task 7: Add hybrid outcomes, replay verification, and hidden-information projections

**Files:**
- Create: `packages/rules/src/game/outcome.ts`
- Create: `packages/rules/src/game/outcome.test.ts`
- Create: `packages/rules/src/game/replay.ts`
- Create: `packages/rules/src/game/replay.test.ts`
- Create: `packages/rules/src/game/projection.ts`
- Create: `packages/rules/src/game/projection.test.ts`
- Modify: `packages/protocol/src/domain.ts`
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/rules/src/game/reducer.ts`

- [ ] **Write failing outcome tests**

Cover these exact terminal conditions:

- Checkmate and stalemate inspect the next player's full legal turn options before their draw.
- A card that can legally resolve check prevents false checkmate.
- Threefold repetition keys include board, army controllers, hands, discard face, statuses, card piles, action phase, castling, and en-passant state.
- The 100-individual-move counter resets on pawn moves, captures, and Reinforce.
- Insufficient material is disabled while the configured deck contains Reinforce.

```ts
it('does not declare mate when a reinforcement can block check', () => {
  const state = buildTestState({ fixture: 'reinforce-only-check-response' })
  expect(evaluateOutcome(state)).toEqual({ kind: 'ongoing' })
})
```

- [ ] **Write failing replay and projection tests**

```ts
it('replays accepted intents to the same canonical state hash', () => {
  const recorded = playFixture('action-three-promotion')
  const replayed = replayGame(recorded.initial, recorded.intents)
  expect(hashGameState(replayed.state)).toBe(hashGameState(recorded.final))
})

it('never reveals an opponent hand or draw pile to a player view', () => {
  const view = projectPlayerView(buildTestState({}), 'p1')
  expect(view.opponent.hand).toEqual({ count: expect.any(Number) })
  expect(view).not.toHaveProperty('drawPile')
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/game/outcome.test.ts src/game/replay.test.ts src/game/projection.test.ts --run`

Expected: outcome, replay, and projection APIs are missing.

- [ ] **Implement canonical state keys and hybrid outcome evaluation**

```ts
export type GameOutcome =
  | { kind: 'ongoing' }
  | { kind: 'win'; winnerId: PlayerId; reason: 'checkmate' | 'resignation' | 'timeout' }
  | { kind: 'draw'; reason: 'stalemate' | 'repetition' | 'halfmove-limit' }
```

`evaluateOutcome` must call `getLegalTurnOptions` for the next player using the current hand before drawing. It may not delegate mate/stalemate directly to chess.js.

- [ ] **Implement replay and projections**

`replayGame` starts from the stored initial snapshot and seed, reapplies accepted intents, verifies event sequence and state hash after every intent, and reports the first mismatch. `projectPlayerView` returns public board/discard/events, the requesting player's full hand, the opponent hand count, and draw-pile count only.

- [ ] **Run full rule verification to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/rules`

Expected: all rule tests pass, declarations build, and TypeScript reports no errors.

- [ ] **Commit**

```powershell
git add packages/protocol packages/rules
git commit -m "feat: finalize outcomes replay and projections"
```

---

### Task 8: Build the responsive local-game React screen

**Files:**
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/game/useLocalGame.ts`
- Create: `apps/web/src/game/LocalGamePage.tsx`
- Create: `apps/web/src/components/ChessBoard.tsx`
- Create: `apps/web/src/components/CardHand.tsx`
- Create: `apps/web/src/components/TurnPanel.tsx`
- Create: `apps/web/src/styles/game.css`
- Create: `apps/web/src/game/LocalGamePage.test.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Write a failing component test for the playable local loop**

```tsx
// apps/web/src/game/LocalGamePage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LocalGamePage } from './LocalGamePage.js'

describe('LocalGamePage', () => {
  it('draws, selects a card, and exposes legal board targets', async () => {
    render(<LocalGamePage seed="component-test" />)
    await userEvent.click(screen.getByRole('button', { name: '抽牌' }))
    await userEvent.click(screen.getByRole('button', { name: /行動 2/ }))
    expect(screen.getByTestId('board-drop-zone')).toHaveAttribute('data-card-ready', 'true')
  })
})
```

- [ ] **Run component test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/game/LocalGamePage.test.tsx --run`

Expected: failure because the local page and test setup do not exist.

- [ ] **Implement a reducer-driven local controller**

```ts
// apps/web/src/game/useLocalGame.ts
import { useMemo, useReducer } from 'react'
import { applyIntent, createGame, defaultRules, projectPlayerView } from '@uno-chess/rules'
import type { GameIntent } from '@uno-chess/protocol'

export function useLocalGame(seed: string) {
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof createGame>, intent: GameIntent) => applyIntent(current, intent).state,
    undefined,
    () => createGame({ gameId: `local:${seed}`, playerIds: ['p1', 'p2'], rules: defaultRules, seed }),
  )
  const view = useMemo(() => projectPlayerView(state, state.activePlayerId), [state])
  return { state, view, dispatch }
}
```

The page must render turn/draw/check status, board, discard face, deck count, both hand counts, the active player's cards, an overflow-discard choice when required, remaining Action 2/3 budget, effect choices, and outcome. `ChessBoard` places the viewing player's currently controlled army at the bottom; Betray changes that perspective, while logical square IDs and submitted coordinates remain unchanged. Animate the perspective change unless `prefers-reduced-motion` requests an immediate swap.

- [ ] **Implement responsive board and hand layout**

```css
/* apps/web/src/styles/game.css */
.game-shell { display: grid; grid-template-columns: minmax(18rem, 72vh) minmax(16rem, 22rem); gap: 1rem; justify-content: center; }
.board { aspect-ratio: 1; display: grid; grid-template-columns: repeat(8, 1fr); touch-action: none; }
.hand { grid-column: 1 / -1; display: flex; gap: .5rem; overflow-x: auto; padding: .75rem; }
@media (max-width: 760px) {
  .game-shell { grid-template-columns: minmax(0, 1fr); }
  .turn-panel { order: -1; }
  .board { width: min(100%, calc(100dvh - 15rem)); margin-inline: auto; }
  .hand { grid-column: 1; }
}
```

Use semantic buttons for squares and cards, Unicode chess pieces for the first planar release, visible focus rings, high-contrast legal-target markers, `aria-live` for turn/check/errors, and no color-only state communication. Playable cards remain prominent; nonmatching or sealed cards use reduced contrast plus `disabled`/`aria-disabled` and cannot emit intents.

Add a component test that plays Betray, selects the wild color, verifies the controlled army and visual board order both swap, and proves a click on logical `e7` still emits `from: 'e7'` after the flip.

- [ ] **Run component tests and build to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/web -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/web`

Expected: component tests pass and Vite produces `apps/web/dist`.

- [ ] **Commit**

```powershell
git add apps/web
git commit -m "feat: add responsive local game screen"
```

---

### Task 9: Add drag/touch intent, tap fallback, and browser acceptance tests

**Files:**
- Create: `apps/web/src/input/useCardDrag.ts`
- Create: `apps/web/src/input/useCardDrag.test.tsx`
- Create: `apps/web/src/input/usePieceDrag.ts`
- Create: `apps/web/src/input/usePieceDrag.test.tsx`
- Modify: `apps/web/src/components/CardHand.tsx`
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Create: `playwright.config.ts`
- Create: `e2e/local-game.spec.ts`
- Modify: `package.json`

- [ ] **Write failing pointer-interaction tests**

```tsx
it('keeps the card in hand until the board accepts the play', async () => {
  const { result } = renderHook(() => useCardDrag({ cardId: 'c1', onCommit }))
  act(() => result.current.onPointerDown(pointerEvent(10, 10)))
  act(() => result.current.onPointerMove(pointerEvent(120, 80)))
  expect(onCommit).not.toHaveBeenCalled()
  act(() => result.current.onPointerUp(pointerEvent(120, 80, 'board-drop-zone')))
  expect(onCommit).toHaveBeenCalledWith('c1')
})
```

- [ ] **Run the interaction test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/input/useCardDrag.test.tsx --run`

Expected: failure because `useCardDrag` is missing.

- [ ] **Implement Pointer Events with one intent boundary**

`useCardDrag` must capture the pointer, render a visual ghost without mutating the game, hit-test the board drop zone on release, and call `onCommit(cardId)` once. Escape and pointer cancellation restore the card. A click/tap selects the same card and a separate “出牌” button commits it; keyboard users can focus a card and press Enter.

```ts
export interface CardDragController {
  dragging: boolean
  offset: { x: number; y: number } | null
  onPointerDown(event: React.PointerEvent): void
  onPointerMove(event: React.PointerEvent): void
  onPointerUp(event: React.PointerEvent): void
  onPointerCancel(): void
}
```

`usePieceDrag` uses the same pointer-capture/cancel rules, but starts only from a currently controlled piece and commits `{ from, to }` only on a legal target square. Clicking/tapping a source then a destination and keyboard square selection must create the identical chess intent. Add component tests proving an illegal drop restores the piece and emits no intent.

- [ ] **Write Playwright desktop and mobile acceptance coverage**

```ts
// e2e/local-game.spec.ts
import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`plays one local turn at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?seed=e2e-local')
    await page.getByRole('button', { name: '抽牌' }).click()
    await page.getByRole('button', { name: 'e2' }).dragTo(page.getByRole('button', { name: 'e4' }))
    await expect(page.getByText(/玩家 2 的回合/)).toBeVisible()
    await expect(page.getByTestId('board')).toBeInViewport()
  })
}
```

Configure Playwright's `webServer.command` as `npm.cmd run dev:web -- --host 127.0.0.1` and `baseURL` as `http://127.0.0.1:5173`.

- [ ] **Run browser tests to verify GREEN**

Run:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e -- --project=chromium
```

Expected: desktop and mobile local-turn tests pass in Chromium.

- [ ] **Commit**

```powershell
git add apps/web e2e playwright.config.ts package.json package-lock.json
git commit -m "feat: add accessible card drag interactions"
```

---

### Task 10: Run the core release gate

**Files:**
- Modify only files required by failures discovered below.

- [ ] **Write a failing deterministic replay stress test and verify RED**

Add `packages/rules/src/game/replay-stress.test.ts` with 100 seeded legal-game prefixes and assertions for replay hash equality, event-sequence continuity, and invariant safety.

Run: `npm.cmd run test --workspace @uno-chess/rules -- src/game/replay-stress.test.ts --run`

Expected: the new stress test fails before the fixture generator and invariant checks are implemented.

- [ ] **Run formatting-independent repository checks**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium
```

Expected: all commands exit 0; all rules, component, and browser tests pass.

- [ ] **Complete deterministic replay stress coverage to verify GREEN**

Add a Vitest table that plays at least 100 seeded legal-game prefixes, replays their intents, and asserts identical canonical hashes and no invariant exceptions. Keep this test under 10 seconds on the development machine.

- [ ] **Confirm plan-specific acceptance**

Manually verify at 1280×800, 390×844, and 320×568:

- A player draws one card, overflow above five is discarded, and hidden piles are not rendered.
- No-card move, Action 2, Action 3, early stop, and check interruption work.
- Reinforce, Seal, Reverse, and Betray resolve and immediately end the turn.
- Wild color selection updates the discard face.
- Check, mate/draw outcomes, promotion, castling, and en-passant fixtures behave as specified.
- Mouse drag, touch/pointer drag, tap, and keyboard routes create the same intent.

- [ ] **Commit release-gate fixes if any**

```powershell
git add apps packages e2e package.json package-lock.json playwright.config.ts
git commit -m "test: complete local game release gate"
```
