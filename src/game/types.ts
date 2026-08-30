export type CabinClass = 'y' | 'w' | 'c' | 'f'
export const CABINS: CabinClass[] = ['y', 'w', 'c', 'f']
export const CABIN_LABEL: Record<CabinClass, string> = {
  y: 'Econômica', w: 'Premium', c: 'Executiva', f: 'Primeira',
}
export const CABIN_SHORT: Record<CabinClass, string> = { y: 'Y', w: 'W', c: 'C', f: 'F' }

export type Cabins = Record<CabinClass, number>

export type CheatStyle = 'none' | 'straight' | 'wide' | 'double' | 'wave' | 'split' | 'fade'
export type TailStyle = 'solid' | 'stripes' | 'swoosh' | 'gradient' | 'split' | 'chevron'
export type NoseStyle = 'body' | 'dark' | 'custom'
export type TitleFont = 'sans' | 'wide' | 'serif' | 'mono'

/**
 * Pintura por peça. Cada campo corresponde a uma parte real da aeronave, para
 * que dê para montar uma livery de verdade em vez de faixas atravessando tudo.
 */
export interface Livery {
  v: 2

  // ---- fuselagem
  /** Cor principal da fuselagem. */
  fuselage: string
  /** Cor da barriga. */
  belly: string
  /** Onde a barriga começa: 0 no topo da fuselagem, 1 na base. */
  bellyAt: number
  /** Radome. */
  nose: string
  noseStyle: NoseStyle

  // ---- faixa
  cheat: string
  cheat2: string
  cheatStyle: CheatStyle
  /** Centro da faixa na altura da fuselagem (0 = topo, 1 = base). */
  cheatAt: number
  /** Espessura da faixa como fração da altura da fuselagem. */
  cheatWidth: number

  // ---- empenagem
  tail: string
  tailAccent: string
  tailStyle: TailStyle
  /** Estabilizador horizontal. */
  stab: string

  // ---- asa e motores
  wing: string
  winglet: string
  engine: string
  /** Aro do bocal e cone. */
  engineCowl: string
  gear: string

  // ---- texto
  titles: string
  titleFont: TitleFont
  /** Tamanho do letreiro como fração da altura da fuselagem. */
  titleSize: number
  /** Posição do letreiro ao longo da fuselagem (0 = nariz, 1 = cauda). */
  titleAt: number
  regColor: string
  showReg: boolean

  // ---- detalhes
  windows: boolean
  windowColor: string
  doors: boolean
}

/** Formato antigo, de duas versões atrás; só existe para migrar saves. */
export interface LiveryV1 {
  base: string
  belly: string
  cheat: string
  cheatStyle: string
  tail: string
  tailAccent: string
  tailStyle: string
  engine: string
  winglet: string
  titles: string
  titleFont: string
  windows: boolean
}

export interface Aircraft {
  id: string
  typeId: string
  /** Motorização instalada — muda consumo, oficina, alcance e pista. */
  engineId: string
  reg: string
  seats: Cabins
  /** Passo de poltrona por classe, em polegadas. */
  pitch: Cabins
  /** Idade em anos (fracionária). */
  age: number
  hours: number
  cycles: number
  /** 0–1; abaixo de 0.35 a confiabilidade começa a doer. */
  condition: number
  routeId: string | null
  leased: boolean
  /** Aluguel mensal, em dólares (0 se comprado). */
  lease: number
  /** Valor contábil atual, em dólares. */
  value: number
  /** Dias parados por manutenção pesada. */
  groundedUntil: number
}

export interface DayResult {
  day: number
  pax: Cabins
  flights: number
  seats: number
  revenue: number
  cost: number
  profit: number
  loadFactor: number
}

export interface Route {
  id: string
  from: string
  to: string
  distance: number
  aircraftIds: string[]
  /** Frequências por dia da semana (0 = domingo). */
  freq: number[]
  /** Multiplicador de tarifa por classe (1 = tarifa de referência). */
  fare: Cabins
  openedDay: number
  history: DayResult[]
}

export interface Loan {
  id: string
  principal: number
  balance: number
  rate: number
  takenDay: number
  termDays: number
}

export interface Competitor {
  id: string
  name: string
  code: string
  hub: string
  color: string
  cash: number
  reputation: number
  aggression: number
  routes: { key: string; from: string; to: string; seats: number; freq: number; fare: number; quality: number }[]
  fleetSize: number
  revenue30: number
}

export interface Airline {
  name: string
  code: string
  hubs: string[]
  livery: Livery
  reputation: number
  cash: number
  fleet: Aircraft[]
  routes: Route[]
  loans: Loan[]
  marketing: number
}

export interface Notice {
  day: number
  kind: 'info' | 'good' | 'bad'
  text: string
}

export interface GameState {
  version: number
  seed: number
  day: number
  startYear: number
  fuelPrice: number
  airline: Airline
  competitors: Competitor[]
  ledger: DayResult[]
  notices: Notice[]
  /** Fatia de mercado por par O&D, cacheada para a UI. */
  lastShare: Record<string, number>
  paused: boolean
  speed: number
  tutorialStep: number
}
