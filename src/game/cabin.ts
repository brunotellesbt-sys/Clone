// Configuração de cabine. Vale a mesma aritmética que uma companhia usa de
// verdade: a cabine tem um comprimento útil, cada classe tem um número de
// assentos por fileira, e cada fileira come o passo de poltrona escolhido.
// Passo maior rende tarifa e conforto e tira assento; passo menor faz o
// contrário. Por cima de tudo isso está o limite de saídas de emergência, que
// nenhuma configuração pode furar.
import type { AircraftType } from './data/aircraft'
import { CABINS, type CabinClass, type Cabins } from './types'

/** Passo de poltrona em polegadas: mínimo praticado, padrão e máximo. */
export const PITCH_RANGE: Record<CabinClass, [number, number, number]> = {
  y: [28, 31, 35],
  w: [34, 38, 42],
  c: [38, 60, 82],
  f: [60, 83, 100],
}

/** Como o passo se chama na prática, em cada classe. */
export function pitchName(cabin: CabinClass, inches: number): string {
  const [min, , max] = PITCH_RANGE[cabin]
  const f = (inches - min) / (max - min)
  if (cabin === 'y') return f < 0.25 ? 'ultradensa' : f < 0.6 ? 'padrão' : 'espaço extra'
  if (cabin === 'w') return f < 0.4 ? 'econômica plus' : 'premium de verdade'
  if (cabin === 'c') return f < 0.3 ? 'poltrona reclinável' : f < 0.72 ? 'angular-lie-flat' : 'cama plana'
  return f < 0.45 ? 'primeira doméstica' : 'suíte'
}

/** Assentos por fileira em cada classe, a partir da econômica do modelo. */
export function abreastOf(t: AircraftType, cabin: CabinClass): number {
  const n = t.abreast
  if (cabin === 'y') return n
  if (cabin === 'w') return n >= 9 ? n - 1 : n
  if (cabin === 'c') return n <= 4 ? 3 : n <= 6 ? 4 : 6
  return n <= 4 ? 2 : 4
}

/** Descrição da fileira: "3-3", "2-4-2", "1-2-1". */
export function rowLayout(t: AircraftType, cabin: CabinClass): string {
  const n = abreastOf(t, cabin)
  if (n <= 3) return n === 3 ? '2-1' : n === 2 ? '1-1' : `${n}`
  if (n === 4) return '2-2'
  if (n === 5) return '3-2'
  if (n === 6) return '3-3'
  if (n === 7) return '2-3-2'
  if (n === 8) return '2-4-2'
  if (n === 9) return '3-3-3'
  return '3-4-3'
}

/** Espaço perdido para galley, lavatório e saídas antes de qualquer poltrona. */
const MONUMENTS = 90
/** Divisória, galley e lavatório a cada classe adicional. */
const PER_CLASS = 34

/**
 * Comprimento útil de cabine, em polegadas, deduzido do comprimento externo.
 * Nariz e cone de cauda comem o resto; o convés de cima entra por fora.
 */
export function cabinLength(t: AircraftType): number {
  const s = t.shape
  const frac = s.prop ? 0.71 : t.family === 'regional' ? 0.6 : t.family === 'widebody' ? 0.72 : 0.76
  let m = s.length * frac
  // O convés de cima entra convertido: ele é mais estreito que o principal, e
  // um metro lá em cima vale menos assento do que um metro aqui embaixo.
  if (s.deck === 'hump') m += s.length * 0.13
  if (s.deck === 'double') m += s.length * 0.34
  return m * 39.3701
}

/** Comprimento ocupado por uma configuração, em polegadas. */
export function cabinUsed(t: AircraftType, seats: Cabins, pitch: Cabins): number {
  let used = MONUMENTS
  for (const c of CABINS) {
    if (seats[c] <= 0) continue
    used += Math.ceil(seats[c] / abreastOf(t, c)) * pitch[c] + PER_CLASS
  }
  return used - (sumSeats(seats) > 0 ? PER_CLASS : 0)
}

export const sumSeats = (s: Cabins) => s.y + s.w + s.c + s.f

/** Quantas fileiras cada classe ocupa. */
export const rowsOf = (t: AircraftType, seats: Cabins, c: CabinClass) =>
  Math.ceil(seats[c] / abreastOf(t, c))

export interface CabinCheck {
  used: number
  available: number
  seats: number
  limit: number
  overLength: boolean
  overLimit: boolean
  ok: boolean
}

export function checkCabin(t: AircraftType, seats: Cabins, pitch: Cabins): CabinCheck {
  const used = cabinUsed(t, seats, pitch)
  const available = cabinLength(t)
  const total = sumSeats(seats)
  const overLength = used > available + 0.5
  const overLimit = total > t.maxSeats
  return { used, available, seats: total, limit: t.maxSeats, overLength, overLimit, ok: !overLength && !overLimit }
}

/**
 * Quanto o passo escolhido vale em tarifa. Uma executiva com poltrona
 * reclinável de 38" não cobra o mesmo que uma cama plana de 80" — e é essa
 * diferença que decide se vale a pena tirar assento para dar espaço.
 */
export function pitchFare(cabin: CabinClass, inches: number): number {
  const [min, std, max] = PITCH_RANGE[cabin]
  const f = (inches - min) / (max - min)
  const fStd = (std - min) / (max - min)
  const swing = cabin === 'c' ? 0.76 : cabin === 'f' ? 0.62 : cabin === 'w' ? 0.42 : 0.4
  return Math.max(0.55, 1 + (f - fStd) * swing)
}

/** Conforto da cabine montada, ponderado pelos assentos de cada classe. */
export function cabinComfort(t: AircraftType, seats: Cabins, pitch: Cabins): number {
  const total = sumSeats(seats)
  if (total <= 0) return 1
  let acc = 0
  for (const c of CABINS) {
    if (seats[c] <= 0) continue
    const [min, std, max] = PITCH_RANGE[c]
    const f = (inches(pitch[c], min, max) - (std - min) / (max - min)) * (c === 'y' ? 0.34 : 0.2)
    acc += seats[c] * (1 + f)
  }
  return (acc / total) * (0.96 + 0.04 * t.abreast / 6)
}
const inches = (v: number, min: number, max: number) => (v - min) / (max - min)

// ------------------------------------------------------------------ layouts

export interface Layout {
  id: string
  name: string
  note: string
  build: (t: AircraftType) => { seats: Cabins; pitch: Cabins }
}

/** Preenche a econômica com tudo o que sobrar de cabine. */
function fill(t: AircraftType, seats: Cabins, pitch: Cabins): { seats: Cabins; pitch: Cabins } {
  const free = cabinLength(t) - cabinUsed(t, { ...seats, y: 0 }, pitch) - (seats.w + seats.c + seats.f > 0 ? PER_CLASS : 0)
  const rows = Math.max(0, Math.floor(free / pitch.y))
  const room = t.maxSeats - (seats.w + seats.c + seats.f)
  seats.y = Math.max(0, Math.min(rows * abreastOf(t, 'y'), room))
  return { seats, pitch }
}

const P = (y: number, w: number, c: number, f: number): Cabins => ({ y, w, c, f })

/** Assentos de uma classe, arredondados para fileira inteira. */
const seatsFor = (t: AircraftType, cabin: CabinClass, share: number) => {
  const ab = abreastOf(t, cabin)
  return Math.max(ab, Math.round((t.maxSeats * share) / ab) * ab)
}
const wide = (t: AircraftType) => t.family === 'widebody'

export const LAYOUTS: Layout[] = [
  {
    id: 'dense',
    name: 'Alta densidade',
    note: 'Uma classe só, no passo mínimo. Máximo de assento por avião; é como voa uma companhia de baixo custo.',
    build: (t) => fill(t, P(0, 0, 0, 0), P(29, 38, 60, 83)),
  },
  {
    id: 'lowcost',
    name: 'Baixo custo com frente',
    note: 'Econômica apertada e um punhado de fileiras com espaço extra, vendidas como assento pago.',
    build: (t) => fill(t, P(0, seatsFor(t, 'w', 0.09), 0, 0), P(29, 35, 60, 83)),
  },
  {
    id: 'domestic',
    name: 'Doméstico duas classes',
    note: 'O padrão de mercado doméstico: executiva reclinável na frente, econômica no passo normal.',
    build: (t) => fill(t, P(0, 0, seatsFor(t, 'c', wide(t) ? 0.1 : 0.09), 0), P(31, 38, 40, 83)),
  },
  {
    id: 'regional3',
    name: 'Regional três classes',
    note: 'Executiva reclinável, econômica premium e econômica — o que se usa em etapa média.',
    build: (t) =>
      fill(t, P(0, seatsFor(t, 'w', 0.1), seatsFor(t, 'c', wide(t) ? 0.11 : 0.08), 0), P(31, 37, 44, 83)),
  },
  {
    id: 'longhaul',
    name: 'Longo curso',
    note: 'Cama plana na executiva, premium de verdade e econômica no passo normal. Cabe menos gente e rende muito mais por assento.',
    build: (t) =>
      fill(t, P(0, seatsFor(t, 'w', wide(t) ? 0.09 : 0.08), seatsFor(t, 'c', wide(t) ? 0.13 : 0.1), 0), P(31, 38, 76, 83)),
  },
  {
    id: 'premium',
    name: 'Quatro classes',
    note: 'Com primeira classe em suíte. Só se sustenta em rota de prestígio, com demanda corporativa de sobra.',
    build: (t) =>
      fill(
        t,
        P(0, seatsFor(t, 'w', 0.09), seatsFor(t, 'c', wide(t) ? 0.16 : 0.12), abreastOf(t, 'f') * (wide(t) ? 2 : 1)),
        P(32, 38, 78, 92),
      ),
  },
]

export const LAYOUT_BY_ID = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]))

/**
 * Configuração de partida para um tipo, dado o "peso" premium da operação.
 * É a que o avião ganha ao entrar na frota.
 */
export function defaultCabin(t: AircraftType, premiumBias = 1): { seats: Cabins; pitch: Cabins } {
  const id =
    t.family === 'turboprop' || t.family === 'regional'
      ? premiumBias > 1.05 ? 'domestic' : 'dense'
      : t.family === 'narrowbody'
        ? premiumBias > 1.05 ? 'regional3' : 'domestic'
        : premiumBias > 1.1 ? 'premium' : 'longhaul'
  return LAYOUT_BY_ID[id].build(t)
}

export const DEFAULT_PITCH: Cabins = { y: 31, w: 38, c: 60, f: 83 }

export function clampPitch(pitch: Partial<Cabins> | undefined): Cabins {
  const out = { ...DEFAULT_PITCH }
  for (const c of CABINS) {
    const [min, , max] = PITCH_RANGE[c]
    const v = pitch?.[c]
    out[c] = typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : DEFAULT_PITCH[c]
  }
  return out
}

/** Comissários exigidos: um por 50 assentos, mais reforço para a cabine da frente. */
export const crewFor = (seats: Cabins) =>
  Math.max(1, Math.ceil(sumSeats(seats) / 50) + Math.ceil((seats.c + seats.f) / 18))
