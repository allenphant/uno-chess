import type { CardInstance } from '@uno-chess/protocol'
import { cardColorName, cardName } from '../presentation/uiText.js'

const cardDetails: Record<string, { symbol: string; effect: string }> = {
  'action-2': { symbol: '♞ ×2', effect: '最多移動兩次' },
  'action-3': { symbol: '♜ ×3', effect: '最多移動三次' },
  reinforce: { symbol: '♟ ↥ ♞', effect: '復活最多兩枚棋子' },
  seal: { symbol: '♚ ⛓', effect: '對手下回合不能出牌' },
  reverse: { symbol: '⇄', effect: '雙方交換整副手牌' },
  betray: { symbol: '♚ ⇄ ♔', effect: '交換軍隊並選擇牌色' },
}

export function cardAccessibleLabel(card: CardInstance): string {
  const detail = cardDetails[card.kind]
  return `${cardColorName(card.color)}${cardName(card.kind)}，${detail?.effect ?? '特殊效果'}`
}

export function CardFace({ card }: { card: CardInstance }) {
  const detail = cardDetails[card.kind] ?? { symbol: '✦', effect: '特殊效果' }
  return <span className="card-face" aria-hidden="true">
    <span className="card-title"><i className="card-color-dot" />{cardName(card.kind)}</span>
    <strong className="card-symbol">{detail.symbol}</strong>
    <span className="card-effect">{detail.effect}</span>
  </span>
}
