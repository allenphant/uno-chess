const TOKEN_KEY = 'uno-chess.guest-token.v1'

export interface GuestIdentity {
  token: string
  displayName: string
}

export function getGuestIdentity(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): GuestIdentity {
  const stored = storage.getItem(TOKEN_KEY)
  const secret = stored && /^[A-Za-z0-9_-]{32,128}$/.test(stored) ? stored : createSecret()
  if (secret !== stored) storage.setItem(TOKEN_KEY, secret)
  return { token: `guest:${secret}`, displayName: `訪客 ${secret.slice(0, 4).toUpperCase()}` }
}

function createSecret(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
