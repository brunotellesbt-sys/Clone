/**
 * Quantas companhias cada país sustenta, e quem são elas.
 *
 * O jogo tinha doze concorrentes escritas à mão, sempre as mesmas, sempre nos
 * mesmos doze hubs. Isso tem duas consequências ruins e nenhuma boa: quem funda
 * em Lima nunca disputa com ninguém do Peru, e quem funda em Chicago nasce
 * dividindo a cidade com uma IA — e nos dois casos o mapa do mundo não tem nada
 * a ver com o mercado que o resto do jogo modela com cuidado.
 *
 * Aqui o mundo é povoado a partir do próprio catálogo:
 *
 * | movimento do país | companhias |
 * |---|---|
 * | ≥ 300 mil pax/dia | 4 |
 * | ≥ 60 mil | 3 |
 * | ≥ 6 mil | 2 |
 * | abaixo disso | 1 |
 * | sem rede possível | 0 |
 *
 * Os cortes não são redondos por acaso: 300 mil separa os vinte e dois maiores
 * mercados do mundo — Estados Unidos, China, Índia, Japão, Espanha, Reino
 * Unido, Canadá, Indonésia, Rússia, Alemanha, Turquia, Brasil e mais nove —, e
 * é essa a lista que se espera ver com quatro companhias cada.
 *
 * "Sem rede possível" é um aeroporto só, e ele doméstico: sem um segundo
 * aeroporto não existe par nacional, e sem escopo internacional não existe
 * direito de sair. Jersey, Guernsey e as Malvinas caem aí. O Vaticano, que o
 * pedido citou, se resolve sozinho — ele não tem aeroporto, então nunca chega a
 * entrar nesta conta.
 *
 * O contrário também vale, e é por isso que a regra não é "dois aeroportos":
 * Kuwait, Bahrein, Malta, Macau e a Letônia têm **um** aeroporto no catálogo e
 * companhia nacional de verdade, porque ela é internacional. Um aeroporto de
 * escopo internacional basta.
 *
 * Nada de React aqui: é `src/game/`.
 */
import { AIRPORTS, AIRPORT_BY_IATA, type Airport } from './data/airports'
import { PECAS_NOME } from './data/names'
import { between, type Rng } from './rng'

/** Cortes de movimento do país, em passageiros por dia. */
const GRANDE = 300_000
const MEDIO = 60_000
const PEQUENO = 6_000

export interface Mercado {
  cc: string
  pais: string
  /** Passageiros por dia somados de todos os aeroportos do país. */
  paxDia: number
  /** Quantas companhias o país sustenta. */
  cota: number
  /** Aeroportos do país, do maior para o menor. */
  aeroportos: Airport[]
}

/**
 * Os mercados do mundo, do maior para o menor. Calculado uma vez.
 *
 * A ordem é o que faz a escolha do jogador ter sentido: pedir "quarenta
 * companhias" dá as quarenta dos maiores mercados, não quarenta sorteadas pelo
 * mapa. Um mundo pequeno é um mundo onde só os grandes voam, que é como a
 * aviação de verdade começou.
 */
export const MERCADOS: Mercado[] = (() => {
  const porPais = new Map<string, { pais: string; paxDia: number; aeroportos: Airport[] }>()
  for (const a of AIRPORTS) {
    const m = porPais.get(a.cc) ?? { pais: a.country, paxDia: 0, aeroportos: [] }
    m.paxDia += a.paxDia
    m.aeroportos.push(a)
    porPais.set(a.cc, m)
  }
  const out: Mercado[] = []
  for (const [cc, m] of porPais) {
    m.aeroportos.sort((x, y) => y.paxDia - x.paxDia)
    const temSaida = m.aeroportos.some((a) => a.escopo !== 'dom')
    const cota = m.aeroportos.length < 2 && !temSaida ? 0
      : m.paxDia >= GRANDE ? 4
      : m.paxDia >= MEDIO ? 3
      : m.paxDia >= PEQUENO ? 2
      : 1
    out.push({ cc, pais: m.pais, paxDia: m.paxDia, cota, aeroportos: m.aeroportos })
  }
  return out.sort((x, y) => y.paxDia - x.paxDia)
})()

/** Quantos países do mundo sustentam alguma companhia. */
export const PAISES_COM_AVIACAO = MERCADOS.filter((m) => m.cota > 0).length

export interface Vaga {
  cc: string
  pais: string
  hub: string
  /** Posição dela dentro do país: 0 é a maior. */
  ordem: number
}

/**
 * As vagas de companhia do mundo, para um recorte de países.
 *
 * A densidade conta **países**, não companhias, e a diferença é o que faz a
 * regra 4/3/2 valer. Na primeira versão ela contava companhias e a fila era
 * intercalada por posição — a maior de cada país primeiro, depois a segunda de
 * cada —, e o resultado desmontava o pedido: com quarenta e cinco companhias,
 * os quarenta e cinco maiores mercados ficavam com **uma** cada, o Brasil
 * incluído, e o jogador brasileiro não tinha com quem disputar em casa. O
 * número que interessa é "quantos países do mundo têm aviação", e a cota de
 * cada um sai do tamanho dele.
 *
 * O país do jogador entra sempre, mesmo fora do recorte. Fundar no Peru num
 * mundo enxuto não pode significar voar sozinho no Peru: é justamente a
 * partida em que a concorrência de casa mais importa.
 */
export function vagasDoMundo(paises: number, ccDoJogador?: string): Vaga[] {
  const dentro = MERCADOS.slice(0, paises).filter((m) => m.cota > 0)
  if (ccDoJogador && !dentro.some((m) => m.cc === ccDoJogador)) {
    const m = MERCADOS.find((x) => x.cc === ccDoJogador)
    if (m && m.cota > 0) dentro.push(m)
  }
  const out: Vaga[] = []
  for (const m of dentro) {
    for (let ordem = 0; ordem < m.cota; ordem++) {
      out.push({
        cc: m.cc,
        pais: m.pais,
        hub: m.aeroportos[ordem % m.aeroportos.length].iata,
        ordem,
      })
    }
  }
  return out
}

/** Quantas companhias um recorte de países gera. */
export const quantasCompanhias = (paises: number, ccDoJogador?: string) =>
  vagasDoMundo(paises, ccDoJogador).length

/**
 * Nome e código de uma companhia, estáveis para a vaga e únicos na partida.
 *
 * O nome é montado de peças (ver `PECAS_NOME`) porque quatrocentos nomes à mão
 * não se escrevem nem se mantêm. O código de duas letras tenta primeiro as
 * iniciais do próprio nome — é assim que companhia de verdade escolhe o dela —
 * e só cai no sorteio quando já está tomado.
 */
export function batizar(vaga: Vaga, rng: Rng, usados: Set<string>) {
  const { cabeca, cauda, cores } = PECAS_NOME
  let nome = ''
  for (let i = 0; i < 40 && !nome; i++) {
    const tentativa = `${cabeca[Math.floor(rng() * cabeca.length)]} ${cauda[Math.floor(rng() * cauda.length)]}`
    if (!usados.has(tentativa)) nome = tentativa
  }
  if (!nome) nome = `${AIRPORT_BY_IATA[vaga.hub]?.city ?? vaga.cc} Air`
  usados.add(nome)

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const iniciais = nome.split(' ').map((p) => p[0]?.toUpperCase()).filter((c) => c && letras.includes(c))
  let code = iniciais.slice(0, 2).join('')
  while (code.length < 2 || usados.has(code)) {
    code = letras[Math.floor(rng() * 26)] + letras[Math.floor(rng() * 26)]
  }
  usados.add(code)

  return { name: nome, code, color: cores[Math.floor(rng() * cores.length)] }
}

/**
 * Caixa inicial, proporcional ao mercado de casa.
 *
 * Companhia do maior mercado do mundo não começa com o mesmo dinheiro de uma
 * de Vanuatu. A raiz achata a diferença de propósito: os Estados Unidos movem
 * trinta mil vezes as Ilhas Cook, e trinta mil vezes o caixa faria a IA
 * americana comprar o planeta no primeiro ano.
 */
export function caixaInicial(m: Mercado, ordem: number, rng: Rng): number {
  const escala = Math.sqrt(m.paxDia / 100_000)
  const posicao = 1 / (1 + 0.45 * ordem) // a primeira do país é a maior
  return Math.max(35e6, between(rng, 160, 520) * 1e6 * escala * posicao)
}
