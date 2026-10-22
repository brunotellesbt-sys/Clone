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
assert.equal(d.entryTransfer?.companyId,s.competitors[0].id)
assert.equal(d.entryTransfer?.source,'operation')
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
const idle=newGame({name:'Cessão',code:'CS',hub:'GRU',seed:18,densidade:'enxuta'})
idle.airline.cash=1e10;idle.competitors=[{...rival,id:'less',hub:'ANF',routes:[{key:'ANF>SCL',from:'ANF',to:'SCL',freq:2,seats:140,fare:1,quality:1}]},{...rival,id:'more',hub:'ANF',routes:[{key:'ANF>LIM',from:'ANF',to:'LIM',freq:6,seats:140,fare:1,quality:1}]}]
idle.airportDevelopment!.ANF.capacity=16;idle.airportDevelopment!.ANF.reserved=0;invalidateAirportUsage(idle)
assert.equal(openRoute(idle,'GRU','ANF'),null)
assert.equal(idle.airportDevelopment!.ANF.entryTransfer?.companyId,'less','com slots ociosos na cota, pega da empresa que possui ociosos')
assert.equal(idle.airportDevelopment!.ANF.entryTransfer?.source,'idle')
assert.equal(rivalFrequency(idle,idle.competitors[0].routes[0]),2)
assert.equal(rivalFrequency(idle,idle.competitors[1].routes[0]),5)
assert.equal(airportSlots(idle,'ANF').ownLimit,2,'não ganha toda sobra pública além dos dois slots comprados')

// Teste quando NENHUMA empresa tem slots ociosos (ambas operando no ou acima do limite da cota):
const noIdle = newGame({name:'SemOcioso',code:'SO',hub:'GRU',seed:18,densidade:'enxuta'})
noIdle.airline.cash = 1e10
noIdle.competitors = [
  {...rival, id:'less', hub:'ANF', routes:[{key:'ANF>SCL',from:'ANF',to:'SCL',freq:7,seats:140,fare:1,quality:1}]}, // 14 slots (cota de 14 atingida)
  {...rival, id:'more', hub:'ANF', routes:[{key:'ANF>LIM',from:'ANF',to:'LIM',freq:9,seats:140,fare:1,quality:1}]}  // 18 slots (acima da cota)
]
noIdle.airportDevelopment!.ANF.capacity = 28
noIdle.airportDevelopment!.ANF.reserved = 0
invalidateAirportUsage(noIdle)
assert.equal(openRoute(noIdle,'GRU','ANF'),null)
assert.equal(noIdle.airportDevelopment!.ANF.entryTransfer?.companyId,'more','sem ociosos, pega da companhia com mais slots operando')
assert.equal(noIdle.airportDevelopment!.ANF.entryTransfer?.source,'operation')
const vacant=structuredClone(idle)
vacant.airline.routes=[];vacant.airportDevelopment!.ANF.capacity=24;vacant.airportDevelopment!.ANF.reserved=0
delete vacant.airportDevelopment!.ANF.entryAccess;delete vacant.airportDevelopment!.ANF.entryTransfer;invalidateAirportUsage(vacant)
assert.equal(openRoute(vacant,'GRU','ANF'),null)
const purchased = vacant.airportDevelopment!.ANF.entryTransfer as { companyId?: string; source?: string } | undefined
assert.equal(purchased, undefined, 'aeroporto com vagas livres não faz transferência forçada de slots')

// Teste do aeroporto 100% lotado com slots ociosos de outra empresa:
const idleComp = structuredClone(idle)
idleComp.airline.routes = []
idleComp.airportDevelopment!.ANF.capacity = 16
idleComp.airportDevelopment!.ANF.reserved = 0
delete idleComp.airportDevelopment!.ANF.entryAccess
delete idleComp.airportDevelopment!.ANF.entryTransfer
// Competitor 'less' opera 2 freqs (4 slots). Supondo cota dividida, se 'less' tem cota 8 e opera 4, tem 4 ociosos.
// Competitor 'more' opera 6 freqs (12 slots). Total operando = 16/16.
invalidateAirportUsage(idleComp)
assert.equal(openRoute(idleComp, 'GRU', 'ANF'), null)
const transferObj = idleComp.airportDevelopment!.ANF.entryTransfer as { companyId?: string; source?: string } | undefined
assert.equal(transferObj?.companyId, 'less', 'pega os slots ociosos da companhia que possui ociosos')
assert.equal(transferObj?.source, 'idle')
console.log(`OK: categorias solicitadas e ${AIRPORTS.filter(airportAcceptsWidebody).length} aeroportos aptos a widebodies; entrada ANF, limite físico, migração, rivais e persistência.`)
