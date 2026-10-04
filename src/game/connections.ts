import { admittedFlights, rivalFrequency } from './airportInfrastructure'
import {allocateSharedSeats} from './connectionSeats'
import {connectionPathAllowed} from './connectionGeometry'
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

/** Aeroportos alternativos na mesma área de origem, até 100 km, no mesmo país. */
export function nearbyAirports(iata: string) {
  if (!nearbyCache.has(iata)) {
    const a = AP[iata]
    nearbyCache.set(iata, AIRPORTS.filter(b => b.cc === a.cc && distanceNm(a, b) <= 100 / 1.852)
      .sort((a, b) => b.paxDia - a.paxDia).map(b => b.iata))
  }
  return nearbyCache.get(iata)!
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

/** Apura vendas O&D e reserva os mesmos passageiros em ambos os voos, inclusive amanhã. */
export function allocateConnections(s: GameState, locals: LocalRouteAllocation[], dow: number, doy: number) {
  const manifests = new Map<string, FlightManifest>()
  const legs = new Map(escalaDe(s).filter(p => admittedFlights(s).has(p.id)).map(p => [p.id, p]))
  const routeFor = new Map(s.airline.routes.filter(r => !r.cargo).map(r => [odKey(r.from, r.to), r]))
  const allocations = new Map(locals.map(r => [r.route.id, r]))
  const fleet=new Map(s.airline.fleet.map(a=>[a.id,a]))
  const seatsByRoute=new Map(locals.map(r=>[r.route.id,r.voos.reduce((n,p)=>addCabins(n,fleet.get(p.aircraftId)!.seats),emptyCabins())]))
  const markets=new Map<string,ReturnType<typeof baseDemand>>()
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
      const ac = p && fleet.get(p.aircraftId)
      const route = p && routeFor.get(odKey(p.from, p.to))
      if (!p || !ac || !route || ac.groundedUntil > leg.day || p.from !== leg.from || p.to !== leg.to ||
        noDia(partidaUtc(p)) !== leg.departure || Math.floor(partidaUtc(p) / DIA) !== (dow + leg.day - s.day) % 7) return
      const local = allocations.get(route.id)
      const totalSeats = local && seatsByRoute.get(route.id)
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
    // Uma alternativa comercial nova não cancela um bilhete já vendido.
    if(!connectionPathAllowed(j.first.from,j.via,j.second.to)){j.cancelled=true;continue}
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
    list.push({ seats: r.seats * rivalFrequency(s, r) * SELLABLE, fare: r.fare, quality: r.quality })
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
    const d1 = distanceBetween(from, hub), d2 = distanceBetween(hub, to)
    // Sem direto regional, uma razão enorme entre cidades vizinhas não deve
    // zerar a venda que a geometria acabou de autorizar. O custo da volta é
    // medido também em distância absoluta, limitado pela regra regional.
    const detour = 1 + (d1+d2-directDistance)/Math.max(directDistance,1000/1.852)
    const marketKey=`${from}>${to}`
    let demand=markets.get(marketKey)
    if(!demand){demand=baseDemand(from,to,s.day,doy,s.startYear,true,s);markets.set(marketKey,demand)}
    const r1 = p1 && routeFor.get(odKey(p1.from, p1.to)), r2 = p2 && routeFor.get(odKey(p2.from, p2.to))
    const fare1 = r1 ? (r1.fare.y * 3 + r1.fare.c) / 4 : partner1!.fare
    const fare2 = r2 ? (r2.fare.y * 3 + r2.fare.c) / 4 : partner2!.fare
    // tarifa cheia do mercado; o desconto, se houver, sai da força do direto (ver DESCONTO_CONEXAO)
    const fare = Math.max(0.5, (fare1 * d1 + fare2 * d2) / (d1 + d2))
    const domestica = AP[from]?.cc === AP[to]?.cc
    const weight = connectionAttraction(detour, c.espera, fare, s.airline.reputation, c.codeshare ? .85 : c.parceira ? .55 : 1, domestica) *
      Math.min(1.5, Math.min(sumCabins(first.capacity), sumCabins(second.capacity)) / Math.max(60, demand.total / 2))
    // Aeroportos próximos compartilham um orçamento de procura; multiplicar
    // frequências e combinações não pode multiplicar os mesmos viajantes O&D.
    const marketFrom = nearbyAirports(from)[0], marketTo = nearbyAirports(to)[0]
    // Em mercados em que as duas pontas apontam para o mesmo aeroporto
    // representativo (por exemplo, duas cidades regionais próximas), manter
    // a direção real evita que ida e volta consumam o mesmo orçamento.
    const key = marketFrom === marketTo && from !== to ? `${from}>${to}` : `${marketFrom}>${marketTo}`
    const group = groups.get(key) ?? { from, to, demand: emptyCabins(), candidates: [] }
    for (const cb of CABINS) group.demand[cb] = Math.max(group.demand[cb], demand.pax[cb] / 2)
    const ac1 = p1 && fleet.get(p1.aircraftId), ac2 = p2 && fleet.get(p2.aircraftId)
    const pitch = { y: 31, w: 38, c: 60, f: 83 }
    for (const cb of CABINS) pitch[cb] = Math.min(ac1 ? ac1.pitch[cb] : pitch[cb], ac2 ? ac2.pitch[cb] : pitch[cb])
    group.candidates.push({ c, first, second, weight, fare, pitch, d1, d2, refFare: demand.refFare, via: hub })
    groups.set(key, group)
  }
  const proposals:{id:string;market:string;c:Candidate;wanted:Cabins;discount:number}[]=[]
  const marketLimits=new Map<string,Cabins>()
  // Só reservas de hoje podem consumir o mercado de hoje; não percorre os
  // 14 dias de histórico novamente para cada par de aeroportos.
  const todaysJourneys=journeys.filter(j=>!j.cancelled&&j.first.day===s.day)
  const todaysManifests=[...manifests.values()].filter(m=>m.leg.day===s.day&&m.leg.own)
  for (const [market, g] of groups) {
    const directWeight = directCompetition(g.from, g.to, sumCabins(g.demand))
    const desconto = 1 - DESCONTO_CONEXAO * Math.min(1, directWeight)
    const denominator = .35 + directWeight + g.candidates.reduce((n, c) => n + c.weight, 0)
    const available = { ...g.demand }
    // O viajante que já comprou um direto nosso não pode ser vendido outra
    // vez pela conexão. A procura é direcional e compartilhada entre hubs.
    const origins = nearbyAirports(g.from), destinations = nearbyAirports(g.to)
    for (const m of todaysManifests) if (origins.includes(m.leg.from) && destinations.includes(m.leg.to)) {
      for (const cb of CABINS) available[cb] = Math.max(0, available[cb] - m.baseline[cb])
    }
    for (const j of todaysJourneys) if (origins.includes(j.first.from) && destinations.includes(j.second.to)) {
      for (const cb of CABINS) available[cb] = Math.max(0, available[cb] - j.pax[cb])
    }
    marketLimits.set(market,available)
    for (const c of g.candidates) {
      const wanted=emptyCabins()
      for(const cb of CABINS)wanted[cb]=g.demand[cb]*c.weight/denominator
      proposals.push({id:`${s.day}:${c.first.leg.id}>${c.second.leg.id}`,market,c,wanted,discount:desconto})
    }
  }
  const bookings=new Map<string,Cabins>()
  for(const cb of CABINS){
    const allocation=allocateSharedSeats(proposals.map(p=>({id:p.id,market:p.market,first:flightKey(p.c.first.leg),second:flightKey(p.c.second.leg),wanted:p.wanted[cb]})),
      new Map([...marketLimits].map(([key,value])=>[key,value[cb]])),
      new Map([...manifests].map(([key,m])=>[key,connectionRoom(m,cb)])))
    for(const [id,n] of allocation){const pax=bookings.get(id)??emptyCabins();pax[cb]=n;bookings.set(id,pax)}
  }
  for(const {id,c,discount} of proposals){
      const pax=bookings.get(id)??emptyCabins()
      if(!sumCabins(pax))continue
      const cobra = c.fare * discount
      const price = ticketRevenue(pax, { y: cobra, w: cobra, c: cobra, f: cobra }, c.refFare, c.pitch)
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
