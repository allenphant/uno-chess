import type { GameState } from '@uno-chess/protocol'
import { gameErrorText, playerName } from '../presentation/uiText.js'

export interface TurnPanelProps {
  state: GameState
  error: string | null
}

export function TurnPanel({ state, error }: TurnPanelProps) {
  return <aside className="turn-panel" aria-live="polite">
    <p>輪到{playerName(state.activePlayerId)}</p>
    <p>第 {state.turn.number} 回合</p>
    <p>牌庫：{state.drawPile.length} 張</p>
    {error ? <p role="alert">{gameErrorText(error)}</p> : null}
  </aside>
}
