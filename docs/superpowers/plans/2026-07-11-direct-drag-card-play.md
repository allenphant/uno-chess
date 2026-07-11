# Direct Drag Card Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace selected-card confirmation with a Hearthstone-style gesture that previews on click and plays a legal card by dragging it into a temporary play zone over the chessboard.

**Architecture:** `useCardDrag` owns pointer gesture recognition and reports a small visual state upward. `CardHand` owns card preview and legality presentation. `LocalGamePage` coordinates the active drag with a new `CardPlayZone` overlay, while the rules engine remains the sole authority for card resolution.

**Tech Stack:** React 19, TypeScript 7, Pointer Events, Vitest, Testing Library, Vite, CSS.

## Global Constraints

- Clicking or tapping a card previews it and never submits it.
- Only a legal card can begin a play drag; illegal and sealed cards remain previewable.
- The play zone exists only during a legal drag and overlays the board without changing its geometry.
- Releasing inside submits exactly once; releasing outside or cancelling changes no game state.
- Mouse and touch share one Pointer Events implementation.
- No new runtime dependency is permitted.

## File Structure

- `apps/web/src/input/useCardDrag.ts`: pointer threshold, listeners, hit testing, and lifecycle.
- `apps/web/src/components/CardPlayZone.tsx`: waiting/ready board overlay.
- `apps/web/src/components/CardHand.tsx`: preview state, legality, and drag wiring.
- `apps/web/src/components/ChessBoard.tsx`: interaction lock during card drag.
- `apps/web/src/game/LocalGamePage.tsx`: drag coordination and card intent dispatch.
- Matching `*.test.tsx` files: behavior contracts.
- `apps/web/src/styles/game.css` and `game-css.test.js`: visual states and geometry contracts.

---

### Task 1: Threshold-Based Card Gesture Controller

**Files:**
- Modify: `apps/web/src/input/useCardDrag.ts`
- Modify: `apps/web/src/input/useCardDrag.test.tsx`

**Interfaces:**
- Consumes: `cardId`, `enabled`, `onCommit(cardId)`, `onStateChange(state)`.
- Produces: `CardDragVisualState = { cardId: string; overDropZone: boolean }`, plus `dragging`, `overDropZone`, `offset`, and pointer handlers.

- [ ] **Step 1: Write failing threshold and lifecycle tests**

```tsx
const pointer = (clientX: number, clientY: number) => ({
  clientX, clientY, pointerId: 1,
  currentTarget: { setPointerCapture: vi.fn() },
}) as unknown as React.PointerEvent

it('treats a short gesture as a click', () => {
  const onCommit = vi.fn()
  const onStateChange = vi.fn()
  const { result } = renderHook(() => useCardDrag({ cardId: 'c1', enabled: true, onCommit, onStateChange }))
  act(() => result.current.onPointerDown(pointer(10, 10)))
  act(() => window.dispatchEvent(new MouseEvent('pointerup', { clientX: 13, clientY: 13 })))
  expect(onStateChange).not.toHaveBeenCalled()
  expect(onCommit).not.toHaveBeenCalled()
})

it('starts after eight pixels and reports the play zone', () => {
  const zone = document.createElement('div')
  zone.dataset.cardDropZone = 'true'
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone)
  const onStateChange = vi.fn()
  const { result } = renderHook(() => useCardDrag({ cardId: 'c1', enabled: true, onCommit: vi.fn(), onStateChange }))
  act(() => result.current.onPointerDown(pointer(10, 10)))
  act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 20 })))
  expect(result.current.dragging).toBe(true)
  expect(onStateChange).toHaveBeenLastCalledWith({ cardId: 'c1', overDropZone: true })
})

it('never starts for an illegal card', () => {
  const onStateChange = vi.fn()
  const { result } = renderHook(() => useCardDrag({ cardId: 'c1', enabled: false, onCommit: vi.fn(), onStateChange }))
  act(() => result.current.onPointerDown(pointer(10, 10)))
  act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 80 })))
  expect(result.current.dragging).toBe(false)
  expect(onStateChange).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests and verify red**

Run `npm.cmd run test --workspace @uno-chess/web -- src/input/useCardDrag.test.tsx --run`.

Expected: FAIL because the new inputs, output state, and threshold do not exist.

- [ ] **Step 3: Implement the state machine**

```ts
export interface CardDragVisualState { cardId: string; overDropZone: boolean }
const DRAG_THRESHOLD = 8

const publishMove = (x: number, y: number) => {
  if (!armedRef.current) return
  const nextOffset = { x: x - originRef.current.x, y: y - originRef.current.y }
  if (!draggingRef.current && Math.hypot(nextOffset.x, nextOffset.y) < DRAG_THRESHOLD) return
  draggingRef.current = true
  setDragging(true)
  setOffset(nextOffset)
  const nextOver = Boolean(document.elementFromPoint?.(x, y)?.closest('[data-card-drop-zone="true"]'))
  setOverDropZone(nextOver)
  onStateChange({ cardId, overDropZone: nextOver })
}
```

Keep synchronous window listeners. Install them only when `enabled`. Commit once only when an active drag ends over the zone. Every finish, cancel, unmount, or duplicate pointerup path removes listeners and clears visual state.

- [ ] **Step 4: Run focused tests and typecheck**

Run the focused test command, then `npm.cmd run typecheck --workspace @uno-chess/web`.

Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/input/useCardDrag.ts apps/web/src/input/useCardDrag.test.tsx
git commit -m "feat: recognize intentional card drags"
```

---

### Task 2: Temporary Play Zone and Locked Chessboard

**Files:**
- Create: `apps/web/src/components/CardPlayZone.tsx`
- Create: `apps/web/src/components/CardPlayZone.test.tsx`
- Modify: `apps/web/src/components/ChessBoard.tsx`
- Modify: `apps/web/src/components/ChessBoard.test.tsx`

**Interfaces:**
- Consumes: `CardPlayZone({ active, ready })`, `ChessBoard({ interactionLocked })`.
- Produces: one temporary drop target and a chessboard that ignores card-drag-time clicks.

- [ ] **Step 1: Write failing overlay and lock tests**

```tsx
it('only exposes a drop zone during a drag', () => {
  const { rerender } = render(<CardPlayZone active={false} ready={false} />)
  expect(screen.queryByRole('status', { name: '卡牌出牌區' })).toBeNull()
  rerender(<CardPlayZone active ready={false} />)
  expect(screen.getByText('拖到這裡出牌')).toBeTruthy()
  expect(screen.getByRole('status', { name: '卡牌出牌區' }).dataset.cardDropZone).toBe('true')
  rerender(<CardPlayZone active ready />)
  expect(screen.getByText('放開以出牌')).toBeTruthy()
})

it('ignores square clicks while locked', async () => {
  const onSquareClick = vi.fn()
  render(<ChessBoard fen={initialFen} perspective="white" interactionLocked selectedSquare={null} legalTargets={[]} onSquareClick={onSquareClick} />)
  await userEvent.click(screen.getByRole('gridcell', { name: 'e2' }))
  expect(onSquareClick).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests and verify red**

Run `npm.cmd run test --workspace @uno-chess/web -- src/components/CardPlayZone.test.tsx src/components/ChessBoard.test.tsx --run`.

Expected: FAIL because the component and prop do not exist.

- [ ] **Step 3: Implement overlay and lock**

```tsx
export function CardPlayZone({ active, ready }: { active: boolean; ready: boolean }) {
  if (!active) return null
  return <div aria-label="卡牌出牌區" className={`card-play-zone${ready ? ' ready' : ''}`} data-card-drop-zone="true" role="status">
    <strong>{ready ? '放開以出牌' : '拖到這裡出牌'}</strong>
  </div>
}
```

Replace `cardReady` with `interactionLocked` in `ChessBoardProps`. Remove the board-wide drop marker. Pass the lock to each square and guard click and piece-drag handlers.

- [ ] **Step 4: Run tests and typecheck**

Expected: focused tests and web typecheck exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/CardPlayZone.tsx apps/web/src/components/CardPlayZone.test.tsx apps/web/src/components/ChessBoard.tsx apps/web/src/components/ChessBoard.test.tsx
git commit -m "feat: add temporary card play zone"
```

---

### Task 3: Previewable Hand and Direct Page Coordination

**Files:**
- Modify: `apps/web/src/components/CardHand.tsx`
- Modify: `apps/web/src/components/CardHand.test.tsx`
- Modify: `apps/web/src/game/LocalGamePage.tsx`
- Modify: `apps/web/src/game/LocalGamePage.test.tsx`

**Interfaces:**
- Consumes: `playableCardIds`, `unavailableReasonByCardId`, `onCommit(cardId)`, `onDragStateChange(CardDragVisualState | null)`.
- Produces: internal preview state and page-level `activeCardDrag`; removes selected-card confirmation.

- [ ] **Step 1: Write failing hand and page tests**

```tsx
it('previews on click without committing', async () => {
  const onCommit = vi.fn()
  render(<CardHand cards={[testCard]} playableCardIds={[testCard.id]} unavailableReasonByCardId={{}} onCommit={onCommit} onDragStateChange={() => undefined} />)
  const card = screen.getByRole('button', { name: '紅色行動牌 2，最多移動兩次' })
  await userEvent.click(card)
  expect(card.getAttribute('aria-pressed')).toBe('true')
  expect(card.classList.contains('previewing')).toBe(true)
  expect(onCommit).not.toHaveBeenCalled()
})

it('keeps an illegal card previewable', async () => {
  render(<CardHand cards={[testCard]} playableCardIds={[]} unavailableReasonByCardId={{ [testCard.id]: '這張牌不符合目前顏色或功能。' }} onCommit={() => undefined} onDragStateChange={() => undefined} />)
  const card = screen.getByRole('button', { name: '紅色行動牌 2，最多移動兩次' })
  expect(card.hasAttribute('disabled')).toBe(false)
  expect(card.getAttribute('aria-disabled')).toBe('true')
  await userEvent.click(card)
  expect(card.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText('這張牌不符合目前顏色或功能。')).toBeTruthy()
})

it('removes selected-card confirmation', async () => {
  render(<LocalGamePage seed="direct-card-play" />)
  await waitFor(() => expect(screen.getByLabelText('你的手牌')).toBeTruthy())
  expect(screen.queryByRole('button', { name: '打出選取的牌' })).toBeNull()
})
```

- [ ] **Step 2: Run tests and verify red**

Run `npm.cmd run test --workspace @uno-chess/web -- src/components/CardHand.test.tsx src/game/LocalGamePage.test.tsx --run`.

Expected: FAIL because the old props, disabled cards, and confirmation button remain.

- [ ] **Step 3: Move preview into `CardHand`**

Use this public contract:

```ts
export interface CardHandProps {
  cards: CardInstance[]
  playableCardIds: string[]
  unavailableReasonByCardId: Partial<Record<string, string>>
  onCommit: (cardId: string) => void
  onDragStateChange: (state: CardDragVisualState | null) => void
}
```

Store `previewedCardId` internally. Render every card as an enabled button for preview, add `aria-disabled` and `.unplayable` when illegal, and pass `enabled: playable` to `useCardDrag`. When an unavailable card is previewed, render its supplied reason beneath the card face. Clicking toggles `.previewing`. A document `pointerdown` listener closes preview only when the event target is outside the hand ref.

- [ ] **Step 4: Coordinate overlay in `LocalGamePage`**

```tsx
const [activeCardDrag, setActiveCardDrag] = useState<CardDragVisualState | null>(null)
const unavailableReasonByCardId = Object.fromEntries(view.self.hand
  .filter((card) => !playableCardIds.includes(card.id))
  .map((card) => [card.id, cardsSealed ? '本回合手牌已被封印。' : '這張牌不符合目前顏色或功能。']))

<section className="board-stage" data-testid="board-stage" aria-label="對戰棋盤">
  <ChessBoard {...boardProps} interactionLocked={activeCardDrag !== null} />
  <CardPlayZone active={activeCardDrag !== null} ready={activeCardDrag?.overDropZone ?? false} />
</section>

<CardHand cards={view.self.hand} playableCardIds={playableCardIds} unavailableReasonByCardId={unavailableReasonByCardId} onCommit={playCard} onDragStateChange={setActiveCardDrag} />
```

Delete `selectedCardId`, `playSelectedCard`, its reset logic, and the `打出選取的牌` button. Keep action-finish, color choice, and reinforcement controls unchanged.

- [ ] **Step 5: Run focused tests and typecheck**

Expected: focused tests and web typecheck exit 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/CardHand.tsx apps/web/src/components/CardHand.test.tsx apps/web/src/game/LocalGamePage.tsx apps/web/src/game/LocalGamePage.test.tsx
git commit -m "feat: play cards directly from the hand"
```

---

### Task 4: Motion, Responsive Styling, and Browser Acceptance

**Files:**
- Modify: `apps/web/src/styles/game.css`
- Modify: `apps/web/src/styles/game-css.test.js`

**Interfaces:**
- Consumes: `.previewing`, `.unplayable`, `.playable`, `.dragging`, `.card-play-zone`, `.card-play-zone.ready`.
- Produces: stable 5:7 cards, lifted preview, a board overlay, touch ownership, and reduced-motion behavior.

- [ ] **Step 1: Write failing CSS contract tests**

```js
it('layers the temporary play zone without changing board layout', () => {
  expect(css).toContain('.board-stage { position: relative;')
  expect(css).toContain('.card-play-zone { position: absolute;')
  expect(css).toContain('.card-play-zone.ready')
})

it('supports preview and reduced motion', () => {
  expect(css).toContain('.card.previewing')
  expect(css).toContain('@media (prefers-reduced-motion: reduce)')
})
```

- [ ] **Step 2: Run CSS test and verify red**

Run `npm.cmd run test --workspace @uno-chess/web -- src/styles/game-css.test.js --run`.

Expected: FAIL because the new selectors are absent.

- [ ] **Step 3: Implement visual states**

```css
.board-stage { position: relative; }
.card-play-zone { position: absolute; inset: 15%; z-index: 20; display: grid; place-items: center; pointer-events: auto; border: .2rem dashed #fbbf24; border-radius: 1.4rem; background: #0f172acc; color: #fef3c7; box-shadow: 0 0 0 999rem #02061755; }
.card-play-zone.ready { border-style: solid; border-color: #4ade80; background: #14532dcc; color: white; transform: scale(1.03); }
.card.previewing { z-index: 10; transform: translateY(-1.15rem) scale(1.08); }
.card.unplayable { filter: grayscale(.35) brightness(.68); }
.card.playable { touch-action: none; }
.card.dragging { z-index: 30; pointer-events: none; transform: translate(var(--drag-x), var(--drag-y)) rotate(3deg) scale(1.06); }
@media (prefers-reduced-motion: reduce) { .card, .card-play-zone { transition: none; } }
```

Keep the 5:7 ratio. Use small negative hand margins only when five cards otherwise overflow; retain horizontal scroll as fallback.

- [ ] **Step 4: Run all automated verification**

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: zero failures and every command exits 0.

- [ ] **Step 5: Run real browser acceptance**

At `http://127.0.0.1:5173/`:

1. Click a legal card: it lifts, no turn changes, and no confirmation button exists.
2. Drag fewer than eight pixels: no play zone and no card submission.
3. Drag a legal card: the play zone appears and the board stops accepting clicks.
4. Release outside: the card returns and the turn is unchanged.
5. Release inside: exactly one card intent resolves into the correct next phase.
6. Preview an illegal or sealed card: no play zone appears.
7. Measure all 64 squares before/during overlay; variation remains below 0.1px.
8. Repeat valid and cancelled drags at a narrow mobile width.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/styles/game.css apps/web/src/styles/game-css.test.js
git commit -m "feat: polish direct card play feedback"
```

---

### Task 5: Final Regression Gate

**Files:**
- Verify only; modify a file only when a failing check identifies a defect covered by this plan.

**Interfaces:**
- Consumes: the complete direct-play interaction.
- Produces: clean branch and exact user acceptance scope.

- [ ] **Step 1: Reload and play four turns**

Exercise a cancelled drag, a function card, an action card plus legal chess move, and a sealed/basic-move turn when the deterministic deck permits it.

- [ ] **Step 2: Run a fresh final gate**

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
git diff --check
git status --short
```

Expected: all commands exit 0 and status prints nothing.

- [ ] **Step 3: Hand off acceptance scope**

Ask the user to validate click-to-preview, drag-to-play, overlay feedback, outside-drop rollback, phase changes, board stability, and touch usability. Explicitly exclude final art, sound, online play, AI, tutorial campaign, balance, and cosmetics.
