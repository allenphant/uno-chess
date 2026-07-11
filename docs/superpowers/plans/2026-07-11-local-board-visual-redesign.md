# Local Board Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local UNO Chess match screen board-first, readable, and responsive without changing reducer behavior or logical square coordinates.

**Architecture:** Keep `LocalGamePage` as the reducer-driven composition root. Extend `ChessBoard` only with presentational coordinate metadata, then replace the CSS layout and visual tokens around the existing semantic elements.

**Tech Stack:** React 19, TypeScript, CSS Grid, Vitest, Testing Library, Vite.

## Global Constraints

- Preserve all existing `GameIntent` dispatches and reducer behavior.
- Preserve `role="grid"`, 64 `role="gridcell"` buttons, logical `aria-label` square names, and click/drag fallbacks.
- Use no new runtime dependencies or bitmap assets.
- Every behavioral markup change starts with a failing test.

---

### Task 1: Add coordinate metadata to the semantic board

**Files:**
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Create: `apps/web/src/components/ChessBoard.test.tsx`

**Interfaces:**
- Consumes: existing `ChessBoardProps` and perspective ordering.
- Produces: 64 logical square buttons with optional `.coordinate-file` and `.coordinate-rank` spans on board edges.

- [ ] Write a component test asserting 64 cells, `a1`/`h8` logical names, and visible file/rank coordinate text.
- [ ] Run `npm.cmd run test --workspace @uno-chess/web -- src/components/ChessBoard.test.tsx --run` and confirm RED because coordinate elements do not exist.
- [ ] Add edge coordinate spans derived from the current visual `ranks` and `files` arrays.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Make the board the visual center of the match screen

**Files:**
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/components/TurnPanel.tsx`
- Modify: `apps/web/src/styles/game.css`

**Interfaces:**
- Consumes: existing board, hand, match state, and control components.
- Produces: `.game-arena`, `.board-stage`, `.match-sidebar`, and `.player-zone` layout regions.

- [ ] Add a component assertion for the board-stage and match-sidebar regions, then verify it fails.
- [ ] Group existing components into the named regions without changing callbacks or intent payloads.
- [ ] Replace the CSS with board-first desktop and single-column mobile layouts; add warm board colors, framed edges, coordinate labels, target dots, piece shadows, card elevation, and reduced-motion handling.
- [ ] Run all Web tests and typecheck.

### Task 3: Release verification

**Files:**
- Modify only files required by verification failures.

**Interfaces:**
- Consumes: completed visual redesign.
- Produces: a production-buildable manually reviewable local match.

- [ ] Run `npm.cmd run test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
- [ ] Check `git diff --check` and inspect the final diff for reducer or coordinate regressions.
- [ ] Reload `http://127.0.0.1:5173` and hand off the visual checkpoint.
