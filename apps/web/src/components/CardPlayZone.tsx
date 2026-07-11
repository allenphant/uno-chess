export function CardPlayZone({ active, ready }: { active: boolean; ready: boolean }) {
  if (!active) return null

  return <div
    aria-label="卡牌出牌區"
    className={`card-play-zone${ready ? ' ready' : ''}`}
    data-card-drop-zone="true"
    role="status"
  >
    <strong>{ready ? '放開以出牌' : '拖到這裡出牌'}</strong>
  </div>
}
