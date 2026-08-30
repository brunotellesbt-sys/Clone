import { AIRPORT_BY_IATA } from './data/airports'
import type { AircraftType } from './data/aircraft'
import { crewFor, pitchFare } from './cabin'
import { CLASS_FARE_MULT, priceElasticity, type MarketDemand } from './demand'
import { CABINS, type CabinClass, type Cabins } from './types'

/** Preço de mercado (o catálogo guarda preço de tabela; ninguém paga tabela). */
export const marketPrice = (t: AircraftType) => t.price * 1e6 * 0.45
export const leaseMonthly = (t: AircraftType) => marketPrice(t) * 0.009
/** Valor de revenda considerando idade e estado. */
export const resaleValue = (t: AircraftType, age: number, condition: number) =>
  marketPrice(t) * Math.max(0.16, Math.pow(0.925, age)) * (0.55 + 0.45 * condition)

export const blockHours = (t: AircraftType, distNm: number) => distNm / t.speed + 0.45

/** Quantos voos por dia um avião consegue nessa etapa. */
export function maxDailyFrequency(t: AircraftType, distNm: number): number {
  const cycle = blockHours(t, distNm) + t.turn / 60
  return Math.max(1, Math.floor(16.5 / (cycle * 2))) * 2 // ida e volta contam como par
}

export interface FlightCost {
  fuel: number
  crew: number
  maintenance: number
  fees: number
  handling: number
  catering: number
  total: number
  blockH: number
}

/** Fator de jogo: os custos reais deixariam quase toda rota no zero a zero. */
const COST_TUNING = 0.82

export function flightCost(
  t: AircraftType,
  distNm: number,
  from: string,
  to: string,
  fuelPrice: number,
  age: number,
  pax: number,
  premiumPax = 0,
  crewCount = t.crew,
): FlightCost {
  const blockH = blockHours(t, distNm)
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]

  // Etapa longa carrega mais combustível só para transportar combustível.
  const stretch = Math.min(1, distNm / t.range)
  const burn = t.burn * (1 + 0.14 * Math.pow(stretch, 1.5))
  const fuel = burn * blockH * fuelPrice

  // Acima de 7h de voo a tripulação técnica é reforçada.
  const pilots = 2 * 420 * (blockH > 7 ? 1.55 : 1)
  const crew = (pilots + crewCount * 160) * blockH

  const ageFactor = 0.86 + 0.045 * Math.min(age, 28)
  const maintenance = t.maint * (420 + t.price * 11) * blockH * ageFactor

  const landing = (tier: number) => (1.4 + 0.5 * tier) * t.maxSeats * 2.2
  const fees = landing(a.tier) + landing(b.tier) + pax * (4.5 + 0.8 * ((a.tier + b.tier) / 2))
  const handling = 700 + 5.5 * t.maxSeats
  const catering = (pax - premiumPax) * (2 + 0.0022 * distNm) + premiumPax * (16 + 0.013 * distNm)

  const total = (fuel + crew + maintenance + fees + handling + catering) * COST_TUNING
  return { fuel, crew, maintenance, fees, handling, catering, total, blockH }
}

/** Comissões, GDS, cartão: sai de cima da receita. */
export const DISTRIBUTION_RATE = 0.085

/** Nem todo assento é vendável: horário errado, no-show, desequilíbrio de sentido. */
export const SELLABLE = 0.9

export interface Carrier {
  id: string
  seats: Cabins
  freq: number
  fareMult: number
  quality: number
}

export interface Allocation {
  id: string
  pax: Cabins
  share: number
}

/**
 * Reparte a demanda entre as companhias que voam o par, por classe.
 * Modelo logit: frequência puxa, preço afasta, qualidade desempata.
 * Sobra de demanda é reoferecida a quem ainda tem assento (um passe).
 */
export function allocateMarket(demand: MarketDemand, carriers: Carrier[]): Allocation[] {
  if (carriers.length === 0) return []
  const avgFare = carriers.reduce((s, c) => s + c.fareMult, 0) / carriers.length
  const marketMult = priceElasticity(avgFare)

  const out: Allocation[] = carriers.map((c) => ({
    id: c.id,
    pax: { y: 0, w: 0, c: 0, f: 0 },
    share: 0,
  }))

  for (const cabin of CABINS) {
    const totalPax = demand.pax[cabin] * marketMult
    if (totalPax <= 0) continue
    // Classes premium ligam menos para preço e mais para frequência e produto.
    const priceExp = cabin === 'y' ? -2.1 : cabin === 'w' ? -1.6 : -1.0
    const freqExp = cabin === 'y' ? 0.62 : 0.78
    const attract = carriers.map((c, i) =>
      out[i] && c.seats[cabin] > 0
        ? Math.pow(Math.max(0.4, c.freq), freqExp) * Math.pow(Math.max(0.4, c.fareMult), priceExp) * c.quality
        : 0,
    )
    const sum = attract.reduce((s, v) => s + v, 0)
    if (sum <= 0) continue

    let spill = 0
    const capacityLeft: number[] = []
    for (let i = 0; i < carriers.length; i++) {
      const want = (totalPax * attract[i]) / sum
      const cap = carriers[i].seats[cabin]
      const got = Math.min(want, cap)
      spill += want - got
      out[i].pax[cabin] = got
      capacityLeft.push(cap - got)
    }
    if (spill > 1) {
      const leftSum = capacityLeft.reduce((s, v) => s + v, 0)
      if (leftSum > 0) {
        // Só 55% de quem não achou assento aceita a segunda opção.
        const redistributable = Math.min(spill * 0.55, leftSum)
        for (let i = 0; i < carriers.length; i++) {
          out[i].pax[cabin] += (redistributable * capacityLeft[i]) / leftSum
        }
      }
    }
  }

  const grand = out.reduce((s, o) => s + o.pax.y + o.pax.w + o.pax.c + o.pax.f, 0) || 1
  for (const o of out) o.share = (o.pax.y + o.pax.w + o.pax.c + o.pax.f) / grand
  return out
}

/**
 * Receita de passagem. O passo de poltrona entra aqui: uma executiva de cama
 * plana cobra bem mais que uma reclinável, e uma econômica ultradensa cobra
 * menos que uma de passo normal.
 */
export function ticketRevenue(pax: Cabins, fare: Cabins, refFare: number, pitch?: Cabins): number {
  let sum = 0
  for (const cabin of CABINS) {
    const quality = pitch ? pitchFare(cabin, pitch[cabin]) : 1
    sum += pax[cabin] * refFare * CLASS_FARE_MULT[cabin] * fare[cabin] * quality
  }
  return sum
}

export const emptyCabins = (): Cabins => ({ y: 0, w: 0, c: 0, f: 0 })
export const addCabins = (a: Cabins, b: Cabins): Cabins => ({
  y: a.y + b.y, w: a.w + b.w, c: a.c + b.c, f: a.f + b.f,
})
export const sumCabins = (c: Cabins) => c.y + c.w + c.c + c.f

export const seatCapacity = (seats: Cabins, cabin: CabinClass) => seats[cabin]

export { crewFor }
