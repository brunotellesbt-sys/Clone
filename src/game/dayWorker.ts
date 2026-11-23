import { advanceWithUpdate } from './dayUpdate'
import type { GameState } from './types'

let state: GameState | undefined

self.onmessage = ({ data }: MessageEvent<{ state?: GameState }>) => {
  try {
    state = data.state ?? state
    if (!state) throw new Error('Estado inicial da simulação ausente.')
    self.postMessage({ update: advanceWithUpdate(state) })
  } catch (error) {
    state = undefined
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
