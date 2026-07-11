import { CardHand } from '../components/CardHand.js'
import { CardPlayZone } from '../components/CardPlayZone.js'
import { ChessBoard } from '../components/ChessBoard.js'
import { TurnPanel } from '../components/TurnPanel.js'
import { OverflowDiscard } from '../components/OverflowDiscard.js'
import { TurnGuide } from '../components/TurnGuide.js'
import { MoveHistory } from '../components/MoveHistory.js'
import { PromotionChooser } from '../components/PromotionChooser.js'
import { useLocalGame } from './useLocalGame.js'
import '../styles/game.css'
import { useEffect, useMemo, useState } from 'react'
import { canPlayCard, getLegalActionMoves, getLegalBasicMoves, getLegalReinforcementOptions, projectPlayerView } from '@uno-chess/rules'
import type { CardColor, PromotionPiece, Square } from '@uno-chess/protocol'
import { cardColorName, cardName, pieceName, playerName } from '../presentation/uiText.js'
import type { CardDragVisualState } from '../input/useCardDrag.js'
import { buildTimeline } from './matchTimeline.js'
import { promotionChoicesForMove } from './promotion.js'

export interface LocalGamePageProps {
  seed: string
}

export function LocalGamePage({ seed }: LocalGamePageProps) {
  const { state, view, error, events, checkpoints, dispatch, nextIntentId } = useLocalGame(seed)
  const [historySequence, setHistorySequence] = useState<number | null>(null)
  const [activeCardDrag, setActiveCardDrag] = useState<CardDragVisualState | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [reinforcementPieceIds, setReinforcementPieceIds] = useState<string[]>([])
  const [reinforcementSquares, setReinforcementSquares] = useState<Square[]>([])
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; options: PromotionPiece[] } | null>(null)
  const timeline = useMemo(() => buildTimeline(events), [events])
  const historicalState = historySequence === null ? null : checkpoints.find((checkpoint) => checkpoint.sequence === historySequence)?.state ?? checkpoints[0]?.state ?? null
  const displayState = historicalState ?? state
  const displayView = useMemo(() => projectPlayerView(displayState, displayState.activePlayerId), [displayState])
  const reviewingHistory = historicalState !== null
  const perspective = Object.entries(displayState.controllerByArmy).find(([, playerId]) => playerId === displayState.activePlayerId)?.[0] ?? 'white'
  const cardsSealed = state.players[state.activePlayerId]?.statuses.some((status) => status.kind === 'sealed') ?? false
  const playableCardIds = !reviewingHistory && pendingPromotion === null && state.turn.phase === 'await-action' && !cardsSealed && state.discardFace
    ? view.self.hand.filter((card) => canPlayCard(card, state.discardFace!, state.rules)).map((card) => card.id)
    : []
  const unavailableReasonByCardId: Partial<Record<string, string>> = Object.fromEntries(view.self.hand
    .filter((card) => !playableCardIds.includes(card.id))
    .map((card) => [card.id, cardsSealed ? '本回合手牌已被封印。' : '這張牌不符合目前顏色或功能。']))
  const legalMoves = state.turn.phase === 'await-action' ? getLegalBasicMoves(state) : getLegalActionMoves(state)
  const reinforcementOptions = getLegalReinforcementOptions(state)
  const pendingReinforcementPieceId = reinforcementPieceIds[reinforcementSquares.length]
  const pendingReinforcement = reinforcementOptions.find((option) => option.pieceId === pendingReinforcementPieceId)
  const legalTargets = state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce'
    ? pendingReinforcement?.squares ?? []
    : selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to) : []

  useEffect(() => {
    setActiveCardDrag(null)
    setSelectedSquare(null)
    setReinforcementPieceIds([])
    setReinforcementSquares([])
    setPendingPromotion(null)
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

  const commitMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    const shared = { playerId: state.activePlayerId, intentId: nextIntentId('chess-move'), from, to, ...(promotion ? { promotion } : {}) }
    dispatch(state.turn.phase === 'await-action-move' ? { type: 'action-move', ...shared } : { type: 'basic-move', ...shared })
    setSelectedSquare(null)
    setPendingPromotion(null)
  }

  const requestMove = (from: Square, to: Square) => {
    const options = promotionChoicesForMove(legalMoves, from, to)
    if (options.length > 0) {
      setPendingPromotion({ from, to, options })
      return
    }
    commitMove(from, to)
  }

  const chooseSquare = (square: Square) => {
    if (state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce') {
      if (pendingReinforcement?.squares.includes(square)) setReinforcementSquares((squares) => [...squares, square])
      return
    }
    if (selectedSquare) {
      const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square)
      if (move) {
        requestMove(move.from, move.to)
        return
      }
    }
    setSelectedSquare(legalMoves.some((move) => move.from === square) ? square : null)
  }

  return <main className="game-shell">
    <header className="game-masthead"><div className="brand-mark">U+C</div><div><p className="eyebrow">本機對戰</p><h1>UNO 西洋棋</h1></div></header>
    <TurnGuide state={displayState} />
    <div className="game-arena">
      <section className="board-stage" data-testid="board-stage" aria-label="對戰棋盤">
        {reviewingHistory ? <div className="history-mode" role="status"><span>{historySequence === 0 ? '正在查看開局' : `正在查看第 ${historySequence} 個事件`}</span><button onClick={() => setHistorySequence(null)}>回到目前局面</button></div> : null}
        {pendingPromotion ? <PromotionChooser army={perspective as 'white' | 'black'} from={pendingPromotion.from} to={pendingPromotion.to} options={pendingPromotion.options} onChoose={(piece) => commitMove(pendingPromotion.from, pendingPromotion.to, piece)} onCancel={() => setPendingPromotion(null)} /> : null}
        <ChessBoard fen={displayView.board.fen} perspective={perspective as 'white' | 'black'} interactionLocked={activeCardDrag !== null || reviewingHistory || pendingPromotion !== null} legalMoves={reviewingHistory ? [] : legalMoves} selectedSquare={reviewingHistory ? null : selectedSquare} legalTargets={reviewingHistory ? [] : legalTargets} onMove={requestMove} onSquareClick={chooseSquare} />
        <CardPlayZone active={activeCardDrag !== null} ready={activeCardDrag?.overDropZone ?? false} />
      </section>
      <aside className="match-sidebar" data-testid="match-sidebar" aria-label="對局資訊">
        <TurnPanel state={displayState} error={error} />
        {state.turn.phase === 'await-overflow-discard' ? <OverflowDiscard cards={view.self.hand} onDiscard={discardOverflow} /> : null}
        <div className="discard-summary"><span>目前牌面</span><strong>{state.discardFace ? `${cardColorName(state.discardFace.color)} ${cardName(state.discardFace.kind)}` : '尚無牌面'}</strong></div>
        <MoveHistory entries={timeline} selectedSequence={historySequence} onNavigate={setHistorySequence} />
      </aside>
    </div>
    <section className="player-zone" aria-label="目前玩家操作區">
      <div className="hand-heading"><div><p className="eyebrow">{playerName(state.activePlayerId)}</p><h2>你的手牌</h2></div><span>{view.self.hand.length}/{state.rules.hand.maximumSize} 張</span></div>
      <CardHand cards={view.self.hand} playableCardIds={playableCardIds} unavailableReasonByCardId={unavailableReasonByCardId} onCommit={playCard} onDragStateChange={setActiveCardDrag} />
      <section className="card-controls" aria-label="卡牌操作">
      {state.turn.phase === 'await-action-move' ? <button onClick={finishAction}>提前結束行動牌</button> : null}
      {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'wild-color' ? <div className="color-choice" aria-label="選擇新的牌色">
        {(['red', 'yellow', 'green', 'blue'] as CardColor[]).map((color) => <button className={color} key={color} onClick={() => chooseWildColor(color)}>{cardColorName(color)}</button>)}
      </div> : null}
      {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce' ? <div className="reinforcement-choice" aria-label="選擇援軍">
        <p>最多選擇 {state.rules.reinforce.maximumPieces} 枚被吃掉的棋子，再依序放到亮起的格子。</p>
        {reinforcementOptions.map((option) => <button aria-pressed={reinforcementPieceIds.includes(option.pieceId)} disabled={reinforcementSquares.length > 0} key={option.pieceId} onClick={() => toggleReinforcementPiece(option.pieceId)}>復活{pieceName(option.kind)}</button>)}
        <button disabled={reinforcementPieceIds.length === 0 || reinforcementPieceIds.length !== reinforcementSquares.length} onClick={confirmReinforcement}>確認援軍位置</button>
      </div> : null}
      </section>
    </section>
  </main>
}
