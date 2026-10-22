import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newGame,openRoute,buyAircraft,assignAircraft,setFrequency} from '../src/game/engine'
import {airportSlots,ensureAirports,invalidateAirportUsage,admittedFlights} from '../src/game/airportInfrastructure'
import {importSaveFile,exportSaveFile} from '../src/game/save'
import type {GameState} from '../src/game/types'

const s=newGame({name:'Slots livres',code:'SL',hub:'GRU',seed:18,densidade:'enxuta'})
s.competitors=[];s.airline.cash=1e10;invalidateAirportUsage(s)
const d=s.airportDevelopment!.CWB;d.capacity=20;d.reserved=0
assert.equal(openRoute(s,'GRU','CWB'),null)
assert.equal(d.reserved,0,'abrir onde há vagas não compra reserva')
assert.equal(d.entryAccess,undefined)
assert.equal(d.entryTransfer,undefined)
assert.equal(buyAircraft(s,'e195e2',false),null)
assert.equal(assignAircraft(s,s.airline.fleet[0].id,s.airline.routes[0].id),null)
assert.equal(setFrequency(s,s.airline.routes[0].id,0,3),null)
assert.equal(airportSlots(s,'CWB').own,6,'três idas e voltas usam capacidade livre')

// Reproduz o marcador persistido pelo PR #114. A reserva não é um teto.
d.reserved=2;d.entryAccess=true;invalidateAirportUsage(s)
assert.equal(airportSlots(s,'CWB').ownLimit,20)
assert.equal(admittedFlights(s).size,s.airline.escala!.length)
const restored=importSaveFile(exportSaveFile(s))!
assert.equal(airportSlots(restored,'CWB').ownLimit,20,'save marcado recupera a regra anterior ao carregar')
assert.deepEqual(restored.airline.escala,s.airline.escala)
assert.equal(restored.airline.cash,s.airline.cash)

const rival=newGame({name:'Rivais',code:'RV',hub:'GRU',seed:18,densidade:'enxuta'}).competitors[0]
const busy=structuredClone(s);busy.airline.routes=[];busy.airline.escala=[]
busy.competitors=[{...rival,hub:'ANF',hubs:['ANF'],routes:[{key:'ANF>SCL',from:'ANF',to:'SCL',freq:5,seats:140,fare:1,quality:1}]}]
Object.assign(busy.airportDevelopment!.ANF,{capacity:10,reserved:0})
invalidateAirportUsage(busy)
assert.equal(openRoute(busy,'GRU','ANF'),null)
assert.equal(airportSlots(busy,'ANF').ownLimit,2)
assert(busy.airportDevelopment!.ANF.entryTransfer)
busy.competitors[0].routes[0].freq=1;invalidateAirportUsage(busy)
assert.equal(airportSlots(busy,'ANF').ownLimit,8,'a cessão também não bloqueia espaço que ficar livre depois')

// Conferência opcional do save real, sempre em memória e sem publicar dados.
if(process.argv[2]){
 const path=process.argv[2],raw=readFileSync(path,'utf8')
 const parsed=JSON.parse(raw),original=(parsed.game??parsed) as GameState
 const loaded=importSaveFile(raw)!
 assert(loaded)
 let recovered=0
 for(const [id,data] of Object.entries(original.airportDevelopment??{})){
  const slots=airportSlots(loaded,id),isHub=loaded.airline.hubs.includes(id)
  assert.equal(slots.ownLimit,isHub?slots.reserved:Math.max(slots.reserved,slots.capacity-slots.rivalsOperating),id)
  if(!isHub&&data.entryAccess&&slots.ownLimit>slots.reserved)recovered++
 }
 assert(recovered>0)
 assert.equal(loaded.airline.cash,original.airline.cash)
 assert.deepEqual(loaded.airline.escala,original.airline.escala)
 assert.deepEqual(loaded.airline.routes,original.airline.routes)
 assert.equal(loaded.airline.fleet.length,original.airline.fleet.length)
 assert.deepEqual(loaded.airline.hubs,original.airline.hubs)
 const infrastructure=structuredClone(loaded.airportDevelopment)
 ensureAirports(loaded);ensureAirports(loaded)
 assert.deepEqual(loaded.airportDevelopment,infrastructure,'não cria concessões ao reabrir')
 assert.equal(readFileSync(path,'utf8'),raw,'arquivo original intacto')
 console.log(`Save: ${recovered} estações recuperam capacidade livre; ${loaded.airline.routes.length} rotas e ${loaded.airline.fleet.length} aeronaves preservadas.`)
}
console.log('OK: capacidade livre do PR #113, entrada só quando lotado, recuperação de saves e frequências acima de uma ida e volta.')
