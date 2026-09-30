import { AIRPORT_BY_IATA, type Airport } from './data/airports'
import { crescimentoDe } from './data/crescimento'
import { distanceBetween } from './geo'
import { gameDayDate } from './calendarDates'
import type { Competitor, GameState } from './types'

export const competitorHubs = (c: Competitor) => [...new Set([c.hub, ...(c.hubs ?? [])])]
const cityKey = (a: Airport) => `${a.cc}:${a.city}`
type Activity = { movements: number; international: number; ownMovements: number }
const cache = new WeakMap<GameState, { day: number; hubs: Map<string, Activity> }>()
export function invalidateHubActivity(s: GameState) { cache.delete(s) }

/** Só malha operada gera desenvolvimento; comprar um hub vazio não basta. */
export function activeHubs(s: GameState) {
  const cached = cache.get(s)
  if (cached?.day === s.day) return cached.hubs
  const hubs = new Map<string, Activity>()
  const add = (iata: string, other: string, movements: number, own = false) => {
    if (movements <= 0) return
    const value = hubs.get(iata) ?? { movements: 0, international: 0, ownMovements: 0 }
    value.movements += movements
    if (own) value.ownMovements += movements
    if (AIRPORT_BY_IATA[iata].cc !== AIRPORT_BY_IATA[other].cc) value.international += movements
    hubs.set(iata, value)
  }
  const own = new Set(s.airline.hubs)
  const operating = new Set(s.airline.fleet.filter(a => a.groundedUntil <= s.day).map(a => a.id))
  for (const leg of s.airline.escala ?? []) {
    if (!operating.has(leg.aircraftId)) continue
    if (own.has(leg.from)) add(leg.from, leg.to, 1 / 7, true)
    if (own.has(leg.to)) add(leg.to, leg.from, 1 / 7, true)
  }
  for (const comp of s.competitors) {
    const bases = new Set(competitorHubs(comp))
    for (const route of comp.routes) {
      if (bases.has(route.from)) add(route.from, route.to, route.freq * 2)
      if (bases.has(route.to)) add(route.to, route.from, route.freq * 2)
    }
  }
  cache.set(s, { day: s.day, hubs })
  return hubs
}

/** Até 2× a taxa em hubs domésticos, 4× nos internacionais; megacidades reduzem o bônus à metade. */
export function hubGrowthRateMultiplier(population: number, movements: number, international: number) {
  if (movements <= 0) return 1
  const strength = Math.min(1, .25 + movements / 40)
  const bonus = (international > 0 ? 3 : 1) * strength
  return 1 + bonus * (population >= 10 ? .5 : 1)
}

/** Acumula só o tempo observado. Saves antigos não ganham anos retroativos. */
export function stepHubDevelopment(s: GameState) {
  if (!s.hubDevelopment) { s.hubDevelopment = { day: s.day, cities: {}, pending: {} }; return }
  if (!s.hubDevelopment.pending) {
    s.hubDevelopment.pending = {}
    s.hubDevelopment.day = s.day
    return // migração: não presume a operação dos dias anteriores
  }
  const elapsed = s.day - s.hubDevelopment.day
  if (elapsed <= 0) return
  s.hubDevelopment.day = s.day
  const cities = new Map<string, { ap: Airport; movements: number; international: number }>()
  for (const [iata, value] of activeHubs(s)) {
    const ap = AIRPORT_BY_IATA[iata], key = cityKey(ap)
    const city = cities.get(key) ?? { ap, movements: 0, international: 0 }
    city.movements += value.movements
    city.international += value.international
    cities.set(key, city)
  }
  for (const [key, city] of cities) {
    const rate = Math.max(.005, crescimentoDe(city.ap.cc))
    const multiplier = hubGrowthRateMultiplier(city.ap.pop, city.movements, city.international)
    // Quociente entre taxas compostas: junto à tendência original resulta em 2×/4× a taxa.
    const extra = Math.log((1 + rate * multiplier) / (1 + rate)) / 365
    s.hubDevelopment.pending[key] = (s.hubDevelopment.pending[key] ?? 0) + extra
  }
  // Observação diária, publicação semanal. Abrir/fechar um hub não reescreve a semana.
  if (new Date(gameDayDate(s.day, s.startYear)).getUTCDay() === 1) {
    for (const [key, logGrowth] of Object.entries(s.hubDevelopment.pending))
      s.hubDevelopment.cities[key] = (s.hubDevelopment.cities[key] ?? 1) * Math.exp(logGrowth)
    s.hubDevelopment.pending = {}
  }
}

export function cityDevelopment(s: GameState | undefined, iata: string) {
  const factor = s?.hubDevelopment?.cities[cityKey(AIRPORT_BY_IATA[iata])] ?? 1
  return { traffic: factor, population: Math.pow(factor, .55), purchasingPower: Math.pow(factor, .45) }
}

export const NEARBY_HUB_NM = Math.max(distanceBetween('SSA', 'FOR'), distanceBetween('FOR', 'BSB'), distanceBetween('SSA', 'BSB'))
export function nearbyHubDemand(s: GameState | undefined, from: string, to: string) {
  if (!s) return 1
  const hubs = activeHubs(s)
  if (!hubs.has(from) || !hubs.has(to)) return 1
  // 2× até a régua pedida; transição suave até 1× para evitar um degrau no mapa.
  return 1 + Math.max(0, Math.min(1, 2 - distanceBetween(from, to) / NEARBY_HUB_NM))
}

export function hubExtraSlots(s: GameState, iata: string) {
  if (!s.airline.hubs.includes(iata) || !(activeHubs(s).get(iata)?.ownMovements)) return 0
  return Math.floor(AIRPORT_BY_IATA[iata].slots * (cityDevelopment(s, iata).traffic - 1))
}
