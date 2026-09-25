import assert from 'node:assert/strict'
import { advanceDay, assignAircraft, buyAircraft, newGame, openRoute, setAllFrequencies } from '../src/game/engine'
import { pernasDaRota } from '../src/game/escala'
import { sumCabins } from '../src/game/economy'
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
const restored = importSave(exportSave(s))!
assert.deepEqual(restored.airline.escala!.map(p => p.ultimoVoo), s.airline.escala!.map(p => p.ultimoVoo))
console.log('OK: passageiros por voo fecham com a rota, conexões respeitam os embarques e sobrevivem ao save.')
