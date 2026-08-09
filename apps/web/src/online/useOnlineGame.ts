import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  FriendRoomView,
  GameEvent,
  GameIntent,
  PlayerView,
  ServerToClientEvents,
} from '@uno-chess/protocol'
import { getGuestIdentity } from './guestIdentity.js'

export type OnlineSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface OnlineState {
  connected: boolean
  connecting: boolean
  playerId: string | null
  displayName: string
  room: FriendRoomView | null
  gameId: string | null
  projection: PlayerView | null
  revision: number
  events: GameEvent[]
  error: string | null
}

const initialState: OnlineState = {
  connected: false,
  connecting: true,
  playerId: null,
  displayName: '訪客',
  room: null,
  gameId: null,
  projection: null,
  revision: 0,
  events: [],
  error: null,
}

export function useOnlineGame(serverUrl = import.meta.env.VITE_GAME_SERVER_URL ?? 'http://127.0.0.1:3000') {
  const [state, setState] = useState<OnlineState>(initialState)
  const socketRef = useRef<OnlineSocket | null>(null)
  const pendingRoomRole = useRef<'host' | 'guest' | null>(null)

  useEffect(() => {
    const identity = getGuestIdentity()
    const socket: OnlineSocket = io(serverUrl, {
      auth: { token: identity.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
    socketRef.current = socket
    setState((current) => ({ ...current, displayName: identity.displayName }))

    socket.on('connect', () => setState((current) => ({
      ...current,
      connected: true,
      connecting: false,
      playerId: null,
      error: null,
    })))
    socket.on('disconnect', () => setState((current) => ({ ...current, connected: false, connecting: false })))
    socket.on('connect_error', () => setState((current) => ({
      ...current,
      connected: false,
      connecting: false,
      error: '目前無法連上對戰伺服器，仍可使用本機對戰。',
    })))
    socket.on('room:updated', (room) => {
      const role = pendingRoomRole.current
      if (role) pendingRoomRole.current = null
      setState((current) => ({
        ...current,
        room,
        playerId: role === 'host' ? room.hostPlayerId : role === 'guest' ? room.guestPlayerId : current.playerId,
        error: null,
      }))
    })
    socket.on('room:started', ({ gameId }) => {
      setState((current) => ({ ...current, gameId, room: null }))
      socket.emit('game:resume', { gameId }, (ack) => {
        if (!ack.ok) return setError(ack.error.message)
        setState((current) => ({ ...current, gameId, projection: ack.data.view, revision: ack.data.revision, playerId: ack.data.view.self.id }))
      })
    })
    socket.on('game:projection', ({ gameId, revision, view, events }) => setState((current) => ({
      ...current,
      gameId,
      projection: view,
      revision,
      playerId: view.self.id,
      events: [...current.events, ...events],
      error: null,
    })))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [serverUrl])

  const setError = useCallback((message: string) => setState((current) => ({ ...current, error: readableError(message) })), [])

  const createRoom = useCallback(async () => {
    pendingRoomRole.current = 'host'
    const ack = await emitWithAck(socketRef.current, 'room:create', { presetId: 'standard-v1', overrides: {} })
    if (!ack.ok) {
      pendingRoomRole.current = null
      return setError(ack.error.message)
    }
  }, [setError])

  const joinRoom = useCallback(async (code: string) => {
    pendingRoomRole.current = 'guest'
    const ack = await emitWithAck(socketRef.current, 'room:join', { code })
    if (!ack.ok) {
      pendingRoomRole.current = null
      return setError(ack.error.message)
    }
  }, [setError])

  const ready = useCallback(async () => {
    const room = state.room
    if (!room) return
    const ack = await emitWithAck(socketRef.current, 'room:ready', { code: room.code, rulesHash: room.rulesHash })
    if (!ack.ok) setError(ack.error.message)
  }, [setError, state.room])

  const submitIntent = useCallback(async (intent: GameIntent) => {
    if (!state.gameId) return
    const ack = await emitWithAck(socketRef.current, 'game:intent', { gameId: state.gameId, revision: state.revision, intent })
    if (!ack.ok) setError(ack.error.message)
  }, [setError, state.gameId, state.revision])

  const leaveRoom = useCallback(() => setState((current) => ({ ...current, room: null, error: null })), [])

  return { state, createRoom, joinRoom, ready, submitIntent, leaveRoom }
}

type AckEvent = 'room:create' | 'room:join' | 'room:ready' | 'game:intent'

function emitWithAck<T extends AckEvent>(socket: OnlineSocket | null, event: T, payload: Parameters<ClientToServerEvents[T]>[0]): Promise<Parameters<Parameters<ClientToServerEvents[T]>[1]>[0]> {
  if (!socket?.connected) return Promise.resolve({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'OFFLINE' } } as Parameters<Parameters<ClientToServerEvents[T]>[1]>[0])
  return new Promise((resolve) => {
    ;(socket.emit as (...args: unknown[]) => void)(event, payload, resolve)
  })
}

function readableError(message: string): string {
  const known: Record<string, string> = {
    OFFLINE: '尚未連上對戰伺服器。',
    ROOM_NOT_FOUND: '找不到這個房間，請檢查房號。',
    ROOM_FULL: '這個房間已經滿了。',
    RULES_HASH_MISMATCH: '房間規則已更新，請稍後再準備。',
    STALE_REVISION: '對局狀態已更新，正在重新同步。',
  }
  return known[message] ?? message
}
