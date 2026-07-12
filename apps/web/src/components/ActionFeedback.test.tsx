/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import type { GameEvent } from '@uno-chess/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionFeedback, latestActionFeedback } from './ActionFeedback.js'

afterEach(cleanup)

const base = { gameId: 'game', playerId: 'p1' }

describe('ActionFeedback', () => {
  it('escalates feedback for consecutive action moves', () => {
    const events = [
      { ...base, sequence: 1, type: 'card-played', cardId: 'a3', kind: 'action-3', color: 'red' },
      { ...base, sequence: 2, type: 'piece-moved', from: 'g1', to: 'f3', san: 'Nf3' },
      { ...base, sequence: 3, type: 'piece-moved', from: 'f3', to: 'g5', san: 'Ng5' },
    ] as GameEvent[]
    const feedback = latestActionFeedback(events)
    expect(feedback).toMatchObject({ kind: 'chain', count: 2, sequence: 3 })
    render(<ActionFeedback feedback={feedback} />)
    expect(screen.getByText('連擊 ×2')).toBeTruthy()
    expect(screen.getByText('Ng5')).toBeTruthy()
  })

  it('shows why check forcibly ended the action chain', () => {
    const events = [
      { ...base, sequence: 1, type: 'card-played', cardId: 'a2', kind: 'action-2', color: 'blue' },
      { ...base, sequence: 2, type: 'piece-moved', from: 'd1', to: 'h5', san: 'Qh5+' },
      { ...base, sequence: 3, type: 'check-given' },
      { ...base, sequence: 4, type: 'turn-ended', nextPlayerId: 'p2' },
    ] as GameEvent[]
    const feedback = latestActionFeedback(events)
    expect(feedback).toMatchObject({ kind: 'check-stop', sequence: 3 })
    render(<ActionFeedback feedback={feedback} />)
    expect(screen.getByText('將軍！')).toBeTruthy()
    expect(screen.getByText('連續行動強制中斷，回合立即結束')).toBeTruthy()
  })
})
