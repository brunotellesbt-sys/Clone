import { airportSlots, airportUsage, ensureAirports, flightMovements, effectiveAirport, invalidateAirportUsage } from './airportInfrastructure'
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
 *   começa. Uma escala incompleta fica programada e aguarda os trechos
 *   necessários para entrar em operação.
 *
 * Nada de React aqui: é `src/game/`.
 */
import { AIRPORT_BY_IATA, noToqueDeRecolher, TOQUE_DE_RECOLHER, vooPermitido } from './data/airports'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { blockHours } from './economy'
import { distanceBetween } from './geo'
import { motivoDoPar, withEngine } from './spec'
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

/** Mantém o mesmo número nos dias em que o mesmo serviço repete. */
function numeroLivre(s: GameState, from: string, to: string, saida: number): number | undefined {
  const pernas = escalaDe(s)
  const valido = (n?: number): n is number => Number.isInteger(n) && n! >= 1 && n! <= 9999
  const usados = new Set([...pernas.map(p => p.numero).filter(valido), ...Object.values(s.airline.codeshareNumbers ?? {})])
  const repetido = pernas.find(p => p.from === from && p.to === to && p.saida === saida && valido(p.numero))
  if (repetido?.numero) return repetido.numero
  const rota = rotaDoPar(s, from, to)
  const saidaDaRota = !!rota && from === rota.from
  const parOposto = pernas.find(p => p.from === to && p.to === from && valido(p.numero) &&
    (saidaDaRota ? p.numero! > 1 : p.numero! < 9999) &&
    !usados.has(saidaDaRota ? p.numero! - 1 : p.numero! + 1))
  if (parOposto?.numero) return saidaDaRota ? parOposto.numero - 1 : parOposto.numero + 1
  for (let ida = 101; ida < 9999; ida += 2)
    if (!usados.has(ida) && !usados.has(ida + 1)) return ida + (saidaDaRota ? 0 : 1)
  for (let n = 1; n <= 9999; n++) if (!usados.has(n)) return n
  return undefined
}

/** Preenche números em saves anteriores sem renumerar serviços já marcados. */
export function completarNumeros(s: GameState) {
  for (const p of escalaDe(s)) {
    if (!Number.isInteger(p.numero) || p.numero! < 1 || p.numero! > 9999) p.numero = numeroLivre(s, p.from, p.to, p.saida)
  }
}

export function alterarNumeroVoo(s: GameState, pernaId: string, numero: number): string | null {
  const p = escalaDe(s).find(x => x.id === pernaId)
  if (!p) return 'Voo não encontrado.'
  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) return 'Escolha um número entre 1 e 9999.'
  if (Object.values(s.airline.codeshareNumbers ?? {}).includes(numero))
    return 'Esse número já identifica um voo em codeshare.'
  const mesmoServico = (x: Perna) => x.from === p.from && x.to === p.to && x.saida === p.saida
  if (escalaDe(s).some(x => x.numero === numero && !mesmoServico(x)))
    return 'Esse número já identifica outro voo da companhia.'
  for (const x of escalaDe(s)) if (mesmoServico(x)) x.numero = numero
  return null
}

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
/**
 * Atratividade de cada hora cheia, 0h a 23h, a tabela do jogo. Entre uma hora
 * e a seguinte, reta. Picos às 8h e 18h; madrugada vende menos, mas vende —
 * é o voo barato de quem troca o sono pela tarifa, e a conexão que casa com o
 * longo curso.
 */
const POR_HORA = [
  0.90, 0.85, 0.80, 0.75, 0.82, 0.92, 1.02, 1.08, 1.10, 1.08, 1.04, 1.00,
  1.00, 1.00, 1.00, 1.00, 1.04, 1.08, 1.10, 1.08, 1.04, 1.02, 1.00, 0.96,
]

export function atratividadeHorario(min: number): number {
  const h = noDia(min) / 60
  const i = Math.floor(h) % 24
  return POR_HORA[i] + (POR_HORA[(i + 1) % 24] - POR_HORA[i]) * (h - Math.floor(h))
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

/** Indica qualquer desequilíbrio entre saídas e chegadas na semana, em todas as aeronaves. */
export function saldoDiferenteDaRota(s: GameState, r: Route): boolean {
  const voos = pernasDaRota(s, r)
  const saidas = voos.filter((p) => p.from === r.from).length
  const chegadas = voos.filter((p) => p.to === r.from).length
  return saidas !== chegadas
}

export interface SegmentoFaltante {
  dow: number
  dowName: string
  from: string
  to: string
  count: number
}

export function segmentosFaltantesDaRota(s: GameState, r: Route): SegmentoFaltante[] {
  const voos = pernasDaRota(s, r)
  const faltantes: SegmentoFaltante[] = []
  for (let dow = 0; dow < 7; dow++) {
    const ida = voos.filter((p) => p.dow === dow && p.from === r.from && p.to === r.to).length
    const volta = voos.filter((p) => p.dow === dow && p.from === r.to && p.to === r.from).length
    if (ida > volta) {
      faltantes.push({
        dow,
        dowName: DOW_CURTO[dow],
        from: r.to,
        to: r.from,
        count: ida - volta,
      })
    } else if (volta > ida) {
      faltantes.push({
        dow,
        dowName: DOW_CURTO[dow],
        from: r.from,
        to: r.to,
        count: volta - ida,
      })
    }
  }
  return faltantes
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

/** Lacunas de posição que o jogador ainda precisa fechar. */
export function quebrasDe(s: GameState, aircraftId: string): { antes: Perna; depois: Perna }[] {
  const pernas = pernasDe(s, aircraftId)
  return pernas.flatMap((a, i) => {
    const b = pernas[(i + 1) % pernas.length]
    return a.perna.to === b.perna.from ? [] : [{ antes: a.perna, depois: b.perna }]
  })
}

/** Mantém o diagnóstico de partidas que ainda exigiriam um trecho intermediário. */
export function posicionamentos(s: GameState): { aircraftId: string; from: string; to: string }[] {
  return s.airline.fleet.flatMap(ac =>
    quebrasDe(s, ac.id).map(({ antes, depois }) => ({ aircraftId: ac.id, from: antes.to, to: depois.from })),
  )
}

export function escalaContinua(s: GameState, legs: Perna[]): boolean {
  const ordered = legs.map(p => noTempo(s, p)).sort((a, b) => a.partida - b.partida)
  return ordered.every((p, i) => {
    const next = ordered[(i + 1) % ordered.length]
    const departure = next.partida + (i === ordered.length - 1 ? SEMANA : 0)
    return p.perna.to === next.perna.from && p.chegada + p.solo <= departure
  })
}

export interface Disponibilidade {
  ok: boolean
  motivo?: string
  /** Trecho ou sequência ainda a programar após esta perna. */
  precisaFecharEm?: string
}

export function cabeNaEscala(
  s: GameState, aircraftId: string, from: string, to: string, dow: number, saida: number,
  repetirRascunho = false,
): Disponibilidade {
  const ac = aeronaveDa(s, aircraftId)
  if (!ac) return { ok: false, motivo: 'Aeronave não encontrada.' }
  const partida = naSemana(dow * DIA + saida - fuso(from))
  const bloco = Math.round(blockHours(fichaDe(ac), distanceBetween(from, to)) * 60)
  const chegada = partida + bloco
  const solo = AIRCRAFT_BY_ID[ac.typeId].turn

  const pernas = pernasDe(s, aircraftId)
  if (!pernas.length) {
    const casa = ac.base ?? s.airline.hubs[0]
    return casa === from ? { ok: true, precisaFecharEm: from } :
      { ok: false, motivo: `${ac.reg} está em ${casa}. Programe a primeira saída a partir desse aeroporto.` }
  }

  for (const p of pernas) {
    if (adianteNaSemana(p.partida, partida) < p.bloco || adianteNaSemana(partida, p.partida) < bloco) {
      return {
        ok: false,
        motivo: `${ac.reg} está ocupada em ${p.perna.from}–${p.perna.to}, ${DOW_CURTO[p.perna.dow]} ${hhmm(p.perna.saida)}. Pousa ${DOW_CURTO[p.dowChegada]} ${hhmm(p.chegadaLocal)} (horário local).`,
      }
    }
  }

  const nextIndex = pernas.findIndex(p => p.partida > partida)
  const index = nextIndex < 0 ? 0 : nextIndex
  const anterior = pernas[(index + pernas.length - 1) % pernas.length]
  const seguinte = pernas[index]
  // Um lote semanal pode montar os dias da mesma perna como rascunho.
  // A escala só entra em operação quando os trechos intermediários fecharem.
  const mesmaPerna = repetirRascunho && anterior.perna.from === from &&
    anterior.perna.to === to && anterior.perna.saida === saida
  if (anterior.perna.to !== from && !mesmaPerna) {
    return {
      ok: false,
      motivo: `${ac.reg} está em ${anterior.perna.to} após pousar ${DOW_CURTO[anterior.dowChegada]} ${hhmm(anterior.chegadaLocal)}. A saída precisa partir desse aeroporto.`,
    }
  }
  if (adianteNaSemana(anterior.chegada, partida) < anterior.solo) {
    return { ok: false, motivo: `${ac.reg} precisa de ${anterior.solo} min de solo após o pouso em ${anterior.perna.to}.` }
  }
  if (adianteNaSemana(chegada, seguinte.partida) < solo) {
    return { ok: false, motivo: `${ac.reg} precisa de ${solo} min de solo antes de ${seguinte.perna.from}–${seguinte.perna.to}, ${DOW_CURTO[seguinte.perna.dow]} ${hhmm(seguinte.perna.saida)}.` }
  }
  return { ok: true, precisaFecharEm: seguinte.perna.from === to ? undefined : seguinte.perna.from }
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
  if (ac.isReserve) return `${ac.reg} está na reserva de manutenção e só pode substituir aeronaves.`
  const t = fichaDe(ac)
  const a = effectiveAirport(s, from)
  const b = effectiveAirport(s, to)
  if (!a || !b) return 'Aeroporto desconhecido.'
  const dist = distanceBetween(from, to)
  if (t.range < dist) return `${t.name} não alcança a etapa (limite ${Math.round(t.range * 1.852)} km).`
  const barrado = motivoDoPar(t, a, b)
  if (barrado) return barrado
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
export function aeronavesPara(s: GameState, from: string, to: string, dow: number, saida: number, preferredId?: string) {
  const cargo = !!rotaDoPar(s, from, to)?.cargo
  return s.airline.fleet.filter(ac => !ac.isReserve || ac.id === preferredId).map(ac => {
    const tipo = fichaDe(ac)
    const duro = (tipo.payload !== undefined) !== cargo
      ? cargo ? 'A rota exige uma aeronave de carga.' : 'A aeronave só opera em rotas de carga.'
      : aeronaveServe(s, ac, from, to) ?? curfewDaPerna(s, ac.id, from, to, saida)
    if (duro) return { ac, impedimento: duro }
    const disponibilidade = cabeNaEscala(s, ac.id, from, to, dow, saida)
    return {
      ac,
      impedimento: disponibilidade.ok
        ? motivoDeSlots(s, [{ id: '', aircraftId: ac.id, from, to, dow, saida }])
        : disponibilidade.motivo ?? 'Não cabe na escala.',
      precisaFecharEm: disponibilidade.precisaFecharEm,
    }
  })
}

export function motivoDeSlots(s: GameState, legs: Perna[]): string | null {
  const usage = airportUsage(s)
  const additions = new Map<string, number[]>()
  for (const leg of legs) for (const [id, day] of flightMovements(s, leg)) {
    const days = additions.get(id) ?? Array<number>(7).fill(0)
    additions.set(id, days)
    if ((usage.get(id)?.days[day] ?? 0) + ++days[day] > airportSlots(s, id).ownLimit)
      return `${id}: sem slots para mais um movimento nesse dia.`
  }
  return null
}

export function marcarVoo(
  s: GameState, aircraftId: string, from: string, to: string, dow: number, saida: number,
): string | null {
  return inserirVoo(s, aircraftId, from, to, dow, saida)
}

function inserirVoo(
  s: GameState, aircraftId: string, from: string, to: string, dow: number, saida: number,
  repetirRascunho = false,
): string | null {
  ensureAirports(s)
  const ac = aeronaveDa(s, aircraftId)
  if (!ac) return 'Aeronave não encontrada.'
  if (from === to) return 'Origem e destino iguais.'
  const a = effectiveAirport(s, from)
  const b = effectiveAirport(s, to)
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
  const cabe = cabeNaEscala(s, ac.id, from, to, d, hora, repetirRascunho)
  if (!cabe.ok) return cabe.motivo ?? 'Não cabe na escala da aeronave.'
  const slots = motivoDeSlots(s, [{ id: '', aircraftId, from, to, dow: d, saida: hora }])
  if (slots) return slots
  const numero = numeroLivre(s, from, to, hora)
  if (!numero) return 'Todos os números de voo estão em uso.'
  s.airline.escala = [...escalaDe(s), { id: novoId(), numero, aircraftId, from, to, dow: d, saida: hora }]
  sincronizarMalha(s)
  return null
}

export function removerVoo(s: GameState, pernaId: string) {
  s.airline.escala = escalaDe(s).filter((p) => p.id !== pernaId)
  sincronizarMalha(s)
}

/** Um clique pode marcar um dia ou a semana; só as pernas aceitas fazem parte do lote. */
export function marcarLoteVoos(s:GameState,aircraftId:string,from:string,to:string,days:number[],departure:number) {
  const created:Perna[]=[],errors:string[]=[]
  for(const dow of [...new Set(days)].sort((a,b)=>a-b)) {
    const error=inserirVoo(s,aircraftId,from,to,dow,departure,created.length>0)
    if(error)errors.push(`${DOW_CURTO[dow]}: ${error}`)
    else created.push({...escalaDe(s).at(-1)!})
  }
  if (created.length) {
    s.previousCreatedFlights = s.lastCreatedFlights
    s.lastCreatedFlights = created
  }
  return {created:created.length,errors}
}
export function desfazerUltimoLote(s: GameState, previous = false): string | null {
  const batch = previous ? s.previousCreatedFlights : s.lastCreatedFlights
  if(!batch?.length)return 'Nenhum movimento criado para desfazer.'
  const ids=new Set(batch.map(p=>p.id)),current=new Map(escalaDe(s).map(p=>[p.id,p]))
  for(const original of batch){
    const now=current.get(original.id)
    if(now&&(['aircraftId','from','to','dow','saida','numero'] as const).some(key=>now[key]!==original[key]))
      return 'Um voo do movimento foi alterado depois da marcação. Confira a escala antes de removê-lo.'
  }
  s.airline.escala=escalaDe(s).filter(p=>!ids.has(p.id))
  if (!previous) s.lastCreatedFlights = s.previousCreatedFlights
  s.previousCreatedFlights = undefined
  sincronizarMalha(s)
  return null
}

/**
 * Muda a hora de uma perna já marcada.
 *
 * Tira e repõe: a validação de posição olha a escala em volta, e uma perna que
 * se valida contra si mesma sempre colide consigo.
 */
/**
 * Muda o dia e a hora de uma perna, **mantendo a identidade dela**.
 *
 * Por dentro é tirar e pôr de novo, porque é `marcarVoo` quem sabe todas as
 * regras de escala — e repetir essa validação aqui seria duas validações para
 * envelhecer desencontradas. O que não pode mudar é o id: a tela guarda qual
 * perna está aberta pelo id, e trocá-lo a cada tecla do campo de hora fechava
 * o editor no meio da edição. Quem remarca continua olhando o mesmo voo.
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
  const nova = s.airline.escala[s.airline.escala.length - 1]
  if (nova) { nova.id = pernaId; nova.numero = antiga.numero }
  sincronizarMalha(s)
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
  const ida = cabeNaEscala(s, aircraftId, r.from, r.to, dow, hora)
  if (!ida.ok) return ida.motivo ?? 'A ida não cabe na escala da aeronave.'
  if (ida.precisaFecharEm !== r.from)
    return `A escala precisa continuar em ${ida.precisaFecharEm ?? r.to} depois dessa janela.`
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
        const candidatas = aeronavesPara(s, r.from, r.to, dow, hora)
          .filter(c => !c.impedimento && c.precisaFecharEm === r.from)
        if (!candidatas.some(c => !marcarRotacao(s, c.ac.id, r, dow, hora))) continue
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
  invalidateAirportUsage(s)
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
