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
})
