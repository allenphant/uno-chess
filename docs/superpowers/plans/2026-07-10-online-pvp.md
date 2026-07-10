# Online PvP Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified rules core into an authoritative real-time service with friend-code rooms, quick matchmaking, guest or registered play, reconnection, durable match records, statistics, and achievements.

**Architecture:** A Node.js Socket.IO server owns every full `GameState` and applies shared reducer intents serially. Clients receive per-player projections and acknowledgements, never authoritative mutation rights. Supabase Auth supplies anonymous and registered identities; Postgres stores immutable rule snapshots, intents/events, results, and account progression. Friend rooms and the quick-match queue are in memory for the first single-instance release, while active/finished games are durably checkpointed.

**Tech Stack:** Existing npm workspaces and rules packages, Node.js 24, TypeScript, Socket.IO server/client, Supabase Auth/Postgres/CLI, Zod, Vitest, Playwright.

## Global Constraints

- Prerequisite: complete `docs/superpowers/plans/2026-07-10-rules-core-local-game.md` and keep all of its release-gate tests green.
- Product source: sections 7–13 of `docs/superpowers/specs/2026-07-10-uno-chess-online-game-design.md`.
- The server is authoritative. The web client sends only a versioned intent and renders the acknowledged projection.
- Never broadcast full `GameState`; call `projectPlayerView(state, playerId)` separately for each socket.
- Authenticate both anonymous guests and registered users through Supabase. Never accept a player ID from an unverified socket payload.
- Serialize commands per game. A duplicated `intentId` must return the original acknowledgement without applying twice.
- Store the exact rule snapshot, snapshot hash, preset ID, seed, and accepted intent/event sequence with a match.
- Use the match's snapshotted disconnect grace period (60 seconds in `standard-v1`). Pause the match clock/state during grace; reconnect restores a fresh projection.
- The first release is a single server process. Do not add Redis until horizontal scaling is explicitly scheduled.
- Use `npm.cmd`/`npx.cmd` in PowerShell.

## Target File Map

```text
apps/server/
  package.json
  src/index.ts
  src/create-server.ts
  src/auth/socket-auth.ts
  src/game/GameSession.ts
  src/game/GameRegistry.ts
  src/game/MatchRepository.ts
  src/lobby/FriendRoomService.ts
  src/lobby/MatchmakingQueue.ts
  src/socket/register-lobby-handlers.ts
  src/socket/register-game-handlers.ts
  src/testing/start-test-server.ts
apps/web/src/
  auth/AuthProvider.tsx
  auth/SignInPanel.tsx
  online/socket.ts
  online/OnlineGamePage.tsx
  lobby/LobbyPage.tsx
  lobby/FriendRoomPanel.tsx
  lobby/QuickMatchPanel.tsx
packages/protocol/src/
  socket.ts
  lobby.ts
supabase/
  config.toml
  migrations/202607100001_accounts_and_matches.sql
  migrations/202607100002_match_records_and_achievements.sql
e2e/
  online-friend-match.spec.ts
  online-quick-match.spec.ts
```

---

### Task 1: Add typed Socket.IO contracts and a health-checked server

**Files:**
- Create: `packages/protocol/src/socket.ts`
- Create: `packages/protocol/src/lobby.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/create-server.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/create-server.test.ts`
- Modify: `package.json`

- [ ] **Write a failing health/socket contract test**

```ts
// apps/server/src/create-server.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { io as createClient, type Socket } from 'socket.io-client'
import { createGameServer } from './create-server.js'

describe('game server', () => {
  let client: Socket | undefined
  afterEach(() => client?.close())

  it('answers health and rejects a socket without auth', async () => {
    const server = await createGameServer({ port: 0, auth: { verify: async () => null } })
    const response = await fetch(`${server.url}/health`)
    expect(await response.json()).toEqual({ ok: true, protocolVersion: 1 })
    client = createClient(server.url, { auth: {} })
    await expect(new Promise((_, reject) => client?.once('connect_error', reject))).rejects.toThrow('UNAUTHORIZED')
    await server.close()
  })
})
```

- [ ] **Run the focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/create-server.test.ts --run`

Expected: failure because the server workspace does not exist.

- [ ] **Define socket envelopes in the shared protocol**

```ts
// packages/protocol/src/socket.ts
import type { GameEvent, GameIntent, PlayerView, RuleSnapshot } from './index.js'

export type ErrorCode =
  | 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'NOT_FOUND' | 'ROOM_FULL'
  | 'NOT_ACTIVE_PLAYER' | 'ILLEGAL_INTENT' | 'STALE_REVISION' | 'INTERNAL_ERROR'

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } }

export interface ClientToServerEvents {
  'room:create': (input: { presetId: string; overrides: Record<string, unknown> }, ack: (value: Ack<{ code: string }>) => void) => void
  'room:join': (input: { code: string }, ack: (value: Ack<{ gameId: string | null }>) => void) => void
  'room:ready': (input: { code: string; rulesHash: string }, ack: (value: Ack<{ ready: true }>) => void) => void
  'matchmaking:join': (input: { presetId: string }, ack: (value: Ack<{ queued: true }>) => void) => void
  'matchmaking:leave': (input: Record<string, never>, ack: (value: Ack<{ queued: false }>) => void) => void
  'game:resume': (input: { gameId: string }, ack: (value: Ack<{ view: PlayerView; revision: number }>) => void) => void
  'game:intent': (input: { gameId: string; revision: number; intent: GameIntent }, ack: (value: Ack<{ revision: number }>) => void) => void
}

export interface ServerToClientEvents {
  'room:updated': (payload: { code: string; memberCount: number; hostPlayerId: string; readyPlayerIds: string[]; rules: RuleSnapshot; rulesHash: string }) => void
  'matchmaking:matched': (payload: { gameId: string }) => void
  'game:projection': (payload: { gameId: string; revision: number; view: PlayerView; events: GameEvent[] }) => void
  'game:paused': (payload: { gameId: string; disconnectedPlayerId: string; resumeDeadline: string }) => void
  'game:resumed': (payload: { gameId: string }) => void
}
```

- [ ] **Create the server workspace and minimal HTTP/Socket.IO host**

```json
// apps/server/package.json
{
  "name": "@uno-chess/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

```json
// apps/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"],
    "composite": true
  },
  "include": ["src"]
}
```

```ts
// apps/server/src/create-server.ts
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { protocolVersion, type ClientToServerEvents, type ServerToClientEvents } from '@uno-chess/protocol'

export async function createGameServer(options: ServerOptions) {
  const http = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, protocolVersion }))
      return
    }
    response.writeHead(404).end()
  })
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, { cors: { origin: options.webOrigin ?? true } })
  io.use(async (socket, next) => {
    const actor = await options.auth.verify(socket.handshake.auth.token)
    if (!actor) return next(new Error('UNAUTHORIZED'))
    socket.data.actor = actor
    next()
  })
  await listen(http, options.port)
  return { io, url: addressUrl(http), close: () => closeAll(io, http) }
}
```

- [ ] **Install server dependencies and add root scripts**

Run:

```powershell
npm.cmd install socket.io zod @supabase/supabase-js @uno-chess/protocol@0.0.0 @uno-chess/rules@0.0.0 --workspace @uno-chess/server
npm.cmd install --save-dev socket.io-client tsx @types/node --workspace @uno-chess/server
```

Add `dev:server`, `test:server`, and `build` workspace scripts. The production entry reads `PORT`, `WEB_ORIGIN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from environment variables and fails fast when required values are missing.

- [ ] **Run tests and type checking to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

Expected: health test passes, unauthenticated sockets are rejected, and TypeScript is clean.

- [ ] **Commit**

```powershell
git add package.json package-lock.json apps/server packages/protocol
git commit -m "feat: add typed real-time game server"
```

---

### Task 2: Create Supabase identities and durable match schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/202607100001_accounts_and_matches.sql`
- Create: `supabase/migrations/202607100002_match_records_and_achievements.sql`
- Create: `apps/server/src/auth/socket-auth.ts`
- Create: `apps/server/src/auth/socket-auth.test.ts`
- Create: `apps/server/src/game/MatchRepository.ts`

- [ ] **Initialize local Supabase configuration**

Run: `npx.cmd supabase init`

Expected: `supabase/config.toml` is created. Enable anonymous sign-ins in the local auth configuration and keep secrets out of Git.

- [ ] **Write a failing authentication test**

```ts
it('derives the actor only from a verified Supabase access token', async () => {
  const auth = createSocketAuth(fakeSupabase({ token: 'valid', user: { id: 'user-1', is_anonymous: true } }))
  await expect(auth.verify('valid')).resolves.toEqual({ playerId: 'user-1', accountKind: 'guest' })
  await expect(auth.verify('invalid')).resolves.toBeNull()
})
```

- [ ] **Run the focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/auth/socket-auth.test.ts --run`

Expected: failure because `createSocketAuth` is missing.

- [ ] **Create account and immutable match tables**

```sql
-- supabase/migrations/202607100001_accounts_and_matches.sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key,
  status text not null check (status in ('active','paused','finished','abandoned')),
  entry_kind text not null check (entry_kind in ('friend','quick','tutorial','ai')),
  preset_id text not null,
  rules_schema_version integer not null,
  rules_snapshot jsonb not null,
  rules_hash text not null,
  seed text not null,
  revision integer not null default 0,
  state_checkpoint jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  seat smallint not null check (seat in (0,1)),
  army_at_start text not null check (army_at_start in ('white','black')),
  connected boolean not null default true,
  primary key (match_id, player_id),
  unique (match_id, seat)
);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);
create policy "read participating matches" on public.matches for select using (
  exists (select 1 from public.match_players mp where mp.match_id = id and mp.player_id = auth.uid())
);
```

```sql
-- supabase/migrations/202607100002_match_records_and_achievements.sql
create table public.match_intents (
  match_id uuid not null references public.matches(id) on delete cascade,
  revision integer not null,
  intent_id text not null,
  player_id uuid not null references public.profiles(id),
  intent jsonb not null,
  events jsonb not null,
  state_hash text not null,
  created_at timestamptz not null default now(),
  primary key (match_id, revision),
  unique (match_id, intent_id)
);

create table public.achievement_definitions (
  id text primary key,
  version integer not null,
  name_key text not null,
  condition jsonb not null,
  active boolean not null default true
);

create table public.player_achievements (
  player_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_definitions(id),
  unlocked_at timestamptz not null default now(),
  source_match_id uuid references public.matches(id),
  primary key (player_id, achievement_id)
);
```

Only the service-role server may insert match outcomes, intents, or achievements. Add participant-read RLS policies for `match_players`, `match_intents`, and `player_achievements`.

- [ ] **Implement token verification and repository transactions**

`createSocketAuth` calls `supabase.auth.getUser(token)`, maps `user.is_anonymous` to guest/registered, and returns null on any error. `MatchRepository.appendIntent` uses one database transaction/RPC to insert the intent/events, advance revision, and replace checkpoint only when the stored revision matches.

- [ ] **Reset and verify local schema**

Run:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
npx.cmd supabase db lint
```

Expected: migrations and seed apply without errors; lint reports no schema errors.

- [ ] **Run server tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add supabase apps/server
git commit -m "feat: persist authenticated match records"
```

---

### Task 3: Build the authoritative per-game session

**Files:**
- Create: `apps/server/src/game/GameSession.ts`
- Create: `apps/server/src/game/GameRegistry.ts`
- Create: `apps/server/src/game/GameSession.test.ts`
- Create: `apps/server/src/socket/register-game-handlers.ts`
- Modify: `apps/server/src/create-server.ts`

- [ ] **Write failing serialization, projection, and duplicate-intent tests**

```ts
it('applies simultaneous intents serially and hides the opponent hand', async () => {
  const session = createTestSession()
  const first = session.submit('p1', { type: 'draw-for-turn', playerId: 'p1', intentId: 'same-id' }, 0)
  const duplicate = session.submit('p1', { type: 'draw-for-turn', playerId: 'p1', intentId: 'same-id' }, 0)
  const [accepted, replayed] = await Promise.all([first, duplicate])
  expect(accepted).toEqual(replayed)
  expect(session.revision).toBe(1)
  expect(session.viewFor('p1').opponent.hand).toEqual({ count: expect.any(Number) })
})
```

- [ ] **Run the focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/game/GameSession.test.ts --run`

Expected: failure because `GameSession` does not exist.

- [ ] **Implement one promise chain per game**

```ts
// apps/server/src/game/GameSession.ts
export class GameSession {
  #tail = Promise.resolve()
  #acks = new Map<string, IntentAck>()

  submit(actorId: PlayerId, intent: GameIntent, expectedRevision: number): Promise<IntentAck> {
    const prior = this.#acks.get(intent.intentId)
    if (prior) return Promise.resolve(prior)
    const operation = this.#tail.then(() => this.#apply(actorId, intent, expectedRevision))
    this.#tail = operation.then(() => undefined, () => undefined)
    return operation
  }
}
```

`#apply` overwrites `intent.playerId` with the authenticated actor, rejects stale revisions, calls `applyIntent`, persists before broadcast, increments revision once, stores the acknowledgement, and emits a distinct projection to each participant.

- [ ] **Register game socket handlers**

`game:intent` validates with Zod, gets the actor from `socket.data`, submits to the registry session, acknowledges only after persistence, and maps known rule errors to protocol errors. `game:resume` verifies participation before joining Socket.IO room `game:<id>` and sending a fresh projection.

- [ ] **Run tests to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

Expected: concurrent/duplicate/stale-revision tests pass with no hidden-state leak.

- [ ] **Commit**

```powershell
git add apps/server packages/protocol
git commit -m "feat: add authoritative game sessions"
```

---

### Task 4: Add friend-code rooms with configurable resolved rules

**Files:**
- Create: `apps/server/src/lobby/FriendRoomService.ts`
- Create: `apps/server/src/lobby/FriendRoomService.test.ts`
- Create: `apps/server/src/socket/register-lobby-handlers.ts`
- Modify: `apps/server/src/create-server.ts`
- Modify: `packages/protocol/src/lobby.ts`

- [ ] **Write failing friend-room tests**

```ts
it('creates a six-character room and starts only after both distinct players accept the same rules hash', async () => {
  const rooms = createFriendRoomService({ codeSource: () => 'UNO123', createMatch })
  expect(rooms.create('p1', { presetId: 'standard-v1', overrides: {} }).code).toBe('UNO123')
  expect(await rooms.join('p2', 'uno123')).toEqual({ gameId: null })
  await rooms.ready('p1', 'UNO123', rooms.get('UNO123').rulesHash)
  const joined = await rooms.ready('p2', 'UNO123', rooms.get('UNO123').rulesHash)
  expect(joined.gameId).toBe('game-1')
  expect(createMatch).toHaveBeenCalledWith(expect.objectContaining({ playerIds: ['p1', 'p2'] }))
})
```

Also reject unknown, expired, self-join, full-room, and invalid override cases.

- [ ] **Run the focused test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/lobby/FriendRoomService.test.ts --run`

Expected: friend-room service is missing.

- [ ] **Resolve and hash the full room rules at creation**

```ts
export interface FriendRoom {
  code: string
  hostPlayerId: PlayerId
  guestPlayerId: PlayerId | null
  resolvedRules: RuleSnapshot
  rulesHash: string
  readyPlayerIds: PlayerId[]
  createdAt: number
  expiresAt: number
}
```

Apply whitelisted per-field overrides to a known preset, validate the complete result with `RuleSnapshotSchema`, canonicalize JSON keys, and SHA-256 the canonical snapshot. Store both snapshot and hash when creating the match.

- [ ] **Register room handlers and lifecycle cleanup**

Room codes are case-insensitive six-character strings excluding ambiguous glyphs. Joining never starts immediately: both players receive the full resolved snapshot and custom-difference summary, then `room:ready` must echo the exact `rulesHash`; any host edit clears all ready states. Expire unstarted rooms after 30 minutes and delete immediately after match creation. Emit `room:updated` only to sockets in `friend:<code>`.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add apps/server packages/protocol
git commit -m "feat: add configurable friend rooms"
```

---

### Task 5: Add quick matchmaking

**Files:**
- Create: `apps/server/src/lobby/MatchmakingQueue.ts`
- Create: `apps/server/src/lobby/MatchmakingQueue.test.ts`
- Modify: `apps/server/src/socket/register-lobby-handlers.ts`

- [ ] **Write failing queue tests**

```ts
it('matches two distinct players using the same preset in FIFO order', async () => {
  const queue = createMatchmakingQueue({ createMatch })
  expect(await queue.join('p1', 'standard-v1')).toEqual({ queued: true })
  expect(await queue.join('p2', 'standard-v1')).toEqual({ matchedGameId: 'game-1', opponentId: 'p1' })
  expect(createMatch).toHaveBeenCalledTimes(1)
})
```

Also test duplicate joins, leave, socket disconnect, already-active players, and different preset partitions.

- [ ] **Run test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/lobby/MatchmakingQueue.test.ts --run`

Expected: queue API is missing.

- [ ] **Implement FIFO partitions by preset/rules hash**

The queue stores `{ playerId, socketId, presetId, rulesHash, joinedAt }`. It removes stale/disconnected entries before matching, never matches the same account to itself, creates the game exactly once, and emits `matchmaking:matched` to both sockets.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add apps/server
git commit -m "feat: add quick PvP matchmaking"
```

---

### Task 6: Add optional turn clocks, pause, reconnect, and grace-period forfeits

**Files:**
- Create: `apps/server/src/game/ConnectionSupervisor.ts`
- Create: `apps/server/src/game/ConnectionSupervisor.test.ts`
- Create: `apps/server/src/game/TurnClock.ts`
- Create: `apps/server/src/game/TurnClock.test.ts`
- Modify: `apps/server/src/game/GameSession.ts`
- Modify: `apps/server/src/socket/register-game-handlers.ts`
- Modify: `packages/protocol/src/socket.ts`

- [ ] **Write failing fake-timer tests**

```ts
it('pauses for 60 seconds and resumes without changing the game revision', async () => {
  vi.useFakeTimers()
  const supervisor = createSupervisor({ graceMs: 60_000, forfeit })
  supervisor.disconnected('game-1', 'p1')
  await vi.advanceTimersByTimeAsync(59_000)
  expect(forfeit).not.toHaveBeenCalled()
  expect(supervisor.reconnected('game-1', 'p1')).toBe(true)
  await vi.runAllTimersAsync()
  expect(forfeit).not.toHaveBeenCalled()
})
```

Test expiry at 60 seconds, both players disconnected, new socket replacing old socket, server-side clock use, and finished-game no-op.

Write `TurnClock.test.ts` with fake timers for: `turnSeconds: null` starts no timer; a configured deadline produces one server-authored timeout loss; a disconnect pause freezes the remaining duration; reconnect resumes that remaining duration; a normal accepted turn cancels the old timer and starts the next player's timer.

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/game/ConnectionSupervisor.test.ts src/game/TurnClock.test.ts --run`

Expected: connection supervisor and turn clock are missing.

- [ ] **Implement connection supervision**

On participant disconnect: read `state.rules.timing.disconnectGraceSeconds`, mark the match paused, persist `status='paused'`, set an absolute deadline, and emit `game:paused`. Do not advance any rule state. On verified reconnect: cancel that player's timer, mark connected, persist active status when both are present, join the game room, emit `game:resumed`, and send a full fresh projection. On expiry: apply the snapshotted `disconnectExpiry` result and finish once.

`TurnClock` reads the match's snapshotted `timing.turnSeconds`, uses an injected monotonic clock, and stores the absolute deadline/remaining pause duration beside the session checkpoint. It submits a server-authored timeout result through `MatchCompletionService`; it never fabricates a player intent. Emit clock/deadline updates as public projection fields so reconnecting clients render server time rather than a local authoritative timer.

- [ ] **Run tests to verify GREEN and commit**

Run: `npm.cmd run test --workspace @uno-chess/server -- --run && npm.cmd run typecheck`

```powershell
git add apps/server packages/protocol
git commit -m "feat: support PvP reconnect grace period"
```

---

### Task 7: Build guest/account auth, lobby, and online game UI

**Files:**
- Create: `apps/web/src/auth/AuthProvider.tsx`
- Create: `apps/web/src/auth/SignInPanel.tsx`
- Create: `apps/web/src/online/socket.ts`
- Create: `apps/web/src/online/OnlineGamePage.tsx`
- Create: `apps/web/src/lobby/LobbyPage.tsx`
- Create: `apps/web/src/lobby/FriendRoomPanel.tsx`
- Create: `apps/web/src/lobby/QuickMatchPanel.tsx`
- Create: `apps/web/src/lobby/LobbyPage.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/package.json`

- [ ] **Write a failing lobby test**

```tsx
it('offers both friend and quick-match entrances to a guest', async () => {
  render(<LobbyPage auth={fakeGuestAuth()} socket={fakeLobbySocket()} />)
  expect(screen.getByRole('button', { name: '建立好友房' })).toBeVisible()
  expect(screen.getByRole('button', { name: '快速配對' })).toBeVisible()
  expect(screen.getByRole('button', { name: '註冊以保存戰績' })).toBeVisible()
})
```

- [ ] **Run component test to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/lobby/LobbyPage.test.tsx --run`

Expected: lobby components are missing.

- [ ] **Implement anonymous-first auth with optional registration**

```ts
const { data, error } = await supabase.auth.signInAnonymously()
if (error) throw error
```

Persist the anonymous session locally. Offer email/password registration that upgrades or links the current identity so the same profile ID retains match/tutorial data; do not create a second profile silently. Show account status and sign-out explicitly.

- [ ] **Implement one acknowledged-intent client path**

```ts
export async function sendGameIntent(input: GameIntentInput): Promise<void> {
  const ack = await socket.timeout(8_000).emitWithAck('game:intent', input)
  if (!ack.ok) throw new GameClientError(ack.error)
}
```

The online page uses server projections only. Optimistic UI may show a drag ghost/spinner, but it must not remove a card or move a piece until `game:projection` confirms the revision. On rejection, restore the drag visual immediately, announce the mapped error reason, and keep the last confirmed projection. Disable duplicate submission while the same intent ID is pending and retry with that same ID after a timeout.

- [ ] **Add friend-room override UI and quick queue cancellation**

Friend rooms select a named preset and expose approved switches/selects from the rules schema. Before creation, show the fully resolved summary; after another player joins, both sides see every difference and must explicitly ready on the same rules hash before the match starts. Quick match uses the standard preset and offers a visible cancel button while waiting.

- [ ] **Run component tests and build to verify GREEN**

Run: `npm.cmd run test --workspace @uno-chess/web -- --run && npm.cmd run typecheck && npm.cmd run build --workspace @uno-chess/web`

Expected: lobby/auth/online screen tests pass and Vite builds.

- [ ] **Commit**

```powershell
git add apps/web package.json package-lock.json
git commit -m "feat: add online lobby and guest play"
```

---

### Task 8: Add stats, achievements, multi-client E2E, and the PvP release gate

**Files:**
- Create: `apps/server/src/progression/AchievementEvaluator.ts`
- Create: `apps/server/src/progression/AchievementEvaluator.test.ts`
- Create: `apps/server/src/game/MatchCompletionService.ts`
- Create: `apps/web/src/profile/ProfilePage.tsx`
- Create: `e2e/online-friend-match.spec.ts`
- Create: `e2e/online-quick-match.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Write failing completion tests**

Test that one transaction finishes a match, stores result/replay hash, updates no result twice, calculates human PvP wins/losses/draws separately by entry kind, and unlocks an achievement idempotently from domain events.

```ts
it('unlocks first-checkmate once from persisted events', async () => {
  await completion.finish(checkmateFixture)
  await completion.finish(checkmateFixture)
  expect(await achievements.forPlayer('p1')).toEqual(['first-checkmate'])
})
```

- [ ] **Run focused tests to verify RED**

Run: `npm.cmd run test --workspace @uno-chess/server -- src/progression/AchievementEvaluator.test.ts --run`

Expected: progression services are missing.

- [ ] **Implement event-derived statistics and achievement definitions**

Keep raw match records as the source of truth. Profile queries aggregate finished `match_players`/`matches`; achievements evaluate stable event predicates and insert with `on conflict do nothing`. Seed only a small first-release set: first match, first checkmate, win after Betray, and revive two pieces.

- [ ] **Write two-browser friend-match and quick-match tests**

```ts
test('two guests join a friend code and see private projections', async ({ browser }) => {
  const p1 = await browser.newContext()
  const p2 = await browser.newContext()
  const page1 = await p1.newPage()
  const page2 = await p2.newPage()
  await page1.goto('/lobby')
  await page2.goto('/lobby')
  await page1.getByRole('button', { name: '建立好友房' }).click()
  const code = await page1.getByTestId('room-code').textContent()
  await page2.getByLabel('房間代碼').fill(code ?? '')
  await page2.getByRole('button', { name: '加入好友房' }).click()
  await expect(page1.getByTestId('opponent-hand')).toHaveAttribute('data-private', 'true')
  await expect(page2.getByTestId('opponent-hand')).toHaveAttribute('data-private', 'true')
})
```

The quick-match E2E opens two isolated contexts, queues both, verifies the same game ID, plays one acknowledged move, disconnects one client, verifies pause, reconnects inside 60 seconds, and verifies resume without revision change.

- [ ] **Configure Playwright to start web and server together**

Use two `webServer` entries: `npm.cmd run dev:server` on `127.0.0.1:3000` and `npm.cmd run dev:web -- --host 127.0.0.1` on `127.0.0.1:5173`. Point both at local Supabase test environment variables.

- [ ] **Run the complete PvP release gate**

Run:

```powershell
npx.cmd supabase db reset
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium
```

Expected: all commands exit 0; local-game tests remain green; friend room, quick match, private projection, acknowledgement, pause/reconnect, result, stat, and achievement tests pass.

- [ ] **Commit**

```powershell
git add apps packages supabase e2e playwright.config.ts package.json package-lock.json
git commit -m "feat: complete online PvP release gate"
```
