export function OverflowDiscard() {
  return <div className="hand-discard-notice" role="status" aria-live="polite">
    <span aria-hidden="true">↓</span>
    <div>
      <strong>直接點選一張手牌棄掉</strong>
      <small>所有手牌都可以選擇；選中後立即放進棄牌堆。</small>
    </div>
  </div>
}
