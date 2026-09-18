/**
 * Horário de voo e malha de conexões.
 *
 * O jogo contava frequência — "três voos por dia" — e mais nada. Frequência sem
 * horário não faz malha: três voos empilhados às 7h da manhã não conectam com
 * nada e disputam o mesmo passageiro, e três espalhados pelo dia alimentam as
 * partidas da tarde. Este módulo dá horário a cada rotação e diz o que conecta
 * com o quê.
 *
 * Nada de React aqui: é `src/game/`, e a tela só lê o que sai daqui.
 */
import { AIRPORT_BY_IATA, type Airport } from './data/airports'
import { blockHours } from './economy'
import { withEngine } from './spec'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import type { Aircraft, GameState, Route } from './types'

export const DIA = 24 * 60

/**
 * Tempo mínimo de conexão, em minutos.
 *
 * Os três degraus são os que a operação real usa, e a diferença entre eles é o
 * que o passageiro tem que fazer entre um voo e outro:
 *
 * - **doméstica**: não sai da área restrita e a bagagem segue sozinha;
 * - **internacional sem alfândega**: trânsito estéril entre dois internacionais,
 *   com controle de segurança e troca de terminal, mas sem entrar no país;
 * - **com alfândega**: o passageiro entra no país, pega a bagagem na esteira,
 *   passa na imigração e na receita e **redespacha** — é isso que custa as três
 *   horas, não a caminhada.
 */
export const MCT_DOMESTICA = 40
export const MCT_INTERNACIONAL = 60
export const MCT_ALFANDEGA = 180

/** Uma conexão acima disso não é conexão, é pernoite. */
export const ESPERA_MAXIMA = 360

/** A etapa cruza fronteira? É o que decide se há alfândega na conexão. */
export const etapaInternacional = (a: Airport, b: Airport) => a.cc !== b.cc

/**
 * O mínimo entre uma chegada e uma partida.
 *
 * Alfândega entra quando o passageiro **cruza a fronteira neste aeroporto** —
 * ou seja, quando exatamente uma das duas etapas é internacional. Duas
 * internacionais é trânsito; duas domésticas não tocam em fronteira nenhuma.
 */
export function mct(chegadaInternacional: boolean, partidaInternacional: boolean): number {
  if (chegadaInternacional === partidaInternacional) {
    return chegadaInternacional ? MCT_INTERNACIONAL : MCT_DOMESTICA
  }
  return MCT_ALFANDEGA
}

export const rotuloMct = (min: number) =>
  min === MCT_DOMESTICA ? 'doméstica' : min === MCT_INTERNACIONAL ? 'internacional em trânsito' : 'com alfândega'

/**
 * Fuso do aeroporto, em minutos, pela longitude.
 *
 * É hora solar, não fuso oficial: o jogo não guarda tabela de fuso, e a
 * diferença aparece em país que estica o fuso por decreto — a China inteira no
 * horário de Pequim, a Espanha no de Berlim. Para o que isto serve — saber se
 * a chegada é de manhã ou de noite e quanto dura a espera — o erro não muda
 * decisão nenhuma, e a espera em si, que é diferença de horário no **mesmo**
 * aeroporto, não tem erro algum.
 */
export const fusoMin = (ap: Airport) => Math.round(ap.lon / 15) * 60

export const hhmm = (min: number) => {
  const m = ((Math.round(min) % DIA) + DIA) % DIA
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Minutos do dia a partir de "07:25". Devolve nulo se não entender. */
export function lerHora(txt: string): number | null {
  const m = txt.trim().match(/^(\d{1,2}):?(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

/** A aeronave que dita o horário da rota: a primeira alocada. */
export function aeronaveDaRota(s: GameState, r: Route): Aircraft | null {
  for (const id of r.aircraftIds) {
    const ac = s.airline.fleet.find((a) => a.id === id)
    if (ac) return ac
  }
  return null
}

/** Minutos de voo da etapa. Sem avião alocado, usa um narrowbody de referência. */
export function blocoMin(s: GameState, r: Route): number {
  const ac = aeronaveDaRota(s, r)
  const t = ac ? withEngine(AIRCRAFT_BY_ID[ac.typeId], ac.engineId) : AIRCRAFT_BY_ID.a320
  return Math.round(blockHours(t, r.distance) * 60)
}

/** Solo no destino antes de voltar. */
export function soloMin(s: GameState, r: Route): number {
  const ac = aeronaveDaRota(s, r)
  return ac ? AIRCRAFT_BY_ID[ac.typeId].turn : AIRCRAFT_BY_ID.a320.turn
}

/**
 * Quantas rotações por dia a rota tem. É o pico da semana: o horário é um só
 * para todos os dias, e nos dias de frequência menor sobram as primeiras.
 */
export const rotacoesPorDia = (r: Route) => Math.max(0, Math.max(...r.freq))

/**
 * Horário padrão quando o jogador ainda não mexeu: as rotações espalhadas pela
 * janela operacional, começando às 6h. Espalhar é o certo por padrão — voo
 * empilhado é escolha, não acidente.
 */
export function horariosPadrao(qtd: number): number[] {
  if (qtd <= 0) return []
  if (qtd === 1) return [7 * 60]
  const inicio = 6 * 60
  const janela = 15 * 60 // 06:00 às 21:00
  return Array.from({ length: qtd }, (_, i) => inicio + Math.round((janela * i) / (qtd - 1)))
}

/** Os horários da rota, completados com o padrão se faltarem. */
export function horariosDa(r: Route): number[] {
  const qtd = rotacoesPorDia(r)
  const padrao = horariosPadrao(qtd)
  const atuais = r.horarios ?? []
  return padrao.map((p, i) => (atuais[i] === undefined ? p : atuais[i]))
}

export interface Rotacao {
  routeId: string
  indice: number
  /** Hora local da base. */
  saida: number
  /** Hora local do destino. */
  chegadaDestino: number
  saidaDestino: number
  /** Hora local da base, já somado o voo de volta e o solo. */
  voltaBase: number
  bloco: number
  internacional: boolean
}

/**
 * As rotações de uma rota num dia, com os horários das quatro pontas.
 *
 * A volta fecha em `saida + 2 × bloco + solo` na hora da base, e isso não é
 * aproximação: o fuso que se soma na ida se subtrai na volta.
 */
export function rotacoesDa(s: GameState, r: Route): Rotacao[] {
  const a = AIRPORT_BY_IATA[r.from]
  const b = AIRPORT_BY_IATA[r.to]
  if (!a || !b) return []
  const bloco = blocoMin(s, r)
  const solo = soloMin(s, r)
  const delta = fusoMin(b) - fusoMin(a)
  const internacional = etapaInternacional(a, b)
  return horariosDa(r).map((saida, indice) => ({
    routeId: r.id,
    indice,
    saida,
    chegadaDestino: saida + bloco + delta,
    saidaDestino: saida + bloco + delta + solo,
    voltaBase: saida + 2 * bloco + solo,
    bloco,
    internacional,
  }))
}

export interface Conexao {
  /** A rotação que chega na base. */
  de: Rotacao
  /** A rotação que sai da base. */
  para: Rotacao
  /** Minutos entre a chegada e a partida. */
  espera: number
  /** O mínimo exigido para esse par. */
  minimo: number
}

/**
 * Diferença de horário dentro do mesmo dia, sempre para a frente.
 *
 * A volta pode passar da meia-noite — um voo de doze horas que sai às 20h volta
 * no dia seguinte —, então a conta é em roda de 24 h.
 */
const adiante = (de: number, para: number) => (((para - de) % DIA) + DIA) % DIA

/**
 * Todas as conexões possíveis numa base, entre as rotas da companhia.
 *
 * Conecta a **volta** de uma rota (que chega na base) com a **ida** de outra
 * (que sai dela) — é assim que a malha de um hub funciona: o avião traz gente
 * da ponta e despeja no banco de conexão, e o voo seguinte leva embora.
 */
export function conexoesNaBase(s: GameState, base: string): Conexao[] {
  const rotas = s.airline.routes.filter((r) => r.from === base || r.to === base)
  const chegadas: Rotacao[] = []
  const partidas: Rotacao[] = []
  for (const r of rotas) {
    for (const rot of rotacoesDa(s, r)) {
      chegadas.push(rot)
      partidas.push(rot)
    }
  }
  const out: Conexao[] = []
  for (const de of chegadas) {
    for (const para of partidas) {
      if (de.routeId === para.routeId) continue // voltar pela mesma rota não é conexão
      const espera = adiante(de.voltaBase, para.saida)
      const minimo = mct(de.internacional, para.internacional)
      if (espera >= minimo && espera <= ESPERA_MAXIMA) out.push({ de, para, espera, minimo })
    }
  }
  return out.sort((x, y) => x.espera - y.espera)
}

/** As conexões que alimentam ou são alimentadas por uma rota. */
export function conexoesDaRota(s: GameState, r: Route) {
  const base = s.airline.hubs.includes(r.from) ? r.from : r.to
  const todas = conexoesNaBase(s, base)
  return {
    base,
    /** Chega de outra rota e embarca nesta. */
    entrando: todas.filter((c) => c.para.routeId === r.id),
    /** Chega nesta e embarca em outra. */
    saindo: todas.filter((c) => c.de.routeId === r.id),
  }
}

/**
 * Rotações desta rota que saem coladas umas nas outras.
 *
 * Não é proibido — companhia de ponte aérea faz isso de propósito —, mas quase
 * sempre é desperdício: dois voos para o mesmo lugar com quinze minutos de
 * diferença dividem o mesmo pico de procura e voltam os dois pela metade.
 */
export const JANELA_COLADO = 30

export function voosColados(s: GameState, r: Route): [Rotacao, Rotacao][] {
  const rots = rotacoesDa(s, r)
  const pares: [Rotacao, Rotacao][] = []
  for (let i = 0; i < rots.length; i++) {
    for (let j = i + 1; j < rots.length; j++) {
      if (Math.abs(rots[i].saida - rots[j].saida) <= JANELA_COLADO) pares.push([rots[i], rots[j]])
    }
  }
  return pares
}

/**
 * Quanto a conexão acrescenta à demanda da rota.
 *
 * **É passageiro a mais, não fatia roubada.** Quem voa Recife–São Paulo–Lisboa
 * não estava no mercado Recife–São Paulo: ele só existe porque as duas pontas
 * se encaixam no horário. Por isso a conexão entra somando pax e não mexendo em
 * `allocateMarket` — mexer ali seria dizer que a conexão tira passageiro do
 * concorrente no mercado local, o que não acontece.
 *
 * O teto de 35% é índice de jogo, mas tem lastro: em hub de conexão de verdade
 * a parcela conectante fica entre um quinto e a metade do movimento, e 35% cai
 * no meio disso sem deixar a malha virar a única coisa que importa.
 */
export const TETO_CONEXAO = 0.35
export const POR_CONEXAO = 0.025

/**
 * O mesmo ganho, para uma concorrente.
 *
 * A IA não tem horário — as rotas dela são abstratas —, então o ganho sai do
 * tamanho da malha no hub, que é o que de fato determina quanta conexão uma
 * companhia consegue montar. Precisa existir: dar o bônus só ao jogador fez a
 * receita dele passar a valer quase o dobro da maior concorrente assim que os
 * mercados encolheram, e isso não era desenho, era esquecimento.
 */
export function fatorConexaoIA(rotasNoHub: number): number {
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * Math.max(0, rotasNoHub - 1))
}

export function fatorConexao(s: GameState, r: Route): number {
  if (!r.horarios && rotacoesPorDia(r) === 0) return 1
  const { entrando, saindo } = conexoesDaRota(s, r)
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * (entrando.length + saindo.length))
}
