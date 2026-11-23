import { suggestHubConnections } from './hubConnections'
import type { GameState } from './types'

self.onmessage = ({ data }: MessageEvent<{ hub: string; state: GameState }>) => {
  try { self.postMessage(suggestHubConnections(data.state, data.hub)) }
  catch { self.postMessage(null) }
}
