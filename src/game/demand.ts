import { AIRPORT_BY_IATA, temIrmao, type Airport } from './data/airports'
import { derivaDoPais } from './data/crescimento'
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

/**
 * Escala do mercado de passageiro.
 *
 * Mudou de valor quando a massa do modelo deixou de ser a população da cidade e
 * passou a ser o movimento do aeroporto: são grandezas de ordem diferente, e o
 * `K` foi recalibrado para o mercado GRU-JFK continuar do tamanho que estava.
 */
export const K = 0.9
/**
 * Teto de um par sobre o movimento da ponta menor.
 *
 * Nenhuma ligação isolada pode ser mais que isto do que o aeroporto menor move
 * no dia inteiro. Sem o teto o modelo gravitacional produzia, num aeroporto de
 * ilha com dois destinos, um par maior que o aeroporto inteiro — e é assim que
 * a demanda fica coerente com as **duas** pontas e não só com a maior.
 *
 * Meio é generoso de propósito: existe aeroporto regional cuja ligação com o
 * hub é de fato metade do movimento dele. O que o teto corta é o absurdo.
 */
const TETO_PAR = 0.5
/**
 * Onde o teto começa a morder, como fração dele.
 *
 * Abaixo do joelho o teto não existe e a gravidade vale inteira; acima, a
 * sobra é comprimida contra o teto, que vira assíntota em vez de parede.
 */
const JOELHO = 0.7

/**
 * O teto que comprime em vez de cortar.
 *
 * `Math.min` é uma parede: dois pares que a encostam saem **idênticos**, e foi
 * o que aconteceu de Santos Dumont para Congonhas e para Guarulhos — os dois
 * batiam nos 50% do movimento de Santos Dumont e o jogo dizia 13.955
 * passageiros para ambos, embora Guarulhos mova o dobro de Congonhas. A parede
 * cumpria o objetivo dela (nenhum par passa do que a ponta menor aguenta) e
 * destruía a ordem entre os pares, que é o que o jogador lê na tela.
 *
 * Isto mantém as duas coisas: até o joelho a função é a identidade — pares
 * longe do teto não mudam em nada —, e acima dele a diferença sobrevive
 * comprimida, aproximando-se do teto sem nunca alcançá-lo. A derivada vale 1
 * no joelho pelos dois lados, então não há degrau na emenda.
 */
export function satura(x: number, teto: number): number {
  if (teto <= 0) return 0
  const joelho = JOELHO * teto
  if (x <= joelho) return x
  return teto - (teto - joelho) * Math.exp(-(x - joelho) / (teto - joelho))
}
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

/**
 * Quanto um par de aeroportos "combina", quando as duas cidades têm mais de um.
 *
 * O modelo gravitacional trata cada aeroporto como um ponto solto e não sabe
 * que, num par de cidades servidas por vários, o passageiro **escolhe** — e não
 * escolhe ao acaso. Sem isto, de Congonhas o Rio se repartia meio a meio entre
 * Santos Dumont e Galeão, quando a ponte aérea real é de centro a centro:
 * Congonhas–Santos Dumont é o mercado, e Congonhas–Galeão é resto.
 *
 * O sinal que separa os dois já estava no catálogo: o **escopo**. Congonhas e
 * Santos Dumont são domésticos — sem alfândega, pista curta, no meio da cidade
 * —, e Guarulhos e Galeão são internacionais, longe e com conexão. Aeroportos
 * do mesmo tipo se atraem porque servem a mesma viagem; de tipos diferentes,
 * o passageiro só usa quando não tem outro jeito. A mesma regra acerta National
 * com LaGuardia em Washington–Nova York, e Heathrow com Kennedy.
 *
 * **Só vale quando as duas pontas dividem cidade com outro aeroporto.** Num par
 * onde só existe uma opção de cada lado não há escolha a modelar, e mexer ali
 * mudaria a demanda do mundo inteiro em vez de repartir a de uma cidade.
 */
export function afinidadeDeAeroporto(a: Airport, b: Airport): number {
  if (!temIrmao(a.iata) || !temIrmao(b.iata)) return 1
  return a.escopo === b.escopo ? AFINIDADE_IGUAL : AFINIDADE_CRUZADA
}

/**
 * Os dois lados da afinidade. A razão entre eles é o que importa: 2,9 vezes
 * leva a repartição de Congonhas para o Rio de 49/51 para 75/25, que é a ordem
 * de grandeza da ponte aérea de verdade. Os valores ficam em volta de 1 para o
 * efeito ser **repartir**, não inflar nem cortar a demanda das cidades que têm
 * mais de um aeroporto.
 */
const AFINIDADE_IGUAL = 1.7
const AFINIDADE_CRUZADA = 0.58

/** Demanda estrutural de um par O&D, antes de preço e concorrência. */
export function baseDemand(from: string, to: string, day: number, dayOfYear: number): MarketDemand {
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  const dist = distanceBetween(from, to)
  /**
   * A massa do par é o movimento dos **aeroportos**, não a população das
   * cidades. Era `sqrt(a.pop * b.pop)`, e por isso Guarulhos, Congonhas e
   * Viracopos disputavam mercados idênticos: os três herdavam os mesmos 22
   * milhões de paulistanos. Guarulhos move 129 mil passageiros por dia,
   * Congonhas 47 mil e Viracopos 25 mil, e agora o modelo sabe disso.
   */
  const mass = Math.sqrt(a.paxDia * b.paxDia)
  /**
   * Equilíbrio de fluxo: cada ponta traz o fator que faz a soma dos mercados
   * dela bater com o que o aeroporto move. Sem ele o modelo dava a Recife dez
   * vezes o movimento real e a Guarulhos três — inflando o pequeno em relação
   * ao grande, que é o avesso do que se quer.
   */
  const fluxo = Math.sqrt(a.fluxo * b.fluxo)
  const gdp = (a.gdp + b.gdp) / 2
  const tour = (a.tour + b.tour) / 2
  const sameCountry = a.cc === b.cc ? 1.55 : a.country === b.country ? 1.3 : 1
  const afinidade = afinidadeDeAeroporto(a, b)
  const sameRegion = Math.abs(a.lon - b.lon) < 45 && Math.abs(a.lat - b.lat) < 35 ? 1.12 : 1
  const hubBonus = 1 + 0.05 * (a.tier + b.tier - 4)
  const decay = 1 / (1 + Math.pow(dist / 700, 1.35))
  const season = (seasonFactor(dayOfYear, a.lat) + seasonFactor(dayOfYear, b.lat)) / 2
  const noise = 0.82 + 0.36 * hashStr(odKey(from, to))
  /**
   * O mundo não cresce todo junto.
   *
   * Era `1 + day * 0.00012` — um número só para 233 países, em que Tóquio e
   * Lagos crescem igual. Agora cada ponta traz a deriva do país dela: tendência
   * medida no Banco Mundial mais um ciclo de ano bom e ano ruim. A média do par
   * é geométrica porque as duas pontas pesam igual num mercado O&D — quem voa
   * GRU–LIS é metade brasileiro e metade português.
   */
  const derivaA = derivaDoPais(a.cc, day)
  const derivaB = derivaDoPais(b.cc, day)
  const growth = Math.sqrt(derivaA * derivaB)

  let total =
    K *
    Math.pow(mass, 0.9) *
    fluxo *
    gdp *
    Math.pow(tour, 0.55) *
    decay *
    sameCountry *
    afinidade *
    sameRegion *
    hubBonus *
    season *
    noise *
    growth *
    WEEKDAY[(day + 4) % 7]

  /**
   * Par colado não sustenta voo — mas o corte era um degrau.
   *
   * Era `dist < 120 → ×0,15`: a 119 km o mercado valia 15% e a 121 km valia
   * 100%, um salto de sete vezes em dois quilômetros. Quem pagava era o par
   * que cai perto da linha — Rio–Cabo Frio, a 66 km, levava o mesmo corte de
   * um par colado de verdade, e nada entre 60 e 120 km existia no jogo.
   *
   * Agora é rampa: até 60 km continua valendo 15% (ninguém voa o que se faz de
   * carro em uma hora) e sobe até valer inteiro nos 120 km, onde o corte
   * acabava de qualquer jeito. Acima de 120 km nada muda.
   */
  const colado = Math.min(1, Math.max(0, (dist - 60) / 60))
  if (dist < 120) total *= 0.15 + 0.85 * colado
  /**
   * A ponta menor é o gargalo: o par não pode passar do que ela move no dia.
   *
   * O teto **anda junto com o país**, e isso não é detalhe. Com `paxDia` parado,
   * as rotas que encostam no teto — justamente as grandes, que é onde o jogador
   * põe a frota — ficavam congeladas num mundo que cresce: Santos Dumont–
   * Congonhas dava os mesmos 13.926 no ano 1 e no ano 30. Se o Brasil move mais
   * gente, o aeroporto move mais gente; senão o crescimento só apareceria nas
   * rotas pequenas, que é o avesso do que acontece.
   */
  total = Math.max(0, satura(total, TETO_PAR * Math.min(a.paxDia * derivaA, b.paxDia * derivaB)))

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

  /**
   * Tarifa de referência: uma parte fixa por bilhete e uma por quilômetro.
   *
   * A parte fixa é o que a etapa curta tem de caro e não depende da distância
   * — check-in, embarque, taxa de aeroporto, o ciclo de decolagem e pouso. Ela
   * era 34, e com isso um bilhete de 126 km saía por 46 dólares enquanto o voo
   * custava o dobro disso por assento: **toda** rota regional curta nascia no
   * vermelho, por mais gente que houvesse para voar. Quem cobre um pouso e uma
   * decolagem é o bilhete, e o bilhete curto é caro por quilômetro — é assim
   * na tabela de qualquer companhia.
   *
   * Os 44 mexem quase só no curto, por construção: são 21% a mais num bilhete
   * de 126 km, 7% num de 1.100 km e 1% num de doze mil.
   */
  const refFare = (44 + 0.088 * dist) * (0.68 + 0.5 * gdp)
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
  // A carga segue a mesma deriva de país da gente, com um empurrão: comércio
  // cresce mais rápido que turismo, e é ele que enche o porão.
  const growth = Math.pow(Math.sqrt(derivaDoPais(a.cc, day) * derivaDoPais(b.cc, day)), 1.3)

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
