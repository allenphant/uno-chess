/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromotionChooser } from './PromotionChooser.js'

afterEach(cleanup)

describe('PromotionChooser', () => {
  it('offers all legal promotion pieces and waits for the player choice', async () => {
    const onChoose = vi.fn()
    render(<PromotionChooser army="white" from="a7" to="a8" options={['q', 'r', 'b', 'n']} onChoose={onChoose} onCancel={() => undefined} />)

    expect(screen.getByText('a7 → a8：選擇升變棋子')).toBeTruthy()
    expect(onChoose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '升變為皇后' }))
    expect(onChoose).toHaveBeenCalledWith('q')
    expect(screen.getByRole('button', { name: '升變為城堡' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '升變為主教' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '升變為馬' })).toBeTruthy()
  })
})
