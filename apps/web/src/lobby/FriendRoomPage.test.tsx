/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FriendRoomPage } from './FriendRoomPage.js'

afterEach(cleanup)

describe('FriendRoomPage', () => {
  it('shows the room code and keeps ready disabled until an opponent joins', async () => {
    const onCopyCode = vi.fn()
    render(<FriendRoomPage code="UNO123" members={[{ playerId: 'p1', displayName: '玩家一', ready: false, isSelf: true, isHost: true }]} rulesLabel="標準規則" onCopyCode={onCopyCode} onLeave={() => undefined} onReady={() => undefined} />)

    await userEvent.click(screen.getByRole('button', { name: '複製房間代碼 UNO123' }))
    expect(onCopyCode).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '我準備好了' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('等待加入')).toBeTruthy()
  })

  it('lets the player ready after both seats are occupied', async () => {
    const onReady = vi.fn()
    render(<FriendRoomPage code="UNO123" members={[
      { playerId: 'p1', displayName: '玩家一', ready: false, isSelf: true, isHost: true },
      { playerId: 'p2', displayName: '玩家二', ready: true, isSelf: false, isHost: false },
    ]} rulesLabel="標準規則" onCopyCode={() => undefined} onLeave={() => undefined} onReady={onReady} />)

    await userEvent.click(screen.getByRole('button', { name: '我準備好了' }))
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(screen.getByText('玩家二')).toBeTruthy()
    expect(screen.getByText('已準備')).toBeTruthy()
  })
})
