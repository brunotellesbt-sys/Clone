import { AIRPORT_BY_IATA } from './data/airports'
import { distanceBetween, odKey } from './geo'
import { hashStr } from './rng'
import type { CabinClass, Cabins } from './types'

const WEEKDAY = [1.02, 1.06, 0.93, 0.95, 1.03, 1.16, 0.85] // dom..sáb

/** Sazonalidade: verão do hemisfério de cada ponta + pico de fim de ano. */
function seasonFactor(dayOfYear: number, lat: number): number {
  const phase = lat >= 0 ? 0 : Math.PI
  const summer = 0.15 * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365 + phase)
  const holidays = 0.1 * Math.exp(-(((dayOfYear - 358) % 365) ** 2) / 200)
  return 1 + summer + holidays
}

export interface MarketDemand {
  /** Passageiros por dia, por classe, nos dois sentidos somados. */
  pax: Cabins
  total: number
  refFare: number
  distance: number
}

const K = 1750

/** Demanda estrutural de um par O&D, antes de preço e concorrência. */
export function baseDemand(from: string, to: string, day: number, dayOfYear: number): MarketDemand {
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  const dist = distanceBetween(from, to)
  const mass = Math.sqrt(a.pop * b.pop)
  const gdp = (a.gdp + b.gdp) / 2
  const tour = (a.tour + b.tour) / 2
  const sameCountry = a.cc === b.cc ? 1.55 : a.country === b.country ? 1.3 : 1
  const sameRegion = Math.abs(a.lon - b.lon) < 45 && Math.abs(a.lat - b.lat) < 35 ? 1.12 : 1
  const hubBonus = 1 + 0.05 * (a.tier + b.tier - 4)
  const decay = 1 / (1 + Math.pow(dist / 700, 1.35))
  const season = (seasonFactor(dayOfYear, a.lat) + seasonFactor(dayOfYear, b.lat)) / 2
  const noise = 0.82 + 0.36 * hashStr(odKey(from, to))
  const growth = 1 + day * 0.00012 // o mercado cresce devagar ao longo dos anos

  let total =
    K *
    Math.pow(mass, 0.9) *
    gdp *
    Math.pow(tour, 0.55) *
    decay *
    sameCountry *
    sameRegion *
    hubBonus *
    season *
    noise *
    growth *
    WEEKDAY[(day + 4) % 7]

  if (dist < 120) total *= 0.15 // pares colados não sustentam voo
  total = Math.max(0, total)

  // Mistura de classes: renda e distância empurram para a frente do avião.
  const premium = Math.min(0.34, 0.03 + 0.13 * Math.max(0, gdp - 0.55) + 0.075 * Math.min(dist / 4200, 1))
  const fShare = dist > 2600 && gdp > 0.95 ? premium * 0.11 : 0
  const cShare = premium * (dist > 1500 ? 0.6 : 0.5)
  const wShare = premium - cShare - fShare
  const pax: Cabins = {
    y: total * (1 - premium),
    w: total * Math.max(0, wShare),
    c: total * cShare,
    f: total * fShare,
  }

  const refFare = (34 + 0.088 * dist) * (0.68 + 0.5 * gdp)
  return { pax, total, refFare, distance: dist }
}

export const CLASS_FARE_MULT: Record<CabinClass, number> = { y: 1, w: 1.75, c: 3, f: 6.5 }

/** Elasticidade: mercado encolhe quando a tarifa média sobe acima da referência. */
export const priceElasticity = (fareMult: number) => Math.pow(Math.max(0.35, fareMult), -0.9)
