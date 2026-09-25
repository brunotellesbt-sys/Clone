import assert from 'node:assert/strict'
import { allocateConnections, nearbyAirports } from '../src/game/connections'
import { connectionWindow } from '../src/game/connectionRules'
import { buyAircraft, dowOf, newGame, openRoute, routeEconomics } from '../src/game/engine'
import { marcarVoo } from '../src/game/escala'
import { baseDemand } from '../src/game/demand'
import { sumCabins } from '../src/game/economy'
import { odKey } from '../src/game/geo'
import { fracaoNoturna } from '../src/game/malha'
import { exportSave, importSave } from '../src/game/save'
import type { GameState } from '../src/game/types'

for (const [from, via, to, min, max] of [
  ['SDU', 'BSB', 'REC', 40, 180], ['SDU', 'BSB', 'LIM', 60, 240],
  ['SDU', 'GRU', 'JFK', 60, 240], ['LHR', 'GRU', 'SDU', 180, 360],
  ['GIG', 'ATL', 'JFK', 180, 360], ['GRU', 'MAD', 'OPO', 60, 240],
  ['GRU', 'MAD', 'BCN', 60, 240], ['DUB', 'JFK', 'LAX', 60, 240],
  ['GIG', 'ATL', 'LHR', 180, 360], ['GRU', 'BOG', 'MDE', 60, 240],
] as const) assert.deepEqual([connectionWindow(from, via, to).min, connectionWindow(from, via, to).max], [min, max], `${from}-${via}-${to}`)

function setup(overnight = false, startDay = 0) {
  const s = newGame({ name: 'Conexões reais', code: 'CX', hub: overnight ? 'GRU' : 'SDU', seed: 31 })
  s.competitors = []
  s.day = startDay
  s.airline.cash = 5e9
  s.airline.hubs.push('BSB')
  const origin = s.airline.hubs[0], destination = overnight ? 'REC' : 'LIM'
  for (const [from, to] of [[origin, 'BSB'], ['BSB', destination]]) {
    assert.equal(openRoute(s, from, to), null)
    assert.equal(buyAircraft(s, 'a320neo', false), null)
    s.airline.fleet.at(-1)!.base = from
  }
  const dow = dowOf(s)
  assert.equal(marcarVoo(s, s.airline.fleet[0].id, origin, 'BSB', dow, overnight ? 20 * 60 + 30 : 8 * 60), null)
  assert.equal(marcarVoo(s, s.airline.fleet[1].id, 'BSB', destination, (dow + Number(overnight)) % 7, overnight ? 30 : 12 * 60), null)
  return s
}
function allocate(s: GameState, routeIds = s.airline.routes.map(r => r.id), occupancy = 1) {
  const locals = s.airline.routes.filter(r => routeIds.includes(r.id)).map(route => ({ route,
    voos: s.airline.escala!.filter(p => odKey(p.from, p.to) === odKey(route.from, route.to)),
    seats: { y: 100, w: 10, c: 10, f: 0 }, local: { y: 100 * occupancy, w: 10 * occupancy, c: 10 * occupancy, f: 0 } }))
  return allocateConnections(s, locals, dowOf(s), 1 + s.day)
}

const s = setup()
assert(nearbyAirports('SDU').includes('GIG'))
const demandBefore = baseDemand('SDU', 'BSB', 0, 1)
const manifests = allocate(s)
const first = manifests.get(`0:${s.airline.escala![0].id}`)!, second = manifests.get(`0:${s.airline.escala![1].id}`)!
assert(first.leaving > 0)
assert.equal(first.leaving, second.entering, 'os mesmos passageiros saem de um voo e entram no seguinte')
assert.equal(first.connecting.y, second.connecting.y)
assert(first.local.y < 100, 'conexões tomam parte dos assentos locais quando o voo está cheio')
assert(first.local.y >= 60, 'protege a maioria do atendimento local já conquistado')
assert(sumCabins(first.local) + sumCabins(first.connecting) <= sumCabins(first.capacity))
assert.deepEqual(baseDemand('SDU', 'BSB', 0, 1), demandBefore, 'não altera a procura O&D da rota')
const trip = s.connectionJourneys![0]
assert(sumCabins(trip.pax) <= baseDemand('SDU', 'LIM', 0, 1).total / 2)
assert(trip.firstRevenue > 0 && trip.secondRevenue > 0)
assert.deepEqual(importSave(exportSave(s))!.connectionJourneys, s.connectionJourneys)
const light = setup()
const lightManifests = allocate(light, undefined, .2)
const lightFirst = lightManifests.get(`0:${light.airline.escala![0].id}`)!
assert(sumCabins(lightFirst.connecting) > 0, 'conexões aumentam a lotação do voo vazio')
assert.deepEqual(lightFirst.local, lightFirst.baseline, 'assentos vagos recebem conexões preservando todos os passageiros locais')

// Múltiplas combinações disputam os mesmos passageiros, sem duplicar reservas.
const multi = setup()
for (const [from, to, hour] of [['SDU', 'BSB', 9], ['BSB', 'LIM', 13]] as const) {
  assert.equal(buyAircraft(multi, 'a320neo', false), null)
  multi.airline.fleet.at(-1)!.base = from
  assert.equal(marcarVoo(multi, multi.airline.fleet.at(-1)!.id, from, to, dowOf(multi), hour * 60), null)
}
const shared = allocate(multi, undefined, .2)
assert(multi.connectionJourneys!.length > 1)
for (const cb of ['y', 'w', 'c', 'f'] as const) {
  assert(multi.connectionJourneys!.reduce((n, j) => n + j.pax[cb], 0) <= baseDemand('SDU', 'LIM', 0, 1).pax[cb] / 2)
  for (const m of shared.values()) assert(m.local[cb] + m.connecting[cb] <= m.capacity[cb])
}

const rival = setup()
rival.competitors.push({ id: 'direta', code: 'DR', name: 'Direta', hub: 'GIG', color: '#fff', cash: 1e9,
  reputation: .95, aggression: 1, fleetSize: 30, revenue30: 0,
  routes: [{ key: odKey('GIG', 'LIM'), from: 'GIG', to: 'LIM', freq: 15, seats: 350, fare: .65, quality: 1.3 }] })
allocate(rival)
assert(rival.connectionJourneys!.reduce((n, j) => n + sumCabins(j.pax), 0) < sumCabins(trip.pax), 'voos diretos no GIG reduzem a preferência por SDU via BSB')

for (const startDay of [0, 1]) { // sexta→sábado e sábado→domingo (virada da semana UTC)
  const overnight = setup(true, startDay)
  allocate(overnight, [overnight.airline.routes[0].id])
  assert(overnight.connectionJourneys!.length > 0)
  const reservation = overnight.connectionJourneys![0]
  assert.equal(reservation.second.day, reservation.first.day + 1)
  const restored = importSave(exportSave(overnight))!
  restored.day++
  const next = allocate(restored, [restored.airline.routes[1].id])
  assert.equal(next.get(`${restored.day}:${reservation.second.id}`)!.entering, sumCabins(reservation.pax), 'reserva entre dias preservada após salvar/carregar')
  assert.equal(restored.connectionJourneys!.length, 1, 'não vende de novo o mesmo itinerário')
  const grounded = importSave(exportSave(overnight))!
  grounded.day++
  grounded.airline.fleet[1].groundedUntil = grounded.day + 7
  allocate(grounded, [grounded.airline.routes[1].id])
  assert(grounded.connectionJourneys![0].cancelled, 'não embarca reserva em avião que entrou em manutenção')
}

const night = setup(true)
night.airline.escala![0].saida = 22 * 60 + 30 // no Brasil, 01:30 UTC do dia seguinte
assert.equal(fracaoNoturna(night, night.airline.routes[0], (dowOf(night) + 1) % 7), 1)
assert.equal(fracaoNoturna(night, night.airline.routes[0], dowOf(night)), 0)

for (const [oldSpeed, newSpeed] of [[4, 25], [12, 50], [40, 100], [100, 100], [0, 0]]) {
  const save = setup()
  save.speed = oldSpeed
  assert.equal(importSave(exportSave(save))!.speed, newSpeed)
}

const route = s.airline.routes[0]
s.day = 1
route.openedDay = 1
route.history = [{ day: 1, pax: { y: 100, w: 0, c: 0, f: 0 }, localPax: { y: 90, w: 0, c: 0, f: 0 },
  connectionPax: { y: 10, w: 0, c: 0, f: 0 }, flights: 1, seats: 100, revenue: 0, cost: 0, profit: 0, loadFactor: 1 }]
assert.equal(routeEconomics(s, route).atendidoDiaCabine.y, 90)
assert.equal(routeEconomics(s, route).conexoesDia, 10)
assert.equal(routeEconomics(s, route).loadFactor, 1)
console.log('OK: janelas por redespacho, conservação entre voos, lotação/atendimento local, concorrência GIG–LIM e reservas entre dias/saves.')
