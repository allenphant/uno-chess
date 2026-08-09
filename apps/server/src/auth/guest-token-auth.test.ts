import { describe, expect, it } from 'vitest'
import { createGuestTokenAuth } from './guest-token-auth.js'

describe('guest token auth', () => {
  it('derives a stable actor from a sufficiently random persistent token', async () => {
    const auth = createGuestTokenAuth()
    const token = `guest:${'a'.repeat(32)}`
    const first = await auth.verify(token)
    const second = await auth.verify(token)

    expect(first).toEqual(second)
    expect(first).toEqual({
      playerId: expect.stringMatching(/^guest-[a-f0-9]{64}$/),
      accountKind: 'guest',
    })
    expect(first?.playerId).not.toContain('a'.repeat(32))
  })

  it.each([undefined, null, '', 'guest:short', `admin:${'a'.repeat(32)}`, `guest:${'*'.repeat(32)}`])(
    'rejects malformed token %j',
    async (token) => {
      await expect(createGuestTokenAuth().verify(token)).resolves.toBeNull()
    },
  )
})
