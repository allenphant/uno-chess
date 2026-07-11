# Local Board Visual Redesign

## Goal

Turn the local match screen from a developer-oriented control surface into a readable game board whose chess position, current turn, legal targets, and UNO hand can be understood at a glance.

## Layout

- Desktop uses a centered two-column arena: the chessboard is the dominant left surface and a compact match panel sits on the right.
- The hand and card controls span beneath the board, visually attached to the play area.
- Mobile collapses to one column, keeps the board as large as the viewport allows, and places match status above the hand.
- The board remains a true square and never stretches independently by axis.

## Chessboard

- Use warm ivory and walnut square colors inside a dark raised frame.
- Render file and rank coordinates inside the outermost squares without changing logical square IDs.
- Keep Unicode pieces for the planar first release, with high contrast and a subtle shadow.
- Selected squares use a gold inset ring. Legal targets show both a green inset ring and a centered dot so state is not communicated by color alone.
- Perspective reversal continues to reorder visual ranks/files while submitted coordinates remain logical.

## Match UI

- Present the active player, phase, remaining action moves, deck count, and draw action in a compact panel.
- Cards use stronger UNO-like rounded styling, clear labels, and raised selected/dragging states.
- Overflow, wild-color, and reinforcement controls retain their existing reducer intents.

## Accessibility and responsive behavior

- Preserve semantic grid/gridcell roles, square accessible names, focus rings, disabled card behavior, and tap/click fallbacks.
- At widths below 820px, use a single column. At very short screens, size the board from both viewport width and height.
- Respect `prefers-reduced-motion` for perspective and hover transitions.

## Verification

- Component tests verify 64 logical grid cells and coordinate labels at both perspectives.
- Existing move, card, overflow, drag, rules, typecheck, and production build suites must remain green.
