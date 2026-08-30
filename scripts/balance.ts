/**
 * Simulação headless para conferir balanceamento: joga sozinho por N dias
 * com uma estratégia simples e imprime a evolução financeira.
 */
import { AIRCRAFT } from '../src/game/data/aircraft'
import { AIRPORTS, AIRPORT_BY_IATA } from '../src/game/data/airports'
import { baseDemand } from '../src/game/demand'
import { marketPrice } from '../src/game/economy'
import { distanceBetween } from '../src/game/geo'
import {
  advanceDay, assignAircraft, buyAircraft, estimateRoute, money, netWorth, newGame,
  openRoute, period, setAllFrequencies, takeLoan,
} from '../src/game/engine'

const HUB = process.argv[2] ?? 'GRU'
const DAYS = Number(process.argv[3] ?? 1460)

const s = newGame({ name: 'Teste', code: 'TT', hub: HUB, seed: 42 })

function bestDestinations(n: number) {
  return AIRPORTS.filter((a) => a.iata !== HUB)
    .map((a) => {
      const dist = distanceBetween(HUB, a.iata)
      const d = baseDemand(HUB, a.iata, s.day, 180)
      return { iata: a.iata, dist, total: d.total, ref: d.refFare }
    })
    .filter((x) => x.dist > 130)
    .sort((x, y) => y.total * y.ref - x.total * x.ref)
    .slice(0, n)
}

const targets = bestDestinations(70)
let ti = 0

for (let day = 0; day < DAYS; day++) {
  // Estratégia boba: sempre que sobra caixa, compra avião e abre a próxima rota boa.
  if (day % 10 === 0) {
    while (ti < targets.length) {
      const t = targets[ti]
      const affordable = AIRCRAFT.filter(
        (a) => a.range > t.dist * 1.05 &&
          a.runway <= Math.min(AIRPORT_BY_IATA[HUB].runway, AIRPORT_BY_IATA[t.iata].runway) &&
          s.startYear + s.day / 365 >= a.since,
      )
      if (!affordable.length) { ti++; continue }
      const budget = s.airline.cash - 12e6
      const best = affordable
        .filter((a) => marketPrice(a) <= budget)
        .map((a) => ({ a, est: estimateRoute(s, HUB, t.iata, a.id, Math.min(6, Math.max(1, Math.round(baseDemand(HUB, t.iata, s.day, 180).total / (a.maxSeats * 2.2))))) }))
        .sort((x, y) => y.est.profit - x.est.profit)[0]
      if (!best) break // sem caixa para nada: espera acumular
      if (best.est.profit < 4000) { ti++; continue }
      if (buyAircraft(s, best.a.id, false)) break
      const ac = s.airline.fleet[s.airline.fleet.length - 1]
      if (openRoute(s, HUB, t.iata)) { ti++; continue }
      const route = s.airline.routes[s.airline.routes.length - 1]
      assignAircraft(s, ac.id, route.id)
      const freq = Math.min(
        Math.floor(best.est.offered / Math.max(1, best.a.maxSeats * 2)) || 1,
        Math.max(1, Math.round(best.est.demand.total / (best.a.maxSeats * 2.2))),
      )
      setAllFrequencies(s, route.id, Math.max(1, freq))
      ti++
    }
  }
  if (day % 180 === 0 && day > 0 && s.airline.cash < 30e6) takeLoan(s, 60e6)
  advanceDay(s)

  if (day % 180 === 0 || day === DAYS - 1) {
    const p = period(s, 90)
    console.log(
      `dia ${String(s.day).padStart(4)} | caixa ${money(s.airline.cash).padStart(10)}` +
        ` | patrim ${money(netWorth(s)).padStart(10)}` +
        ` | frota ${String(s.airline.fleet.length).padStart(3)}` +
        ` | rotas ${String(s.airline.routes.length).padStart(3)}` +
        ` | lucro/dia ${money(p.profit / Math.max(1, p.days)).padStart(9)}` +
        ` | LF ${(p.loadFactor * 100).toFixed(1)}%` +
        ` | rep ${(s.airline.reputation * 100).toFixed(0)}` +
        ` | fuel $${s.fuelPrice.toFixed(2)}`,
    )
  }
}

const first = s.airline.routes[0]
if (first) {
  const h = first.history.slice(-7)
  const rev = h.reduce((x, d) => x + d.revenue, 0) / h.length
  const cost = h.reduce((x, d) => x + d.cost, 0) / h.length
  console.log(`\nrota exemplo ${first.from}-${first.to} (${Math.round(first.distance)} nm, ${first.freq[1]}x/dia)`)
  console.log(`  receita/dia ${money(rev)} | custo/dia ${money(cost)} | margem ${(((rev - cost) / rev) * 100).toFixed(1)}%`)
  console.log(`  LF ${(h[h.length - 1].loadFactor * 100).toFixed(1)}%`)
}
console.log(`\nranking de receita (30d):`)
;[...s.competitors].sort((a, b) => b.revenue30 - a.revenue30).slice(0, 5)
  .forEach((c, i) => console.log(`  ${i + 1}. ${c.name.padEnd(24)} ${money(c.revenue30)} | ${c.routes.length} rotas`))
console.log(`  você: ${money(period(s, 30).revenue)}`)

// debug rápido do primeiro alvo
const t0 = targets[0]
console.log('\nalvo #1:', t0.iata, Math.round(t0.dist), 'nm, demanda', Math.round(t0.total))
