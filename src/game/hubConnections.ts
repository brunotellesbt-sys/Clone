import { admittedFlights, effectiveAirport, rivalFrequency, routeEntryAccess } from './airportInfrastructure'
import { defaultCabin } from './cabin'
import { dayOfYearAt } from './calendarDates'
import { connectionAttraction, DESCONTO_CONEXAO, nearbyAirports, TETO_CONEXAO_NO_VOO } from './connections'
import { connectionPathAllowed } from './connectionGeometry'
import { connectionWindow } from './connectionRules'
import { AIRCRAFT } from './data/aircraft'
import { AIRPORTS, AIRPORT_BY_IATA, noToqueDeRecolher, vooPermitido } from './data/airports'
import { baseDemand } from './demand'
import { blockHours, crewFor, DISTRIBUTION_RATE, emptyCabins, flightCost, SELLABLE, sumCabins, ticketRevenue } from './economy'
import { fichaDe, naSemana, noDia } from './escala'
import { distanceBetween, odKey } from './geo'
import { conexoesNaBase, toquesNaBase, type Toque } from './malha'
import { pistaServe } from './spec'
import { CABINS, type Cabins, type GameState, type Route } from './types'

interface LegPlan {
  iata: string
  distance: number
  range: number
  block: number
  fare: number
  pitch: Cabins
  available: Cabins
  costPerSeat: number
}

export interface ConnectionSuggestion {
  from: string
  to: string
  passengers: number
  profit: number
  arrival?: number
  departure?: number
  connectionTime: { min: number; max: number }
  missingRoute?: string
}

export function suggestHubConnections(s: GameState, hub: string): ConnectionSuggestion[] {
  const origin = effectiveAirport(s, hub)
  const routes = s.airline.routes.filter(r => !r.cargo && (r.from === hub || r.to === hub))
  if (!routes.length) return []
  const doy = dayOfYearAt(s.day, s.startYear)
  const demandByPair = new Map<string, ReturnType<typeof baseDemand>>()
  const forecast = (from: string, to: string) => {
    const key = odKey(from, to)
    let demand = demandByPair.get(key)
    if (!demand) {
      demand = baseDemand(from, to, s.day, doy, s.startYear, true, s)
      demandByPair.set(key, demand)
    }
    return demand
  }
  const directed = (from: string, to: string) => `${from}>${to}`
  const timed = new Set(conexoesNaBase(s, hub, true).map(c => directed(c.de.ponta, c.para.ponta)))
  const touches = toquesNaBase(s, hub)
  const arrivals = indexTouches(touches.chegadas)
  const departures = indexTouches(touches.partidas)
  const rivals = new Map<string, number>()
  const direct = new Map<string, number>()
  for (const comp of s.competitors) for (const r of comp.routes) {
    const seats = r.seats * rivalFrequency(s, r) * SELLABLE
    if (seats > 0) rivals.set(r.key, (rivals.get(r.key) ?? 0) + seats * r.quality / Math.pow(r.fare, 1.3))
  }
  const fleet = new Map(s.airline.fleet.map(ac => [ac.id, ac]))
  const admitted = admittedFlights(s)
  for (const p of s.airline.escala ?? []) {
    if (!admitted.has(p.id)) continue
    const ac = fleet.get(p.aircraftId)
    if (!ac || ac.isReserve || ac.groundedUntil > s.day || fichaDe(ac).payload !== undefined) continue
    const key = directed(p.from, p.to)
    direct.set(key, (direct.get(key) ?? 0) + sumCabins(ac.seats) * SELLABLE / 7)
  }
  const catalog = AIRCRAFT.filter(t => t.payload === undefined && t.since <= s.startYear + s.day / 365)
    .sort((a, b) => a.maxSeats - b.maxSeats)
  const validFleet = s.airline.fleet.filter(ac => !ac.isReserve && ac.groundedUntil <= s.day)

  const planLeg = (iata: string, route?: Route): LegPlan | null => {
    const airport = effectiveAirport(s, iata)
    const distance = distanceBetween(hub, iata)
    if (vooPermitido(origin, airport)) return null
    const serves = (t: typeof catalog[number]) => t.payload === undefined && t.range >= distance && pistaServe(t, origin, airport)
    const assigned = route?.aircraftIds.map(id => fleet.get(id)).find(ac => ac && serves(fichaDe(ac)))
    const ac = assigned ?? validFleet.find(plane => serves(fichaDe(plane)))
    const t = ac ? fichaDe(ac) : catalog.find(serves)
    if (!t) return null

    const { seats, pitch } = ac ?? defaultCabin(t)
    const history = route?.history.slice(-14).filter(d => d.flights > 0) ?? []
    const legs = history.reduce((n, d) => n + d.flights * 2, 0)
    const seatsFlown = history.reduce((n, d) => n + d.seats, 0)
    const localPax = history.reduce((n, d) => n + sumCabins(d.localPax ?? d.pax), 0)
    // A previsão para uma etapa sem histórico usa o tamanho do mercado e a
    // oferta direta, sem contar duas vezes quem já voa com outras companhias.
    const market = forecast(hub, iata)
    const seatsTotal = sumCabins(seats)
    const ourSeats = Math.max(seatsTotal, (direct.get(directed(hub, iata)) ?? 0))
    const expected = market.total / 2 * ourSeats / Math.max(1, ourSeats + (rivals.get(odKey(hub, iata)) ?? 0))
    const localShare = seatsFlown ? localPax / seatsFlown : Math.min(SELLABLE, expected / Math.max(1, seatsTotal))
    const available = emptyCabins()
    for (const cb of CABINS) available[cb] = seats[cb] * (localShare < SELLABLE ? 1 - localShare : SELLABLE * TETO_CONEXAO_NO_VOO)
    const pax = seatsTotal * SELLABLE
    const estimate = flightCost(t, distance, hub, iata, s.fuelPrice, ac?.age ?? 0, pax,
      (pax - seats.y * SELLABLE), crewFor(seats)).total
    return {
      iata, distance, range: t.range, available, pitch,
      fare: route ? (3 * route.fare.y + route.fare.c) / 4 : 1,
      block: Math.round(blockHours(t, distance) * 60),
      costPerSeat: legs && seatsFlown ? history.reduce((n, d) => n + d.cost, 0) / (seatsFlown * SELLABLE) : estimate / Math.max(1, pax),
    }
  }

  const existing = routes.flatMap(r => {
    const plan = planLeg(r.from === hub ? r.to : r.from, r)
    return plan ? [plan] : []
  })
  const suggestions = new Map<string, ConnectionSuggestion>()
  const competition = (from: string, to: string, market: number) => {
    let weight = 0
    for (const a of nearbyAirports(from)) for (const b of nearbyAirports(to)) {
      const proximity = a === from && b === to ? 1.35 : .8
      weight += proximity * ((rivals.get(odKey(a, b)) ?? 0) + (direct.get(directed(a, b)) ?? 0)) / Math.max(30, market)
    }
    return weight
  }

  const compare = (a: LegPlan, b: LegPlan, missingRoute?: string) => {
    const keyDirection = directed(a.iata, b.iata)
    if (timed.has(keyDirection) || !connectionPathAllowed(a.iata, hub, b.iata)) return
    const market = forecast(a.iata, b.iata)
    const directWeight = competition(a.iata, b.iata, market.total / 2)
    const connectionTime = connectionWindow(a.iata, hub, b.iata)
    const time = recommendTimes(hub, a, b, arrivals.get(a.iata) ?? [], departures.get(b.iata) ?? [], connectionTime)
    const wait = time.arrival === undefined || time.departure === undefined ? connectionTime.min : naSemana(time.departure - time.arrival)
    const totalDist = a.distance + b.distance
    const detour = 1 + (totalDist - market.distance) / Math.max(market.distance, 1000 / 1.852)
    const fare = (a.fare * a.distance + b.fare * b.distance) / totalDist
    const weight = connectionAttraction(detour, wait, fare, s.airline.reputation, 1,
      AIRPORT_BY_IATA[a.iata].cc === AIRPORT_BY_IATA[b.iata].cc)
    const share = weight / (.35 + directWeight + weight)
    const pax = emptyCabins()
    const pitch = emptyCabins()
    for (const cb of CABINS) {
      pax[cb] = Math.floor(Math.min(market.pax[cb] * share / 2, a.available[cb], b.available[cb]))
      pitch[cb] = Math.min(a.pitch[cb], b.pitch[cb])
    }
    const passengers = sumCabins(pax)
    if (!passengers) return
    const price = fare * (1 - DESCONTO_CONEXAO * Math.min(1, directWeight))
    const profit = ticketRevenue(pax, { y: price, w: price, c: price, f: price }, market.refFare, pitch) *
      (1 - DISTRIBUTION_RATE) - passengers * (a.costPerSeat + b.costPerSeat)
    if (profit <= 0) return
    const key = odKey(a.iata, b.iata)
    if (profit > (suggestions.get(key)?.profit ?? 0))
      suggestions.set(key, { from: a.iata, to: b.iata, profit, passengers, ...time, connectionTime, missingRoute })
  }

  for (const from of existing) for (const to of existing) {
    if (from !== to) compare(from, to)
  }
  const rank = (a: ConnectionSuggestion, b: ConnectionSuggestion) =>
    b.profit - a.profit || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
  const shortlist = [...suggestions.values()].sort(rank).slice(0, 5)
  if (shortlist.length === 5 || !existing.length || routeEntryAccess(s, hub).blocked) return shortlist

  // Com poucas rotas abertas, completa a lista usando uma ponta que o hub já
  // atende. O jogador vê quando a outra ponta exige abrir uma rota.
  const open = new Set(s.airline.routes.flatMap(r =>
    r.from === hub ? [r.to] : r.to === hub ? [r.from] : []))
  const inShortlist = new Set(shortlist.map(c => odKey(c.from, c.to)))
  const maxRange = Math.max(...existing.map(plan => plan.range), ...validFleet.map(ac => fichaDe(ac).range))
  suggestions.clear()
  for (const airport of AIRPORTS) {
    if (airport.iata === hub || open.has(airport.iata) || distanceBetween(hub, airport.iata) > maxRange ||
      routeEntryAccess(s, airport.iata).blocked) continue
    const anchors = existing.filter(a => !inShortlist.has(odKey(a.iata, airport.iata)) &&
      connectionPathAllowed(a.iata, hub, airport.iata))
    if (!anchors.length) continue
    const missing = planLeg(airport.iata)
    if (!missing) continue
    for (const anchor of anchors) {
      compare(anchor, missing, airport.iata)
      compare(missing, anchor, airport.iata)
    }
  }
  return shortlist.concat([...suggestions.values()].sort(rank).slice(0, 5 - shortlist.length)).sort(rank)
}

function indexTouches(touches: Toque[]) {
  const result = new Map<string, Toque[]>()
  for (const touch of touches) {
    if (touch.parceira) continue
    const entries = result.get(touch.ponta) ?? []
    entries.push(touch)
    result.set(touch.ponta, entries)
  }
  return result
}

function recommendTimes(hub: string, from: LegPlan, to: LegPlan, arrivals: Toque[], departures: Toque[],
  window: { min: number; max: number }): { arrival?: number; departure?: number } {
  const fuso = AIRPORT_BY_IATA[hub].fuso
  const stamp = (utc: number) => naSemana(utc + fuso)
  const open = (iata: string, utc: number) => !noToqueDeRecolher(iata, noDia(utc + AIRPORT_BY_IATA[iata].fuso))
  for (const a of arrivals) for (let wait = window.min; wait <= window.max; wait++) {
    const departure = a.quando + wait
    if (open(hub, departure) && open(to.iata, departure + to.block)) return { arrival: stamp(a.quando), departure: stamp(departure) }
  }
  for (const d of departures) for (let wait = window.min; wait <= window.max; wait++) {
    const arrival = d.quando - wait
    if (open(hub, arrival) && open(from.iata, arrival - from.block)) return { arrival: stamp(arrival), departure: stamp(d.quando) }
  }
  return {}
}
