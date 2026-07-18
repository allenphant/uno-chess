/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OverflowDiscard } from './OverflowDiscard.js'

describe('OverflowDiscard', () => {
  it('guides the player to click for confirmation or drag to discard', () => {
    render(<OverflowDiscard selectedCard={null} onCancel={() => undefined} onConfirm={() => undefined} />)

    expect(screen.getByRole('status').textContent).toContain('點一張手牌後確認')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('requires an explicit confirmation after a card is selected', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<OverflowDiscard
      selectedCard={{ id: 'c1', kind: 'seal', color: 'red' }}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />)

    expect(screen.getByRole('group', { name: '棄牌確認' }).textContent).toContain('紅色 封印')
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '確認棄牌' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
