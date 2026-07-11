/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MoveHistory } from './MoveHistory.js'
import type { TimelineEntry } from '../game/matchTimeline.js'

const entries: TimelineEntry[] = [
  { sequence: 3, turnNumber: 1, playerId: 'p1', kind: 'card', cardKind: 'action-2', color: 'yellow' },
  { sequence: 4, turnNumber: 1, playerId: 'p1', kind: 'move', san: 'Nf3' },
  { sequence: 8, turnNumber: 2, playerId: 'p2', kind: 'reinforcement', piece: 'n', square: 'c6' },
]

afterEach(cleanup)

describe('MoveHistory', () => {
  it('renders cards, SAN moves and reinforcement entries by turn', () => {
    render(<MoveHistory entries={entries} selectedSequence={null} onNavigate={() => undefined} />)
    expect(screen.getByText('黃色 行動牌 2')).toBeTruthy()
    expect(screen.getByText('Nf3')).toBeTruthy()
    expect(screen.getByText('復活 馬 → c6')).toBeTruthy()
    expect(screen.getByText('第 1 回合 · 玩家 1')).toBeTruthy()
  })

  it('navigates with four controls, entry clicks and keyboard shortcuts', async () => {
    const onNavigate = vi.fn()
    const { rerender } = render(<MoveHistory entries={entries} selectedSequence={4} onNavigate={onNavigate} />)

    await userEvent.click(screen.getByRole('button', { name: '回到開局' }))
    expect(onNavigate).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: '上一步' }))
    expect(onNavigate).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(onNavigate).toHaveBeenLastCalledWith(8)
    await userEvent.click(screen.getByRole('button', { name: '前往最新局面' }))
    expect(onNavigate).toHaveBeenLastCalledWith(null)
    await userEvent.click(screen.getByRole('button', { name: 'Nf3' }))
    expect(onNavigate).toHaveBeenLastCalledWith(4)

    fireEvent.keyDown(screen.getByRole('region', { name: '對局棋譜' }), { key: 'Home' })
    expect(onNavigate).toHaveBeenLastCalledWith(0)
    rerender(<MoveHistory entries={entries} selectedSequence={3} onNavigate={onNavigate} />)
    fireEvent.keyDown(screen.getByRole('region', { name: '對局棋譜' }), { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenLastCalledWith(4)
  })
})
