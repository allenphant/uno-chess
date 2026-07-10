/** @vitest-environment jsdom */
import { createElement, type ComponentType } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('App', () => {
  it('renders the UNO Chess application heading', async () => {
    const appModule = await import('./App.js') as { App?: ComponentType }

    expect(appModule.App).toBeTypeOf('function')
    if (!appModule.App) return

    render(createElement(appModule.App))
    expect(screen.getByRole('heading', { name: 'UNO Chess' })).toBeTruthy()
  })
})
