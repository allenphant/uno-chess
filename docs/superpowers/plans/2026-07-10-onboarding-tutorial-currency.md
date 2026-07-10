# Onboarding Tutorial and Currency Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six short, replayable tutorial levels in the first release, with deterministic scripted opponents, optional skipping, server-verified first-clear rewards, guest progress continuity, and an auditable game-currency ledger.

**Architecture:** A new pure `@uno-chess/tutorial` package wraps the production rules reducer with data-defined level restrictions, objective evaluation, hints, and fixed opponent scripts. The server runs authoritative tutorial sessions and grants idempotent rewards; React renders objectives and teaching overlays from the same definitions. The tutorial never forks or weakens the formal rules engine.

**Tech Stack:** Existing TypeScript/React/Socket.IO/Supabase monorepo, Zod, Vitest, Testing Library, Playwright.

## Global Constraints

- Prerequisites: complete the rules/local plan and Tasks 1–7 of the online PvP plan. Finish this plan before calling the first public release complete.
- Product source: `docs/superpowers/specs/2026-07-10-onboarding-tutorial-design.md` and tutorial sections of the main design.
- Levels 1–3 are recommended but skippable; all six levels are individually replayable.
- Every position, hand, draw pile, discard face, opponent response, hint, objective, and reward is versioned data.
- Pin the validated level-definition hash and rules snapshot to each active session. A content update creates a new version; it never rewrites an in-progress or completed version.
- Call the production `applyIntent` and `getLegalTurnOptions`; do not add tutorial-only move legality.
- The coordinator may narrow allowed intents and decide when to reveal a hint, but cannot transform an illegal game intent into a legal one.
- Level 6 uses a fixed deterministic opponent script in the first release. It switches to beginner rule-search AI only after the deferred AI plan is complete.
- Rewards are granted only once per `(player, tutorial version, level)` by the server. Replay gives no repeat currency.
- The all-level bonus is also idempotent. Currency is an integer ledger; no client may write its own balance.
- Coin amounts in the v1 content files are initial balance defaults, not hard-coded engine behavior; tune them by publishing a reviewed content/economy version.
- Cosmetics/store purchases remain future scope. This plan creates only the progression and ledger foundation.
- Use `npm.cmd`/`npx.cmd` in PowerShell.

## Target File Map

```text
packages/tutorial/
  package.json
  tsconfig.json
  src/schema.ts
  src/catalog.ts
  src/create-session.ts
  src/coordinator.ts
  src/objectives.ts
  src/script-runner.ts
  src/content/v1/level-01.json
  src/content/v1/level-02.json
  src/content/v1/level-03.json
  src/content/v1/level-04.json
  src/content/v1/level-05.json
  src/content/v1/level-06.json
  src/index.ts
apps/server/src/tutorial/
  TutorialSession.ts
  TutorialRegistry.ts
  TutorialRewardService.ts
  register-tutorial-handlers.ts
apps/web/src/tutorial/
  TutorialHubPage.tsx
  TutorialGamePage.tsx
  ObjectivePanel.tsx
  HintOverlay.tsx
  RewardDialog.tsx
supabase/migrations/
  202607100003_tutorial_progress_and_currency.sql
  202607100004_guest_registration_continuity.sql
e2e/tutorial.spec.ts
```

---

### Task 1: Scaffold the tutorial package and validate versioned level data

**Files:**
- Create: `packages/tutorial/package.json`
- Create: `packages/tutorial/tsconfig.json`
- Create: `packages/tutorial/src/schema.ts`
- Create: `packages/tutorial/src/catalog.ts`
- Create: `packages/tutorial/src/index.ts`
- Create: `packages/tutorial/src/schema.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.base.json`

- [ ] **Write a failing schema test**

```ts
// packages/tutorial/src/schema.test.ts
import { describe, expect, it } from 'vitest'
import { TutorialLevelSchema } from './schema.js'

const validLevel = {
  id: 'tutorial-v1-level-01', version: 1, order: 1,
  titleKey: 'tutorial.level01.title', recommended: true, skippable: true,
  initial: {
    fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    activePlayerId: 'learner', learnerArmy: 'white',
    hands: { learner: [{ kind: 'action-2', color: 'red' }], scripted: [] },
    drawPile: [{ kind: 'seal', color: 'red' }],
    discardFace: { kind: 'action-3', color: 'red' }, capturedPieceIds: [],
  },
  allowedIntentKinds: ['draw-for-turn', 'play-action-card', 'action-move', 'finish-action-card'],
  objectives: [{ id: 'draw-card', type: 'event-count', eventType: 'card-drawn', minimum: 1 }],
  hints: [{ afterInvalidAttempts: 0, textKey: 'tutorial.level01.hint1' }],
  opponentScript: [], reward: { firstClearCoins: 25 },
}

describe('TutorialLevelSchema', () => {
  it('accepts a deterministic level and rejects an empty objective list', () => {
    expect(TutorialLevelSchema.parse(validLevel).version).toBe(1)
    expect(() => TutorialLevelSchema.parse({ ...validLevel, objectives: [] })).toThrow()
  })
})
```

- [ ] **Run the focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- src/schema.test.ts --run`

Expected: failure because the tutorial workspace and schema do not exist.

- [ ] **Create the package and install dependencies**

```json
// packages/tutorial/package.json
{
  "name": "@uno-chess/tutorial",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@uno-chess/protocol": "0.0.0",
    "@uno-chess/rules": "0.0.0",
    "zod": "latest"
  },
  "scripts": {
    "test": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

```json
// packages/tutorial/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "resolveJsonModule": true,
    "composite": true
  },
  "include": ["src"]
}
```

Run: `npm.cmd install`

Expected: the workspace is linked and the lockfile updates without errors.

- [ ] **Define the complete level schema**

```ts
// packages/tutorial/src/schema.ts
import { z } from 'zod'

const IntentKindSchema = z.enum([
  'draw-for-turn', 'discard-overflow', 'basic-move', 'play-action-card', 'action-move',
  'finish-action-card', 'play-function-card', 'choose-reinforcement', 'choose-wild-color',
])

const ObjectiveSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('event-count'), eventType: z.string(), minimum: z.number().int().positive() }).strict(),
  z.object({ id: z.string(), type: z.literal('card-played'), cardKind: z.string() }).strict(),
  z.object({ id: z.string(), type: z.literal('state-check'), predicate: z.enum(['opponent-in-check','army-control-swapped','turn-ended','game-finished']) }).strict(),
])

export const TutorialLevelSchema = z.object({
  id: z.string().regex(/^tutorial-v1-level-0[1-6]$/),
  version: z.literal(1),
  order: z.number().int().min(1).max(6),
  titleKey: z.string(),
  recommended: z.boolean(),
  skippable: z.boolean(),
  initial: z.object({
    fen: z.string(),
    activePlayerId: z.literal('learner'),
    learnerArmy: z.enum(['white','black']),
    hands: z.record(z.enum(['learner','scripted']), z.array(z.object({ kind: z.string(), color: z.string().nullable() }))),
    drawPile: z.array(z.object({ kind: z.string(), color: z.string().nullable() })),
    discardFace: z.object({ kind: z.string(), color: z.string() }),
    capturedPieceIds: z.array(z.string()),
  }).strict(),
  allowedIntentKinds: z.array(IntentKindSchema).min(1),
  objectives: z.array(ObjectiveSchema).min(1),
  hints: z.array(z.object({ afterInvalidAttempts: z.number().int().nonnegative(), textKey: z.string(), target: z.string().optional() })),
  opponentScript: z.array(z.object({ when: z.string(), intents: z.array(z.record(z.string(), z.unknown())) })),
  reward: z.object({ firstClearCoins: z.number().int().positive() }),
}).strict()

export type TutorialLevel = z.infer<typeof TutorialLevelSchema>
```

- [ ] **Create catalog loading with uniqueness checks**

`loadTutorialCatalog` parses all six JSON documents, rejects duplicate IDs/orders, requires orders 1–6 exactly, and deep-freezes the returned definitions. Export `tutorialCatalogV1` and `getTutorialLevel(id)`.

- [ ] **Run tests and type checking to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- --run && npm.cmd run typecheck`

Expected: schema tests pass and strict type checking succeeds.

- [ ] **Commit**

```powershell
git add package.json package-lock.json tsconfig.base.json packages/tutorial
git commit -m "feat: define versioned tutorial levels"
```

---

### Task 2: Implement the pure tutorial coordinator and objective evaluator

**Files:**
- Create: `packages/tutorial/src/create-session.ts`
- Create: `packages/tutorial/src/coordinator.ts`
- Create: `packages/tutorial/src/objectives.ts`
- Create: `packages/tutorial/src/script-runner.ts`
- Create: `packages/tutorial/src/coordinator.test.ts`
- Modify: `packages/tutorial/src/index.ts`

- [ ] **Write failing restriction and objective tests**

```ts
// packages/tutorial/src/coordinator.test.ts
import { describe, expect, it } from 'vitest'
import { applyTutorialIntent, createTutorialSession } from './index.js'

describe('tutorial coordinator', () => {
  it('rejects a formal legal move that this lesson has not introduced', () => {
    const session = createTutorialSession(levelOne, 'player-1')
    expect(() => applyTutorialIntent(session, {
      type: 'basic-move', playerId: 'learner', intentId: 't1', from: 'a2', to: 'a3',
    })).toThrow('TUTORIAL_INTENT_NOT_ALLOWED')
  })

  it('advances objectives only from emitted domain events', () => {
    const session = createTutorialSession(levelOne, 'player-1')
    const result = applyTutorialIntent(session, allowedLevelOneIntent)
    expect(result.session.completedObjectiveIds).toEqual(['draw-card', 'play-matching-card'])
  })
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- src/coordinator.test.ts --run`

Expected: coordinator APIs are missing.

- [ ] **Define serializable tutorial session state**

```ts
export interface TutorialSessionState {
  sessionId: string
  playerId: string
  levelId: string
  levelVersion: 1
  levelDefinitionHash: string
  game: GameState
  completedObjectiveIds: string[]
  invalidAttempts: number
  scriptCursor: number
  status: 'active' | 'completed' | 'skipped'
  revision: number
  lastCompletedCheckpointId: string | null
}
```

- [ ] **Implement the coordinator as a production-reducer wrapper**

```ts
export function applyTutorialIntent(session: TutorialSessionState, intent: GameIntent): TutorialApplyResult {
  const level = getTutorialLevel(session.levelId)
  if (!level.allowedIntentKinds.includes(intent.type)) throw new Error('TUTORIAL_INTENT_NOT_ALLOWED')
  if (!matchesCurrentCheckpoint(level, session, intent)) throw new Error('TUTORIAL_CHECKPOINT_NOT_MET')
  const applied = applyIntent(session.game, intent)
  const progressed = advanceObjectives(level.objectives, session.completedObjectiveIds, applied.events, applied.state)
  return runReadyScriptSteps({ ...session, game: applied.state, completedObjectiveIds: progressed, revision: session.revision + 1 })
}
```

`matchesCurrentCheckpoint` narrows the requested source/target/card/effect choice from definition data. It never bypasses `applyIntent`. `advanceObjectives` inspects domain events and whitelisted state predicates only—never localized UI text.

- [ ] **Implement bounded deterministic script execution**

When a script trigger becomes true, apply its listed intents through the same rules reducer under player `scripted`. Stop after 20 scripted intents or on any error, and return a visible tutorial configuration error instead of guessing another move.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- --run && npm.cmd run typecheck`

```powershell
git add packages/tutorial
git commit -m "feat: coordinate deterministic tutorial sessions"
```

---

### Task 3: Author the six first-release tutorial levels

**Files:**
- Create: `packages/tutorial/src/content/v1/level-01.json`
- Create: `packages/tutorial/src/content/v1/level-02.json`
- Create: `packages/tutorial/src/content/v1/level-03.json`
- Create: `packages/tutorial/src/content/v1/level-04.json`
- Create: `packages/tutorial/src/content/v1/level-05.json`
- Create: `packages/tutorial/src/content/v1/level-06.json`
- Create: `packages/tutorial/src/content/v1/content.test.ts`

- [ ] **Write failing catalog acceptance tests**

```ts
it('contains six runnable levels with the approved progression', () => {
  expect(tutorialCatalogV1.map((level) => level.id)).toEqual([
    'tutorial-v1-level-01', 'tutorial-v1-level-02', 'tutorial-v1-level-03',
    'tutorial-v1-level-04', 'tutorial-v1-level-05', 'tutorial-v1-level-06',
  ])
  expect(tutorialCatalogV1.slice(0, 3).every((level) => level.recommended && level.skippable)).toBe(true)
  expect(tutorialCatalogV1[5]?.opponentScript.length).toBeGreaterThan(0)
})
```

Add a simulation test that follows the authored golden path for every level, reaches `completed`, never emits an illegal rule-engine event, and produces identical final hashes on two runs.

- [ ] **Run the content tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- src/content/v1/content.test.ts --run`

Expected: six content files are absent or the catalog count is not six.

- [ ] **Author levels to this exact progression matrix**

| Level | Initial lesson | Required objectives | Scripted response | First-clear reward |
|---|---|---|---|---:|
| 1 | Draw; match color/face; drag or tap card; one legal chess move | draw once, play matching Action 2, move once, stop early | one harmless basic move | 25 |
| 2 | Action 2 versus Action 3 budget | complete exactly two moves, then use Action 3 and stop after two | fixed pawn moves that preserve all targets | 30 |
| 3 | Check interrupts combo; function resolution ends turn | give check on first Action 3 move, observe immediate handoff, answer check; play Seal and observe no following move | fixed checking/answer sequence | 35 |
| 4 | Reinforce up to two non-kings in tactical own half | revive exactly two captured pieces on legal empty own-half squares; verify revived rook cannot castle | fixed capture setup and one reply | 40 |
| 5 | Seal, Reverse, Betray, wild color, UNO matching | block a card turn, swap hands, swap army ownership, choose blue, move the newly controlled army | fixed draws and legal replies | 50 |
| 6 | Integrated short match | win the authored position by checkmate while using one action card and one function card | complete deterministic opponent turn script | 75 |

- [ ] **Use explicit data rather than coordinator branches**

Each JSON must include full FEN, exact card arrays in order, discard face, captured piece IDs, allowed intent checkpoints, hint thresholds `0`, `2`, and `4`, and complete opponent intents. For example:

```json
{
  "id": "tutorial-v1-level-04",
  "version": 1,
  "order": 4,
  "titleKey": "tutorial.level04.title",
  "recommended": false,
  "skippable": true,
  "initial": {
    "fen": "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
    "activePlayerId": "learner",
    "learnerArmy": "white",
    "hands": {
      "learner": [{ "kind": "reinforce", "color": "red" }],
      "scripted": [{ "kind": "action-2", "color": "blue" }]
    },
    "drawPile": [{ "kind": "seal", "color": "red" }],
    "discardFace": { "kind": "action-2", "color": "red" },
    "capturedPieceIds": ["white-rook-a1", "white-knight-b1" ]
  },
  "allowedIntentKinds": ["draw-for-turn", "play-function-card", "choose-reinforcement"],
  "objectives": [
    { "id": "revive-two", "type": "event-count", "eventType": "piece-revived", "minimum": 2 },
    { "id": "turn-ended", "type": "state-check", "predicate": "turn-ended" }
  ],
  "hints": [
    { "afterInvalidAttempts": 0, "textKey": "tutorial.level04.hint1", "target": "card:reinforce" },
    { "afterInvalidAttempts": 2, "textKey": "tutorial.level04.hint2", "target": "board:own-half" },
    { "afterInvalidAttempts": 4, "textKey": "tutorial.level04.hint3" }
  ],
  "opponentScript": [],
  "reward": { "firstClearCoins": 40 }
}
```

- [ ] **Run deterministic golden-path tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/tutorial -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/tutorial`

Expected: six schemas and six complete simulations pass.

- [ ] **Commit**

```powershell
git add packages/tutorial
git commit -m "feat: author six onboarding levels"
```

---

### Task 4: Build the tutorial hub, teaching overlay, and responsive game screen

**Files:**
- Create: `apps/web/src/tutorial/TutorialHubPage.tsx`
- Create: `apps/web/src/tutorial/TutorialGamePage.tsx`
- Create: `apps/web/src/tutorial/ObjectivePanel.tsx`
- Create: `apps/web/src/tutorial/HintOverlay.tsx`
- Create: `apps/web/src/tutorial/RewardDialog.tsx`
- Create: `apps/web/src/tutorial/TutorialGamePage.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles/game.css`

- [ ] **Write failing teaching-flow component tests**

```tsx
it('shows the current objective, optional skip, and progressive hint', async () => {
  render(<TutorialGamePage levelId="tutorial-v1-level-01" client={fakeTutorialClient()} />)
  expect(screen.getByRole('heading', { name: /第一關/ })).toBeVisible()
  expect(screen.getByTestId('current-objective')).toBeVisible()
  expect(screen.getByRole('button', { name: '跳過教學' })).toBeVisible()
  await triggerInvalidIntentTwice()
  expect(screen.getByText(/提示/)).toBeVisible()
})
```

- [ ] **Run component tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/tutorial/TutorialGamePage.test.tsx --run`

Expected: tutorial UI components do not exist.

- [ ] **Build the hub and objective-driven overlay**

The hub shows six cards with completed/skipped/current/locked presentation, first-clear reward, and replay. Do not hard-lock later levels: skipping a recommended level acknowledges once and opens the hub. The overlay highlights definition targets, announces objective completion with `aria-live`, and never intercepts required board/card pointer events.

- [ ] **Reuse production board/card components**

Pass `allowedIntentKinds`, allowed card IDs, and allowed squares as disabled/aria-disabled presentation. Send the same protocol intents used by online play. Include drag, tap, keyboard, mobile layout, player-selected overflow discard, check announcements, and effect-choice dialogs.

- [ ] **Run UI tests and build to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/web -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/web`

Expected: tutorial and existing PvP/local UI suites pass; Vite builds.

- [ ] **Commit**

```powershell
git add apps/web
git commit -m "feat: add guided tutorial experience"
```

---

### Task 5: Run authoritative tutorial sessions and grant currency idempotently

**Files:**
- Create: `supabase/migrations/202607100003_tutorial_progress_and_currency.sql`
- Create: `apps/server/src/tutorial/TutorialSession.ts`
- Create: `apps/server/src/tutorial/TutorialRegistry.ts`
- Create: `apps/server/src/tutorial/TutorialRewardService.ts`
- Create: `apps/server/src/tutorial/TutorialRewardService.test.ts`
- Create: `apps/server/src/tutorial/register-tutorial-handlers.ts`
- Modify: `packages/protocol/src/socket.ts`
- Modify: `apps/server/src/create-server.ts`

- [ ] **Write failing reward idempotency tests**

```ts
it('grants a level reward once and the all-clear bonus once', async () => {
  for (const level of tutorialCatalogV1) await rewards.complete('player-1', level.id, 1, `session:${level.order}`)
  await rewards.complete('player-1', 'tutorial-v1-level-06', 1, 'duplicate-session')
  expect(await rewards.balance('player-1')).toBe(25 + 30 + 35 + 40 + 50 + 75 + 100)
})
```

- [ ] **Run focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/tutorial/TutorialRewardService.test.ts --run`

Expected: reward service and schema are missing.

- [ ] **Create progress and ledger tables**

```sql
-- supabase/migrations/202607100003_tutorial_progress_and_currency.sql
create table public.tutorial_completions (
  player_id uuid not null references public.profiles(id) on delete cascade,
  level_id text not null,
  level_version integer not null,
  first_session_id text not null,
  first_completed_at timestamptz not null default now(),
  replay_count integer not null default 0,
  primary key (player_id, level_id, level_version)
);

create table public.currency_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'coin' check (currency = 'coin'),
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('tutorial-first-clear','tutorial-all-clear','match-reward','cosmetic-purchase','admin-adjustment')),
  idempotency_key text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key)
);

create view public.wallet_balances with (security_invoker = true) as
select player_id, currency, coalesce(sum(amount), 0)::bigint as balance
from public.currency_ledger group by player_id, currency;

alter table public.tutorial_completions enable row level security;
alter table public.currency_ledger enable row level security;
create policy "read own tutorial progress" on public.tutorial_completions for select using (auth.uid() = player_id);
create policy "read own ledger" on public.currency_ledger for select using (auth.uid() = player_id);
```

No authenticated client insert policy is allowed. Implement a server-only transaction/RPC that inserts completion and ledger row together; on conflict, increment replay count without granting currency. After six distinct v1 completions, insert `tutorial:v1:all-clear` for 100 coins once.

- [ ] **Add tutorial socket contracts and sessions**

Add `tutorial:start`, `tutorial:intent`, `tutorial:skip`, and `tutorial:projection`. The server creates `TutorialSession`, replaces incoming player IDs with authenticated actor mapping, applies commands serially, broadcasts only that player's projection, and calls rewards only when coordinator status first becomes `completed`.

Persist the tutorial session as a `matches.entry_kind='tutorial'` checkpoint after each completed objective. `tutorial:start` resumes the latest compatible active checkpoint or accepts `restart: true`; the checkpoint stores the pinned level-definition hash and rules snapshot. If the pinned content version is unavailable, return `TUTORIAL_VERSION_UNAVAILABLE` and offer a deliberate restart on the current version rather than silently changing the scenario.

- [ ] **Reset schema and run tests to verify GREEN**

Run:

```powershell
npx.cmd supabase db reset
npx.cmd supabase db lint
npm.cmd run test --workspace @uno-chess/server -- --run
npm.cmd run typecheck
```

Expected: schema applies, duplicate completions do not duplicate coins, and tutorial session tests pass.

- [ ] **Commit**

```powershell
git add supabase apps/server packages/protocol
git commit -m "feat: grant tutorial currency rewards"
```

---

### Task 6: Preserve guest progress when the player registers

**Files:**
- Create: `supabase/migrations/202607100004_guest_registration_continuity.sql`
- Create: `apps/server/src/auth/RegistrationService.ts`
- Create: `apps/server/src/auth/RegistrationService.test.ts`
- Modify: `apps/web/src/auth/SignInPanel.tsx`

- [ ] **Write a failing identity-continuity test**

```ts
it('upgrades the anonymous identity once without changing the profile id or balance', async () => {
  const before = await fixture.guestWithTutorialCoins(75)
  const upgraded = await registration.finalize(before.token, { displayName: 'Allen' })
  expect(upgraded.playerId).toBe(before.playerId)
  expect(await rewards.balance(upgraded.playerId)).toBe(75)
  await expect(registration.finalize(before.token, { displayName: 'Allen' })).rejects.toThrow('ALREADY_REGISTERED')
})
```

- [ ] **Run focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/auth/RegistrationService.test.ts --run`

Expected: registration finalization/audit is missing.

- [ ] **Audit the one-time anonymous-to-account transition**

```sql
-- supabase/migrations/202607100004_guest_registration_continuity.sql
create table public.registration_upgrades (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  upgraded_at timestamptz not null default now()
);
```

The web client upgrades the currently signed-in anonymous Supabase user rather than signing out and creating a second identity. The server verifies the refreshed token is no longer anonymous, locks the profile row, inserts `registration_upgrades`, flips `profiles.is_guest` to false, and returns the unchanged player ID. Since match, tutorial, achievement, and ledger rows already reference that ID, progress and currency remain intact exactly once.

- [ ] **Run schema/auth tests to verify GREEN and commit**

Run: `npx.cmd supabase db reset && npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add supabase apps/server apps/web
git commit -m "feat: preserve guest progression on registration"
```

---

### Task 7: Add tutorial E2E coverage and the first-release gate

**Files:**
- Create: `e2e/tutorial.spec.ts`
- Modify: `playwright.config.ts`
- Modify only files required by release-gate failures.

- [ ] **Write guest golden-path E2E**

```ts
test('guest completes recommended onboarding and keeps reward after registration', async ({ page }) => {
  await page.goto('/tutorial')
  await page.getByRole('button', { name: /第一關/ }).click()
  await completeLevelOne(page)
  await expect(page.getByText('首次通關 +25')).toBeVisible()
  await page.getByRole('button', { name: '註冊以保存戰績' }).click()
  await registerCurrentGuest(page)
  await expect(page.getByTestId('coin-balance')).toHaveText('25')
  await page.getByRole('button', { name: '重新遊玩第一關' }).click()
  await completeLevelOne(page)
  await expect(page.getByTestId('coin-balance')).toHaveText('25')
})
```

- [ ] **Run the new browser test to verify RED**

Run: `npm.cmd run test:e2e -- e2e/tutorial.spec.ts --project=chromium`

Expected: failure because the completion helpers and full guest reward flow are not yet wired into browser acceptance coverage.

- [ ] **Add six-level simulation and browser coverage**

Use pure-package golden-path tests for all six levels. In Playwright, cover levels 1, 3, 5, and 6 end-to-end on desktop, level 1 at both 320×568 and 390×844, skip/re-enter, leave/resume checkpoint, deliberate restart, two failed attempts revealing a hint, keyboard-only completion of level 1, one-time all-clear 100 coin bonus, and scripted level 6 determinism.

- [ ] **Run the entire first-release gate**

Run:

```powershell
npx.cmd supabase db reset
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium
```

Expected: all commands exit 0. Rules, local game, PvP, auth, tutorial, progress, ledger, desktop/mobile, and guest-registration tests pass.

- [ ] **Manually verify teaching quality**

For each level, confirm a new player can identify the next action without reading the full rulebook; the hint escalates without blocking input; check and turn-ending behavior are plainly announced; no level exceeds its intended short scenario; skipping is obvious and reversible.

- [ ] **Commit release-gate fixes if any**

```powershell
git add apps packages supabase e2e playwright.config.ts package.json package-lock.json
git commit -m "test: complete tutorial first-release gate"
```
