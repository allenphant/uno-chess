import type { CardInstance } from '@uno-chess/protocol'
import { cardColorName, cardName } from '../presentation/uiText.js'

export interface OverflowDiscardProps {
  selectedCard: CardInstance | null
  onCancel: () => void
  onConfirm: () => void
}

export function OverflowDiscard({ selectedCard, onCancel, onConfirm }: OverflowDiscardProps) {
  if (selectedCard) {
    return <div className="hand-discard-notice confirming" role="group" aria-label="棄牌確認">
      <span aria-hidden="true">?</span>
      <div className="discard-confirm-copy">
        <small>準備棄掉</small>
        <strong>{cardColorName(selectedCard.color)} {cardName(selectedCard.kind)}</strong>
      </div>
      <div className="discard-confirm-actions">
        <button className="secondary" onClick={onCancel}>取消</button>
        <button className="confirm" onClick={onConfirm}>確認棄牌</button>
      </div>
    </div>
  }

  return <div className="hand-discard-notice" role="status" aria-live="polite">
    <span aria-hidden="true">↓</span>
    <div>
      <strong>點一張手牌後確認</strong>
      <small>也可以把牌拖到已暗下的棋盤中央，放開後直接棄牌。</small>
    </div>
  </div>
}
