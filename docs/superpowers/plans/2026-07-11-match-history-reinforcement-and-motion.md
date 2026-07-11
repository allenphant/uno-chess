# Match History, Reinforcement, and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Traditional Chinese UNO Chess board with correct promotion, navigable card-and-move history, captured-piece displays, staged reinforcement placement, semantic card faces, and animated chess moves.

**Architecture:** Extend the local-game hook into an append-only UI session timeline containing rule events and immutable game checkpoints. Keep rule legality in `@uno-chess/rules`, while focused React components render history, graveyards, promotion and reinforcement controls. Render stable piece identities in a board piece layer so state changes animate without affecting square geometry.

**Tech Stack:** React 19, TypeScript 7, Vitest, Testing Library, chess.js through `@uno-chess/rules`, CSS transitions.

## Global Constraints

- All user-facing copy is Traditional Chinese.
- Chess legality and SAN continue to come from the rules package.
- History events must carry renderable card metadata and must not parse opaque card IDs.
- Historical positions are read-only and have an explicit return-to-live control.
- Movement duration is 220ms and is disabled by `prefers-reduced-motion: reduce`.
- Production behavior follows red-green-refactor TDD.

---

### Task 1: Renderable event timeline and checkpoints

**Files:**
- Modify: `packages/protocol/src/events.ts`
- Modify: `packages/rules/src/game/reducer.ts`
- Modify: `apps/web/src/game/useLocalGame.ts`
- Create: `apps/web/src/game/matchTimeline.ts`
- Test: `packages/rules/src/game/reducer-turn.test.ts`
- Test: `apps/web/src/game/useLocalGame.test.tsx`
- Create: `apps/web/src/game/matchTimeline.test.ts`

**Interfaces:**
- Produce `card-played` events with `kind: CardKind` and `color: CardColor | null`.
- Produce `LocalGameSession` fields `events: GameEvent[]` and `checkpoints: GameCheckpoint[]`.
- Produce `buildTimeline(events, checkpoints): TimelineEntry[]` for presentation.

- [ ] **Step 1: Write failing protocol/rules tests** asserting `card-played` contains card kind and color.
- [ ] **Step 2: Run `npm.cmd test --workspace @uno-chess/rules -- --run reducer-turn.test.ts`** and confirm the missing fields fail.
- [ ] **Step 3: Enrich the event type and reducer emission** using the played `CardInstance` values.
- [ ] **Step 4: Run the targeted rules test** and confirm it passes.
- [ ] **Step 5: Write failing hook and timeline tests** for append-only events, immutable checkpoints, turn grouping, SAN moves, card labels and reinforcement entries.
- [ ] **Step 6: Run `npm.cmd test --workspace @uno-chess/web -- --run src/game/useLocalGame.test.tsx src/game/matchTimeline.test.ts`** and confirm the new API is absent.
- [ ] **Step 7: Implement the minimal session reducer and pure timeline builder.** A checkpoint stores `{ sequence, state }` after every visible action event; timeline entries reference the checkpoint sequence rather than recomputing chess.
- [ ] **Step 8: Run targeted tests and commit** with `feat: record local match timeline`.

### Task 2: Chess.com-style notation controls

**Files:**
- Create: `apps/web/src/components/MoveHistory.tsx`
- Create: `apps/web/src/components/MoveHistory.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Consume `TimelineEntry[]`, `selectedSequence: number | null`, and navigation callbacks.
- Produce click navigation plus `Home`, `ArrowLeft`, `ArrowRight`, and `End` keyboard navigation.

- [ ] **Step 1: Write failing component tests** for UNO card rows, SAN rows, active-step highlighting, all four navigation buttons and keyboard shortcuts.
- [ ] **Step 2: Run the MoveHistory test** and verify failure because the component is missing.
- [ ] **Step 3: Implement `MoveHistory`** with Traditional Chinese labels and native buttons.
- [ ] **Step 4: Add a failing LocalGamePage test** proving historical FEN is rendered, interaction is locked, and “回到目前局面” restores live state.
- [ ] **Step 5: Wire checkpoint selection into LocalGamePage** without mutating the live game.
- [ ] **Step 6: Run component/page tests and commit** with `feat: add navigable match history`.

### Task 3: Promotion chooser

**Files:**
- Create: `apps/web/src/components/PromotionChooser.tsx`
- Create: `apps/web/src/components/PromotionChooser.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- `requestMove(from, to)` detects legal moves with promotion variants.
- `PromotionChooser` returns `'q' | 'r' | 'b' | 'n'` or cancel.

- [ ] **Step 1: Write failing chooser and page tests** showing a last-rank pawn opens four choices and no move intent is sent before selection.
- [ ] **Step 2: Run targeted tests** and confirm direct move dispatch causes the regression.
- [ ] **Step 3: Implement pending-promotion state** shared by click and drag, then dispatch the selected promotion in both basic and action phases.
- [ ] **Step 4: Run targeted tests and commit** with `fix: require a promotion choice before moving`.

### Task 4: Captured-piece graveyards and material count

**Files:**
- Create: `apps/web/src/components/PlayerGraveyard.tsx`
- Create: `apps/web/src/components/PlayerGraveyard.test.tsx`
- Create: `apps/web/src/presentation/chessPieces.ts`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Produce shared `pieceGlyph(army, kind)` and `materialValue(kind)` helpers.
- `PlayerGraveyard` consumes one army's `PieceRecord[]`, material delta, eligible IDs and optional selection callback.

- [ ] **Step 1: Write failing helper/component tests** for grouped captured pieces, correct glyph colors, material values and eligible buttons.
- [ ] **Step 2: Run targeted tests** and confirm missing exports/components.
- [ ] **Step 3: Implement helpers and graveyard** and place army strips adjacent to their board side.
- [ ] **Step 4: Run targeted tests and commit** with `feat: show captured pieces and material`.

### Task 5: Staged reinforcement placement with ghosts

**Files:**
- Create: `apps/web/src/components/ReinforcementTray.tsx`
- Create: `apps/web/src/components/ReinforcementTray.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Modify: `apps/web/src/components/ChessBoard.test.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Use `ReinforcementAssignment = { pieceId: string; kind: ChessPieceKind; square: Square }`.
- ChessBoard consumes `ghostPieces`, `hoverGhost`, and `onSquareHover` while keeping ordinary move behavior unchanged.

- [ ] **Step 1: Write failing tray tests** for selecting one piece, `1/2` completion, second selection, undo and exact dispatch ordering.
- [ ] **Step 2: Write failing board tests** for legal-target ghost rendering on pointer hover and persistent assigned ghosts.
- [ ] **Step 3: Run the targeted tests** and verify missing staged behavior.
- [ ] **Step 4: Implement assignment state** so occupied assignment squares are filtered, one assignment can finish, and undo restores the graveyard choice.
- [ ] **Step 5: Implement hover/persistent ghost rendering** with `aria-hidden` visuals and textual tray status.
- [ ] **Step 6: Run targeted tests and commit** with `feat: stage reinforcement placements`.

### Task 6: Semantic card faces

**Files:**
- Modify: `apps/web/src/components/CardFace.tsx`
- Modify: `apps/web/src/components/CardFace.test.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Card symbols are exactly `2×`, `3×`, `+2`, `LOCK`, `SWAP`, and `FLIP` for the six core kinds.

- [ ] **Step 1: Replace existing expectations with failing semantic symbol/effect tests.** Assert no chess glyph appears in any core card face.
- [ ] **Step 2: Run CardFace tests** and confirm old decorative glyphs fail.
- [ ] **Step 3: Implement the semantic copy and tune typography** for short and long symbols.
- [ ] **Step 4: Run targeted tests and commit** with `fix: align card art with card effects`.

### Task 7: Stable piece layer and move animation

**Files:**
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Modify: `apps/web/src/components/ChessBoard.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/styles/game.css`
- Modify: `apps/web/src/styles/game-css.test.js`

**Interfaces:**
- ChessBoard consumes `activePieces` so DOM identity uses `PieceRecord.id` and position uses CSS `--file-index`/`--rank-index`.
- Square buttons remain a fixed 8×8 background/interaction layer; pieces render in a pointer-aware absolute overlay.

- [ ] **Step 1: Write failing board tests** asserting a stable piece ID remains mounted while its `data-square` changes, castling moves two identities, and interaction still commits legal drops.
- [ ] **Step 2: Write failing CSS contract tests** for a 220ms transform transition and reduced-motion override.
- [ ] **Step 3: Run targeted tests** and confirm current per-square rendering cannot satisfy identity retention.
- [ ] **Step 4: Split square and piece layers** while retaining click selection, drag offsets, legal markers, coordinates and card overlay ordering.
- [ ] **Step 5: Add movement, capture fade, reinforcement entrance and post-move promotion styling.** Do not use timers to delay game state.
- [ ] **Step 6: Run targeted tests and commit** with `feat: animate chess piece movement`.

### Task 8: Responsive integration and acceptance verification

**Files:**
- Modify: `apps/web/src/game/LocalGamePage.test.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles/game.css`
- Modify: `docs/superpowers/specs/2026-07-11-match-history-reinforcement-and-motion-design.md` only if verified behavior needs clarification

**Interfaces:**
- No new public interfaces; this task validates the assembled experience.

- [ ] **Step 1: Add failing integration tests** for live/history locking, promotion, graveyard eligibility, one-piece reinforcement, card log ordering and return-to-live.
- [ ] **Step 2: Run integration tests** and fix only assembly defects exposed by those tests.
- [ ] **Step 3: Run `npm.cmd test`**, expecting zero failures across every workspace.
- [ ] **Step 4: Run `npm.cmd run typecheck` and `npm.cmd run build`**, expecting exit code 0 for both.
- [ ] **Step 5: Inspect desktop and narrow viewport in the local browser** and manually execute drag move, history navigation, promotion fixture where available, and reinforcement fixture where available.
- [ ] **Step 6: Review the final diff against every acceptance item** and commit with `feat: complete match information experience` if integration changes remain.
