# Piece Drag and Random Deal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a fresh seed per local game, drag movable pieces directly to legal squares, and use the full chessboard as the card play zone.

**Architecture:** `App` owns a stable random seed for one mounted game. `usePieceDrag` owns threshold and global pointer lifecycle. `ChessBoard` derives destinations from `legalMoves`, and `LocalGamePage` dispatches direct moves while the card zone overlays the complete board stage.

**Tech Stack:** React 19, TypeScript 7, Vitest, Pointer Events, Vite CSS.

## Global Constraints

- Preserve deterministic replay once a seed has been created.
- Do not enforce color-balanced hands; remove only the fixed seed.
- Move the chess glyph, not a board square.
- Invalid piece drops and cancelled gestures dispatch nothing.
- The full-board card zone remains translucent and locks chess interaction.

---

### Task 1: Randomize the Local Game Seed

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces `createLocalGameSeed(): string` and one stable `useRef` seed per mounted App.

- [ ] **Step 1: Write the failing test**

```tsx
it('creates a fresh local seed each time', () => {
  expect(createLocalGameSeed()).not.toBe(createLocalGameSeed())
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/App.test.tsx --run`

Expected: FAIL because `createLocalGameSeed` is missing.

- [ ] **Step 3: Implement the seed factory**

```tsx
export function createLocalGameSeed(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function App() {
  const seed = useRef(createLocalGameSeed()).current
  return <LocalGamePage seed={seed} />
}
```

- [ ] **Step 4: Verify and commit**

Run the focused test and `npm.cmd run typecheck --workspace @uno-chess/web`; both must exit 0.

```powershell
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "fix: randomize local game seed"
```

---

### Task 2: Direct Piece Drag Lifecycle

**Files:**
- Modify: `apps/web/src/input/usePieceDrag.ts`
- Modify: `apps/web/src/input/usePieceDrag.test.tsx`

**Interfaces:**
- Consumes `{ enabled, from, legalTargets, onStart(from), onCommit({ from, to }) }`.
- Produces `{ dragging, offset, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, consumeClick }`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('starts after eight pixels and selects the source', () => {
  const onStart = vi.fn()
  const { result } = renderHook(() => usePieceDrag({ enabled: true, from: 'e2', legalTargets: ['e4'], onStart, onCommit: vi.fn() }))
  act(() => result.current.onPointerDown(pointer(10, 10)))
  act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 20 })))
  expect(result.current.dragging).toBe(true)
  expect(onStart).toHaveBeenCalledWith('e2')
})

it('commits a legal elementFromPoint target and consumes the click', () => {
  const target = document.createElement('button')
  target.dataset.square = 'e4'
  mockElementFromPoint(target)
  const onCommit = vi.fn()
  const { result } = renderHook(() => usePieceDrag({ enabled: true, from: 'e2', legalTargets: ['e4'], onStart: vi.fn(), onCommit }))
  act(() => result.current.onPointerDown(pointer(10, 10)))
  act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 30 })))
  act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 30, clientY: 30 })))
  expect(onCommit).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  expect(result.current.consumeClick()).toBe(true)
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/input/usePieceDrag.test.tsx --run`

Expected: FAIL because the hook lacks threshold, global hit testing, offset, start callback, and click consumption.

- [ ] **Step 3: Implement the lifecycle**

Use an 8px threshold, armed/dragging/click refs, synchronous window pointer listeners, and `document.elementFromPoint(clientX, clientY)?.closest('[data-square]')`. Commit exactly once only for a legal square; every completion path clears listeners and offset.

- [ ] **Step 4: Verify and commit**

Run the focused test and web typecheck; both must exit 0.

```powershell
git add apps/web/src/input/usePieceDrag.ts apps/web/src/input/usePieceDrag.test.tsx
git commit -m "feat: drag chess pieces to legal squares"
```

---

### Task 3: Board Integration and Full-Board Card Zone

**Files:**
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Modify: `apps/web/src/components/ChessBoard.test.tsx`
- Modify: `apps/web/src/components/CardPlayZone.tsx`
- Modify: `apps/web/src/components/CardPlayZone.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/styles/game.css`
- Modify: `apps/web/src/styles/game-css.test.js`

**Interfaces:**
- `ChessBoard` consumes `legalMoves`, `onSquareClick`, `onMove(from, to)`, and `interactionLocked`.
- `CardPlayZone` consumes `active` and `ready`, then covers `.board-stage` with a drop-zone marker.

- [ ] **Step 1: Write the failing contracts**

```tsx
it('marks a square movable only when it has a legal destination', () => {
  render(<ChessBoard fen={initialFen} perspective="white" interactionLocked={false} legalMoves={[{ from: 'e2', to: 'e4' }]} selectedSquare={null} legalTargets={[]} onMove={() => undefined} onSquareClick={() => undefined} />)
  expect(screen.getByRole('gridcell', { name: 'e2' }).classList.contains('movable')).toBe(true)
})
```

```js
expect(css).toContain('.card-play-zone { position: absolute; inset: 0;')
expect(css).toContain('.piece.dragging')
```

- [ ] **Step 2: Run focused tests**

Run: `npm.cmd run test --workspace @uno-chess/web -- src/components/ChessBoard.test.tsx src/components/CardPlayZone.test.tsx src/styles/game-css.test.js --run`

Expected: FAIL because direct move props, movable state, full inset, and glyph styling do not exist.

- [ ] **Step 3: Integrate the interaction**

Derive `directTargets` from `legalMoves` by source square. Start dragging by selecting the source, submit via a direct `onMove` callback, and put drag CSS variables only on the `.piece` span. In `LocalGamePage`, dispatch `basic-move` or `action-move` from `onMove`. Change the card-zone CSS to `inset: 0`, retain `pointer-events: auto`, and preserve the board lock.

- [ ] **Step 4: Run full verification and commit**

Run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run build`, and `git diff --check`; every command must exit 0.

```powershell
git add apps/web/src/components/ChessBoard.tsx apps/web/src/components/ChessBoard.test.tsx apps/web/src/components/CardPlayZone.tsx apps/web/src/components/CardPlayZone.test.tsx apps/web/src/game/LocalGamePage.tsx apps/web/src/styles/game.css apps/web/src/styles/game-css.test.js
git commit -m "feat: drag pieces and cover board for card play"
```
