import type { GameState } from '@uno-chess/protocol'
import { gameErrorText, playerName } from '../presentation/uiText.js'

export interface TurnPanelProps {
  state: GameState
  error: string | null
}

export function TurnPanel({ state, error }: TurnPanelProps) {
  return <aside className="turn-panel" aria-live="polite">
    <p className="sr-only">輪到{playerName(state.activePlayerId)}</p>
    <div className="turn-panel-heading">
      <span className="turn-avatar" aria-hidden="true">{state.activePlayerId === 'p1' ? '1' : '2'}</span>
      <div>
        <span>目前行動方</span>
        <strong>{playerName(state.activePlayerId)}</strong>
      </div>
      <i className="live-indicator">LIVE</i>
    </div>
    <div className="turn-metrics">
      <div><span>回合</span><strong>{state.turn.number}</strong></div>
      <div><span>牌庫</span><strong>{state.drawPile.length}<small> 張</small></strong></div>
    </div>
    {error ? <p className="turn-error" role="alert">{gameErrorText(error)}</p> : null}
  </aside>
}
