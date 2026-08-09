import { useState } from 'react'
import '../styles/lobby.css'

export interface LobbyPageProps {
  onlineAvailable: boolean
  onCreateFriendRoom: () => void
  onJoinFriendRoom: (code: string) => void
  onStartLocalGame: () => void
}

export function LobbyPage({ onlineAvailable, onCreateFriendRoom, onJoinFriendRoom, onStartLocalGame }: LobbyPageProps) {
  const [roomCode, setRoomCode] = useState('')
  const normalizedCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

  return <main className="lobby-shell">
    <header className="lobby-masthead">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><span>U</span><i>×</i><span>♟</span></div>
        <div><p className="eyebrow">王牌棋局 · UNO × CLASSIC CHESS</p><h1>UNO 西洋棋</h1></div>
      </div>
      <div className={`server-status ${onlineAvailable ? 'online' : 'offline'}`} role="status">
        <span aria-hidden="true" />
        {onlineAvailable ? '線上大廳已連線' : '線上大廳連線中'}
      </div>
    </header>

    <section className="lobby-hero" aria-labelledby="lobby-title">
      <div className="lobby-copy">
        <p className="lobby-kicker">把好友叫上牌桌</p>
        <h2 id="lobby-title">一局 UNO，<br />一盤會翻桌的棋。</h2>
        <p>每回合抽牌、照 UNO 配對出牌，再用西洋棋規則決定勝負。建立房間，把六碼房號交給朋友就能開局。</p>
        <div className="rules-strip" aria-label="遊戲特色">
          <span><strong>1</strong> 權威伺服器</span>
          <span><strong>2</strong> 即時同步</span>
          <span><strong>3</strong> 版本化規則</span>
        </div>
      </div>

      <div className="lobby-actions">
        <section className="entrance-card friend-entrance" aria-labelledby="friend-room-title">
          <div className="entrance-heading">
            <span className="entrance-suit" aria-hidden="true">◆</span>
            <div><p>線上好友對戰</p><h3 id="friend-room-title">好友房</h3></div>
            <span className="entrance-badge">2 人</span>
          </div>
          <p className="entrance-description">建立私人牌桌，或輸入朋友傳來的六碼房號。</p>
          <button className="primary-entrance" data-testid="create-friend-room" disabled={!onlineAvailable} onClick={onCreateFriendRoom}>建立好友房</button>
          <div className="join-room-row">
            <label>
              <span>房間代碼</span>
              <input aria-label="房間代碼" data-testid="room-code-input" autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength={6} placeholder="UNO123" value={normalizedCode} onChange={(event) => setRoomCode(event.target.value)} />
            </label>
              <button data-testid="join-friend-room" disabled={!onlineAvailable || normalizedCode.length !== 6} onClick={() => onJoinFriendRoom(normalizedCode)}>加入好友房</button>
          </div>
          {!onlineAvailable ? <p className="entrance-hint">伺服器準備完成後即可建立與加入房間。</p> : null}
        </section>

        <section className="entrance-card local-entrance" aria-labelledby="local-title">
          <div className="entrance-heading">
            <span className="entrance-suit" aria-hidden="true">♞</span>
            <div><p>同一台裝置</p><h3 id="local-title">本機雙人</h3></div>
          </div>
          <p className="entrance-description">輪流操作同一個畫面，立即測試完整卡牌與棋局規則。</p>
          <button className="secondary-entrance" onClick={onStartLocalGame}>開始本機對戰</button>
        </section>

        <section className="entrance-card quick-entrance" aria-label="快速配對尚未開放">
          <span>下一階段</span>
          <strong>快速配對</strong>
          <small>好友房穩定後開放</small>
        </section>
      </div>
    </section>
  </main>
}
