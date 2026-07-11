/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OverflowDiscard } from './OverflowDiscard.js'

describe('OverflowDiscard', () => {
  it('submits the selected hand card for the required overflow discard', async () => {
    const onDiscard = vi.fn()
    render(<OverflowDiscard cards={[{ id: 'c1', kind: 'seal', color: 'red' }]} onDiscard={onDiscard} />)
    await userEvent.click(screen.getByRole('button', { name: 'Discard seal' }))
    expect(onDiscard).toHaveBeenCalledWith('c1')
  })
})
