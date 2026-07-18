/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardPlayZone } from './CardPlayZone.js'

afterEach(cleanup)

describe('CardPlayZone', () => {
  it('only exposes a drop zone during a card drag', () => {
    const { rerender } = render(<CardPlayZone active={false} ready={false} />)
    expect(screen.queryByRole('status', { name: '卡牌出牌區' })).toBeNull()

    rerender(<CardPlayZone active ready={false} />)
    const zone = screen.getByRole('status', { name: '卡牌出牌區' })
    expect(screen.getByText('拖到這裡出牌')).toBeTruthy()
    expect(zone.dataset.cardDropZone).toBe('true')

    rerender(<CardPlayZone active ready />)
    expect(screen.getByText('放開以出牌')).toBeTruthy()
    expect(zone.classList.contains('ready')).toBe(true)
  })

  it('keeps the board covered throughout the discard phase', () => {
    const { rerender } = render(<CardPlayZone active ready={false} mode="discard" />)
    const zone = screen.getByRole('status', { name: '棄牌區，棋盤暫停操作' })

    expect(screen.getByText('棋盤暫停')).toBeTruthy()
    expect(screen.getByText('點手牌後確認，或拖到棋盤中央')).toBeTruthy()
    expect(zone.classList.contains('discard')).toBe(true)

    rerender(<CardPlayZone active ready mode="discard" />)
    expect(screen.getByText('放開以棄掉')).toBeTruthy()
  })
})
