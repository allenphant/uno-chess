import { createHash, randomInt } from 'node:crypto'
import type { FriendRoomView, MatchDescriptor, PlayerId, RuleSnapshot } from '@uno-chess/protocol'
import { resolveRuleSnapshot } from '@uno-chess/rules'

const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
const DEFAULT_TTL_MS = 30 * 60 * 1_000

export type RoomErrorCode = 'NOT_FOUND' | 'ROOM_FULL' | 'INVALID_PAYLOAD'

export class RoomError extends Error {
  constructor(public readonly code: RoomErrorCode, message: string) {
    super(message)
    this.name = 'RoomError'
  }
}

export interface FriendMatchInput {
  playerIds: [PlayerId, PlayerId]
  presetId: string
  rules: RuleSnapshot
  rulesHash: string
}

export interface FriendRoomServiceOptions {
  createMatch: (input: FriendMatchInput) => Promise<Pick<MatchDescriptor, 'gameId'>>
  codeSource?: () => string
  now?: () => number
  ttlMs?: number
}

interface StoredRoom {
  code: string
  hostPlayerId: PlayerId
  guestPlayerId: PlayerId | null
  resolvedRules: RuleSnapshot
  rulesHash: string
  overrides: Record<string, unknown>
  readyPlayerIds: Set<PlayerId>
  createdAt: number
  expiresAt: number
  matchPromise: Promise<{ gameId: string }> | null
}

export class FriendRoomService {
  readonly #rooms = new Map<string, StoredRoom>()
  readonly #createMatch: FriendRoomServiceOptions['createMatch']
  readonly #codeSource: () => string
  readonly #now: () => number
  readonly #ttlMs: number

  constructor(options: FriendRoomServiceOptions) {
    this.#createMatch = options.createMatch
    this.#codeSource = options.codeSource ?? randomRoomCode
    this.#now = options.now ?? Date.now
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  }

  create(hostPlayerId: PlayerId, input: { presetId: string; overrides: Record<string, unknown> }): FriendRoomView {
    this.cleanupExpired()
    const resolvedRules = resolveRules(input.presetId, input.overrides)
    const code = this.#nextUniqueCode()
    const createdAt = this.#now()
    const room: StoredRoom = {
      code,
      hostPlayerId,
      guestPlayerId: null,
      resolvedRules,
      rulesHash: hashRules(resolvedRules),
      overrides: structuredClone(input.overrides),
      readyPlayerIds: new Set(),
      createdAt,
      expiresAt: createdAt + this.#ttlMs,
      matchPromise: null,
    }
    this.#rooms.set(code, room)
    return roomView(room)
  }

  join(playerId: PlayerId, untrustedCode: string): { gameId: null; room: FriendRoomView } {
    const room = this.#require(untrustedCode)
    if (room.hostPlayerId === playerId) throw new RoomError('INVALID_PAYLOAD', 'CANNOT_JOIN_OWN_ROOM')
    if (room.guestPlayerId && room.guestPlayerId !== playerId) throw new RoomError('ROOM_FULL', 'ROOM_FULL')
    room.guestPlayerId = playerId
    return { gameId: null, room: roomView(room) }
  }

  updateRules(
    playerId: PlayerId,
    untrustedCode: string,
    input: { presetId: string; overrides: Record<string, unknown> },
  ): FriendRoomView {
    const room = this.#require(untrustedCode)
    if (room.hostPlayerId !== playerId) throw new RoomError('INVALID_PAYLOAD', 'ONLY_HOST_CAN_EDIT_RULES')
    if (room.matchPromise) throw new RoomError('INVALID_PAYLOAD', 'MATCH_ALREADY_STARTING')
    room.resolvedRules = resolveRules(input.presetId, input.overrides)
    room.rulesHash = hashRules(room.resolvedRules)
    room.overrides = structuredClone(input.overrides)
    room.readyPlayerIds.clear()
    return roomView(room)
  }

  async ready(playerId: PlayerId, untrustedCode: string, rulesHash: string): Promise<{ gameId: string | null; room: FriendRoomView }> {
    const room = this.#require(untrustedCode)
    if (playerId !== room.hostPlayerId && playerId !== room.guestPlayerId) {
      throw new RoomError('NOT_FOUND', 'PLAYER_NOT_IN_ROOM')
    }
    if (rulesHash !== room.rulesHash) throw new RoomError('INVALID_PAYLOAD', 'RULES_HASH_MISMATCH')

    if (room.matchPromise) {
      const match = await room.matchPromise
      return { gameId: match.gameId, room: roomView(room) }
    }

    room.readyPlayerIds.add(playerId)
    if (!room.guestPlayerId || !room.readyPlayerIds.has(room.hostPlayerId) || !room.readyPlayerIds.has(room.guestPlayerId)) {
      return { gameId: null, room: roomView(room) }
    }

    const guestPlayerId = room.guestPlayerId
    room.matchPromise = this.#createMatch({
      playerIds: [room.hostPlayerId, guestPlayerId],
      presetId: room.resolvedRules.presetId,
      rules: structuredClone(room.resolvedRules),
      rulesHash: room.rulesHash,
    })
    try {
      const match = await room.matchPromise
      this.#rooms.delete(room.code)
      return { gameId: match.gameId, room: roomView(room) }
    } catch (error) {
      room.matchPromise = null
      throw error
    }
  }

  get(untrustedCode: string): FriendRoomView {
    return roomView(this.#require(untrustedCode))
  }

  cleanupExpired(): number {
    const now = this.#now()
    let removed = 0
    for (const [code, room] of this.#rooms) {
      if (room.expiresAt > now || room.matchPromise) continue
      this.#rooms.delete(code)
      removed += 1
    }
    return removed
  }

  #require(untrustedCode: string): StoredRoom {
    this.cleanupExpired()
    const code = normalizeRoomCode(untrustedCode)
    const room = this.#rooms.get(code)
    if (!room) throw new RoomError('NOT_FOUND', 'ROOM_NOT_FOUND')
    return room
  }

  #nextUniqueCode(): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const code = normalizeRoomCode(this.#codeSource())
      if (!this.#rooms.has(code)) return code
    }
    throw new Error('ROOM_CODE_EXHAUSTED')
  }
}

export function normalizeRoomCode(value: string): string {
  const code = value.trim().toUpperCase()
  if (!ROOM_CODE_PATTERN.test(code)) throw new RoomError('INVALID_PAYLOAD', 'INVALID_ROOM_CODE')
  return code
}

export function hashRules(rules: RuleSnapshot): string {
  return createHash('sha256').update(stableSerialize(rules)).digest('hex')
}

function resolveRules(presetId: string, overrides: Record<string, unknown>): RuleSnapshot {
  try {
    return resolveRuleSnapshot(presetId, overrides)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_RULES'
    throw new RoomError('INVALID_PAYLOAD', message)
  }
}

function roomView(room: StoredRoom): FriendRoomView {
  return structuredClone({
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    guestPlayerId: room.guestPlayerId,
    memberCount: room.guestPlayerId ? 2 : 1,
    readyPlayerIds: [...room.readyPlayerIds],
    rules: room.resolvedRules,
    rulesHash: room.rulesHash,
    customRulePaths: Object.keys(room.overrides).sort(),
    expiresAt: new Date(room.expiresAt).toISOString(),
  })
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function randomRoomCode(): string {
  let code = ''
  for (let index = 0; index < 6; index += 1) code += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]
  return code
}
