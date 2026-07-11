import type { ArmyColor, PieceRecord } from '@uno-chess/protocol'
import { materialValue, pieceGlyph } from '../presentation/chessPieces.js'
import { pieceName } from '../presentation/uiText.js'

export interface PlayerGraveyardProps {
  army: ArmyColor
  pieces: PieceRecord[]
  materialDelta: number
  eligiblePieceIds?: string[]
  selectedPieceId?: string | null
  onSelect?: (pieceId: string) => void
}

export function PlayerGraveyard({ army, pieces, materialDelta, eligiblePieceIds = [], selectedPieceId = null, onSelect }: PlayerGraveyardProps) {
  const armyName = army === 'white' ? '白方' : '黑方'
  return <section className={`player-graveyard ${army}`} role="region" aria-label={`${armyName}墓地`}>
    <div className="graveyard-label"><strong>{armyName}</strong><span>{pieces.length > 0 ? `被吃 ${pieces.length} 枚` : '尚無損失'}</span></div>
    <div className="graveyard-pieces">
      {pieces.map((piece) => eligiblePieceIds.includes(piece.id) && onSelect
        ? <button aria-label={`選擇復活${armyName}${pieceName(piece.kind)}`} aria-pressed={selectedPieceId === piece.id} key={piece.id} onClick={() => onSelect(piece.id)}><span aria-hidden="true">{pieceGlyph(army, piece.kind)}</span></button>
        : <span className="captured-piece" aria-label={`${armyName}${pieceName(piece.kind)}，${materialValue(piece.kind)} 分`} key={piece.id}>{pieceGlyph(army, piece.kind)}</span>)}
    </div>
    {materialDelta > 0 ? <strong className="material-delta">+{materialDelta}</strong> : null}
  </section>
}
