import '../styles/lobby.css'

export interface FriendRoomMember {
  playerId: string
  displayName: string
  ready: boolean
  isSelf: boolean
  isHost: boolean
}

export interface FriendRoomPageProps {
  code: string
  members: FriendRoomMember[]
  rulesLabel: string
  onCopyCode: () => void
  onLeave: () => void
  onReady: () => void
}

export function FriendRoomPage({ code, members, rulesLabel, onCopyCode, onLeave, onReady }: FriendRoomPageProps) {
  const self = members.find((member) => member.isSelf)
  const waitingForOpponent = members.length < 2

  return <main className="room-shell">
    <header className="room-topbar">
      <div className="brand-lockup compact">
        <div className="brand-mark" aria-hidden="true"><span>U</span><i>×</i><span>♟</span></div>
        <div><p className="eyebrow">私人牌桌</p><h1>好友房</h1></div>
      </div>
      <button className="room-leave" onClick={onLeave}>離開房間</button>
    </header>

    <section className="room-stage" aria-labelledby="room-title">
      <div className="room-code-panel">
        <p id="room-title">把房號交給你的對手</p>
        <button className="room-code" data-testid="friend-room-code" aria-label={`複製房間代碼 ${code}`} onClick={onCopyCode}>
          {code.split('').map((character, index) => <span key={`${character}:${index}`}>{character}</span>)}
        </button>
        <small>點擊房號即可複製</small>
      </div>

      <div className="versus-table" aria-label="房間玩家">
        <PlayerSeat member={members[0] ?? null} seatLabel="房主" />
        <div className="versus-mark" aria-hidden="true"><span>VS</span></div>
        <PlayerSeat member={members[1] ?? null} seatLabel="對手" />
      </div>

      <div className="room-ready-panel">
        <div>
          <span>本局規則</span>
          <strong>{rulesLabel}</strong>
          <small>{waitingForOpponent ? '正在等待第二位玩家加入' : members.every((member) => member.ready) ? '雙方已準備，正在開始對局' : '雙方都準備後立即開局'}</small>
        </div>
        <button className={self?.ready ? 'ready active' : 'ready'} data-testid="ready-button" disabled={waitingForOpponent || self?.ready} onClick={onReady}>
          {self?.ready ? '已準備，等待對手' : '我準備好了'}
        </button>
      </div>
    </section>
  </main>
}

function PlayerSeat({ member, seatLabel }: { member: FriendRoomMember | null; seatLabel: string }) {
  if (!member) return <section className="player-seat empty">
    <span className="seat-label">{seatLabel}</span>
    <div className="seat-avatar" aria-hidden="true">?</div>
    <strong>等待加入</strong>
    <small>房間仍有一個空位</small>
  </section>

  return <section className={`player-seat${member.ready ? ' ready' : ''}`}>
    <span className="seat-label">{member.isHost ? '房主' : seatLabel}</span>
    <div className="seat-avatar" aria-hidden="true">{member.displayName.slice(0, 1).toUpperCase()}</div>
    <strong>{member.displayName}{member.isSelf ? '（你）' : ''}</strong>
    <small>{member.ready ? '已準備' : '確認規則中'}</small>
  </section>
}
