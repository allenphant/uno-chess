import type { PlayerId, RuleSnapshot } from './domain.js'

export interface FriendRoomView {
  code: string
  hostPlayerId: PlayerId
  guestPlayerId: PlayerId | null
  memberCount: 1 | 2
  readyPlayerIds: PlayerId[]
  rules: RuleSnapshot
  rulesHash: string
  customRulePaths: string[]
  expiresAt: string
}

export interface CreateFriendRoomInput {
  presetId: string
  overrides: Record<string, unknown>
}

export interface UpdateFriendRoomInput extends CreateFriendRoomInput {
  code: string
}
