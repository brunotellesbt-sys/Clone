import { AIRPORTS, AIRPORT_BY_IATA as AP } from './data/airports'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { baseDemand } from './demand'
import { addCabins, blockHours, emptyCabins, SELLABLE, sumCabins, ticketRevenue } from './economy'
import { blocoDe, DIA, escalaDe, naSemana, noDia, partidaUtc } from './escala'
import { distanceBetween, distanceNm, odKey } from './geo'
import { conexoesNaBase, type Conexao, type Toque } from './malha'
import { CABINS, type Cabins, type ConnectionJourney, type ConnectionLeg, type GameState, type Perna, type Route } from './types'

export interface LocalRouteAllocation { route: Route; voos: Perna[]; seats: Cabins; local: Cabins }
export interface FlightManifest {
  leg: ConnectionLeg
  capacity: Cabins
  baseline: Cabins
  local: Cabins
  connecting: Cabins
  entering: number
  leaving: number
  revenue: number
}
const flightKey = (p: ConnectionLeg) => `${p.day}:${p.id}`
const nearbyCache = new Map<string, string[]>()

/** Aeroportos alternativos na mesma área de origem, até 100 km, no mesmo país. */
export function nearbyAirports(iata: string) {
  if (!nearbyCache.has(iata)) {
    const a = AP[iata]
    nearbyCache.set(iata, AIRPORTS.filter(b => b.cc === a.cc && distanceNm(a, b) <= 100 / 1.852)
      .sort((a, b) => b.paxDia - a.paxDia).map(b => b.iata))
  }
  return nearbyCache.get(iata)!
}

/** Preferência relativa de uma conexão: mais espera, desvio e preço reduzem a escolha. */
export function connectionAttraction(detour: number, wait: number, fareRatio: number, reputation: number, integration = 1) {
  return 0.9 * Math.exp(-1.6 * Math.max(0, detour - 1)) * Math.exp(-wait / 480) *
    Math.exp(-1.2 * (Math.max(0.5, fareRatio) - 1)) * (0.7 + 0.6 * reputation) * integration
}

/** Apura vendas O&D e reserva os mesmos passageiros em ambos os voos, inclusive amanhã. */
export function allocateConnections(s: GameState, locals: LocalRouteAllocation[], dow: number, doy: number) {
  const manifests = new Map<string, FlightManifest>()
  const legs = new Map(escalaDe(s).map(p => [p.id, p]))
  const routeFor = new Map(s.airline.routes.filter(r => !r.cargo).map(r => [odKey(r.from, r.to), r]))
  const allocations = new Map(locals.map(r => [r.route.id, r]))
  const ownLeg = (p: Perna, day: number): ConnectionLeg => ({
    id: p.id, day, from: p.from, to: p.to, departure: noDia(partidaUtc(p)),
    number: `${s.airline.code}${String(p.numero ?? 0).padStart(4, '0')}`, own: true, operator: s.airline.name,
  })
  const manifest = (leg: ConnectionLeg, partnerSeats?: Cabins): FlightManifest | undefined => {
    const key = flightKey(leg)
    const cached = manifests.get(key)
    if (cached) return cached
    let capacity = partnerSeats ?? emptyCabins(), baseline = emptyCabins()
    if (leg.own) {
      const p = legs.get(leg.id)
      const ac = p && s.airline.fleet.find(a => a.id === p.aircraftId)
      const route = p && routeFor.get(odKey(p.from, p.to))
      if (!p || !ac || !route || ac.groundedUntil > leg.day || p.from !== leg.from || p.to !== leg.to ||
        noDia(partidaUtc(p)) !== leg.departure || Math.floor(partidaUtc(p) / DIA) !== (dow + leg.day - s.day) % 7) return
      const local = allocations.get(route.id)
      const totalSeats = local?.voos.reduce((n, p) => {
        const seats = s.airline.fleet.find(a => a.id === p.aircraftId)!.seats
        return addCabins(n, seats)
      }, emptyCabins())
      capacity = emptyCabins()
      for (const c of CABINS) {
        const share = totalSeats?.[c] ? ac.seats[c] / totalSeats[c] : 0
        capacity[c] = Math.floor(leg.day === s.day && local ? local.seats[c] * share : ac.seats[c] * SELLABLE)
        baseline[c] = leg.day === s.day && local ? Math.min(capacity[c], local.local[c] * share) : capacity[c] * 0.7
      }
    }
    const result: FlightManifest = { leg, capacity, baseline, local: emptyCabins(), connecting: emptyCabins(), entering: 0, leaving: 0, revenue: 0 }
    manifests.set(key, result)
    return result
  }
  for (const r of locals) for (const p of r.voos) manifest(ownLeg(p, s.day))

  const apply = (journey: ConnectionJourney, incoming: boolean) => {
    const leg = incoming ? journey.second : journey.first
    if (leg.day < s.day) return
    const m = manifests.get(flightKey(leg)) ?? (leg.own ? manifest(leg) : undefined)
    if (!m) return
    m.connecting = addCabins(m.connecting, journey.pax)
    if (incoming) m.entering += sumCabins(journey.pax)
    else m.leaving += sumCabins(journey.pax)
    m.revenue += incoming ? journey.secondRevenue : journey.firstRevenue
  }
  const journeys = (s.connectionJourneys ?? []).filter(j => j.second.day >= s.day - 13)
  // Reservas de ontem são atendidas antes de novas vendas e sobrevivem ao save.
  for (const j of journeys) {
    if (j.cancelled || j.second.day < s.day) continue
    const future = [j.first, j.second].filter(l => l.own && l.day >= s.day)
    if (future.some(l => !manifest(l))) { j.cancelled = true; continue }
    if (future.some(l => CABINS.some(c => {
      const m = manifest(l)!
      return m.connecting[c] + j.pax[c] > m.capacity[c]
    }))) { j.cancelled = true; continue }
    apply(j, false); apply(j, true)
  }

  const competitorsByOd = new Map<string, { seats: number; fare: number; quality: number }[]>()
  for (const comp of s.competitors) for (const r of comp.routes) {
    const list = competitorsByOd.get(r.key) ?? []
    list.push({ seats: r.seats * r.freq * SELLABLE, fare: r.fare, quality: r.quality })
    competitorsByOd.set(r.key, list)
  }
  const directCompetition = (from: string, to: string, demand: number) => {
    let weight = 0
    for (const a of nearbyAirports(from)) for (const b of nearbyAirports(to)) {
      const convenience = a === from && b === to ? 1.35 : 0.8
      for (const r of competitorsByOd.get(odKey(a, b)) ?? [])
        weight += convenience * Math.min(3, r.seats / Math.max(30, demand)) * r.quality / Math.pow(r.fare, 1.3)
      const r = routeFor.get(odKey(a, b)), local = r && allocations.get(r.id)
      if (local) weight += convenience * sumCabins(local.seats) / 2 / Math.max(30, demand) /
        Math.pow((r.fare.y * 3 + r.fare.c) / 4, 1.3)
    }
    return weight
  }

  const partnerLeg = (touch: Toque, hub: string, arrival: boolean) => {
    const [, compId, key] = touch.id.split(':')
    const comp = s.competitors.find(c => c.id === compId)
    const route = comp?.routes.find(r => r.key === key)
    if (!comp || !route) return
    const from = arrival ? touch.ponta : hub, to = arrival ? hub : touch.ponta
    const block = Math.round(blockHours(distanceBetween(from, to) > 3000 ? AIRCRAFT_BY_ID.b789 : AIRCRAFT_BY_ID.a320, distanceBetween(from, to)) * 60)
    const departure = naSemana(touch.quando - (arrival ? block : 0))
    const capacity = { y: route.seats * .88, w: route.seats * .042, c: route.seats * .072, f: route.seats * .006 }
    for (const c of CABINS) capacity[c] = Math.floor(capacity[c] * SELLABLE)
    return { leg: { id: `${touch.id}:${arrival ? 'in' : 'out'}`, from, to, departure: noDia(departure),
      day: s.day, number: `${comp.code} · ${from}–${to}`, own: false, operator: comp.name } as ConnectionLeg,
      departure, block, capacity, fare: route.fare }
  }
  type Candidate = { c: Conexao; first: FlightManifest; second: FlightManifest; weight: number; fare: number; pitch: Cabins; d1: number; d2: number; refFare: number; via: string }
  const groups = new Map<string, { from: string; to: string; demand: Cabins; candidates: Candidate[] }>()
  const soldIds = new Set(journeys.map(j => j.id))
  for (const hub of s.airline.hubs) for (const c of conexoesNaBase(s, hub)) {
    const p1 = legs.get(c.de.id), p2 = legs.get(c.para.id)
    const partner1 = !p1 ? partnerLeg(c.de, hub, true) : undefined
    const partner2 = !p2 ? partnerLeg(c.para, hub, false) : undefined
    if ((!p1 && !partner1) || (!p2 && !partner2)) continue
    const departure = p1 ? partidaUtc(p1) : partner1!.departure
    if (Math.floor(departure / DIA) !== dow) continue
    const block = p1 ? blocoDe(s, p1) : partner1!.block
    const secondDay = s.day + Math.floor((noDia(departure) + block + c.espera) / DIA)
    const first = manifest(p1 ? ownLeg(p1, s.day) : partner1!.leg, partner1?.capacity)
    const second = manifest(p2 ? ownLeg(p2, secondDay) : { ...partner2!.leg, day: secondDay }, partner2?.capacity)
    if (!first || !second || soldIds.has(`${s.day}:${first.leg.id}>${second.leg.id}`)) continue
    const from = c.de.ponta, to = c.para.ponta
    const directDistance = distanceBetween(from, to)
    if (directDistance < 60 || nearbyAirports(from).includes(to)) continue
    const d1 = distanceBetween(from, hub), d2 = distanceBetween(hub, to)
    const detour = (d1 + d2) / directDistance
    if (detour > 1.8) continue
    const demand = baseDemand(from, to, s.day, doy)
    const r1 = p1 && routeFor.get(odKey(p1.from, p1.to)), r2 = p2 && routeFor.get(odKey(p2.from, p2.to))
    const fare1 = r1 ? (r1.fare.y * 3 + r1.fare.c) / 4 : partner1!.fare
    const fare2 = r2 ? (r2.fare.y * 3 + r2.fare.c) / 4 : partner2!.fare
    const fare = Math.max(0.5, (fare1 * d1 + fare2 * d2) / (d1 + d2) * .9)
    const weight = connectionAttraction(detour, c.espera, fare, s.airline.reputation, c.codeshare ? .85 : c.parceira ? .55 : 1) *
      Math.min(1.5, Math.min(sumCabins(first.capacity), sumCabins(second.capacity)) / Math.max(60, demand.total / 2))
    // Aeroportos próximos compartilham um orçamento de procura; multiplicar
    // frequências e combinações não pode multiplicar os mesmos viajantes O&D.
    const key = `${nearbyAirports(from)[0]}>${nearbyAirports(to)[0]}`
    const group = groups.get(key) ?? { from, to, demand: emptyCabins(), candidates: [] }
    for (const cb of CABINS) group.demand[cb] = Math.max(group.demand[cb], demand.pax[cb] / 2)
    const ac1 = p1 && s.airline.fleet.find(a => a.id === p1.aircraftId), ac2 = p2 && s.airline.fleet.find(a => a.id === p2.aircraftId)
    const pitch = { y: 31, w: 38, c: 60, f: 83 }
    for (const cb of CABINS) pitch[cb] = Math.min(ac1 ? ac1.pitch[cb] : pitch[cb], ac2 ? ac2.pitch[cb] : pitch[cb])
    group.candidates.push({ c, first, second, weight, fare, pitch, d1, d2, refFare: demand.refFare, via: hub })
    groups.set(key, group)
  }
  for (const [, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const directWeight = directCompetition(g.from, g.to, sumCabins(g.demand))
    const denominator = .35 + directWeight + g.candidates.reduce((n, c) => n + c.weight, 0)
    const available = { ...g.demand }
    // O viajante que já comprou um direto nosso não pode ser vendido outra
    // vez pela conexão. A procura é direcional e compartilhada entre hubs.
    const origins = nearbyAirports(g.from), destinations = nearbyAirports(g.to)
    for (const m of manifests.values()) if (m.leg.day === s.day && m.leg.own &&
      origins.includes(m.leg.from) && destinations.includes(m.leg.to)) {
      for (const cb of CABINS) available[cb] = Math.max(0, available[cb] - m.baseline[cb])
    }
    for (const j of journeys) if (!j.cancelled && j.first.day === s.day &&
      origins.includes(j.first.from) && destinations.includes(j.second.to)) {
      for (const cb of CABINS) available[cb] = Math.max(0, available[cb] - j.pax[cb])
    }
    for (const c of g.candidates.sort((a, b) => b.weight - a.weight || a.first.leg.id.localeCompare(b.first.leg.id))) {
      const pax = emptyCabins()
      for (const cb of CABINS) {
        const remaining = (m: FlightManifest) => Math.max(0, Math.min(m.capacity[cb] * .7,
          m.capacity[cb] - .6 * m.baseline[cb]) - m.connecting[cb])
        pax[cb] = Math.floor(Math.min(available[cb], g.demand[cb] * c.weight / denominator, remaining(c.first), remaining(c.second)))
        available[cb] -= pax[cb]
      }
      if (!sumCabins(pax)) continue
      const price = ticketRevenue(pax, { y: c.fare, w: c.fare, c: c.fare, f: c.fare }, c.refFare, c.pitch)
      const journey: ConnectionJourney = { id: `${s.day}:${c.first.leg.id}>${c.second.leg.id}`, via: c.via,
        first: c.first.leg, second: c.second.leg, wait: c.c.espera, pax,
        firstRevenue: price * c.d1 / (c.d1 + c.d2), secondRevenue: price * c.d2 / (c.d1 + c.d2) }
      journeys.push(journey)
      apply(journey, false); apply(journey, true)
    }
  }
  s.connectionJourneys = journeys
  for (const m of manifests.values()) {
    for (const c of CABINS) m.local[c] = Math.max(0, Math.min(m.baseline[c], m.capacity[c] - m.connecting[c]))
    if (m.leg.own && m.leg.day === s.day) legs.get(m.leg.id)!.ultimoVoo = {
      day: s.day, pax: addCabins(m.local, m.connecting), localPax: m.local, connectionPax: m.connecting,
      conexoesEntrando: m.entering, conexoesSaindo: m.leaving,
    }
  }
  return manifests
}
