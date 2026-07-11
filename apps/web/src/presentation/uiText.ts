import type { CardColor, CardKind, GameState, PlayerId } from '@uno-chess/protocol'

export const cardNames: Record<string, string> = {
  'action-2': '行動牌 2',
  'action-3': '行動牌 3',
  reinforce: '援軍 +2',
  seal: '封印',
  reverse: '交換',
  betray: '變節',
}

export const colorNames: Record<CardColor, string> = { red: '紅色', yellow: '黃色', green: '綠色', blue: '藍色' }

export function playerName(id: PlayerId): string {
  return id === 'p1' ? '玩家 1' : id === 'p2' ? '玩家 2' : id
}

export function cardName(kind: CardKind): string {
  return cardNames[kind] ?? kind
}

export function cardColorName(color: CardColor | null): string {
  return color ? colorNames[color] : '四色'
}

const errors: Record<string, string> = {
  CARD_DOES_NOT_MATCH: '這張牌不符合目前的顏色或功能。',
  NOT_ACTIVE_PLAYER: '現在不是你的回合。',
  ILLEGAL_CHESS_MOVE: '這不是合法的西洋棋走法。',
  GAME_FINISHED: '對局已經結束。',
}

export function gameErrorText(code: string): string {
  return errors[code] ?? `無法完成這個動作（${code}）`
}

export function pieceName(kind: string): string {
  return ({ p: '兵', n: '馬', b: '主教', r: '城堡', q: '皇后', k: '國王' } as Record<string, string>)[kind] ?? kind
}

export function turnGuideText(state: GameState): string {
  if (state.status.kind === 'finished') {
    const reason = ({ checkmate: '將死', stalemate: '逼和', repetition: '三次重複局面', 'halfmove-limit': '五十回合規則', resignation: '投降', timeout: '逾時' } as const)[state.status.reason]
    return state.status.winnerId ? `${playerName(state.status.winnerId)}獲勝！原因：${reason}。` : `本局和棋。原因：${reason}。`
  }
  if (state.turn.phase === 'turn-start') return '正在自動抽牌……'
  if (state.turn.phase === 'await-overflow-discard') return '手牌已滿，請選一張牌棄掉。'
  if (state.turn.phase === 'await-action') return '請打出一張可用手牌，或直接移動一枚棋子。'
  if (state.turn.phase === 'await-action-move') return `行動牌生效中，還能移動 ${state.turn.actionBudget - state.turn.actionsUsed} 次。`
  if (state.turn.pendingEffect?.kind === 'wild-color') return '請選擇新的牌色。'
  if (state.turn.pendingEffect?.kind === 'reinforce') return '請選擇要復活的棋子，再放到亮起的格子。'
  return '請完成目前的效果選擇。'
}
