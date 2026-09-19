import {
  AIRPORTS, AIRPORT_BY_IATA, noToqueDeRecolher, vooPermitido, type Airport,
} from './data/airports'
import { atratividadeHorario, DIA, horaDaConcorrente } from './malha'
import { baseDemand } from './demand'
import { distanceBetween, odKey } from './geo'
import {
  batizar, caixaInicial, MERCADOS, PAISES_COM_AVIACAO, quantasCompanhias, vagasDoMundo,
} from './mundo'
import { between, chance, type Rng } from './rng'
import type { Competitor, Densidade } from './types'

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

function candidateDestinations(hub: string, day: number, limit: number, alcance: Alcance = 'int') {
  const base = AIRPORT_BY_IATA[hub]
  const hit = cacheDestinos.get(hub)
  const completa = hit && day < hit.ate
    ? hit.lista
    : (() => {
        const lista = AIRPORTS.filter((a) => a.iata !== hub && !vooPermitido(base, a))
          .map((a) => {
            const d = baseDemand(hub, a.iata, day, 180)
            return { iata: a.iata, score: d.total / (1 + distanceBetween(hub, a.iata) / 4000) }
          })
          .sort((x, y) => y.score - x.score)
          // guarda sempre uma lista longa: pedir 60 e depois 90 não pode custar
          // uma varredura nova, e a lista longa cabe de sobra na memória
          .slice(0, 260)
        cacheDestinos.set(hub, { ate: day + VALIDADE, lista })
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
function addAiRoute(comp: Competitor, dest: string, rng: Rng, day: number) {
  const demand = baseDemand(comp.hub, dest, day, 180)
  // Dimensiona a oferta para pegar um pedaço do mercado, com ruído.
  const target = demand.total * between(rng, 0.05, 0.13) * comp.aggression
  const freq = Math.max(1, Math.min(10, Math.round(target / between(rng, 150, 260))))
  const seats = Math.max(70, Math.min(360, Math.round(target / Math.max(1, freq) / between(rng, 0.7, 0.95))))
  comp.routes.push({
    key: odKey(comp.hub, dest),
    hora: Math.round(6 * 60 + 15 * 60 * (rng() as number)),
    from: comp.hub,
    to: dest,
    seats,
    freq,
    fare: between(rng, 0.86, 1.18),
    quality: (0.75 + 0.5 * comp.reputation) * between(rng, 0.94, 1.08),
  })
  limitarPelaFrota(comp)
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
function limitarPelaFrota(comp: Competitor) {
  const precisa = comp.routes.reduce((h, r) => h + r.freq * cicloHoras(distanceBetween(r.from, r.to)), 0)
  const teto = Math.max(3, Math.round(precisa / UTILIZACAO_DIARIA))
  // a frota persegue a necessidade, mas não salta: quem cresce demais de uma vez
  // não acha piloto nem slot, e no jogo isso vira frequência sem lastro
  comp.fleetSize = comp.fleetSize
    ? Math.min(teto, comp.fleetSize + Math.max(1, Math.round(comp.fleetSize * 0.06)))
    : teto
  const disponivel = comp.fleetSize * UTILIZACAO_DIARIA
  if (precisa <= disponivel) return
  const fator = disponivel / precisa
  for (const r of comp.routes) r.freq = Math.max(1, Math.round(r.freq * fator))
}

/** Decisão semanal: mexe em tarifa, oferta, abre e fecha rota. */
export function stepCompetitors(comps: Competitor[], day: number, rng: Rng, playerPressure: Record<string, number>) {
  for (const comp of comps) {
    for (const r of comp.routes) {
      const pressure = playerPressure[r.key] ?? 0
      // Reage ao jogador: se perdeu espaço, corta preço ou aumenta frequência.
      if (pressure > 0.28 && chance(rng, 0.5 * comp.aggression)) {
        r.fare = Math.max(0.72, r.fare - between(rng, 0.02, 0.07))
      } else if (pressure < 0.05 && chance(rng, 0.25)) {
        r.fare = Math.min(1.35, r.fare + between(rng, 0.01, 0.04))
      }
      if (pressure > 0.4 && chance(rng, 0.22 * comp.aggression)) r.freq = Math.min(11, r.freq + 1)
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
    // o que ela prometeu acima tem que caber na frota dela
    limitarPelaFrota(comp)

    // Crescimento e poda.
    if (chance(rng, 0.17 * comp.aggression) && comp.routes.length < 34) {
      // a rota nova tem que caber no que a companhia já alcança: é assim que
      // ela sobe de doméstica a regional e a internacional, um degrau por vez
      const dests = candidateDestinations(comp.hub, day, 60, alcanceDe(comp, day))
      const open = new Set(comp.routes.map((r) => r.key))
      const next = dests.find((d) => !open.has(odKey(comp.hub, d.iata)))
      if (next) addAiRoute(comp, next.iata, rng, day)
    }
    if (chance(rng, 0.1) && comp.routes.length > 10) {
      const weakest = comp.routes.reduce((w, r, i, arr) => (r.freq < arr[w].freq ? i : w), 0)
      if (chance(rng, 0.5)) comp.routes.splice(weakest, 1)
    }
    /**
     * A malha existente acompanha o mercado, e não fica parada em 2027.
     *
     * Este era o buraco maior do crescimento da IA: uma rota aberta no primeiro
     * dia guardava para sempre os assentos e a frequência do primeiro dia. Num
     * mundo em que a Índia cresce 5,4% ao ano, a companhia indiana ficava do
     * mesmo tamanho enquanto o mercado quintuplicava — e o jogador tomava o
     * país sem precisar ser melhor que ninguém, só mais novo.
     *
     * Uma rota por semana, escolhida ao acaso, e um passo de 4% por vez. Devagar
     * de propósito: companhia aérea não dobra oferta num mês, e um ajuste
     * instantâneo faria a IA responder ao ciclo econômico mais rápido do que o
     * jogador consegue responder à IA.
     */
    if (comp.routes.length) {
      const r = comp.routes[Math.floor(rng() * comp.routes.length)]
      const mercado = baseDemand(r.from, r.to, day, 180).total
      const alvo = mercado * 0.09 * comp.aggression
      const oferta = r.seats * r.freq
      if (oferta > 0) {
        const passo = alvo > oferta ? 1.04 : 0.98
        const novo = oferta * passo
        // cresce por frequência até o avião encher; daí em diante por porte,
        // que é a ordem em que uma companhia de verdade cresce numa rota
        if (alvo > oferta && r.freq < 11 && r.seats > 150) r.freq += 1
        else r.seats = Math.max(50, Math.min(420, Math.round(novo / Math.max(1, r.freq))))
      }
    }

    comp.reputation = Math.min(0.95, Math.max(0.3, comp.reputation + between(rng, -0.006, 0.007)))
  }
}

export const competitorHubName = (c: Competitor) => AIRPORT_BY_IATA[c.hub]?.city ?? c.hub

// --------------------------------------------------- companhias que nascem

/**
 * Anos de jogo antes de a primeira companhia nova poder aparecer, e o
 * intervalo mínimo entre a primeira e a segunda de um mesmo país.
 *
 * Quinze anos dos dois lados, e o número é o que o dono do jogo pediu. A razão
 * dele é boa e vale registrar: companhia aérea nascendo é notícia rara, e
 * evento raro que acontece cedo deixa de ser raro — vira mecânica. O jogador
 * passa os primeiros quinze anos disputando com um mundo estável, aprende quem
 * é quem, e só então o mapa começa a mexer sozinho.
 */
const ANOS_ATE_A_PRIMEIRA = 15
const ANOS_ENTRE_FUNDACOES = 15

/** No máximo duas por país, para sempre. */
const FUNDACOES_POR_PAIS = 2

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
 * Um por cento e meio dá uma fundação a cada ano e pouco de jogo — raro o
 * bastante para ser notícia, frequente o bastante para um jogo de trinta anos
 * ver umas vinte e poucas.
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
 * Roda uma vez por semana e quase sempre não faz nada: são 0,15% de chance por
 * país habilitado, e a maioria dos países nunca fica habilitada. Num mundo
 * equilibrado isso dá algo como uma fundação a cada oito ou dez anos de jogo —
 * raro o bastante para virar notícia quando acontece, que é o ponto.
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
): Competitor | null {
  const anos = day / 365
  if (anos < ANOS_ATE_A_PRIMEIRA) return null

  const candidatos = MERCADOS.filter((m) => {
    if (m.cota === 0) return false
    const antes = fundadas[m.cc] ?? []
    if (antes.length >= FUNDACOES_POR_PAIS) return false
    if (antes.length && anos - antes[antes.length - 1] < ANOS_ENTRE_FUNDACOES) return false
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
  const dests = candidateDestinations(hub, day, 60, 'dom')
  for (const d of dests.filter((x) => !voadas.has(odKey(hub, x.iata)))) {
    if (nova.routes.length >= quantas) break
    addAiRoute(nova, d.iata, rng, day)
  }
  for (const d of dests) {
    if (nova.routes.length >= 3) break
    addAiRoute(nova, d.iata, rng, day)
  }
  // Num país de um aeroporto só não há par doméstico, e a companhia nasceria
  // vazia. Ali ela já nasce regional — que é o que Malta e o Bahrein são.
  if (!nova.routes.length) {
    for (const d of candidateDestinations(hub, day, 20, 'reg')) {
      if (nova.routes.length >= 3) break
      addAiRoute(nova, d.iata, rng, day)
    }
  }
  if (!nova.routes.length) return null

  ;(fundadas[escolhido.cc] ??= []).push(anos)
  return nova
}
