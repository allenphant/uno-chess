import { useRef, useState } from 'react'
import { LocalGamePage } from './game/LocalGamePage.js'
import { FriendRoomPage, type FriendRoomMember } from './lobby/FriendRoomPage.js'
import { LobbyPage } from './lobby/LobbyPage.js'
import { useOnlineGame } from './online/useOnlineGame.js'
import { OnlineGamePage } from './online/OnlineGamePage.js'

export function createLocalGameSeed(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function App() {
  const [screen, setScreen] = useState<'lobby' | 'local'>('lobby')
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(null)
  const seed = useRef(createLocalGameSeed()).current
  const online = useOnlineGame()
  if (screen === 'local') return <LocalGamePage seed={seed} onExit={() => setScreen('lobby')} />

  if (online.state.projection && online.state.gameId !== dismissedGameId) return <OnlineGamePage
    view={online.state.projection}
    revision={online.state.revision}
    error={online.state.error}
    onIntent={(intent) => void online.submitIntent(intent)}
    onExit={() => setDismissedGameId(online.state.gameId)}
  />

  if (online.state.room) {
    const room = online.state.room
    const ids = [room.hostPlayerId, room.guestPlayerId].filter((value): value is string => Boolean(value))
    const members: FriendRoomMember[] = ids.map((playerId, index) => ({
      playerId,
      displayName: playerId === online.state.playerId ? online.state.displayName : `對手 ${index + 1}`,
      ready: room.readyPlayerIds.includes(playerId),
      isSelf: playerId === online.state.playerId,
      isHost: playerId === room.hostPlayerId,
    }))
    return <FriendRoomPage
      code={room.code}
      members={members}
      rulesLabel="標準模式 v1"
      onCopyCode={() => void navigator.clipboard?.writeText(room.code)}
      onLeave={online.leaveRoom}
      onReady={() => void online.ready()}
    />
  }

  return <LobbyPage
    onlineAvailable={online.state.connected}
    onCreateFriendRoom={() => void online.createRoom()}
    onJoinFriendRoom={(code) => void online.joinRoom(code)}
    onStartLocalGame={() => setScreen('local')}
  />
}
