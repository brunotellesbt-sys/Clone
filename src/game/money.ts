/**
 * A moeda em que a tarifa é escrita.
 *
 * **A simulação inteira continua em dólar.** Receita, custo, preço de aeronave,
 * empréstimo, patrimônio: tudo em USD, como sempre foi, porque converter por
 * dentro significaria carregar a cotação em cada conta de voo e em cada linha
 * do livro-caixa para não ganhar nada — a decisão do jogador não muda porque o
 * número está em outra unidade.
 *
 * O que muda é a **leitura da tarifa**. Passagem é o único número do jogo que o
 * jogador compara com a vida dele: quem joga do Brasil sabe quanto custa uma
 * ponte aérea em reais e não faz ideia de quanto são $57. Então a tarifa — e só
 * ela — aparece na moeda de quem compra a passagem.
 *
 * ## Qual moeda, e por quê a da origem
 *
 * A passagem é vendida onde a viagem começa, e é isso que o jogo usa: GRU–LIS
 * sai em real, LIS–GRU em euro. Não é regra de contabilidade — companhia vende
 * nos dois lados e fecha em dólar —, é a regra que dá a leitura certa para
 * quem está montando a rota a partir da própria base.
 *
 * ## A cotação
 *
 * Fixa, do dia em que foi escrita. O jogo não tem mercado de câmbio e inventar
 * um mudaria a tarifa sem o jogador ter feito nada — barulho com cara de
 * simulação. Se a cotação envelhecer, o que envelhece é a leitura, nunca a
 * conta.
 */

export type Moeda = 'USD' | 'BRL' | 'EUR'

interface Cambio {
  /** Quantas unidades desta moeda valem um dólar. */
  porDolar: number
  simbolo: string
  /** Como o número é escrito: o real e o euro usam vírgula decimal. */
  locale: string
  nome: string
}

/**
 * Cotação de **19 de setembro de 2026**, do exchangerate-api.
 *
 * Duas casas na tabela e nenhuma na tela: tarifa de $57 vira R$ 293, e o
 * centavo não muda decisão nenhuma.
 */
export const CAMBIO: Record<Moeda, Cambio> = {
  USD: { porDolar: 1, simbolo: '$', locale: 'en-US', nome: 'dólar' },
  BRL: { porDolar: 5.14, simbolo: 'R$', locale: 'pt-BR', nome: 'real' },
  EUR: { porDolar: 0.87, simbolo: '€', locale: 'pt-BR', nome: 'euro' },
}

/**
 * Países que usam o euro, pelo código de duas letras.
 *
 * São os da zona do euro mais os que o adotaram sem entrar nela — Montenegro e
 * Kosovo usam euro sem emitir euro, e para quem compra passagem isso é a mesma
 * coisa. Fora da lista, a Europa continua em dólar de propósito: o jogo não
 * modela libra, franco nem coroa, e escrever "€" numa passagem de Londres seria
 * pior do que escrever "$".
 */
const ZONA_DO_EURO = new Set([
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA', 'XK',
])

/** A moeda de um país, pelo código de duas letras. */
export function moedaDoPais(cc: string): Moeda {
  if (cc === 'BR') return 'BRL'
  if (ZONA_DO_EURO.has(cc)) return 'EUR'
  return 'USD'
}

/** Converte de dólar para a moeda. */
export const emMoeda = (usd: number, m: Moeda) => usd * CAMBIO[m].porDolar

/**
 * A tarifa escrita, com símbolo. Sem casa decimal: passagem é comparada em
 * dezenas, e "R$ 292,77" só ocupa espaço.
 */
export function tarifa(usd: number, m: Moeda, sufixo = ''): string {
  const c = CAMBIO[m]
  const v = Math.round(emMoeda(usd, m))
  const separado = v.toLocaleString(c.locale, { maximumFractionDigits: 0 })
  return `${c.simbolo}${m === 'USD' ? '' : ' '}${separado}${sufixo}`
}
