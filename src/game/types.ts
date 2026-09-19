/**
 * Quantas concorrentes o mundo tem. Mora aqui, e não em `ai.ts`, porque o
 * estado salvo carrega a escolha — e `ai.ts` importa este arquivo: o tipo
 * descendo para cá é o que evita o ciclo.
 */
export type Densidade = 'enxuta' | 'media' | 'densa' | 'mundo'

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
 * Três degraus de tamanho, os mesmos para letreiro, emblema e prefixo.
 *
 * Três e não um controle contínuo porque a arte limita cada um à sua caixa — o
 * letreiro ao dorso, o emblema à largura da deriva — e num controle contínuo
 * metade do curso não mudava nada.
 */
export type PieceSize = 'small' | 'medium' | 'large'
/**
 * Emblema fictício aplicado sobre a deriva, além do desenho do `tailStyle`.
 * `'none'` é a única string com significado especial; o catálogo de verdade
 * é orientado a dados, em `src/livery/emblems.ts` (mesmo padrão do `id` de
 * aeronave), então o tipo aqui fica aberto em vez de enumerar cada opção.
 */
export type EmblemId = string

export interface PaintMark2D {
  text?: string
  file?: string
  font?: string
  color: string
  x: number
  y: number
  scale: number
  rotation: number
}
export interface Paint2D {
  layers?: Record<string, string | null>
  winglet?: string
  eyeMask?: boolean
  engine?: string
  marks?: Partial<Record<'primary' | 'secondary' | 'third' | 'alliance' | 'tail' | 'fuselage' | 'engine' | 'winglet', PaintMark2D>>
}

export type SeatConfig = Partial<Record<CabinClass, { style: string; layout: string }>>

/**
 * Pintura por peça. Cada campo corresponde a uma parte real da aeronave, para
 * que dê para montar uma livery de verdade em vez de faixas atravessando tudo.
 */
export interface Livery {
  v: 2
  /** Camadas e inscrições específicas de cada modelo importado. */
  aircraft2d?: Record<string, Paint2D>
  engine?: string

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
  /** Tamanho do emblema na deriva, em três degraus. */
  emblemSize: PieceSize

  // ---- bordos da asa
  /**
   * Bordo de ataque, dorso e bordo de fuga: as três faixas da asa, cada uma um
   * setor. Nulo deixa a asa como ela é na foto — que é o padrão, e o certo:
   * chapa de asa vai pintada de cinza de fábrica ou nada na maioria das
   * companhias, e é o que se vê olhando um pátio.
   *
   * **Motor e trem não estão aqui, e não é esquecimento.** Nacela, perna, roda
   * e hélice ficam com a cor de origem: a arte desenha a própria foto, opaca,
   * por cima delas. Pintá-las foi tentado de dois jeitos e nenhum convence —
   * cor chapada mata o torneado da nacela e deixa o trem com cara de brinquedo,
   * e o preto de borracha ainda recebia o borrão de sombra da foto por cima.
   */
  leadingEdge: string | null
  wingTop: string | null
  trailingEdge: string | null
  winglet: string

  // ---- texto
  titles: string
  titleFont: TitleFont
  /** Tamanho do letreiro como fração da altura da fuselagem. */
  titleSize: number
  /** Posição do letreiro ao longo da fuselagem (0 = nariz, 1 = cauda). */
  titleAt: number
  regColor: string
  showReg: boolean
  /** Tamanho do prefixo (matrícula) na traseira. */
  regSize: PieceSize
  /**
   * Bandeira do país onde a aeronave foi matriculada primeiro — na prática, o
   * país da base da companhia quando ela comprou o avião. Desenhada em vetor,
   * simplificada de propósito: ver `flags.ts`.
   */
  flag: boolean

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
  /**
   * País da **primeira** matrícula — o da base da companhia no dia da compra.
   * Guardado na aeronave, e não lido do hub atual, porque matrícula não muda
   * quando a companhia troca de base: é o que a bandeira na fuselagem diz.
   */
  cc: string
  seats: Cabins
  /** Passo de poltrona por classe, em polegadas. */
  pitch: Cabins
  /** Modelo da poltrona e distribuição dos blocos por classe. */
  seatConfig?: SeatConfig
  /** Idade em anos (fracionária). */
  age: number
  hours: number
  cycles: number
  /** 0–1; abaixo de 0.35 a confiabilidade começa a doer. */
  condition: number
  /**
   * Rota à qual a cauda está dedicada, ou nulo quando ela circula na malha.
   *
   * **É derivado da escala, não o contrário.** Vale a rota quando todas as
   * pernas da semana são dela; um avião que faz GIG–FOR, FOR–CGH e CGH–GIG não
   * pertence a rota nenhuma, e é justamente o caso que a malha existe para
   * permitir. `sincronizarMalha` recalcula isto depois de cada mudança.
   */
  routeId: string | null
  /**
   * Onde a aeronave dorme quando não tem escala nenhuma — a base da companhia
   * no dia da compra. É daí que a primeira perna dela pode sair.
   */
  base?: string
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

/**
 * Uma perna de voo marcada na grade semanal — a unidade da malha.
 *
 * A escala do jogo era uma lista de rotações de ida e volta presas a uma rota,
 * e por isso a aeronave nascia e morria no mesmo par de aeroportos. A perna é
 * só um trecho: de onde, para onde, que dia e a que horas. Quem encadeia as
 * pernas é a aeronave, e é isso que permite GIG–FOR, FOR–CGH e CGH–GIG na
 * mesma cauda, como qualquer companhia de verdade faz.
 */
export interface Perna {
  id: string
  aircraftId: string
  from: string
  to: string
  /** Dia da semana da **partida** (0 = domingo), na hora local da origem. */
  dow: number
  /** Hora local de partida na origem, em minutos depois da meia-noite. */
  saida: number
}

export interface Route {
  id: string
  from: string
  to: string
  distance: number
  /**
   * Caudas que voam este par na semana. **Derivado da escala**, mantido aqui
   * porque meia dúzia de telas e o estimador já liam daqui.
   */
  aircraftIds: string[]
  /** Partidas por sentido em cada dia da semana (0 = domingo). Derivado da escala. */
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
  /**
   * Formato antigo: horário de partida de cada rotação de ida e volta. Só
   * existe para migrar save de antes da malha, em `migrarEscala`.
   */
  horarios?: number[]
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
  routes: {
    key: string; from: string; to: string; seats: number; freq: number; fare: number; quality: number
    /**
     * Hora de partida, em minutos. A concorrente não tem escala de verdade —
     * as rotas dela são abstratas —, mas precisa de um horário para a disputa
     * ser simétrica: sem isso o jogador levava o desconto de madrugada e a IA
     * não levava nenhum. Ausente nas partidas antigas; `horaDaConcorrente`
     * completa com um valor estável tirado da chave da rota.
     */
    hora?: number
  }[]
  fleetSize: number
  revenue30: number
  /**
   * Dia de jogo em que a companhia foi fundada. As do mundo inicial já nascem
   * maduras, com um valor negativo que diz há quantos anos elas existem.
   *
   * É o que sustenta a progressão doméstica → regional → internacional: sem
   * saber a idade, uma companhia recém-fundada abria rota intercontinental na
   * primeira semana. Ausente nas partidas antigas; `idadeDe` trata isso como
   * "madura", porque é o que aquelas companhias sempre foram.
   */
  desde?: number
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
  /**
   * Códigos das concorrentes com acordo de interline.
   *
   * O voo delas que chega na sua base alimenta a sua partida, e vice-versa —
   * com o mesmo tempo mínimo de conexão e um desconto no valor, porque bagagem
   * que troca de companhia é pior que bagagem que segue na mesma. Ausente nas
   * partidas antigas, que não tinham acordo nenhum.
   */
  acordos?: string[]
  /**
   * A malha: todas as pernas da semana, de todas as aeronaves.
   *
   * Uma lista só, e não uma lista por rota ou por avião, porque as duas visões
   * que o jogo precisa mostrar — a grade da cauda e os voos de uma rota — são
   * recortes dela, e duas listas seriam duas verdades que saem de sincronia.
   * Ausente nas partidas antigas; `migrarEscala` monta a partir de `horarios`.
   */
  escala?: Perna[]
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
  /**
   * Em que ano de jogo cada país ganhou companhia nova. No máximo duas por
   * país, e o registro precisa sobreviver à gravação — senão, recarregar a
   * partida reabre a cota e o país ganha uma terceira.
   *
   * Ausente nas partidas antigas: `{}` é o valor certo para elas, porque
   * nenhuma delas fundou nada.
   */
  fundadas?: Record<string, number[]>
  /** Quantas concorrentes o jogador escolheu enfrentar na fundação. */
  densidade?: Densidade
  ledger: DayResult[]
  notices: Notice[]
  /** Fatia de mercado por par O&D, cacheada para a UI. */
  lastShare: Record<string, number>
  paused: boolean
  speed: number
  tutorialStep: number
}
