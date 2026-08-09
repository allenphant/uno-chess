import { describe, expect, it, vi } from 'vitest'
import { FriendRoomService, RoomError, hashRules } from './FriendRoomService.js'

describe('FriendRoomService', () => {
  it('creates a six-character room and starts after two distinct players accept the same rules', async () => {
    const createMatch = vi.fn().mockResolvedValue({ gameId: 'game-1' })
    const rooms = new FriendRoomService({ codeSource: () => 'UNX234', createMatch })
    const created = rooms.create('p1', { presetId: 'standard-v1', overrides: {} })

    expect(created.code).toBe('UNX234')
    expect(rooms.join('p2', ' unx234 ')).toMatchObject({ gameId: null })
    await expect(rooms.ready('p1', 'UNX234', created.rulesHash)).resolves.toMatchObject({ gameId: null })
    await expect(rooms.ready('p2', 'UNX234', created.rulesHash)).resolves.toMatchObject({ gameId: 'game-1' })
    expect(createMatch).toHaveBeenCalledWith(expect.objectContaining({
      playerIds: ['p1', 'p2'],
      rulesHash: created.rulesHash,
    }))
    expect(() => rooms.get('UNX234')).toThrow('ROOM_NOT_FOUND')
  })

  it('creates a match exactly once under concurrent ready requests', async () => {
    const createMatch = vi.fn().mockResolvedValue({ gameId: 'game-1' })
    const rooms = new FriendRoomService({ codeSource: () => 'ABC234', createMatch })
    const room = rooms.create('p1', { presetId: 'standard-v1', overrides: {} })
    rooms.join('p2', room.code)
    await rooms.ready('p1', room.code, room.rulesHash)

    const [one, two] = await Promise.all([
      rooms.ready('p2', room.code, room.rulesHash),
      rooms.ready('p2', room.code, room.rulesHash),
    ])
    expect(one.gameId).toBe('game-1')
    expect(two.gameId).toBe('game-1')
    expect(createMatch).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown, self-join, full, wrong hash, and invalid overrides', async () => {
    const rooms = new FriendRoomService({ codeSource: () => 'RXXM24', createMatch: async () => ({ gameId: 'g' }) })
    expect(() => rooms.get('NXXE24')).toThrow('ROOM_NOT_FOUND')
    const room = rooms.create('p1', { presetId: 'standard-v1', overrides: {} })
    expect(() => rooms.join('p1', room.code)).toThrow('CANNOT_JOIN_OWN_ROOM')
    rooms.join('p2', room.code)
    expect(() => rooms.join('p3', room.code)).toThrow('ROOM_FULL')
    await expect(rooms.ready('p1', room.code, 'bad')).rejects.toThrow('RULES_HASH_MISMATCH')
    expect(() => rooms.create('p4', { presetId: 'standard-v1', overrides: { forbidden: true } })).toThrow('OVERRIDE_NOT_ALLOWED')
  })

  it('clears readiness whenever the host changes a validated rule', async () => {
    const rooms = new FriendRoomService({ codeSource: () => 'EDXT24', createMatch: async () => ({ gameId: 'g' }) })
    const room = rooms.create('p1', { presetId: 'standard-v1', overrides: {} })
    rooms.join('p2', room.code)
    await rooms.ready('p1', room.code, room.rulesHash)

    const updated = rooms.updateRules('p1', room.code, {
      presetId: 'standard-v1',
      overrides: { 'timing.turnSeconds': 60 },
    })

    expect(updated.readyPlayerIds).toEqual([])
    expect(updated.customRulePaths).toEqual(['timing.turnSeconds'])
    expect(updated.rulesHash).not.toBe(room.rulesHash)
    expect(() => rooms.updateRules('p2', room.code, { presetId: 'standard-v1', overrides: {} })).toThrow('ONLY_HOST_CAN_EDIT_RULES')
  })

  it('expires unstarted rooms after thirty minutes', () => {
    let now = 1_000
    const rooms = new FriendRoomService({
      codeSource: () => 'TXME24',
      createMatch: async () => ({ gameId: 'g' }),
      now: () => now,
    })
    rooms.create('p1', { presetId: 'standard-v1', overrides: {} })
    now += 30 * 60 * 1_000

    expect(rooms.cleanupExpired()).toBe(1)
    expect(() => rooms.get('TXME24')).toThrow(RoomError)
  })

  it('hashes equivalent snapshots deterministically', () => {
    const rooms = new FriendRoomService({ codeSource: () => 'HASH24', createMatch: async () => ({ gameId: 'g' }) })
    const room = rooms.create('p1', { presetId: 'standard-v1', overrides: {} })
    expect(hashRules(structuredClone(room.rules))).toBe(room.rulesHash)
  })
})
