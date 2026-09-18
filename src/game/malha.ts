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
import { AIRPORT_BY_IATA, noToqueDeRecolher, TOQUE_DE_RECOLHER, type Airport } from './data/airports'
import { distanceNm } from './geo'
import { hashStr } from './rng'
import { baseDemand } from './demand'
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

/** Quantas rotações a rota tem no dia mais cheio da semana. */
export const rotacoesPorDia = (r: Route) => Math.max(0, Math.max(...r.freq))

/**
 * Quais rotações voam num dia da semana.
 *
 * O horário é um só para os sete dias — companhia de verdade tem grade de
 * semana e de fim de semana, e isso o jogo não modela. O que ele modela é o
 * corte: num dia de frequência menor **sai o voo pior**, não o último da lista.
 * Antes, sábado com um voo só usava sempre o slot das seis da manhã, porque
 * sobravam as primeiras; agora sobra o de maior procura, que é o que uma
 * companhia faria.
 */
export function rotacoesDoDia(s: GameState, r: Route, dow: number): Rotacao[] {
  const todas = rotacoesDa(s, r)
  const quantas = Math.max(0, Math.min(r.freq[dow] ?? 0, todas.length))
  if (quantas >= todas.length) return todas
  return [...todas]
    .sort((a, b) => atratividadeHorario(b.saida) - atratividadeHorario(a.saida))
    .slice(0, quantas)
    .sort((a, b) => a.indice - b.indice)
}

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

/**
 * As duas pontas de uma rota de concorrente na **sua** base, em hora local dela.
 *
 * A concorrente não tem escala de verdade: cada rota dela tem uma hora de
 * partida do hub dela e uma frequência. Daí sai o resto — se a base é o destino
 * dela, o voo chega depois do bloco e volta depois do solo; se a base é o hub
 * dela, sai na hora e volta no fim da rotação.
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
    // o hub dela é a sua base: parte na hora e volta no fim da rotação
    return { parte: hora, chega: hora + 2 * bloco + solo, internacional, outraPonta: cr.to }
  }
  if (cr.to === base) {
    const delta = fusoMin(b) - fusoMin(a)
    const chega = hora + bloco + delta
    return { chega, parte: chega + solo, internacional, outraPonta: cr.from }
  }
  return null
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
  /** Nome da parceira, quando a conexão atravessa companhia. */
  parceira?: string
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

  /**
   * Interline: os voos das parceiras que tocam esta base entram dos dois lados.
   *
   * A parceira aparece como uma rotação só, porque é o que se sabe dela. O
   * tempo mínimo é o mesmo — alfândega não pergunta de quem é o voo —, e o par
   * fica marcado com o nome dela para a tela poder dizer de quem é.
   */
  for (const comp of s.competitors) {
    if (!s.airline.acordos?.includes(comp.id)) continue
    for (const cr of comp.routes) {
      const p = pontasDaConcorrente(cr, base)
      if (!p) continue
      const dela: Rotacao = {
        routeId: `X:${comp.id}:${cr.key}`, indice: 0,
        saida: p.parte, chegadaDestino: p.parte, saidaDestino: p.parte,
        voltaBase: p.chega, bloco: 0, internacional: p.internacional,
      }
      for (const minha of partidas) {
        const espera = adiante(dela.voltaBase, minha.saida)
        const minimo = mct(dela.internacional, minha.internacional)
        if (espera >= minimo && espera <= ESPERA_MAXIMA) {
          out.push({ de: dela, para: minha, espera, minimo, parceira: comp.name })
        }
      }
      for (const minha of chegadas) {
        const espera = adiante(minha.voltaBase, dela.saida)
        const minimo = mct(minha.internacional, dela.internacional)
        if (espera >= minimo && espera <= ESPERA_MAXIMA) {
          out.push({ de: minha, para: dela, espera, minimo, parceira: comp.name })
        }
      }
    }
  }
  return out.sort((x, y) => x.espera - y.espera)
}

/**
 * Quanto uma conexão interline vale, comparada com uma da própria companhia.
 *
 * Menos, e por motivo concreto: bilhete separado, bagagem que troca de sistema,
 * e nenhuma das duas companhias se responsabiliza pela conexão perdida da
 * outra. O passageiro sabe disso e prefere a conexão online quando existe.
 */
export const DESCONTO_INTERLINE = 0.45

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

/** De 0 a 1: quanto da escala sai entre 22h e 6h, que é o que a folha cobra a mais. */
export function fracaoNoturna(s: GameState, r: Route): number {
  const rots = rotacoesDa(s, r)
  if (!rots.length) return 0
  const noite = (min: number) => { const h = min / 60 % 24; return h >= 22 || h < 6 }
  // conta a ida e a volta: as duas pontas pagam tripulação e taxa
  const pernas = rots.flatMap((rot) => [rot.saida, rot.saidaDestino])
  return pernas.filter(noite).length / pernas.length
}

/** A média da rota, que é o que entra na disputa por passageiro. */
export function atratividadeDaRota(s: GameState, r: Route, dow?: number): number {
  const rots = dow === undefined ? rotacoesDa(s, r) : rotacoesDoDia(s, r, dow)
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
  const rots = rotacoesDa(s, r)
  if (!rots[indice]) return null
  const bloco = rots[indice].bloco
  const solo = soloMin(s, r)
  const a = AIRPORT_BY_IATA[r.from]
  const b = AIRPORT_BY_IATA[r.to]
  const delta = fusoMin(b) - fusoMin(a)
  // as quatro pontas da rotação, cada uma na hora local do seu aeroporto
  const pontas: [string, number, string][] = [
    [r.from, minutos, 'a partida'],
    [r.to, minutos + bloco + delta, 'a chegada'],
    [r.to, minutos + bloco + delta + solo, 'a saída de volta'],
    [r.from, minutos + 2 * bloco + solo, 'a volta'],
  ]
  for (const [iata, quando, oque] of pontas) {
    if (noToqueDeRecolher(iata, quando)) {
      const [fecha, abre] = TOQUE_DE_RECOLHER[iata]
      return `${iata} não opera das ${String(fecha).padStart(2, '0')}h às ${String(abre).padStart(2, '0')}h, e ${oque} cairia ${hhmm(quando)}.`
    }
  }
  const dono = aeronaveDaRotacao(r, indice)
  if (!dono) return null
  const proposta: Rotacao = { ...rots[indice], saida: minutos, voltaBase: minutos + 2 * bloco + solo }
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
 * Demanda de referência de um trajeto de conexão, em passageiros por dia.
 *
 * Uma conexão que serve um mercado deste tamanho vale por uma inteira; abaixo
 * disso vale proporcionalmente menos. O número é a ordem de grandeza de um par
 * secundário com voo diário — não é medição, é a régua que separa "isto é um
 * trajeto que alguém faz" de "isto é um par que só fecha no relógio".
 */
const DEMANDA_REFERENCIA = 400

/**
 * Peso de um trajeto de conexão: o mercado das **duas pontas**, não do meio.
 *
 * A primeira versão contava par que fecha no horário e parava aí. Duas rotas
 * suas podem se encaixar no relógio servindo um trajeto que ninguém faz — dois
 * regionais de estados diferentes ligados pelo seu hub —, e o bônus vinha
 * igual ao de Recife–São Paulo–Lisboa. Agora cada par entra pelo tamanho do
 * mercado de ponta a ponta, com teto de um.
 */
function pesoDoTrajeto(de: string, para: string, dia: number, doy: number): number {
  if (de === para) return 0
  return Math.min(1, baseDemand(de, para, dia, doy).total / DEMANDA_REFERENCIA)
}

/**
 * Soma de peso de conexão por rota, numa base, num dia.
 *
 * Memoizado porque a conta é quadrática nas rotas e o tick chama uma vez por
 * rota: sem o cache, uma malha de cinquenta rotas fazia duas mil e quinhentas
 * avaliações de demanda **por rota**, cinquenta vezes por dia simulado.
 */
const cacheConexao = new Map<string, Map<string, number>>()

export function pesosDeConexao(s: GameState, base: string, doy: number): Map<string, number> {
  const chave = `${base}|${s.day}|${s.airline.routes.length}|${s.airline.acordos?.join(',') ?? ''}`
  const pronto = cacheConexao.get(chave)
  if (pronto) return pronto
  const pesos = new Map<string, number>()
  const somar = (id: string, v: number) => pesos.set(id, (pesos.get(id) ?? 0) + v)
  /** A ponta de fora da base, seja de uma rota sua ou de uma parceira. */
  const pontaDe = (rotacao: Rotacao): string | null => {
    const minha = s.airline.routes.find((r) => r.id === rotacao.routeId)
    if (minha) return minha.from === base ? minha.to : minha.from
    const [, compId, key] = rotacao.routeId.split(':')
    const comp = s.competitors.find((c) => c.id === compId)
    const cr = comp?.routes.find((r) => r.key === key)
    return cr ? pontasDaConcorrente(cr, base)?.outraPonta ?? null : null
  }
  for (const c of conexoesNaBase(s, base)) {
    const pontaA = pontaDe(c.de)
    const pontaB = pontaDe(c.para)
    if (!pontaA || !pontaB) continue
    const peso = pesoDoTrajeto(pontaA, pontaB, s.day, doy) * (c.parceira ? DESCONTO_INTERLINE : 1)
    // só a perna que é sua ganha o bônus: a da parceira é receita dela
    if (s.airline.routes.some((r) => r.id === c.de.routeId)) somar(c.de.routeId, peso)
    if (s.airline.routes.some((r) => r.id === c.para.routeId)) somar(c.para.routeId, peso)
  }
  // o cache é de um dia só; guardar mais seria guardar demanda de ontem
  if (cacheConexao.size > 8) cacheConexao.clear()
  cacheConexao.set(chave, pesos)
  return pesos
}

export function fatorConexaoIA(rotasNoHub: number): number {
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * Math.max(0, rotasNoHub - 1))
}

export function fatorConexao(s: GameState, r: Route, doy = 180): number {
  if (!r.horarios && rotacoesPorDia(r) === 0) return 1
  const base = s.airline.hubs.includes(r.from) ? r.from : r.to
  const peso = pesosDeConexao(s, base, doy).get(r.id) ?? 0
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * peso)
}
