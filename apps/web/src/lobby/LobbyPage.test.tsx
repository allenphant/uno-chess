/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LobbyPage } from './LobbyPage.js'

afterEach(cleanup)

describe('LobbyPage', () => {
  it('offers friend room and local game entrances', async () => {
    const onCreateFriendRoom = vi.fn()
    const onJoinFriendRoom = vi.fn()
    const onStartLocalGame = vi.fn()
    render(<LobbyPage onlineAvailable onCreateFriendRoom={onCreateFriendRoom} onJoinFriendRoom={onJoinFriendRoom} onStartLocalGame={onStartLocalGame} />)

    await userEvent.click(screen.getByRole('button', { name: '建立好友房' }))
    expect(onCreateFriendRoom).toHaveBeenCalledTimes(1)

    await userEvent.type(screen.getByRole('textbox', { name: '房間代碼' }), 'uno123')
    await userEvent.click(screen.getByRole('button', { name: '加入好友房' }))
    expect(onJoinFriendRoom).toHaveBeenCalledWith('UNO123')

    await userEvent.click(screen.getByRole('button', { name: '開始本機對戰' }))
    expect(onStartLocalGame).toHaveBeenCalledTimes(1)
  })

  it('keeps online entrances disabled until the server connects', () => {
    render(<LobbyPage onlineAvailable={false} onCreateFriendRoom={() => undefined} onJoinFriendRoom={() => undefined} onStartLocalGame={() => undefined} />)

    expect(screen.getByRole('button', { name: '建立好友房' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '加入好友房' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '開始本機對戰' }).hasAttribute('disabled')).toBe(false)
  })
})
