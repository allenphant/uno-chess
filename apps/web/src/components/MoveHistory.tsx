import type { KeyboardEvent } from 'react'
import type { TimelineEntry } from '../game/matchTimeline.js'
import { cardColorName, cardName, pieceName, playerName } from '../presentation/uiText.js'

export interface MoveHistoryProps {
  entries: TimelineEntry[]
  selectedSequence: number | null
  onNavigate: (sequence: number | null) => void
}

export function MoveHistory({ entries, selectedSequence, onNavigate }: MoveHistoryProps) {
  const sequences = [0, ...entries.map((entry) => entry.sequence)]
  const currentIndex = selectedSequence === null ? sequences.length : Math.max(0, sequences.indexOf(selectedSequence))
  const previous = currentIndex <= 1 ? 0 : sequences[currentIndex - 1] ?? 0
  const next = currentIndex >= sequences.length - 1 ? null : sequences[currentIndex + 1] ?? null
  const navigateKey = (event: KeyboardEvent<HTMLElement>) => {
    const target = ({ Home: 0, ArrowLeft: previous, ArrowRight: next, End: null } as Partial<Record<string, number | null>>)[event.key]
    if (target === undefined) return
    event.preventDefault()
    onNavigate(target)
  }

  return <section className="move-history" role="region" aria-label="對局棋譜" tabIndex={0} onKeyDown={navigateKey}>
    <div className="history-heading"><div><span>對局紀錄</span><strong>棋譜與出牌</strong></div><span>{entries.length} 個事件</span></div>
    <div className="history-list">
      {entries.length === 0 ? <p className="history-empty">棋步會顯示在這裡</p> : groupEntries(entries).map((group) => <div className="history-turn" key={`${group.turnNumber}:${group.playerId}`}>
        <p>第 {group.turnNumber} 回合 · {playerName(group.playerId)}</p>
        <div className="history-events">{group.entries.map((entry) => <button className={selectedSequence === entry.sequence ? 'active' : ''} aria-current={selectedSequence === entry.sequence ? 'step' : undefined} aria-label={entryLabel(entry)} key={entry.sequence} onClick={() => onNavigate(entry.sequence)}>{entryLabel(entry)}</button>)}</div>
      </div>)}
    </div>
    <div className="history-controls" aria-label="棋譜導覽">
      <button aria-label="回到開局" disabled={selectedSequence === 0} onClick={() => onNavigate(0)}>｜◀</button>
      <button aria-label="上一步" disabled={selectedSequence === 0 || entries.length === 0} onClick={() => onNavigate(previous)}>◀</button>
      <button aria-label="下一步" disabled={selectedSequence === null || entries.length === 0} onClick={() => onNavigate(next)}>▶</button>
      <button aria-label="前往最新局面" disabled={selectedSequence === null} onClick={() => onNavigate(null)}>▶｜</button>
    </div>
  </section>
}

function entryLabel(entry: TimelineEntry): string {
  if (entry.kind === 'card') return `${cardColorName(entry.color)} ${cardName(entry.cardKind)}`
  if (entry.kind === 'move') return entry.san
  return `復活 ${pieceName(entry.piece)} → ${entry.square}`
}

function groupEntries(entries: TimelineEntry[]) {
  const groups: Array<{ turnNumber: number; playerId: string; entries: TimelineEntry[] }> = []
  for (const entry of entries) {
    const current = groups.at(-1)
    if (current?.turnNumber === entry.turnNumber && current.playerId === entry.playerId) current.entries.push(entry)
    else groups.push({ turnNumber: entry.turnNumber, playerId: entry.playerId, entries: [entry] })
  }
  return groups
}
