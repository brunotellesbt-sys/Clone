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
import { hashStr } from './rng'
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
 * Fuso do aeroporto, em minutos. Vem do tzdata — ver `FUSO` em `airports.ts`.
 *
 * Era hora solar, pela longitude, e errava onde o fuso segue decreto em vez do
 * sol. A espera de conexão, que é diferença de horário no **mesmo** aeroporto,
 * nunca teve erro; o que estava errado era a hora de chegada no destino.
 */
export const fusoMin = (ap: Airport) => ap.fuso

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
export function horariosPadrao(qtd: number, ciclo = 0, avioes = 1): number[] {
  if (qtd <= 0) return []
  if (qtd === 1) return [7 * 60]
  const inicio = 6 * 60
  const janela = 15 * 60 // 06:00 às 21:00
  const passo = janela / (qtd - 1)
  /**
   * O passo nunca fica menor do que a aeronave leva para voltar e sair de novo.
   * Sem isto, espalhar seis rotações de uma rota longa com dois aviões marcava
   * partidas que a própria frota não consegue cumprir — e o padrão do jogo
   * nascia em conflito.
   */
  const minimo = avioes > 0 ? ciclo / avioes : 0
  const real = Math.max(passo, minimo)
  return Array.from({ length: qtd }, (_, i) => Math.round(inicio + real * i) % DIA)
}

/** Os horários da rota, completados com o padrão se faltarem. */
export function horariosDa(r: Route, ciclo = 0): number[] {
  const qtd = rotacoesPorDia(r)
  const padrao = horariosPadrao(qtd, ciclo, Math.max(1, r.aircraftIds.length))
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
  return horariosDa(r, 2 * bloco + solo).map((saida, indice) => ({
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
 * Quanto vale sair a esta hora, de 0,46 a 1,05.
 *
 * Voo de madrugada não vale o mesmo que voo de pico, e até agora o jogo achava
 * que valia: horário só entrava pela conexão. A curva tem duas corcovas —
 * manhã cedo e fim de tarde —, que é a forma que a procura tem de verdade,
 * porque quem paga caro é quem viaja a trabalho e quer chegar para trabalhar e
 * voltar para dormir em casa. Seis da manhã vale 0,94, o meio da tarde 0,86 e
 * três da manhã 0,44.
 *
 * **É índice de jogo, não medição.** A forma vem de como as companhias montam
 * grade — os aviões saem em bancos de manhã e no fim do dia —, mas os números
 * são escolhidos para dar ao jogador uma decisão com consequência sem tornar a
 * madrugada inútil: voo noturno continua fechando conta em rota longa, onde o
 * fuso obriga.
 *
 * Não modela toque de recolher. Heathrow, Congonhas e outros tantos proíbem
 * operação noturna, e isso seria um dado por aeroporto que não existe em fonte
 * pública nenhuma que eu tenha encontrado.
 */
export function atratividadeHorario(min: number): number {
  const h = ((((min % DIA) + DIA) % DIA) / 60)
  /** Distância até uma hora do dia, pelo caminho curto da roda de 24 h. */
  const perto = (c: number) => ((h - c + 12) % 24) - 12
  const corcova = (c: number) => Math.exp(-(perto(c) ** 2) / 18)
  /**
   * A queda da madrugada é estreita de propósito. Larga, ela vazava para as seis
   * da manhã e punha a primeira onda do dia valendo menos que um voo das nove da
   * noite — o contrário do que acontece numa ponte aérea.
   */
  const madrugada = Math.exp(-(perto(3) ** 2) / 6)
  return 0.78 + 0.32 * Math.max(corcova(8), corcova(18)) - 0.42 * madrugada
}

/**
 * Hora de partida de uma rota da concorrente.
 *
 * Estável e espalhada pela janela de operação: mesma chave, mesma hora, partida
 * após partida. Tirar da chave em vez de sortear mantém o save antigo válido e
 * o comportamento reproduzível na simulação de terminal.
 */
export function horaDaConcorrente(r: { key: string; hora?: number }): number {
  if (r.hora !== undefined) return r.hora
  return Math.round(6 * 60 + 15 * 60 * hashStr(`H${r.key}`))
}

/** A média da rota, que é o que entra na disputa por passageiro. */
export function atratividadeDaRota(s: GameState, r: Route): number {
  const rots = rotacoesDa(s, r)
  if (!rots.length) return 1
  return rots.reduce((soma, rot) => soma + atratividadeHorario(rot.saida), 0) / rots.length
}

/**
 * De qual aeronave é cada rotação.
 *
 * As rotações são repartidas em rodízio entre os aviões alocados: com dois
 * aviões e quatro rotações, o primeiro faz a 1ª e a 3ª. É a escala mais simples
 * que existe, e é a que o resto do jogo já supunha ao contar custo por rotação.
 */
export const aeronaveDaRotacao = (r: Route, indice: number) =>
  r.aircraftIds.length ? r.aircraftIds[indice % r.aircraftIds.length] : null

/**
 * A rotação ocupa a aeronave deste minuto até este outro, na hora da base.
 *
 * Fecha em `saida + 2 × bloco + solo`: o avião só está livre de novo quando
 * volta. Pode passar da meia-noite, e por isso a comparação é em roda de 24 h.
 */
export const ocupacao = (rot: Rotacao): [number, number] => [rot.saida, rot.voltaBase]

/** Dois intervalos se cruzam na roda de 24 h? */
function cruza(a: [number, number], b: [number, number]): boolean {
  // um intervalo que passa da meia-noite vira dois; comparar em roda evita isso
  const dur = (x: [number, number]) => ((x[1] - x[0]) % DIA + DIA) % DIA
  if (dur(a) >= DIA || dur(b) >= DIA) return true
  const inicio = ((b[0] - a[0]) % DIA + DIA) % DIA
  return inicio < dur(a) || ((a[0] - b[0]) % DIA + DIA) % DIA < dur(b)
}

export interface Conflito {
  /** A cauda que estaria em dois lugares. */
  aircraftId: string
  a: Rotacao
  b: Rotacao
}

/**
 * Rotações que põem a mesma aeronave em dois lugares ao mesmo tempo.
 *
 * Isto faltava, e era o buraco mais feio da escala: `setHorario` aceitava
 * qualquer horário, então dava para marcar três rotações do mesmo A320 às
 * 06:00, 06:10 e 06:20. O limite de capacidade da rota conta **quantas**
 * rotações cabem no dia; não olhava **quais horários** foram escolhidos.
 */
export function conflitosDeAeronave(s: GameState, r: Route): Conflito[] {
  const rots = rotacoesDa(s, r)
  const out: Conflito[] = []
  for (let i = 0; i < rots.length; i++) {
    for (let j = i + 1; j < rots.length; j++) {
      const ai = aeronaveDaRotacao(r, i)
      if (!ai || ai !== aeronaveDaRotacao(r, j)) continue
      if (cruza(ocupacao(rots[i]), ocupacao(rots[j]))) out.push({ aircraftId: ai, a: rots[i], b: rots[j] })
    }
  }
  return out
}

/**
 * O horário proposto cabe? Devolve o motivo, ou nulo.
 *
 * Só olha a própria rota: uma aeronave pertence a uma rota de cada vez, então
 * não há como ela colidir com a escala de outra.
 */
export function horarioCabe(s: GameState, r: Route, indice: number, minutos: number): string | null {
  const dono = aeronaveDaRotacao(r, indice)
  if (!dono) return null
  const rots = rotacoesDa(s, r)
  const proposta: Rotacao = { ...rots[indice], saida: minutos, voltaBase: minutos + 2 * rots[indice].bloco + soloMin(s, r) }
  for (let j = 0; j < rots.length; j++) {
    if (j === indice || aeronaveDaRotacao(r, j) !== dono) continue
    if (cruza(ocupacao(proposta), ocupacao(rots[j]))) {
      return `A aeronave já está no ar às ${hhmm(minutos)}: a ${j + 1}ª rotação sai ${hhmm(rots[j].saida)} e só volta ${hhmm(rots[j].voltaBase)}.`
    }
  }
  return null
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
