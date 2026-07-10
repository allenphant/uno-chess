/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalGamePage } from './LocalGamePage.js'

afterEach(cleanup)

describe('LocalGamePage', () => {
  it('draws then submits a legal basic chess move through square clicks', async () => {
    render(<LocalGamePage seed="click-move" />)
    await userEvent.click(screen.getByRole('button', { name: 'Draw card' }))
    await userEvent.click(screen.getByRole('gridcell', { name: 'e2' }))
    await userEvent.click(screen.getByRole('gridcell', { name: 'e4' }))

    expect(screen.getByRole('gridcell', { name: 'e4' }).textContent).toBe('♙')
    expect(screen.getByText("Player p2's turn")).toBeTruthy()
  })
})
