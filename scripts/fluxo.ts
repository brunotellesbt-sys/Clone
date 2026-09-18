/**
 * Calcula o fator de equilíbrio de cada aeroporto e imprime a tabela pronta
 * para colar em `src/game/data/movimento.ts`.
 *
 * ## O problema
 *
 * O modelo gravitacional dá um mercado potencial para **todo** par de
 * aeroportos. Somando o potencial de um aeroporto contra os outros 3.084, o
 * total dá de 3 a 10 vezes o que ele move de verdade — e a distorção não é
 * uniforme: Guarulhos dava 3,4 vezes e Recife 10,1. Ou seja, o modelo inflava
 * os pequenos em relação aos grandes, que é o contrário do que se quer quando o
 * pedido é "respeitar o fluxo de cada aeroporto".
 *
 * ## O método
 *
 * Furness, também chamado de ajuste proporcional iterativo: dá a cada aeroporto
 * um fator, multiplica cada par pela média geométrica dos fatores das duas
 * pontas, mede de novo quanto sobra ou falta em cada um, corrige, repete. É o
 * jeito clássico de distribuir viagens num modelo gravitacional respeitando os
 * totais conhecidos de origem e destino, e converge em poucas rodadas.
 *
 * O alvo de cada aeroporto é `paxDia × ABERTURA`. A abertura existe porque o
 * potencial não é tráfego realizado: nenhuma companhia voa os 3.084 pares, e o
 * mercado de um par só vira passageiro se alguém puser avião nele.
 *
 * ## O que este script ignora, e por quê
 *
 * Ruído por par, sazonalidade, dia da semana e crescimento. Os quatro são
 * multiplicadores de média um: entram no dia a dia do jogo e saem do equilíbrio,
 * que é uma média de longo prazo. Incluí-los custaria nove milhões de hashes
 * por rodada sem mudar o resultado.
 *
 * ## Por que o `K` vem importado
 *
 * Porque já deu errado. A primeira versão repetia o valor aqui, o `K` do
 * `demand.ts` mudou de 0,55 para 0,9 depois que os fatores foram calculados, e
 * ninguém rodou de novo: as razões que eram 2,6 a 3,7 viraram 4,1 a 5,4 em
 * silêncio. Número copiado de outro arquivo envelhece sem avisar; importado,
 * não.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { AIRPORTS, vooPermitido, type Airport } from '../src/game/data/airports'
import { distanceBetween } from '../src/game/geo'
import { K } from '../src/game/demand'

/** Quantas vezes o potencial de um aeroporto pode passar do que ele move. */
const ABERTURA = 3
const RODADAS = 6

const n = AIRPORTS.length
const alvo = AIRPORTS.map((a) => a.paxDia * ABERTURA)
const fator = new Float64Array(n).fill(1)

/** O núcleo do `baseDemand` sem os multiplicadores de média um. */
function nucleo(a: Airport, b: Airport): number {
  const dist = distanceBetween(a.iata, b.iata)
  if (dist < 1) return 0
  const mass = Math.sqrt(a.paxDia * b.paxDia)
  const gdp = (a.gdp + b.gdp) / 2
  const tour = (a.tour + b.tour) / 2
  const sameCountry = a.cc === b.cc ? 1.55 : a.country === b.country ? 1.3 : 1
  const sameRegion = Math.abs(a.lon - b.lon) < 45 && Math.abs(a.lat - b.lat) < 35 ? 1.12 : 1
  const hubBonus = 1 + 0.05 * (a.tier + b.tier - 4)
  const decay = 1 / (1 + Math.pow(dist / 700, 1.35))
  let v = K * Math.pow(mass, 0.9) * gdp * Math.pow(tour, 0.55) * decay * sameCountry * sameRegion * hubBonus
  if (dist < 120) v *= 0.15
  return v
}

// A matriz não cabe na memória em dobro, então o núcleo é recalculado a cada
// rodada. São seis passadas de nove milhões — minutos, uma vez só.
console.log(`${n} aeroportos, ${RODADAS} rodadas de Furness (alvo = movimento × ${ABERTURA})`)
for (let rodada = 1; rodada <= RODADAS; rodada++) {
  const soma = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = AIRPORTS[i]
    for (let j = i + 1; j < n; j++) {
      const b = AIRPORTS[j]
      if (vooPermitido(a, b)) continue
      const v = nucleo(a, b) * Math.sqrt(fator[i] * fator[j])
      soma[i] += v
      soma[j] += v
    }
  }
  let pior = 0
  for (let i = 0; i < n; i++) {
    if (soma[i] <= 0) continue
    const razao = alvo[i] / soma[i]
    fator[i] *= razao
    pior = Math.max(pior, Math.abs(Math.log(razao)))
  }
  console.log(`  rodada ${rodada}: pior desvio ${(Math.exp(pior) * 100 - 100).toFixed(1)}%`)
}

// Grava em milésimos: três casas bastam e o arquivo fica legível.
const linhas: string[] = []
let linha = ''
for (let i = 0; i < n; i++) {
  const p = `${AIRPORTS[i].iata}:${Math.max(1, Math.round(fator[i] * 1000))} `
  if (linha.length + p.length > 76) {
    linhas.push(linha.trimEnd())
    linha = ''
  }
  linha += p
}
linhas.push(linha.trimEnd())
const tabela = linhas.join('\n')

/**
 * Escreve direto no `movimento.ts` em vez de cuspir um arquivo para colar.
 *
 * O passo de colar à mão era o elo frouxo do processo: dava para rodar o script,
 * esquecer de colar, e ficar com a tabela velha achando que tinha atualizado —
 * que é primo do defeito do `K` desatualizado. Passar `--txt` volta ao
 * comportamento antigo, para quem quiser só olhar o resultado.
 */
const destino = 'src/game/data/movimento.ts'
if (process.argv.includes('--txt')) {
  const saida = process.argv[process.argv.indexOf('--txt') + 1] ?? 'fluxo.txt'
  writeFileSync(saida, tabela)
  console.log(`\n${n} fatores em ${saida}`)
} else {
  const fonte = readFileSync(destino, 'utf8')
  const abre = 'const FATOR_FLUXO: Record<string, number> = Object.fromEntries(\n  `'
  const ini = fonte.indexOf(abre)
  const fim = fonte.indexOf('`\n    .split(/\\s+/)', ini)
  if (ini < 0 || fim < 0) {
    console.error(`nao achei a tabela em ${destino}; use --txt e cole a mao`)
    process.exit(1)
  }
  writeFileSync(destino, fonte.slice(0, ini + abre.length) + tabela + fonte.slice(fim))
  console.log(`\n${n} fatores gravados em ${destino}`)
}
