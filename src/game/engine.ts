import { AIRCRAFT_BY_ID, type AircraftType } from './data/aircraft'
import { SAVE_VERSION } from './save'
import { AIRPORT_BY_IATA } from './data/airports'
import { BLANK_LIVERY } from '../livery/presets'
import { baseDemand, CLASS_FARE_MULT } from './demand'
import { cabinComfort, checkCabin, clampPitch, crewFor, defaultCabin } from './cabin'
import { engineIdFor, withEngine } from './spec'
import {
  addCabins, allocateMarket, blockHours, DISTRIBUTION_RATE, emptyCabins,
  flightCost, leaseMonthly, marketPrice, maxDailyFrequency, resaleValue, SELLABLE,
  sumCabins, ticketRevenue, type Carrier,
} from './economy'
import { distanceBetween, odKey } from './geo'
import { createCompetitors, stepCompetitors } from './ai'
import { between, chance, makeRng, type Rng } from './rng'
import {
  CABINS, type Aircraft, type Cabins, type DayResult, type GameState, type Livery,
  type Notice, type Route,
} from './types'

export const START_CASH = 85e6
export const HQ_DAILY_BASE = 9500
const LEDGER_KEEP = 420
const HISTORY_KEEP = 60

let idCounter = 1
const nextId = (p: string) => `${p}${(idCounter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

export function registration(rng: Rng, cc: string): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const l = () => L[Math.floor(rng() * L.length)]
  if (cc === 'BR') return `PR-${l()}${l()}${l()}`
  if (cc === 'US') return `N${Math.floor(between(rng, 100, 899))}${l()}${l()}`
  return `${l()}${l()}-${l()}${l()}${l()}`
}

export function newGame(opts: { name: string; code: string; hub: string; livery?: Livery; seed?: number }): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9)
  const rng = makeRng(seed)
  return {
    version: SAVE_VERSION,
    seed,
    day: 0,
    startYear: 2027,
    fuelPrice: 0.8,
    airline: {
      name: opts.name,
      code: opts.code,
      hubs: [opts.hub],
      livery: opts.livery ?? structuredClone(BLANK_LIVERY),
      reputation: 0.5,
      cash: START_CASH,
      fleet: [],
      routes: [],
      loans: [],
      marketing: 0,
    },
    competitors: createCompetitors(rng),
    ledger: [],
    notices: [{ day: 0, kind: 'info', text: `${opts.name} recebeu o certificado de operador. Bem-vindo ao mercado.` }],
    lastShare: {},
    paused: true,
    speed: 1,
    tutorialStep: 0,
  }
}

// ---------------------------------------------------------------- utilidades

export const gameDate = (s: GameState) => {
  const d = new Date(Date.UTC(s.startYear, 0, 1))
  d.setUTCDate(d.getUTCDate() + s.day)
  return d
}
export const dayOfYear = (s: GameState) => {
  const d = gameDate(s)
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000)
}
export const dowOf = (s: GameState) => gameDate(s).getUTCDay()

/** O modelo cru, sem motorização aplicada. */
export const modelOf = (ac: Aircraft) => AIRCRAFT_BY_ID[ac.typeId]
/** A ficha efetiva: modelo + motor instalado. */
export const typeOf = (ac: Aircraft) => withEngine(AIRCRAFT_BY_ID[ac.typeId], ac.engineId)
export const routeOf = (s: GameState, id: string) => s.airline.routes.find((r) => r.id === id)
export const aircraftOf = (s: GameState, id: string) => s.airline.fleet.find((a) => a.id === id)

export function slotsUsed(s: GameState, iata: string): number {
  let n = 0
  for (const r of s.airline.routes) {
    if (r.from !== iata && r.to !== iata) continue
    n += Math.max(...r.freq) * 2
  }
  return n
}
/** Parte da capacidade do aeroporto que já é de outras companhias. */
export const slotsTaken = (iata: string) => Math.round(AIRPORT_BY_IATA[iata].slots * 0.62)
export const slotsFree = (s: GameState, iata: string) =>
  AIRPORT_BY_IATA[iata].slots - slotsTaken(iata) - slotsUsed(s, iata)

export const fleetValue = (s: GameState) =>
  s.airline.fleet.reduce((sum, a) => sum + (a.leased ? 0 : resaleValue(typeOf(a), a.age, a.condition)), 0)
export const debtTotal = (s: GameState) => s.airline.loans.reduce((sum, l) => sum + l.balance, 0)
export const netWorth = (s: GameState) => s.airline.cash + fleetValue(s) - debtTotal(s)

export function creditLimit(s: GameState): number {
  const base = 40e6 + fleetValue(s) * 0.65 + Math.max(0, netWorth(s)) * 0.35
  return Math.max(0, base - debtTotal(s))
}

export function notify(s: GameState, kind: Notice['kind'], text: string) {
  s.notices.unshift({ day: s.day, kind, text })
  if (s.notices.length > 60) s.notices.length = 60
}

// ------------------------------------------------------------------- ações

export interface BuyOptions {
  /** Motorização escolhida; sem isso vem a de série do modelo. */
  engineId?: string
  /** Peso premium da configuração inicial de cabine. */
  seatBias?: number
}

export function buyAircraft(s: GameState, typeId: string, lease: boolean, opts: BuyOptions = {}): string | null {
  const model = AIRCRAFT_BY_ID[typeId]
  if (!model) return 'Modelo inexistente.'
  const engineId = engineIdFor(model, opts.engineId)
  const t = withEngine(model, engineId)
  const year = s.startYear + s.day / 365
  if (year < model.since) return `O ${model.name} só entra em linha em ${model.since}.`
  if (year < t.since) return `Essa motorização só passa a ser oferecida em ${t.since}.`
  const price = marketPrice(t)
  const upfront = lease ? leaseMonthly(t) * 2 : price
  if (s.airline.cash < upfront) return 'Caixa insuficiente.'
  const rng = makeRng(s.seed + s.day + s.airline.fleet.length * 977)
  const hubCc = AIRPORT_BY_IATA[s.airline.hubs[0]]?.cc ?? 'BR'
  const cabin = defaultCabin(model, opts.seatBias ?? 1)
  s.airline.cash -= upfront
  s.airline.fleet.push({
    id: nextId('ac'),
    typeId,
    engineId,
    reg: registration(rng, hubCc),
    seats: cabin.seats,
    pitch: cabin.pitch,
    age: lease ? between(rng, 0.5, 6) : 0,
    hours: 0,
    cycles: 0,
    condition: 1,
    routeId: null,
    leased: lease,
    lease: lease ? leaseMonthly(t) : 0,
    value: lease ? 0 : price,
    groundedUntil: 0,
  })
  notify(s, 'good', `${model.name} ${lease ? 'arrendado' : 'comprado'} — entrou na frota.`)
  return null
}

export function sellAircraft(s: GameState, id: string): string | null {
  const ac = aircraftOf(s, id)
  if (!ac) return 'Aeronave não encontrada.'
  if (ac.routeId) unassignAircraft(s, id)
  const t = typeOf(ac)
  if (ac.leased) {
    const penalty = ac.lease * 3
    if (s.airline.cash < penalty) return 'Caixa insuficiente para a multa de devolução.'
    s.airline.cash -= penalty
    notify(s, 'info', `${t.name} ${ac.reg} devolvido ao arrendador (multa de ${money(penalty)}).`)
  } else {
    const v = resaleValue(t, ac.age, ac.condition)
    s.airline.cash += v
    notify(s, 'info', `${t.name} ${ac.reg} vendido por ${money(v)}.`)
  }
  s.airline.fleet = s.airline.fleet.filter((a) => a.id !== id)
  return null
}

export function routeSlotCost(from: string, to: string, freq: number): number {
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  return (a.tier ** 2 + b.tier ** 2) * 42000 * Math.max(1, freq) * 0.25 + 180000
}

export function openRoute(s: GameState, from: string, to: string): string | null {
  if (from === to) return 'Origem e destino iguais.'
  if (!s.airline.hubs.includes(from) && !s.airline.hubs.includes(to))
    return 'Toda rota precisa tocar em uma das suas bases.'
  if (s.airline.routes.some((r) => odKey(r.from, r.to) === odKey(from, to)))
    return 'Você já opera esse par.'
  if (slotsFree(s, from) < 2 || slotsFree(s, to) < 2) return 'Sem slots disponíveis em uma das pontas.'
  const cost = routeSlotCost(from, to, 1)
  if (s.airline.cash < cost) return `Abrir a rota custa ${money(cost)} em slots e taxas.`
  s.airline.cash -= cost
  const dist = distanceBetween(from, to)
  s.airline.routes.push({
    id: nextId('rt'),
    from: s.airline.hubs.includes(from) ? from : to,
    to: s.airline.hubs.includes(from) ? to : from,
    distance: dist,
    aircraftIds: [],
    freq: [1, 1, 1, 1, 1, 1, 1],
    fare: { y: 1, w: 1, c: 1, f: 1 },
    openedDay: s.day,
    history: [],
  })
  notify(s, 'good', `Rota ${from}–${to} aberta (${Math.round(dist)} nm).`)
  return null
}

export function closeRoute(s: GameState, id: string): string | null {
  const r = routeOf(s, id)
  if (!r) return 'Rota não encontrada.'
  for (const acId of [...r.aircraftIds]) unassignAircraft(s, acId)
  s.airline.routes = s.airline.routes.filter((x) => x.id !== id)
  notify(s, 'info', `Rota ${r.from}–${r.to} encerrada.`)
  return null
}

export function assignAircraft(s: GameState, acId: string, routeId: string): string | null {
  const ac = aircraftOf(s, acId)
  const r = routeOf(s, routeId)
  if (!ac || !r) return 'Seleção inválida.'
  const t = typeOf(ac)
  if (t.range < r.distance) return `${t.name} não alcança ${Math.round(r.distance)} nm (limite ${t.range} nm).`
  const from = AIRPORT_BY_IATA[r.from]
  const to = AIRPORT_BY_IATA[r.to]
  if (t.runway > Math.min(from.runway, to.runway)) return 'Pista curta demais em uma das pontas.'
  if (ac.routeId) unassignAircraft(s, acId)
  ac.routeId = routeId
  r.aircraftIds.push(acId)
  return null
}

export function unassignAircraft(s: GameState, acId: string) {
  const ac = aircraftOf(s, acId)
  if (!ac || !ac.routeId) return
  const r = routeOf(s, ac.routeId)
  if (r) r.aircraftIds = r.aircraftIds.filter((x) => x !== acId)
  ac.routeId = null
}

export function setFrequency(s: GameState, routeId: string, dow: number, value: number): string | null {
  const r = routeOf(s, routeId)
  if (!r) return null
  const cap = routeCapacityLimit(s, r)
  const v = Math.max(0, Math.min(cap, Math.round(value)))
  const before = Math.max(...r.freq)
  r.freq[dow] = v
  const after = Math.max(...r.freq)
  if (after > before) {
    const extra = (after - before) * 2
    if (slotsFree(s, r.from) < extra || slotsFree(s, r.to) < extra) {
      r.freq[dow] = before
      return 'Sem slots para aumentar a frequência.'
    }
  }
  return null
}

export function setAllFrequencies(s: GameState, routeId: string, value: number) {
  for (let d = 0; d < 7; d++) setFrequency(s, routeId, d, value)
}

/** Máximo de rotações diárias que a frota alocada aguenta. */
export function routeCapacityLimit(s: GameState, r: Route): number {
  let total = 0
  for (const id of r.aircraftIds) {
    const ac = aircraftOf(s, id)
    if (!ac) continue
    total += maxDailyFrequency(typeOf(ac), r.distance) / 2
  }
  return Math.floor(total)
}

export function setFare(s: GameState, routeId: string, cabin: keyof Cabins, mult: number) {
  const r = routeOf(s, routeId)
  if (!r) return
  r.fare[cabin] = Math.max(0.55, Math.min(1.9, mult))
}

export function setCabin(s: GameState, acId: string, seats: Cabins, pitch: Cabins): string | null {
  const ac = aircraftOf(s, acId)
  if (!ac) return null
  const t = modelOf(ac)
  const p = clampPitch(pitch)
  const chk = checkCabin(t, seats, p)
  if (chk.overLength) return 'A configuração não cabe no comprimento da cabine.'
  if (chk.overLimit) return `O limite de saídas do ${t.name} é de ${t.maxSeats} passageiros.`
  // Poltrona premium é cara e demora a instalar; mexer no passo da econômica é barato.
  const cost = 240000 + 2600 * seats.w + 34000 * seats.c + 90000 * seats.f
  if (s.airline.cash < cost) return `A reconfiguração custa ${money(cost)}.`
  s.airline.cash -= cost
  ac.seats = { y: Math.round(seats.y), w: Math.round(seats.w), c: Math.round(seats.c), f: Math.round(seats.f) }
  ac.pitch = p
  ac.groundedUntil = s.day + (seats.c + seats.f > 0 ? 4 : 2)
  return null
}

export function addHub(s: GameState, iata: string): string | null {
  if (s.airline.hubs.includes(iata)) return 'Já é uma base sua.'
  const ap = AIRPORT_BY_IATA[iata]
  const cost = 4.5e6 * ap.tier + 6e6
  if (s.airline.reputation < 0.45 + 0.05 * ap.tier)
    return 'Reputação insuficiente para negociar espaço nesse aeroporto.'
  if (s.airline.cash < cost) return `Abrir base em ${iata} custa ${money(cost)}.`
  s.airline.cash -= cost
  s.airline.hubs.push(iata)
  notify(s, 'good', `Nova base em ${ap.city} (${iata}).`)
  return null
}

export function takeLoan(s: GameState, amount: number): string | null {
  const limit = creditLimit(s)
  if (amount <= 0) return null
  if (amount > limit) return `Seu limite de crédito hoje é ${money(limit)}.`
  const leverage = debtTotal(s) / Math.max(1e6, fleetValue(s) + s.airline.cash)
  const rate = 0.055 + 0.09 * leverage + (s.airline.reputation < 0.5 ? 0.02 : 0)
  s.airline.loans.push({
    id: nextId('ln'), principal: amount, balance: amount,
    rate: Math.min(0.19, rate), takenDay: s.day, termDays: 365 * 7,
  })
  s.airline.cash += amount
  notify(s, 'info', `Empréstimo de ${money(amount)} a ${(rate * 100).toFixed(1)}% ao ano.`)
  return null
}

export function repayLoan(s: GameState, id: string, amount: number): string | null {
  const l = s.airline.loans.find((x) => x.id === id)
  if (!l) return null
  const pay = Math.min(amount, l.balance, s.airline.cash)
  if (pay <= 0) return 'Sem caixa para amortizar.'
  s.airline.cash -= pay
  l.balance -= pay
  if (l.balance < 1) s.airline.loans = s.airline.loans.filter((x) => x.id !== id)
  return null
}

export const setMarketing = (s: GameState, perDay: number) => {
  s.airline.marketing = Math.max(0, Math.min(400000, Math.round(perDay)))
}

// -------------------------------------------------------------- simulação

interface RouteDay {
  route: Route
  flights: number
  seats: Cabins
  /** Assentos vendáveis (base do rateio de mercado). */
  seatsTotal: number
  /** Assentos físicos instalados — é contra eles que se mede o aproveitamento. */
  physicalSeats: number
  /** Passo médio por classe na rota, ponderado por assento. */
  pitch: Cabins
}

function availableAircraft(s: GameState, r: Route) {
  return r.aircraftIds
    .map((id) => aircraftOf(s, id))
    .filter((a): a is Aircraft => !!a && a.groundedUntil <= s.day)
}

export function advanceDay(s: GameState): GameState {
  s.day += 1
  const dow = dowOf(s)
  const doy = dayOfYear(s)
  const rng = makeRng(s.seed * 31 + s.day)

  // Combustível: passeio aleatório com reversão à média.
  s.fuelPrice = Math.max(0.42, Math.min(1.6, s.fuelPrice + (0.82 - s.fuelPrice) * 0.006 + between(rng, -0.018, 0.018)))

  // 1) O que a companhia coloca no ar hoje.
  const perRoute: RouteDay[] = []
  const carriersByOd = new Map<string, Carrier[]>()
  const playerQuality = (0.72 + 0.55 * s.airline.reputation) * (1 + Math.min(0.12, s.airline.marketing / 2.4e6))

  for (const r of s.airline.routes) {
    const acs = availableAircraft(s, r)
    if (acs.length === 0) continue
    const limit = acs.reduce((sum, a) => sum + maxDailyFrequency(typeOf(a), r.distance) / 2, 0)
    const flights = Math.max(0, Math.min(Math.floor(limit), r.freq[dow]))
    if (flights === 0) continue

    // Distribui os voos entre as aeronaves alocadas (rodízio).
    let seats: Cabins = emptyCabins()
    let physicalSeats = 0
    let comfort = 0
    // Passo médio da rota, ponderado por assento: é o que vira tarifa depois.
    const pitchAcc: Cabins = emptyCabins()
    const pitchW: Cabins = emptyCabins()
    // Nem todo assento é vendável, e o mix de horários varia dia a dia.
    const sellable = SELLABLE * between(rng, 0.96, 1.02)
    for (let i = 0; i < flights; i++) {
      const ac = acs[i % acs.length]
      const t = typeOf(ac)
      // Cada rotação oferece assentos nos dois sentidos.
      seats = addCabins(seats, {
        y: ac.seats.y * 2 * sellable, w: ac.seats.w * 2 * sellable,
        c: ac.seats.c * 2 * sellable, f: ac.seats.f * 2 * sellable,
      })
      physicalSeats += sumCabins(ac.seats) * 2
      for (const cb of CABINS) {
        pitchAcc[cb] += ac.pitch[cb] * ac.seats[cb]
        pitchW[cb] += ac.seats[cb]
      }
      comfort += t.comfort * cabinComfort(t, ac.seats, ac.pitch) * (0.85 + 0.15 * ac.condition)
    }
    comfort /= flights
    const pitch: Cabins = {
      y: pitchW.y ? pitchAcc.y / pitchW.y : 31,
      w: pitchW.w ? pitchAcc.w / pitchW.w : 38,
      c: pitchW.c ? pitchAcc.c / pitchW.c : 60,
      f: pitchW.f ? pitchAcc.f / pitchW.f : 83,
    }
    const fareAvg = (r.fare.y * 3 + r.fare.c) / 4
    const key = odKey(r.from, r.to)
    const list = carriersByOd.get(key) ?? []
    list.push({ id: `P:${r.id}`, seats, freq: flights, fareMult: fareAvg, quality: playerQuality * comfort })
    carriersByOd.set(key, list)
    perRoute.push({ route: r, flights, seats, seatsTotal: sumCabins(seats), physicalSeats, pitch })
  }

  // 2) Concorrentes no mesmo par.
  for (const comp of s.competitors) {
    for (const cr of comp.routes) {
      const list = carriersByOd.get(cr.key) ?? []
      const premium = 0.12
      list.push({
        id: `C:${comp.id}:${cr.key}`,
        seats: {
          y: cr.seats * cr.freq * 2 * SELLABLE * (1 - premium),
          w: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.35,
          c: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.6,
          f: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.05,
        },
        freq: cr.freq,
        fareMult: cr.fare,
        quality: cr.quality,
      })
      carriersByOd.set(cr.key, list)
    }
  }

  // 3) Reparte a demanda e apura o dia da companhia.
  const today: DayResult = {
    day: s.day, pax: emptyCabins(), flights: 0, seats: 0, revenue: 0, cost: 0, profit: 0, loadFactor: 0,
  }
  const pressure: Record<string, number> = {}
  s.lastShare = {}

  for (const rd of perRoute) {
    const r = rd.route
    const key = odKey(r.from, r.to)
    const demand = baseDemand(r.from, r.to, s.day, doy)
    const carriers = carriersByOd.get(key) ?? []
    const alloc = allocateMarket(demand, carriers)
    const mine = alloc.find((a) => a.id === `P:${r.id}`)
    const pax = mine?.pax ?? emptyCabins()
    s.lastShare[key] = mine?.share ?? 0
    pressure[key] = mine?.share ?? 0

    const gross = ticketRevenue(pax, r.fare, demand.refFare, rd.pitch)
    const cargo = gross * (r.distance > 2200 ? 0.11 : 0.05)
    const revenue = (gross + cargo) * (1 - DISTRIBUTION_RATE)

    // Custo: cada rotação são duas pernas.
    const acs = availableAircraft(s, r)
    let cost = 0
    const legs = Math.max(1, rd.flights * 2)
    const paxPerLeg = sumCabins(pax) / legs
    const premiumPerLeg = (pax.w + pax.c + pax.f) / legs
    for (let i = 0; i < rd.flights; i++) {
      const ac = acs[i % acs.length]
      const t = typeOf(ac)
      const c = flightCost(t, r.distance, r.from, r.to, s.fuelPrice, ac.age, paxPerLeg, premiumPerLeg, crewFor(ac.seats))
      cost += c.total * 2
      ac.hours += c.blockH * 2
      ac.cycles += 2
      ac.condition = Math.max(0, ac.condition - (0.00055 + c.blockH * 0.00013))
    }

    const dayRes: DayResult = {
      day: s.day,
      pax,
      flights: rd.flights,
      seats: rd.physicalSeats,
      revenue,
      cost,
      profit: revenue - cost,
      loadFactor: rd.physicalSeats > 0 ? sumCabins(pax) / rd.physicalSeats : 0,
    }
    r.history.push(dayRes)
    if (r.history.length > HISTORY_KEEP) r.history.shift()

    today.pax = addCabins(today.pax, pax)
    today.flights += dayRes.flights
    today.seats += dayRes.seats
    today.revenue += dayRes.revenue
    today.cost += dayRes.cost
  }

  // 4) Custos que não dependem de voar.
  let overhead = HQ_DAILY_BASE + s.airline.fleet.length * 2200 + s.airline.routes.length * 850
  overhead += s.airline.hubs.length * 5200
  overhead += s.airline.marketing
  for (const ac of s.airline.fleet) {
    if (ac.leased) overhead += ac.lease / 30
    if (!ac.leased) ac.value = resaleValue(typeOf(ac), ac.age, ac.condition)
    ac.age += 1 / 365
  }
  let interest = 0
  for (const l of s.airline.loans) {
    const i = (l.balance * l.rate) / 365
    const amort = l.principal / l.termDays
    interest += i
    const pay = i + amort
    l.balance = Math.max(0, l.balance - amort)
    overhead += pay
  }
  s.airline.loans = s.airline.loans.filter((l) => l.balance > 1)
  today.cost += overhead
  today.profit = today.revenue - today.cost
  today.loadFactor = today.seats > 0 ? sumCabins(today.pax) / today.seats : 0
  s.airline.cash += today.profit

  // 5) Manutenção pesada e panes.
  for (const ac of s.airline.fleet) {
    if (ac.condition < 0.55 && chance(rng, 0.004 + (0.55 - ac.condition) * 0.06)) {
      const t = typeOf(ac)
      const bill = marketPrice(t) * 0.012 * (1.6 - ac.condition)
      s.airline.cash -= bill
      ac.condition = Math.min(1, ac.condition + 0.42)
      ac.groundedUntil = s.day + Math.round(between(rng, 2, 6))
      notify(s, 'bad', `${t.name} ${ac.reg} entrou em manutenção pesada — ${money(bill)}.`)
    }
  }

  // 6) Reputação: pontualidade (estado da frota), conforto e propaganda.
  const avgCondition = s.airline.fleet.length
    ? s.airline.fleet.reduce((x, a) => x + a.condition, 0) / s.airline.fleet.length
    : 0.8
  const lfPenalty = today.loadFactor > 0.93 ? (today.loadFactor - 0.93) * 1.4 : 0
  const target = Math.max(
    0.1,
    Math.min(0.97, 0.28 + 0.42 * avgCondition + Math.min(0.16, s.airline.marketing / 1.6e6) - lfPenalty),
  )
  s.airline.reputation += (target - s.airline.reputation) * 0.012

  // 7) Concorrência reage uma vez por semana.
  if (s.day % 7 === 0) {
    stepCompetitors(s.competitors, s.day, rng, pressure)
    computeCompetitorRevenue(s, doy)
  }

  s.ledger.push(today)
  if (s.ledger.length > LEDGER_KEEP) s.ledger.shift()

  if (s.airline.cash < 0 && s.day % 15 === 0) {
    notify(s, 'bad', 'Caixa negativo. Corte custos, venda aeronaves ou negocie crédito.')
  }
  if (interest > 0 && s.day % 90 === 0 && debtTotal(s) > fleetValue(s) * 1.2) {
    notify(s, 'bad', 'Alavancagem alta: os bancos estão desconfortáveis com sua dívida.')
  }
  return s
}

/** Estima a receita mensal de cada concorrente disputando de verdade cada par. */
function computeCompetitorRevenue(s: GameState, doy: number) {
  const byOd = new Map<string, { comp: (typeof s.competitors)[number]; route: (typeof s.competitors)[number]['routes'][number] }[]>()
  for (const comp of s.competitors) {
    for (const r of comp.routes) {
      const list = byOd.get(r.key) ?? []
      list.push({ comp, route: r })
      byOd.set(r.key, list)
    }
  }
  for (const c of s.competitors) c.revenue30 = 0
  for (const [, list] of byOd) {
    const first = list[0].route
    const demand = baseDemand(first.from, first.to, s.day, doy)
    const premium = 0.12
    const carriers: Carrier[] = list.map(({ comp, route }) => ({
      id: comp.id,
      seats: {
        y: route.seats * route.freq * 2 * SELLABLE * (1 - premium),
        w: route.seats * route.freq * 2 * SELLABLE * premium * 0.35,
        c: route.seats * route.freq * 2 * SELLABLE * premium * 0.6,
        f: route.seats * route.freq * 2 * SELLABLE * premium * 0.05,
      },
      freq: route.freq,
      fareMult: route.fare,
      quality: route.quality,
    }))
    const alloc = allocateMarket(demand, carriers)
    alloc.forEach((a, i) => {
      const { comp, route } = list[i]
      const fare: Cabins = { y: route.fare, w: route.fare, c: route.fare, f: route.fare }
      comp.revenue30 += ticketRevenue(a.pax, fare, demand.refFare) * (1 - DISTRIBUTION_RATE) * 30
    })
  }
  for (const c of s.competitors) c.fleetSize = Math.max(3, Math.round(c.routes.reduce((n, r) => n + r.freq, 0) / 2.6))
}

// -------------------------------------------------------------- formatação

export function money(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} bi`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)} mi`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)} mil`
  return `${sign}$${abs.toFixed(0)}`
}
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
export const num = (v: number) => Math.round(v).toLocaleString('pt-BR')

/** Resumo dos últimos N dias do livro-caixa. */
export function period(s: GameState, days: number) {
  const slice = s.ledger.slice(-days)
  const revenue = slice.reduce((x, d) => x + d.revenue, 0)
  const cost = slice.reduce((x, d) => x + d.cost, 0)
  const pax = slice.reduce((x, d) => x + sumCabins(d.pax), 0)
  const seats = slice.reduce((x, d) => x + d.seats, 0)
  const flights = slice.reduce((x, d) => x + d.flights, 0)
  return { revenue, cost, profit: revenue - cost, pax, seats, flights, loadFactor: seats ? pax / seats : 0, days: slice.length }
}

export function routeEconomics(s: GameState, r: Route) {
  const demand = baseDemand(r.from, r.to, s.day, dayOfYear(s))
  const last = r.history.slice(-14)
  const revenue = last.reduce((x, d) => x + d.revenue, 0)
  const cost = last.reduce((x, d) => x + d.cost, 0)
  const pax = last.reduce((x, d) => x + sumCabins(d.pax), 0)
  const seats = last.reduce((x, d) => x + d.seats, 0)
  return {
    demand,
    share: s.lastShare[odKey(r.from, r.to)] ?? 0,
    revenue, cost, profit: revenue - cost, pax,
    loadFactor: seats ? pax / seats : 0,
    days: last.length,
  }
}

export function fareInDollars(r: Route, cabin: keyof Cabins, refFare: number) {
  return refFare * CLASS_FARE_MULT[cabin] * r.fare[cabin]
}

export function estimateRoute(s: GameState, from: string, to: string, typeId: string, freq: number) {
  const t: AircraftType = AIRCRAFT_BY_ID[typeId]
  const dist = distanceBetween(from, to)
  const demand = baseDemand(from, to, s.day, dayOfYear(s))
  const seats = defaultCabin(t, 1).seats
  const offered = sumCabins(seats) * freq * 2 * SELLABLE
  const rivals = s.competitors.flatMap((c) => c.routes.filter((r) => r.key === odKey(from, to)))
  const rivalSeats = rivals.reduce((x, r) => x + r.seats * r.freq * 2 * SELLABLE, 0)
  const shareGuess = offered / Math.max(1, offered + rivalSeats * 1.05)
  const pax = Math.min(offered, demand.total * shareGuess)
  const premiumPax = pax * 0.12
  const revenue = pax * demand.refFare * 1.2 * (1 - DISTRIBUTION_RATE)
  const cost =
    flightCost(t, dist, from, to, s.fuelPrice, 2, pax / Math.max(1, freq * 2), premiumPax / Math.max(1, freq * 2))
      .total * 2 * freq
  return { dist, demand, offered, pax, revenue, cost, profit: revenue - cost, rivals: rivals.length, blockH: blockHours(t, dist) }
}

export const CABIN_KEYS = CABINS
