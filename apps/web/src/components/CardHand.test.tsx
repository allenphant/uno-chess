/** @vitest-environment jsdom */
import type { CardInstance } from '@uno-chess/protocol'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardHand } from './CardHand.js'

afterEach(cleanup)

const testCard: CardInstance = { id: 'action-2:red:test', kind: 'action-2', color: 'red' }

describe('CardHand', () => {
  it('selects a card for board play without removing it from the hand', async () => {
    let selectedCardId: string | null = null
    const SelectableCardHand = CardHand as unknown as ComponentType<{
      cards: CardInstance[]
      selectedCardId: string | null
      playableCardIds: string[]
      onSelect: (cardId: string) => void
    }>
    render(<SelectableCardHand cards={[testCard]} selectedCardId={null} playableCardIds={[testCard.id]} onSelect={(cardId) => { selectedCardId = cardId }} />)

    await userEvent.click(screen.getByRole('button', { name: '紅色行動牌 2，最多移動兩次' }))

    expect(selectedCardId).toBe(testCard.id)
    expect(screen.getByRole('button', { name: '紅色行動牌 2，最多移動兩次' })).toBeTruthy()
  })

  it('disables cards that cannot be played on the current discard', () => {
    render(<CardHand cards={[testCard]} selectedCardId={null} playableCardIds={[]} onSelect={() => undefined} />)

    expect(screen.getByRole('button', { name: '紅色行動牌 2，最多移動兩次' }).getAttribute('disabled')).not.toBeNull()
  })
})
