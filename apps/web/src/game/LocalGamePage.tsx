import { CardHand } from '../components/CardHand.js'
import { ChessBoard } from '../components/ChessBoard.js'
import { TurnPanel } from '../components/TurnPanel.js'
import { useLocalGame } from './useLocalGame.js'
import '../styles/game.css'
import { useState } from 'react'
import { getLegalBasicMoves } from '@uno-chess/rules'
import type { Square } from '@uno-chess/protocol'

export interface LocalGamePageProps {
  seed: string
}

export function LocalGamePage({ seed }: LocalGamePageProps) {
  const { state, view, error, dispatch, nextIntentId } = useLocalGame(seed)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const perspective = Object.entries(state.controllerByArmy).find(([, playerId]) => playerId === state.activePlayerId)?.[0] ?? 'white'
  const draw = () => dispatch({ type: 'draw-for-turn', playerId: state.activePlayerId, intentId: nextIntentId('draw') })
  const legalMoves = getLegalBasicMoves(state)
  const legalTargets = selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to) : []
  const chooseSquare = (square: Square) => {
    if (selectedSquare) {
      const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square)
      if (move) {
        dispatch({ type: 'basic-move', playerId: state.activePlayerId, intentId: nextIntentId('basic-move'), from: move.from, to: move.to })
        setSelectedSquare(null)
        return
      }
    }
    setSelectedSquare(legalMoves.some((move) => move.from === square) ? square : null)
  }

  return <main className="game-shell">
    <header><h1>UNO Chess</h1></header>
    <TurnPanel state={state} draw={draw} drawDisabled={state.turn.phase !== 'turn-start'} error={error} />
    <ChessBoard fen={view.board.fen} perspective={perspective as 'white' | 'black'} cardReady={selectedCardId !== null} selectedSquare={selectedSquare} legalTargets={legalTargets} onSquareClick={chooseSquare} />
    <CardHand cards={view.self.hand} selectedCardId={selectedCardId} onSelect={setSelectedCardId} />
  </main>
}
