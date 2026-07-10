import { describe, expect, it } from 'vitest'
import * as protocol from '@uno-chess/protocol'

describe('workspace', () => {
  it('links local packages through npm workspaces', () => {
    expect(protocol).toHaveProperty('protocolVersion', 1)
  })
})
