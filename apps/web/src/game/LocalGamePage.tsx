import { CardHand } from '../components/CardHand.js'
import { CardPlayZone } from '../components/CardPlayZone.js'
import { ChessBoard } from '../components/ChessBoard.js'
import { TurnPanel } from '../components/TurnPanel.js'
import { OverflowDiscard } from '../components/OverflowDiscard.js'
import { TurnGuide } from '../components/TurnGuide.js'
import { MoveHistory } from '../components/MoveHistory.js'
import { PromotionChooser } from '../components/PromotionChooser.js'
import { PlayerGraveyard } from '../components/PlayerGraveyard.js'
import { ReinforcementTray, type ReinforcementAssignment } from '../components/ReinforcementTray.js'
import { ActionFeedback, latestActionFeedback } from '../components/ActionFeedback.js'
import { useLocalGame } from './useLocalGame.js'
import '../styles/game.css'
import { useEffect, useMemo, useState } from 'react'
import { canPlayCard, getLegalActionMoves, getLegalBasicMoves, getLegalReinforcementOptions, projectPlayerView } from '@uno-chess/rules'
import type { CardColor, ChessPieceKind, PromotionPiece, Square } from '@uno-chess/protocol'
import { cardColorName, cardName, playerName } from '../presentation/uiText.js'
import type { CardDragVisualState } from '../input/useCardDrag.js'
import { buildTimeline } from './matchTimeline.js'
import { promotionChoicesForMove } from './promotion.js'
import { materialValue } from '../presentation/chessPieces.js'

export interface LocalGamePageProps {
  seed: string
}

export function LocalGamePage({ seed }: LocalGamePageProps) {
  const { state, view, error, events, checkpoints, dispatch, nextIntentId } = useLocalGame(seed)
  const [historySequence, setHistorySequence] = useState<number | null>(null)
  const [activeCardDrag, setActiveCardDrag] = useState<CardDragVisualState | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [selectedReinforcementPieceId, setSelectedReinforcementPieceId] = useState<string | null>(null)
  const [reinforcementAssignments, setReinforcementAssignments] = useState<ReinforcementAssignment[]>([])
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; options: PromotionPiece[] } | null>(null)
  const timeline = useMemo(() => buildTimeline(events), [events])
  const moveFeedback = useMemo(() => latestActionFeedback(events), [events])
  const historicalState = historySequence === null ? null : checkpoints.find((checkpoint) => checkpoint.sequence === historySequence)?.state ?? checkpoints[0]?.state ?? null
  const displayState = historicalState ?? state
  const displayView = useMemo(() => projectPlayerView(displayState, displayState.activePlayerId), [displayState])
  const reviewingHistory = historicalState !== null
  const perspective = Object.entries(displayState.controllerByArmy).find(([, playerId]) => playerId === displayState.activePlayerId)?.[0] ?? 'white'
  const nearArmy = perspective as 'white' | 'black'
  const farArmy = nearArmy === 'white' ? 'black' : 'white'
  const whiteLost = displayState.board.capturedByArmy.white.reduce((total, piece) => total + materialValue(piece.kind), 0)
  const blackLost = displayState.board.capturedByArmy.black.reduce((total, piece) => total + materialValue(piece.kind), 0)
  const materialDelta = { white: Math.max(0, blackLost - whiteLost), black: Math.max(0, whiteLost - blackLost) }
  const cardsSealed = state.players[state.activePlayerId]?.statuses.some((status) => status.kind === 'sealed') ?? false
  const playableCardIds = !reviewingHistory && pendingPromotion === null && state.turn.phase === 'await-action' && !cardsSealed && state.discardFace
    ? view.self.hand.filter((card) => canPlayCard(card, state.discardFace!, state.rules)).map((card) => card.id)
    : []
  const unavailableReasonByCardId: Partial<Record<string, string>> = Object.fromEntries(view.self.hand
    .filter((card) => !playableCardIds.includes(card.id))
    .map((card) => [card.id, cardsSealed ? '本回合手牌已被封印。' : '這張牌不符合目前顏色或功能。']))
  const legalMoves = state.turn.phase === 'await-action' ? getLegalBasicMoves(state) : getLegalActionMoves(state)
  const reinforcementOptions = getLegalReinforcementOptions(state)
  const reinforcementMaximum = state.turn.pendingEffect?.kind === 'reinforce' ? state.turn.pendingEffect.maximumPieces : state.rules.reinforce.maximumPieces
  const pendingReinforcement = reinforcementOptions.find((option) => option.pieceId === selectedReinforcementPieceId)
  const assignedReinforcementIds = reinforcementAssignments.map((assignment) => assignment.pieceId)
  const assignedReinforcementSquares = reinforcementAssignments.map((assignment) => assignment.square)
  const legalTargets = state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce'
    ? pendingReinforcement?.squares.filter((square) => !assignedReinforcementSquares.includes(square)) ?? []
    : selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to) : []
  const reinforcementGhosts = [
    ...reinforcementAssignments.map((assignment) => ({ ...assignment, army: nearArmy, status: 'assigned' as const })),
    ...(pendingReinforcement ? legalTargets.map((square) => ({ square, army: nearArmy, kind: pendingReinforcement.kind as ChessPieceKind, status: 'target' as const })) : []),
  ]

  useEffect(() => {
    setActiveCardDrag(null)
    setSelectedSquare(null)
    setSelectedReinforcementPieceId(null)
    setReinforcementAssignments([])
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
    if (assignedReinforcementIds.includes(pieceId) || reinforcementAssignments.length >= reinforcementMaximum) return
    setSelectedReinforcementPieceId((selected) => selected === pieceId ? null : pieceId)
  }
  const confirmReinforcement = () => dispatch({
    type: 'choose-reinforcement', playerId: state.activePlayerId, intentId: nextIntentId('reinforce'),
    capturedPieceIds: reinforcementAssignments.map((assignment) => assignment.pieceId),
    squares: reinforcementAssignments.map((assignment) => assignment.square),
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
      if (pendingReinforcement && legalTargets.includes(square)) {
        setReinforcementAssignments((assignments) => [...assignments, { pieceId: pendingReinforcement.pieceId, kind: pendingReinforcement.kind as ChessPieceKind, square }])
        setSelectedReinforcementPieceId(null)
      }
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
    <a className="skip-link" href="#game-board">跳到棋盤</a>
    <header className="game-masthead">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><span>U</span><i>×</i><span>♟</span></div>
        <div><p className="eyebrow">王牌棋局 · UNO × CLASSIC CHESS</p><h1>UNO 西洋棋</h1></div>
      </div>
      <div className="match-badges" aria-label="對局模式">
        <span>本機雙人</span>
        <span>經典規則</span>
      </div>
    </header>
    <TurnGuide state={displayState} />
    <div className="game-arena">
      <div className="game-play-column">
        <section className="board-stage" data-testid="board-stage" id="game-board" aria-label="對戰棋盤">
          {reviewingHistory ? <div className="history-mode" role="status"><span>{historySequence === 0 ? '正在查看開局' : `正在查看第 ${historySequence} 個事件`}</span><button onClick={() => setHistorySequence(null)}>回到目前局面</button></div> : null}
          {pendingPromotion ? <PromotionChooser army={nearArmy} from={pendingPromotion.from} to={pendingPromotion.to} options={pendingPromotion.options} onChoose={(piece) => commitMove(pendingPromotion.from, pendingPromotion.to, piece)} onCancel={() => setPendingPromotion(null)} /> : null}
          <ActionFeedback key={moveFeedback ? `${moveFeedback.kind}:${moveFeedback.sequence}` : 'no-feedback'} feedback={moveFeedback} />
          <div className="board-column">
            <PlayerGraveyard army={farArmy} pieces={displayState.board.capturedByArmy[farArmy]} materialDelta={materialDelta[farArmy]} eligiblePieceIds={reviewingHistory ? [] : reinforcementOptions.map((option) => option.pieceId).filter((id) => !assignedReinforcementIds.includes(id))} selectedPieceId={selectedReinforcementPieceId} onSelect={toggleReinforcementPiece} />
            <ChessBoard fen={displayView.board.fen} activePieces={displayState.board.activePieces} perspective={nearArmy} interactionLocked={activeCardDrag !== null || reviewingHistory || pendingPromotion !== null} legalMoves={reviewingHistory ? [] : legalMoves} selectedSquare={reviewingHistory ? null : selectedSquare} legalTargets={reviewingHistory ? [] : legalTargets} ghostPieces={reviewingHistory ? [] : reinforcementGhosts} onMove={requestMove} onSquareClick={chooseSquare} />
            <PlayerGraveyard army={nearArmy} pieces={displayState.board.capturedByArmy[nearArmy]} materialDelta={materialDelta[nearArmy]} eligiblePieceIds={reviewingHistory ? [] : reinforcementOptions.map((option) => option.pieceId).filter((id) => !assignedReinforcementIds.includes(id))} selectedPieceId={selectedReinforcementPieceId} onSelect={toggleReinforcementPiece} />
          </div>
          <CardPlayZone active={activeCardDrag !== null} ready={activeCardDrag?.overDropZone ?? false} />
        </section>
        <section className={`player-zone${state.turn.phase === 'await-overflow-discard' ? ' discarding' : ''}`} aria-label="目前玩家操作區">
          <div className="hand-heading">
            <div>
              <p className="eyebrow">{playerName(state.activePlayerId)} · 手牌</p>
              <h2>{state.turn.phase === 'await-overflow-discard' ? '手牌已滿，選一張棄掉' : '挑一張，拖到棋盤上'}</h2>
            </div>
            <span><strong>{view.self.hand.length}</strong> / {state.rules.hand.maximumSize} 張</span>
          </div>
          {state.turn.phase === 'await-overflow-discard' ? <OverflowDiscard /> : null}
          <CardHand
            cards={view.self.hand}
            playableCardIds={playableCardIds}
            unavailableReasonByCardId={unavailableReasonByCardId}
            onCommit={playCard}
            onDiscard={discardOverflow}
            onDragStateChange={setActiveCardDrag}
            discardMode={state.turn.phase === 'await-overflow-discard'}
          />
          <section className="card-controls" aria-label="卡牌操作">
          {state.turn.phase === 'await-action-move' ? <button disabled={state.turn.actionsUsed < state.turn.actionMinimum} onClick={finishAction}>{state.turn.actionMinimum === 0 && state.turn.actionsUsed === 0 ? '不移動，直接結束回合' : '提前結束連續行動'}</button> : null}
          {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'wild-color' ? <div className="color-choice" aria-label="選擇新的牌色">
            {(['red', 'yellow', 'green', 'blue'] as CardColor[]).map((color) => <button className={color} key={color} onClick={() => chooseWildColor(color)}>{cardColorName(color)}</button>)}
          </div> : null}
          {state.turn.phase === 'await-effect-choice' && state.turn.pendingEffect?.kind === 'reinforce' ? <ReinforcementTray army={nearArmy} maximumPieces={reinforcementMaximum} activePiece={pendingReinforcement ? { pieceId: pendingReinforcement.pieceId, kind: pendingReinforcement.kind as ChessPieceKind } : null} assignments={reinforcementAssignments} onCancelSelection={() => setSelectedReinforcementPieceId(null)} onUndo={(pieceId) => setReinforcementAssignments((assignments) => assignments.filter((assignment) => assignment.pieceId !== pieceId))} onReset={() => { setReinforcementAssignments([]); setSelectedReinforcementPieceId(null) }} onConfirm={confirmReinforcement} /> : null}
          </section>
        </section>
      </div>
      <aside className="match-sidebar" data-testid="match-sidebar" aria-label="對局資訊">
        <TurnPanel state={displayState} error={error} />
        <div className={`discard-summary ${state.discardFace?.color ?? 'wild'}`}>
          <div>
            <span>目前牌面</span>
            <strong>{state.discardFace ? `${cardColorName(state.discardFace.color)} ${cardName(state.discardFace.kind)}` : '尚無牌面'}</strong>
          </div>
          <div className="discard-glyph" aria-hidden="true">{state.discardFace ? cardName(state.discardFace.kind).replace('行動牌 ', '') : '—'}</div>
        </div>
        <MoveHistory entries={timeline} selectedSequence={historySequence} onNavigate={setHistorySequence} />
      </aside>
    </div>
  </main>
}
