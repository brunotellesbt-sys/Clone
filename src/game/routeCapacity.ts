import { AIRCRAFT_BY_ID, ehCargueiro } from './data/aircraft'
import { AIRPORT_BY_IATA, vooPermitido } from './data/airports'
import { aeroportoServe, withEngine } from './spec'
import { distanceBetween } from './geo'

// Pista/porte são estáticos. O ano é filtrado na consulta, sem cache de save.
const variants = Object.values(AIRCRAFT_BY_ID).filter(t => !ehCargueiro(t))
  .flatMap(t => t.engines.map(e => withEngine(t, e)))
  .sort((a, b) => b.maxSeats - a.maxSeats || b.range - a.range)
const airports = new Map<string, typeof variants>()
function available(iata: string) {
  let types = airports.get(iata)
  if (!types) {
    types = variants.filter(t => aeroportoServe(t, AIRPORT_BY_IATA[iata]))
    airports.set(iata, types)
  }
  return types
}

/** Maior capacidade certificada operável, incluindo motor, ano e alcance. */
export function largestPassengerAircraft(from: string, to: string, year: number) {
  const a = AIRPORT_BY_IATA[from], b = AIRPORT_BY_IATA[to]
  if (!a || !b || vooPermitido(a, b)) return undefined
  const distance = distanceBetween(from, to)
  return available(from).find(t => t.since <= year && t.range >= distance && aeroportoServe(t, b))
}

/** Catálogo efetivo também para a frota exibida das rivais. */
export function passengerAircraftForRoute(from: string, to: string, year: number) {
  const a = AIRPORT_BY_IATA[from], b = AIRPORT_BY_IATA[to]
  if (!a || !b || vooPermitido(a, b)) return []
  const distance = distanceBetween(from, to)
  return available(from).filter(t => t.since <= year && t.range >= distance && aeroportoServe(t, b))
}
