import type { GameEvent } from '@uno-chess/protocol'
import { describe, expect, it } from 'vitest'
import { buildTimeline } from './matchTimeline.js'

const base = { gameId: 'game' }

describe('buildTimeline', () => {
  it('groups cards, SAN moves and reinforcements into their played turns', () => {
    const events = [
      { ...base, sequence: 1, type: 'card-played', playerId: 'p1', cardId: 'c1', kind: 'action-2', color: 'yellow' },
      { ...base, sequence: 2, type: 'piece-moved', playerId: 'p1', from: 'g1', to: 'f3', san: 'Nf3' },
      { ...base, sequence: 3, type: 'turn-ended', playerId: 'p1', nextPlayerId: 'p2' },
      { ...base, sequence: 4, type: 'piece-reinforced', playerId: 'p2', pieceId: 'n1', piece: 'n', at: 'c6' },
    ] as GameEvent[]

    expect(buildTimeline(events)).toEqual([
      { sequence: 1, turnNumber: 1, playerId: 'p1', kind: 'card', cardKind: 'action-2', color: 'yellow' },
      { sequence: 2, turnNumber: 1, playerId: 'p1', kind: 'move', san: 'Nf3' },
      { sequence: 4, turnNumber: 2, playerId: 'p2', kind: 'reinforcement', piece: 'n', square: 'c6' },
    ])
  })
})
