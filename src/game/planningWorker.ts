import { queryPlanning, type PlanningInput } from './planningQueries'
import type { GameState } from './types'

self.onmessage = ({ data }: MessageEvent<{ state: GameState; request: PlanningInput }>) => {
  try { self.postMessage(queryPlanning(data.state, data.request)) }
  catch { self.postMessage(null) }
}
