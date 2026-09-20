import { createContext, useContext } from 'react'
import type { GameState } from '../game/types'

export interface GameContextValue {
  state: GameState
  activeSlot: number
  /** Executa uma mutação no estado e força o redesenho. Devolve a mensagem de erro, se houver. */
  act: (fn: (s: GameState) => string | null | void) => string | null
  replace: (s: GameState, slot?: number) => void
  reset: (slot?: number) => void
  toast: (msg: string, kind?: 'info' | 'error') => void
  switchSlot: (slot: number) => void
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame precisa estar dentro do provider')
  return ctx
}
