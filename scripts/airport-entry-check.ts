import assert from 'node:assert/strict'
import {AIRPORTS,AIRPORT_BY_IATA as AP,airportAcceptsWidebody} from '../src/game/data/airports'
import {newGame,openRoute,closeRoute} from '../src/game/engine'
import {airportSlots,effectiveAirport,ensureAirports,invalidateAirportUsage,rivalFrequency,routeEntryAccess} from '../src/game/airportInfrastructure'
import {exportSaveFile,importSaveFile} from '../src/game/save'

const requested='MAO FLN POA REC NAT CWB SSA CNF BEL VCP PNZ CFB IGU MCZ SLZ THE'.split(' ')
for(const id of requested)assert.equal(AP[id].escopo,'int',id)
for(const a of AIRPORTS)if(airportAcceptsWidebody(a))assert.equal(a.escopo,'int',a.iata)
for(const id of ['SDU','CGH','PLU'])assert.equal(AP[id].escopo,'dom',id)
const s=newGame({name:'Acesso',code:'AC',hub:'GRU',seed:18,densidade:'enxuta'})
s.airline.cash=1e10
const rival=s.competitors[0]
s.competitors=[{...rival,hub:'ANF',hubs:['ANF'],routes:[{key:'ANF>SCL',from:'ANF',to:'SCL',freq:5,seats:140,fare:1,quality:1}]}]
const d=s.airportDevelopment!.ANF;d.capacity=10;d.reserved=0
invalidateAirportUsage(s)
assert.equal(airportSlots(s,'ANF').free,0,'destino ocupado pela IA antes da entrada')
assert.equal(routeEntryAccess(s,'ANF').available,2)
assert.equal(openRoute(s,'GRU','ANF'),null)
assert.equal(d.capacity,10,'não cria capacidade física')
assert.equal(d.reserved,2,'reserva inicial da estação')
assert.equal(airportSlots(s,'ANF').free,2)
assert.equal(rivalFrequency(s,s.competitors[0].routes[0]),4,'IA respeita capacidade compartilhada')
const capacity=d.capacity,reserved=d.reserved
ensureAirports(s);ensureAirports(s)
assert.equal(d.reserved,reserved,'não concede novamente')
closeRoute(s,s.airline.routes[0].id)
assert.equal(openRoute(s,'GRU','ANF'),null)
assert.equal(d.capacity,capacity);assert.equal(d.reserved,reserved,'reabrir não multiplica a reserva')
const restored=importSaveFile(exportSaveFile(s))!
assert.equal(restored.airportDevelopment!.ANF.reserved,2)
// Save antigo: rota já paga sem voos e categoria regional antiga.
delete d.entryAccess;d.reserved=0
s.airportDevelopment!.MAO.category='reg';s.airportDevelopment!.IGU.category='reg'
ensureAirports(s)
assert.equal(d.reserved,2,'corrige rota antiga ainda sem operação')
assert.equal(effectiveAirport(s,'MAO').escopo,'int')
assert.equal(s.airportDevelopment!.IGU.category,'int')
const failed=newGame({name:'Lotado',code:'LT',hub:'GRU',seed:18,densidade:'enxuta'})
failed.airline.cash=1e10;failed.airportDevelopment!.ANF.capacity=1
invalidateAirportUsage(failed)
const cash=failed.airline.cash,rights=failed.airportDevelopment!.ANF.reserved
assert(openRoute(failed,'GRU','ANF')?.includes('ANF'))
assert.equal(failed.airline.cash,cash,'não cobra abertura inviável')
assert.equal(failed.airportDevelopment!.ANF.reserved,rights)
assert.equal(failed.airline.routes.length,0)
failed.airportDevelopment!.ANF.capacity=4
failed.airportDevelopment!.ANF.work={kind:'slots',start:0,end:365,contribution:0,automatic:true}
failed.competitors=[{...rival,hub:'ANF',hubs:['ANF'],routes:[{key:'ANF>SCL',from:'ANF',to:'SCL',freq:5,seats:140,fare:1,quality:1}]}]
invalidateAirportUsage(failed)
assert(routeEntryAccess(failed,'ANF').blocked,'não promete reserva cheia durante redução por obra')
console.log(`OK: categorias solicitadas e ${AIRPORTS.filter(airportAcceptsWidebody).length} aeroportos aptos a widebodies; entrada ANF, limite físico, migração, rivais e persistência.`)
