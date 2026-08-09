import { createGameServer } from './create-server.js'
import { createGuestTokenAuth } from './auth/guest-token-auth.js'

const port = readPort(process.env.PORT)
const webOrigin = process.env.WEB_ORIGIN

const server = await createGameServer({
  port,
  host: process.env.HOST ?? '0.0.0.0',
  ...(webOrigin ? { webOrigin } : {}),
  auth: createGuestTokenAuth(),
})

console.log(`UNO Chess server listening at ${server.url}`)

function readPort(raw: string | undefined): number {
  if (!raw) return 3000
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 65_535) throw new Error('INVALID_PORT')
  return value
}
