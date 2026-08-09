import type { Ack, ErrorCode } from '@uno-chess/protocol'
import { ZodError } from 'zod'
import { SessionError } from '../game/GameSession.js'
import { SessionErrorForRegistry } from '../game/GameRegistry.js'
import { RoomError } from '../lobby/FriendRoomService.js'

export function failure(error: unknown): Ack<never> {
  if (error instanceof ZodError) return rejected('INVALID_PAYLOAD', 'INVALID_PAYLOAD')
  if (error instanceof RoomError) return rejected(error.code, error.message)
  if (error instanceof SessionError) return rejected(error.code, error.message)
  if (error instanceof SessionErrorForRegistry) return rejected('NOT_FOUND', error.message)
  return rejected('INTERNAL_ERROR', 'INTERNAL_ERROR')
}

function rejected(code: ErrorCode, message: string): Ack<never> {
  return { ok: false, error: { code, message } }
}
