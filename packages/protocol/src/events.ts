export interface GameEvent {
  type: string
  gameId: string
  sequence: number
  [detail: string]: unknown
}
