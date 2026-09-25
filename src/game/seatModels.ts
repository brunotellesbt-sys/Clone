import type { AircraftType } from './data/aircraft'
import apk from './data/apk-seats.json'
import { CABINS, type CabinClass, type Cabins, type SeatConfig } from './types'

type ApkClass = 'eco' | 'premEco' | 'biz' | 'first'
type Family = keyof typeof apk.aircraftSpecs
const APK_CLASS: Record<CabinClass, ApkClass> = { y: 'eco', w: 'premEco', c: 'biz', f: 'first' }
const PREFIX: Record<CabinClass, string> = { y: 'eco_', w: 'prem_eco_', c: 'biz_', f: 'first_' }
const ADJUSTABLE: Record<CabinClass, [number, number]> = { y: [29, 34], w: [36, 42], c: [36, 46], f: [48, 60] }
const LABELS: Record<string, [string, string]> = {
  eco_super_slim: ['Super slim', 'eco'], eco_slim: ['Slim', 'eco'], eco_standard: ['Padrão', 'eco'],
  eco_comfort: ['Conforto', 'eco'], eco_luxury: ['Luxo', 'eco'],
  prem_eco_basic: ['Premium básica', 'eco'], prem_eco_standard: ['Premium padrão', 'eco'],
  prem_eco_comfort: ['Premium conforto', 'regional_biz'], prem_eco_luxury: ['Premium luxo', 'regional_biz'],
  biz_european: ['Executiva europeia', 'eco'], biz_regional: ['Executiva regional', 'regional_biz'],
  biz_full_flat: ['Cama plana', 'full_flat'], biz_staggered: ['Alternada', 'staggered'],
  biz_reverse_herringbone: ['Espinha invertida', 'reverse_herringbone'], biz_premium_herringbone: ['Espinha premium', 'reverse_herringbone'],
  biz_staggered_suite: ['Suíte alternada', 'staggered_suite'], biz_suite: ['Suíte executiva', 'suite'],
  biz_comfort_suite: ['Suíte conforto', 'suite'], biz_studio_suite: ['Suíte estúdio', 'studio_suite'], biz_wide_suite: ['Suíte ampla', 'wide_suite'],
  first_regional: ['Primeira regional', 'regional_first'], first_open_suite: ['Suíte aberta', 'open_suite'],
  first_private_suite: ['Suíte privativa', 'private_suite'], first_premium_suite: ['Suíte premium', 'private_suite'],
  first_diagonal_suite: ['Suíte diagonal', 'reverse_herringbone'], first_solo_suite: ['Suíte individual', 'wide_suite'],
  first_apartment: ['Apartamento', 'apartment'], first_room_suite: ['Suíte quarto', 'room_suite'],
}

export interface SeatModel {
  id: string; name: string; cabin: CabinClass; product: string; icon: string
  minPitch: number; maxPitch: number; fixedPitch: boolean; extraCost: number; width?: number; bedLength?: number
}

/** Preços, dimensões e produtos extraídos do módulo 671 do APK fornecido. */
export const SEAT_MODELS: SeatModel[] = CABINS.flatMap(c =>
  Object.entries(apk.products[APK_CLASS[c]]).map(([product, raw]) => {
    const data = raw as { pitch: number | string; width: number | string; price: number; bed_length?: number }
    const id = PREFIX[c] + product
    const fixedPitch = typeof data.pitch === 'number'
    return { id, name: LABELS[id][0], cabin: c, product, icon: LABELS[id][1],
      minPitch: fixedPitch ? data.pitch as number : ADJUSTABLE[c][0],
      maxPitch: fixedPitch ? data.pitch as number : ADJUSTABLE[c][1], fixedPitch,
      extraCost: data.price, width: typeof data.width === 'number' ? data.width : undefined, bedLength: data.bed_length }
  }))
export const SEAT_BY_ID = Object.fromEntries(SEAT_MODELS.map(m => [m.id, m]))
export const rowCount = (layout: string) => layout.split('-').reduce((n, part) => n + Number(part), 0)

/** Famílias presentes no APK; modelos adicionais usam a cabine de largura equivalente. */
export function seatFamily(t: AircraftType): Family {
  const id = t.id
  if (id.startsWith('a220') || ['b712', 'arj21', 'ssj100', 'sj100', 'an148', 'an158'].includes(id)) return 'A220'
  if (/^a3[12]/.test(id)) return 'A320'
  if (/^a3[34]/.test(id) || id === 'il96') return 'A330'
  if (id.startsWith('a35')) return 'A350'
  if (id === 'a388') return 'A380'
  if (/^b7[35]|^b3/.test(id) || ['c919', 'tu204'].includes(id)) return 'B737'
  if (id.startsWith('b74')) return 'B747'
  if (id.startsWith('b76')) return 'B767'
  if (id === 'b779') return 'B77X'
  if (id.startsWith('b77')) return 'B777'
  if (id.startsWith('b78')) return 'B787'
  if (id.startsWith('crj')) return 'CRJ'
  if (id.startsWith('erj')) return 'E135'
  if (t.family === 'turboprop') return 'ATR'
  return 'ERJ'
}

interface LayoutSpec { config: string; width?: number; pitch?: string }
function specs(t: AircraftType, c: CabinClass): Record<string, LayoutSpec> {
  return apk.aircraftSpecs[seatFamily(t)][APK_CLASS[c]] as Record<string, LayoutSpec>
}
export function baseAbreast(t: AircraftType, c: CabinClass) {
  const n = t.abreast
  return c === 'y' ? n : c === 'w' ? (n >= 9 ? n - 1 : n) : c === 'c' ? (n <= 4 ? 3 : n <= 6 ? 4 : 6) : (n <= 4 ? 2 : 4)
}
export function seatLayouts(t: AircraftType, c: CabinClass, style?: string): string[] {
  if (t.payload !== undefined) return []
  const model = SEAT_BY_ID[style ?? '']
  const configurations = specs(t, c)
  if (c === 'y') return [...new Set(Object.values(configurations).map(v => v.config).filter(v => v !== 'N/A'))]
  const value = configurations[model?.product ?? (c === 'w' ? 'basic' : 'regional')]?.config
  return value && value !== 'N/A' ? [value] : []
}
export const seatModelsFor = (t: AircraftType, c: CabinClass) =>
  SEAT_MODELS.filter(m => m.cabin === c && seatLayouts(t, c, m.id).length > 0)

export function normalizeSeats(t: AircraftType, config: SeatConfig | undefined, pitch?: Cabins): SeatConfig {
  const out: SeatConfig = {}
  for (const c of CABINS) {
    const previous = config?.[c]
    const choices = seatModelsFor(t, c)
    if (!choices.length) continue
    const defaults: Record<CabinClass, string> = { y: 'eco_standard', w: 'prem_eco_basic', c: 'biz_regional', f: 'first_regional' }
    const model = choices.find(m => m.id === previous?.style) ??
      (previous ? choices.filter(m => m.minPitch <= (pitch?.[c] ?? 100)).at(-1) : undefined) ??
      choices.find(m => m.id === defaults[c]) ?? choices[0]
    const layouts = seatLayouts(t, c, model.id)
    out[c] = { style: model.id, layout: previous && layouts.includes(previous.layout) ? previous.layout : layouts[0] }
  }
  return out
}

export function normalizeSeatPitch(pitch: Cabins, config: SeatConfig): Cabins {
  const out = { ...pitch }
  for (const c of CABINS) {
    const model = SEAT_BY_ID[config[c]?.style ?? '']
    if (model) out[c] = Math.max(model.minPitch, Math.min(model.maxPitch, Math.round(out[c])))
  }
  return out
}

/** A fórmula de getSeatRatings (função 17856) do APK, inclusive passo e densidade. */
export function apeloDaPoltrona(style?: string, pitch?: number, t?: AircraftType, layout?: string): number {
  const m = SEAT_BY_ID[style ?? '']
  if (!m) return 0
  const p = Math.max(m.minPitch, Math.min(m.maxPitch, Math.round(pitch ?? m.minPitch)))
  const configType = t && layout ? Object.entries(specs(t, 'y')).find(([, v]) => v.config === layout)?.[0] ?? 'standard' : 'standard'
  const configMult = (apk.ratings.eco.config_multiplier as Record<string, number>)[configType] ?? 1
  if (m.cabin === 'y') return (apk.ratings.eco.rating as Record<string, number>)[p] *
    (apk.ratings.eco.product_multiplier as Record<string, number>)[m.product] * configMult
  if (m.cabin === 'w') return (apk.ratings.premEco.rating as Record<string, number>)[m.product] *
    (apk.ratings.premEco.pitch_multiplier as Record<string, number>)[p] * (m.product === 'basic' ? configMult : 1)
  const source = m.cabin === 'c' ? apk.ratings.biz : apk.ratings.first
  return (source.rating as Record<string, number>)[m.product] *
    (m.product === 'regional' ? (source.regional_multiplier as Record<string, number>)[p] ?? 1 : 1)
}

// Faixas de normalização do APK (seatRatingsMinMax, função 671).
const RATING_RANGE: Record<CabinClass, [number, number]> = {
  y: [60 * .9 * .95, 80 * 1.1 * 1.05], w: [75 * .97 * .95, 95 * 1.07 * 1.05],
  c: [85 * .95, 115], f: [95 * .95, 130],
}
export function confortoDaPoltrona(style?: string, pitch?: number, t?: AircraftType, layout?: string): number {
  const m = SEAT_BY_ID[style ?? '']
  if (!m) return 0
  const [min, max] = RATING_RANGE[m.cabin]
  return Math.max(0, Math.min(1, (apeloDaPoltrona(style, pitch, t, layout) - min) / (max - min)))
}

export const custoDasPoltronas = (seats: Cabins, config?: SeatConfig) =>
  CABINS.reduce((n, c) => n + seats[c] * (SEAT_BY_ID[config?.[c]?.style ?? '']?.extraCost ??
    SEAT_MODELS.find(m => m.cabin === c)!.extraCost), 0)
export const TAXA_DE_REFORMA = 240000
export const seatChangeCost = (seats: Cabins, config?: SeatConfig) => TAXA_DE_REFORMA + custoDasPoltronas(seats, config)
export const custoDeFabrica = custoDasPoltronas
