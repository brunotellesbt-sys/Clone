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

/**
 * Tempo de porta a porta de uma etapa, em horas.
 *
 * O termo de cruzeiro é a distância pela velocidade do modelo. O outro é o que
 * não depende de distância nenhuma: táxi nas duas pontas, subida e descida
 * fora da velocidade de cruzeiro, espera de sequenciamento.
 *
 * **Os dezenove minutos são calibrados**, e contra tempos que o dono do jogo
 * ditou para a ponte aérea do Sudeste:
 *
 * | trecho | nm | pedido | o jogo dá |
 * |---|---|---|---|
 * | GIG–GRU | 182 | 40 min | 43 |
 * | SDU–GRU | 185 | 40 min | 43 |
 * | GIG–CGH | 194 | 45 min | 44 |
 * | SDU–CGH | 197 | 45 min | 45 |
 * | GIG–VCP | 215 | 50 min | 47 |
 * | SDU–VCP | 220 | 50 min | 48 |
 *
 * A calibração é **pela média**, como pedido: 199 nm dão 45 minutos redondos.
 * Casar os seis exatamente é impossível sem quebrar o modelo — entre 182 e 220
 * nm os tempos pedidos sobem dez minutos, uma inclinação de 228 kt marginais,
 * enquanto a média desses mesmos pontos pede 390 kt. Uma reta pelos seis tem
 * intercepto **negativo**, e num trecho de 50 nm ela daria cinco minutos de
 * voo. Ficam os 45 no meio e a diferença nas pontas, de dois a três minutos.
 *
 * Eram 27 minutos, e é por isso que SDU–CGH saía com 53. O corte de oito
 * minutos pesa 15% numa etapa de 200 nm e 1% numa de doze horas, que é
 * exatamente onde ele devia pesar.
 */
export const TAXI_E_MANOBRA = 19 / 60

export const blockHours = (t: AircraftType, distNm: number) => distNm / t.speed + TAXI_E_MANOBRA

/**
 * O que a madrugada cobra a mais, por unidade de fração noturna.
 *
 * São dois custos diferentes e por isso dois números: o adicional de
 * tripulação incide na folha, a sobretaxa de ruído incide na taxa de pouso.
 * Nenhum dos dois é grande o bastante para proibir voo noturno — o objetivo é
 * que a madrugada seja uma **escolha** com os dois lados na conta, não um
 * desconto de receita que sai de graça.
 */
export const ADICIONAL_NOTURNO = 0.18
export const SOBRETAXA_RUIDO = 0.5

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

/**
 * Fator de jogo: os custos reais deixariam quase toda rota no zero a zero.
 *
 * Subiu de 0,82 para 0,85 junto com o conserto do handling e da tarifa curta.
 * Aqueles dois foram feitos para a etapa regional, e a etapa regional é onde
 * eles pesam — mas alguma coisa sobrava também no resto da malha, e oito anos
 * de simulação fechavam 12% mais ricos do que antes. Os três pontos aqui
 * devolvem essa sobra sem desfazer o conserto: na rota curta o ganho era muito
 * maior que 4%.
 */
const COST_TUNING = 0.85

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
  /** Fração das rotações que sai na madrugada; ver `FATOR_NOTURNO`. */
  noturno = 0,
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
  /**
   * Voo de madrugada custa mais tripulação: adicional noturno em folha, jornada
   * que conta diferente e, quando a volta não fecha no dia, pernoite fora de
   * base. O jogo tinha metade dessa conta — o horário mexia na procura e não
   * mexia no custo, o que fazia a madrugada parecer só um desconto de receita.
   */
  const crew = (pilots + crewCount * 160) * blockH * (1 + ADICIONAL_NOTURNO * noturno)

  const ageFactor = 0.86 + 0.045 * Math.min(age, 28)
  const maintenance = t.maint * (420 + t.price * 11) * blockH * ageFactor

  // Taxa de pouso e handling vão pelo **porte**, não pelo assento. Num
  // cargueiro `maxSeats` é 0, e sem isto a rota de carga sairia sem custo
  // nenhum de aeroporto. Uma tonelada de carga paga ocupa o lugar de cerca de
  // dez assentos em peso, que é a régua usada aqui.
  const porte = t.maxSeats || (t.payload ?? 0) * 10
  const landing = (tier: number) => (1.4 + 0.5 * tier) * porte * 2.2
  /**
   * Sobretaxa de ruído. Aeroporto grande cobra mais caro para pousar de
   * madrugada, e cobra em cima da taxa de pouso — Frankfurt, Heathrow e Paris
   * têm tabela noturna que chega a dobrar a faixa. Aqui vale meio a mais, e só
   * nos degraus altos, que é onde a vizinhança reclama.
   */
  const ruido = 1 + SOBRETAXA_RUIDO * noturno
  const fees = (landing(a.tier) * (a.tier >= 3 ? ruido : 1)
    + landing(b.tier) * (b.tier >= 3 ? ruido : 1))
    + pax * (4.5 + 0.8 * ((a.tier + b.tier) / 2))
  /**
   * Handling: rampa, escada, bagagem, limpeza, água, esgoto, push-back.
   *
   * Era `700 + 5,5 × porte`, e os 700 fixos não têm defesa: eles cobravam de um
   * turboélice de 48 lugares quase o mesmo que de um 777 pelo serviço de pátio,
   * quando o que se paga ali é equipe e equipamento — e um ATR não usa nem
   * ponte, nem esteira, nem trator de push-back. Numa etapa de meia hora esses
   * 700 eram 27% do custo do voo, e era o que sozinho matava a rota regional.
   *
   * A troca por `200 + 6,5 × porte` mantém o avião grande onde ele estava (um
   * 777 paga 1% a mais) e devolve ao pequeno o que nunca foi dele: o ATR 42
   * paga 47% menos.
   */
  const handling = 200 + 6.5 * porte
  const catering = (pax - premiumPax) * (2 + 0.0022 * distNm) + premiumPax * (16 + 0.013 * distNm)

  const total = (fuel + crew + maintenance + fees + handling + catering) * COST_TUNING
  return { fuel, crew, maintenance, fees, handling, catering, total, blockH }
}

/** Comissões, GDS, cartão: sai de cima da receita. */
export const DISTRIBUTION_RATE = 0.085

/** Nem todo assento é vendável: horário errado, no-show, desequilíbrio de sentido. */
/**
 * Teto de ocupação de um cargueiro. Mais alto que o do passageiro (0,9) porque
 * carga se acomoda: palete de tamanhos diferentes fecha o porão melhor do que
 * gente fecha uma cabine. Ainda não é 1 — porão cheio de volume leve estoura o
 * espaço antes do peso.
 */
export const CARGO_SELLABLE = 0.94

export const SELLABLE = 0.9

export interface Carrier {
  id: string
  seats: Cabins
  freq: number
  fareMult: number
  quality: number
}

export interface CargoCarrier {
  id: string
  /** Toneladas oferecidas por dia. */
  tons: number
  freq: number
  rateMult: number
  quality: number
}

export interface CargoAllocation {
  id: string
  tons: number
  share: number
}

/**
 * Reparte a demanda de carga. Mesmo logit do passageiro, com dois ajustes que
 * vêm de como o mercado de carga se comporta de verdade:
 *
 * - **preço pesa mais** (`-2.4` contra `-2.1` da econômica): quem embarca carga
 *   compara frete e não tem fidelidade;
 * - **frequência pesa menos** (`0.38` contra `0.62`): um palete espera o próximo
 *   voo sem reclamar, um passageiro não.
 *
 * A sobra também é reoferecida, e numa fração maior — 75% contra 55%. Carga que
 * não embarcou hoje continua no armazém esperando; passageiro que não achou
 * assento desiste da viagem.
 */
export function allocateCargoMarket(
  demand: { tons: number },
  carriers: CargoCarrier[],
): CargoAllocation[] {
  if (carriers.length === 0) return []
  const avgRate = carriers.reduce((s, c) => s + c.rateMult, 0) / carriers.length
  const total = demand.tons * priceElasticity(avgRate)
  const out: CargoAllocation[] = carriers.map((c) => ({ id: c.id, tons: 0, share: 0 }))
  if (total <= 0) return out

  const attract = carriers.map((c) =>
    c.tons > 0
      ? Math.pow(Math.max(0.4, c.freq), 0.38) * Math.pow(Math.max(0.4, c.rateMult), -2.4) * c.quality
      : 0,
  )
  const sum = attract.reduce((s, v) => s + v, 0)
  if (sum <= 0) return out

  let spill = 0
  const left: number[] = []
  for (let i = 0; i < carriers.length; i++) {
    const want = (total * attract[i]) / sum
    const got = Math.min(want, carriers[i].tons)
    spill += want - got
    out[i].tons = got
    left.push(carriers[i].tons - got)
  }
  if (spill > 0.01) {
    const leftSum = left.reduce((s, v) => s + v, 0)
    if (leftSum > 0) {
      const redistributable = Math.min(spill * 0.75, leftSum)
      for (let i = 0; i < carriers.length; i++) out[i].tons += (redistributable * left[i]) / leftSum
    }
  }
  const embarcado = out.reduce((s, o) => s + o.tons, 0)
  for (const o of out) o.share = embarcado > 0 ? o.tons / embarcado : 0
  return out
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
export const escalarCabins = (c: Cabins, k: number): Cabins => ({
  y: c.y * k, w: c.w * k, c: c.c * k, f: c.f * k,
})
/** Corta cada classe no que a cabine oferece. */
export const limitarCabins = (c: Cabins, teto: Cabins): Cabins => ({
  y: Math.min(c.y, teto.y), w: Math.min(c.w, teto.w),
  c: Math.min(c.c, teto.c), f: Math.min(c.f, teto.f),
})
export const sumCabins = (c: Cabins) => c.y + c.w + c.c + c.f

export const seatCapacity = (seats: Cabins, cabin: CabinClass) => seats[cabin]

export { crewFor }
