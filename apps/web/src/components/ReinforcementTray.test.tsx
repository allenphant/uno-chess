/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReinforcementTray } from './ReinforcementTray.js'

afterEach(cleanup)

describe('ReinforcementTray', () => {
  it('explains the active piece, shows assignments, supports undo and permits one-piece completion', async () => {
    const onUndo = vi.fn()
    const onConfirm = vi.fn()
    const onCancelSelection = vi.fn()
    const onReset = vi.fn()
    const { rerender } = render(<ReinforcementTray army="white" maximumPieces={2} activePiece={{ pieceId: 'n1', kind: 'n' }} assignments={[{ pieceId: 'p1', kind: 'p', square: 'c3' }]} onCancelSelection={onCancelSelection} onUndo={onUndo} onReset={onReset} onConfirm={onConfirm} />)

    expect(screen.getByText('正在放置白方馬')).toBeTruthy()
    expect(screen.getByText('♙ → c3')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '撤銷白方兵在 c3 的配置' }))
    expect(onUndo).toHaveBeenCalledWith('p1')
    await userEvent.click(screen.getByRole('button', { name: '重設所有復活位置' }))
    expect(onReset).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: '取消選擇' }))
    expect(onCancelSelection).toHaveBeenCalledOnce()
    rerender(<ReinforcementTray army="white" maximumPieces={2} activePiece={null} assignments={[{ pieceId: 'p1', kind: 'p', square: 'c3' }]} onCancelSelection={onCancelSelection} onUndo={onUndo} onReset={onReset} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '完成復活 1/2' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
