import { baseDemand } from '../src/game/demand'
import { newGame, openRoute, routeEconomics, sugerirTarifasParaCobertura } from '../src/game/engine'
import { compararPorOrdenacao } from '../src/game/routeOrdering'
import type { Cabins, DayResult } from '../src/game/types'

let falhas = 0
const conferir = (ok: boolean, oque: string, extra = '') => {
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${oque}${extra ? `  ${extra}` : ''}`)
  if (!ok) falhas++
}

// ------------------------------------------------- primeira classe doméstica
const ponte = baseDemand('SDU', 'CGH', 0, 180)
conferir(ponte.pax.f === 0, 'SDU–CGH não gera demanda de primeira classe')

const curta = baseDemand('GRU', 'GIG', 0, 180)
conferir(curta.pax.f === 0, 'doméstica até 2.000 km não gera primeira classe')

const longaDom = baseDemand('JFK', 'LAX', 0, 180)
conferir(longaDom.distance * 1.852 > 2000, 'caso doméstico de teste passa de 2.000 km')
conferir(longaDom.pax.f > 0, 'doméstica longa elegível pode gerar primeira classe')

// -------------------------------------------------- sugestão de tarifa por classe
{
  const s = newGame({ name: 'Teste', code: 'TS', hub: 'GRU', seed: 11 })
  openRoute(s, 'GRU', 'REC')
  const r = s.airline.routes[0]
  const demanda: Cabins = { y: 100, w: 10, c: 5, f: 0 }
  const atendido: Cabins = { y: 50, w: 20, c: 5, f: 0 }
  const sug = sugerirTarifasParaCobertura(r, demanda, atendido)
  conferir(sug.y < r.fare.y, 'sugestão reduz Y quando falta demanda')
  conferir(sug.w > r.fare.w, 'sugestão sobe W quando passou da demanda')
  conferir(Math.abs(sug.c - r.fare.c) < 0.001, 'sugestão mantém C quando já está em 100%')
}

// ------------------------------------------ atendido/restante por classe na rota
{
  const s = newGame({ name: 'Hist', code: 'HS', hub: 'GRU', seed: 9 })
  openRoute(s, 'GRU', 'REC')
  const r = s.airline.routes[0]
  const dia = (pax: Cabins): DayResult => ({
    day: 0,
    pax,
    flights: 2,
    seats: 300,
    revenue: 0,
    cost: 0,
    profit: 0,
    loadFactor: 0,
  })
  r.history = [
    dia({ y: 100, w: 20, c: 10, f: 2 }),
    dia({ y: 120, w: 22, c: 8, f: 1 }),
  ]
  const e = routeEconomics(s, r)
  conferir(Math.abs(e.atendidoDiaCabine.y - 110) < 0.01, 'atendido/dia por classe usa média do histórico')
  conferir(Math.abs(e.atendidoDiaCabine.f - 1.5) < 0.01, 'atendido/dia inclui primeira quando elegível')
  conferir(e.restanteDiaCabine.y >= 0 && e.restanteDiaCabine.f >= 0, 'restante/dia por classe nunca fica negativo')
}

// -------------------------------------------------------------- ordenação
{
  const lista = [
    { id: 'a', distance: 100, demand: 30 },
    { id: 'b', distance: 400, demand: 90 },
    { id: 'c', distance: 250, demand: 50 },
  ]
  const porDist = [...lista].sort((x, y) => compararPorOrdenacao('dist-asc', x, y)).map((x) => x.id).join('')
  const porDemanda = [...lista].sort((x, y) => compararPorOrdenacao('demand-desc', x, y)).map((x) => x.id).join('')
  conferir(porDist === 'acb', 'ordenação padrão por distância crescente')
  conferir(porDemanda === 'bca', 'ordenação por demanda prioriza mais alta')
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)

