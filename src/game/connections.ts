import { admittedFlights, rivalFrequency } from './airportInfrastructure'
import {allocateSharedSeats} from './connectionSeats'
import {connectionPathAllowed} from './connectionGeometry'
import { AIRPORTS, AIRPORT_BY_IATA as AP } from './data/airports'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { baseDemand, CLASS_FARE_MULT } from './demand'
import { pitchFare } from './cabin'
import { addCabins, blockHours, DISTRIBUTION_RATE, emptyCabins, marginalPassengerCost, SELLABLE, sumCabins, ticketRevenue } from './economy'
import { blocoDe, DIA, escalaDe, naSemana, noDia, partidaUtc } from './escala'
import { distanceBetween, distanceNm, odKey } from './geo'
import { conexoesNaBase, type Conexao, type Toque } from './malha'
import { CABINS, type Cabins, type ConnectionJourney, type ConnectionLeg, type GameState, type Perna, type Route } from './types'
import { getEffectiveAircraft } from './reserve'
import { dayOfYearAt } from './calendarDates'

export interface LocalRouteAllocation { route: Route; voos: Perna[]; seats: Cabins; local: Cabins }
export interface FlightManifest {
  leg: ConnectionLeg
  capacity: Cabins
  physicalCapacity: Cabins
  baseline: Cabins
  local: Cabins
  connecting: Cabins
  entering: number
  leaving: number
  revenue: number
}
export { DESVIO_MAXIMO, ETAPA_MINIMA_CONEXAO } from './connectionGeometry'
/**
 * Quanto a conexão cede no preço quando existe voo direto no mercado.
 *
 * A tarifa da conexão era a média dos dois trechos com 10% de desconto, e o
 * desconto valia sempre — inclusive para Salvador–Tabatinga, que não tem voo
 * direto nenhum. Aí ele não tem motivo de existir: quem precisa ir de A para B
 * e só chega com escala paga a tarifa do mercado, porque não há produto mais
 * barato para comparar. Com o desconto fixo, todo conectante pagava menos por
 * trecho que o passageiro local, e a conexão só servia para trocar passageiro
 * bom por passageiro barato.
 *
 * Na vida real o desconto aparece **quando há direto**: a conexão é o produto
 * pior — mais tempo, uma escala — e só vende se custar menos. O tamanho dele
 * acompanha a força do direto no mercado (`directCompetition`, que já pesa
 * oferta, tarifa, qualidade e o aeroporto preferido de cada ponta): um direto
 * fraco tira pouco, um direto forte tira até este teto.
 */
export const DESCONTO_CONEXAO = 0.15

const flightKey = (p: ConnectionLeg) => `${p.day}:${p.id}`
const nearbyCache = new Map<string, string[]>()
const airportsByCountry = new Map<string, typeof AIRPORTS>()
for (const a of AIRPORTS) {
  const airports = airportsByCountry.get(a.cc) ?? []
  airports.push(a)
  airportsByCountry.set(a.cc, airports)
}

/** Aeroportos alternativos na mesma área de origem, até 100 km, no mesmo país. */
export function nearbyAirports(iata: string) {
  if (!nearbyCache.has(iata)) {
    const a = AP[iata]
    nearbyCache.set(iata, (airportsByCountry.get(a.cc) ?? []).filter(b => distanceNm(a, b) <= 100 / 1.852)
      .sort((a, b) => b.paxDia - a.paxDia).map(b => b.iata))
  }
  return nearbyCache.get(iata)!
}

/** Alternativas da mesma área disputam a mesma procura no sentido da viagem. */
function directionalMarket(from: string, to: string) {
  const a = nearbyAirports(from)[0], b = nearbyAirports(to)[0]
  return a === b ? `${from}>${to}` : `${a}>${b}`
}

/** Só para a classe que já sairia cheia; assentos vagos não têm teto percentual. */
export const TETO_CONEXAO_NO_VOO = 0.4

/** Lugares ainda livres para conexão numa classe, sem revender os mesmos assentos. */
export function connectionRoom(m: Pick<FlightManifest, 'capacity' | 'baseline' | 'connecting'>, cb: keyof Cabins) {
  const vacant = m.capacity[cb] - m.baseline[cb]
  const limit = vacant > 1e-9 ? vacant : Math.min(m.capacity[cb] * TETO_CONEXAO_NO_VOO,
    m.capacity[cb] - .6 * m.baseline[cb])
  return Math.max(0, limit - m.connecting[cb])
}

/** Preferência relativa de uma conexão: mais espera, desvio e preço reduzem a escolha. */
export function connectionAttraction(detour: number, wait: number, fareRatio: number, reputation: number, integration = 1, domestica = false) {
  // Numa viagem doméstica o voo inteiro dura duas, três horas: esperar mais que
  // duas no hub pesa bem mais do que numa viagem de doze horas, e o passageiro
  // prefere outra conexão ou o direto.
  const esperaLonga = domestica ? Math.exp(-Math.max(0, wait - 120) / 90) : 1
  return 0.9 * Math.exp(-1.6 * Math.max(0, detour - 1)) * Math.exp(-wait / 480) * esperaLonga *
    Math.exp(-1.2 * (Math.max(0.5, fareRatio) - 1)) * (0.7 + 0.6 * reputation) * integration
}

// O painel consulta várias rotas do mesmo dia. O motor e o worker substituem
// a lista de bilhetes a cada apuração, invalidando o índice automaticamente.
const historyByMarket = new WeakMap<ConnectionJourney[], Map<string, Map<number, Cabins>>>()

export function connectingPassengersForMarket(s: GameState, from: string, to: string, since: number) {
  const total = emptyCabins()
  const journeys = s.connectionJourneys
  if (!journeys?.length) return total
  let markets = historyByMarket.get(journeys)
  if (!markets) {
    markets = new Map()
    for (const j of journeys) {
      if (j.cancelled) continue
      const key = odKey(j.first.from, j.second.to)
      let days = markets.get(key)
      if (!days) { days = new Map(); markets.set(key, days) }
      days.set(j.first.day, addCabins(days.get(j.first.day) ?? emptyCabins(), j.pax))
    }
    historyByMarket.set(journeys, markets)
  }
  const days = markets.get(odKey(from, to))
  if (days) for (const [day, pax] of days) {
    if (day >= since && day <= s.day) for (const cb of CABINS) total[cb] += pax[cb]
  }
  return total
}

/** Apura vendas O&D e reserva os mesmos passageiros em ambos os voos, inclusive amanhã. */
export function allocateConnections(s: GameState, locals: LocalRouteAllocation[], dow: number, doy: number) {
  const manifests = new Map<string, FlightManifest>()
  const legs = new Map(escalaDe(s).filter(p => admittedFlights(s).has(p.id)).map(p => [p.id, p]))
  const routeFor = new Map(s.airline.routes.filter(r => !r.cargo).map(r => [odKey(r.from, r.to), r]))
  const allocations = new Map(locals.map(r => [r.route.id, r]))
  const fleet=new Map(s.airline.fleet.map(a=>[a.id,a]))
  const seatsByRoute=new Map(locals.map(r=>[r.route.id,r.voos.reduce((n,p)=>addCabins(n,fleet.get(p.aircraftId)!.seats),emptyCabins())]))
  const markets=new Map<string,ReturnType<typeof baseDemand>>()
  const futureSupply = new Map<number, Map<string, Cabins>>()
  const futureDemand = new Map<string, Cabins>()
  const forecastLocal = (leg: ConnectionLeg, directed: string, seats: Cabins) => {
    let supply = futureSupply.get(leg.day)
    if (!supply) {
      supply = new Map()
      const futureDow = (dow + leg.day - s.day) % 7
      for (const p of legs.values()) {
        if (Math.floor(partidaUtc(p) / DIA) !== futureDow) continue
        const ac = getEffectiveAircraft(s, p.aircraftId, undefined, leg.day)
        if (!ac || ac.groundedUntil > leg.day) continue
        const key = `${p.from}>${p.to}`
        supply.set(key, addCabins(supply.get(key) ?? emptyCabins(), ac.seats))
      }
      futureSupply.set(leg.day, supply)
    }
    const demandKey = `${leg.day}:${odKey(leg.from, leg.to)}`
    let demand = futureDemand.get(demandKey)
    if (!demand) {
      demand = baseDemand(leg.from, leg.to, leg.day, dayOfYearAt(leg.day, s.startYear), s.startYear, true, s).pax
      futureDemand.set(demandKey, demand)
    }
    const offered = supply.get(directed)
    const local = emptyCabins()
    for (const cb of CABINS) local[cb] = demand[cb] / 2 * seats[cb] / Math.max(1, offered?.[cb] ?? 0)
    return local
  }
  const ownLeg = (p: Perna, day: number): ConnectionLeg => ({
    id: p.id, day, from: p.from, to: p.to, departure: noDia(partidaUtc(p)),
    number: `${s.airline.code}${String(p.numero ?? 0).padStart(4, '0')}`, own: true, operator: s.airline.name,
  })
  const manifest = (leg: ConnectionLeg, partnerSeats?: Cabins): FlightManifest | undefined => {
    const key = flightKey(leg)
    const cached = manifests.get(key)
    if (cached) return cached
    let capacity = partnerSeats ?? emptyCabins(), physicalCapacity = capacity
    const baseline = emptyCabins()
    if (leg.own) {
      const p = legs.get(leg.id)
      const ac = p && getEffectiveAircraft(s, p.aircraftId, undefined, leg.day)
      const route = p && routeFor.get(odKey(p.from, p.to))
      if (!p || !ac || !route || ac.groundedUntil > leg.day || p.from !== leg.from || p.to !== leg.to ||
        noDia(partidaUtc(p)) !== leg.departure || Math.floor(partidaUtc(p) / DIA) !== (dow + leg.day - s.day) % 7) return
      const local = allocations.get(route.id)
      const totalSeats = local && seatsByRoute.get(route.id)
      const localToday = leg.day === s.day && local
      const forecast = localToday ? undefined : forecastLocal(leg, `${leg.from}>${leg.to}`, ac.seats)
      capacity = emptyCabins()
      physicalCapacity = ac.seats
      for (const c of CABINS) {
        const share = totalSeats?.[c] ? ac.seats[c] / totalSeats[c] : 0
        const regular = Math.min(ac.seats[c], Math.floor(localToday ? localToday.seats[c] * share : ac.seats[c] * SELLABLE))
        const expectedLocal = localToday ? localToday.local[c] * share : forecast![c]
        baseline[c] = Math.min(regular, expectedLocal)
        // Quando faltam passageiros locais, os assentos físicos que sobram
        // podem ser vendidos em conexão, inclusive fora da cota normal.
        capacity[c] = expectedLocal < regular || expectedLocal === 0 ? ac.seats[c] : regular
      }
    }
    const result: FlightManifest = { leg, capacity, physicalCapacity, baseline, local: emptyCabins(), connecting: emptyCabins(), entering: 0, leaving: 0, revenue: 0 }
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
    for (const c of CABINS) m.capacity[c] = Math.max(m.capacity[c], m.connecting[c])
    if (incoming) m.entering += sumCabins(journey.pax)
    else m.leaving += sumCabins(journey.pax)
    m.revenue += incoming ? journey.secondRevenue : journey.firstRevenue
  }
  const journeys = (s.connectionJourneys ?? []).filter(j => j.second.day >= s.day - 13)
  // Reservas de ontem são atendidas antes de novas vendas e sobrevivem ao save.
  for (const j of journeys) {
    if (j.cancelled || j.second.day < s.day) continue
    // Uma alternativa comercial nova não cancela um bilhete já vendido.
    if(!connectionPathAllowed(j.first.from,j.via,j.second.to)){j.cancelled=true;continue}
    const future = [j.first, j.second].filter(l => l.own && l.day >= s.day)
    if (future.some(l => !manifest(l))) { j.cancelled = true; continue }
    if (future.some(l => CABINS.some(c => {
      const m = manifest(l)!
      return m.connecting[c] + j.pax[c] > m.physicalCapacity[c]
    }))) { j.cancelled = true; continue }
    apply(j, false); apply(j, true)
  }

  const competitorsByOd = new Map<string, { seats: number; fare: number; quality: number }[]>()
  for (const comp of s.competitors) for (const r of comp.routes) {
    const list = competitorsByOd.get(r.key) ?? []
    list.push({ seats: r.seats * rivalFrequency(s, r) * SELLABLE, fare: r.fare, quality: r.quality })
    competitorsByOd.set(r.key, list)
  }
  const directSeats = new Map<string, Cabins>()
  for (const m of manifests.values()) {
    if (m.leg.day !== s.day || !m.leg.own) continue
    const key = `${m.leg.from}>${m.leg.to}`
    directSeats.set(key, addCabins(directSeats.get(key) ?? emptyCabins(), m.capacity))
  }
  const rivalMix = { y: .88, w: .042, c: .072, f: .006 }
  const directCompetition = (from: string, to: string, demand: Cabins) => {
    const weight = emptyCabins()
    for (const a of nearbyAirports(from)) for (const b of nearbyAirports(to)) {
      const convenience = a === from && b === to ? 1.35 : 0.8
      const key = odKey(a, b)
      for (const r of competitorsByOd.get(key) ?? []) {
        const attraction = convenience * r.quality / Math.pow(r.fare, 1.3)
        for (const cb of CABINS) weight[cb] += attraction * Math.min(3, r.seats * rivalMix[cb] / Math.max(1, demand[cb]))
      }
      const route = routeFor.get(key), seats = directSeats.get(`${a}>${b}`)
      if (route && seats) for (const cb of CABINS) {
        weight[cb] += convenience * seats[cb] / Math.max(1, demand[cb]) / Math.pow(route.fare[cb], 1.3)
      }
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
    const capacity = emptyCabins()
    for (const c of CABINS) capacity[c] = Math.floor(route.seats * rivalMix[c] * SELLABLE)
    return { leg: { id: `${touch.id}:${arrival ? 'in' : 'out'}`, from, to, departure: noDia(departure),
      day: s.day, number: `${comp.code} · ${from}–${to}`, own: false, operator: comp.name } as ConnectionLeg,
      departure, block, capacity, fare: route.fare }
  }
  type Candidate = { c: Conexao; first: FlightManifest; second: FlightManifest; weight: Cabins; fare: Cabins; pitch: Cabins; d1: number; d2: number; refFare: number; via: string }
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
    const d1 = distanceBetween(from, hub), d2 = distanceBetween(hub, to)
    // Sem direto regional, uma razão enorme entre cidades vizinhas não deve
    // zerar a venda que a geometria acabou de autorizar. O custo da volta é
    // medido também em distância absoluta, limitado pela regra regional.
    const detour = 1 + (d1+d2-directDistance)/Math.max(directDistance,1000/1.852)
    const marketKey=`${from}>${to}`
    let demand=markets.get(marketKey)
    if(!demand){demand=baseDemand(from,to,s.day,doy,s.startYear,true,s);markets.set(marketKey,demand)}
    const r1 = p1 && routeFor.get(odKey(p1.from, p1.to)), r2 = p2 && routeFor.get(odKey(p2.from, p2.to))
    const fare = emptyCabins(), weight = emptyCabins()
    const domestica = AP[from].cc === AP[to].cc
    const integration = c.codeshare ? .85 : c.parceira ? .55 : 1
    const attraction = connectionAttraction(detour, c.espera, 1, s.airline.reputation, integration, domestica)
    for (const cb of CABINS) {
      const fare1 = r1 ? r1.fare[cb] : partner1!.fare
      const fare2 = r2 ? r2.fare[cb] : partner2!.fare
      fare[cb] = Math.max(.5, (fare1 * d1 + fare2 * d2) / (d1 + d2))
      const seats = Math.min(first.capacity[cb], second.capacity[cb])
      weight[cb] = attraction * Math.exp(-1.2 * (fare[cb] - 1)) * Math.min(1.5, seats / Math.max(1, demand.pax[cb] / 2))
    }
    // Aeroportos próximos compartilham um orçamento de procura; multiplicar
    // frequências e combinações não pode multiplicar os mesmos viajantes O&D.
    const key = directionalMarket(from, to)
    const group = groups.get(key) ?? { from, to, demand: emptyCabins(), candidates: [] }
    for (const cb of CABINS) group.demand[cb] = Math.max(group.demand[cb], demand.pax[cb] / 2)
    const ac1 = p1 && fleet.get(p1.aircraftId), ac2 = p2 && fleet.get(p2.aircraftId)
    const pitch = { y: 31, w: 38, c: 60, f: 83 }
    for (const cb of CABINS) pitch[cb] = Math.min(ac1 ? ac1.pitch[cb] : pitch[cb], ac2 ? ac2.pitch[cb] : pitch[cb])
    group.candidates.push({ c, first, second, weight, fare, pitch, d1, d2, refFare: demand.refFare, via: hub })
    groups.set(key, group)
  }
  type Proposal = { id: string; market: string; c: Candidate; wanted: Cabins; fare: Cabins }
  const proposals: Proposal[] = []
  const marketLimits = new Map<string, Cabins>()
  const consumed = new Map<string, Cabins>()
  const record = (from: string, to: string, pax: Cabins) => {
    const key = directionalMarket(from, to)
    consumed.set(key, addCabins(consumed.get(key) ?? emptyCabins(), pax))
  }
  for (const m of manifests.values()) {
    if (m.leg.day === s.day && m.leg.own) record(m.leg.from, m.leg.to, m.baseline)
  }
  for (const j of journeys) {
    if (!j.cancelled && j.first.day === s.day) record(j.first.from, j.second.to, j.pax)
  }
  for (const [market, g] of groups) {
    const direct = directCompetition(g.from, g.to, g.demand)
    const denominator = { ...direct }
    for (const cb of CABINS) denominator[cb] += .35
    const available = { ...g.demand }
    const sold = consumed.get(market)
    if (sold) for (const cb of CABINS) available[cb] = Math.max(0, available[cb] - sold[cb])
    marketLimits.set(market, available)
    const start = proposals.length
    for (const c of g.candidates) {
      const wanted = emptyCabins(), fare = emptyCabins()
      const first = c.first.leg, second = c.second.leg
      const ourShare = (Number(first.own) * c.d1 + Number(second.own) * c.d2) / (c.d1 + c.d2)
      for (const cb of CABINS) {
        if (available[cb] < 1 || connectionRoom(c.first, cb) < 1 || connectionRoom(c.second, cb) < 1) continue
        const marginal = (first.own ? marginalPassengerCost(first.from, first.to, c.d1, cb !== 'y') : 0) +
          (second.own ? marginalPassengerCost(second.from, second.to, c.d2, cb !== 'y') : 0)
        fare[cb] = c.fare[cb] * (1 - DESCONTO_CONEXAO * Math.min(1, direct[cb]))
        const net = c.refFare * CLASS_FARE_MULT[cb] * pitchFare(cb, c.pitch[cb]) * fare[cb] * ourShare * (1 - DISTRIBUTION_RATE)
        if (net <= marginal) continue
        wanted[cb] = c.weight[cb]
        denominator[cb] += c.weight[cb]
      }
      proposals.push({ id: `${s.day}:${first.id}>${second.id}`, market, c, wanted, fare })
    }
    for (let i = start; i < proposals.length; i++) {
      for (const cb of CABINS) proposals[i].wanted[cb] *= g.demand[cb] / denominator[cb]
    }
  }
  const bookings=new Map<string,Cabins>()
  for(const cb of CABINS){
    const allocation=allocateSharedSeats(proposals.map(p=>({id:p.id,market:p.market,first:flightKey(p.c.first.leg),second:flightKey(p.c.second.leg),wanted:p.wanted[cb]})),
      new Map([...marketLimits].map(([key,value])=>[key,value[cb]])),
      new Map([...manifests].map(([key,m])=>[key,connectionRoom(m,cb)])))
    for(const [id,n] of allocation){const pax=bookings.get(id)??emptyCabins();pax[cb]=n;bookings.set(id,pax)}
  }
  for(const {id,c,fare} of proposals){
      const pax=bookings.get(id)??emptyCabins()
      if(!sumCabins(pax))continue
      const price = ticketRevenue(pax, fare, c.refFare, c.pitch)
      const journey: ConnectionJourney = { id, via: c.via,
        first: c.first.leg, second: c.second.leg, wait: c.c.espera, pax,
        firstRevenue: price * c.d1 / (c.d1 + c.d2), secondRevenue: price * c.d2 / (c.d1 + c.d2) }
      journeys.push(journey)
      apply(journey, false); apply(journey, true)
  }
  s.connectionJourneys = journeys
  s.conexoesApuradasEm = s.day
  for (const m of manifests.values()) {
    for (const c of CABINS) m.local[c] = Math.max(0, Math.min(m.baseline[c], m.capacity[c] - m.connecting[c]))
    if (m.leg.own && m.leg.day === s.day) legs.get(m.leg.id)!.ultimoVoo = {
      day: s.day, pax: addCabins(m.local, m.connecting), localPax: m.local, connectionPax: m.connecting,
      conexoesEntrando: m.entering, conexoesSaindo: m.leaving,
    }
  }
  return manifests
}
