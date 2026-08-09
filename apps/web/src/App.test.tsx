/** @vitest-environment jsdom */
import { createElement, type ComponentType } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

describe('App', () => {
  it('creates a fresh seed for each new local game', async () => {
    const appModule = await import('./App.js') as { createLocalGameSeed?: () => string }
    if (!appModule.createLocalGameSeed) throw new Error('LOCAL_GAME_SEED_FACTORY_MISSING')

    expect(appModule.createLocalGameSeed()).not.toBe(appModule.createLocalGameSeed())
  })

  it('renders the UNO Chess lobby', async () => {
    const appModule = await import('./App.js') as { App?: ComponentType }

    expect(appModule.App).toBeTypeOf('function')
    if (!appModule.App) return

    render(createElement(appModule.App))
    expect(screen.getByRole('heading', { name: 'UNO 西洋棋' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '建立好友房' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '開始本機對戰' })).toBeTruthy()
  })

  it('opens the local game from the lobby and returns', async () => {
    const appModule = await import('./App.js') as { App?: ComponentType }
    if (!appModule.App) throw new Error('APP_MODULE_MISSING')

    render(createElement(appModule.App))
    await userEvent.click(screen.getByRole('button', { name: '開始本機對戰' }))
    expect(screen.getByTestId('board')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('請打出一張可用手牌，或直接移動一枚棋子。')).toBeTruthy())
    expect(screen.queryByRole('button', { name: '抽牌' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '返回大廳' }))
    expect(screen.getByRole('button', { name: '開始本機對戰' })).toBeTruthy()
  })
})
