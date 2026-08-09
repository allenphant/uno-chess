import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArmyColor, CardColor, ChessPieceKind, GameIntent, PlayerView, PromotionPiece, Square } from '@uno-chess/protocol'
import { ChessBoard } from '../components/ChessBoard.js'
import { CardHand } from '../components/CardHand.js'
import { CardPlayZone } from '../components/CardPlayZone.js'
import { OverflowDiscard } from '../components/OverflowDiscard.js'
import { PlayerGraveyard } from '../components/PlayerGraveyard.js'
import { PromotionChooser } from '../components/PromotionChooser.js'
import { ReinforcementTray, type ReinforcementAssignment } from '../components/ReinforcementTray.js'
import type { CardDragVisualState } from '../input/useCardDrag.js'
import { cardColorName, cardName } from '../presentation/uiText.js'
import { materialValue } from '../presentation/chessPieces.js'
import { promotionChoicesForMove } from '../game/promotion.js'
import '../styles/game.css'

export interface OnlineGamePageProps {
  view: PlayerView
  revision: number
  error: string | null
  onIntent: (intent: GameIntent) => void
  onExit: () => void
}

let intentSequence = 0

export function OnlineGamePage({ view, revision, error, onIntent, onExit }: OnlineGamePageProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [activeCardDrag, setActiveCardDrag] = useState<CardDragVisualState | null>(null)
  const [pendingDiscardCardId, setPendingDiscardCardId] = useState<string | null>(null)
  const [selectedReinforcementPieceId, setSelectedReinforcementPieceId] = useState<string | null>(null)
  const [reinforcementAssignments, setReinforcementAssignments] = useState<ReinforcementAssignment[]>([])
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; options: PromotionPiece[] } | null>(null)
  const requestedDrawRevision = useRef<number | null>(null)
  const isMyTurn = view.activePlayerId === view.self.id
  const perspective = (Object.entries(view.controllerByArmy).find(([, playerId]) => playerId === view.self.id)?.[0] ?? 'white') as ArmyColor
  const opponentArmy = perspective === 'white' ? 'black' : 'white'
  const legalMoves = view.turn.phase === 'await-action-move' ? view.legal.actionMoves : view.legal.basicMoves
  const discardingOverflow = isMyTurn && view.turn.phase === 'await-overflow-discard'
  const pendingDiscardCard = view.self.hand.find((card) => card.id === pendingDiscardCardId) ?? null
  const selectedReinforcement = view.legal.reinforcementOptions.find((option) => option.pieceId === selectedReinforcementPieceId)
  const usedSquares = reinforcementAssignments.map((assignment) => assignment.square)
  const legalTargets = selectedReinforcement
    ? selectedReinforcement.squares.filter((square) => !usedSquares.includes(square))
    : selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to) : []
  const maximumReinforcements = view.turn.pendingEffect?.kind === 'reinforce' ? view.turn.pendingEffect.maximumPieces : view.rules.reinforce.maximumPieces
  const whiteLost = view.board.capturedByArmy.white.reduce((total, piece) => total + materialValue(piece.kind), 0)
  const blackLost = view.board.capturedByArmy.black.reduce((total, piece) => total + materialValue(piece.kind), 0)
  const materialDelta = { white: Math.max(0, blackLost - whiteLost), black: Math.max(0, whiteLost - blackLost) }
  const reinforcementGhosts = useMemo(() => [
    ...reinforcementAssignments.map((assignment) => ({ ...assignment, army: perspective, status: 'assigned' as const })),
    ...(selectedReinforcement?.squares.filter((square) => !usedSquares.includes(square)).map((square) => ({
      square,
      army: perspective,
      kind: selectedReinforcement.kind as ChessPieceKind,
      status: 'target' as const,
    })) ?? []),
  ], [perspective, reinforcementAssignments, selectedReinforcement, usedSquares])

  useEffect(() => {
    if (!isMyTurn || view.turn.phase !== 'turn-start' || requestedDrawRevision.current === revision) return
    requestedDrawRevision.current = revision
    onIntent(intent(view.self.id, 'draw-for-turn'))
  }, [isMyTurn, onIntent, revision, view.self.id, view.turn.phase])

  useEffect(() => {
    setSelectedSquare(null)
    setActiveCardDrag(null)
    setPendingDiscardCardId(null)
    setSelectedReinforcementPieceId(null)
    setReinforcementAssignments([])
    setPendingPromotion(null)
  }, [view.activePlayerId, view.turn.phase])

  const requestMove = (from: Square, to: Square) => {
    const options = promotionChoicesForMove(legalMoves, from, to)
    if (options.length > 0) return setPendingPromotion({ from, to, options })
    commitMove(from, to)
  }
  const commitMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    const type = view.turn.phase === 'await-action-move' ? 'action-move' : 'basic-move'
    onIntent({ ...intent(view.self.id, type), from, to, ...(promotion ? { promotion } : {}) })
    setSelectedSquare(null)
    setPendingPromotion(null)
  }
  const chooseSquare = (square: Square) => {
    if (selectedReinforcement && legalTargets.includes(square)) {
      setReinforcementAssignments((items) => [...items, { pieceId: selectedReinforcement.pieceId, kind: selectedReinforcement.kind as ChessPieceKind, square }])
      setSelectedReinforcementPieceId(null)
      return
    }
    const move = selectedSquare ? legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square) : null
    if (move) return requestMove(move.from, move.to)
    setSelectedSquare(legalMoves.some((candidate) => candidate.from === square) ? square : null)
  }
  const playCard = (cardId: string) => {
    const card = view.self.hand.find((candidate) => candidate.id === cardId)
    const definition = view.rules.cards.find((candidate) => candidate.kind === card?.kind)
    if (!card || !definition) return
    onIntent({ ...intent(view.self.id, definition.category === 'action' ? 'play-action-card' : 'play-function-card'), cardId })
  }

  const guide = onlineGuide(view, isMyTurn)
  const interactionLocked = !isMyTurn || discardingOverflow || activeCardDrag !== null || pendingPromotion !== null

  return <main className="game-shell online-match" data-testid="online-match">
    <header className="game-masthead">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><span>U</span><i>×</i><span>♟</span></div><div><p className="eyebrow">ONLINE FRIEND MATCH</p><h1>UNO 西洋棋</h1></div></div>
      <div className="match-badges"><span className="online-pill">● 即時連線</span><span>版本 {revision}</span><button className="exit-match" onClick={onExit}>返回大廳</button></div>
    </header>

    <section className="turn-guide" aria-live="polite"><div><span>{isMyTurn ? '你的回合' : '對手思考中'}</span><strong>{guide}</strong></div>{error ? <p role="alert">{error}</p> : null}</section>

    <div className="game-arena">
      <div className="game-play-column">
        <section className="board-stage" id="game-board">
          {pendingPromotion ? <PromotionChooser army={perspective} from={pendingPromotion.from} to={pendingPromotion.to} options={pendingPromotion.options} onChoose={(piece) => commitMove(pendingPromotion.from, pendingPromotion.to, piece)} onCancel={() => setPendingPromotion(null)} /> : null}
          <div className="board-column">
            <PlayerGraveyard army={opponentArmy} pieces={view.board.capturedByArmy[opponentArmy]} materialDelta={materialDelta[opponentArmy]} eligiblePieceIds={[]} selectedPieceId={null} onSelect={() => undefined} />
            <ChessBoard fen={view.board.fen} activePieces={view.board.activePieces} perspective={perspective} interactionLocked={interactionLocked} legalMoves={legalMoves} selectedSquare={selectedSquare} legalTargets={legalTargets} ghostPieces={reinforcementGhosts} onMove={requestMove} onSquareClick={chooseSquare} />
            <PlayerGraveyard army={perspective} pieces={view.board.capturedByArmy[perspective]} materialDelta={materialDelta[perspective]} eligiblePieceIds={view.legal.reinforcementOptions.map((option) => option.pieceId)} selectedPieceId={selectedReinforcementPieceId} onSelect={(pieceId) => setSelectedReinforcementPieceId(pieceId)} />
          </div>
          <CardPlayZone active={discardingOverflow || activeCardDrag !== null} ready={activeCardDrag?.overDropZone ?? false} mode={discardingOverflow ? 'discard' : 'play'} />
        </section>

        <section className={`player-zone${discardingOverflow ? ' discarding' : ''}`}>
          <div className="hand-heading"><div><p className="eyebrow">你的手牌</p><h2>{isMyTurn ? guide : `等待對手 · ${view.opponent.hand.count} 張牌`}</h2></div><span><strong>{view.self.hand.length}</strong> / {view.rules.hand.maximumSize} 張</span></div>
          {discardingOverflow ? <OverflowDiscard selectedCard={pendingDiscardCard} onCancel={() => setPendingDiscardCardId(null)} onConfirm={() => pendingDiscardCardId && onIntent({ ...intent(view.self.id, 'discard-overflow'), cardId: pendingDiscardCardId })} /> : null}
          <CardHand cards={view.self.hand} playableCardIds={isMyTurn ? view.legal.playableCardIds : []} unavailableReasonByCardId={Object.fromEntries(view.self.hand.map((card) => [card.id, isMyTurn ? '這張牌目前不符合出牌規則' : '等待你的回合']))} onCommit={playCard} onDragStateChange={setActiveCardDrag} discardMode={discardingOverflow} onDiscard={setPendingDiscardCardId} onDiscardDrop={setPendingDiscardCardId} selectedDiscardCardId={pendingDiscardCardId} />
          <section className="card-controls">
            {isMyTurn && view.turn.phase === 'await-action-move' ? <button disabled={view.turn.actionsUsed < view.turn.actionMinimum} onClick={() => onIntent(intent(view.self.id, 'finish-action-card'))}>結束連續移動</button> : null}
            {isMyTurn && view.turn.pendingEffect?.kind === 'wild-color' ? <div className="color-choice">{(['red', 'yellow', 'green', 'blue'] as CardColor[]).map((color) => <button className={color} key={color} onClick={() => onIntent({ ...intent(view.self.id, 'choose-wild-color'), color })}>{cardColorName(color)}</button>)}</div> : null}
            {isMyTurn && view.turn.pendingEffect?.kind === 'reinforce' ? <ReinforcementTray army={perspective} maximumPieces={maximumReinforcements} activePiece={selectedReinforcement ? { pieceId: selectedReinforcement.pieceId, kind: selectedReinforcement.kind as ChessPieceKind } : null} assignments={reinforcementAssignments} onCancelSelection={() => setSelectedReinforcementPieceId(null)} onUndo={(pieceId) => setReinforcementAssignments((items) => items.filter((item) => item.pieceId !== pieceId))} onReset={() => { setReinforcementAssignments([]); setSelectedReinforcementPieceId(null) }} onConfirm={() => onIntent({ ...intent(view.self.id, 'choose-reinforcement'), capturedPieceIds: reinforcementAssignments.map((item) => item.pieceId), squares: reinforcementAssignments.map((item) => item.square) })} /> : null}
          </section>
        </section>
      </div>

      <aside className="match-sidebar">
        <section className="turn-panel"><div className="turn-panel-heading"><span className="turn-avatar">{isMyTurn ? '你' : '敵'}</span><div><span>目前行動</span><strong>{isMyTurn ? '你的回合' : '對手的回合'}</strong></div><i className="live-indicator">LIVE</i></div><div className="turn-metrics"><div><span>回合</span><strong>{view.turn.number}</strong></div><div><span>牌庫</span><strong>{view.drawPileCount}<small> 張</small></strong></div></div></section>
        <div className={`discard-summary ${view.discardFace?.color ?? 'wild'}`}><div><span>棄牌頂</span><strong>{view.discardFace ? `${cardColorName(view.discardFace.color)} ${cardName(view.discardFace.kind)}` : '尚無棄牌'}</strong></div><div className="discard-glyph" aria-hidden="true">{view.discardFace ? cardName(view.discardFace.kind) : '—'}</div></div>
      </aside>
    </div>
  </main>
}

function intent<PlayerIntent extends GameIntent['type']>(playerId: string, type: PlayerIntent): Extract<GameIntent, { type: PlayerIntent }> {
  intentSequence += 1
  return { type, playerId, intentId: `web:${Date.now()}:${intentSequence}` } as Extract<GameIntent, { type: PlayerIntent }>
}

function onlineGuide(view: PlayerView, isMyTurn: boolean): string {
  if (view.status.kind === 'finished') return view.status.winnerId === view.self.id ? '你贏了！' : view.status.winnerId ? '這局由對手獲勝' : '本局和棋'
  if (!isMyTurn) return '等待對手完成行動'
  if (view.turn.phase === 'turn-start') return '正在自動抽牌…'
  if (view.turn.phase === 'await-overflow-discard') return '手牌已滿，請選一張牌棄掉'
  if (view.turn.pendingEffect?.kind === 'wild-color') return '選擇下一個出牌顏色'
  if (view.turn.pendingEffect?.kind === 'reinforce') return '從墓地選擇棋子，再指定復活位置'
  if (view.turn.phase === 'await-action-move') return `拖曳棋子移動，剩餘 ${view.turn.actionBudget - view.turn.actionsUsed} 步`
  return '拖曳一張可出的牌到棋盤，或直接移動一枚棋子'
}
