import type { SeatConfig } from './types'
import { custoDeFabrica, normalizeSeats, seatChangeCost } from './seatModels'
import { AIRCRAFT_BY_ID, type AircraftType } from './data/aircraft'
import { SAVE_VERSION } from './save'
import { AIRPORT_BY_IATA, vooPermitido } from './data/airports'
import {
  atratividadeDaRota, atratividadeHorario, fatorConexao, fatorConexaoIA, fracaoNoturna,
  horaDaConcorrente,
} from './malha'
import {
  escalaDe, marcarRotacao, montarRotacoes, pernasDoDia, posicionamentos, removerVoo, rotaDoPar,
  sincronizarMalha,
} from './escala'
import { BLANK_LIVERY } from '../livery/presets'
import { baseDemand, cargoDemand, CLASS_FARE_MULT } from './demand'
import { cabinComfort, checkCabin, clampPitch, crewFor, defaultCabin } from './cabin'
import { engineIdFor, motivoDoPar, withEngine } from './spec'
import {
  addCabins, allocateCargoMarket, allocateMarket, blockHours, CARGO_SELLABLE, escalarCabins,
  classPriceExponent,
  limitarCabins,
  DISTRIBUTION_RATE, emptyCabins, flightCost, leaseMonthly, marketPrice,
  maxDailyFrequency, resaleValue, SELLABLE, sumCabins, ticketRevenue,
  type CargoCarrier, type Carrier,
} from './economy'
import { distanceBetween, odKey } from './geo'
import {
  createCompetitors, DENSIDADE_PADRAO, fundarCompanhia, limparCacheDestinos, stepCompetitors,
} from './ai'
import { between, chance, hashStr, makeRng, type Rng } from './rng'
import {
  CABINS, type Aircraft, type Cabins, type Competitor, type DayResult, type GameState, type Livery,
  type Notice, type Route, type Densidade,
} from './types'

/**
 * A escala do relógio: quanto vale, em tempo real, uma hora de jogo a 1×.
 *
 * Dois minutos e meio, o que põe o dia de jogo em uma hora de relógio. É
 * decisão do dono do jogo, e é uma mudança grande: o dia passava em 900 ms, ou
 * seja, uma hora de jogo em trinta e sete milissegundos. O jogo virava um
 * cronômetro correndo — dava para abrir uma rota e perder um mês antes de
 * terminar de ler a tela.
 *
 * As outras velocidades são múltiplos disto, como sempre foram: 4× põe o dia
 * em quinze minutos, 12× em cinco, 40× em um e meio.
 *
 * O mapa segue a **mesma** escala. Ele tinha um laço próprio que rodava o dia
 * em trinta e quatro segundos independente da velocidade, e com isso o avião
 * desenhado nunca esteve onde a simulação dizia. Agora os dois contam a mesma
 * hora.
 */
export const MINUTOS_REAIS_POR_HORA = 2.5
export const MS_POR_DIA = 24 * MINUTOS_REAIS_POR_HORA * 60 * 1000

/**
 * Caixa de fundação. Dá para comprar uma frota de verdade no primeiro ano em
 * vez de começar arrendando um turboélice — a partida deixa de ser sobre
 * sobreviver ao primeiro mês e passa a ser sobre escolher a malha.
 */
export const START_CASH = 500e6
export const HQ_DAILY_BASE = 9500
const LEDGER_KEEP = 420
const HISTORY_KEEP = 60

let idCounter = 1
const nextId = (p: string) => `${p}${(idCounter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

export function registration(rng: Rng, cc: string): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const l = () => L[Math.floor(rng() * L.length)]
  if (cc === 'BR') return `PR-${l()}${l()}${l()}`
  if (cc === 'US') return `N${Math.floor(between(rng, 100, 899))}${l()}${l()}`
  return `${l()}${l()}-${l()}${l()}${l()}`
}

export function newGame(opts: {
  name: string; code: string; hub: string; livery?: Livery; seed?: number
  /** Quantas concorrentes enfrentar; ver `DENSIDADES` em `ai.ts`. */
  densidade?: Densidade
}): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9)
  const rng = makeRng(seed)
  // o ranking de destinos é guardado entre chamadas; partida nova não herda o
  // mundo da anterior, que na tela de fundação muda a cada tecla digitada
  limparCacheDestinos()
  return {
    version: SAVE_VERSION,
    seed,
    day: 0,
    startYear: 2027,
    fuelPrice: 0.8,
    airline: {
      name: opts.name,
      code: opts.code,
      hubs: [opts.hub],
      livery: opts.livery ?? structuredClone(BLANK_LIVERY),
      reputation: 0.5,
      cash: START_CASH,
      fleet: [],
      routes: [],
      loans: [],
      marketing: 0,
    },
    competitors: createCompetitors(rng, opts.densidade ?? DENSIDADE_PADRAO, opts.hub),
    densidade: opts.densidade ?? DENSIDADE_PADRAO,
    fundadas: {},
    ledger: [],
    notices: [{ day: 0, kind: 'info', text: `${opts.name} recebeu o certificado de operador. Bem-vindo ao mercado.` }],
    lastShare: {},
    paused: true,
    speed: 1,
    tutorialStep: 0,
  }
}

// ---------------------------------------------------------------- utilidades

export const gameDate = (s: GameState) => {
  const d = new Date(Date.UTC(s.startYear, 0, 1))
  d.setUTCDate(d.getUTCDate() + s.day)
  return d
}
export const dayOfYear = (s: GameState) => {
  const d = gameDate(s)
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000)
}
export const dowOf = (s: GameState) => gameDate(s).getUTCDay()

/** O modelo cru, sem motorização aplicada. */
export const modelOf = (ac: Aircraft) => AIRCRAFT_BY_ID[ac.typeId]
/** A ficha efetiva: modelo + motor instalado. */
export const typeOf = (ac: Aircraft) => withEngine(AIRCRAFT_BY_ID[ac.typeId], ac.engineId)
export const routeOf = (s: GameState, id: string) => s.airline.routes.find((r) => r.id === id)
export const aircraftOf = (s: GameState, id: string) => s.airline.fleet.find((a) => a.id === id)

/**
 * Movimentos que a companhia já usa num aeroporto, no dia mais cheio da semana.
 *
 * Conta **pernas** — cada partida e cada chegada é um movimento de pista —, e
 * pelo dia de pico, porque slot é dimensionado pelo pior dia, não pela média.
 */
export function slotsUsed(s: GameState, iata: string): number {
  const porDia = [0, 0, 0, 0, 0, 0, 0]
  for (const p of escalaDe(s)) {
    if (p.from === iata) porDia[p.dow] += 1
    if (p.to === iata) porDia[p.dow] += 1
  }
  return Math.max(...porDia)
}
/** Parte da capacidade do aeroporto que já é de outras companhias. */
export const slotsTaken = (iata: string) => Math.round(AIRPORT_BY_IATA[iata].slots * 0.62)
export const slotsFree = (s: GameState, iata: string) =>
  AIRPORT_BY_IATA[iata].slots - slotsTaken(iata) - slotsUsed(s, iata)

export const fleetValue = (s: GameState) =>
  s.airline.fleet.reduce((sum, a) => sum + (a.leased ? 0 : resaleValue(typeOf(a), a.age, a.condition)), 0)
export const debtTotal = (s: GameState) => s.airline.loans.reduce((sum, l) => sum + l.balance, 0)
export const netWorth = (s: GameState) => s.airline.cash + fleetValue(s) - debtTotal(s)

export function creditLimit(s: GameState): number {
  const base = 40e6 + fleetValue(s) * 0.65 + Math.max(0, netWorth(s)) * 0.35
  return Math.max(0, base - debtTotal(s))
}

export function notify(s: GameState, kind: Notice['kind'], text: string) {
  s.notices.unshift({ day: s.day, kind, text })
  if (s.notices.length > 60) s.notices.length = 60
}

// ------------------------------------------------------------------- ações

/** Prazo típico de contrato, em meses: é por ele que o interior se dilui. */
export const PRAZO_DO_ARRENDAMENTO = 60

export interface BuyOptions {
  /** Motorização escolhida; sem isso vem a de série do modelo. */
  engineId?: string
  /** Peso premium da configuração inicial de cabine. */
  seatBias?: number
  /**
   * Cabine encomendada de fábrica, no lugar da de série.
   *
   * Quem escolhe aqui paga as poltronas junto com a aeronave e recebe o avião
   * pronto para voar; quem escolhe depois paga as mesmas poltronas **mais** a
   * reforma, e fica com a cauda parada enquanto a oficina trabalha.
   */
  cabine?: { seats: Cabins; pitch: Cabins; seatConfig?: SeatConfig }
}

export function buyAircraft(s: GameState, typeId: string, lease: boolean, opts: BuyOptions = {}): string | null {
  const model = AIRCRAFT_BY_ID[typeId]
  if (!model) return 'Modelo inexistente.'
  const engineId = engineIdFor(model, opts.engineId)
  const t = withEngine(model, engineId)
  const year = s.startYear + s.day / 365
  if (year < model.since) return `O ${model.name} só entra em linha em ${model.since}.`
  if (year < t.since) return `Essa motorização só passa a ser oferecida em ${t.since}.`
  const price = marketPrice(t)
  const rng = makeRng(s.seed + s.day + s.airline.fleet.length * 977)
  const hubCc = AIRPORT_BY_IATA[s.airline.hubs[0]]?.cc ?? 'BR'
  const encomenda = opts.cabine
  const cabin = encomenda
    ? { seats: encomenda.seats, pitch: clampPitch(encomenda.pitch) }
    : defaultCabin(model, opts.seatBias ?? 1)
  if (encomenda) {
    const chk = checkCabin(t, cabin.seats, cabin.pitch, encomenda.seatConfig)
    if (chk.invalid || chk.seatError || chk.overLength || chk.overLimit)
      return chk.seatError ?? 'A cabine encomendada não cabe nesta aeronave.'
  }
  /**
   * A fábrica cobra as poltronas à parte, e o arrendamento também — só que
   * diluídas.
   *
   * Quem compra paga o interior junto com o avião. Quem arrenda não: o
   * arrendador instala o interior que foi pedido e o cobra na mensalidade,
   * pelo prazo do contrato. Cobrar à vista de quem arrendou inverteria o
   * sentido do arrendamento — uma cabine de suítes num widebody custa dezenas
   * de milhões, e quem arrenda é justamente quem não quer esse desembolso.
   */
  const poltronas = encomenda ? custoDeFabrica(cabin.seats, encomenda.seatConfig) : 0
  const mensal = lease ? leaseMonthly(t) + poltronas / PRAZO_DO_ARRENDAMENTO : 0
  const upfront = lease ? mensal * 2 : price + poltronas
  if (s.airline.cash < upfront) return 'Caixa insuficiente.'
  s.airline.cash -= upfront
  s.airline.fleet.push({
    id: nextId('ac'),
    typeId,
    engineId,
    reg: registration(rng, hubCc),
    cc: hubCc,
    seats: cabin.seats,
    pitch: cabin.pitch,
    seatConfig: encomenda ? normalizeSeats(model, encomenda.seatConfig) : undefined,
    age: lease ? between(rng, 0.5, 6) : 0,
    hours: 0,
    cycles: 0,
    condition: 1,
    routeId: null,
    base: s.airline.hubs[0],
    leased: lease,
    lease: mensal,
    value: lease ? 0 : price,
    groundedUntil: 0,
  })
  notify(s, 'good', `${model.name} ${lease ? 'arrendado' : 'comprado'} — entrou na frota.`)
  return null
}

export function sellAircraft(s: GameState, id: string): string | null {
  const ac = aircraftOf(s, id)
  if (!ac) return 'Aeronave não encontrada.'
  unassignAircraft(s, id)
  const t = typeOf(ac)
  if (ac.leased) {
    const penalty = ac.lease * 3
    if (s.airline.cash < penalty) return 'Caixa insuficiente para a multa de devolução.'
    s.airline.cash -= penalty
    notify(s, 'info', `${t.name} ${ac.reg} devolvido ao arrendador (multa de ${money(penalty)}).`)
  } else {
    const v = resaleValue(t, ac.age, ac.condition)
    s.airline.cash += v
    notify(s, 'info', `${t.name} ${ac.reg} vendido por ${money(v)}.`)
  }
  s.airline.fleet = s.airline.fleet.filter((a) => a.id !== id)
  return null
}

/**
 * Preço de abrir uma rota, pela distância: dois degraus e nada mais.
 *
 * O corte é 5.000 km — o limite prático do corredor único, onde a etapa deixa
 * de ser um avião e uma tripulação e passa a exigir tripulação de revezamento,
 * apoio na outra ponta e negociação de par de slots intercontinental. O preço
 * salta junto, e por isso o degrau é degrau e não uma reta.
 */
export const KM_LONGO_CURSO = 5000
export const CUSTO_ROTA_CURTA = 1.5e6
export const CUSTO_ROTA_LONGA = 5e6

export function routeSlotCost(from: string, to: string): number {
  return distanceBetween(from, to) * KM_POR_NM > KM_LONGO_CURSO
    ? CUSTO_ROTA_LONGA
    : CUSTO_ROTA_CURTA
}

/**
 * Abre uma rota. `cargo` decide o mercado que ela disputa, e é escolha do
 * jogador na abertura — não dá para deduzir da aeronave, porque a rota nasce
 * sem nenhuma alocada.
 */
export function openRoute(s: GameState, from: string, to: string, cargo = false): string | null {
  if (from === to) return 'Origem e destino iguais.'
  /**
   * A rota precisa tocar uma base **ou** dois aeroportos que a companhia já
   * serve.
   *
   * A regra antiga era só a base, e ela sozinha impedia a malha: uma cauda que
   * chega em Fortaleza não podia emendar para Congonhas, porque Fortaleza–
   * Congonhas não tocava o hub e a rota nem podia ser aberta. Exigir que as duas
   * pontas já sejam atendidas é o que uma companhia real enfrenta — estação
   * nova custa pessoal, contrato de handling e balcão, e por isso a linha
   * transversal só aparece onde ela já pousa.
   */
  const serve = (i: string) =>
    s.airline.hubs.includes(i) || s.airline.routes.some((r) => r.from === i || r.to === i)
  if (!s.airline.hubs.includes(from) && !s.airline.hubs.includes(to)) {
    if (!serve(from) || !serve(to)) {
      return 'A rota tem que tocar uma base, ou ligar dois aeroportos que você já atende.'
    }
  }
  if (s.airline.routes.some((r) => odKey(r.from, r.to) === odKey(from, to)))
    return 'Você já opera esse par.'
  const barrado = vooPermitido(AIRPORT_BY_IATA[from], AIRPORT_BY_IATA[to])
  if (barrado) return barrado
  if (slotsFree(s, from) < 2 || slotsFree(s, to) < 2) return 'Sem slots disponíveis em uma das pontas.'
  const cost = routeSlotCost(from, to)
  if (s.airline.cash < cost) return `Abrir a rota custa ${money(cost)} em slots e taxas.`
  s.airline.cash -= cost
  const dist = distanceBetween(from, to)
  s.airline.routes.push({
    id: nextId('rt'),
    from: s.airline.hubs.includes(from) ? from : to,
    to: s.airline.hubs.includes(from) ? to : from,
    distance: dist,
    aircraftIds: [],
    freq: [1, 1, 1, 1, 1, 1, 1],
    fare: { y: 1, w: 1, c: 1, f: 1 },
    ...(cargo ? { cargo: true } : {}),
    openedDay: s.day,
    history: [],
  })
  /**
   * A rota nasce **sem voo marcado**, e isso é escolha.
   *
   * Por uma versão ela nascia voando uma vez por dia, para não deixar uma linha
   * no mapa sem avião. O dono do jogo pediu o contrário, e tem razão: quem
   * monta a escala é o jogador, e um voo que aparece sozinho na grade de uma
   * cauda que ele acabou de comprar é o jogo decidindo por ele. A tela já diz
   * "sem voo marcado: a rota não voa", que é o aviso de que falta um passo.
   */
  notify(s, 'good', `Rota ${cargo ? 'de carga ' : ''}${from}–${to} aberta (${km(dist)}).`)
  return null
}

export function closeRoute(s: GameState, id: string): string | null {
  const r = routeOf(s, id)
  if (!r) return 'Rota não encontrada.'
  // os voos da rota saem da escala junto: sem rota, a perna não tem mercado
  for (const p of escalaDe(s).filter((x) => rotaDoPar(s, x.from, x.to)?.id === id)) removerVoo(s, p.id)
  s.airline.routes = s.airline.routes.filter((x) => x.id !== id)
  sincronizarMalha(s)
  notify(s, 'info', `Rota ${r.from}–${r.to} encerrada.`)
  return null
}

/**
 * Dedica uma cauda a uma rota: monta a semana inteira de ida e volta com ela.
 *
 * A alocação deixou de ser um vínculo — a aeronave não pertence mais a rota
 * nenhuma — e virou um atalho de escala: "põe este avião para voar isto todo
 * dia". Quem quiser a cauda circulando pela malha marca voo a voo, que é o
 * caminho que este botão abrevia.
 */
export function assignAircraft(s: GameState, acId: string, routeId: string): string | null {
  const ac = aircraftOf(s, acId)
  const r = routeOf(s, routeId)
  if (!ac || !r) return 'Seleção inválida.'
  const t = typeOf(ac)
  // Cargueiro não tem cabine e avião de passageiro não tem porta de carga: um
  // não substitui o outro, e misturar os dois na mesma rota faria metade dos
  // voos disputar um mercado que a rota não atende.
  const cargueiro = t.payload !== undefined
  if (cargueiro && !r.cargo) return `${t.name} é cargueiro e só voa em rota de carga.`
  if (!cargueiro && r.cargo) return `${t.name} não tem porta de carga: rota de carga pede cargueiro.`
  if (t.range < r.distance) return `${t.name} não alcança ${km(r.distance)} (limite ${km(t.range)}).`
  const from = AIRPORT_BY_IATA[r.from]
  const to = AIRPORT_BY_IATA[r.to]
  // `motivoDoPar`, não `runway`: o que decide é a pista em que o avião opera de
  // fato, com peso reduzido, corrigida pela elevação de cada ponta — e, onde a
  // pista não é quem manda, o teto de porte do aeroporto.
  const barrado = motivoDoPar(t, from, to)
  if (barrado) return barrado

  let marcou = 0
  let ultimoErro: string | null = null
  for (let dow = 0; dow < 7; dow++) {
    // uma rotação por dia, no primeiro horário de pico que a cauda conseguir
    for (const hora of [7 * 60, 9 * 60, 12 * 60, 15 * 60, 18 * 60, 6 * 60]) {
      const erro = marcarRotacao(s, acId, r, dow, hora)
      if (erro) { ultimoErro = erro; continue }
      marcou++
      break
    }
  }
  return marcou ? null : ultimoErro ?? 'Não foi possível encaixar esta rota na escala da aeronave.'
}

/** Tira da escala todas as pernas de uma cauda — na malha inteira ou só numa rota. */
export function unassignAircraft(s: GameState, acId: string, routeId?: string) {
  const r = routeId ? routeOf(s, routeId) : null
  for (const p of escalaDe(s)) {
    if (p.aircraftId !== acId) continue
    if (r && rotaDoPar(s, p.from, p.to)?.id !== r.id) continue
    removerVoo(s, p.id)
  }
  sincronizarMalha(s)
}


/**
 * Pede `value` rotações da rota num dia: a escala é montada, não decretada.
 *
 * A frequência era um número que a rota guardava; agora é o resultado de quantos
 * voos o jogo conseguiu encaixar com a frota que estava disponível. Pedir cinco
 * e receber três não é bug — é a resposta de que não há cauda parada na base
 * naquelas horas, e é a informação que faltava antes.
 */
export function setFrequency(s: GameState, routeId: string, dow: number, value: number): string | null {
  const r = routeOf(s, routeId)
  if (!r) return null
  const v = Math.max(0, Math.min(routeCapacityLimit(s, r), Math.round(value)))
  const atual = Math.floor(pernasDoDia(s, r, dow).length / 2)
  if (v > atual) {
    const extra = (v - atual) * 2
    if (slotsFree(s, r.from) < extra || slotsFree(s, r.to) < extra) {
      return 'Sem slots para aumentar a frequência.'
    }
  }
  return montarRotacoes(s, routeId, dow, v)
}

export function setAllFrequencies(s: GameState, routeId: string, value: number) {
  for (let d = 0; d < 7; d++) setFrequency(s, routeId, d, value)
}

/**
 * Máximo de rotações diárias que a frota da rota aguenta.
 *
 * Com a malha, "a frota da rota" é quem já voa nela mais quem está livre para
 * voar: um avião sem escala nenhuma conta, porque é exatamente ele que o
 * `montarRotacoes` vai procurar.
 */
export function routeCapacityLimit(s: GameState, r: Route): number {
  let total = 0
  for (const ac of s.airline.fleet) {
    const serve = r.aircraftIds.includes(ac.id) || escalaDe(s).every((p) => p.aircraftId !== ac.id)
    if (!serve) continue
    const t = typeOf(ac)
    if (t.range < r.distance) continue
    if ((t.payload !== undefined) !== !!r.cargo) continue
    total += maxDailyFrequency(t, r.distance) / 2
  }
  return Math.max(1, Math.floor(total))
}

export function setFare(s: GameState, routeId: string, cabin: keyof Cabins, mult: number) {
  const r = routeOf(s, routeId)
  if (!r) return
  r.fare[cabin] = Math.max(0.55, Math.min(1.9, mult))
}

export function setCabin(s: GameState, acId: string, seats: Cabins, pitch: Cabins, seatConfig?: SeatConfig): string | null {
  const ac = aircraftOf(s, acId)
  if (!ac) return null
  const t = modelOf(ac)
  const p = clampPitch(pitch)
  const chk = checkCabin(t, seats, p, seatConfig)
  if (chk.invalid) return 'Informe uma quantidade válida de assentos para uma aeronave de passageiros.'
  if (chk.seatError) return chk.seatError
  if (chk.overLength) return 'A configuração não cabe no comprimento da cabine.'
  if (chk.overLimit) return `O limite de saídas do ${t.name} é de ${t.maxSeats} passageiros.`
  // Poltrona premium é cara e demora a instalar; mexer no passo da econômica é barato.
  const cost = seatChangeCost(seats, seatConfig)
  if (s.airline.cash < cost) return `A reconfiguração custa ${money(cost)}.`
  s.airline.cash -= cost
  ac.seats = { y: Math.round(seats.y), w: Math.round(seats.w), c: Math.round(seats.c), f: Math.round(seats.f) }
  ac.pitch = p
  ac.seatConfig = normalizeSeats(t, seatConfig)
  ac.groundedUntil = s.day + (seats.c + seats.f > 0 ? 4 : 2)
  return null
}

/** Quantas cabines dá para guardar. */
export const MAX_CABINES = 24

/**
 * Guarda a cabine montada com um nome, para reusar em outra aeronave do modelo.
 *
 * Guarda **o que está na tela**, não o que está instalado no avião: o jogador
 * monta, salva e só então decide se aplica naquela cauda — e se ele tivesse que
 * aplicar antes de poder salvar, cada configuração experimental custaria uma
 * reforma e dois dias de avião parado.
 *
 * Nome repetido sobrescreve o anterior em vez de criar um segundo com o mesmo
 * rótulo. Duas entradas idênticas na lista são um defeito, não uma escolha.
 */
export function salvarCabine(
  s: GameState, typeId: string, nome: string, seats: Cabins, pitch: Cabins, seatConfig?: SeatConfig,
): string | null {
  const t = AIRCRAFT_BY_ID[typeId]
  if (!t) return 'Modelo inexistente.'
  const limpo = nome.trim().slice(0, 32)
  if (!limpo) return 'Dê um nome à configuração.'
  const p = clampPitch(pitch)
  const chk = checkCabin(t, seats, p, seatConfig)
  if (!chk.ok) return chk.seatError ?? 'Essa configuração não é válida; ajuste antes de salvar.'
  const lista = (s.airline.cabines ??= [])
  const igual = lista.find((x) => x.typeId === typeId && x.nome.toLowerCase() === limpo.toLowerCase())
  const nova = {
    id: igual?.id ?? nextId('cb'),
    nome: limpo,
    typeId,
    seats: { ...seats },
    pitch: p,
    seatConfig: normalizeSeats(t, seatConfig),
  }
  if (igual) lista[lista.indexOf(igual)] = nova
  else {
    if (lista.length >= MAX_CABINES) return `Já são ${MAX_CABINES} configurações guardadas; apague uma.`
    lista.push(nova)
  }
  return null
}

export function apagarCabine(s: GameState, id: string): string | null {
  const lista = s.airline.cabines
  const i = lista?.findIndex((x) => x.id === id) ?? -1
  if (!lista || i < 0) return 'Configuração não encontrada.'
  lista.splice(i, 1)
  return null
}

/** As cabines guardadas que servem num modelo. */
export const cabinesDoModelo = (s: GameState, typeId: string) =>
  (s.airline.cabines ?? []).filter((c) => c.typeId === typeId)

/** Preço de abrir base, igual em qualquer aeroporto. */
export const HUB_COST = 20e6

export function addHub(s: GameState, iata: string): string | null {
  if (s.airline.hubs.includes(iata)) return 'Já é uma base sua.'
  const ap = AIRPORT_BY_IATA[iata]
  if (s.airline.reputation < 0.45 + 0.05 * ap.tier)
    return 'Reputação insuficiente para negociar espaço nesse aeroporto.'
  if (s.airline.cash < HUB_COST) return `Abrir base em ${iata} custa ${money(HUB_COST)}.`
  s.airline.cash -= HUB_COST
  s.airline.hubs.push(iata)
  notify(s, 'good', `Nova base em ${ap.city} (${iata}).`)
  return null
}

/**
 * Acordo de interline com uma concorrente.
 *
 * Custa proporcional ao tamanho da malha dela na sua base — quem tem mais voo
 * ali tem mais a oferecer e cobra por isso — e exige reputação, porque ninguém
 * põe o próprio passageiro num voo de companhia que não confia.
 */
export const CUSTO_ACORDO_BASE = 8e6
export const REPUTACAO_ACORDO = 0.5

export function custoDoAcordo(s: GameState, comp: Competitor): number {
  const nasBases = comp.routes.filter((r) =>
    s.airline.hubs.includes(r.from) || s.airline.hubs.includes(r.to)).length
  return CUSTO_ACORDO_BASE + nasBases * 1.6e6
}

export function assinarAcordo(s: GameState, compId: string): string | null {
  const comp = s.competitors.find((c) => c.id === compId)
  if (!comp) return 'Companhia não encontrada.'
  s.airline.acordos ??= []
  if (s.airline.acordos.includes(compId)) return 'Vocês já têm acordo.'
  const toca = comp.routes.some((r) => s.airline.hubs.includes(r.from) || s.airline.hubs.includes(r.to))
  if (!toca) return `${comp.name} não voa para nenhuma das suas bases: não há o que conectar.`
  if (s.airline.reputation < REPUTACAO_ACORDO)
    return 'Reputação insuficiente: ninguém assina interline com quem não conhece.'
  const custo = custoDoAcordo(s, comp)
  if (s.airline.cash < custo) return `O acordo com ${comp.name} custa ${money(custo)}.`
  s.airline.cash -= custo
  s.airline.acordos.push(compId)
  notify(s, 'good', `Acordo de interline com ${comp.name}.`)
  return null
}

export function romperAcordo(s: GameState, compId: string) {
  const comp = s.competitors.find((c) => c.id === compId)
  s.airline.acordos = (s.airline.acordos ?? []).filter((id) => id !== compId)
  if (comp) notify(s, 'info', `Acordo com ${comp.name} encerrado.`)
}

export function takeLoan(s: GameState, amount: number): string | null {
  const limit = creditLimit(s)
  if (amount <= 0) return null
  if (amount > limit) return `Seu limite de crédito hoje é ${money(limit)}.`
  const leverage = debtTotal(s) / Math.max(1e6, fleetValue(s) + s.airline.cash)
  const rate = 0.055 + 0.09 * leverage + (s.airline.reputation < 0.5 ? 0.02 : 0)
  s.airline.loans.push({
    id: nextId('ln'), principal: amount, balance: amount,
    rate: Math.min(0.19, rate), takenDay: s.day, termDays: 365 * 7,
  })
  s.airline.cash += amount
  notify(s, 'info', `Empréstimo de ${money(amount)} a ${(rate * 100).toFixed(1)}% ao ano.`)
  return null
}

export function repayLoan(s: GameState, id: string, amount: number): string | null {
  const l = s.airline.loans.find((x) => x.id === id)
  if (!l) return null
  const pay = Math.min(amount, l.balance, s.airline.cash)
  if (pay <= 0) return 'Sem caixa para amortizar.'
  s.airline.cash -= pay
  l.balance -= pay
  if (l.balance < 1) s.airline.loans = s.airline.loans.filter((x) => x.id !== id)
  return null
}

export const setMarketing = (s: GameState, perDay: number) => {
  s.airline.marketing = Math.max(0, Math.min(400000, Math.round(perDay)))
}

// -------------------------------------------------------------- simulação

interface RouteDay {
  route: Route
  flights: number
  seats: Cabins
  /** Assentos vendáveis (base do rateio de mercado). */
  seatsTotal: number
  /** Assentos físicos instalados — é contra eles que se mede o aproveitamento. */
  physicalSeats: number
  /** Passo médio por classe na rota, ponderado por assento. */
  pitch: Cabins
  /** A cauda de cada perna do dia, na ordem da escala. */
  pernas: Aircraft[]
}

/**
 * As caudas que a escala manda voar esta rota hoje, uma por perna.
 *
 * Aeronave em manutenção pesada não voa, e a perna dela simplesmente não sai —
 * que é o que acontece de verdade quando um avião fica em hangar: o voo é
 * cancelado, não transferido para outro por mágica.
 */
function aeronavesDoDia(s: GameState, r: Route, dow: number): Aircraft[] {
  return pernasDoDia(s, r, dow)
    .map((p) => aircraftOf(s, p.aircraftId))
    .filter((a): a is Aircraft => !!a && a.groundedUntil <= s.day)
}

export function advanceDay(s: GameState): GameState {
  s.day += 1
  const dow = dowOf(s)
  const doy = dayOfYear(s)
  const rng = makeRng(s.seed * 31 + s.day)

  // Combustível: passeio aleatório com reversão à média.
  s.fuelPrice = Math.max(0.42, Math.min(1.6, s.fuelPrice + (0.82 - s.fuelPrice) * 0.006 + between(rng, -0.018, 0.018)))

  // 1) O que a companhia coloca no ar hoje.
  const perRoute: RouteDay[] = []
  const carriersByOd = new Map<string, Carrier[]>()
  const perCargo: { route: Route; flights: number; tons: number; pernas: Aircraft[] }[] = []
  const playerQuality = (0.72 + 0.55 * s.airline.reputation) * (1 + Math.min(0.12, s.airline.marketing / 2.4e6))

  for (const r of s.airline.routes) {
    // Uma cauda por perna marcada: a escala é que diz quem voa o quê hoje.
    const pernas = aeronavesDoDia(s, r, dow)
    if (pernas.length === 0) continue
    // Duas pernas fazem uma rotação, que é como a oferta sempre foi medida.
    const flights = pernas.length / 2

    // Rota de carga não tem cabine: sai por outro caminho, com outro mercado.
    if (r.cargo) {
      let tons = 0
      for (const ac of pernas) tons += (typeOf(ac).payload ?? 0) * CARGO_SELLABLE
      if (tons > 0) perCargo.push({ route: r, flights, tons, pernas })
      continue
    }

    let seats: Cabins = emptyCabins()
    let physicalSeats = 0
    let comfort = 0
    // Passo médio da rota, ponderado por assento: é o que vira tarifa depois.
    const pitchAcc: Cabins = emptyCabins()
    const pitchW: Cabins = emptyCabins()
    // Nem todo assento é vendável, e o mix de horários varia dia a dia.
    const sellable = SELLABLE * between(rng, 0.96, 1.02)
    for (const ac of pernas) {
      const t = typeOf(ac)
      // Agora a conta é por perna: cada uma oferece os assentos dela, uma vez.
      seats = addCabins(seats, {
        y: ac.seats.y * sellable, w: ac.seats.w * sellable,
        c: ac.seats.c * sellable, f: ac.seats.f * sellable,
      })
      physicalSeats += sumCabins(ac.seats)
      for (const cb of CABINS) {
        pitchAcc[cb] += ac.pitch[cb] * ac.seats[cb]
        pitchW[cb] += ac.seats[cb]
      }
      comfort += t.comfort * cabinComfort(t, ac.seats, ac.pitch, ac.seatConfig) * (0.85 + 0.15 * ac.condition)
    }
    comfort /= pernas.length
    const pitch: Cabins = {
      y: pitchW.y ? pitchAcc.y / pitchW.y : 31,
      w: pitchW.w ? pitchAcc.w / pitchW.w : 38,
      c: pitchW.c ? pitchAcc.c / pitchW.c : 60,
      f: pitchW.f ? pitchAcc.f / pitchW.f : 83,
    }
    const fareAvg = (r.fare.y * 3 + r.fare.c) / 4
    const key = odKey(r.from, r.to)
    const list = carriersByOd.get(key) ?? []
    // o horário entra como qualidade: voo de madrugada disputa em desvantagem
    list.push({
      id: `P:${r.id}`, seats, freq: flights, fareMult: fareAvg,
      quality: playerQuality * comfort * atratividadeDaRota(s, r, dow),
    })
    carriersByOd.set(key, list)
    perRoute.push({ route: r, flights, seats, seatsTotal: sumCabins(seats), physicalSeats, pitch, pernas })
  }

  // 2) Concorrentes no mesmo par.
  for (const comp of s.competitors) {
    for (const cr of comp.routes) {
      const list = carriersByOd.get(cr.key) ?? []
      const premium = 0.12
      list.push({
        id: `C:${comp.id}:${cr.key}`,
        seats: {
          y: cr.seats * cr.freq * 2 * SELLABLE * (1 - premium),
          w: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.35,
          c: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.6,
          f: cr.seats * cr.freq * 2 * SELLABLE * premium * 0.05,
        },
        freq: cr.freq,
        fareMult: cr.fare,
        quality: cr.quality * atratividadeHorario(horaDaConcorrente(cr)),
      })
      carriersByOd.set(cr.key, list)
    }
  }

  // 3) Reparte a demanda e apura o dia da companhia.
  const today: DayResult = {
    day: s.day, pax: emptyCabins(), flights: 0, seats: 0, revenue: 0, cost: 0, profit: 0, loadFactor: 0,
  }
  const pressure: Record<string, number> = {}
  s.lastShare = {}

  for (const rd of perRoute) {
    const r = rd.route
    const key = odKey(r.from, r.to)
    const demand = baseDemand(r.from, r.to, s.day, doy)
    const carriers = carriersByOd.get(key) ?? []
    const alloc = allocateMarket(demand, carriers)
    const mine = alloc.find((a) => a.id === `P:${r.id}`)
    /**
     * Passageiro de conexão entra **somando**, depois do rateio do mercado.
     *
     * Quem voa Recife–São Paulo–Lisboa não estava no mercado Recife–São Paulo:
     * ele existe porque as duas pontas se encaixam no horário. Se o ganho da
     * malha entrasse no rateio, o jogo estaria dizendo que a conexão rouba
     * passageiro local do concorrente, e não é isso que acontece — a fatia
     * registrada continua sendo a do mercado local, sem o acréscimo.
     */
    const conexao = fatorConexao(s, r, doy)
    const noturno = fracaoNoturna(s, r, dow)
    // teto no assento ofertado: conexão preenche poltrona vazia, não cria
    // poltrona. Sem isto o aproveitamento passava de 100%, que é impossível.
    const pax = limitarCabins(escalarCabins(mine?.pax ?? emptyCabins(), conexao), rd.seats)
    s.lastShare[key] = mine?.share ?? 0
    pressure[key] = mine?.share ?? 0

    const gross = ticketRevenue(pax, r.fare, demand.refFare, rd.pitch)
    const cargo = gross * (r.distance > 2200 ? 0.11 : 0.05)
    const revenue = (gross + cargo) * (1 - DISTRIBUTION_RATE)

    // Custo: uma conta por perna voada, com a cauda que a escala pôs nela.
    let cost = 0
    const legs = Math.max(1, rd.pernas.length)
    const paxPerLeg = sumCabins(pax) / legs
    const premiumPerLeg = (pax.w + pax.c + pax.f) / legs
    for (const ac of rd.pernas) {
      const t = typeOf(ac)
      const c = flightCost(t, r.distance, r.from, r.to, s.fuelPrice, ac.age, paxPerLeg, premiumPerLeg, crewFor(ac.seats), noturno)
      cost += c.total
      ac.hours += c.blockH
      ac.cycles += 1
      ac.condition = Math.max(0, ac.condition - (0.00028 + c.blockH * 0.00013))
    }

    const dayRes: DayResult = {
      day: s.day,
      pax,
      flights: rd.flights,
      seats: rd.physicalSeats,
      revenue,
      cost,
      profit: revenue - cost,
      loadFactor: rd.physicalSeats > 0 ? sumCabins(pax) / rd.physicalSeats : 0,
    }
    r.history.push(dayRes)
    if (r.history.length > HISTORY_KEEP) r.history.shift()

    today.pax = addCabins(today.pax, pax)
    today.flights += dayRes.flights
    today.seats += dayRes.seats
    today.revenue += dayRes.revenue
    today.cost += dayRes.cost
  }

  // 3b) Rotas de carga. Mercado próprio, apurado do mesmo jeito.
  for (const cd of perCargo) {
    const r = cd.route
    const key = odKey(r.from, r.to)
    const demandaC = cargoDemand(r.from, r.to, s.day, doy)

    // Quem já estava no par. Sem isto o jogador seria monopolista de carga em
    // toda rota que abrisse, e o mercado deixaria de ter preço.
    const incumbentes: CargoCarrier[] = [{
      id: `I:${key}`,
      tons: demandaC.tons * 0.8,
      freq: 1 + Math.floor(3 * hashStr(`F${key}`)),
      rateMult: 0.95 + 0.2 * hashStr(`R${key}`),
      quality: 0.9 + 0.25 * hashStr(`Q${key}`),
    }]
    const meu: CargoCarrier = {
      id: `P:${r.id}`,
      tons: cd.tons,
      freq: cd.flights,
      rateMult: r.fare.y,
      quality: playerQuality,
    }
    const allocC = allocateCargoMarket(demandaC, [meu, ...incumbentes])
    const tons = allocC.find((a) => a.id === meu.id)?.tons ?? 0
    s.lastShare[key] = allocC.find((a) => a.id === meu.id)?.share ?? 0

    const revenue = tons * demandaC.refRate * r.fare.y * (1 - DISTRIBUTION_RATE)

    let cost = 0
    const noturnoC = fracaoNoturna(s, r, dow)
    for (const ac of cd.pernas) {
      const t = typeOf(ac)
      // Sem passageiro não há comissaria nem comissário: os dois entram zerados.
      const c = flightCost(t, r.distance, r.from, r.to, s.fuelPrice, ac.age, 0, 0, 0, noturnoC)
      cost += c.total
      ac.hours += c.blockH
      ac.cycles += 1
      ac.condition = Math.max(0, ac.condition - (0.00028 + c.blockH * 0.00013))
    }

    const dayRes: DayResult = {
      day: s.day,
      pax: emptyCabins(),
      flights: cd.flights,
      seats: 0,
      revenue,
      cost,
      profit: revenue - cost,
      loadFactor: cd.tons > 0 ? tons / cd.tons : 0,
      tons,
      tonsOffered: cd.tons,
    }
    r.history.push(dayRes)
    if (r.history.length > HISTORY_KEEP) r.history.shift()

    today.flights += dayRes.flights
    today.revenue += dayRes.revenue
    today.cost += dayRes.cost
  }

  /**
   * 3c) Os voos vazios que a escala obriga.
   *
   * Quando a semana de uma cauda não fecha — ela termina em Fortaleza e a
   * primeira perna sai do Rio —, o avião não se teleporta: ele voa vazio até
   * lá. Paga combustível, tripulação e taxa, e não vende um assento. É o preço
   * real de uma escala malfeita, e aparece no custo do dia inteiro, rateado
   * pelos sete dias porque a quebra é semanal e o apuramento é diário.
   */
  let ferry = 0
  for (const pos of posicionamentos(s)) {
    const ac = aircraftOf(s, pos.aircraftId)
    if (!ac || ac.groundedUntil > s.day) continue
    const dist = distanceBetween(pos.from, pos.to)
    const t = typeOf(ac)
    if (t.range < dist) continue
    const c = flightCost(t, dist, pos.from, pos.to, s.fuelPrice, ac.age, 0, 0, 0, 0)
    ferry += c.total / 7
    ac.hours += c.blockH / 7
  }
  if (ferry > 0) today.cost += ferry

  // 4) Custos que não dependem de voar.
  let overhead = HQ_DAILY_BASE + s.airline.fleet.length * 2200 + s.airline.routes.length * 850
  overhead += s.airline.hubs.length * 5200
  overhead += s.airline.marketing
  for (const ac of s.airline.fleet) {
    if (ac.leased) overhead += ac.lease / 30
    if (!ac.leased) ac.value = resaleValue(typeOf(ac), ac.age, ac.condition)
    ac.age += 1 / 365
  }
  let interest = 0
  for (const l of s.airline.loans) {
    const i = (l.balance * l.rate) / 365
    const amort = l.principal / l.termDays
    interest += i
    const pay = i + amort
    l.balance = Math.max(0, l.balance - amort)
    overhead += pay
  }
  s.airline.loans = s.airline.loans.filter((l) => l.balance > 1)
  today.cost += overhead
  today.profit = today.revenue - today.cost
  today.loadFactor = today.seats > 0 ? sumCabins(today.pax) / today.seats : 0
  s.airline.cash += today.profit

  // 5) Manutenção pesada e panes.
  for (const ac of s.airline.fleet) {
    if (ac.condition < 0.55 && chance(rng, 0.004 + (0.55 - ac.condition) * 0.06)) {
      const t = typeOf(ac)
      const bill = marketPrice(t) * 0.012 * (1.6 - ac.condition)
      s.airline.cash -= bill
      ac.condition = Math.min(1, ac.condition + 0.42)
      ac.groundedUntil = s.day + Math.round(between(rng, 2, 6))
      notify(s, 'bad', `${t.name} ${ac.reg} entrou em manutenção pesada — ${money(bill)}.`)
    }
  }

  // 6) Reputação: pontualidade (estado da frota), conforto e propaganda.
  const avgCondition = s.airline.fleet.length
    ? s.airline.fleet.reduce((x, a) => x + a.condition, 0) / s.airline.fleet.length
    : 0.8
  const lfPenalty = today.loadFactor > 0.93 ? (today.loadFactor - 0.93) * 1.4 : 0
  /**
   * O conforto da cabine puxa a reputação, e não só a divisão de mercado.
   *
   * Quem voa numa suíte não escolhe só aquele voo: ele passa a ser cliente da
   * companhia. Sem isso, poltrona boa rendia passageiro no dia e nada no ano —
   * e a conta de trocar o interior nunca fechava. É de propósito que pese
   * menos que o estado da frota: assento macio não desfaz voo atrasado.
   */
  const conforto = s.airline.fleet.length
    ? s.airline.fleet.reduce(
        (x, a) => x + cabinComfort(modelOf(a), a.seats, a.pitch, a.seatConfig), 0,
      ) / s.airline.fleet.length
    : 1
  const target = Math.max(
    0.1,
    Math.min(
      0.97,
      0.28 + 0.42 * avgCondition + Math.min(0.12, Math.max(-0.06, (conforto - 1) * 0.55)) +
        Math.min(0.16, s.airline.marketing / 1.6e6) - lfPenalty,
    ),
  )
  s.airline.reputation += (target - s.airline.reputation) * 0.012

  // 7) Concorrência reage uma vez por semana.
  if (s.day % 7 === 0) {
    stepCompetitors(s.competitors, s.day, rng, pressure)
    /**
     * E, muito de vez em quando, alguém funda uma companhia.
     *
     * Na mesma batida semanal porque é uma decisão do mundo, não do jogador, e
     * porque a conta só é feita quando há país habilitado — o que quase nunca
     * há. Ver `fundarCompanhia`.
     */
    const nova = fundarCompanhia(s.competitors, s.day, rng, s.airline.hubs, (s.fundadas ??= {}))
    if (nova) {
      s.competitors.push(nova)
      notify(s, 'info',
        `${nova.name} recebeu certificado de operador em ${AIRPORT_BY_IATA[nova.hub]?.city ?? nova.hub} ` +
        `e estreia com ${nova.routes.length} ${nova.routes.length === 1 ? 'rota' : 'rotas'}.`)
    }
    computeCompetitorRevenue(s, doy)
  }

  s.ledger.push(today)
  if (s.ledger.length > LEDGER_KEEP) s.ledger.shift()

  if (s.airline.cash < 0 && s.day % 15 === 0) {
    notify(s, 'bad', 'Caixa negativo. Corte custos, venda aeronaves ou negocie crédito.')
  }
  if (interest > 0 && s.day % 90 === 0 && debtTotal(s) > fleetValue(s) * 1.2) {
    notify(s, 'bad', 'Alavancagem alta: os bancos estão desconfortáveis com sua dívida.')
  }
  return s
}

/** Estima a receita mensal de cada concorrente disputando de verdade cada par. */
function computeCompetitorRevenue(s: GameState, doy: number) {
  const byOd = new Map<string, { comp: (typeof s.competitors)[number]; route: (typeof s.competitors)[number]['routes'][number] }[]>()
  for (const comp of s.competitors) {
    for (const r of comp.routes) {
      const list = byOd.get(r.key) ?? []
      list.push({ comp, route: r })
      byOd.set(r.key, list)
    }
  }
  for (const c of s.competitors) c.revenue30 = 0
  for (const [, list] of byOd) {
    const first = list[0].route
    const demand = baseDemand(first.from, first.to, s.day, doy)
    const premium = 0.12
    const carriers: Carrier[] = list.map(({ comp, route }) => ({
      id: comp.id,
      seats: {
        y: route.seats * route.freq * 2 * SELLABLE * (1 - premium),
        w: route.seats * route.freq * 2 * SELLABLE * premium * 0.35,
        c: route.seats * route.freq * 2 * SELLABLE * premium * 0.6,
        f: route.seats * route.freq * 2 * SELLABLE * premium * 0.05,
      },
      freq: route.freq,
      fareMult: route.fare,
      quality: route.quality * atratividadeHorario(horaDaConcorrente(route)),
    }))
    const alloc = allocateMarket(demand, carriers)
    alloc.forEach((a, i) => {
      const { comp, route } = list[i]
      const fare: Cabins = { y: route.fare, w: route.fare, c: route.fare, f: route.fare }
      // a concorrente também carrega conexão: ver `fatorConexaoIA`
      const pax = escalarCabins(a.pax, fatorConexaoIA(comp.routes.length))
      comp.revenue30 += ticketRevenue(pax, fare, demand.refFare) * (1 - DISTRIBUTION_RATE) * 30
    })
  }
  for (const c of s.competitors) c.fleetSize = Math.max(3, Math.round(c.routes.reduce((n, r) => n + r.freq, 0) / 2.6))
}

// -------------------------------------------------------------- formatação

export function money(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} bi`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)} mi`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)} mil`
  return `${sign}$${abs.toFixed(0)}`
}
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
export const num = (v: number) => Math.round(v).toLocaleString('pt-BR')

/**
 * Pista em metros. O catálogo guarda em pés porque é assim que o fabricante
 * publica, mas quem joga raciocina em metro — e Congonhas é 1.940 m, não
 * 6.365 ft.
 */
export const metros = (pes: number) => `${num(pes * 0.3048)} m`

/**
 * Distância em quilômetros. A simulação conta em milha náutica porque é a
 * unidade da ficha — nó de velocidade, alcance em nm —, mas nada disso aparece
 * na tela: quem joga mede em km.
 */
export const KM_POR_NM = 1.852
export const km = (nm: number) => `${num(nm * KM_POR_NM)} km`

/** Resumo dos últimos N dias do livro-caixa. */
export function period(s: GameState, days: number) {
  const slice = s.ledger.slice(-days)
  const revenue = slice.reduce((x, d) => x + d.revenue, 0)
  const cost = slice.reduce((x, d) => x + d.cost, 0)
  const pax = slice.reduce((x, d) => x + sumCabins(d.pax), 0)
  const seats = slice.reduce((x, d) => x + d.seats, 0)
  const flights = slice.reduce((x, d) => x + d.flights, 0)
  return { revenue, cost, profit: revenue - cost, pax, seats, flights, loadFactor: seats ? pax / seats : 0, days: slice.length }
}

export function routeEconomics(s: GameState, r: Route) {
  const last = r.history.slice(-14)
  const revenue = last.reduce((x, d) => x + d.revenue, 0)
  const cost = last.reduce((x, d) => x + d.cost, 0)
  const base = {
    share: s.lastShare[odKey(r.from, r.to)] ?? 0,
    revenue, cost, profit: revenue - cost,
    days: last.length,
  }

  // Em rota de carga a unidade é a tonelada, e o mercado é outro. A tela lê
  // daqui, então ela não precisa saber de qual dos dois veio o número.
  if (r.cargo) {
    const dc = cargoDemand(r.from, r.to, s.day, dayOfYear(s))
    const tons = last.reduce((x, d) => x + (d.tons ?? 0), 0)
    const oferta = last.reduce((x, d) => x + (d.tonsOffered ?? 0), 0)
    const dias = Math.max(1, last.length)
    const atendidoDia = tons / dias
    return {
      ...base,
      demand: { pax: emptyCabins(), total: dc.tons, refFare: dc.refRate, distance: dc.distance },
      pax: tons,
      loadFactor: oferta ? tons / oferta : 0,
      atendidoDiaCabine: emptyCabins(),
      restanteDiaCabine: emptyCabins(),
      sugestaoFare: { ...r.fare },
      demandaDia: dc.tons,
      atendidoDia,
      restanteDia: Math.max(0, dc.tons - atendidoDia),
      cargo: true,
      unidade: 't',
    }
  }

  const demand = baseDemand(r.from, r.to, s.day, dayOfYear(s))
  const pax = last.reduce((x, d) => x + sumCabins(d.pax), 0)
  const seats = last.reduce((x, d) => x + d.seats, 0)
  const dias = Math.max(1, last.length)
  const atendidoDiaCabine: Cabins = {
    y: last.reduce((x, d) => x + d.pax.y, 0) / dias,
    w: last.reduce((x, d) => x + d.pax.w, 0) / dias,
    c: last.reduce((x, d) => x + d.pax.c, 0) / dias,
    f: last.reduce((x, d) => x + d.pax.f, 0) / dias,
  }
  const restanteDiaCabine: Cabins = {
    y: Math.max(0, demand.pax.y - atendidoDiaCabine.y),
    w: Math.max(0, demand.pax.w - atendidoDiaCabine.w),
    c: Math.max(0, demand.pax.c - atendidoDiaCabine.c),
    f: Math.max(0, demand.pax.f - atendidoDiaCabine.f),
  }
  return {
    ...base,
    demand,
    pax,
    loadFactor: seats ? pax / seats : 0,
    atendidoDiaCabine,
    restanteDiaCabine,
    sugestaoFare: sugerirTarifasParaCobertura(r, demand.pax, atendidoDiaCabine),
    demandaDia: demand.total,
    atendidoDia: sumCabins(atendidoDiaCabine),
    restanteDia: sumCabins(restanteDiaCabine),
    cargo: false,
    unidade: 'pax',
  }
}

const FARE_MIN = 0.55
const FARE_MAX = 1.9

export function sugerirTarifasParaCobertura(route: Route, demanda: Cabins, atendido: Cabins): Cabins {
  const out = { ...route.fare }
  for (const cabin of CABINS) {
    const alvo = demanda[cabin]
    if (alvo <= 0) continue
    const atual = atendido[cabin]
    if (atual <= 0.1) {
      out[cabin] = FARE_MIN
      continue
    }
    const ratio = Math.max(0.35, Math.min(3, alvo / atual))
    const alvoMult = Math.pow(ratio, 1 / classPriceExponent(cabin))
    out[cabin] = Math.max(FARE_MIN, Math.min(FARE_MAX, route.fare[cabin] * alvoMult))
  }
  return out
}

export function fareInDollars(r: Route, cabin: keyof Cabins, refFare: number) {
  return refFare * CLASS_FARE_MULT[cabin] * r.fare[cabin]
}

/**
 * Previsão mostrada antes de abrir a rota. Precisa usar a **mesma regra** do
 * tick, senão o jogador aprende a desconfiar da própria tela — por isso a
 * estimativa de carga repete o caminho de `advanceDay`, com o mesmo mercado e
 * a mesma frota incumbente.
 */
export function estimateRoute(s: GameState, from: string, to: string, typeId: string, freq: number) {
  const t: AircraftType = AIRCRAFT_BY_ID[typeId]
  const dist = distanceBetween(from, to)
  if (t.payload !== undefined) return estimateCargoRoute(s, from, to, t, freq, dist)
  const demand = baseDemand(from, to, s.day, dayOfYear(s))
  const seats = defaultCabin(t, 1).seats
  const offered = sumCabins(seats) * freq * 2 * SELLABLE
  const rivals = s.competitors.flatMap((c) => c.routes.filter((r) => r.key === odKey(from, to)))
  const rivalSeats = rivals.reduce((x, r) => x + r.seats * r.freq * 2 * SELLABLE, 0)
  const shareGuess = offered / Math.max(1, offered + rivalSeats * 1.05)
  const pax = Math.min(offered, demand.total * shareGuess)
  const premiumPax = pax * 0.12
  const revenue = pax * demand.refFare * 1.2 * (1 - DISTRIBUTION_RATE)
  const cost =
    flightCost(t, dist, from, to, s.fuelPrice, 2, pax / Math.max(1, freq * 2), premiumPax / Math.max(1, freq * 2))
      .total * 2 * freq
  return { dist, demand, offered, pax, revenue, cost, profit: revenue - cost, rivals: rivals.length, blockH: blockHours(t, dist) }
}

function estimateCargoRoute(
  s: GameState, from: string, to: string, t: AircraftType, freq: number, dist: number,
) {
  const demandaC = cargoDemand(from, to, s.day, dayOfYear(s))
  const key = odKey(from, to)
  const offered = (t.payload ?? 0) * freq * 2 * CARGO_SELLABLE
  const incumbentes: CargoCarrier[] = [{
    id: `I:${key}`,
    tons: demandaC.tons * 0.8,
    freq: 1 + Math.floor(3 * hashStr(`F${key}`)),
    rateMult: 0.95 + 0.2 * hashStr(`R${key}`),
    quality: 0.9 + 0.25 * hashStr(`Q${key}`),
  }]
  const meu: CargoCarrier = { id: 'P', tons: offered, freq, rateMult: 1, quality: 1 }
  const tons = allocateCargoMarket(demandaC, [meu, ...incumbentes]).find((a) => a.id === 'P')?.tons ?? 0
  const revenue = tons * demandaC.refRate * (1 - DISTRIBUTION_RATE)
  const cost = flightCost(t, dist, from, to, s.fuelPrice, 2, 0, 0, 0).total * 2 * freq
  return {
    dist,
    demand: { pax: emptyCabins(), total: demandaC.tons, refFare: demandaC.refRate, distance: dist },
    offered, pax: tons, revenue, cost, profit: revenue - cost,
    rivals: incumbentes.length,
    blockH: blockHours(t, dist),
    cargo: true as const,
  }
}

export const CABIN_KEYS = CABINS
