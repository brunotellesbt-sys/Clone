/**
 * Confere de ponta a ponta que uma rota de carga fecha o dia: compra cargueiro,
 * abre rota de carga, aloca, roda 60 dias e lê o resultado do tick — não a
 * previsão. Serve também de guarda contra o jogo deixar misturar cargueiro com
 * avião de passageiro.
 */
import {
  advanceDay, assignAircraft, buyAircraft, money, newGame, openRoute, routeEconomics,
} from '../src/game/engine'

const hub = process.argv[2] ?? 'GRU'
const dest = process.argv[3] ?? 'MIA'
const s = newGame({ name: 'Carga Teste', code: 'CG', hub, seed: 7 })
s.airline.cash = 900e6

const modelo = process.argv[4] ?? 'a332f'
const erroCompra = buyAircraft(s, modelo, false)
if (erroCompra) throw new Error(`compra: ${erroCompra}`)
const ac = s.airline.fleet[s.airline.fleet.length - 1]

const erroRota = openRoute(s, hub, dest, true)
if (erroRota) throw new Error(`não abriu a rota de carga: ${erroRota}`)
const rota = s.airline.routes[s.airline.routes.length - 1]
if (!rota.cargo) throw new Error('a rota não ficou marcada como carga')

// a trava dos dois sentidos
const paxRota = (openRoute(s, hub, 'JFK', false), s.airline.routes[s.airline.routes.length - 1])
const deveFalhar = assignAircraft(s, ac.id, paxRota.id)
if (!deveFalhar) throw new Error('deixou pôr cargueiro em rota de passageiro')
console.log('trava 1 ok:', deveFalhar)

const erroAloca = assignAircraft(s, ac.id, rota.id)
if (erroAloca) throw new Error(`não alocou o cargueiro: ${erroAloca}`)

for (let i = 0; i < 60; i++) advanceDay(s)
const e = routeEconomics(s, rota)
console.log(
  `${hub}-${dest} carga · mercado ${Math.round(e.demand.total)} t/dia · ` +
  `levou ${Math.round(e.pax)} t em ${e.days} dias · LF ${(e.loadFactor * 100).toFixed(0)}% · ` +
  `receita ${money(e.revenue)} · resultado ${money(e.profit)} · fatia ${(e.share * 100).toFixed(0)}%`,
)
if (e.revenue <= 0) throw new Error('rota de carga não gerou receita')
if (e.pax <= 0) throw new Error('rota de carga não moveu tonelada')
console.log('ok')
