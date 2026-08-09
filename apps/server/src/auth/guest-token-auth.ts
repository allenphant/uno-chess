import { createHash } from 'node:crypto'
import type { SocketAuth } from '../create-server.js'

const GUEST_TOKEN_PATTERN = /^guest:([A-Za-z0-9_-]{32,128})$/

/**
 * Stateless identity bridge for the first PvP slice. Clients persist a
 * cryptographically-random `guest:<base64url>` token; the raw secret is never
 * exposed as the public player id. Replace this verifier with Supabase auth
 * before accounts or progression are enabled.
 */
export function createGuestTokenAuth(): SocketAuth {
  return {
    async verify(untrustedToken) {
      if (typeof untrustedToken !== 'string') return null
      const match = GUEST_TOKEN_PATTERN.exec(untrustedToken)
      const secret = match?.[1]
      if (!secret) return null
      const digest = createHash('sha256').update(untrustedToken).digest('hex')
      return { playerId: `guest-${digest}`, accountKind: 'guest' }
    },
  }
}
