import { hubFlightPlan } from './hubFlights'
import { conexoesNaBase } from './malha'
import { DIA } from './escala'
import type { GameState } from './types'

interface ConnectionScheduleRow {
  via: string
  from: string
  to: string
  arrival: number
  departure: number
  wait: number
  days: number
}

function connectionSchedule(state: GameState) {
  const rows: ConnectionScheduleRow[] = []
  const totals = state.airline.hubs.map(hub => {
    const groups = new Map<string, Omit<ConnectionScheduleRow, 'days'> & { days: Set<number> }>()
    const accepted = conexoesNaBase(state, hub)
    for (const c of accepted) {
      if (c.parceira || c.codeshare || c.de.parceira || c.para.parceira) continue
      const key = `${c.de.ponta}:${c.para.ponta}:${c.de.local}:${c.para.local}`
      let group = groups.get(key)
      if (!group) {
        group = { via: hub, from: c.de.ponta, to: c.para.ponta, arrival: c.de.local,
          departure: c.para.local, wait: c.espera, days: new Set() }
        groups.set(key, group)
      }
      group.days.add(Math.floor(c.de.quando / DIA) % 7)
    }
    for (const group of groups.values()) {
      rows.push({ ...group, days: group.days.size })
    }
    const pairs = conexoesNaBase(state, hub, true).length
    return { hub, pairs, rejected: pairs - accepted.length }
  })
  rows.sort((a, b) => a.via.localeCompare(b.via) || a.arrival - b.arrival || a.departure - b.departure)
  return { rows, totals }
}

export type PlanningInput = { query: 'connections' } |
  { query: 'flights'; hub: string; dow: number; furthestOnly: boolean }

export type PlanningOutput = {
  connections: ReturnType<typeof connectionSchedule>
  flights: ReturnType<typeof hubFlightPlan>
}

export function queryPlanning(state: GameState, request: PlanningInput) {
  return request.query === 'connections'
    ? connectionSchedule(state)
    : hubFlightPlan(state, request.hub, request.dow, request.furthestOnly)
}

/** A programação só precisa da malha e da capacidade atual dos aeroportos. */
export function planningSnapshot(state: GameState): GameState {
  const { airline } = state
  const airportDevelopment = state.airportDevelopment && Object.fromEntries(
    Object.entries(state.airportDevelopment).map(([id, d]) => [id, { ...d, idle: [], history: [] }]),
  )
  return {
    ...state, airportDevelopment, ledger: [], notices: [], lastShare: {}, connectionJourneys: undefined,
    airline: {
      ...airline,
      routes: airline.routes.map(route => ({ ...route, history: [] })),
      escala: airline.escala?.map(leg => ({ ...leg, ultimoVoo: undefined })),
    },
  }
}
