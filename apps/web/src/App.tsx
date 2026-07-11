import { useRef } from 'react'
import { LocalGamePage } from './game/LocalGamePage.js'

export function createLocalGameSeed(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function App() {
  const seed = useRef(createLocalGameSeed()).current
  return <LocalGamePage seed={seed} />
}
