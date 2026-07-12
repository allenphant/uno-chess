/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalGamePage } from './LocalGamePage.js'

afterEach(cleanup)

describe('LocalGamePage', () => {
  it('renders a board-first arena with a separate match sidebar', () => {
    render(<LocalGamePage seed="layout" />)
    expect(screen.getByTestId('board-stage')).toBeTruthy()
    expect(screen.getByTestId('match-sidebar')).toBeTruthy()
  })

  it('plays cards directly without a selected-card confirmation control', async () => {
    render(<LocalGamePage seed="direct-card-play" />)
    await waitFor(() => expect(screen.getByText('請打出一張可用手牌，或直接移動一枚棋子。')).toBeTruthy())

    expect(screen.queryByRole('button', { name: '打出選取的牌' })).toBeNull()
  })

  it('automatically draws then submits a legal basic chess move through square clicks', async () => {
    render(<LocalGamePage seed="click-move" />)
    await waitFor(() => expect(screen.getByText('請打出一張可用手牌，或直接移動一枚棋子。')).toBeTruthy())
    await userEvent.click(screen.getByRole('gridcell', { name: 'e2' }))
    await userEvent.click(screen.getByRole('gridcell', { name: 'e4' }))

    expect(screen.getByTestId('board').querySelector('.piece.white[data-square="e4"]')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('輪到玩家 2')).toBeTruthy())
  })

  it('reviews a previous position from notation and returns to the live board', async () => {
    render(<LocalGamePage seed="history-navigation" />)
    await waitFor(() => expect(screen.getByText('請打出一張可用手牌，或直接移動一枚棋子。')).toBeTruthy())
    await userEvent.click(screen.getByRole('gridcell', { name: 'e2' }))
    await userEvent.click(screen.getByRole('gridcell', { name: 'e4' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'e4' })).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: '回到開局' }))
    expect(screen.getByText('正在查看開局')).toBeTruthy()
    expect(screen.getByTestId('board').querySelector('.piece.white[data-square="e2"]')).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: 'e2' }).hasAttribute('disabled')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: '回到目前局面' }))
    expect(screen.queryByText('正在查看開局')).toBeNull()
    expect(screen.getByTestId('board').querySelector('.piece.white[data-square="e4"]')).toBeTruthy()
  })
})
