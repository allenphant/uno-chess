export function hashSeed(seed: string): number {
  let value = 2166136261
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

export function nextRandom(seed: string, cursor: number): number {
  let value = (hashSeed(seed) + Math.imul(cursor + 1, 0x9e3779b1)) >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 0x1_0000_0000
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string, initialCursor = 0): { items: T[]; cursor: number } {
  const shuffled = [...items]
  let cursor = initialCursor
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(seed, cursor) * (index + 1))
    cursor += 1
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]!
    shuffled[swapIndex] = current!
  }
  return { items: shuffled, cursor }
}
