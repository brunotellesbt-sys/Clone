export type CabinClass = 'y' | 'w' | 'c' | 'f'
export const CABINS: CabinClass[] = ['y', 'w', 'c', 'f']
export const CABIN_LABEL: Record<CabinClass, string> = {
  y: 'Econômica', w: 'Premium', c: 'Executiva', f: 'Primeira',
}
export const CABIN_SHORT: Record<CabinClass, string> = { y: 'Y', w: 'W', c: 'C', f: 'F' }

export type Cabins = Record<CabinClass, number>

/**
 * Desenho da pintura na fuselagem. Os sete primeiros são faixas; os oito
 * últimos são formas geométricas que ocupam a fuselagem de outro jeito —
 * cunha, diagonal, chevron, xadrez, blocos. Todos desenhados em coordenadas do
 * avião (`x0` e `planeW`), não da imagem, para caírem no mesmo lugar relativo
 * em qualquer modelo.
 */
export type CheatStyle =
  | 'none' | 'straight' | 'wide' | 'double' | 'wave' | 'split' | 'fade'
  | 'chevron' | 'delta' | 'diagonal' | 'ribbon' | 'triband' | 'checker'
  | 'billboard' | 'sunray'
export type TailStyle = 'solid' | 'stripes' | 'swoosh' | 'gradient' | 'split' | 'chevron'
export type NoseStyle = 'body' | 'dark' | 'custom'
export type TitleFont = 'sans' | 'wide' | 'serif' | 'mono'
/**
 * Emblema fictício aplicado sobre a deriva, além do desenho do `tailStyle`.
 * `'none'` é a única string com significado especial; o catálogo de verdade
 * é orientado a dados, em `src/livery/emblems.ts` (mesmo padrão do `id` de
 * aeronave), então o tipo aqui fica aberto em vez de enumerar cada opção.
 */
export type EmblemId = string

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
  /**
   * As três faixas horizontais da fuselagem: dorso (acima da fileira de
   * janela), cabine (a faixa das janelas) e ventre (abaixo da linha do motor).
   * As duas divisas são medidas por aeronave em `public/sprites/fusebands.json`.
   *
   * Nulo herda a cor principal, e é o padrão: pintadas sempre, as três cobririam
   * a fuselagem inteira e o seletor "Cor principal" perderia o efeito — a mesma
   * razão das três faixas da asa serem opcionais.
   */
  crown: string | null
  cabin: string | null
  lowerBody: string | null

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
  /**
   * Estabilizador horizontal, setor próprio. Na arte de foto ele só existe
   * desde que passou a ter máscara: antes saía com a cor da fuselagem, porque
   * `tailmasks` é a deriva e mais nada.
   */
  stab: string
  /** Emblema fictício sobre a deriva, além do `tailStyle`. */
  emblem: EmblemId
  emblemColor: string
  emblemAccent: string

  // ---- asa e motores
  wing: string
  /**
   * Bordo de ataque, dorso e bordo de fuga: setores próprios dentro da asa.
   * Nulo herda a cor da asa, que é o padrão — sem isso as três faixas cobririam
   * a asa inteira e o seletor "Asa" não teria mais efeito visível.
   */
  leadingEdge: string | null
  wingTop: string | null
  trailingEdge: string | null
  winglet: string
  /**
   * Nacela. Pinta só a **carenagem**: o bocal de escape, o plug e o fan ficam
   * com a cor da foto, porque são metal exposto e nenhuma companhia os pinta —
   * mesma razão do pneu e da pá de hélice.
   */
  engine: string
  /** Aro do bocal e cone, só no desenho vetorial. */
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
  /** Vidraça da cabine de comando. Nulo deixa a foto aparecer, como antes. */
  cockpit: string | null
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
  /** Toneladas embarcadas, só em rota de carga. */
  tons?: number
  /** Toneladas oferecidas, só em rota de carga — o denominador do load factor. */
  tonsOffered?: number
}

export interface Route {
  id: string
  from: string
  to: string
  distance: number
  aircraftIds: string[]
  /** Frequências por dia da semana (0 = domingo). */
  freq: number[]
  /**
   * Multiplicador de tarifa por classe (1 = tarifa de referência). Em rota de
   * carga só `y` é lido: é o multiplicador do frete por tonelada, e não há
   * classe nenhuma para as outras três representarem.
   */
  fare: Cabins
  /**
   * Rota de carga. Decidida na abertura, pela aeronave: cargueiro não tem
   * cabine, então a rota dele disputa o mercado de carga e não o de passageiro.
   * Ausente nas rotas antigas, que são todas de passageiro.
   */
  cargo?: boolean
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
