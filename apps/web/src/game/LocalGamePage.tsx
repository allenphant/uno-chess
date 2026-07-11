import { CardHand } from '../components/CardHand.js'
import { ChessBoard } from '../components/ChessBoard.js'
import { TurnPanel } from '../components/TurnPanel.js'
import { OverflowDiscard } from '../components/OverflowDiscard.js'
import { useLocalGame } from './useLocalGame.js'
import '../styles/game.css'
import { useEffect, useState } from 'react'
import { canPlayCard, getLegalActionMoves, getLegalBasicMoves, getLegalReinforcementOptions } from '@uno-chess/rules'
import type { CardColor, Square } from '@uno-chess/protocol'

export interface LocalGamePageProps {
  seed: string
}

export function LocalGamePage({ seed }: LocalGamePageProps) {
  const { state, view, error, dispatch, nextIntentId } = useLocalGame(seed)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [reinforcementPieceIds, setReinforcementPieceIds] = useState<string[]>([])
  const [reinforcementSquares, setReinforcementSquares] = useState<Square[]>([])
  const perspective = Object.entries(state.controllerByArmy).find(([, playerId]) => playerId === state.activePlayerId)?.[0] ?? 'white'
  const draw = () => dispatch({ type: 'draw-for-turn', playerId: state.activePlayerId, intentId: nextIntentId('draw') })
  const playableCardIds = state.turn.phase === 'await-action' && state.discardFace
    ? view.self.hand.filter((card) => canPlayCard(card, state.discardFace!, state.rules)).map((card) => card.id)
    : []
  const selectedCard = view.self.hand.find((card) => card.id === selectedCardId) ?? null
  const legalMoves = state.turn.phase === 'await-action' ? getLegalBasicMoves(state) : getLegalActionMoves(state)
  const reinforcementOptions = getLegalReinforcementOptions(state)
  const pendingReinforcementPieceId = reinforcementPieceIds[reinforcementSquares.length]
  const pendingReinforcement = reinforcementOptions.find((option) => option.pieceId === pendingReinforcementPieceId)
  const legalTargets = state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce'
    ? pendingReinforcement?.squares ?? []
    : selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to) : []

  useEffect(() => {
    setSelectedCardId(null)
    setSelectedSquare(null)
    setReinforcementPieceIds([])
    setReinforcementSquares([])
  }, [state.activePlayerId, state.turn.phase])

  const playCard = (cardId: string) => {
    const card = view.self.hand.find((candidate) => candidate.id === cardId)
    if (!card) return
    const definition = state.rules.cards.find((candidate) => candidate.kind === card.kind)
    if (!definition) return
    dispatch({
      type: definition.category === 'action' ? 'play-action-card' : 'play-function-card',
      playerId: state.activePlayerId,
      intentId: nextIntentId('play-card'),
      cardId: card.id,
    })
  }
  const playSelectedCard = () => selectedCard && playCard(selectedCard.id)

  const finishAction = () => dispatch({ type: 'finish-action-card', playerId: state.activePlayerId, intentId: nextIntentId('finish-action') })
  const discardOverflow = (cardId: string) => dispatch({ type: 'discard-overflow', playerId: state.activePlayerId, intentId: nextIntentId('overflow'), cardId })
  const chooseWildColor = (color: CardColor) => dispatch({ type: 'choose-wild-color', playerId: state.activePlayerId, intentId: nextIntentId('wild-color'), color })
  const toggleReinforcementPiece = (pieceId: string) => {
    if (reinforcementSquares.length > 0) return
    setReinforcementPieceIds((selected) => selected.includes(pieceId)
      ? selected.filter((id) => id !== pieceId)
      : selected.length < state.rules.reinforce.maximumPieces ? [...selected, pieceId] : selected)
  }
  const confirmReinforcement = () => dispatch({
    type: 'choose-reinforcement', playerId: state.activePlayerId, intentId: nextIntentId('reinforce'),
    capturedPieceIds: reinforcementPieceIds, squares: reinforcementSquares,
  })

  const chooseSquare = (square: Square) => {
    if (state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce') {
      if (pendingReinforcement?.squares.includes(square)) setReinforcementSquares((squares) => [...squares, square])
      return
    }
    if (selectedSquare) {
      const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square)
      if (move) {
        dispatch({ type: state.turn.phase === 'await-action-move' ? 'action-move' : 'basic-move', playerId: state.activePlayerId, intentId: nextIntentId('chess-move'), from: move.from, to: move.to })
        setSelectedSquare(null)
        return
      }
    }
    setSelectedSquare(legalMoves.some((move) => move.from === square) ? square : null)
  }

  return <main className="game-shell">
    <header className="game-masthead"><div className="brand-mark">U+C</div><div><p className="eyebrow">Local battle</p><h1>UNO Chess</h1></div></header>
    <div className="game-arena">
      <section className="board-stage" data-testid="board-stage" aria-label="Game board">
        <ChessBoard fen={view.board.fen} perspective={perspective as 'white' | 'black'} cardReady={selectedCardId !== null} selectedSquare={selectedSquare} legalTargets={legalTargets} onSquareClick={chooseSquare} />
      </section>
      <aside className="match-sidebar" data-testid="match-sidebar" aria-label="Match information">
        <TurnPanel state={state} draw={draw} drawDisabled={state.turn.phase !== 'turn-start'} error={error} />
        {state.turn.phase === 'await-overflow-discard' ? <OverflowDiscard cards={view.self.hand} onDiscard={discardOverflow} /> : null}
        <div className="discard-summary"><span>Top card</span><strong>{state.discardFace ? `${state.discardFace.color} ${state.discardFace.kind}` : 'None'}</strong></div>
      </aside>
    </div>
    <section className="player-zone" aria-label="Active player area">
      <div className="hand-heading"><div><p className="eyebrow">Player {state.activePlayerId}</p><h2>Your hand</h2></div><span>{view.self.hand.length}/{state.rules.hand.maximumSize} cards</span></div>
      <CardHand cards={view.self.hand} selectedCardId={selectedCardId} playableCardIds={playableCardIds} onCommit={playCard} onSelect={setSelectedCardId} />
      <section className="card-controls" aria-label="Card controls">
      <button disabled={!selectedCard} onClick={playSelectedCard}>Play selected card</button>
      {state.turn.phase === 'await-action-move' ? <button onClick={finishAction}>Finish card moves</button> : null}
      {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'wild-color' ? <div className="color-choice" aria-label="Choose wild color">
        {(['red', 'yellow', 'green', 'blue'] as CardColor[]).map((color) => <button className={color} key={color} onClick={() => chooseWildColor(color)}>{color}</button>)}
      </div> : null}
      {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce' ? <div className="reinforcement-choice" aria-label="Choose reinforcements">
        <p>Choose up to {state.rules.reinforce.maximumPieces} captured pieces, then place each on a highlighted square.</p>
        {reinforcementOptions.map((option) => <button aria-pressed={reinforcementPieceIds.includes(option.pieceId)} disabled={reinforcementSquares.length > 0} key={option.pieceId} onClick={() => toggleReinforcementPiece(option.pieceId)}>Revive {option.kind} ({option.pieceId})</button>)}
        <button disabled={reinforcementPieceIds.length === 0 || reinforcementPieceIds.length !== reinforcementSquares.length} onClick={confirmReinforcement}>Confirm reinforcement</button>
      </div> : null}
      </section>
    </section>
  </main>
}
