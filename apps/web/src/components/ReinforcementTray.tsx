import type { ArmyColor, ChessPieceKind, Square } from '@uno-chess/protocol'
import { pieceGlyph } from '../presentation/chessPieces.js'
import { pieceName } from '../presentation/uiText.js'

export interface ReinforcementAssignment {
  pieceId: string
  kind: ChessPieceKind
  square: Square
}

export interface ReinforcementTrayProps {
  army: ArmyColor
  maximumPieces: number
  activePiece: { pieceId: string; kind: ChessPieceKind } | null
  assignments: ReinforcementAssignment[]
  onCancelSelection: () => void
  onUndo: (pieceId: string) => void
  onReset: () => void
  onConfirm: () => void
}

export function ReinforcementTray({ army, maximumPieces, activePiece, assignments, onCancelSelection, onUndo, onReset, onConfirm }: ReinforcementTrayProps) {
  const armyName = army === 'white' ? '白方' : '黑方'
  return <section className="reinforcement-tray" aria-label="復活配置">
    <div className="reinforcement-instruction">
      {activePiece ? <><strong>正在放置{armyName}{pieceName(activePiece.kind)}</strong><span>請點擊棋盤上顯示虛影的合法格</span><button onClick={onCancelSelection}>取消選擇</button></> : <><strong>從墓地選擇棋子</strong><span>可復活一枚或兩枚棋子</span></>}
    </div>
    <div className="reinforcement-assignments">
      {assignments.map((assignment) => <div key={assignment.pieceId}><span>{pieceGlyph(army, assignment.kind)} → {assignment.square}</span><button aria-label={`撤銷${armyName}${pieceName(assignment.kind)}在 ${assignment.square} 的配置`} onClick={() => onUndo(assignment.pieceId)}>撤銷</button></div>)}
      {assignments.length > 0 ? <button className="reinforcement-reset" aria-label="重設所有復活位置" onClick={onReset}>重設全部位置</button> : null}
    </div>
    <button className="reinforcement-confirm" aria-label={`完成復活 ${assignments.length}/${maximumPieces}`} disabled={assignments.length === 0 || activePiece !== null} onClick={onConfirm}>完成復活 {assignments.length}/{maximumPieces}</button>
  </section>
}
