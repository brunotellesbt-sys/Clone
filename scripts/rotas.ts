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
  r.fare = { y: 1.4, w: 1.3, c: 1.2, f: 1.1 }
  const demanda: Cabins = { y: 100, w: 10, c: 5, f: 0 }
  const atendido: Cabins = { y: 50, w: 20, c: 5, f: 0.5 }
  const sug = sugerirTarifasParaCobertura(r, demanda, atendido)
  conferir(sug.y < 1, 'sugestão reduz Y quando falta demanda')
  conferir(sug.w > 1, 'sugestão sobe W quando passou da demanda')
  conferir(Math.abs(sug.c - 1) < 0.001, 'sugestão mantém C em 1× quando já está em 100%')

  // piso econômico: classe com atendimento quase zero nunca vai para tarifa gratuita.
  const quaseZero = sugerirTarifasParaCobertura(r, demanda, { y: 0.01, w: 0, c: 0.05, f: 0 })
  conferir(quaseZero.y >= 0.55 && quaseZero.y > 0, 'sugestão nunca cai abaixo do piso em Y')
  conferir(quaseZero.w >= 0.55 && quaseZero.w > 0, 'sugestão nunca cai abaixo do piso em W')

  // idempotência: reaplicar a mesma sugestão sem novo histórico não muda o valor.
  const rotaAposSugestao = { ...r, fare: { ...sug } }
  const sugDeNovo = sugerirTarifasParaCobertura(rotaAposSugestao, demanda, atendido)
  conferir(Math.abs(sugDeNovo.y - sug.y) < 1e-9, 'aplicar sugestão duas vezes mantém Y')
  conferir(Math.abs(sugDeNovo.w - sug.w) < 1e-9, 'aplicar sugestão duas vezes mantém W')

  // atendimento muito baixo não deve cair indefinidamente: fica no piso.
  const muitoBaixo = sugerirTarifasParaCobertura(r, demanda, { y: 0, w: 0.2, c: 0.11, f: 0 })
  const muitoBaixoDeNovo = sugerirTarifasParaCobertura({ ...r, fare: { ...muitoBaixo } }, demanda, { y: 0, w: 0.2, c: 0.11, f: 0 })
  conferir(muitoBaixo.y >= 0.55 && muitoBaixo.w >= 0.55 && muitoBaixo.c >= 0.55, 'atendido muito baixo respeita piso')
  conferir(Math.abs(muitoBaixo.w - muitoBaixoDeNovo.w) < 1e-9, 'atendido muito baixo não reduz indefinidamente')

  // demanda zero/classe inelegível: não inventa sugestão nova.
  const semDemanda = sugerirTarifasParaCobertura(r, { y: 0, w: 0, c: 0, f: 0 }, { y: 10, w: 2, c: 1, f: 0.2 })
  conferir(Math.abs(semDemanda.f - r.fare.f) < 1e-9, 'classe inelegível sem demanda não gera sugestão indevida')
}

// ------------------------- atendido/restante por dias corridos em histórico esparso
{
  const s = newGame({ name: 'Hist', code: 'HS', hub: 'GRU', seed: 9 })
  openRoute(s, 'GRU', 'REC')
  s.day = 30
  const r = s.airline.routes[0]
  const dia = (day: number, pax: Cabins): DayResult => ({
    day,
    pax,
    flights: 2,
    seats: 300,
    revenue: 0,
    cost: 0,
    profit: 0,
    loadFactor: 0,
  })
  r.history = [
    dia(30, { y: 100, w: 20, c: 10, f: 2 }),
    dia(10, { y: 999, w: 999, c: 999, f: 999 }), // fora da janela
  ]
  const e = routeEconomics(s, r)
  conferir(Math.abs(e.atendidoDiaCabine.y - (100 / 14)) < 0.01, 'atendido/dia por classe usa 14 dias corridos')
  conferir(Math.abs(e.atendidoDiaCabine.f - (2 / 14)) < 0.01, 'atendido/dia inclui dias sem voo como zero')
  conferir(Math.abs(e.atendidoDia - (132 / 14)) < 0.01, 'atendido total/dia usa média por dias corridos')
  conferir(e.restanteDiaCabine.y >= 0 && e.restanteDiaCabine.f >= 0, 'restante/dia por classe nunca fica negativo')
  conferir(Math.abs(e.restanteDiaCabine.y - Math.max(0, e.demand.pax.y - (100 / 14))) < 0.01, 'restante/dia por classe usa a mesma média diária')
  conferir(e.sugestaoFare.y < r.fare.y, 'sugestão de tarifa usa cobertura diária corrigida')
}

// ------------------------------------------ carga: histórico esparso por dias corridos
{
  const s = newGame({ name: 'Cargo', code: 'CG', hub: 'GRU', seed: 9 })
  openRoute(s, 'GRU', 'MIA', true)
  s.day = 30
  const r = s.airline.routes[0]
  const diaCarga = (day: number, tons: number): DayResult => ({
    day,
    pax: { y: 0, w: 0, c: 0, f: 0 },
    flights: 1,
    seats: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    loadFactor: 0,
    tons,
    tonsOffered: 120,
  })
  r.history = [
    diaCarga(30, 100),
    diaCarga(8, 999), // fora da janela
  ]
  const e = routeEconomics(s, r)
  conferir(Math.abs(e.atendidoDia - (100 / 14)) < 0.01, 'carga: atendido/dia usa 14 dias corridos')
  conferir(Math.abs(e.restanteDia - Math.max(0, e.demandaDia - (100 / 14))) < 0.01, 'carga: restante/dia usa média diária corrigida')
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
