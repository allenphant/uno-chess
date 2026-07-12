import type { CardInstance } from '@uno-chess/protocol'
import { cardColorName, cardName } from '../presentation/uiText.js'

const cardDetails: Record<string, { symbol: string; effect: string; movement: string }> = {
  'action-2': { symbol: '2×', effect: '啟動連續行動', movement: '出牌後必須移動 1～2 步' },
  'action-3': { symbol: '3×', effect: '啟動連續行動', movement: '出牌後必須移動 1～3 步' },
  'reinforce-1': { symbol: '+1', effect: '復活最多 1 枚棋子', movement: '結算後立即結束回合' },
  reinforce: { symbol: '+2', effect: '復活最多 2 枚棋子', movement: '結算後立即結束回合' },
  seal: { symbol: 'LOCK', effect: '封印對手下回合手牌', movement: '出牌後可移動 1 步，也可直接結束' },
  reverse: { symbol: 'SWAP', effect: '交換雙方手牌', movement: '結算後立即結束回合' },
  betray: { symbol: 'FLIP', effect: '交換棋軍控制權', movement: '選色後立即結束回合' },
}

export function cardAccessibleLabel(card: CardInstance): string {
  const detail = cardDetails[card.kind]
  return `${cardColorName(card.color)}${cardName(card.kind)}，${detail?.effect ?? '特殊效果'}，${detail?.movement ?? '結算方式依規則'}`
}

export function CardFace({ card }: { card: CardInstance }) {
  const detail = cardDetails[card.kind] ?? { symbol: '✦', effect: '特殊效果', movement: '結算方式依規則' }
  return <span className="card-face" aria-hidden="true">
    <span className="card-title"><i className="card-color-dot" />{cardName(card.kind)}</span>
    <strong className="card-symbol">{detail.symbol}</strong>
    <span className="card-effect">{detail.effect}</span>
    <span className="card-movement">{detail.movement}</span>
  </span>
}
