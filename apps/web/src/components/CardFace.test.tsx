/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CardFace, cardAccessibleLabel } from './CardFace.js'

afterEach(cleanup)

describe('CardFace', () => {
  it.each([
    ['action-2', '行動牌 2', '2×', '啟動連續行動', '出牌後必須移動 1～2 步'],
    ['action-3', '行動牌 3', '3×', '啟動連續行動', '出牌後必須移動 1～3 步'],
    ['reinforce-1', '援軍 +1', '+1', '復活最多 1 枚棋子', '結算後立即結束回合'],
    ['reinforce', '援軍 +2', '+2', '復活最多 2 枚棋子', '結算後立即結束回合'],
    ['seal', '封印', 'LOCK', '封印對手下回合手牌', '出牌後可移動 1 步，也可直接結束'],
    ['reverse', '交換', 'SWAP', '交換雙方手牌', '結算後立即結束回合'],
    ['betray', '變節', 'FLIP', '交換棋軍控制權', '選色後立即結束回合'],
  ] as const)('renders %s with a symbol and explicit movement rule', (kind, name, symbol, effect, movement) => {
    const card = { id: `${kind}:red:test`, kind, color: kind === 'betray' ? null : 'red' } as const
    render(<CardFace card={card} />)
    expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText(symbol)).toBeTruthy()
    expect(screen.getByText(effect)).toBeTruthy()
    expect(screen.getByText(movement)).toBeTruthy()
    expect(screen.getByText(symbol).textContent).not.toMatch(/[♔♕♖♗♘♙♚♛♜♝♞♟]/)
    expect(cardAccessibleLabel(card)).toContain(name)
    expect(cardAccessibleLabel(card)).toContain(movement)
  })
})
