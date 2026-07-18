/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverflowDiscard } from './OverflowDiscard.js'

describe('OverflowDiscard', () => {
  it('guides the player to discard directly from their hand', () => {
    render(<OverflowDiscard />)

    expect(screen.getByRole('status').textContent).toContain('直接點選一張手牌棄掉')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
