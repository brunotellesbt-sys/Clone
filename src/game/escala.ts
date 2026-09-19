/**
 * A malha: onde cada aeronave está, a cada minuto da semana.
 *
 * Antes, a escala era uma lista de rotações de ida e volta presas a uma rota, e
 * a aeronave era propriedade dessa rota. Isso tem uma consequência que nenhuma
 * companhia real aceita: o avião que voa GIG–FOR só pode voar GIG–FOR. Na vida
 * real ele chega em Fortaleza e sai de Fortaleza para onde for melhor — Congonhas,
 * Manaus, de volta ao Rio —, e o que amarra tudo é a **posição**: para sair de um
 * aeroporto, o avião precisa estar nele.
 *
 * Este módulo troca a rotação pela **perna** e põe a posição no centro. Uma perna
 * é um trecho com origem, destino, dia da semana e hora local de partida. A escala
 * de uma cauda é a cadeia das pernas dela; a escala da companhia é a união de
 * todas. A rota deixa de ser dona de avião e volta a ser o que sempre foi de
 * verdade: um mercado, com tarifa, histórico e concorrência.
 *
 * Duas decisões sustentam o resto:
 *
 * - **Tudo se compara em UTC.** Uma perna que sai 23:00 de Lisboa e outra que sai
 *   20:00 de Guarulhos podem estar no ar ao mesmo tempo. Comparar hora local dava
 *   respostas erradas em qualquer malha que cruzasse fuso, e a malha existe
 *   justamente para cruzar fuso.
 * - **A semana é circular.** Domingo 23:00 encosta em segunda 00:30, e a escala
 *   se repete: a última perna da semana tem que deixar o avião onde a primeira
 *   começa, senão a semana seguinte não fecha. Quando não fecha, o jogo não
 *   teleporta o avião — ele voa **vazio** até lá, paga e não recebe, que é
 *   exatamente o que uma companhia faz quando erra a escala.
 *
 * Nada de React aqui: é `src/game/`.
 */
import { AIRPORT_BY_IATA, noToqueDeRecolher, TOQUE_DE_RECOLHER, vooPermitido } from './data/airports'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { blockHours } from './economy'
import { distanceBetween } from './geo'
import { pistaServe, withEngine } from './spec'
import type { Aircraft, GameState, Perna, Route } from './types'

export const DIA = 24 * 60
export const SEMANA = 7 * DIA

/** Fuso do aeroporto, em minutos, vindo do tzdata. */
const fuso = (iata: string) => AIRPORT_BY_IATA[iata]?.fuso ?? 0

export const naSemana = (m: number) => ((m % SEMANA) + SEMANA) % SEMANA
export const noDia = (m: number) => ((m % DIA) + DIA) % DIA

/** Distância para a frente na roda da semana. */
export const adianteNaSemana = (de: number, para: number) => naSemana(para - de)

export const hhmm = (min: number) => {
  const m = noDia(Math.round(min))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const DOW_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/**
 * Quanto vale sair a esta hora, de 0,46 a 1,05.
 *
 * A curva tem duas corcovas — manhã cedo e fim de tarde —, que é a forma que a
 * procura tem de verdade, porque quem paga caro viaja a trabalho e quer chegar
 * para trabalhar e voltar para dormir em casa. Seis da manhã vale 0,94, o meio
 * da tarde 0,86 e três da manhã 0,44.
 *
 * **É índice de jogo, não medição.** A forma vem de como as companhias montam
 * grade; os números são escolhidos para dar uma decisão com consequência sem
 * tornar a madrugada inútil — voo noturno continua fechando conta em rota longa,
 * onde o fuso obriga.
 */
export function atratividadeHorario(min: number): number {
  const h = noDia(min) / 60
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

/** Minutos do dia a partir de "07:25". Devolve nulo se não entender. */
export function lerHora(txt: string): number | null {
  const m = txt.trim().match(/^(\d{1,2}):?(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

// ------------------------------------------------------------- a perna no tempo

export const escalaDe = (s: GameState) => s.airline.escala ?? []

export const aeronaveDa = (s: GameState, id: string) => s.airline.fleet.find((a) => a.id === id)

/** Ficha efetiva da cauda: modelo mais motorização instalada. */
export const fichaDe = (ac: Aircraft) => withEngine(AIRCRAFT_BY_ID[ac.typeId], ac.engineId)

/** Minutos de voo da etapa, para a cauda que a voa. */
export function blocoDe(s: GameState, p: Perna): number {
  const ac = aeronaveDa(s, p.aircraftId)
  const t = ac ? fichaDe(ac) : AIRCRAFT_BY_ID.a320
  return Math.round(blockHours(t, distanceBetween(p.from, p.to)) * 60)
}

/** Solo mínimo entre pousar e voltar a sair, em minutos. */
export function soloDe(s: GameState, p: Perna): number {
  const ac = aeronaveDa(s, p.aircraftId)
  return ac ? AIRCRAFT_BY_ID[ac.typeId].turn : AIRCRAFT_BY_ID.a320.turn
}

/** A partida, em minuto da semana em UTC. */
export const partidaUtc = (p: Perna) => naSemana(p.dow * DIA + p.saida - fuso(p.from))

export interface PernaNoTempo {
  perna: Perna
  /** Partida e chegada em minuto da semana, UTC. A chegada pode passar de SEMANA. */
  partida: number
  chegada: number
  bloco: number
  solo: number
  /** Hora local de chegada no destino e o dia da semana em que ela cai. */
  chegadaLocal: number
  dowChegada: number
  internacional: boolean
}

export function noTempo(s: GameState, p: Perna): PernaNoTempo {
  const bloco = blocoDe(s, p)
  const partida = partidaUtc(p)
  const chegada = partida + bloco
  const localChegada = chegada + fuso(p.to)
  return {
    perna: p,
    partida,
    chegada,
    bloco,
    solo: soloDe(s, p),
    chegadaLocal: noDia(localChegada),
    dowChegada: Math.floor(naSemana(localChegada) / DIA),
    internacional: AIRPORT_BY_IATA[p.from]?.cc !== AIRPORT_BY_IATA[p.to]?.cc,
  }
}

/** As pernas de uma cauda, em ordem de partida. */
export function pernasDe(s: GameState, aircraftId: string): PernaNoTempo[] {
  return escalaDe(s)
    .filter((p) => p.aircraftId === aircraftId)
    .map((p) => noTempo(s, p))
    .sort((a, b) => a.partida - b.partida)
}

/** As pernas de um par de aeroportos, nos dois sentidos. */
export function pernasDaRota(s: GameState, r: Route): Perna[] {
  return escalaDe(s).filter(
    (p) => (p.from === r.from && p.to === r.to) || (p.from === r.to && p.to === r.from),
  )
}

/** Quantas partidas a rota tem num dia da semana, contando os dois sentidos. */
export function pernasDoDia(s: GameState, r: Route, dow: number): Perna[] {
  return pernasDaRota(s, r).filter((p) => p.dow === dow)
}

/**
 * Voos da rota num dia, em **rotações equivalentes**.
 *
 * O resto do jogo conta rotação — uma ida e uma volta —, porque é assim que a
 * oferta e o custo sempre foram medidos. Numa malha triangular não há volta, e
 * meia rotação é o número honesto: duas pernas fazem uma rotação, três fazem uma
 * e meia, e a oferta de assento acompanha.
 */
export const rotacoesEquivalentes = (s: GameState, r: Route, dow: number) =>
  pernasDoDia(s, r, dow).length / 2

// ------------------------------------------------------------------- a posição

export interface Parada {
  iata: string
  /** Minuto da semana (UTC) em que o avião fica disponível e em que precisa sair. */
  de: number
  ate: number
  /** A parada atravessa o fim da semana sem nenhuma perna depois. */
  ocioso: boolean
}

/**
 * Onde a cauda fica parada, entre uma perna e a seguinte.
 *
 * Com a escala vazia, o avião fica na base o tempo todo — é de lá que a primeira
 * perna dele pode sair. Com uma perna só, ele sai, chega e espera a semana
 * inteira para repetir: a lacuna vai da chegada até a partida da semana seguinte,
 * e é por isso que a conta é circular.
 */
export function paradasDe(s: GameState, aircraftId: string): Parada[] {
  const ac = aeronaveDa(s, aircraftId)
  const pernas = pernasDe(s, aircraftId)
  if (!pernas.length) {
    const casa = ac?.base ?? s.airline.hubs[0]
    return casa ? [{ iata: casa, de: 0, ate: SEMANA, ocioso: true }] : []
  }
  return pernas.map((p, i) => {
    const prox = pernas[(i + 1) % pernas.length]
    // a próxima partida pode ser na semana seguinte; a roda cuida disso
    const ate = prox.partida + (pernas.length === 1 || i === pernas.length - 1 ? SEMANA : 0)
    return { iata: p.perna.to, de: p.chegada, ate, ocioso: false }
  })
}

/**
 * A escala da cauda fecha a semana?
 *
 * Fecha quando cada perna começa onde a anterior terminou, inclusive na virada
 * de domingo para segunda. Não fechar não é proibido — a tela avisa e o jogo
 * cobra um voo de posicionamento —, mas é quase sempre erro de quem montou.
 */
export function quebrasDe(s: GameState, aircraftId: string): { antes: Perna; depois: Perna }[] {
  const pernas = pernasDe(s, aircraftId)
  const out: { antes: Perna; depois: Perna }[] = []
  for (let i = 0; i < pernas.length; i++) {
    const a = pernas[i]
    const b = pernas[(i + 1) % pernas.length]
    if (a.perna.to !== b.perna.from) out.push({ antes: a.perna, depois: b.perna })
  }
  return out
}

/**
 * Os voos vazios que a escala obriga.
 *
 * Quando a cadeia não fecha, o avião precisa chegar de algum jeito onde a próxima
 * perna começa. O jogo não o teleporta: manda um voo de posicionamento, que
 * queima combustível, paga tripulação e taxa e não vende um assento. É o preço
 * real de uma escala malfeita, e aparece no custo do dia.
 */
export function posicionamentos(s: GameState): { aircraftId: string; from: string; to: string }[] {
  const out: { aircraftId: string; from: string; to: string }[] = []
  for (const ac of s.airline.fleet) {
    for (const q of quebrasDe(s, ac.id)) {
      out.push({ aircraftId: ac.id, from: q.antes.to, to: q.depois.from })
    }
  }
  return out
}

export interface Disponibilidade {
  /** Pode voar. Ainda assim pode exigir posicionamento. */
  ok: boolean
  /** Por que não pode — só quando `ok` é falso. */
  motivo?: string
  /** De onde ela teria que vir vazia para cumprir esta perna. */
  ferryDe?: string
  /** Para onde ela teria que seguir vazia depois. */
  ferryPara?: string
}

/**
 * A cauda consegue voar esta perna, e a que preço?
 *
 * A separação entre **não pode** e **pode, mas vazio** é o centro da malha, e
 * custou uma tentativa errada para ficar clara. A primeira versão exigia que a
 * cadeia fechasse a cada perna marcada, e isso torna impossível montar um
 * triângulo: para marcar REC–CNF a cauda precisa já ter o CNF–GRU marcado, e
 * para marcar o CNF–GRU ela precisa já ter o REC–CNF. Um impede o outro, e o
 * jogador fica preso na ida e volta — exatamente o que a malha vem desfazer.
 *
 * Então a regra dura é só uma, e é física: **o avião não está em dois lugares
 * ao mesmo tempo**, com solo suficiente entre um pouso e a decolagem seguinte.
 * A continuidade de posição é regra mole: quando a perna anterior pousa em
 * outro lugar, a escala não está errada, está **cara** — o avião voa vazio até
 * lá, e o jogo cobra isso no custo do dia.
 */
export function cabeNaEscala(
  s: GameState, aircraftId: string, from: string, to: string, dow: number, saida: number,
): Disponibilidade {
  const ac = aeronaveDa(s, aircraftId)
  if (!ac) return { ok: false, motivo: 'Aeronave não encontrada.' }
  const partida = naSemana(dow * DIA + saida - fuso(from))
  const t = fichaDe(ac)
  const bloco = Math.round(blockHours(t, distanceBetween(from, to)) * 60)
  const solo = AIRCRAFT_BY_ID[ac.typeId].turn
  const chegada = partida + bloco

  const pernas = pernasDe(s, aircraftId)
  if (!pernas.length) {
    const casa = ac.base ?? s.airline.hubs[0]
    return casa === from ? { ok: true } : { ok: true, ferryDe: casa }
  }

  for (const p of pernas) {
    // regra dura: nada de sobrepor tempo de voo com outra perna
    const dentro = (m: number) => adianteNaSemana(p.partida, m) < p.bloco
    if (dentro(partida) || dentro(chegada) || adianteNaSemana(partida, p.partida) < bloco) {
      return {
        ok: false,
        motivo: `${ac.reg} está no ar: ${p.perna.from}–${p.perna.to} sai ${DOW_CURTO[p.perna.dow]} ${hhmm(p.perna.saida)}.`,
      }
    }
  }

  // a anterior é a última que chega antes desta sair; a seguinte, a primeira que
  // sai depois desta chegar
  const anterior = [...pernas].sort(
    (a, b) => adianteNaSemana(a.chegada, partida) - adianteNaSemana(b.chegada, partida),
  )[0]
  const seguinte = [...pernas].sort(
    (a, b) => adianteNaSemana(chegada, a.partida) - adianteNaSemana(chegada, b.partida),
  )[0]

  if (adianteNaSemana(anterior.chegada, partida) < anterior.solo) {
    return {
      ok: false,
      motivo: `${ac.reg} pousa em ${anterior.perna.to} ${hhmm(anterior.chegadaLocal)} e não tem os ${anterior.solo} min de solo antes desta partida.`,
    }
  }
  if (adianteNaSemana(chegada, seguinte.partida) < solo) {
    return {
      ok: false,
      motivo: `${ac.reg} não tem ${solo} min de solo em ${to} antes de ${seguinte.perna.from}–${seguinte.perna.to}, ${DOW_CURTO[seguinte.perna.dow]} ${hhmm(seguinte.perna.saida)}.`,
    }
  }
  return {
    ok: true,
    ferryDe: anterior.perna.to === from ? undefined : anterior.perna.to,
    ferryPara: seguinte.perna.from === to ? undefined : seguinte.perna.from,
  }
}

// -------------------------------------------------------------- marcar e tirar

let seqPerna = 0
const novoId = () => `pn${Date.now().toString(36)}${(seqPerna++).toString(36)}`

/**
 * As restrições que não dependem da escala: alcance, pista, alfândega, toque de
 * recolher. Separadas porque a lista de aeronaves disponíveis precisa delas por
 * cauda, e o motivo tem que chegar na tela do mesmo jeito.
 */
export function aeronaveServe(s: GameState, ac: Aircraft, from: string, to: string): string | null {
  const t = fichaDe(ac)
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  if (!a || !b) return 'Aeroporto desconhecido.'
  const dist = distanceBetween(from, to)
  if (t.range < dist) return `${t.name} não alcança a etapa (limite ${Math.round(t.range * 1.852)} km).`
  if (!pistaServe(t, a, b)) return 'Pista curta demais em uma das pontas.'
  if (ac.groundedUntil > s.day) return `${ac.reg} está em manutenção pesada.`
  return null
}

/** Toque de recolher nas duas pontas da perna. */
export function curfewDaPerna(
  s: GameState, aircraftId: string, from: string, to: string, saida: number,
): string | null {
  const ac = aeronaveDa(s, aircraftId)
  const t = ac ? fichaDe(ac) : AIRCRAFT_BY_ID.a320
  const bloco = Math.round(blockHours(t, distanceBetween(from, to)) * 60)
  const chegada = saida + bloco + (fuso(to) - fuso(from))
  for (const [iata, quando, oque] of [[from, saida, 'a partida'], [to, chegada, 'a chegada']] as const) {
    if (noToqueDeRecolher(iata, quando)) {
      const [fecha, abre] = TOQUE_DE_RECOLHER[iata]
      return `${iata} não opera das ${String(fecha).padStart(2, '0')}h às ${String(abre).padStart(2, '0')}h, e ${oque} cairia ${hhmm(quando)}.`
    }
  }
  return null
}

/**
 * Caudas que podem voar esta perna, com o motivo de cada recusa.
 *
 * É a pergunta central da tela nova: o jogador cria o voo — de onde, para onde,
 * que dia, que hora — e o jogo responde **quem está lá para voá-lo**. A cauda
 * que não está no aeroporto não aparece como escolha, e o motivo diz onde ela
 * está, para o jogador conseguir montar a cadeia em vez de adivinhar.
 */
export function aeronavesPara(s: GameState, from: string, to: string, dow: number, saida: number) {
  return s.airline.fleet.map((ac) => {
    const duro = aeronaveServe(s, ac, from, to) ?? curfewDaPerna(s, ac.id, from, to, saida)
    if (duro) return { ac, impedimento: duro, ferryDe: undefined, ferryPara: undefined }
    const d = cabeNaEscala(s, ac.id, from, to, dow, saida)
    return { ac, impedimento: d.ok ? null : d.motivo ?? 'Não cabe na escala.', ferryDe: d.ferryDe, ferryPara: d.ferryPara }
  })
}

export function marcarVoo(
  s: GameState, aircraftId: string, from: string, to: string, dow: number, saida: number,
): string | null {
  const ac = aeronaveDa(s, aircraftId)
  if (!ac) return 'Aeronave não encontrada.'
  if (from === to) return 'Origem e destino iguais.'
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  if (!a || !b) return 'Aeroporto desconhecido.'
  const barrado = vooPermitido(a, b)
  if (barrado) return barrado
  const rota = rotaDoPar(s, from, to)
  if (!rota) return `Não há rota aberta entre ${from} e ${to}.`
  const t = fichaDe(ac)
  const cargueiro = t.payload !== undefined
  if (cargueiro !== !!rota.cargo) {
    return cargueiro
      ? `${t.name} é cargueiro e só voa em rota de carga.`
      : `${t.name} não tem porta de carga: rota de carga pede cargueiro.`
  }
  const hora = noDia(Math.round(saida))
  const d = ((Math.round(dow) % 7) + 7) % 7
  const duro = aeronaveServe(s, ac, from, to) ?? curfewDaPerna(s, ac.id, from, to, hora)
  if (duro) return duro
  const cabe = cabeNaEscala(s, ac.id, from, to, d, hora)
  if (!cabe.ok) return cabe.motivo ?? 'Não cabe na escala da aeronave.'
  s.airline.escala = [...escalaDe(s), { id: novoId(), aircraftId, from, to, dow: d, saida: hora }]
  sincronizarMalha(s)
  return null
}

export function removerVoo(s: GameState, pernaId: string) {
  s.airline.escala = escalaDe(s).filter((p) => p.id !== pernaId)
  sincronizarMalha(s)
}

/**
 * Muda a hora de uma perna já marcada.
 *
 * Tira e repõe: a validação de posição olha a escala em volta, e uma perna que
 * se valida contra si mesma sempre colide consigo.
 */
export function remarcarVoo(s: GameState, pernaId: string, dow: number, saida: number): string | null {
  const antiga = escalaDe(s).find((p) => p.id === pernaId)
  if (!antiga) return 'Voo não encontrado.'
  const guardada = escalaDe(s)
  s.airline.escala = guardada.filter((p) => p.id !== pernaId)
  const erro = marcarVoo(s, antiga.aircraftId, antiga.from, antiga.to, dow, saida)
  if (erro) {
    s.airline.escala = guardada
    sincronizarMalha(s)
    return erro
  }
  return null
}

/** A rota aberta que serve este par, em qualquer sentido. */
export const rotaDoPar = (s: GameState, a: string, b: string) =>
  s.airline.routes.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a))

// ------------------------------------------------------------------ automático

/** Janela em que o agendador automático trabalha. */
const INICIO = 6 * 60
const JANELA = 17 * 60 // 06:00 às 23:00

/**
 * As idas e voltas que a rota tem num dia, agrupadas pela cauda que as voa.
 *
 * Uma rotação é uma perna de ida e a perna seguinte **da mesma cauda** que
 * desfaz o trecho. Numa malha triangular não existe essa volta — a cauda segue
 * para um terceiro aeroporto —, e essas pernas não formam rotação nenhuma:
 * ficam de fora, porque o agendador automático não as montou e não tem como
 * desfazê-las sem quebrar a cadeia do jogador.
 */
export function rotacoesNoDia(s: GameState, r: Route, dow: number): Perna[][] {
  const out: Perna[][] = []
  const usadas = new Set<string>()
  for (const p of pernasDoDia(s, r, dow)) {
    if (usadas.has(p.id) || p.from !== r.from) continue
    const cadeia = pernasDe(s, p.aircraftId)
    const i = cadeia.findIndex((x) => x.perna.id === p.id)
    const volta = i >= 0 ? cadeia[(i + 1) % cadeia.length] : undefined
    if (!volta || volta.perna.to !== p.from || usadas.has(volta.perna.id)) continue
    usadas.add(p.id)
    usadas.add(volta.perna.id)
    out.push([p, volta.perna])
  }
  return out
}

/** O que a rotação vale: a média da atratividade das duas pernas. */
const valorDaRotacao = (rot: Perna[]) =>
  rot.reduce((soma, p) => soma + atratividadeHorario(p.saida), 0) / Math.max(1, rot.length)

/**
 * Marca uma ida e volta inteira com uma cauda, ou não marca nada.
 *
 * A meia rotação é o pior resultado possível: a ida sai e o avião fica parado na
 * ponta até a semana virar. Por isso a volta é condição da ida — se ela não
 * couber, a ida é desfeita.
 *
 * A hora da volta é a **local do destino**, e isso já foi escrito errado uma
 * vez: `assignAircraft` somava bloco e solo à hora da partida sem o fuso, o que
 * punha a volta de Dubai saindo sete horas fora do lugar. A escala aceitava,
 * porque fisicamente cabia; o que não fechava era a cadeia, e o jogo cobrava
 * voo vazio de posicionamento numa escala que o próprio jogo tinha montado —
 * vinte e oito deles numa frota de vinte e nove.
 */
export function marcarRotacao(
  s: GameState, aircraftId: string, r: Route, dow: number, hora: number,
): string | null {
  const ac = aeronaveDa(s, aircraftId)
  if (!ac) return 'Aeronave não encontrada.'
  const erroIda = marcarVoo(s, aircraftId, r.from, r.to, dow, hora)
  if (erroIda) return erroIda
  const bloco = Math.round(blockHours(fichaDe(ac), r.distance) * 60)
  const solo = AIRCRAFT_BY_ID[ac.typeId].turn
  // chegada e saída de volta na hora local do destino
  const saidaVolta = hora + bloco + solo + (fuso(r.to) - fuso(r.from))
  const dowVolta = (dow + Math.floor(naSemana(saidaVolta) / DIA)) % 7
  const erroVolta = marcarVoo(s, aircraftId, r.to, r.from, dowVolta, noDia(saidaVolta))
  if (erroVolta) {
    const ida = escalaDe(s).filter((p) => p.aircraftId === aircraftId).pop()
    if (ida) removerVoo(s, ida.id)
    return erroVolta
  }
  return null
}

/**
 * Monta `quantas` idas e voltas de uma rota num dia, escolhendo as caudas.
 *
 * É o caminho rápido — "quero três voos por dia" — e continua sendo o que a
 * frequência faz. A diferença é que agora ele **procura** aeronave em vez de usar
 * a que estava presa à rota: pega quem está na base no horário, marca a ida,
 * marca a volta, e repete. Uma cauda que já esteja voando outra coisa àquela hora
 * simplesmente não é escolhida.
 */
export function montarRotacoes(s: GameState, routeId: string, dow: number, quantas: number): string | null {
  const r = s.airline.routes.find((x) => x.id === routeId)
  if (!r) return 'Rota não encontrada.'
  const alvo = Math.max(0, Math.round(quantas))
  const atuais = pernasDoDia(s, r, dow)
  // tira o que sobra pela hora: sai o voo de pior horário, não o último marcado
  if (atuais.length / 2 > alvo) {
    /**
     * Corta **rotações inteiras**, nunca pernas soltas.
     *
     * A primeira versão ordenava todas as pernas do dia por atratividade e
     * tirava as piores. A volta quase sempre cai em horário pior que a ida —
     * ela sai no meio da tarde ou à noite, depois do bloco e do solo —, então o
     * corte tirava as voltas e deixava só idas: "sábado: GRU-REC 07:00 |
     * GRU-REC 07:00", com o avião preso em Recife e o jogo cobrando voo vazio
     * de uma escala que ele mesmo montou. O agendador automático só desfaz o
     * que ele saberia montar, e o que ele monta é ida e volta.
     */
    const rotacoes = rotacoesNoDia(s, r, dow)
    const fora = [...rotacoes]
      .sort((a, b) => valorDaRotacao(a) - valorDaRotacao(b))
      .slice(0, Math.max(0, rotacoes.length - alvo))
    for (const rot of fora) for (const p of rot) removerVoo(s, p.id)
    return null
  }
  let faltam = alvo - rotacoesNoDia(s, r, dow).length
  if (faltam <= 0) return null

  let marcou = 0

  /**
   * Cada rotação nasce no seu lugar na janela, e só depois procura vaga em
   * volta.
   *
   * A primeira versão varria a janela do começo e pegava a primeira hora livre,
   * o que empilhava tudo no começo do dia: com duas caudas, os dois voos saíam
   * 06:00 e 06:30. Eles disputam o mesmo pico, o jogo marca como voos colados e
   * a tarde fica descoberta — o contrário do que espalhar quer dizer.
   */
  for (let i = 0; i < alvo && faltam > 0; i++) {
    const ideal = INICIO + Math.round((JANELA * i) / Math.max(1, alvo))
    for (let desvio = 0; desvio <= 5 * 60; desvio += 30) {
      const horas = desvio === 0 ? [ideal] : [ideal + desvio, ideal - desvio]
      let feito = false
      for (const bruta of horas) {
        const hora = noDia(bruta)
        if (hora < INICIO || hora > INICIO + JANELA) continue
        // quem já está na base primeiro: escolher quem precisaria de voo vazio é
        // resolver a frequência pedida gastando combustível à toa
        const candidatas = aeronavesPara(s, r.from, r.to, dow, hora)
          .filter((c) => !c.impedimento)
          .sort((a, b) => Number(!!a.ferryDe) - Number(!!b.ferryDe))
        if (!candidatas.length) continue
        if (marcarRotacao(s, candidatas[0].ac.id, r, dow, hora)) continue
        marcou++
        faltam--
        feito = true
        break
      }
      if (feito) break
    }
  }
  if (faltam > 0 && marcou === 0) {
    return 'Nenhuma aeronave disponível: não há cauda parada nesta base com folga no horário.'
  }
  return faltam > 0 ? 'A frota só cobriu parte da frequência pedida.' : null
}

// ---------------------------------------------------------------- sincronizar

/**
 * Recalcula o que é derivado da escala: frequência da rota, caudas da rota e a
 * rota dedicada de cada cauda.
 *
 * Existe porque meia dúzia de telas, o estimador e a IA já liam `freq` e
 * `aircraftIds`, e reescrever tudo isso de uma vez seria trocar um sistema que
 * funciona por outro sem medida no meio. Aqui eles viram **cache**, com uma
 * fonte só — a escala — e um lugar só que a atualiza.
 */
export function sincronizarMalha(s: GameState) {
  const porRota = new Map<string, { freq: number[]; caudas: Set<string> }>()
  for (const r of s.airline.routes) porRota.set(r.id, { freq: [0, 0, 0, 0, 0, 0, 0], caudas: new Set() })
  const rotaDaCauda = new Map<string, Set<string>>()

  for (const p of escalaDe(s)) {
    const r = rotaDoPar(s, p.from, p.to)
    if (!r) continue
    const acc = porRota.get(r.id)!
    acc.freq[p.dow] += 1
    acc.caudas.add(p.aircraftId)
    const dela = rotaDaCauda.get(p.aircraftId) ?? new Set()
    dela.add(r.id)
    rotaDaCauda.set(p.aircraftId, dela)
  }

  for (const r of s.airline.routes) {
    const acc = porRota.get(r.id)!
    // `freq` sempre foi rotação, e rotação são duas pernas
    r.freq = acc.freq.map((n) => Math.round(n / 2))
    r.aircraftIds = [...acc.caudas]
  }
  for (const ac of s.airline.fleet) {
    const dela = rotaDaCauda.get(ac.id)
    // dedicada só quando a semana inteira dela é de um par só
    ac.routeId = dela && dela.size === 1 ? [...dela][0] : null
  }
}

/**
 * Traz o save antigo para a malha.
 *
 * A partida antiga guardava rotações de ida e volta por rota, com as aeronaves
 * em rodízio. A conversão reproduz exatamente essa escala em pernas — mesma
 * hora, mesma cauda —, para ninguém abrir um save salvo e achar a companhia
 * remontada por cima.
 */
export function migrarEscala(s: GameState) {
  if (s.airline.escala) return
  const pernas: Perna[] = []
  for (const r of s.airline.routes) {
    const qtd = Math.max(0, ...r.freq)
    if (!qtd || !r.aircraftIds.length) continue
    const ac = s.airline.fleet.find((a) => a.id === r.aircraftIds[0])
    const t = ac ? fichaDe(ac) : AIRCRAFT_BY_ID.a320
    const bloco = Math.round(blockHours(t, r.distance) * 60)
    const solo = ac ? AIRCRAFT_BY_ID[ac.typeId].turn : AIRCRAFT_BY_ID.a320.turn
    for (let i = 0; i < qtd; i++) {
      const cauda = r.aircraftIds[i % r.aircraftIds.length]
      const saida = r.horarios?.[i] ?? noDia(7 * 60 + i * (2 * bloco + solo))
      for (let dow = 0; dow < 7; dow++) {
        if ((r.freq[dow] ?? 0) <= i) continue
        const volta = saida + 2 * bloco + solo
        pernas.push({ id: novoId(), aircraftId: cauda, from: r.from, to: r.to, dow, saida })
        pernas.push({
          id: novoId(), aircraftId: cauda, from: r.to, to: r.from,
          dow: (dow + Math.floor(volta / DIA)) % 7,
          // a volta sai do destino, em hora local dele
          saida: noDia(saida + bloco + solo + (fuso(r.to) - fuso(r.from))),
        })
      }
    }
  }
  s.airline.escala = pernas
  for (const ac of s.airline.fleet) if (!ac.base) ac.base = s.airline.hubs[0]
  sincronizarMalha(s)
}
