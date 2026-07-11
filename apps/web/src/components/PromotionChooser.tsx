import type { ArmyColor, PromotionPiece, Square } from '@uno-chess/protocol'
import { pieceName } from '../presentation/uiText.js'

const promotionGlyphs: Record<ArmyColor, Record<PromotionPiece, string>> = {
  white: { q: '♕', r: '♖', b: '♗', n: '♘' },
  black: { q: '♛', r: '♜', b: '♝', n: '♞' },
}

export interface PromotionChooserProps {
  army: ArmyColor
  from: Square
  to: Square
  options: PromotionPiece[]
  onChoose: (piece: PromotionPiece) => void
  onCancel: () => void
}

export function PromotionChooser({ army, from, to, options, onChoose, onCancel }: PromotionChooserProps) {
  return <section className="promotion-chooser" role="dialog" aria-modal="true" aria-label="選擇升變棋子">
    <p>{from} → {to}：選擇升變棋子</p>
    <div>{options.map((piece) => <button aria-label={`升變為${pieceName(piece)}`} key={piece} onClick={() => onChoose(piece)}><span aria-hidden="true">{promotionGlyphs[army][piece]}</span>{pieceName(piece)}</button>)}</div>
    <button className="promotion-cancel" onClick={onCancel}>取消</button>
  </section>
}
