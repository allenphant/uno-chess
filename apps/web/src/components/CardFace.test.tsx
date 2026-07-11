/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardFace, cardAccessibleLabel } from './CardFace.js'

afterEach(cleanup)

describe('CardFace', () => {
  it.each([
    ['action-2', '行動牌 2', '♞ ×2', '最多移動兩次'],
    ['action-3', '行動牌 3', '♜ ×3', '最多移動三次'],
    ['reinforce', '援軍 +2', '♟ ↥ ♞', '復活最多兩枚棋子'],
    ['seal', '封印', '♚ ⛓', '對手下回合不能出牌'],
    ['reverse', '交換', '⇄', '雙方交換整副手牌'],
    ['betray', '變節', '♚ ⇄ ♔', '交換軍隊並選擇牌色'],
  ] as const)('renders %s as a chess-badge card', (kind, name, symbol, effect) => {
    const card = { id: `${kind}:red:test`, kind, color: kind === 'betray' ? null : 'red' } as const
    render(<CardFace card={card} />)
    expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText(symbol)).toBeTruthy()
    expect(screen.getByText(effect)).toBeTruthy()
    expect(cardAccessibleLabel(card)).toContain(name)
  })
})
