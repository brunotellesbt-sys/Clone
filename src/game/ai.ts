import {
  AIRPORTS, AIRPORT_BY_IATA, noToqueDeRecolher, vooPermitido, type Airport,
} from './data/airports'
import { atratividadeHorario, DIA, horaDaConcorrente } from './malha'
import { AIRCRAFT_BY_ID, type AircraftType } from './data/aircraft'
import { derivaDoPais } from './data/crescimento'
import { gameDayDate } from './calendarDates'
import { aeroportoServe } from './spec'
import { baseDemand } from './demand'
import { largestPassengerAircraft, passengerAircraftForRoute } from './routeCapacity'
import { competitorHubs, invalidateHubActivity } from './hubDevelopment'
import { distanceBetween, odKey } from './geo'
import {
  batizar, caixaInicial, MERCADOS, PAISES_COM_AVIACAO, quantasCompanhias, vagasDoMundo,
} from './mundo'
import { between, chance, hashStr, type Rng } from './rng'
import type { Competitor, Densidade, GameState } from './types'

/**
 * Até onde uma companhia voa, pela idade e pelo tamanho dela.
 *
 * Nenhuma companhia nasce intercontinental. Ela começa ligando cidades do
 * próprio país, fica conhecida ali, e só então atravessa a fronteira: primeiro
 * o vizinho, o continente, a região — é a LATAM na América do Sul e as
 * europeias entre si —, e por último o outro lado do mundo. Fazer diferente
 * é o que deixava uma empresa de três rotas fundada ontem abrindo Manaus–Tóquio.
 *
 * Os dois eixos importam, e é de propósito. **Idade** sozinha faria uma
 * companhia irrelevante virar intercontinental só por sobreviver; **tamanho**
 * sozinho deixaria a que nasceu grande pular a fila. Precisa dos dois, que é o
 * que acontece: direito de tráfego se conquista com tempo, e avião de longo
 * curso se compra com receita.
 *
 * `undefined` em `desde` é companhia do mundo inicial ou de partida antiga —
 * as duas são maduras, e é o que elas sempre foram.
 */
export type Alcance = 'dom' | 'reg' | 'int'

const ANOS_ATE_REGIONAL = 6
const ANOS_ATE_INTERNACIONAL = 14
const ROTAS_ATE_REGIONAL = 7
const ROTAS_ATE_INTERNACIONAL = 16

export function alcanceDe(comp: Competitor, day: number): Alcance {
  if (comp.desde === undefined) return 'int'
  const anos = (day - comp.desde) / 365
  if (anos >= ANOS_ATE_INTERNACIONAL && comp.routes.length >= ROTAS_ATE_INTERNACIONAL) return 'int'
  if (anos >= ANOS_ATE_REGIONAL && comp.routes.length >= ROTAS_ATE_REGIONAL) return 'reg'
  return 'dom'
}

/**
 * O destino cabe no alcance da companhia?
 *
 * `dom` é o próprio país. `reg` é o continente — e o continente é a medida
 * certa, não o raio em quilômetros: uma companhia chilena madura voa a Bogotá
 * antes de voar a Lisboa, embora as duas estejam longe. `int` é o mundo.
 *
 * **Não há regra de cabotagem aqui, e é deliberado.** O jogo não proíbe
 * ninguém de voar dentro de país alheio; o que ele modela é a ordem em que uma
 * companhia cresce, que é outra coisa.
 */
function noAlcance(base: Airport, destino: Airport, alcance: Alcance): boolean {
  if (alcance === 'int') return true
  if (base.cc === destino.cc) return true
  return alcance === 'reg' && base.cont === destino.cont
}

/**
 * Destinos plausíveis a partir de um hub, por demanda potencial.
 *
 * Varre os 3.086 aeroportos e mede a demanda de cada par, o que é caro — e era
 * refeito do zero toda vez que uma concorrente decidia crescer. Com o mundo
 * cheio são 425 companhias, cerca de setenta delas crescendo por semana, e isso
 * dava duzentos mil cálculos de demanda por semana só para reordenar uma lista
 * que muda devagar: a ordem dos destinos de Guarulhos é a mesma em 2027 e em
 * 2029.
 *
 * O resultado fica guardado por hub e vale por `VALIDADE` dias de jogo. Medido
 * no mundo cheio, o tick caiu de **24,8 ms para 10,3 ms por dia** — o resto do
 * custo é a disputa de mercado rota a rota, que não dá para guardar porque ela
 * depende do que o jogador fez ontem.
 */
const VALIDADE = 730
const cacheDestinos = new Map<string, { ate: number; lista: { iata: string; score: number }[] }>()

function candidateDestinations(hub: string, day: number, limit: number, alcance: Alcance = 'int', startYear = 2027) {
  const base = AIRPORT_BY_IATA[hub]
  const cacheKey = startYear + ':' + hub
  const hit = cacheDestinos.get(cacheKey)
  const completa = hit && day < hit.ate
    ? hit.lista
    : (() => {
        const lista = AIRPORTS.filter((a) => a.iata !== hub && !vooPermitido(base, a))
          .map((a) => {
            // Ranking estrutural guardado por dois anos: não eterniza um pico
            // de festival. Oferta e receita consultam o calendário atual.
            const d = baseDemand(hub, a.iata, day, 180, startYear, false)
            return { iata: a.iata, score: d.total / (1 + distanceBetween(hub, a.iata) / 4000) }
          })
          .sort((x, y) => y.score - x.score)
          // guarda sempre uma lista longa: pedir 60 e depois 90 não pode custar
          // uma varredura nova, e a lista longa cabe de sobra na memória
          .slice(0, 260)
        cacheDestinos.set(cacheKey, { ate: day + VALIDADE, lista })
        return lista
      })()
  // O alcance filtra a lista guardada em vez de gerar outra: a ordem por
  // demanda é a mesma para todo mundo; o que muda é onde a companhia pode ir.
  if (alcance === 'int') return completa.slice(0, limit)
  return completa
    .filter((c) => noAlcance(base, AIRPORT_BY_IATA[c.iata], alcance))
    .slice(0, limit)
}

/** Esquece o que foi guardado. A partida nova não herda o mundo da anterior. */
export const limparCacheDestinos = () => cacheDestinos.clear()

/**
 * Quantas concorrentes o jogador enfrenta, e o que cada escolha quer dizer.
 *
 * Era fixo em doze, e doze é pouco para um mapa de 231 países e demais para
 * quem quer aprender a montar malha sem ninguém por cima. Agora é decisão da
 * fundação, e cada degrau é uma partida diferente: com 12 o mundo é quase
 * vazio e quem manda no seu país é você; com o mundo cheio, cada mercado tem
 * dono e abrir rota é tomar o lugar de alguém.
 */
/**
 * Idade, em anos, de cada posição do país no dia 1. Ver `desde` abaixo.
 * A quarta nasce com quatro anos: doméstica, e é ela que ainda vai crescer.
 */
const IDADE_INICIAL = [46, 24, 11, 4]

export const DENSIDADES: { id: Densidade; label: string; paises: number; texto: string }[] = [
  { id: 'enxuta', label: 'Enxuta', paises: 10, texto: 'só as dez maiores aviações do mundo, e a sua' },
  { id: 'media', label: 'Equilibrada', paises: 35, texto: 'os grandes mercados defendidos, o resto do mapa livre' },
  { id: 'densa', label: 'Densa', paises: 90, texto: 'quase todo país com aviação relevante tem dono' },
  { id: 'mundo', label: 'Mundo cheio', paises: PAISES_COM_AVIACAO, texto: 'todo mercado com dono, como no mundo de hoje' },
]

/**
 * O padrão é o mundo cheio, por pedido do dono do jogo: "mesmo que seja pesado,
 * muita gente". É a opção mais cara — 10,3 ms de tick por dia contra 3,2 ms da
 * enxuta —, e é também a única em que o mapa se parece com o mundo: 425
 * companhias, 43 intercontinentais, 78 regionais e 304 domésticas. Quem quiser
 * um mundo mais leve tem as outras três na fundação.
 */
export const DENSIDADE_PADRAO: Densidade = 'mundo'

export const paisesDe = (d: Densidade) =>
  DENSIDADES.find((x) => x.id === d)?.paises ?? DENSIDADES[1].paises

/** Quantas companhias uma densidade gera, para a tela de fundação. */
export const companhiasDe = (d: Densidade, ccDoJogador?: string) =>
  Math.max(0, quantasCompanhias(paisesDe(d), ccDoJogador) - 1)

/**
 * Povoa o mundo.
 *
 * As vagas vêm de `mundo.ts`, já na ordem certa — a maior companhia de cada
 * país primeiro, depois a segunda de cada — e o corte é a densidade escolhida.
 *
 * **A base do jogador toma uma vaga do país dele**, que é o que acontece de
 * verdade: não existe mercado que ganhe uma companhia a mais porque alguém
 * resolveu fundar. Sem isso o Brasil de um jogador brasileiro teria cinco
 * companhias e o da IA quatro, e a partida ficaria mais difícil exatamente para
 * quem jogasse em casa.
 */
export function createCompetitors(rng: Rng, densidade: Densidade = DENSIDADE_PADRAO,
                                  hubDoJogador?: string): Competitor[] {
  const ccJogador = hubDoJogador ? AIRPORT_BY_IATA[hubDoJogador]?.cc : undefined
  const mercadoPorCc = new Map(MERCADOS.map((m) => [m.cc, m]))
  const usados = new Set<string>()
  const tomados = new Set<string>(hubDoJogador ? [hubDoJogador] : [])
  const out: Competitor[] = []
  let cedida = false

  for (let vaga of vagasDoMundo(paisesDe(densidade), ccJogador)) {
    // a vaga do jogador é a última do país dele: ele entra por baixo, como
    // companhia nova, e não no lugar da maior
    if (!cedida && vaga.cc === ccJogador) {
      const m = mercadoPorCc.get(vaga.cc)
      if (m && vaga.ordem === m.cota - 1) { cedida = true; continue }
    }
    /**
     * Cada companhia num aeroporto diferente, e nenhuma no do jogador.
     *
     * A vaga já vem com um hub sugerido — o n-ésimo maior do país —, mas ele
     * pode estar tomado: o jogador escolheu aquele aeroporto, ou uma companhia
     * anterior do mesmo país caiu ali porque o país tem menos aeroportos que
     * cota. Duas companhias no mesmo portão é o defeito que isto veio
     * consertar, então procura-se o maior aeroporto livre do país; se não
     * houver nenhum, aí sim elas dividem, que é o que acontece em país de um
     * aeroporto só.
     */
    if (tomados.has(vaga.hub)) {
      const m = mercadoPorCc.get(vaga.cc)
      const livre = m?.aeroportos.find((a) => !tomados.has(a.iata))
      if (livre) vaga = { ...vaga, hub: livre.iata }
    }
    tomados.add(vaga.hub)
    const m = mercadoPorCc.get(vaga.cc)
    if (!m) continue
    const { name, code, color } = batizar(vaga, rng, usados)
    const comp: Competitor = {
      id: `${code}${out.length}`,
      name,
      code,
      hub: vaga.hub,
      color,
      cash: caixaInicial(m, vaga.ordem, rng),
      reputation: between(rng, 0.45, 0.72),
      aggression: between(rng, 0.7, 1.3),
      routes: [],
      fleetSize: 0,
      revenue30: 0,
      /**
       * O mundo inicial não é quatro companhias iguais por país.
       *
       * A idade de cada uma sai da posição dela, e com a idade vem o alcance —
       * que reproduz a estrutura que existe de verdade em qualquer mercado
       * grande: uma companhia de bandeira antiga e intercontinental, uma
       * segunda também internacional, uma regional de continente e uma
       * doméstica nova. É a diferença entre a LATAM e uma companhia que só voa
       * dentro do país.
       *
       * O valor é negativo porque é idade em dias antes do dia 1.
       */
      desde: -365 * IDADE_INICIAL[Math.min(vaga.ordem, IDADE_INICIAL.length - 1)],
    }
    /**
     * O tamanho da malha inicial sai do mercado, não de um sorteio.
     *
     * A companhia nº 1 dos Estados Unidos e a única de Vanuatu abriam as duas
     * entre 13 e 26 rotas. Agora a raiz do movimento do país dá a escala e a
     * posição no país corta o resto: a maior de um mercado grande nasce com
     * trinta e poucas rotas, a segunda de um mercado pequeno com três.
     */
    const escala = Math.sqrt(m.paxDia / 120_000) / (1 + 0.5 * vaga.ordem)
    const quantas = Math.max(3, Math.min(34, Math.round(between(rng, 9, 18) * escala)))
    // a malha inicial já respeita o alcance da idade dela: a quarta companhia
    // do país nasce com rede doméstica, não com rotas para o outro hemisfério
    const alcance = alcanceDe(comp, 0)
    for (const d of candidateDestinations(vaga.hub, 0, Math.round(quantas * 1.4), alcance)) {
      if (comp.routes.length >= quantas) break
      if (!chance(rng, 0.82)) continue
      addAiRoute(comp, d.iata, rng, 0)
    }
    out.push(comp)
  }
  return out
}

/**
 * O `day` não é enfeite: era `0` fixo, e por isso a concorrente dimensionava
 * toda rota nova pelo mercado do **primeiro dia da partida**. Num mundo que
 * cresce 5% ao ano na Índia, uma rota aberta no ano 20 nascia com a oferta de
 * 2027 e o jogador a tomava sem esforço — a IA parecia burra por um bug de
 * argumento.
 */
function addAiRoute(comp: Competitor, dest: string, rng: Rng, day: number, startYear = 2027, hub = comp.hub, state?: GameState, initializeFleet = true) {
  const plane = largestPassengerAircraft(hub, dest, new Date(gameDayDate(day, startYear)).getUTCFullYear())
  if (!plane) return
  const demand = baseDemand(hub, dest, day, 180, startYear, true, state)
  // Dimensiona a oferta para pegar um pedaço do mercado, com ruído.
  const target = demand.total * between(rng, 0.05, 0.13) * comp.aggression
  const freq = Math.max(1, Math.min(10, Math.round(target / between(rng, 150, 260))))
  const seats = Math.min(plane.maxSeats, Math.max(50, Math.min(360, Math.round(target / Math.max(1, freq) / between(rng, 0.7, 0.95)))))
  comp.routes.push({
    key: odKey(hub, dest),
    hora: Math.round(6 * 60 + 15 * 60 * (rng() as number)),
    from: hub,
    to: dest,
    seats,
    freq,
    fare: between(rng, 0.86, 1.18),
    quality: (0.75 + 0.5 * comp.reputation) * between(rng, 0.94, 1.08),
  })
  if (initializeFleet) limitarPelaFrota(comp)
}

/**
 * Horas de escala que uma rotação da concorrente consome por dia.
 *
 * Ida, volta e o solo no meio, em horas — a mesma conta que a escala do jogador
 * faz perna a perna, só que em grosso, porque a concorrente não tem escala.
 */
const cicloHoras = (dist: number) => 2 * (0.4 + dist / 450) + 0.75

/**
 * Máximo de horas que uma cauda voa por dia. Dezoito é o teto operacional de
 * uma aeronave bem usada — não é média de mercado, é o limite de quem não
 * deixa avião parado.
 */
const UTILIZACAO_DIARIA = 18

/**
 * Apara a frequência da concorrente ao que a frota dela consegue voar.
 *
 * **A malha obrigou este teto.** Enquanto a escala do jogador era um número na
 * rota, os dois lados podiam prometer voo que nenhum avião cumpre; agora o
 * jogador marca perna a perna e um A320 não faz seis idas e voltas Guarulhos–
 * Recife por dia. Sem este corte, a concorrente continuaria voando o impossível
 * e a partida viraria desigual por um detalhe de implementação, não por
 * decisão de jogo.
 *
 * A frota cresce com a malha em vez de sair dela: `fleetSize` era derivado da
 * frequência, o que deixava o teto se ajustando ao que ele deveria limitar.
 */
export function aiFleetHours(comp: Competitor) {
  return comp.routes.reduce((h, r) => h + r.freq * cicloHoras(distanceBetween(r.from, r.to)), 0)
}

function limitarPelaFrota(comp: Competitor, initial = true) {
  const precisa = aiFleetHours(comp)
  if (initial) comp.fleetSize = Math.max(comp.fleetSize, 3, Math.ceil(precisa / UTILIZACAO_DIARIA))
  const disponivel = comp.fleetSize * UTILIZACAO_DIARIA
  if (precisa <= disponivel) return
  // Arredondar para cima e impor uma frequência mantinha voos sem avião.
  const factor = disponivel / precisa
  let remaining = disponivel
  for (const r of [...comp.routes].sort((a,b) => b.seats * b.freq - a.seats * a.freq)) {
    const cycle = cicloHoras(distanceBetween(r.from, r.to))
    r.freq = Math.min(Math.max(1, Math.floor(r.freq * factor)), Math.floor(remaining / cycle))
    remaining -= r.freq * cycle
  }
  comp.routes = comp.routes.filter(r => r.freq > 0)
}

/** Alvo de porte, não cópia instantânea: país, maturidade e perfil distinguem as rivais. */
export function competitorGrowthTarget(comp: Competitor, state?: GameState) {
  const market = MERCADOS.find(m => m.cc === AIRPORT_BY_IATA[comp.hub].cc)
  const scope = Math.min(1, Math.sqrt((market?.paxDia ?? 1000) / 120_000))
  const age = comp.desde === undefined ? 20 : Math.max(0, ((state?.day ?? 0) - comp.desde) / 365)
  const maturity = Math.min(1, .2 + age / 18)
  const profile = .8 + .4 * hashStr(comp.id)
  const cc = AIRPORT_BY_IATA[comp.hub].cc
  const baseline = comp.growthBase
  const organic = baseline ? baseline.fleet * derivaDoPais(cc, state?.day ?? baseline.day) / derivaDoPais(cc, baseline.day) : comp.fleetSize
  const fleet = Math.max(comp.fleetSize, Math.round(organic), Math.round((state?.airline.fleet.length ?? 20) * profile * scope * maturity))
  const hubs = Math.max(1, Math.min(Math.floor(fleet / 4), Math.max(Math.floor(fleet / 12), Math.round((state?.airline.hubs.length ?? 2) * profile * maturity))))
  return { fleet, hubs, routes: Math.max(34, Math.round(fleet * 1.5), Math.round((state?.airline.routes.length ?? 40) * profile * scope * maturity)) }
}

function expandCompetitor(comp: Competitor, day: number, rng: Rng, startYear: number, state?: GameState) {
  comp.growthBase ??= { day, fleet: comp.fleetSize }
  const target = competitorGrowthTarget(comp, state)
  const year = new Date(gameDayDate(day, startYear)).getUTCFullYear()
  comp.hubs = competitorHubs(comp)
  // Contabilidade simplificada das rivais: reinvestimento de 10% da receita,
  // com entrada de leasing por aeronave e investimento ao abrir cada base.
  comp.cash += Math.max(0, comp.revenue30) * .1 * 7 / 30
  const needed = Math.max(target.fleet, Math.ceil(aiFleetHours(comp) / UTILIZACAO_DIARIA))
  const acquisitions = Math.max(0, Math.min(needed - comp.fleetSize, Math.max(1, Math.ceil(comp.fleetSize * .04)), Math.floor(comp.cash / 3e6)))
  comp.fleetSize += acquisitions
  comp.cash -= acquisitions * 3e6
  if (comp.hubs.length < target.hubs && day - (comp.lastExpansionDay ?? -28) >= 28 && comp.cash >= 5e6) {
    const primary = AIRPORT_BY_IATA[comp.hub]
    const cities = new Set(comp.hubs.map(h => AIRPORT_BY_IATA[h].city))
    const served = new Set(comp.routes.flatMap(r => [r.from, r.to]))
    const next = AIRPORTS.filter(a => a.cc === primary.cc && served.has(a.iata) && !cities.has(a.city))
      .sort((a, b) => b.paxDia - a.paxDia)[0]
    if (next) {
      comp.hubs.push(next.iata)
      comp.lastExpansionDay = day
      comp.cash -= 5e6
      if (state) invalidateHubActivity(state)
    }
  }
  const budget = comp.fleetSize * UTILIZACAO_DIARIA
  let hours = aiFleetHours(comp)
  // A expansão cria operação nos hubs secundários, não só nomes no painel.
  const attempts = Math.min(6, Math.max(1, Math.ceil((target.routes - comp.routes.length) / 30)))
  for (let i = 0; i < attempts && comp.routes.length < target.routes; i++) {
    if (hours >= budget || !chance(rng, .7 * comp.aggression)) break
    const hub = comp.hubs[(Math.floor(day / 7) + i) % comp.hubs.length]
    const open = new Set(comp.routes.map(r => r.key))
    const next = candidateDestinations(hub, day, 180, alcanceDe(comp, day), startYear)
      .find(d => !open.has(odKey(hub, d.iata)) && largestPassengerAircraft(hub, d.iata, year) &&
        hours + cicloHoras(distanceBetween(hub, d.iata)) <= budget)
    if (!next) continue
    const count = comp.routes.length
    addAiRoute(comp, next.iata, rng, day, startYear, hub, state, false)
    const route = comp.routes[count]
    if (route) {
      route.freq = Math.min(route.freq, Math.floor((budget - hours) / cicloHoras(distanceBetween(hub, next.iata))))
      hours = aiFleetHours(comp)
    }
  }
  // Revê a malha inteira: demanda nos dois sentidos exige contar ida e volta.
  for (const route of comp.routes) {
    const plane = largestPassengerAircraft(route.from, route.to, year)
    if (!plane) { route.freq = 0; continue }
    route.seats = Math.min(plane.maxSeats, route.seats)
    const market = baseDemand(route.from, route.to, day, 0, startYear, true, state).total
    const supply = route.seats * route.freq * 2
    const share = .12 * comp.aggression
    if (market * share > supply) {
      route.seats = Math.min(plane.maxSeats, Math.ceil(route.seats * 1.04))
      const cycle = cicloHoras(distanceBetween(route.from, route.to))
      if (route.seats >= plane.maxSeats * .7 && hours + cycle <= budget && route.freq < 16) {
        route.freq++
        hours += cycle
      }
    } else if (market * share < supply * .6) {
      route.seats = Math.max(Math.min(50, plane.maxSeats), Math.round(route.seats * .98))
    }
  }
  comp.routes = comp.routes.filter(r => r.freq > 0)
  limitarPelaFrota(comp, false)
}

/** Decisão semanal: mexe em tarifa, oferta, abre e fecha rota. */
export function stepCompetitors(comps: Competitor[], day: number, rng: Rng, playerPressure: Record<string, number>, _playerRoutes = 0, startYear = 2027, state?: GameState) {
  for (const comp of comps) {
    for (const r of comp.routes) {
      const pressure = playerPressure[r.key] ?? 0
      // Reage ao jogador: se perdeu espaço, corta preço ou aumenta frequência.
      if (pressure > 0.28 && chance(rng, 0.5 * comp.aggression)) {
        r.fare = Math.max(0.72, r.fare - between(rng, 0.02, 0.07))
      } else if (pressure < 0.05 && chance(rng, 0.25)) {
        r.fare = Math.min(1.35, r.fare + between(rng, 0.01, 0.04))
      }
      if (pressure > 0.4 && chance(rng, 0.22 * comp.aggression) &&
          aiFleetHours(comp) + cicloHoras(distanceBetween(r.from, r.to)) <= comp.fleetSize * UTILIZACAO_DIARIA) r.freq = Math.min(16, r.freq + 1)
      if (pressure > 0.62 && chance(rng, 0.12)) r.freq = Math.max(1, r.freq - 1)
      /**
       * Remarca o horário quando está apanhando.
       *
       * O horário da concorrente era sorteado uma vez e ficava lá para sempre,
       * o que deixava a disputa por faixa unilateral: o jogador escolhia o pico
       * e a IA nunca revidava. Agora ela anda meia hora de cada vez na direção
       * do horário mais valioso, e desiste de uma faixa em que não vai bem —
       * que é o que uma companhia faz antes de abandonar a rota.
       */
      if (pressure > 0.33 && chance(rng, 0.3 * comp.aggression)) {
        const atual = horaDaConcorrente(r)
        const passo = chance(rng, 0.5) ? 30 : -30
        const tentativa = ((atual + passo) % DIA + DIA) % DIA
        const ap = AIRPORT_BY_IATA[r.from]
        const melhora = atratividadeHorario(tentativa) > atratividadeHorario(atual)
        if (melhora && ap && !noToqueDeRecolher(r.from, tentativa)) r.hora = tentativa
      }
      r.quality = Math.min(1.3, r.quality * between(rng, 0.997, 1.006))
    }
    expandCompetitor(comp, day, rng, startYear, state)
    comp.reputation = Math.min(0.95, Math.max(0.3, comp.reputation + between(rng, -0.006, 0.007)))
  }
}

export const competitorHubName = (c: Competitor) => AIRPORT_BY_IATA[c.hub]?.city ?? c.hub

// --------------------------------------------------- companhias que nascem

/**
 * Anos de jogo antes de a primeira companhia nova poder aparecer, e o
 * intervalo mínimo entre as duas novas companhias no mundo.
 *
 * Quinze anos dos dois lados, e o número é o que o dono do jogo pediu. A razão
 * dele é boa e vale registrar: companhia aérea nascendo é notícia rara, e
 * evento raro que acontece cedo deixa de ser raro — vira mecânica. O jogador
 * passa os primeiros quinze anos disputando com um mundo estável, aprende quem
 * é quem, e só então o mapa começa a mexer sozinho.
 */
const ANOS_ATE_A_PRIMEIRA = 15
const ANOS_ENTRE_FUNDACOES = 15

/** No máximo duas novas companhias no mundo, para sempre. */
const FUNDACOES_NO_MUNDO = 2

/**
 * Quanto do mercado do país precisa estar sobrando para valer a pena fundar.
 *
 * Companhia nova não aparece em mercado saturado: ela aparece onde há gente
 * querendo voar e ninguém oferecendo. Trinta e cinco por cento de assento livre
 * é o que separa "dá para entrar" de "só entra quem quiser brigar por preço".
 */
const SOBRA_MINIMA = 0.35

/**
 * Chance de **alguém no mundo** fundar uma companhia, por semana.
 *
 * Um por cento e meio dá uma oportunidade rara de fundação depois que a
 * janela de quinze anos e a sobra de mercado deixam o país elegível.
 *
 * A primeira versão multiplicava esta chance pelo **número de países
 * habilitados**, e o resultado media o oposto do pedido: com cento e cinquenta
 * países elegíveis a chance semanal virava certeza, e 157 países fundaram
 * companhia praticamente todos no mesmo mês, ano 15. "Raro" tem que ser raro
 * no mundo, não em cada país — o número de candidatos escolhe **onde**, nunca
 * **se**.
 */
const CHANCE_SEMANAL = 0.015

/**
 * Quanto do mercado de um país já está atendido, de 0 a 1.
 *
 * Conta grosso de propósito: assentos oferecidos por semana por quem voa de lá,
 * contra o mercado do país. Não é a medida fina que o tick faz rota a rota —
 * ela custaria uma varredura do mundo inteiro por semana para responder uma
 * pergunta que só precisa de "cheio" ou "vazio".
 */
function ocupacaoDoPais(cc: string, comps: Competitor[], hubsDoJogador: string[]): number {
  const m = MERCADOS.find((x) => x.cc === cc)
  if (!m || m.paxDia <= 0) return 1
  let assentos = 0
  for (const c of comps) {
    if (AIRPORT_BY_IATA[c.hub]?.cc !== cc) continue
    for (const r of c.routes) assentos += r.seats * r.freq
  }
  // a malha do jogador conta: um país que ele domina não está vazio
  for (const h of hubsDoJogador) {
    if (AIRPORT_BY_IATA[h]?.cc === cc) assentos += m.paxDia * 0.12
  }
  return Math.min(1, assentos / m.paxDia)
}

/**
 * Uma companhia nova, talvez.
 *
 * Roda uma vez por semana e quase sempre não faz nada. A chance é mundial,
 * depois de aplicados os intervalos de quinze anos e o limite total de duas.
 *
 * Quem nasce não nasce grande: três a seis rotas, caixa pequeno, e nas ligações
 * que o país **não** tem. É por aí que companhia de verdade entra num mercado
 * com dono — pelo buraco, não pela rota principal.
 */
export function fundarCompanhia(
  comps: Competitor[],
  day: number,
  rng: Rng,
  hubsDoJogador: string[],
  fundadas: Record<string, number[]>,
  startYear = 2027,
): Competitor | null {
  const anos = day / 365
  if (anos < ANOS_ATE_A_PRIMEIRA) return null
  const anteriores = Object.values(fundadas).flat().sort((a, b) => a - b)
  if (anteriores.length >= FUNDACOES_NO_MUNDO) return null
  if (anteriores.length && anos - anteriores[anteriores.length - 1] < ANOS_ENTRE_FUNDACOES) return null

  const candidatos = MERCADOS.filter((m) => {
    if (m.cota === 0) return false
    return 1 - ocupacaoDoPais(m.cc, comps, hubsDoJogador) >= SOBRA_MINIMA
  })
  if (!candidatos.length) return null
  if (!chance(rng, CHANCE_SEMANAL)) return null

  // entre os habilitados, o mercado maior atrai mais: quem funda vai onde há
  // gente, e não no primeiro país da lista
  const peso = candidatos.map((m) => Math.sqrt(m.paxDia))
  const soma = peso.reduce((s, x) => s + x, 0)
  let sorteio = rng() * soma
  let escolhido = candidatos[0]
  for (let i = 0; i < candidatos.length; i++) {
    sorteio -= peso[i]
    if (sorteio <= 0) { escolhido = candidatos[i]; break }
  }

  /**
   * O hub é o maior aeroporto do país que ainda **não** é hub de ninguém; se
   * todos já são, o maior mesmo. Companhia nova prefere aeroporto livre — é
   * onde há slot e onde ela não nasce disputando o portão com a maior do país.
   */
  const ocupados = new Set([...comps.map((c) => c.hub), ...hubsDoJogador])
  const hub = (escolhido.aeroportos.find((a) => !ocupados.has(a.iata)) ?? escolhido.aeroportos[0]).iata

  const usados = new Set([...comps.map((c) => c.name), ...comps.map((c) => c.code)])
  const { name, code, color } = batizar({ cc: escolhido.cc, pais: escolhido.pais, hub, ordem: 9 }, rng, usados)
  const nova: Competitor = {
    id: `${code}n${Math.round(day)}`,
    name,
    code,
    hub,
    color,
    cash: between(rng, 45, 130) * 1e6,
    // companhia nova não tem nome no mercado: reputação começa baixa
    reputation: between(rng, 0.32, 0.5),
    // e compensa sendo agressiva, que é o que companhia nova faz
    aggression: between(rng, 1.05, 1.45),
    routes: [],
    fleetSize: 0,
    revenue30: 0,
    desde: day,
  }

  /**
   * Ela entra pelas ligações **pouco exploradas**, e é aqui que isso acontece.
   *
   * A lista de candidatos vem por demanda, como para todo mundo; o que muda é o
   * filtro: fica só o que ninguém voa a partir daquele hub. Se sobrar pouco,
   * ela pega o que houver — mercado nenhum é virgem para sempre.
   */
  const voadas = new Set(comps.flatMap((c) => c.routes.map((r) => r.key)))
  const quantas = Math.round(between(rng, 3, 6))
  // `'dom'`: companhia nova é companhia doméstica. Ela vira regional e depois
  // internacional com o tempo e o tamanho — ver `alcanceDe`.
  const dests = candidateDestinations(hub, day, 60, 'dom', startYear)
  for (const d of dests.filter((x) => !voadas.has(odKey(hub, x.iata)))) {
    if (nova.routes.length >= quantas) break
    addAiRoute(nova, d.iata, rng, day, startYear)
  }
  for (const d of dests) {
    if (nova.routes.length >= 3) break
    addAiRoute(nova, d.iata, rng, day, startYear)
  }
  // Num país de um aeroporto só não há par doméstico, e a companhia nasceria
  // vazia. Ali ela já nasce regional — que é o que Malta e o Bahrein são.
  if (!nova.routes.length) {
    for (const d of candidateDestinations(hub, day, 20, 'reg', startYear)) {
      if (nova.routes.length >= 3) break
      addAiRoute(nova, d.iata, rng, day, startYear)
    }
  }
  if (!nova.routes.length) return null

  ;(fundadas[escolhido.cc] ??= []).push(anos)
  return nova
}

// ------------------------------------------------------- a frota da rival

/**
 * Com que aeronave a concorrente voa cada rota dela.
 *
 * A rival não tem matrícula nem cauda: as rotas dela são abstratas — assento,
 * frequência, tarifa e qualidade —, e é assim de propósito, porque dar escala
 * por perna a trinta companhias custaria a partida inteira em tempo de conta.
 * O que existe é `seats` por voo e a etapa, e **isso já determina a aeronave**:
 * o planejador escolhe o menor avião que leva a carga oferecida e alcança o
 * destino, porque avião maior que o necessário voa vazio.
 *
 * Então a frota não é inventada aqui, é lida: mesma regra de pista e porte que
 * a tela de abrir rota usa para o jogador (`aeroportoServe`), mesmo catálogo,
 * mesmo ano. Duas companhias com a mesma malha têm a mesma frota, e uma rival
 * que só liga capital com capital em etapa curta aparece cheia de jato
 * regional — que é o que ela de fato opera.
 */
export function modeloDaRota(seats: number, from: string, to: string, ano: number) {
  const servem = passengerAircraftForRoute(from, to, ano)
    .sort((x, y) => x.maxSeats - y.maxSeats)
  if (!servem.length) return null
  // se nenhum comporta a oferta, o maior que existe — a rival então voa mais
  // de um avião por partida, que é o que a frequência dela já representa
  const cabem = servem.filter((t) => t.maxSeats >= seats)
  if (!cabem.length) return servem[servem.length - 1]
  /**
   * Entre os que servem, o que gasta menos por assento.
   *
   * Só "o menor que comporta" dava resultado esquisito na tela: uma companhia
   * de Atlanta aparecia com Tu-204 e Il-96 porque, para aquele número de
   * assentos, eram eles os menores do catálogo que cabiam. Nenhum planejador
   * escolhe assim — ele escolhe o avião que **custa menos por assento** na
   * etapa, e é isso que separa um 737-800 de um Tu-204 de porte parecido.
   *
   * O corte de 35% sobre o menor que cabe é o que impede a conta de derivar
   * para o outro extremo: um A380 tem consumo por assento excelente e não é
   * resposta para uma rota de duzentos lugares.
   */
  const teto = cabem[0].maxSeats * 1.35
  return cabem
    .filter((t) => t.maxSeats <= teto)
    .sort((x, y) => x.burn / x.maxSeats - y.burn / y.maxSeats)[0] ?? cabem[0]
}

export interface LinhaDeFrota {
  typeId: string
  nome: string
  avioes: number
  rotas: number
  assentosDia: number
  /** As rotas que este modelo voa, da maior oferta para a menor. */
  trechos: { key: string; from: string; to: string; freq: number; seats: number }[]
}

/**
 * A frota da rival por modelo, somando `fleetSize` exatamente.
 *
 * O reparto é por **hora de voo**, com a mesma conta que `limitarPelaFrota`
 * usa para dimensionar a frota: o modelo que consome mais hora da malha é o
 * que tem mais cauda. Fosse por número de rotas, uma ligação intercontinental
 * diária pesaria o mesmo que um salto de quarenta minutos, e a lista diria
 * que a companhia tem um 787 para cada E195.
 *
 * O ajuste do resto no fim existe para a soma bater com `fleetSize` na unha:
 * uma lista de frota que não soma a frota é uma lista errada, e a diferença
 * apareceria bem ao lado, na coluna do ranking.
 */
export function frotaDaConcorrente(comp: Competitor, ano: number): LinhaDeFrota[] {
  const porRota = comp.routes.map((r) => ({ r, t: modeloDaRota(r.seats, r.from, r.to, ano) }))
    .filter((x): x is { r: Competitor['routes'][number]; t: AircraftType } => !!x.t)
  if (!porRota.length) return []

  const horasDe = (r: Competitor['routes'][number]) =>
    r.freq * cicloHoras(distanceBetween(r.from, r.to))

  /**
   * Companhia pequena padroniza a frota.
   *
   * Sem isto, uma rival de três aeronaves e cinco rotas aparecia com cinco
   * modelos diferentes — um de cada —, e a lista somava cinco onde a coluna do
   * ranking dizia três. Não é só a soma que ficava errada: ninguém opera cinco
   * tipos com três caudas, porque cada tipo custa oficina, peça e treinamento
   * de tripulação. Quem tem pouca cauda tem poucos tipos.
   *
   * Ficam os modelos que consomem mais hora de voo, e as rotas dos demais
   * passam para o menor tipo mantido que ainda as cumpre.
   */
  const horasPorTipo = new Map<string, number>()
  for (const { r, t } of porRota) horasPorTipo.set(t.id, (horasPorTipo.get(t.id) ?? 0) + horasDe(r))
  const mantidos = [...horasPorTipo.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, Math.max(1, comp.fleetSize))
    .map(([id]) => porRota.find(p => p.t.id === id)!.t)
    .sort((x, y) => x.maxSeats - y.maxSeats)

  const porModelo = new Map<string, {
    horas: number; rotas: number; assentos: number; trechos: LinhaDeFrota['trechos']
  }>()
  for (const { r, t } of porRota) {
    const dist = distanceBetween(r.from, r.to)
    const serve = (m: AircraftType) => m.range >= dist &&
      aeroportoServe(m, AIRPORT_BY_IATA[r.from]) && aeroportoServe(m, AIRPORT_BY_IATA[r.to])
    const escolhido = mantidos.includes(t)
      ? t
      : mantidos.find((m) => m.maxSeats >= r.seats && serve(m)) ??
        [...mantidos].reverse().find(serve) ?? t
    const v = porModelo.get(escolhido.id) ?? { horas: 0, rotas: 0, assentos: 0, trechos: [] }
    v.horas += horasDe(r)
    v.rotas += 1
    v.assentos += r.seats * r.freq
    v.trechos.push({ key: r.key, from: r.from, to: r.to, freq: r.freq, seats: r.seats })
    porModelo.set(escolhido.id, v)
  }

  const total = [...porModelo.values()].reduce((h, v) => h + v.horas, 0)
  if (!total) return []
  /**
   * Quantas caudas repartir — e não é sempre `fleetSize`.
   *
   * Em quatro companhias das 329 do mundo inicial a malha exige um tipo que
   * nenhum outro tipo mantido cumpre: um destino de pista curta, ou uma etapa
   * longa demais. Aí o modelo entra na lista à força, e a lista passa a ter
   * mais linhas do que a frota declarada tem aviões.
   *
   * Nesse caso quem cede é o número declarado, não a lista: a companhia voa
   * aquela rota, logo ela **tem** aquele avião. É um deslize pequeno da conta
   * de frota da IA — `limitarPelaFrota` dimensiona por hora de voo e não sabe
   * de tipo —, e fica registrado aqui em vez de virar uma soma que não fecha.
   */
  const caudas = Math.max(comp.fleetSize, porModelo.size)
  const linhas = [...porModelo.entries()]
    .map(([typeId, v]) => ({
      typeId,
      nome: AIRCRAFT_BY_ID[typeId].name,
      avioes: Math.max(1, Math.floor((caudas * v.horas) / total)),
      rotas: v.rotas,
      assentosDia: v.assentos,
      trechos: [...v.trechos].sort((x, y) => y.seats * y.freq - x.seats * x.freq),
      peso: v.horas / total,
    }))
    .sort((x, y) => y.peso - x.peso)

  /**
   * O resto vai para quem tem mais malha, e some de quem tem menos.
   *
   * A soma tem que bater com `fleetSize` na unha: a frota declarada aparece na
   * coluna ao lado, no ranking, e uma lista de frota que não soma a frota é
   * uma lista errada. Nenhuma linha desce abaixo de um avião — o modelo está
   * ali porque existe rota voando com ele.
   */
  let sobra = caudas - linhas.reduce((n, l) => n + l.avioes, 0)
  for (let volta = 0; sobra !== 0 && volta < linhas.length * 4; volta++) {
    const l = linhas[sobra > 0 ? volta % linhas.length : linhas.length - 1 - (volta % linhas.length)]
    if (sobra < 0 && l.avioes <= 1) continue
    l.avioes += sobra > 0 ? 1 : -1
    sobra += sobra > 0 ? -1 : 1
  }
  return linhas.map(({ peso: _peso, ...l }) => l)
}
