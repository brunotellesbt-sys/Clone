import assert from 'node:assert/strict'
import { AIRPORT_BY_IATA } from '../src/game/data/airports'
import { TRAVEL_EVENTS } from '../src/game/data/travelEvents'
import { LUNAR_FESTIVAL_DATES } from '../src/game/data/lunarFestivalDates'
import { DAY_MS, dayOfYearAt, easterDate, gameDayDate, mondayOf, utcDate } from '../src/game/calendarDates'
import { eventDates, eventsBetween, eventsForYear, monthBounds, routeCalendarEffect } from '../src/game/travelCalendar'
import { baseDemand, NIVEL_TARIFARIO, PISO_JATO, PISO_TURBO } from '../src/game/demand'
import { newGame, openRoute, routeEconomics, estimateRoute } from '../src/game/engine'

const iso = (date: number) => new Date(date).toISOString().slice(0, 10)
const occurrence = (id: string, year: number) => eventsForYear(year).find(e => e.event.id === id)!
const day = (date: number, startYear = 2027) => (date - utcDate(startYear, 1, 1)) / DAY_MS
const demand = (from: string, to: string, date: number, calendar = true, startYear = 2027) =>
  baseDemand(from, to, day(date, startYear), dayOfYearAt(day(date, startYear), startYear), startYear, calendar)
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`)

assert.equal(new Set(TRAVEL_EVENTS.map(e => e.id)).size, TRAVEL_EVENTS.length)
assert.equal(TRAVEL_EVENTS.filter(e => e.category === 'evento').length, 300, '300 eventos, excluindo férias')
assert(TRAVEL_EVENTS.filter(e => e.category === 'ferias').length >= 20, 'férias têm contagem independente')
assert.equal(new Set(TRAVEL_EVENTS.map(e => e.name)).size, TRAVEL_EVENTS.length, 'sem duplicar nomes de eventos')
const destinations = TRAVEL_EVENTS.flatMap(e => e.airports.map(a => {
  assert(AIRPORT_BY_IATA[a.iata], `${e.id}: aeroporto ${a.iata} deve existir`)
  return AIRPORT_BY_IATA[a.iata]
}))
assert(new Set(destinations.map(a => a.cc)).size >= 40)
assert.deepEqual([...new Set(destinations.map(a => a.cont))].sort(), ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'])
for (const event of TRAVEL_EVENTS) {
  assert(event.sources.length > 0, `${event.id}: fontes`)
  assert(event.sources.every(s => new URL(s.url).protocol === 'https:'))
  assert(event.airports.length > 0)
  for (const airport of event.airports) {
    assert(AIRPORT_BY_IATA[airport.iata], `${event.id}: aeroporto ${airport.iata}`)
    assert(airport.boost > 0 && airport.boost <= 1.2)
  }
  for (const iata of event.gateways ?? []) assert(AIRPORT_BY_IATA[iata], `${event.id}: acesso ${iata}`)
}
// Percorre por ano para validar também o catálogo grande sem inutilizar os caches limitados.
for (let year = 2026; year < 2070; year++) {
  for (const o of eventsForYear(year)) {
    const event = o.event
    assert(o.actualEnd >= o.actualStart)
    assert(o.start <= o.actualStart && o.end >= o.actualEnd)
    assert.equal(new Date(o.start).getUTCDay(), 1)
    assert.equal(new Date(o.end).getUTCDay(), 0)
    assert(o.end - o.start < 130 * DAY_MS, `${event.id}: temporada não se prolonga indevidamente`)
  }
}

// Tabelas do Observatório de Hong Kong: anos lunares mudam de data e não repetem no mês intercalar.
assert.equal(iso(occurrence('hong-kong-new-year', 2027).actualStart), '2027-02-06')
assert.equal(iso(occurrence('hong-kong-new-year', 2028).actualStart), '2028-01-26')
assert.equal(iso(occurrence('hong-kong-dragon', 2026).actualStart), '2026-06-19')
assert.equal(iso(occurrence('singapore-mid-autumn', 2026).actualStart), '2026-09-25')
assert.equal(iso(occurrence('hong-kong-new-year', 2033).actualStart), '2033-01-31')
assert.equal(iso(occurrence('hong-kong-new-year', 2034).actualStart), '2034-02-19')
assert.equal(Object.keys(LUNAR_FESTIVAL_DATES).length, 75)
for (let year = 2026; year <= 2100; year++) {
  const row = LUNAR_FESTIVAL_DATES[year]
  assert(row && row[0] >= 121 && row[0] <= 220 && row[1] >= 501 && row[1] <= 630 && row[2] >= 801 && row[2] <= 1031)
  for (const id of ['hong-kong-new-year', 'hong-kong-dragon', 'singapore-mid-autumn']) {
    const o = occurrence(id, year)
    assert.equal(o.certainty, 'Recorrência anual')
    assert.equal(eventsForYear(year).filter(x => x.event.id === id).length, 1)
  }
}
assert.equal(occurrence('hong-kong-new-year', 2101).certainty, 'Projeção anual')
assert.equal(iso(occurrence('hiwasa', 2027).actualStart), '2027-10-09', 'fim de semana antes da segunda segunda-feira')
assert.equal(occurrence('australian-open', 2027).certainty, 'Datas confirmadas')
assert.equal(occurrence('australian-open', 2028).certainty, 'Projeção anual')

assert.equal(iso(easterDate(2027)), '2027-03-28')
assert.equal(iso(easterDate(2028)), '2028-04-16')
assert.equal(iso(occurrence('carnaval', 2027).actualStart), '2027-02-04')
assert.equal(iso(occurrence('carnaval', 2027).actualEnd), '2027-02-10')
assert.equal(iso(occurrence('carnaval', 2028).actualStart), '2028-02-24')
assert.equal(iso(occurrence('carnaval', 2028).actualEnd), '2028-03-01')
assert.equal(iso(occurrence('cirio', 2027).actualStart), '2027-10-10')
assert.equal(iso(occurrence('parintins', 2028).actualStart), '2028-06-30')
assert.equal(iso(occurrence('parintins', 2028).actualEnd), '2028-07-02')
assert.equal(occurrence('saire', 2026).certainty, 'Datas confirmadas')
assert.equal(occurrence('saire', 2027).certainty, 'Projeção anual')
assert.equal(occurrence('parintins', 2027).certainty, 'Recorrência anual')
assert.equal(occurrence('ferias-verao-sc', 2027).certainty, 'Temporada do jogo')
assert.deepEqual(eventDates(TRAVEL_EVENTS.find(e => e.id === 'oktoberfest-munich')!, 2027).map(iso), ['2027-09-18', '2027-10-03'])
assert.deepEqual(eventDates(TRAVEL_EVENTS.find(e => e.id === 'edinburgh-fringe')!, 2027).map(iso), ['2027-08-06', '2027-08-30'])

// A janela de verão começa na segunda da semana de 16/12 e só termina no domingo da semana de 15/02.
const summer = occurrence('ferias-verao-sc', 2027)
assert.equal(iso(summer.start), '2027-12-13')
assert.equal(iso(summer.end), '2028-02-20')
assert.equal(routeCalendarEffect('GRU', 'NVT', summer.start - DAY_MS).boost, 0)
assert.equal(routeCalendarEffect('GRU', 'NVT', summer.end + DAY_MS).events.some(o => o.event.id === 'ferias-verao-sc'), false)
close(routeCalendarEffect('GRU', 'NVT', summer.end + DAY_MS).boost, .12) // Carnaval em São Paulo começa nessa semana.
const crossing = eventsBetween(utcDate(2028, 1, 1), utcDate(2028, 1, 31))
assert(crossing.some(o => o.key === 'ferias-verao-sc:2027'))
assert(crossing.some(o => o.key === 'natal-luz:2027'))
assert.equal(crossing.filter(o => o.event.id === 'ferias-verao-sc').length, 1)
assert.equal(iso(gameDayDate(59, 2028)), '2028-02-29')
assert.equal(iso(occurrence('inverno-alpes', 2028).actualEnd), '2028-02-29')
assert.equal(iso(occurrence('mardi-gras', 2027).actualEnd), '2027-02-09')
assert.equal(iso(occurrence('sinulog', 2027).actualStart), '2027-01-17')
close(NIVEL_TARIFARIO / 1.15, 1.03)
close((PISO_JATO.y + PISO_JATO.w) / 300, 1.03)
close(PISO_TURBO.y / 114, 1.03)

// A procura é realmente constante nos sete dias, inclusive na virada do ano e em ano bissexto.
for (const [year, month, date] of [[2027, 1, 4], [2027, 6, 21], [2027, 12, 27], [2028, 2, 28], [2040, 7, 2]]) {
  const monday = mondayOf(utcDate(year, month, date))
  for (const [from, to] of [['GRU', 'NVT'], ['MAO', 'PIN'], ['GRU', 'LIS'], ['LHR', 'JFK']]) {
    const expected = demand(from, to, monday)
    for (let offset = 1; offset < 7; offset++) assert.deepEqual(demand(from, to, monday + offset * DAY_MS), expected,
      `${from}-${to}: demanda diária constante na semana de ${iso(monday)}`)
  }
}

// Verão +35% de Y, sem criar primeira classe; o par nos dois sentidos continua simétrico.
const january = utcDate(2028, 1, 10)
const regular = demand('GRU', 'NVT', january, false)
const holiday = demand('GRU', 'NVT', january)
close(holiday.pax.y, regular.pax.y * 1.35)
close(holiday.pax.w, regular.pax.w * (1 + .35 * .85))
close(holiday.pax.c, regular.pax.c * (1 + .35 * .35))
assert.equal(holiday.pax.f, 0)
assert.deepEqual(holiday, demand('NVT', 'GRU', january))
assert.equal(demand('GRU', 'CGH', january).total, 0, 'evento não cria par proibido')
assert.equal(routeCalendarEffect('GRU', 'NVT', utcDate(2027, 7, 12)).boost, .22)

// Parintins: PIN ganha procura; MAO/BEL/STM não ganham bônus local indiscriminado.
const festival = occurrence('parintins', 2027)
for (const gate of ['MAO', 'BEL', 'STM']) {
  const extra = demand(gate, 'PIN', festival.start)
  const original = demand(gate, 'PIN', festival.start, false)
  close(extra.pax.y, original.pax.y * 2)
  assert(extra.total > original.total)
  assert.equal(routeCalendarEffect('GRU', gate, festival.start).boost, 0)
}
assert.equal(routeCalendarEffect('MAO', 'PIN', festival.end).boost, 1, 'retorno do festival')
assert.equal(routeCalendarEffect('MAO', 'PIN', festival.end + DAY_MS).boost, 0)
assert(demand('GRU', 'PIN', festival.start).total > demand('GRU', 'PIN', festival.start, false).total,
  'o mercado O&D usado pelas conexões também aumenta')

// Férias + Carnaval: não duplica o evento só porque as duas pontas participam.
const carnival = occurrence('carnaval', 2027).start
close(routeCalendarEffect('SSA', 'REC', carnival).boost, .45 + .30)
close(routeCalendarEffect('NVT', 'FLN', january).boost, .35)
// Férias catarinenses + Encantos do Natal; férias nordestinas não duplicam o bônus.
close(routeCalendarEffect('NVT', 'REC', january).boost, .35 + .12)
close(routeCalendarEffect('MCO', 'PIN', festival.start).boost, 1.2)
assert.notEqual(demand('LHR', 'JFK', utcDate(2027, 3, 15), false).total,
  demand('LHR', 'JFK', utcDate(2027, 7, 15), false).total, 'sazonalidade continua')
assert.notEqual(demand('LHR', 'JFK', utcDate(2027, 3, 15), false).total,
  demand('LHR', 'JFK', utcDate(2037, 3, 15), false).total, 'deriva econômica continua')

// Eventos elevam, nunca reduzem a mesma base semanal; temporadas não vazam e caches suportam décadas.
for (let year = 2027; year <= 2032; year++) for (const event of TRAVEL_EVENTS) {
  const o = occurrence(event.id, year)
  for (const a of event.airports) {
    const from = a.iata === 'GRU' || a.iata === 'CGH' || a.iata === 'VCP' ? 'BSB' : 'GRU'
    const base = demand(from, a.iata, o.start, false)
    const boosted = demand(from, a.iata, o.start)
    for (const c of ['y', 'w', 'c', 'f'] as const) assert(boosted.pax[c] >= base.pax[c])
    assert.equal(routeCalendarEffect(from, a.iata, o.start - DAY_MS).events.some(x => x.key === o.key), false)
    assert.equal(routeCalendarEffect(from, a.iata, o.end + DAY_MS).events.some(x => x.key === o.key), false)
  }
}
assert.deepEqual(monthBounds(utcDate(2027, 6, 22)), { first: 2027 * 12 + 5, last: 2028 * 12 + 11 })
assert.deepEqual(monthBounds(utcDate(2028, 1, 1)), { first: 2028 * 12, last: 2029 * 12 + 11 })

// O painel da rota e a estimativa antes de abrir usam a data do save e a mesma demanda.
const state = newGame({ name: 'Calendário QA', code: 'CQ', hub: 'GRU', seed: 41 })
state.startYear = 2028
state.day = 9
state.airline.cash = 1e9
assert.equal(openRoute(state, 'GRU', 'NVT'), null)
const route = state.airline.routes[0]
assert.deepEqual(routeEconomics(state, route).demand, demand('GRU', 'NVT', january, true, 2028))
assert.deepEqual(estimateRoute(state, 'GRU', 'NVT', 'e195', 1).demand, routeEconomics(state, route).demand)
console.log(`OK: ${TRAVEL_EVENTS.length} períodos, aeroportos/fontes válidos, 44 anos de recorrência, semanas estáveis, feriados móveis, limites anuais e demanda integrada.`)
