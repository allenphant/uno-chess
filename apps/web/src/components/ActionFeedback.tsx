import type { GameEvent } from '@uno-chess/protocol'

export type MoveFeedback =
  | { kind: 'chain'; sequence: number; count: number; san: string }
  | { kind: 'check-stop'; sequence: number }

export function latestActionFeedback(events: GameEvent[]): MoveFeedback | null {
  let actionStart = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type === 'card-played' && (event.kind === 'action-2' || event.kind === 'action-3')) {
      actionStart = index
      break
    }
  }
  if (actionStart < 0) return null

  const actionEvents: GameEvent[] = []
  for (let index = actionStart + 1; index < events.length; index += 1) {
    const event = events[index]
    if (!event) continue
    actionEvents.push(event)
    if (event.type === 'turn-ended') break
  }
  const check = actionEvents.find((event) => event.type === 'check-given')
  if (check) return { kind: 'check-stop', sequence: check.sequence }
  const moves = actionEvents.filter((event): event is Extract<GameEvent, { type: 'piece-moved' }> => event.type === 'piece-moved')
  const latest = moves.at(-1)
  return latest ? { kind: 'chain', sequence: latest.sequence, count: moves.length, san: latest.san } : null
}

export function ActionFeedback({ feedback }: { feedback: MoveFeedback | null }) {
  if (!feedback) return null
  if (feedback.kind === 'check-stop') {
    return <div className="action-feedback check-stop" role="status" aria-live="assertive" data-sequence={feedback.sequence}>
      <strong>將軍！</strong><span>連續行動強制中斷，回合立即結束</span><i aria-hidden="true" />
    </div>
  }
  const title = feedback.count >= 3 ? `三連擊 ×${feedback.count}` : feedback.count === 2 ? '連擊 ×2' : '連續行動開始'
  return <div className={`action-feedback chain chain-${Math.min(feedback.count, 3)}`} role="status" aria-live="polite" data-sequence={feedback.sequence}>
    <strong>{title}</strong><span>{feedback.san}</span>
    <div className="feedback-particles" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
  </div>
}
