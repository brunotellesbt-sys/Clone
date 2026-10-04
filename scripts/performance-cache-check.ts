import assert from 'node:assert/strict'
import {AIRPORTS,mesmoSistemaAeroportuario,sameSystemAirports} from '../src/game/data/airports'
import {newGame} from '../src/game/engine'
import {admittedFlights,airportUsage,invalidateAirportUsage,updateRivalUsage} from '../src/game/airportInfrastructure'

// Compara o índice com a regra antiga, inclusive exceções e cidades homônimas.
for(const a of AIRPORTS){
 const expected=AIRPORTS.filter(b=>b.iata===a.iata||mesmoSistemaAeroportuario(a,b)).map(b=>b.iata).sort()
 assert.deepEqual(sameSystemAirports(a.iata).map(b=>b.iata).sort(),expected,a.iata)
}
const s=newGame({name:'Cache',code:'CC',hub:'GRU',seed:17,densidade:'enxuta'})
s.competitors=[]
s.airline.escala=[{id:'test',aircraftId:'fixture',from:'CGH',to:'SDU',dow:1,saida:600}]
s.airportDevelopment!.CGH.capacity=4;s.airportDevelopment!.CGH.reserved=0
invalidateAirportUsage(s)
const accepted=admittedFlights(s)
assert(accepted.has('test'))
updateRivalUsage(s,[],[{from:'LHR',to:'CDG',freq:20}])
assert.strictEqual(admittedFlights(s),accepted,'concorrência distante reutiliza admissão')
updateRivalUsage(s,[],[{from:'CGH',to:'SSA',freq:2}])
assert(!admittedFlights(s).has('test'),'concorrência que ocupa a capacidade invalida admissão')
updateRivalUsage(s,[{from:'CGH',to:'SSA',freq:2}],[])
assert(admittedFlights(s).has('test'),'capacidade liberada devolve admissão')
airportUsage(s).get('CGH')!.rivals=4
updateRivalUsage(s,[],[])
assert(!admittedFlights(s).has('test'),'revisão final da IA também detecta limites alterados')
console.log('OK: agrupamento equivalente nos 3.088 aeroportos; cache de admissão preserva os limites reais.')
