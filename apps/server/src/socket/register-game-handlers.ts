import type {
  ClientToServerEvents,
  GameIntent,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@uno-chess/protocol'
import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import type { GameRegistry } from '../game/GameRegistry.js'
import { failure } from './errors.js'

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

const playerFields = {
  playerId: z.string().min(1),
  intentId: z.string().min(1).max(128),
} as const
const square = z.string().regex(/^[a-h][1-8]$/)
const promotion = z.enum(['q', 'r', 'b', 'n'])

const gameIntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('draw-for-turn'), ...playerFields }).strict(),
  z.object({ type: z.literal('discard-overflow'), ...playerFields, cardId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('basic-move'), ...playerFields, from: square, to: square, promotion: promotion.optional() }).strict(),
  z.object({ type: z.literal('play-action-card'), ...playerFields, cardId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('action-move'), ...playerFields, from: square, to: square, promotion: promotion.optional() }).strict(),
  z.object({ type: z.literal('finish-action-card'), ...playerFields }).strict(),
  z.object({ type: z.literal('play-function-card'), ...playerFields, cardId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('choose-reinforcement'), ...playerFields, capturedPieceIds: z.array(z.string().min(1)).max(2), squares: z.array(square).max(2) }).strict(),
  z.object({ type: z.literal('choose-wild-color'), ...playerFields, color: z.enum(['red', 'yellow', 'green', 'blue']) }).strict(),
])

const gameIntentInputSchema = z.object({
  gameId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  intent: gameIntentSchema,
}).strict()

const gameResumeSchema = z.object({ gameId: z.string().min(1) }).strict()

export function registerGameHandlers(io: GameServer, socket: GameSocket, registry: GameRegistry): void {
  socket.on('game:resume', async (untrusted, acknowledge) => {
    try {
      const { gameId } = gameResumeSchema.parse(untrusted)
      const session = registry.require(gameId)
      const actorId = socket.data.actor.playerId
      const view = session.viewFor(actorId)
      await socket.join(gameRoom(gameId))
      acknowledge({ ok: true, data: { view, revision: session.revision } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })

  socket.on('game:intent', async (untrusted, acknowledge) => {
    try {
      const input = gameIntentInputSchema.parse(untrusted)
      const session = registry.require(input.gameId)
      const intent = input.intent as unknown as GameIntent
      const result = await session.submit(socket.data.actor.playerId, intent, input.revision)
      await publishProjections(io, session, result.events)
      acknowledge({ ok: true, data: { revision: result.revision } })
    } catch (error) {
      acknowledge(failure(error))
    }
  })
}

export async function publishProjections(
  io: GameServer,
  session: ReturnType<GameRegistry['require']>,
  events: Parameters<ServerToClientEvents['game:projection']>[0]['events'],
): Promise<void> {
  const sockets = await io.in(gameRoom(session.gameId)).fetchSockets()
  for (const participantSocket of sockets) {
    const playerId = participantSocket.data.actor.playerId
    if (!session.hasPlayer(playerId)) continue
    participantSocket.emit('game:projection', {
      gameId: session.gameId,
      revision: session.revision,
      view: session.viewFor(playerId),
      events,
    })
  }
}

export function gameRoom(gameId: string): string {
  return `game:${gameId}`
}
