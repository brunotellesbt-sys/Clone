/**
 * O que a malha conecta.
 *
 * A escala — quem está onde, a que horas — mora em `escala.ts`. Aqui fica a
 * consequência comercial dela: quais chegadas alimentam quais partidas, quanto
 * isso vale em passageiro, e o que a tela precisa dizer sobre horário.
 *
 * A conexão passou a ser calculada **sobre pernas**, e isso é mais que uma troca
 * de estrutura. Antes, a unidade era a rotação de ida e volta, então só a volta
 * de uma rota podia alimentar a ida de outra. Numa malha de verdade quem alimenta
 * é qualquer chegada, venha ela de onde vier — inclusive de um voo que não volta
 * para lugar nenhum, porque a cauda segue para um terceiro aeroporto.
 *
 * Nada de React aqui: é `src/game/`, e a tela só lê o que sai daqui.
 */
import { AIRPORT_BY_IATA, type Airport } from './data/airports'
import { distanceNm } from './geo'
import { hashStr } from './rng'
import { baseDemand } from './demand'
import { blockHours } from './economy'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import {
  adianteNaSemana, atratividadeHorario, DIA, escalaDe, naSemana, noTempo, pernasDaRota,
  pernasDoDia, type PernaNoTempo,
} from './escala'
import { CABINS, type Cabins, type GameState, type Perna, type Route } from './types'

export { DIA, SEMANA, hhmm, lerHora, atratividadeHorario } from './escala'

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
export const esperaMaxima = (chegadaInternacional: boolean, partidaInternacional: boolean) =>
  chegadaInternacional !== partidaInternacional ? 360 : chegadaInternacional ? 240 : 180

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

/** Fuso do aeroporto, em minutos. Vem do tzdata — ver `FUSO` em `airports.ts`. */
export const fusoMin = (ap: Airport) => ap.fuso

// ------------------------------------------------------------------- conexões

/**
 * Um voo tocando a base: ou chegando nela, ou saindo dela.
 *
 * O voo da parceira de interline entra aqui do mesmo jeito, com `parceira`
 * preenchido — para o resto do cálculo ele é só mais uma chegada e mais uma
 * partida, que é o que ele é para o passageiro também.
 */
export interface Toque {
  /** Identificação do voo: a perna, ou a chave da rota da parceira. */
  id: string
  /** A outra ponta do voo — de onde ele veio, ou para onde ele vai. */
  ponta: string
  /** Minuto da semana, em UTC. */
  quando: number
  internacional: boolean
  /** Hora local na base. */
  local: number
  routeId?: string
  parceira?: string
  codeshare?: boolean
}

export interface Conexao {
  de: Toque
  para: Toque
  /** Minutos entre a chegada e a partida. */
  espera: number
  /** O mínimo exigido para esse par. */
  minimo: number
  parceira?: string
  codeshare?: boolean
}

const rotaDaPerna = (s: GameState, p: Perna) =>
  s.airline.routes.find(
    (r) => (r.from === p.from && r.to === p.to) || (r.from === p.to && r.to === p.from),
  )

function toqueDeChegada(s: GameState, t: PernaNoTempo): Toque {
  return {
    id: t.perna.id, ponta: t.perna.from, quando: t.chegada, internacional: t.internacional,
    local: t.chegadaLocal, routeId: rotaDaPerna(s, t.perna)?.id,
  }
}
function toqueDePartida(s: GameState, t: PernaNoTempo): Toque {
  return {
    id: t.perna.id, ponta: t.perna.to, quando: t.partida, internacional: t.internacional,
    local: t.perna.saida, routeId: rotaDaPerna(s, t.perna)?.id,
  }
}

/**
 * As duas pontas de uma rota de concorrente na **sua** base.
 *
 * A concorrente não tem escala de verdade: cada rota dela tem uma hora de
 * partida do hub dela e uma frequência. Daí sai o resto — se a base é o destino
 * dela, o voo chega depois do bloco e volta depois do solo.
 */
export function pontasDaConcorrente(
  cr: { key: string; from: string; to: string; hora?: number },
  base: string,
): { chega: number; parte: number; internacional: boolean; outraPonta: string } | null {
  const a = AIRPORT_BY_IATA[cr.from]
  const b = AIRPORT_BY_IATA[cr.to]
  if (!a || !b) return null
  const dist = distanceNm(a, b)
  // sem frota modelada, a referência é o porte que voaria a etapa
  const tipo = dist > 3000 ? AIRCRAFT_BY_ID.b789 : AIRCRAFT_BY_ID.a320
  const bloco = Math.round(blockHours(tipo, dist) * 60)
  const solo = tipo.turn
  const hora = horaDaConcorrente(cr)
  const internacional = etapaInternacional(a, b)
  if (cr.from === base) {
    return { parte: hora, chega: hora + 2 * bloco + solo, internacional, outraPonta: cr.to }
  }
  if (cr.to === base) {
    const delta = fusoMin(b) - fusoMin(a)
    const chega = hora + bloco + delta
    return { chega, parte: chega + solo, internacional, outraPonta: cr.from }
  }
  return null
}

/** Chegadas e partidas numa base, suas e das parceiras, em minuto da semana. */
export function toquesNaBase(s: GameState, base: string): { chegadas: Toque[]; partidas: Toque[] } {
  const chegadas: Toque[] = []
  const partidas: Toque[] = []
  for (const p of escalaDe(s)) {
    if (p.from !== base && p.to !== base) continue
    const ac = s.airline.fleet.find(a => a.id === p.aircraftId)
    if (!ac || ac.groundedUntil > s.day || rotaDaPerna(s, p)?.cargo) continue
    const t = noTempo(s, p)
    if (p.to === base) chegadas.push(toqueDeChegada(s, t))
    if (p.from === base) partidas.push(toqueDePartida(s, t))
  }
  for (const comp of s.competitors) {
    if (!s.airline.acordos?.includes(comp.id) && !s.airline.codeshares?.includes(comp.id)) continue
    const codeshare = s.airline.codeshares?.includes(comp.id) ?? false
    for (const cr of comp.routes) {
      const p = pontasDaConcorrente(cr, base)
      if (!p) continue
      const fuso = AIRPORT_BY_IATA[base].fuso
      // a parceira voa todo dia; entra uma vez por dia da semana
      for (let dow = 0; dow < 7; dow++) {
        const id = `X:${comp.id}:${cr.key}:${dow}`
        chegadas.push({
          id, ponta: p.outraPonta, quando: naSemana(dow * DIA + p.chega - fuso),
          internacional: p.internacional, local: p.chega, parceira: comp.name, codeshare,
        })
        partidas.push({
          id, ponta: p.outraPonta, quando: naSemana(dow * DIA + p.parte - fuso),
          internacional: p.internacional, local: p.parte, parceira: comp.name, codeshare,
        })
      }
    }
  }
  return { chegadas, partidas }
}

/**
 * Todas as conexões possíveis numa base.
 *
 * Cada chegada é cruzada com cada partida que sai dentro da janela. Duas
 * exclusões, e as duas são de bom senso: a partida não pode ser a própria perna
 * que chegou, e não adianta conectar para o aeroporto de onde o passageiro
 * acabou de vir — ninguém voa Fortaleza–Rio–Fortaleza.
 */
export function conexoesNaBase(s: GameState, base: string): Conexao[] {
  const { chegadas, partidas } = toquesNaBase(s, base)
  const out: Conexao[] = []
  for (const de of chegadas) {
    for (const para of partidas) {
      if (de.id === para.id) continue
      if (de.ponta === para.ponta) continue
      // interline dos dois lados seria conexão entre dois voos que não são seus
      if (de.parceira && para.parceira) continue
      const espera = adianteNaSemana(de.quando, para.quando)
      const minimo = mct(de.internacional, para.internacional)
      if (espera < minimo || espera > esperaMaxima(de.internacional, para.internacional)) continue
      out.push({ de, para, espera, minimo, parceira: de.parceira ?? para.parceira,
        codeshare: de.codeshare ?? para.codeshare })
    }
  }
  return out.sort((x, y) => x.espera - y.espera)
}

/**
 * Quanto uma conexão interline vale, comparada com uma da própria companhia.
 *
 * Interline permite um itinerário integrado entre empresas. O peso menor
 * representa a menor integração comercial em comparação com codeshare.
 */
export const DESCONTO_INTERLINE = 0.45

/** As conexões que alimentam ou são alimentadas por uma rota, em cada base. */
export function conexoesDaRota(s: GameState, r: Route) {
  const base = s.airline.hubs.includes(r.from) ? r.from : s.airline.hubs.includes(r.to) ? r.to : r.from
  const todas = conexoesNaBase(s, base)
  return {
    base,
    /** Chega de outro voo e embarca nesta rota. */
    entrando: todas.filter((c) => c.para.routeId === r.id),
    /** Chega nesta rota e embarca em outro voo. */
    saindo: todas.filter((c) => c.de.routeId === r.id),
  }
}

/**
 * Voos desta rota que saem colados uns nos outros, no mesmo dia e sentido.
 *
 * Não é proibido — companhia de ponte aérea faz isso de propósito —, mas quase
 * sempre é desperdício: dois voos para o mesmo lugar com quinze minutos de
 * diferença dividem o mesmo pico de procura e voltam os dois pela metade.
 */
export const JANELA_COLADO = 30

export function voosColados(s: GameState, r: Route): [Perna, Perna][] {
  const pares: [Perna, Perna][] = []
  const pernas = pernasDaRota(s, r)
  for (let i = 0; i < pernas.length; i++) {
    for (let j = i + 1; j < pernas.length; j++) {
      const a = pernas[i]
      const b = pernas[j]
      if (a.dow !== b.dow || a.from !== b.from) continue
      if (Math.abs(a.saida - b.saida) <= JANELA_COLADO) pares.push([a, b])
    }
  }
  return pares
}

/**
 * Hora de partida de uma rota da concorrente.
 *
 * Estável e espalhada pela janela de operação: mesma chave, mesma hora, partida
 * após partida. Tirar da chave em vez de sortear mantém o save antigo válido e o
 * comportamento reproduzível na simulação de terminal.
 */
export function horaDaConcorrente(r: { key: string; hora?: number }): number {
  if (r.hora !== undefined) return r.hora
  return Math.round(6 * 60 + 15 * 60 * hashStr(`H${r.key}`))
}

/** De 0 a 1: quanto das partidas do dia sai entre 22h e 6h — o que a folha cobra a mais. */
export function fracaoNoturna(s: GameState, r: Route, dow?: number): number {
  const pernas = dow === undefined ? pernasDaRota(s, r) : pernasDoDia(s, r, dow)
  if (!pernas.length) return 0
  const noite = (min: number) => { const h = (min / 60) % 24; return h >= 22 || h < 6 }
  return pernas.filter((p) => noite(p.saida)).length / pernas.length
}

/** A média da rota no dia, que é o que entra na disputa por passageiro. */
export function atratividadeDaRota(s: GameState, r: Route, dow?: number): number {
  const pernas = dow === undefined ? pernasDaRota(s, r) : pernasDoDia(s, r, dow)
  if (!pernas.length) return 1
  return pernas.reduce((soma, p) => soma + atratividadeHorario(p.saida), 0) / pernas.length
}

// ------------------------------------------------------- conexão vira demanda

/**
 * Quanto a conexão acrescenta à demanda da rota.
 *
 * **É passageiro a mais, não fatia roubada.** Quem voa Recife–São Paulo–Lisboa
 * não estava no mercado Recife–São Paulo: ele só existe porque as duas pontas se
 * encaixam no horário. Por isso a conexão entra somando pax e não mexendo em
 * `allocateMarket` — mexer ali seria dizer que a conexão tira passageiro do
 * concorrente no mercado local, o que não acontece.
 *
 * O teto de 35% é índice de jogo, mas tem lastro: em hub de conexão de verdade a
 * parcela conectante fica entre um quinto e a metade do movimento.
 */
export const TETO_CONEXAO = 0.35
export const POR_CONEXAO = 0.025

/**
 * Demanda de referência de um trajeto de conexão, em passageiros por dia.
 *
 * Uma conexão que serve um mercado deste tamanho vale por uma inteira; abaixo
 * disso vale proporcionalmente menos. Não é medição: é a régua que separa "isto
 * é um trajeto que alguém faz" de "isto é um par que só fecha no relógio".
 */
const DEMANDA_REFERENCIA = 400

function pesoDoTrajeto(de: string, para: string, dia: number, doy: number): number {
  if (de === para) return 0
  return Math.min(1, baseDemand(de, para, dia, doy).total / DEMANDA_REFERENCIA)
}

/**
 * Soma de peso de conexão por rota, numa base, num dia.
 *
 * Memoizado porque a conta é quadrática nos voos e o tick chama uma vez por rota:
 * sem o cache, uma malha de cinquenta rotas fazia milhares de avaliações de
 * demanda por rota, todo dia simulado.
 */
const cacheConexao = new WeakMap<GameState, Map<string, Map<string, number>>>()

export function pesosDeConexao(s: GameState, base: string, doy: number, dow?: number): Map<string, number> {
  const escala = escalaDe(s)
  const assinatura = escala.map(p => `${p.id}:${p.from}:${p.to}:${p.dow}:${p.saida}:${p.aircraftId}`).join('|')
  const frota = s.airline.fleet.map(a => `${a.id}:${a.groundedUntil}`).join('|')
  const acordos = [...(s.airline.acordos ?? []), ...(s.airline.codeshares ?? [])]
  const parceiras = s.competitors.filter(c => acordos.includes(c.id))
    .map(c => `${c.id}:${c.routes.map(r => `${r.key}:${r.hora}`).join(',')}`).join('|')
  const chave = `${base}|${s.day}|${doy}|${dow ?? 'semana'}|${assinatura}|${frota}|${parceiras}|${s.airline.codeshares?.join(',') ?? ''}`
  const cache = cacheConexao.get(s) ?? new Map<string, Map<string, number>>()
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const pesos = new Map<string, number>()
  const somar = (id: string | undefined, v: number) => {
    if (id) pesos.set(id, (pesos.get(id) ?? 0) + v)
  }
  for (const c of conexoesNaBase(s, base)) {
    // Na previsão semanal divide por sete; na apuração usa só as pernas do dia.
    const peso = pesoDoTrajeto(c.de.ponta, c.para.ponta, s.day, doy) *
      (c.codeshare ? 0.8 : c.parceira ? DESCONTO_INTERLINE : 1) / (dow === undefined ? 7 : 1)
    // só a perna que é sua ganha o bônus: a da parceira é receita dela
    if (dow === undefined || escala.some(p => p.id === c.de.id && p.dow === dow)) somar(c.de.routeId, peso)
    if (dow === undefined || escala.some(p => p.id === c.para.id && p.dow === dow)) somar(c.para.routeId, peso)
  }
  // o cache é de um dia só; guardar mais seria guardar demanda de ontem
  if (cache.size > 16) cache.clear()
  cache.set(chave, pesos)
  cacheConexao.set(s, cache)
  return pesos
}

export function fatorConexaoIA(rotasNoHub: number): number {
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * Math.max(0, rotasNoHub - 1))
}

export function fatorConexao(s: GameState, r: Route, doy = 180, dow?: number): number {
  const base = s.airline.hubs.includes(r.from) ? r.from : s.airline.hubs.includes(r.to) ? r.to : null
  if (!base) return 1
  const peso = pesosDeConexao(s, base, doy, dow).get(r.id) ?? 0
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * peso)
}

/** Distribui o resultado real da rota entre as pernas que efetivamente voaram. */
export function registrarPassageirosDosVoos(s: GameState, r: Route, pernas: Perna[], pax: Cabins, locais: Cabins, doy: number) {
  const total = { y: 0, w: 0, c: 0, f: 0 }
  const lugares = pernas.map(p => s.airline.fleet.find(a => a.id === p.aircraftId)!.seats)
  for (const seats of lugares) for (const c of CABINS) total[c] += seats[c]
  const { entrando, saindo } = conexoesDaRota(s, r)
  const peso = (conexoes: Conexao[]) => conexoes.reduce((n, c) => n +
    pesoDoTrajeto(c.de.ponta, c.para.ponta, s.day, doy) * (c.codeshare ? 0.8 : c.parceira ? DESCONTO_INTERLINE : 1), 0)
  const linhas = pernas.map((p, i) => {
    const viajantes = { y: 0, w: 0, c: 0, f: 0 }
    for (const c of CABINS) viajantes[c] = total[c] ? pax[c] * lugares[i][c] / total[c] : 0
    p.ultimoVoo = { day: s.day, pax: viajantes, conexoesEntrando: 0, conexoesSaindo: 0 }
    return { p, entram: peso(entrando.filter(c => c.para.id === p.id)), saem: peso(saindo.filter(c => c.de.id === p.id)),
      limite: Math.floor(CABINS.reduce((n, c) => n + viajantes[c], 0)) }
  })
  // Só contabiliza a procura adicional que encontrou assento. Cada passageiro
  // deste rateio recebe uma origem de conexão ou uma continuação, sem dobrar
  // o total transportado pelo próprio voo.
  let faltam = Math.max(0, Math.round(CABINS.reduce((n, c) => n + pax[c] - Math.min(pax[c], locais[c]), 0)))
  let disponiveis = linhas.filter(x => x.entram + x.saem > 0 && x.limite > 0)
  while (faltam > 0 && disponiveis.length) {
    const soma = disponiveis.reduce((n, x) => n + x.entram + x.saem, 0)
    const rodada = faltam
    let atribuidos = 0
    for (const x of disponiveis) {
      const qtd = Math.min(x.limite, Math.max(1, Math.floor(rodada * (x.entram + x.saem) / soma)), faltam)
      const entra = Math.round(qtd * x.entram / (x.entram + x.saem))
      x.p.ultimoVoo!.conexoesEntrando += entra
      x.p.ultimoVoo!.conexoesSaindo += qtd - entra
      x.limite -= qtd
      faltam -= qtd
      atribuidos += qtd
    }
    if (!atribuidos) break
    disponiveis = disponiveis.filter(x => x.limite > 0)
  }
}
