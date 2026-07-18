export function CardPlayZone({ active, ready, mode = 'play' }: { active: boolean; ready: boolean; mode?: 'play' | 'discard' }) {
  if (!active) return null

  const discarding = mode === 'discard'

  return <div
    aria-label={discarding ? '棄牌區，棋盤暫停操作' : '卡牌出牌區'}
    className={`card-play-zone ${mode}${ready ? ' ready' : ''}`}
    data-card-drop-zone="true"
    role="status"
  >
    <div className="card-play-message">
      {discarding ? <span>棄牌階段</span> : null}
      <strong>{ready ? discarding ? '放開以棄掉' : '放開以出牌' : discarding ? '棋盤暫停' : '拖到這裡出牌'}</strong>
      {discarding ? <small>{ready ? '這張牌將直接進入棄牌堆' : '點手牌後確認，或拖到棋盤中央'}</small> : null}
    </div>
  </div>
}
