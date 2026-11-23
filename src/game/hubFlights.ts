import { airportSlots, airportUsage, effectiveAirport, routeEntryAccess } from './airportInfrastructure'
import { AIRPORTS, AIRPORT_BY_IATA, noToqueDeRecolher, vooPermitido } from './data/airports'
import { blockHours } from './economy'
import { DIA, SEMANA, aeronaveServe, fichaDe, naSemana, pernasDe } from './escala'
import { distanceBetween, odKey } from './geo'
import type { Aircraft, GameState } from './types'

interface Opportunity {
  ac: Aircraft
  available: number
  until: number
  departure: number
  arrival: number
  to: string
  distance: number
  roundTrip: boolean
  needsRoute: boolean
}

export function hubFlightOpportunities(s: GameState, hub: string, dow: number): Opportunity[] {
  const start = dow * DIA - AIRPORT_BY_IATA[hub].fuso
  const end = start + SEMANA
  const slots = new Map<string, number[]>()
  const usage = airportUsage(s)
  const routes = new Map(s.airline.routes.map(r => [odKey(r.from, r.to), r]))
  const destinations = AIRPORTS.filter(a => a.iata !== hub)
    .map(a => ({ id: a.iata, distance: distanceBetween(hub, a.iata) }))
    .sort((a, b) => b.distance - a.distance)
  const airport = effectiveAirport(s, hub)
  const local = (iata: string, utc: number) => utc + AIRPORT_BY_IATA[iata].fuso
  const weekday = (localMinute: number) => Math.floor(naSemana(localMinute) / DIA)
  const freeSlots = (iata: string, day: number) => {
    let days = slots.get(iata)
    if (!days) {
      const limit = airportSlots(s, iata).ownLimit
      const grant = routeEntryAccess(s, iata).grant
      days = Array.from({ length: 7 }, (_, d) => Math.max(limit, grant) - (usage.get(iata)?.days[d] ?? 0))
      slots.set(iata, days)
    }
    return days[day]
  }

  function trip(ac: Aircraft, w: { available: number; until: number; next: string }, to: string, distance: number) {
    const roundTrip = w.next === hub
    const spec = fichaDe(ac)
    const block = Math.round(blockHours(spec, distance) * 60)
    const turnAtHub = roundTrip ? spec.turn : 0
    const occupied = roundTrip ? block * 2 + spec.turn + turnAtHub : block
    if (distance > spec.range || w.available + occupied > w.until) return
    const route = routes.get(odKey(hub, to))
    if (route && !!route.cargo !== (spec.payload !== undefined)) return
    if (!route && (routeEntryAccess(s, hub).blocked || routeEntryAccess(s, to).blocked)) return
    if (vooPermitido(airport, effectiveAirport(s, to)) || aeronaveServe(s, ac, hub, to)) return

    const blockedDayPairs = new Set<number>()
    for (let departure = w.available; departure + occupied <= w.until; departure++) {
      const landing = departure + block
      const departureLocal = local(hub, departure)
      const landingLocal = local(to, landing)
      const depDay = weekday(departureLocal)
      const arrDay = weekday(landingLocal)
      const dayPair = depDay * 7 + arrDay
      if (blockedDayPairs.has(dayPair)) continue
      const outSlots = freeSlots(hub, depDay)
      const destSlots = freeSlots(to, arrDay)
      if (outSlots < 1 || destSlots < 1 ||
          noToqueDeRecolher(hub, departureLocal) || noToqueDeRecolher(to, landingLocal)) continue
      if (!roundTrip) return { departure, arrival: landing }

      for (let back = landing + spec.turn; back + block + turnAtHub <= w.until; back++) {
        const returnLocal = local(to, back)
        const homeLocal = local(hub, back + block)
        if (freeSlots(to, weekday(returnLocal)) <= Number(weekday(returnLocal) === arrDay) ||
            freeSlots(hub, weekday(homeLocal)) <= Number(weekday(homeLocal) === depDay) ||
            noToqueDeRecolher(to, returnLocal) || noToqueDeRecolher(hub, homeLocal)) continue
        return { departure, arrival: back + block }
      }
      blockedDayPairs.add(dayPair)
    }
  }

  const result: Opportunity[] = []
  for (const ac of s.airline.fleet) {
    if (ac.isReserve || ac.groundedUntil > s.day) continue
    const legs = pernasDe(s, ac.id)
    const windows: { available: number; until: number; next: string }[] = []
    if (!legs.length && (ac.base ?? s.airline.hubs[0]) === hub)
      windows.push({ available: start, until: end, next: hub })
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]
      if (leg.perna.to !== hub) continue
      const next = legs[(i + 1) % legs.length]
      const available = leg.chegada + leg.solo
      const departure = next.partida + (i === legs.length - 1 ? SEMANA : 0)
      for (const offset of [-SEMANA, 0, SEMANA]) {
        const from = Math.max(start, available + offset)
        const until = Math.min(end, departure + offset)
        if (from < until) windows.push({ available: from, until, next: next.perna.from })
      }
    }
    for (const window of windows) {
      const candidates = window.next === hub ? destinations : [{ id: window.next, distance: distanceBetween(hub, window.next) }]
      for (const { id: to, distance } of candidates) {
        // Na conexão direta também é necessário o solo antes do próximo voo.
        const limit = window.next === hub ? window.until : window.until - fichaDe(ac).turn
        const feasible = trip(ac, { ...window, until: limit }, to, distance)
        if (!feasible) continue
        result.push({ ac, ...window, ...feasible, to, distance, roundTrip: window.next === hub,
          needsRoute: !routes.has(odKey(hub, to)) })
        break
      }
    }
  }
  return result.sort((a, b) => a.available - b.available || b.distance - a.distance)
}
