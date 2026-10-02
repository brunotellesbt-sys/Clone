import { effectiveAirport } from './airportInfrastructure'
import type { GameState } from './types'
import { AIRCRAFT_BY_ID, ehCargueiro } from './data/aircraft'
import { vooPermitido } from './data/airports'
import { aeroportoServe, withEngine } from './spec'
import { distanceBetween } from './geo'

// Pista/porte são estáticos. O ano é filtrado na consulta, sem cache de save.
const variants = Object.values(AIRCRAFT_BY_ID).filter(t => !ehCargueiro(t))
  .flatMap(t => t.engines.map(e => withEngine(t, e)))
  .sort((a, b) => b.maxSeats - a.maxSeats || b.range - a.range)
const airports = new Map<string, typeof variants>()
function available(iata: string, state?: GameState) {
  const ap = effectiveAirport(state, iata)
  const key = `${iata}:${ap.runway}:${ap.pistaOperacional}:${ap.tetoAssentos}`
  let types = airports.get(key)
  if (!types) {
    types = variants.filter(t => aeroportoServe(t, ap))
    airports.set(key, types)
  }
  return types
}

/** Maior capacidade certificada operável, incluindo motor, ano e alcance. */
export function largestPassengerAircraft(from: string, to: string, year: number, state?: GameState) {
  const a = effectiveAirport(state, from), b = effectiveAirport(state, to)
  if (!a || !b || vooPermitido(a, b)) return undefined
  const distance = distanceBetween(from, to)
  return available(from, state).find(t => t.since <= year && t.range >= distance && aeroportoServe(t, b))
}

/** Catálogo efetivo também para a frota exibida das rivais. */
export function passengerAircraftForRoute(from: string, to: string, year: number, state?: GameState) {
  const a = effectiveAirport(state, from), b = effectiveAirport(state, to)
  if (!a || !b || vooPermitido(a, b)) return []
  const distance = distanceBetween(from, to)
  return available(from, state).filter(t => t.since <= year && t.range >= distance && aeroportoServe(t, b))
}
