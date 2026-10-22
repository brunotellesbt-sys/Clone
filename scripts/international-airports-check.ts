import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {AIRPORTS,AIRPORT_BY_IATA as AP,vooPermitido} from '../src/game/data/airports'
import {AIRCRAFT_ALL,AIRCRAFT_BY_ID} from '../src/game/data/aircraft'
import {aeroportoServe,motivoDoPar,withEngine} from '../src/game/spec'
import {newGame,openRoute,buyAircraft,assignAircraft,advanceDay} from '../src/game/engine'
import {aeronaveServe} from '../src/game/escala'
import {effectiveAirport,invalidateAirportUsage} from '../src/game/airportInfrastructure'
import {passengerAircraftForRoute} from '../src/game/routeCapacity'
import {exportSaveFile,importSaveFile} from '../src/game/save'

const before=JSON.parse(readFileSync(new URL('./fixtures/international-outside-br-before.json',import.meta.url),'utf8')) as {
 airports:number;variants:number;brazilCount:number;brazil:string;brazilPermissions:string;
 withoutScope:string;unchangedScopes:string;permissions:string;
 changed:{iata:string;country:string;before:string}[]
}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const variants=AIRCRAFT_ALL.flatMap(t=>t.engines.map(e=>withEngine(t,e)))
const brazil=AIRPORTS.filter(a=>a.cc==='BR'),changed=new Set(before.changed.map(a=>a.iata))
assert.equal(AIRPORTS.length,before.airports)
assert.equal(variants.length,before.variants)
assert.equal(brazil.length,before.brazilCount)
assert.equal(hash(brazil),before.brazil,'todos os campos dos aeroportos brasileiros permanecem intactos')
assert.equal(hash(brazil.map(a=>[a.iata,...variants.map(t=>aeroportoServe(t,a))])),before.brazilPermissions,'Brasil mantém as mesmas permissões para todas as variantes')
assert.equal(hash(AIRPORTS.map(({escopo,...rest})=>rest)),before.withoutScope,'categoria não altera pista, elevação, capacidade ou economia')
assert.equal(hash(AIRPORTS.filter(a=>!changed.has(a.iata)).map(a=>[a.iata,a.escopo])),before.unchangedScopes,'demais categorias e exceções explícitas preservadas')
for(const old of before.changed){
 assert.notEqual(old.country,'BR')
 assert.equal(AP[old.iata].cc,old.country)
 assert.equal(AP[old.iata].escopo,'int',old.iata)
}
assert.equal(hash(AIRPORTS.map(a=>[a.iata,...variants.map(t=>aeroportoServe(t,a.iata==='RAI'?{...a,iata:undefined}:a))])),before.permissions,'fora do A321neo em RAI, as permissões físicas globais são idênticas')
for(const [from,to] of [['RAI','LIS'],['RAI','PDL'],['VXE','LIS'],['BVC','LGW'],['SXM','CDG'],['WLG','SYD']])
 assert.equal(vooPermitido(AP[from],AP[to]),null,`${from}–${to}`)
assert(vooPermitido(AP.SDU,AP.LIS),'restrição brasileira preservada')
assert.equal(Math.round(AP.RAI.runway*.3048),2100)
assert.equal(AP.RAI.pistaOperacional,undefined,'não infla a pista operacional de Praia')
for(const engine of AIRCRAFT_BY_ID.a321neo.engines){
 const t=withEngine(AIRCRAFT_BY_ID.a321neo,engine)
 assert(aeroportoServe(t,AP.RAI),engine)
 assert.equal(motivoDoPar(t,AP.RAI,AP.LIS),null)
 assert.equal(motivoDoPar(t,AP.LIS,AP.RAI),null)
 assert(!aeroportoServe(t,{...AP.RAI,runway:6000}),'exceção exige a pista real disponível')
 assert(!aeroportoServe(t,{...AP.RAI,tetoAssentos:146}),'exceção não ignora teto de porte')
}
for(const id of ['a21lr','a21xlr','a388'])assert(!aeroportoServe(withEngine(AIRCRAFT_BY_ID[id]),AP.RAI),id)
assert(passengerAircraftForRoute('RAI','LIS',2027).some(t=>t.id==='a321neo'),'catálogo de aeronaves disponíveis usa a mesma exceção')
assert(!passengerAircraftForRoute('RAI','NRT',2027).some(t=>t.id==='a321neo'),'alcance continua obrigatório')

const s=newGame({name:'Praia',code:'PR',hub:'RAI',seed:18,densidade:'enxuta'})
s.airline.cash=1e10;s.competitors=[];invalidateAirportUsage(s)
assert.equal(openRoute(s,'RAI','LIS'),null)
assert.equal(buyAircraft(s,'a321neo',false),null)
const ac=s.airline.fleet[0]
assert.equal(aeronaveServe(s,ac,'RAI','LIS'),null)
assert.equal(assignAircraft(s,ac.id,s.airline.routes[0].id),null,'programa ida e volta com A321neo')
assert(s.airline.escala!.length>0)
// Saves já existentes podem ter persistido a categoria regional.
for(const {iata} of before.changed)s.airportDevelopment![iata].category='reg'
const originalLegs=structuredClone(s.airline.escala),originalCapacity=s.airportDevelopment!.RAI.capacity
const restored=importSaveFile(exportSaveFile(s))!
assert(restored)
for(const {iata} of before.changed)assert.equal(effectiveAirport(restored,iata).escopo,'int',`save/${iata}`)
assert.equal(restored.airportDevelopment!.RAI.capacity,originalCapacity)
assert.equal(restored.airportDevelopment!.RAI.runway,s.airportDevelopment!.RAI.runway)
assert.deepEqual(restored.airline.escala,originalLegs)
advanceDay(restored)
assert(restored.ledger.at(-1)!.flights>0,'a operação programada entra na simulação')
console.log(`OK: ${before.changed.length} categorias internacionais fora do Brasil; ${brazil.length} aeroportos brasileiros intactos em todos os campos e ${variants.length} variantes; RAI–LIS com A321neo, saves, pista, porte e alcance.`)
