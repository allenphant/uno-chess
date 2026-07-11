import type { GameState } from '@uno-chess/protocol'
import { turnGuideText } from '../presentation/uiText.js'

export function TurnGuide({ state }: { state: GameState }) {
  return <section className="turn-guide" aria-live="polite" aria-label="目前行動提示">
    <span aria-hidden="true">✦</span>
    <p>{turnGuideText(state)}</p>
  </section>
}
