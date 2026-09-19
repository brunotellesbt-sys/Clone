import { baseAbreast, confortoDaPoltrona, rowCount, SEAT_BY_ID, seatLayouts } from './seatModels'
// Configuração de cabine. Vale a mesma aritmética que uma companhia usa de
// verdade: a cabine tem um comprimento útil, cada classe tem um número de
// assentos por fileira, e cada fileira come o passo de poltrona escolhido.
// Passo maior rende tarifa e conforto e tira assento; passo menor faz o
// contrário. Por cima de tudo isso está o limite de saídas de emergência, que
// nenhuma configuração pode furar.
import type { AircraftType } from './data/aircraft'
import { CABIN_LABEL, CABINS, type CabinClass, type Cabins, type SeatConfig } from './types'

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
export function abreastOf(t: AircraftType, cabin: CabinClass, config?: SeatConfig): number {
  const setting = config?.[cabin]
  return setting && seatLayouts(t, cabin, setting.style).includes(setting.layout)
    ? rowCount(setting.layout) : baseAbreast(t, cabin)
}

/** Descrição da fileira: "3-3", "2-4-2", "1-2-1". */
export function rowLayout(t: AircraftType, cabin: CabinClass, config?: SeatConfig): string {
  const setting = config?.[cabin]
  if (setting && seatLayouts(t, cabin, setting.style).includes(setting.layout)) return setting.layout
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

/**
 * Espaço perdido para galley, lavatório e saídas antes de qualquer poltrona.
 *
 * Ele entra **dos dois lados** da conta — soma no comprimento da cabine em
 * `cabinLength` e é descontado em `cabinUsed` —, de modo que o espaço
 * disponível para poltrona é exatamente o bloco do certificado. Mudar este
 * número sozinho não muda quantos assentos cabem; ele existe para a barra de
 * ocupação na tela ter o mesmo denominador que uma planta de cabine real.
 */
const MONUMENTS = 90
/** Divisória, galley e lavatório a cada classe adicional. */
const PER_CLASS = 34

/**
 * Passo de uma cabine de alta densidade de verdade, em polegadas.
 *
 * Não é o mínimo teórico do jogo (28″): é o que as companhias de alta densidade
 * praticam — Ryanair voa o 737-800 a 30″, a easyJet o A320 a 29″, a Spirit o
 * A321 a 28″. Vinte e nove é o meio desse intervalo.
 */
const PASSO_DENSO = 29

/**
 * Comprimento útil de cabine, em polegadas.
 *
 * ## Por que não sai mais da fuselagem
 *
 * Saía: era uma fração do comprimento externo por família — 0,60 para regional,
 * 0,76 para narrowbody. Duas coisas estavam erradas nisso, e a segunda é a que
 * doía:
 *
 * 1. **fração de comprimento não descreve avião esticado.** Esticar uma
 *    fuselagem acrescenta cabine, não nariz: o E195-E2 tem 41,5 m, mais que um
 *    737-700, e era medido com a régua de jato regional pequeno;
 * 2. **os monumentos eram pequenos demais.** `MONUMENTS` vale 90″, 2,29 m, para
 *    galley, lavatório e portas do avião inteiro. Um 737-800 tem cabine de
 *    29,97 m e leva 189 passageiros a 30″ — o bloco de poltronas é 24,4 m, logo
 *    o que **não** é poltrona ocupa 5,5 m, não 2,3.
 *
 * O resultado composto era o defeito relatado: duas classes num E195-E2 davam
 * 100 assentos, e a Azul voa o mesmo avião com 136.
 *
 * ## De onde sai agora
 *
 * De dado publicado, e só dele. `maxSeats` é o limite de saídas de emergência —
 * ficha do fabricante — e `abreast` é a fileira da econômica. Os dois juntos
 * descrevem **a configuração mais densa que o avião é certificado a levar**, e
 * o comprimento dessa configuração é o comprimento da cabine:
 *
 *     cabine = monumentos + fileiras do certificado × passo de alta densidade
 *
 * Nenhuma fração escolhida a dedo, nenhuma família: dois números de ficha e um
 * passo que existe no mundo. O efeito de a cabine ser derivada do certificado é
 * o que se quer — a classe única **passa um pouco** do limite de saídas (198
 * contra 189 no 737-800), e daí em diante quem manda é o certificado, que é a
 * regra certa.
 *
 * ## Conferido contra configurações reais de duas classes
 *
 * Três fileiras de premium a 38″ e o resto econômica a 31″, que é o padrão de
 * mercado — medido pelo `npm run cabines`, que guarda esta tabela como trava:
 *
 * | avião | jogo | real |
 * |---|---|---|
 * | 737-800 | 168 | 160–172 |
 * | A320neo | 174 | 150–175 |
 * | E195-E2 | 128 | 136 (Azul) |
 * | A321neo | 216 | 182 (Turkish) a 215 (Lufthansa) |
 *
 * Fica no teto da faixa, e isso é escolha: o jogo cobra uma divisória por
 * classe que a planta real distribui melhor, e errar para baixo foi o defeito
 * que trouxe até aqui.
 *
 * ## A simplificação que isto assume
 *
 * Dois aviões com o mesmo limite de saídas ganham a mesma cabine, mesmo com
 * comprimentos diferentes — o A330-300 e o A350-900 são os dois certificados
 * para 440. É defensável: o certificado **é** a densidade máxima, então dois
 * aviões certificados para o mesmo número realmente levam o mesmo número. O
 * que a fuselagem mais comprida daria é conforto no mesmo número de gente, e
 * isso o jogo já modela pelo passo.
 *
 * O preço dessa escolha é que um `maxSeats` errado deixou de ser detalhe de
 * ficha e passou a ser a cabine. Foi assim que o A340-600 apareceu com os 440
 * do -300, sendo 11,7 m mais comprido e certificado para 475 — e é por isso que
 * `npm run cabines` agora mede o limite contra o tamanho do avião.
 *
 * Cargueiro não tem cabine — `maxSeats` é 0 —, e aí o valor não é usado por
 * conta nenhuma; devolve zero em vez de fingir um número.
 */
export function cabinLength(t: AircraftType): number {
  if (t.maxSeats <= 0 || t.abreast <= 0) return 0
  return MONUMENTS + Math.ceil(t.maxSeats / t.abreast) * PASSO_DENSO
}

/** Comprimento ocupado por uma configuração, em polegadas. */
export function cabinUsed(t: AircraftType, seats: Cabins, pitch: Cabins, config?: SeatConfig): number {
  let used = MONUMENTS
  for (const c of CABINS) {
    if (seats[c] <= 0) continue
    used += Math.ceil(seats[c] / abreastOf(t, c, config)) * pitch[c] + PER_CLASS
  }
  return used - (sumSeats(seats) > 0 ? PER_CLASS : 0)
}

export const sumSeats = (s: Cabins) => s.y + s.w + s.c + s.f

/** Quantas fileiras cada classe ocupa. */
export const rowsOf = (t: AircraftType, seats: Cabins, c: CabinClass, config?: SeatConfig) =>
  Math.ceil(seats[c] / abreastOf(t, c, config))

/**
 * Que classes a aeronave comporta, por família.
 *
 * Não é balanceamento, é o que existe: um turboélice de linha voa em classe
 * única — não há Dash 8 nem ATR com executiva de verdade, e o que as
 * companhias vendem como "conforto" ali é a mesma poltrona com uma fileira
 * vazia ao lado. Regional e corredor único chegam à executiva e param: 737 e
 * A320 têm executiva doméstica, e **primeira classe não existe** em
 * narrowbody. Primeira é de fuselagem larga, onde há largura para a suíte.
 *
 * Isto é a porteira única: `limiteDaClasse` devolve zero para classe barrada,
 * então o padrão do catálogo, o controle da tela, a trava de capacidade e a
 * cabine de fábrica passam todos por aqui sem cada um ter a própria regra.
 */
const FAMILIA_LABEL: Record<AircraftType['family'], string> = {
  turboprop: 'turboélice', regional: 'jato regional', narrowbody: 'corredor único',
  widebody: 'fuselagem larga', freighter: 'cargueiro',
}

const CLASSES_POR_FAMILIA: Record<AircraftType['family'], CabinClass[]> = {
  turboprop: ['y'],
  regional: ['y', 'w', 'c'],
  narrowbody: ['y', 'w', 'c'],
  widebody: ['y', 'w', 'c', 'f'],
  freighter: [],
}

export const classesDe = (t: AircraftType): CabinClass[] =>
  CLASSES_POR_FAMILIA[t.family] ?? ['y', 'w', 'c']

export const comportaClasse = (t: AircraftType, c: CabinClass) => classesDe(t).includes(c)

/** A regra de classes em uma frase, para a tela dizer por que falta classe. */
export function textoDasClasses(t: AircraftType): string {
  if (t.family === 'turboprop') {
    return 'Turboélice de linha voa em classe única: não há executiva nem premium para montar aqui.'
  }
  if (t.family === 'widebody') return 'Fuselagem larga é a única que comporta primeira classe.'
  return 'Corredor único e jato regional vão até a executiva — primeira classe é de fuselagem larga.'
}

/**
 * Quantos assentos a classe `c` ainda pode receber, dadas as outras.
 *
 * É a trava dura. Antes o controle ia até `maxSeats` em toda classe, e o jogo
 * só reclamava na hora de aplicar — dava para arrastar quatro classes até o
 * talo, ver "não cabe" e ter que desfazer tudo no tato. Dizer não depois de
 * deixar tentar é a pior das duas respostas: o controle que não pode ir até lá
 * simplesmente não vai.
 *
 * Dois limites, e vale o menor: o comprimento que sobra de cabine e o limite de
 * saídas. O de cabine é arredondado **para baixo, em fileira inteira**, porque
 * meia fileira não existe.
 */
export function limiteDaClasse(
  t: AircraftType, seats: Cabins, pitch: Cabins, c: CabinClass, config?: SeatConfig,
): number {
  const ab = abreastOf(t, c, config)
  if (ab <= 0 || !comportaClasse(t, c)) return 0
  const outras = { ...seats, [c]: 0 }
  // o que sobra depois das outras classes, já descontada a divisória que esta
  // classe passa a exigir quando deixa de ser vazia
  const sobra = cabinLength(t) - cabinUsed(t, outras, pitch, config) -
    (sumSeats(outras) > 0 ? PER_CLASS : 0)
  const porCabine = Math.max(0, Math.floor(sobra / pitch[c])) * ab
  const porSaidas = Math.max(0, t.maxSeats - sumSeats(outras))
  return Math.min(porCabine, porSaidas)
}

/**
 * Até que passo a classe `c` pode ir sem estourar a cabine.
 *
 * O mesmo princípio dos assentos, do outro lado da conta: com as fileiras já
 * postas, esticar o passo é o que estoura. Quem quiser mais espaço tira
 * assento primeiro — que é exatamente a decisão que a tela existe para cobrar.
 */
export function passoMaximo(
  t: AircraftType, seats: Cabins, pitch: Cabins, c: CabinClass, config?: SeatConfig,
): number {
  const [min, , max] = PITCH_RANGE[c]
  const fileiras = rowsOf(t, seats, c, config)
  if (seats[c] <= 0 || fileiras <= 0) return max
  const outras = { ...seats, [c]: 0 }
  const sobra = cabinLength(t) - cabinUsed(t, outras, pitch, config) -
    (sumSeats(outras) > 0 ? PER_CLASS : 0)
  return Math.max(min, Math.min(max, Math.floor(sobra / fileiras)))
}

/**
 * Põe `desejado` assentos na classe `c`, tirando da econômica o que faltar.
 *
 * A trava dura sozinha tem um efeito ruim que só aparece usando: partindo de
 * uma cabine de classe única, a econômica ocupa tudo e as outras três mostram
 * "cabem 0" — para pôr uma executiva o jogador precisa primeiro adivinhar
 * quanta econômica tirar, no tato, antes de poder mexer no que ele queria.
 *
 * A econômica é a classe que cede, e isso não é invenção da interface: é o que
 * os próprios padrões fazem em `fill`, e o que uma companhia faz de verdade —
 * a cabine da frente é especificada, e a econômica ocupa o que sobrar.
 *
 * O que **não** muda: nada passa do que cabe. Se nem zerando a econômica a
 * classe couber, ela para no máximo possível.
 */
export function ajustarClasse(
  t: AircraftType, seats: Cabins, pitch: Cabins, c: CabinClass, desejado: number,
  config?: SeatConfig,
): Cabins {
  const ab = abreastOf(t, c, config)
  const alvo = Math.max(0, Math.round(desejado))
  const out = { ...seats }
  if (c === 'y' || alvo <= limiteDaClasse(t, seats, pitch, c, config)) {
    out[c] = Math.min(alvo, limiteDaClasse(t, seats, pitch, c, config))
    return out
  }
  // Tira da econômica, de fileira em fileira, só até o alvo caber.
  const abY = abreastOf(t, 'y', config)
  out[c] = alvo
  while (out.y > 0) {
    out.y = Math.max(0, out.y - abY)
    if (limiteDaClasse(t, out, pitch, c, config) >= alvo) break
  }
  out[c] = Math.max(0, Math.floor(limiteDaClasse(t, out, pitch, c, config) / ab) * ab)
  out[c] = Math.min(alvo, out[c])
  // devolve à econômica o que sobrou da conta, para não cortar mais que o necessário
  out.y = Math.min(out.y + limiteDaClasse(t, out, pitch, 'y', config), limiteDaClasse(t, { ...out, y: 0 }, pitch, 'y', config))
  return out
}

export interface CabinCheck {
  used: number
  available: number
  seats: number
  limit: number
  overLength: boolean
  overLimit: boolean
  invalid: boolean
  seatError?: string
  ok: boolean
}

export function checkCabin(t: AircraftType, seats: Cabins, pitch: Cabins, config?: SeatConfig): CabinCheck {
  const used = cabinUsed(t, seats, pitch, config)
  const available = cabinLength(t)
  const total = sumSeats(seats)
  const overLength = used > available + 0.5
  const overLimit = total > t.maxSeats
  const invalid = CABINS.some(c => !Number.isInteger(seats[c]) || seats[c] < 0 || !Number.isFinite(pitch[c]) || pitch[c] < PITCH_RANGE[c][0] || pitch[c] > PITCH_RANGE[c][2]) || total <= 0 || t.abreast <= 0
  let seatError: string | undefined
  /**
   * Classe que a família não comporta é erro, não aviso.
   *
   * A tela já não oferece o controle, mas a trava mora aqui porque `setCabin`
   * é chamado com o que vier — save antigo, cabine guardada de outro modelo,
   * encomenda de fábrica montada antes desta regra existir. Quem barra é uma
   * porteira só.
   */
  for (const c of CABINS) {
    if (seats[c] > 0 && !comportaClasse(t, c)) {
      seatError = `${CABIN_LABEL[c]} não existe num ${FAMILIA_LABEL[t.family]}.`
    }
  }
  for (const c of CABINS) {
    const setting = config?.[c]
    if (!setting || seats[c] === 0) continue
    const model = SEAT_BY_ID[setting.style]
    if (!model || model.cabin !== c || !seatLayouts(t, c, setting.style).includes(setting.layout)) seatError = 'Distribuição incompatível com a poltrona ou largura da cabine.'
    else if (pitch[c] < model.minPitch) seatError = `${model.name} exige passo de pelo menos ${model.minPitch}″.`
  }
  return { used, available, seats: total, limit: t.maxSeats, overLength, overLimit, invalid, seatError, ok: !overLength && !overLimit && !invalid && !seatError }
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
/**
 * Peso da poltrona no conforto, ao lado do passo.
 *
 * Menor que o do passo de propósito: espaço para a perna é o que o passageiro
 * sente primeiro, e nenhuma suíte compensa uma fileira apertada. Mas não é
 * pequeno — trocar Super slim por Luxo na econômica vale tanto quanto três
 * polegadas de passo, que é a ordem de grandeza certa.
 */
const PESO_POLTRONA = 0.22

export function cabinComfort(
  t: AircraftType, seats: Cabins, pitch: Cabins, config?: SeatConfig,
): number {
  const total = sumSeats(seats)
  if (total <= 0) return 1
  let acc = 0
  for (const c of CABINS) {
    if (seats[c] <= 0) continue
    const [min, std, max] = PITCH_RANGE[c]
    const f = (inches(pitch[c], min, max) - (std - min) / (max - min)) * (c === 'y' ? 0.34 : 0.2)
    // A poltrona escolhida entra aqui. Ver `confortoDaPoltrona`: o catálogo já
    // cobrava por ela, e até agora ela não mudava nada na simulação.
    const poltrona = PESO_POLTRONA * confortoDaPoltrona(config?.[c]?.style)
    acc += seats[c] * (1 + f + poltrona)
  }
  return (acc / total) * (0.96 + 0.04 * t.abreast / 6)
}
const inches = (v: number, min: number, max: number) => (v - min) / (max - min)

// ------------------------------------------------------------------ layouts

export interface Layout {
  id: string
  name: string
  note: string
  /**
   * As classes da frente que o padrão existe para montar.
   *
   * Sem isto, "Longo curso" aparecia num ATR — e como `fill` apara a classe
   * que a família não comporta, ele montava a mesma cabine de classe única que
   * "Alta densidade", com outro nome. Seis botões para três cabines iguais não
   * é escolha, é ruído.
   */
  exige: CabinClass[]
  build: (t: AircraftType) => { seats: Cabins; pitch: Cabins }
}

/**
 * Monta um padrão: as classes da frente aparadas ao que cabe, e a econômica
 * preenchendo o resto.
 *
 * A versão anterior dimensionava a frente por fração de `maxSeats` sem
 * perguntar se cabia, e só a econômica era aparada. Passava despercebido
 * enquanto a cabine era generosa; com ela derivada do certificado, "Quatro
 * classes" num Dash 8 Q200 pedia 11,3 m numa cabine de 9,7 m — o padrão do
 * próprio jogo saía inválido, e `npm run cabines` marcava com `!` um erro que
 * ninguém ia caçar.
 *
 * Agora cada classe da frente passa pela mesma trava que o jogador tem na
 * tela, da mais cara para a mais barata: quem não couber inteira entra no
 * tamanho que couber, e some quando não couber nenhuma fileira. Um turboélice
 * não tem "quatro classes", e o padrão passa a dizer isso em vez de mentir.
 */
function fill(t: AircraftType, alvos: Cabins, pitch: Cabins): { seats: Cabins; pitch: Cabins } {
  let seats: Cabins = { y: 0, w: 0, c: 0, f: 0 }
  for (const c of ['f', 'c', 'w'] as const) {
    // classe que a família não comporta nem é tentada: um turboélice com
    // "quatro classes" no catálogo era o padrão do jogo mentindo
    if (alvos[c] <= 0 || !comportaClasse(t, c)) continue
    const ab = abreastOf(t, c)
    const cabe = Math.floor(limiteDaClasse(t, seats, pitch, c) / ab) * ab
    seats[c] = Math.max(0, Math.min(alvos[c], cabe))
  }
  seats = ajustarClasse(t, seats, pitch, 'y', t.maxSeats)
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
    exige: [],
    name: 'Alta densidade',
    note: 'Uma classe só, no passo mínimo. Máximo de assento por avião; é como voa uma companhia de baixo custo.',
    build: (t) => fill(t, P(0, 0, 0, 0), P(29, 38, 60, 83)),
  },
  {
    id: 'lowcost',
    exige: ['w'],
    name: 'Baixo custo com frente',
    note: 'Econômica apertada e um punhado de fileiras com espaço extra, vendidas como assento pago.',
    build: (t) => fill(t, P(0, seatsFor(t, 'w', 0.09), 0, 0), P(29, 35, 60, 83)),
  },
  {
    id: 'domestic',
    exige: ['c'],
    name: 'Doméstico duas classes',
    note: 'O padrão de mercado doméstico: executiva reclinável na frente, econômica no passo normal.',
    /**
     * Sete por cento de executiva a 38″, e não nove a 40″.
     *
     * Medido contra a capacidade publicada de dez modelos (`npm run cabines`):
     * com 9% a 40″ o padrão saía 5,4% abaixo do que o fabricante publica, e no
     * 737 MAX 8 chegava a 13% — o jogo montava 154 onde a Boeing publica 178.
     * A cabine não estava curta; a executiva é que estava grande demais. Um
     * 737 de duas classes tem três fileiras de executiva, não quatro, e o passo
     * dela é 38″.
     */
    build: (t) => fill(t, P(0, 0, seatsFor(t, 'c', wide(t) ? 0.1 : 0.07), 0), P(31, 38, 38, 83)),
  },
  {
    id: 'regional3',
    exige: ['w', 'c'],
    name: 'Regional três classes',
    note: 'Executiva reclinável, econômica premium e econômica — o que se usa em etapa média.',
    build: (t) =>
      fill(t, P(0, seatsFor(t, 'w', 0.1), seatsFor(t, 'c', wide(t) ? 0.11 : 0.08), 0), P(31, 37, 44, 83)),
  },
  {
    id: 'longhaul',
    exige: ['w', 'c'],
    name: 'Longo curso',
    note: 'Cama plana na executiva, premium de verdade e econômica no passo normal. Cabe menos gente e rende muito mais por assento.',
    build: (t) =>
      fill(t, P(0, seatsFor(t, 'w', wide(t) ? 0.09 : 0.08), seatsFor(t, 'c', wide(t) ? 0.13 : 0.1), 0), P(31, 38, 76, 83)),
  },
  {
    id: 'premium',
    exige: ['w', 'c', 'f'],
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

/** Os padrões que fazem sentido nesta aeronave. Ver `Layout.exige`. */
export const layoutsDe = (t: AircraftType) =>
  LAYOUTS.filter((l) => l.exige.every((c) => comportaClasse(t, c)))

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
