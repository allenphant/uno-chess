# Rule-Search AI Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the human PvP/tutorial first release, add fair, deterministic-under-test rule-search opponents at three difficulties, a manual AI-practice entrance, and an explicit 15-second quick-match fallback choice with separate statistics and lower configurable rewards.

**Architecture:** A pure `@uno-chess/ai` package receives only a bot observation containing its own hand plus public game information. It samples synthetic hidden information, enumerates complete legal turn plans, prunes Action 2/3 and Reinforce branches with beam search, evaluates states, and returns the best plan found within an injected budget. A server `BotController` executes one acknowledged intent at a time and safely replans or falls back if the live authoritative state differs.

**Tech Stack:** Existing TypeScript rules/protocol/server/web stack, Vitest fake clocks and deterministic seeds, worker threads or Web Workers only if profiling proves the server event loop needs isolation.

## Global Constraints

- Deferred prerequisite: ship and verify `2026-07-10-onboarding-tutorial-currency.md` first. AI is not on the first-release critical path.
- Product source: `docs/superpowers/specs/2026-07-10-rule-search-ai-design.md`.
- Do not silently replace a human. At 15 seconds, show “繼續等待” and “改與 AI 對戰”; require an explicit choice.
- Clearly label every AI match and difficulty before the game begins. Keep AI and human PvP statistics separate.
- The selector may read only the bot's hand, public board/discard/events/counts, rules snapshot, and public statuses. It may not read the actual opponent hand order/content or actual draw-pile order/content.
- The bot draws through the authoritative reducer. Once a drawn card enters its own hand, it becomes legitimate input for its search.
- Generate complete turn plans: no-card move, Action 2/3 sequence and optional early stop, or a function card plus required choices. Check interruption and function-card turn end come from the production reducer.
- All submitted AI intents must pass the same server validation as human intents. No privileged move/effect path.
- Inject seed, clock, deadline, and cancellation. Tests must not depend on CPU speed or `Math.random()`.
- On search timeout, return the best fully legal plan found. On exception or stale live state, choose a deterministic safe legal fallback; never crash or stall the match.
- Keep the evaluator and difficulty/reward tables data-driven for balance updates.

## Target File Map

```text
packages/ai/
  package.json
  tsconfig.json
  src/observation.ts
  src/determinize.ts
  src/turn-plans.ts
  src/beam.ts
  src/evaluate.ts
  src/search.ts
  src/difficulties.ts
  src/fallback.ts
  src/index.ts
apps/server/src/ai/
  BotController.ts
  BotRegistry.ts
  BotMatchService.ts
  register-ai-handlers.ts
apps/web/src/ai/
  AiPracticePage.tsx
  AiDifficultyPicker.tsx
  MatchmakingFallbackDialog.tsx
supabase/migrations/
  202607100005_ai_matches_and_rewards.sql
e2e/ai-match.spec.ts
```

---

### Task 1: Define a hidden-information-safe observation boundary

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/observation.ts`
- Create: `packages/ai/src/determinize.ts`
- Create: `packages/ai/src/observation.test.ts`
- Create: `packages/ai/src/index.ts`
- Modify: `package.json`

- [ ] **Write failing information-leak tests**

```ts
// packages/ai/src/observation.test.ts
import { describe, expect, it } from 'vitest'
import { buildBotObservation, determinize } from './index.js'

describe('bot observation', () => {
  it('is identical for full states that differ only in hidden opponent cards and draw order', () => {
    const first = hiddenVariant('variant-a')
    const second = hiddenVariant('variant-b')
    expect(buildBotObservation(first.publicView, first.publicEvents)).toEqual(
      buildBotObservation(second.publicView, second.publicEvents),
    )
  })

  it('produces the same synthetic hidden state from the same observation and seed', () => {
    const observation = buildBotObservation(hiddenVariant('variant-a').publicView, publicEvents)
    expect(determinize(observation, 'sample-1')).toEqual(determinize(observation, 'sample-1'))
  })
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/ai -- src/observation.test.ts --run`

Expected: AI workspace and observation APIs do not exist.

- [ ] **Create the package and install/link dependencies**

```json
// packages/ai/package.json
{
  "name": "@uno-chess/ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@uno-chess/protocol": "0.0.0",
    "@uno-chess/rules": "0.0.0"
  },
  "scripts": {
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

```json
// packages/ai/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": true },
  "include": ["src"]
}
```

Run: `npm.cmd install`

- [ ] **Define the observation without hidden collections**

```ts
// packages/ai/src/observation.ts
export interface BotObservation {
  gameId: string
  revision: number
  botPlayerId: string
  ownHand: CardInstance[]
  opponentHandCount: number
  drawPileCount: number
  board: BoardState
  controllerByArmy: Record<ArmyColor, PlayerId>
  activePlayerId: PlayerId
  discardFace: DiscardFace
  publicStatuses: Record<PlayerId, PlayerStatus[]>
  rules: RuleSnapshot
  publicEvents: GameEvent[]
}

export function buildBotObservation(view: PlayerView, publicEvents: GameEvent[]): BotObservation {
  return Object.freeze({
    gameId: view.gameId,
    revision: view.revision,
    botPlayerId: view.self.playerId,
    ownHand: structuredClone(view.self.hand),
    opponentHandCount: view.opponent.hand.count,
    drawPileCount: view.drawPileCount,
    board: structuredClone(view.board),
    controllerByArmy: structuredClone(view.controllerByArmy),
    activePlayerId: view.activePlayerId,
    discardFace: structuredClone(view.discardFace),
    publicStatuses: structuredClone(view.publicStatuses),
    rules: structuredClone(view.rules),
    publicEvents: structuredClone(publicEvents),
  })
}
```

The type must have no escape hatch such as `unknownFullState`. Add a compile-time test that `opponentHand` and `drawPile` are absent.

- [ ] **Determinize from public card accounting only**

Build the known multiset from the versioned deck definition, subtract the bot hand and every publicly revealed/discarded card, then seed-shuffle the remaining identities. Deal only counts to a synthetic opponent hand and draw pile. Do not accept the authoritative hidden arrays as function arguments.

- [ ] **Run tests and type checking to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/ai -- --run && npm.cmd run typecheck`

Expected: leak/determinization tests pass and the observation has no hidden fields.

- [ ] **Commit**

```powershell
git add package.json package-lock.json packages/ai
git commit -m "feat: add fair AI observation boundary"
```

---

### Task 2: Enumerate complete legal turn plans with bounded branching

**Files:**
- Create: `packages/ai/src/turn-plans.ts`
- Create: `packages/ai/src/beam.ts`
- Create: `packages/ai/src/turn-plans.test.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/rules/src/game/legal-intents.ts`

- [ ] **Write failing complete-plan tests**

```ts
it('enumerates no-card, early-stop, check-interrupted, and function-card plans', () => {
  const plans = enumerateTurnPlans(determinizedFixture('mixed-options'), { beamWidth: 12 })
  expect(plans.some((plan) => plan.label === 'basic:e2-e4')).toBe(true)
  expect(plans.some((plan) => plan.intents.at(-1)?.type === 'finish-action-card')).toBe(true)
  expect(plans.filter((plan) => plan.givesCheck).every((plan) => plan.result.activePlayerId === 'opponent')).toBe(true)
  expect(plans.some((plan) => plan.intents[0]?.type === 'play-function-card')).toBe(true)
})
```

Add fixtures for every Reinforce mode, one/two revivals, Seal, Reverse, Betray with four color choices, promotion choice, castling, en-passant, and in-check response.

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/ai -- src/turn-plans.test.ts --run`

Expected: plan enumeration is missing.

- [ ] **Expose a read-only exhaustive intent API from rules**

Add `enumerateLegalIntents(state)` to rules. It returns all legal next intents for the active phase, including concrete promotion, reinforcement-square, and wild-color choices. It must call the same validators used by `applyIntent` and must never mutate state.

- [ ] **Build plans by reducer simulation**

```ts
export interface TurnPlan {
  label: string
  intents: GameIntent[]
  result: GameState
  events: GameEvent[]
  givesCheck: boolean
}

export function enumerateTurnPlans(initial: GameState, limits: { beamWidth: number }): TurnPlan[] {
  const originPlayer = initial.activePlayerId
  return expandUntil(
    [{ state: initial, intents: [], events: [] }],
    (node) => node.state.activePlayerId !== originPlayer || node.state.status.kind !== 'active',
    limits,
  )
}
```

Every expansion calls `applyIntent`. A plan is complete only when the turn changed or the game ended. An Action 2/3 partial sequence is not a selectable result.

- [ ] **Bound combinatorial choices deterministically**

Before expanding a wide node, pre-rank chess moves by checks, captures, promotions, king safety, and central mobility; pre-rank Reinforce placements by check resolution, king cover, material value, and mobility. Keep the top `beamWidth`, breaking ties by canonical intent JSON. Do not use randomness at this layer.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/ai -- --run && npm.cmd run test --workspace @uno-chess/rules -- --run && npm.cmd run typecheck`

```powershell
git add packages/ai packages/rules
git commit -m "feat: enumerate complete AI turn plans"
```

---

### Task 3: Implement a configurable UNO Chess evaluator

**Files:**
- Create: `packages/ai/src/evaluate.ts`
- Create: `packages/ai/src/evaluate.test.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Write failing ordering tests**

```ts
it.each([
  ['checkmate', 'quiet-material-win'],
  ['save-own-king', 'ignore-check'],
  ['win-queen', 'win-pawn'],
  ['retain-playable-hand', 'strand-unmatchable-hand'],
  ['revive-two', 'revive-one'],
])('scores %s above %s', (better, worse) => {
  expect(evaluate(fixture(better), perspective)).toBeGreaterThan(evaluate(fixture(worse), perspective))
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/ai -- src/evaluate.test.ts --run`

Expected: evaluator is missing.

- [ ] **Implement named, versioned weights**

```ts
export const evaluationWeightsV1 = {
  checkmate: 1_000_000,
  check: 45,
  material: { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900 },
  kingSafety: 35,
  mobility: 4,
  playableCard: 18,
  handFlexibility: 7,
  reviveOption: 40,
  armyControlSwing: 30,
} as const
```

Score from the requested player's current controlled army, not permanently from white. Include terminal outcome, both kings' safety, material, legal mobility, playable hand options, remaining action potential, Reinforce value, and Betray ownership impact. Keep every component independently testable and return an optional score breakdown for debug tools.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/ai -- --run && npm.cmd run typecheck`

```powershell
git add packages/ai
git commit -m "feat: evaluate UNO chess search states"
```

---

### Task 4: Add three time-bounded search difficulties

**Files:**
- Create: `packages/ai/src/difficulties.ts`
- Create: `packages/ai/src/search.ts`
- Create: `packages/ai/src/fallback.ts`
- Create: `packages/ai/src/search.test.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Write failing difficulty and deadline tests**

```ts
it('returns the best completed plan available before an injected deadline', () => {
  const clock = stepClock([0, 10, 20, 300])
  const result = chooseTurnPlan(observation, difficulties.standard, { seed: 's1', clock })
  expect(result.plan.intents.length).toBeGreaterThan(0)
  expect(result.timedOut).toBe(true)
})

it('does not choose identically at beginner noise across different seeds', () => {
  expect(chooseTurnPlan(observation, difficulties.beginner, env('a')).plan.label)
    .not.toBe(chooseTurnPlan(observation, difficulties.beginner, env('b')).plan.label)
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/ai -- src/search.test.ts --run`

Expected: search/difficulty APIs are missing.

- [ ] **Define editable difficulty profiles**

```ts
export const difficulties = {
  beginner: { id: 'beginner', budgetMs: 80, beamWidth: 6, replyDepth: 0, determinizations: 1, scoreNoise: 90 },
  standard: { id: 'standard', budgetMs: 350, beamWidth: 18, replyDepth: 1, determinizations: 4, scoreNoise: 12 },
  hard: { id: 'hard', budgetMs: 1_200, beamWidth: 48, replyDepth: 2, determinizations: 12, scoreNoise: 0 },
} as const satisfies Record<AiDifficulty, DifficultyProfile>
```

Beginner evaluates the current turn and applies seeded noise. Standard evaluates current turn plus one best opponent reply across four determinizations. Hard performs a wider two-reply search across twelve determinizations. Average scores across samples; never substitute actual hidden cards.

- [ ] **Implement iterative deepening with complete-plan fallback**

```ts
export interface SearchEnvironment {
  seed: string
  clock: { now(): number }
  signal?: AbortSignal
}
```

After every completed root plan evaluation, update `bestFound`. Check deadline/cancellation between expansions. If no plan completes, call `safeFallback`, which sorts legal complete plans by: resolve current check, avoid immediate mate, prefer a basic move, then canonical label.

- [ ] **Add deterministic tactical fixtures and performance ceilings**

Create at least 20 fixtures covering forced mate, check defense, Action 3 check interruption, Betray control swap, Reverse hand value, all Reinforce modes, promotion, and low-card matching. Assert best-plan class rather than fragile exact SAN when multiple moves tie. With fake clock disabled, record but do not hard-fail on machine timing; hard-fail only on injected expansion caps.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/ai -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/ai`

```powershell
git add packages/ai
git commit -m "feat: add three rule-search AI levels"
```

---

### Task 5: Execute AI turns safely on the authoritative server

**Files:**
- Create: `apps/server/src/ai/BotController.ts`
- Create: `apps/server/src/ai/BotRegistry.ts`
- Create: `apps/server/src/ai/BotMatchService.ts`
- Create: `apps/server/src/ai/BotController.test.ts`
- Create: `apps/server/src/ai/register-ai-handlers.ts`
- Modify: `apps/server/src/create-server.ts`
- Modify: `packages/protocol/src/socket.ts`

- [ ] **Write failing safe-execution tests**

```ts
it('executes one intent at a time and replans after an unexpected turn-ending check', async () => {
  const controller = createBotController({ search: returnsThreeMovePlan, session })
  await controller.playTurn('game-1', 'bot-standard')
  expect(session.submit).toHaveBeenCalledTimes(1)
  expect(session.state.activePlayerId).toBe('human-1')
})

it('uses a legal fallback when search throws', async () => {
  const controller = createBotController({ search: () => { throw new Error('boom') }, session })
  await expect(controller.playTurn('game-1', 'bot-beginner')).resolves.toBeUndefined()
  expect(session.state.revision).toBeGreaterThan(0)
})
```

Also test that a six-card post-draw hand produces exactly one legal `discard-overflow` before any card play or chess move.

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/ai/BotController.test.ts --run`

Expected: AI server services are missing.

- [ ] **Register service-owned bot identities**

Provision three persistent profiles (`bot-beginner`, `bot-standard`, `bot-hard`) during environment bootstrap, mark `match_players.participant_kind='bot'`, and store `bot_difficulty`. Bots do not connect through Socket.IO or receive human auth tokens.

- [ ] **Implement acknowledged one-intent execution**

At the bot's `turn-start`, submit the mandatory draw. If the hand exceeds its limit, evaluate each legal `discard-overflow` choice using only the bot's now-visible hand and submit the best one before searching. Then build a fresh observation from its projection and search for a complete plan. Before every intent, verify revision and active player; after every acknowledgement, fetch a new projection. Stop when the turn ends. If a planned next intent is stale/illegal, discard the rest and replan once; on a second failure, use `safeFallback` and emit a structured server diagnostic.

- [ ] **Add manual practice socket creation**

Add `ai:create-practice` with `{ difficulty, presetId }`. It creates a clearly labeled AI match using the selected preset, assigns the human seat with a seeded fair choice, and responds with `gameId`. Reuse the ordinary `GameSession`, persistence, projection, pause, resume, and completion paths.

- [ ] **Run server/AI tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/ai -- --run && npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add apps/server packages/protocol package.json package-lock.json
git commit -m "feat: run authoritative AI matches"
```

---

### Task 6: Add AI practice UI and the explicit 15-second matchmaking choice

**Files:**
- Create: `apps/web/src/ai/AiPracticePage.tsx`
- Create: `apps/web/src/ai/AiDifficultyPicker.tsx`
- Create: `apps/web/src/ai/MatchmakingFallbackDialog.tsx`
- Create: `apps/web/src/ai/MatchmakingFallbackDialog.test.tsx`
- Modify: `apps/web/src/lobby/LobbyPage.tsx`
- Modify: `apps/web/src/lobby/QuickMatchPanel.tsx`
- Modify: `apps/server/src/lobby/MatchmakingQueue.ts`
- Modify: `packages/protocol/src/socket.ts`

- [ ] **Write failing 15-second prompt tests**

```tsx
it('does not start AI silently and offers both choices after 15 seconds', async () => {
  vi.useFakeTimers()
  render(<QuickMatchPanel socket={fakeQueueSocket()} />)
  await userEvent.click(screen.getByRole('button', { name: '快速配對' }))
  await vi.advanceTimersByTimeAsync(14_999)
  expect(screen.queryByRole('dialog')).toBeNull()
  await vi.advanceTimersByTimeAsync(1)
  expect(screen.getByRole('button', { name: '繼續等待真人' })).toBeVisible()
  expect(screen.getByRole('button', { name: '改與 AI 對戰' })).toBeVisible()
  expect(fakeQueueSocket().emit).not.toHaveBeenCalledWith('ai:create-practice', expect.anything())
})
```

- [ ] **Run focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/ai/MatchmakingFallbackDialog.test.tsx --run`

Expected: fallback dialog is missing.

- [ ] **Make the 15-second eligibility server-authored**

On queue join, server records `aiEligibleAt = joinedAt + 15_000` and emits `matchmaking:ai-eligible` then. The client timer may display countdown but cannot create the fallback before the server says eligible. If a human match occurs first, cancel the eligibility timer. Choosing “繼續等待真人” stays queued and leaves a non-modal AI option available; choosing AI atomically removes the player from the human queue and creates an AI match.

- [ ] **Build the manual AI entrance**

The lobby has “與 AI 練習” separate from quick match. Difficulty cards explain behavior in plain language, not internal depth numbers. Confirmation shows AI badge, difficulty, selected preset, separate-stat notice, and lower-reward notice before creation.

- [ ] **Run UI tests/build to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/web -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/web`

```powershell
git add apps/web apps/server packages/protocol
git commit -m "feat: add explicit AI matchmaking fallback"
```

---

### Task 7: Separate AI stats/rewards and pass the deferred-AI release gate

**Files:**
- Create: `supabase/migrations/202607100005_ai_matches_and_rewards.sql`
- Create: `apps/server/src/ai/AiRewardPolicy.ts`
- Create: `apps/server/src/ai/AiRewardPolicy.test.ts`
- Modify: `apps/server/src/game/MatchCompletionService.ts`
- Modify: `apps/web/src/profile/ProfilePage.tsx`
- Create: `e2e/ai-match.spec.ts`

- [ ] **Write failing stat/reward separation tests**

```ts
it('does not add an AI win to human PvP wins and pays the configured lower reward', async () => {
  await completion.finish(aiWinFixture('standard'))
  expect(await stats.forPlayer('human-1')).toMatchObject({ humanPvpWins: 0, ai: { standard: { wins: 1 } } })
  expect(await rewards.balance('human-1')).toBe(12)
})
```

- [ ] **Run focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/ai/AiRewardPolicy.test.ts --run`

Expected: AI-specific policy/schema is missing.

- [ ] **Add AI match metadata and data-driven rewards**

```ts
export const matchRewardPolicyV1 = {
  version: 1,
  humanPvp: { win: 30, draw: 15, loss: 5 },
  ai: {
    beginner: { win: 8, draw: 4, loss: 2 },
    standard: { win: 12, draw: 6, loss: 2 },
    hard: { win: 18, draw: 9, loss: 2 },
  },
} as const
```

These are initial adjustable economy defaults. Migration adds `participant_kind` and `bot_difficulty` checks/indexes where not already present, plus an `ai_match_stats` read view grouped by difficulty. Completion inserts `currency_ledger.reason='match-reward'` with policy version and idempotency key `match:<id>:player:<id>:match-reward-v1`; tests must prove every AI win reward is below the human PvP win reward. A tutorial level 6 match grants only its tutorial first-clear reward and never a second generic AI reward.

- [ ] **Write AI browser acceptance coverage**

Cover: manual beginner match creation and visible badge; quick queue dialog absent at 14.999 seconds and present at 15; continue waiting does not create AI; choosing AI removes human queue entry; one complete AI turn at each difficulty; hidden-variant selection test; search exception fallback; reconnect during an AI match; AI result displayed in separate profile section.

- [ ] **Run the complete deferred-AI gate**

Run:

```powershell
npx.cmd supabase db reset
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium
```

Expected: all commands exit 0. First-release PvP/tutorial behavior remains green, AI information-leak tests pass, all three difficulties produce legal complete turns, fallback never stalls, and stats/rewards remain separate.

- [ ] **Profile before adding worker isolation**

Measure server event-loop delay during 20 concurrent hard searches. If p95 delay exceeds 50 ms, move the pure `chooseTurnPlan` call to a bounded worker-thread pool while keeping the same observation/result contracts. If it stays at or below 50 ms, document the measurement and keep the simpler in-process implementation.

- [ ] **Commit**

```powershell
git add apps packages supabase e2e package.json package-lock.json
git commit -m "feat: complete deferred rule-search AI"
```
