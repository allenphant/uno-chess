import type { GameState } from '@uno-chess/protocol'

export interface TurnPanelProps {
  state: GameState
  draw: () => void
  drawDisabled: boolean
  error: string | null
}

export function TurnPanel({ state, draw, drawDisabled, error }: TurnPanelProps) {
  return <aside className="turn-panel" aria-live="polite">
    <p>Player {state.activePlayerId}'s turn</p>
    <p>Phase: {state.turn.phase}</p>
    <p>Deck: {state.drawPile.length}</p>
    <button onClick={draw} disabled={drawDisabled}>Draw card</button>
    {error ? <p role="alert">{error}</p> : null}
  </aside>
}
