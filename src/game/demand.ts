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
/**
 * Escala global da carga, o análogo do `K` do passageiro, e a tarifa de
 * referência por tonelada. Os dois foram calibrados juntos contra a régua do
 * passageiro, medida em GRU:
 *
 * | etapa | cargueiro | passageiro |
 * |---|---|---|
 * | GRU-JFK 4.138 nm | 31% (747F) a 41% (767F) | 41,5% (787-9) |
 * | GRU-MIA 3.600 nm | 14% (737F) a 23% (A321F) | 38,0% (737-800) |
 *
 * As duas linhas são o desenho, não acidente: no longo curso a carga empata
 * com o passageiro ou fica um pouco abaixo, e no curto ela **não paga** — que
 * é o que acontece de verdade, porque ali o caminhão ganha. Cargueiro no jogo
 * é aposta de longo curso, e comprar um para voar etapa curta é erro.
 *
 * `KC` mexe no tamanho do mercado (quantos cargueiros a rota sustenta);
 * `refRate` mexe na margem. Num avião que já voa cheio só o `refRate` tem
 * efeito — foi assim que o 767F foi calibrado.
 */
const KC = 46
/** A carga não cai no fim de semana como o passageiro: ela se acumula nele. */
const WEEKDAY_CARGO = [0.82, 1.1, 1.08, 1.06, 1.05, 1.09, 0.8]

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

export interface CargoDemand {
  /** Toneladas por dia, nos dois sentidos somados. */
  tons: number
  /** Tarifa de referência por tonelada. */
  refRate: number
  distance: number
}

/**
 * Demanda de carga aérea de um par O&D. É um mercado **próprio**, não um
 * acréscimo sobre o de passageiro: quem move carga é comércio, não turismo.
 *
 * Três coisas separam esta curva da de passageiro, e são o que faz cargueiro
 * ter sentido no jogo:
 *
 * - **a distância pesa muito menos**. Caminhão e trem ganham do avião no curto;
 *   o que sobra para a carga aérea é o longo curso. O decaimento usa 2.200 nm
 *   de escala contra 700 nm do passageiro, e expoente 0,75 contra 1,35;
 *
 * - **abaixo de 600 nm o mercado quase não existe** — a carga vai de caminhão.
 *   É o contrário do passageiro, que tem ponte aérea curta cheia;
 *
 * - **a sazonalidade é outra**: carga não tem verão, tem pico de fim de ano
 *   antecipado (a encomenda voa em novembro para chegar em dezembro).
 *
 * O turismo não entra. O PIB entra com expoente alto porque o que gera carga
 * aérea é indústria e consumo, não população pura.
 */
export function cargoDemand(from: string, to: string, day: number, dayOfYear: number): CargoDemand {
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  const dist = distanceBetween(from, to)
  const mass = Math.sqrt(a.pop * b.pop)
  const gdp = (a.gdp + b.gdp) / 2
  const sameCountry = a.cc === b.cc ? 0.72 : 1 // no doméstico o caminhão compete
  const hubBonus = 1 + 0.09 * (a.tier + b.tier - 4) // carga concentra em hub
  const decay = 1 / (1 + Math.pow(dist / 2200, 0.75))
  const curto = dist < 600 ? 0.25 + (0.75 * dist) / 600 : 1
  const pico = 1 + 0.22 * Math.exp(-(((dayOfYear - 320) % 365) ** 2) / 900)
  const noise = 0.85 + 0.3 * hashStr(`C${odKey(from, to)}`)
  const growth = 1 + day * 0.00016 // o mercado de carga cresce mais rápido

  const tons = Math.max(
    0,
    KC * Math.pow(mass, 0.75) * Math.pow(gdp, 1.6) * decay * curto * sameCountry *
      hubBonus * pico * noise * growth * WEEKDAY_CARGO[(day + 4) % 7],
  )
  // Por tonelada-quilômetro a carga aérea cobra bem menos que passageiro, mas a
  // tonelada rende mais que o assento: uma tonelada ocupa o lugar de ~10 pax.
  const refRate = (170 + 0.45 * dist) * (0.75 + 0.4 * gdp)
  return { tons, refRate, distance: dist }
}

export const CLASS_FARE_MULT: Record<CabinClass, number> = { y: 1, w: 1.75, c: 3, f: 6.5 }

/** Elasticidade: mercado encolhe quando a tarifa média sobe acima da referência. */
export const priceElasticity = (fareMult: number) => Math.pow(Math.max(0.35, fareMult), -0.9)
