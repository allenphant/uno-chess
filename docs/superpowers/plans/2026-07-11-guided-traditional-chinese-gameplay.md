# Guided Traditional Chinese Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically draw at turn start and present the complete local gameplay loop in Traditional Chinese with phase guidance and readable chess-badge card faces.

**Architecture:** Keep the reducer as the only game-state authority. `useLocalGame` emits the automatic draw intent from a guarded effect, `uiText.ts` owns presentation strings and metadata, `TurnGuide` derives instructions from state, and `CardFace` renders card visuals while `CardHand` retains input behavior.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, existing `@uno-chess/rules` reducer.

## Global Constraints

- Do not change stable card IDs, phases, intents, events, or rule snapshots.
- Automatic draw must still use `draw-for-turn` and must occur exactly once per turn.
- All player-visible text is Traditional Chinese; internal errors are mapped rather than renamed.
- Preserve semantic buttons, disabled card behavior, pointer drag, keyboard focus, and `aria-live` guidance.
- No new runtime dependencies.

---

### Task 1: Automatically draw at turn start

**Files:**
- Modify: `apps/web/src/game/useLocalGame.ts`
- Create: `apps/web/src/game/useLocalGame.test.tsx`
- Modify: `apps/web/src/components/TurnPanel.tsx`

**Interfaces:**
- Consumes: `state.turn.phase`, `state.activePlayerId`, `dispatch(GameIntent)`.
- Produces: a hook that automatically sends one `draw-for-turn` intent whenever a new `turn-start` is observed.

- [ ] Write a hook test rendering `useLocalGame('auto-draw')`, then wait for phase `await-action` and assert the active hand increased from three to four exactly once.
- [ ] Run `npm.cmd run test --workspace @uno-chess/web -- src/game/useLocalGame.test.tsx --run`; expect RED because the hook remains at `turn-start`.
- [ ] Add a guarded `useEffect` keyed by active player and turn number; generate `seed:auto-draw:<turn>` as the stable intent ID and dispatch only in `turn-start`.
- [ ] Remove the manual draw callback and button from `TurnPanel` and `LocalGamePage`.
- [ ] Re-run focused tests; expect GREEN.

### Task 2: Centralize Traditional Chinese text and phase guidance

**Files:**
- Create: `apps/web/src/presentation/uiText.ts`
- Create: `apps/web/src/components/TurnGuide.tsx`
- Create: `apps/web/src/components/TurnGuide.test.tsx`
- Modify: `apps/web/src/components/TurnPanel.tsx`
- Modify: `apps/web/src/components/OverflowDiscard.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`

**Interfaces:**
- Produces: `playerName(id)`, `cardName(kind)`, `cardColorName(color)`, `gameErrorText(code)`, and `<TurnGuide state={state} />`.

- [ ] Write table tests for `turn-start`, `await-overflow-discard`, `await-action`, `await-action-move`, wild color, and reinforcement instructions.
- [ ] Run the focused TurnGuide test; expect RED because the component does not exist.
- [ ] Implement the centralized maps and pure phase-to-guidance function; render the guide with `aria-live="polite"`.
- [ ] Replace visible English strings in the local page, turn panel, overflow controls, effect controls, headings, discard summary, and errors.
- [ ] Run Web tests and typecheck; expect GREEN.

### Task 3: Build chess-badge card faces

**Files:**
- Create: `apps/web/src/components/CardFace.tsx`
- Create: `apps/web/src/components/CardFace.test.tsx`
- Modify: `apps/web/src/components/CardHand.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Consumes: `CardInstance`.
- Produces: `<CardFace card={card} />` with title, symbol, effect, color indicator, and a Chinese accessible label from `cardAccessibleLabel(card)`.

- [ ] Write a six-row table test checking the approved Chinese name, central symbol, effect summary, and accessible label for every core card kind.
- [ ] Run the CardFace test; expect RED because the component does not exist.
- [ ] Implement immutable metadata for `action-2`, `action-3`, `reinforce`, `seal`, `reverse`, and `betray`.
- [ ] Replace raw `{card.kind}` rendering with `CardFace` while leaving drag/select handlers on the outer button.
- [ ] Add three-zone card CSS and responsive typography; ensure the wild card uses a four-color background.
- [ ] Run all Web tests, typecheck, and build; expect GREEN.

### Task 4: Full verification and manual responsive review

**Files:**
- Modify only files required by verification failures.

**Interfaces:**
- Produces: a manually reviewable Traditional Chinese local match at `http://127.0.0.1:5173`.

- [ ] Run `npm.cmd run test`, `npm.cmd run typecheck`, and `npm.cmd run build`; require zero failures.
- [ ] Run `git diff --check` and verify no reducer, protocol, or rule snapshot file changed.
- [ ] Inspect desktop and 390×844 layouts in the local browser; confirm the current instruction and all card zones remain readable with no horizontal overflow.
- [ ] Commit the implementation as `feat: add guided Traditional Chinese gameplay`.
