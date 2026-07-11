/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react'
import { buildTestState } from '@uno-chess/rules'
import { afterEach, describe, expect, it } from 'vitest'
import { TurnGuide } from './TurnGuide.js'

afterEach(cleanup)

describe('TurnGuide', () => {
  it.each([
    ['turn-start', '正在自動抽牌……'],
    ['await-overflow-discard', '手牌已滿，請選一張牌棄掉。'],
    ['await-action', '請打出一張可用手牌，或直接移動一枚棋子。'],
    ['await-action-move', '行動牌生效中，還能移動 2 次。'],
  ] as const)('guides phase %s in Traditional Chinese', (phase, message) => {
    const state = buildTestState({ phase })
    if (phase === 'await-action-move') {
      state.turn.actionBudget = 3
      state.turn.actionsUsed = 1
    }
    render(<TurnGuide state={state} />)
    expect(screen.getByText(message)).toBeTruthy()
  })

  it('guides wild-color and reinforcement choices', () => {
    const state = buildTestState({ phase: 'await-action' })
    state.turn.phase = 'await-effect-choice'
    state.turn.pendingEffect = { kind: 'wild-color', cardId: 'betray:test', nextOperationIndex: 1 }
    const { rerender } = render(<TurnGuide state={state} />)
    expect(screen.getByText('請選擇新的牌色。')).toBeTruthy()

    state.turn.pendingEffect = { kind: 'reinforce', cardId: 'reinforce:test', nextOperationIndex: 1 }
    rerender(<TurnGuide state={state} />)
    expect(screen.getByText('請選擇要復活的棋子，再放到亮起的格子。')).toBeTruthy()
  })

  it('tells a sealed player to move a chess piece instead of playing a card', () => {
    const state = buildTestState({ phase: 'await-action' })
    state.players[state.activePlayerId]!.statuses = [{ kind: 'sealed', remainingTurns: 1 }]

    render(<TurnGuide state={state} />)

    expect(screen.getByText('手牌已被封印，本回合請移動一枚棋子。')).toBeTruthy()
  })
})
