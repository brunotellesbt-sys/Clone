import { advanceDay } from './engine'
import type { ConnectionJourney, DayResult, GameState, Perna } from './types'

type JourneyChange = Pick<ConnectionJourney, 'cancelled' | 'firstCost' | 'secondCost'>
const journeyChange = (j: ConnectionJourney): JourneyChange => ({
  ...(j.cancelled !== undefined && { cancelled: j.cancelled }),
  ...(j.firstCost !== undefined && { firstCost: j.firstCost }),
  ...(j.secondCost !== undefined && { secondCost: j.secondCost }),
})

function appendDay(previous: DayResult[], size: number, entry?: DayResult) {
  return entry ? [...previous.slice(previous.length - size + 1), entry] : previous
}

/** Envia a apuração do dia e reutiliza os históricos que a interface já recebeu. */
export function advanceWithUpdate(s: GameState) {
  const previous = s.connectionJourneys ?? []
  const before = previous.map(journeyChange)
  advanceDay(s)
  const { airline, competitors, ledger, connectionJourneys = [], ...daily } = s
  const { escala, routes, ...company } = airline

  const removed: number[] = []
  const changed: [number, JourneyChange][] = []
  let kept = 0
  previous.forEach((entry, index) => {
    if (connectionJourneys[kept] !== entry) {
      removed.push(index)
      return
    }
    const old = before[index]
    if (old.cancelled !== entry.cancelled || old.firstCost !== entry.firstCost || old.secondCost !== entry.secondCost)
      changed.push([index, journeyChange(entry)])
    kept++
  })

  return {
    daily,
    company,
    competitors: s.day % 7 === 0 ? competitors : undefined,
    ledger: { size: ledger.length, entry: ledger.at(-1) },
    routes: routes.map(({ id, history }) => ({
      id, size: history.length, entry: history.at(-1)?.day === s.day ? history.at(-1) : undefined,
    })),
    flightResults: (escala ?? []).flatMap(p =>
      p.ultimoVoo?.day === s.day ? [[p.id, p.ultimoVoo] as const] : [],
    ),
    journeys: { removed, changed, added: connectionJourneys.slice(kept) },
  }
}

export type DayUpdate = ReturnType<typeof advanceWithUpdate>

export function applyDayUpdate(s: GameState, update: DayUpdate): GameState {
  const routeHistory = new Map(update.routes.map(r => [r.id, r]))
  const flightResults = new Map<string, Perna['ultimoVoo']>(update.flightResults)
  const removed = new Set(update.journeys.removed)
  const changed = new Map(update.journeys.changed)
  const journeys = (s.connectionJourneys ?? []).flatMap((entry, index) => {
    if (removed.has(index)) return []
    const change = changed.get(index)
    return [change ? { ...entry, ...change } : entry]
  })
  const routes = s.airline.routes.map(route => {
    const history = routeHistory.get(route.id)
    return history?.entry ? { ...route, history: appendDay(route.history, history.size, history.entry) } : route
  })
  return {
    ...update.daily,
    competitors: update.competitors ?? s.competitors,
    ledger: appendDay(s.ledger, update.ledger.size, update.ledger.entry),
    connectionJourneys: journeys.concat(update.journeys.added),
    airline: {
      ...update.company,
      routes,
      escala: s.airline.escala?.map(p => flightResults.has(p.id) ? { ...p, ultimoVoo: flightResults.get(p.id) } : p),
    },
  }
}
