import type { AircraftType } from './data/aircraft'
import { CABINS, type CabinClass, type SeatConfig } from './types'

export interface SeatModel { id: string; name: string; cabin: CabinClass; icon: string; minPitch: number; extraCost: number; maxRow?: number }
// As imagens vêm do ZIP. Passos mínimos e custos são aproximações de balanceamento
// do Skyline; os dados comerciais do aplicativo antigo não estão no arquivo.
export const SEAT_MODELS: SeatModel[] = [
  { id: 'eco_super_slim', name: 'Super slim', cabin: 'y', icon: 'eco', minPitch: 28, extraCost: 0 },
  { id: 'eco_slim', name: 'Slim', cabin: 'y', icon: 'eco', minPitch: 29, extraCost: 100 },
  { id: 'eco_standard', name: 'Padrão', cabin: 'y', icon: 'eco', minPitch: 30, extraCost: 300 },
  { id: 'eco_comfort', name: 'Conforto', cabin: 'y', icon: 'eco', minPitch: 32, extraCost: 650 },
  { id: 'eco_luxury', name: 'Luxo', cabin: 'y', icon: 'eco', minPitch: 34, extraCost: 1000 },
  { id: 'prem_eco_basic', name: 'Premium básica', cabin: 'w', icon: 'eco', minPitch: 34, extraCost: 0 },
  { id: 'prem_eco_standard', name: 'Premium padrão', cabin: 'w', icon: 'eco', minPitch: 36, extraCost: 500 },
  { id: 'prem_eco_comfort', name: 'Premium conforto', cabin: 'w', icon: 'regional_biz', minPitch: 38, extraCost: 1000 },
  { id: 'prem_eco_luxury', name: 'Premium luxo', cabin: 'w', icon: 'regional_biz', minPitch: 40, extraCost: 2000 },
  { id: 'biz_european', name: 'Executiva europeia', cabin: 'c', icon: 'eco', minPitch: 38, extraCost: 0 },
  { id: 'biz_regional', name: 'Executiva regional', cabin: 'c', icon: 'regional_biz', minPitch: 40, extraCost: 1000 },
  { id: 'biz_full_flat', name: 'Cama plana', cabin: 'c', icon: 'full_flat', minPitch: 60, extraCost: 6000 },
  { id: 'biz_reverse_herringbone', name: 'Espinha invertida', cabin: 'c', icon: 'reverse_herringbone', minPitch: 72, extraCost: 10000, maxRow: 4 },
  { id: 'biz_premium_herringbone', name: 'Espinha premium', cabin: 'c', icon: 'reverse_herringbone', minPitch: 76, extraCost: 13000, maxRow: 4 },
  { id: 'biz_staggered', name: 'Alternada', cabin: 'c', icon: 'staggered', minPitch: 60, extraCost: 6000, maxRow: 4 },
  { id: 'biz_staggered_suite', name: 'Suíte alternada', cabin: 'c', icon: 'suite', minPitch: 66, extraCost: 10000 },
  { id: 'biz_suite', name: 'Suíte executiva', cabin: 'c', icon: 'suite', minPitch: 72, extraCost: 12000 },
  { id: 'biz_comfort_suite', name: 'Suíte conforto', cabin: 'c', icon: 'suite', minPitch: 74, extraCost: 14000 },
  { id: 'biz_studio_suite', name: 'Suíte estúdio', cabin: 'c', icon: 'studio_suite', minPitch: 76, extraCost: 16000, maxRow: 4 },
  { id: 'biz_wide_suite', name: 'Suíte ampla', cabin: 'c', icon: 'wide_suite', minPitch: 80, extraCost: 18000, maxRow: 4 },
  { id: 'first_regional', name: 'Primeira regional', cabin: 'f', icon: 'regional_first', minPitch: 60, extraCost: 0 },
  { id: 'first_open_suite', name: 'Suíte aberta', cabin: 'f', icon: 'open_suite', minPitch: 76, extraCost: 10000 },
  { id: 'first_private_suite', name: 'Suíte privativa', cabin: 'f', icon: 'private_suite', minPitch: 82, extraCost: 20000 },
  { id: 'first_premium_suite', name: 'Suíte premium', cabin: 'f', icon: 'private_suite', minPitch: 88, extraCost: 25000 },
  { id: 'first_diagonal_suite', name: 'Suíte diagonal', cabin: 'f', icon: 'reverse_herringbone', minPitch: 82, extraCost: 20000 },
  { id: 'first_solo_suite', name: 'Suíte individual', cabin: 'f', icon: 'wide_suite', minPitch: 90, extraCost: 30000, maxRow: 2 },
  { id: 'first_apartment', name: 'Apartamento', cabin: 'f', icon: 'apartment', minPitch: 94, extraCost: 40000, maxRow: 4 },
  { id: 'first_room_suite', name: 'Suíte quarto', cabin: 'f', icon: 'apartment', minPitch: 100, extraCost: 50000, maxRow: 2 },
]
export const SEAT_BY_ID = Object.fromEntries(SEAT_MODELS.map(m => [m.id, m]))
export const rowCount = (layout: string) => layout.split('-').reduce((n, part) => n + Number(part), 0)
const ROWS = ['1-1', '1-2', '2-1', '1-1-1', '2-2', '1-2-1', '2-3', '3-2', '2-1-2', '3-3', '2-2-2', '2-3-2', '2-4-2', '3-3-3', '3-4-3']
export function baseAbreast(t: AircraftType, c: CabinClass) {
  const n = t.abreast
  return c === 'y' ? n : c === 'w' ? (n >= 9 ? n - 1 : n) : c === 'c' ? (n <= 4 ? 3 : n <= 6 ? 4 : 6) : (n <= 4 ? 2 : 4)
}
export function seatLayouts(t: AircraftType, c: CabinClass, style?: string) {
  const max = Math.min(baseAbreast(t, c), SEAT_BY_ID[style ?? '']?.maxRow ?? 10)
  return ROWS.filter(r => rowCount(r) <= max && (t.abreast >= 7 || r.split('-').length <= 2))
}
export function normalizeSeats(t: AircraftType, config: SeatConfig | undefined): SeatConfig | undefined {
  if (!config || typeof config !== 'object') return undefined
  const out: SeatConfig = {}
  for (const c of CABINS) {
    const m = config[c]
    if (!m || SEAT_BY_ID[m.style]?.cabin !== c) continue
    const options = seatLayouts(t, c, m.style)
    out[c] = { style: m.style, layout: options.includes(m.layout) ? m.layout : options.at(-1)! }
  }
  return out
}
export function seatChangeCost(seats: Record<CabinClass, number>, config?: SeatConfig) {
  return 240000 + 2600 * seats.w + 34000 * seats.c + 90000 * seats.f +
    CABINS.reduce((n, c) => n + seats[c] * (SEAT_BY_ID[config?.[c]?.style ?? '']?.extraCost ?? 0), 0)
}
