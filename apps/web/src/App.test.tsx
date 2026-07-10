/** @vitest-environment jsdom */
import { createElement, type ComponentType } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

describe('App', () => {
  it('renders the UNO Chess application heading', async () => {
    const appModule = await import('./App.js') as { App?: ComponentType }

    expect(appModule.App).toBeTypeOf('function')
    if (!appModule.App) return

    render(createElement(appModule.App))
    expect(screen.getByRole('heading', { name: 'UNO Chess' })).toBeTruthy()
  })

  it('renders the local game board and turn draw control', async () => {
    const appModule = await import('./App.js') as { App?: ComponentType }
    if (!appModule.App) throw new Error('APP_MODULE_MISSING')

    render(createElement(appModule.App))
    expect(screen.getByTestId('board')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draw card' })).toBeTruthy()
  })
})
