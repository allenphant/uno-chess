import { randomUUID } from 'node:crypto'
import type { MatchDescriptor, PlayerId, RuleSnapshot } from '@uno-chess/protocol'
import { createGame } from '@uno-chess/rules'
import { GameSession, type SessionPersistence } from './GameSession.js'

export interface CreateMatchInput {
  playerIds: [PlayerId, PlayerId]
  presetId: string
  rules: RuleSnapshot
  rulesHash: string
  seed?: string
}

export interface GameRegistryOptions {
  idSource?: () => string
  seedSource?: () => string
  persistence?: SessionPersistence
}

export class GameRegistry {
  readonly #sessions = new Map<string, GameSession>()
  readonly #idSource: () => string
  readonly #seedSource: () => string
  readonly #persistence: SessionPersistence | undefined

  constructor(options: GameRegistryOptions = {}) {
    this.#idSource = options.idSource ?? randomUUID
    this.#seedSource = options.seedSource ?? randomUUID
    this.#persistence = options.persistence
  }

  async create(input: CreateMatchInput): Promise<MatchDescriptor> {
    if (input.playerIds[0] === input.playerIds[1]) throw new Error('MATCH_REQUIRES_DISTINCT_PLAYERS')
    const gameId = this.#idSource()
    if (this.#sessions.has(gameId)) throw new Error('DUPLICATE_GAME_ID')
    const seed = input.seed ?? this.#seedSource()
    const state = createGame({ gameId, playerIds: input.playerIds, rules: input.rules, seed })
    const session = this.#persistence
      ? new GameSession(state, this.#persistence)
      : new GameSession(state)
    this.#sessions.set(gameId, session)
    return {
      gameId,
      playerIds: input.playerIds,
      presetId: input.presetId,
      rules: structuredClone(input.rules),
      rulesHash: input.rulesHash,
      seed,
    }
  }

  get(gameId: string): GameSession | undefined {
    return this.#sessions.get(gameId)
  }

  require(gameId: string): GameSession {
    const session = this.get(gameId)
    if (!session) throw new SessionErrorForRegistry('GAME_NOT_FOUND')
    return session
  }
}

export class SessionErrorForRegistry extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionErrorForRegistry'
  }
}
