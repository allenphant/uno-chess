import type { GameEvent, GameIntent, GameState, PlayerId, PlayerView } from '@uno-chess/protocol'
import { applyIntent, projectPlayerView } from '@uno-chess/rules'

export interface PersistedIntent {
  gameId: string
  actorId: PlayerId
  expectedRevision: number
  nextRevision: number
  intent: GameIntent
  events: GameEvent[]
  state: GameState
}

export interface SessionPersistence {
  appendIntent(entry: PersistedIntent): Promise<void>
}

export interface IntentAck {
  gameId: string
  revision: number
  events: GameEvent[]
}

export class SessionError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'STALE_REVISION' | 'ILLEGAL_INTENT',
    message: string = code,
  ) {
    super(message)
    this.name = 'SessionError'
  }
}

const inMemoryPersistence: SessionPersistence = {
  async appendIntent() {},
}

export class GameSession {
  #state: GameState
  #revision: number
  #tail: Promise<void> = Promise.resolve()
  #acceptedAcks = new Map<string, { actorId: PlayerId; ack: IntentAck }>()
  #submissions = new Map<string, { actorId: PlayerId; operation: Promise<IntentAck> }>()

  constructor(
    initialState: GameState,
    private readonly persistence: SessionPersistence = inMemoryPersistence,
    initialRevision = 0,
  ) {
    this.#state = structuredClone(initialState)
    this.#revision = initialRevision
  }

  get gameId(): string {
    return this.#state.gameId
  }

  get revision(): number {
    return this.#revision
  }

  get playerIds(): readonly [PlayerId, PlayerId] {
    return this.#state.playerOrder
  }

  hasPlayer(playerId: PlayerId): boolean {
    return this.#state.playerOrder.includes(playerId)
  }

  viewFor(playerId: PlayerId): PlayerView {
    if (!this.hasPlayer(playerId)) throw new SessionError('NOT_FOUND', 'PLAYER_NOT_IN_GAME')
    return projectPlayerView(this.#state, playerId)
  }

  submit(actorId: PlayerId, intent: GameIntent, expectedRevision: number): Promise<IntentAck> {
    if (!this.hasPlayer(actorId)) return Promise.reject(new SessionError('NOT_FOUND', 'PLAYER_NOT_IN_GAME'))
    const accepted = this.#acceptedAcks.get(intent.intentId)
    if (accepted) {
      if (accepted.actorId !== actorId) return Promise.reject(new SessionError('ILLEGAL_INTENT', 'INTENT_ID_CONFLICT'))
      return Promise.resolve(structuredClone(accepted.ack))
    }
    const pending = this.#submissions.get(intent.intentId)
    if (pending) {
      if (pending.actorId !== actorId) return Promise.reject(new SessionError('ILLEGAL_INTENT', 'INTENT_ID_CONFLICT'))
      return pending.operation.then((value) => structuredClone(value))
    }

    const operation = this.#tail.then(() => this.#apply(actorId, intent, expectedRevision))
    this.#submissions.set(intent.intentId, { actorId, operation })
    this.#tail = operation.then(() => undefined, () => undefined)
    void operation.finally(() => this.#submissions.delete(intent.intentId)).catch(() => undefined)
    return operation.then((value) => structuredClone(value))
  }

  async #apply(actorId: PlayerId, untrustedIntent: GameIntent, expectedRevision: number): Promise<IntentAck> {
    const replay = this.#acceptedAcks.get(untrustedIntent.intentId)
    if (replay) {
      if (replay.actorId !== actorId) throw new SessionError('ILLEGAL_INTENT', 'INTENT_ID_CONFLICT')
      return replay.ack
    }
    if (!this.hasPlayer(actorId)) throw new SessionError('NOT_FOUND', 'PLAYER_NOT_IN_GAME')
    if (expectedRevision !== this.#revision) throw new SessionError('STALE_REVISION')

    const intent = { ...untrustedIntent, playerId: actorId } as GameIntent
    let applied: ReturnType<typeof applyIntent>
    try {
      applied = applyIntent(this.#state, intent)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ILLEGAL_INTENT'
      throw new SessionError('ILLEGAL_INTENT', message)
    }

    const nextRevision = this.#revision + 1
    await this.persistence.appendIntent({
      gameId: this.gameId,
      actorId,
      expectedRevision: this.#revision,
      nextRevision,
      intent: structuredClone(intent),
      events: structuredClone(applied.events),
      state: structuredClone(applied.state),
    })

    this.#state = applied.state
    this.#revision = nextRevision
    const ack: IntentAck = {
      gameId: this.gameId,
      revision: this.#revision,
      events: structuredClone(applied.events),
    }
    this.#acceptedAcks.set(intent.intentId, { actorId, ack })
    return ack
  }
}
