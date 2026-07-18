/** @vitest-environment jsdom */
import type { CardInstance } from '@uno-chess/protocol'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardHand } from './CardHand.js'

afterEach(cleanup)

const testCard: CardInstance = { id: 'action-2:red:test', kind: 'action-2', color: 'red' }
const cardName = '紅色行動牌 2，啟動連續行動，出牌後必須移動 1～2 步'
const TestableCardHand = CardHand as unknown as ComponentType<{
  cards: CardInstance[]
  playableCardIds: string[]
  unavailableReasonByCardId: Partial<Record<string, string>>
  onCommit: (cardId: string) => void
  onDragStateChange: () => void
  discardMode?: boolean
  onDiscard?: (cardId: string) => void
  onDiscardDrop?: (cardId: string) => void
  selectedDiscardCardId?: string | null
  selectedCardId?: string | null
  onSelect?: (cardId: string) => void
}>
const legacyProps = { selectedCardId: null, onSelect: () => undefined }

describe('CardHand', () => {
  it('previews a playable card on click without committing it', async () => {
    const onCommit = vi.fn()
    render(<TestableCardHand {...legacyProps} cards={[testCard]} playableCardIds={[testCard.id]} unavailableReasonByCardId={{}} onCommit={onCommit} onDragStateChange={() => undefined} />)
    const card = screen.getByRole('button', { name: cardName })

    await userEvent.click(card)

    expect(card.getAttribute('aria-pressed')).toBe('true')
    expect(card.classList.contains('previewing')).toBe(true)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps an illegal card previewable and explains why it cannot be played', async () => {
    render(<TestableCardHand
      {...legacyProps}
      cards={[testCard]}
      playableCardIds={[]}
      unavailableReasonByCardId={{ [testCard.id]: '這張牌不符合目前顏色或功能。' }}
      onCommit={() => undefined}
      onDragStateChange={() => undefined}
    />)
    const card = screen.getByRole('button', { name: cardName })

    expect(card.hasAttribute('disabled')).toBe(false)
    expect(card.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(card)

    expect(card.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('這張牌不符合目前顏色或功能。')).toBeTruthy()
  })

  it('closes a preview when the player clicks outside the hand', async () => {
    render(<><TestableCardHand {...legacyProps} cards={[testCard]} playableCardIds={[testCard.id]} unavailableReasonByCardId={{}} onCommit={() => undefined} onDragStateChange={() => undefined} /><button>棋盤外</button></>)
    const card = screen.getByRole('button', { name: cardName })
    await userEvent.click(card)

    await userEvent.click(screen.getByRole('button', { name: '棋盤外' }))

    expect(card.getAttribute('aria-pressed')).toBe('false')
  })

  it('selects a clicked card for confirmation without discarding it immediately', async () => {
    const onDiscardSelect = vi.fn()
    const onDiscardDrop = vi.fn()
    render(<TestableCardHand
      {...legacyProps}
      cards={[testCard]}
      playableCardIds={[]}
      unavailableReasonByCardId={{}}
      onCommit={() => undefined}
      onDiscard={onDiscardSelect}
      onDiscardDrop={onDiscardDrop}
      onDragStateChange={() => undefined}
      discardMode
    />)

    await userEvent.click(screen.getByRole('button', { name: `棄掉${cardName}` }))

    expect(onDiscardSelect).toHaveBeenCalledWith(testCard.id)
    expect(onDiscardDrop).not.toHaveBeenCalled()
  })

  it('visually marks the card currently awaiting discard confirmation', () => {
    render(<TestableCardHand
      {...legacyProps}
      cards={[testCard]}
      playableCardIds={[]}
      unavailableReasonByCardId={{}}
      onCommit={() => undefined}
      onDiscard={() => undefined}
      onDiscardDrop={() => undefined}
      onDragStateChange={() => undefined}
      discardMode
      selectedDiscardCardId={testCard.id}
    />)

    const card = screen.getByRole('button', { name: `棄掉${cardName}` })
    expect(card.getAttribute('aria-pressed')).toBe('true')
    expect(card.classList.contains('discard-selected')).toBe(true)
  })
})
