import { useEffect, useRef, useState } from 'react'
import { airportRevision } from '../game/airportInfrastructure'
import { planningSnapshot, type PlanningInput, type PlanningOutput } from '../game/planningQueries'
import type { GameState } from '../game/types'
import { useGame } from '../store/useGame'

export function usePlanningQuery<T extends PlanningInput>(request: T): PlanningOutput[T['query']] | null | undefined {
  const { state } = useGame()
  const revision = airportRevision(state)
  const query = request.query
  const hub = request.query === 'flights' ? request.hub : undefined
  const dow = request.query === 'flights' ? request.dow : undefined
  const furthestOnly = request.query === 'flights' && request.furthestOnly
  const key = query === 'flights' ? `${hub}:${furthestOnly}` : query
  const [result, setResult] = useState<{ key: string; data: PlanningOutput[T['query']] | null }>()
  const desired = useRef<{ state: GameState; request: PlanningInput }>(null)
  const send = useRef<(() => void) | null>(null)

  useEffect(() => {
    let worker: Worker
    try {
      worker = new Worker(new URL('../game/planningWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      setResult({ key, data: null })
      return
    }

    let busy = false
    let sent: typeof desired.current = null
    const sendLatest = () => {
      const next = desired.current
      if (busy || !next || next === sent) return
      // Se a simulação virar o dia durante a busca, só a versão mais recente
      // entra na fila depois que o cálculo em curso terminar.
      busy = true
      sent = next
      try {
        worker.postMessage({ state: planningSnapshot(next.state), request: next.request })
      } catch {
        busy = false
        setResult({ key, data: null })
      }
    }
    send.current = sendLatest
    worker.onmessage = ({ data }: MessageEvent<PlanningOutput[T['query']] | null>) => {
      setResult({ key, data })
      busy = false
      sendLatest()
    }
    worker.onerror = () => {
      send.current = null
      setResult({ key, data: null })
      worker.terminate()
    }
    return () => {
      send.current = null
      desired.current = null
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
  }, [key])

  useEffect(() => {
    const input: PlanningInput = query === 'flights' ? { query, hub: hub!, dow: dow!, furthestOnly } : { query }
    desired.current = { state, request: input }
    send.current?.()
  }, [state, revision, key, query, hub, dow, furthestOnly])

  return result?.key === key ? result.data : undefined
}
