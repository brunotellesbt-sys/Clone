import assert from 'node:assert/strict'
import { advanceDay, assignAircraft, buyAircraft, newGame, openRoute, setAllFrequencies } from '../src/game/engine'
import { pernasDaRota } from '../src/game/escala'
import { DISTRIBUTION_RATE, sumCabins } from '../src/game/economy'
import { connectionResult, deficitRoutes } from '../src/game/financeDiagnostics'
import { distanceBetween } from '../src/game/geo'
import { importSave, exportSave } from '../src/game/save'
import { CABINS } from '../src/game/types'

const s = newGame({ name: 'Conexões', code: 'CN', hub: 'GRU', seed: 31 })
s.airline.cash = 5e9
for (const d of ['REC', 'SSA', 'LIS']) {
  assert.equal(buyAircraft(s, d === 'LIS' ? 'a359' : 'a320neo', false), null)
  assert.equal(openRoute(s, 'GRU', d), null)
  const r = s.airline.routes.at(-1)!
  assert.equal(assignAircraft(s, s.airline.fleet.at(-1)!.id, r.id), null)
  setAllFrequencies(s, r.id, 2)
  r.fare = { y: 1.9, w: 1.9, c: 1.9, f: 1.9 }
}
for (let day = 0; day < 7; day++) {
  advanceDay(s)
  for (const r of s.airline.routes) {
    const total = r.history.find(h => h.day === s.day)
    if (!total) continue
    const categories = total.costBreakdown ? Object.values(total.costBreakdown) : []
    assert.equal(categories.length, 6, 'a apuração registra seis categorias de custo')
    assert(Math.abs(categories.reduce((n, x) => n + x, 0) - total.cost) < 1e-5,
      'as despesas detalhadas fecham com o custo operacional da rota')
    const flights = pernasDaRota(s, r).filter(p => p.ultimoVoo?.day === s.day)
    for (const c of CABINS) assert(Math.abs(flights.reduce((n, p) => n + p.ultimoVoo!.pax[c], 0) - total.pax[c]) < 1e-6,
      'Os passageiros de cada voo precisam fechar com a apuração da rota')
    for (const p of flights) {
      const result = p.ultimoVoo!
      assert(result.conexoesEntrando >= 0 && result.conexoesSaindo >= 0)
      assert(result.conexoesEntrando + result.conexoesSaindo <= sumCabins(result.pax))
      assert(sumCabins(result.pax) <= sumCabins(s.airline.fleet.find(a => a.id === p.aircraftId)!.seats))
    }
  }
}
assert(s.airline.escala!.some(p => p.ultimoVoo && p.ultimoVoo.conexoesEntrando + p.ultimoVoo.conexoesSaindo > 0))
const measured = s.connectionJourneys!.find(j => j.first.own && j.second.own &&
  j.firstCost !== undefined && j.secondCost !== undefined)!
assert(measured, 'há itinerário realizado com custo atribuído aos dois trechos')
const outcome = connectionResult(measured)
assert(outcome.complete && outcome.profit !== null)
const expectedRevenue = (['first', 'second'] as const).reduce((n, side) => n +
  measured[`${side}Revenue`] * (1 + (distanceBetween(measured[side].from, measured[side].to) > 2200 ? .11 : .05)) *
  (1 - DISTRIBUTION_RATE), 0)
assert(Math.abs(outcome.revenue - expectedRevenue) < 1e-6)
assert(Math.abs(outcome.cost - measured.firstCost! - measured.secondCost!) < 1e-6)
assert.equal(connectionResult({ ...measured, firstCost: undefined, secondCost: undefined }).profit, null,
  'save antigo sem custos não mostra lucro inventado')
const restored = importSave(exportSave(s))!
assert.deepEqual(restored.airline.escala!.map(p => p.ultimoVoo), s.airline.escala!.map(p => p.ultimoVoo))
assert.deepEqual(restored.connectionJourneys, s.connectionJourneys, 'custos atribuídos sobrevivem ao save')
const lossRoute = s.airline.routes[0]
lossRoute.history = [{ ...lossRoute.history.at(-1)!, day: s.day, revenue: 100,
  cost: 10000, profit: -9900, seats: 300, pax: { y: 30, w: 0, c: 0, f: 0 },
  costBreakdown: { fuel: 6000, crew: 1000, maintenance: 1000, fees: 1000, handling: 500, catering: 500 } }]
const loss = deficitRoutes(s).find(d => d.route.id === lossRoute.id)!
assert(loss && loss.profit === -9900 && loss.largest?.label === 'Combustível')
assert(loss.carried / loss.offered < .65, 'a ocupação baixa aparece no diagnóstico')
console.log('OK: passageiros e custos fecham com voos/rotas; resultado de conexão e diagnóstico de déficit sobrevivem ao save.')
