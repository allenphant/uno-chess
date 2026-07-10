import { CardHand } from '../components/CardHand.js'
import { ChessBoard } from '../components/ChessBoard.js'
import { TurnPanel } from '../components/TurnPanel.js'
import { useLocalGame } from './useLocalGame.js'
import '../styles/game.css'
import { useState } from 'react'

export interface LocalGamePageProps {
  seed: string
}

export function LocalGamePage({ seed }: LocalGamePageProps) {
  const { state, view, error, dispatch, nextIntentId } = useLocalGame(seed)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const perspective = Object.entries(state.controllerByArmy).find(([, playerId]) => playerId === state.activePlayerId)?.[0] ?? 'white'
  const draw = () => dispatch({ type: 'draw-for-turn', playerId: state.activePlayerId, intentId: nextIntentId('draw') })

  return <main className="game-shell">
    <header><h1>UNO Chess</h1></header>
    <TurnPanel state={state} draw={draw} drawDisabled={state.turn.phase !== 'turn-start'} error={error} />
    <ChessBoard fen={view.board.fen} perspective={perspective as 'white' | 'black'} cardReady={selectedCardId !== null} />
    <CardHand cards={view.self.hand} selectedCardId={selectedCardId} onSelect={setSelectedCardId} />
  </main>
}
