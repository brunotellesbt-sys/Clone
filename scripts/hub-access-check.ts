import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newGame,addHub,closeHub,HUB_COST} from '../src/game/engine'
import {hubCompanies,hubCompanyLimit} from '../src/game/hubAccess'
import {rebalanceCompetitorHubs} from '../src/game/ai'
import {ensureAirports,airportSlots,largeBases,growthProgress,invalidateAirportUsage,recordAirportDay} from '../src/game/airportInfrastructure'
import {importSaveFile,exportSaveFile} from '../src/game/save'
import {AIRPORT_BY_IATA as AP} from '../src/game/data/airports'
import type {GameState} from '../src/game/types'

const s=newGame({name:'Hub tests',code:'HT',hub:'GRU',seed:77,densidade:'enxuta'})
s.airline.cash=1e10;s.airline.reputation=1
for(const [level,limit] of [[1,2],[2,2],[3,2],[4,3],[5,4]]){s.airportDevelopment!.GRU.level=level;assert.equal(hubCompanyLimit(s,'GRU'),limit)}
s.airportDevelopment!.GRU.level=5
const comp=s.competitors[0]
s.competitors=Array.from({length:6},(_,i)=>({...structuredClone(comp),id:`r${i}`,hub:'GRU',hubs:['GRU'],routes:[]}))
// Realistic routes are necessary to choose a replacement that can operate.
for(const c of s.competitors)c.routes=[{key:'GRU>BSB',from:'GRU',to:'BSB',freq:1,seats:140,hora:600,fare:1,quality:1}]
rebalanceCompetitorHubs(s,true)
for(const id of new Set([...s.airline.hubs,...s.competitors.flatMap(c=>c.hubs??[c.hub])]))assert(hubCompanies(s,id)<=hubCompanyLimit(s,id),id)
assert(s.competitors.some(c=>c.hub!=='GRU'&&c.routes.some(r=>r.from===c.hub)),'transferência altera a malha da rival')
for(const c of s.competitors)assert(c.routes.every(r=>r.from!==r.to),'sem rotas circulares')
s.competitors=[];invalidateAirportUsage(s)
assert.equal(addHub(s,'CGH'),null)
const cash=s.airline.cash
assert.equal(closeHub(s,'CGH'),null);assert.equal(s.airline.cash,cash+HUB_COST)
assert(closeHub(s,'CGH'));assert.equal(s.airline.cash,cash+HUB_COST,'não reembolsa duas vezes')
assert(closeHub(s,'GRU'),'não fecha o último hub')
// Cria apenas movimentos de fixture para verificar reserva, migração e progressão.
s.airline.escala=Array.from({length:12},(_,i)=>({id:`l${i}`,aircraftId:'fixture',from:'CGH',to:['GRU','BSB','SSA'][i%3],dow:0,saida:480+i*10}))
invalidateAirportUsage(s);delete s.cghExtraSlotsGranted
const before=airportSlots(s,'CGH');ensureAirports(s);const after=airportSlots(s,'CGH')
assert.equal(after.capacity,before.capacity+41);assert.equal(after.ownLimit,before.ownLimit+41)
assert.equal(s.airportDevelopment!.GRU.personalSlots,undefined)
ensureAirports(s);assert.equal(airportSlots(s,'CGH').ownLimit,after.ownLimit,'benefício idempotente')
assert(largeBases(s).includes('CGH'));assert(!s.airline.hubs.includes('CGH'))
const base=growthProgress(s,'CGH');s.airline.hubs.push('CGH');const hub=growthProgress(s,'CGH');s.airline.hubs.pop()
assert.equal(base.daysNeeded,Math.ceil(hub.daysNeeded*1.2));assert.equal(base.paxNeeded,Math.ceil(hub.paxNeeded*1.2))
const reserved=s.airportDevelopment!.CGH.reserved;s.day++;recordAirportDay(s,{},false)
assert(s.airportDevelopment!.CGH.reserved>=reserved,'passar o dia conserva concessão pessoal')
// Teste adicional opcional: migração somente em memória do save do usuário.
if(process.argv[2]){
 const raw=readFileSync(process.argv[2],'utf8'),loaded=importSaveFile(raw) as GameState
 assert(loaded);assert(loaded.cghExtraSlotsGranted);assert.equal(loaded.airportDevelopment!.CGH.personalSlots,41)
 assert(largeBases(loaded).includes('CGH'))
 for(const id of Object.keys(AP))assert(hubCompanies(loaded,id)<=hubCompanyLimit(loaded,id),id)
 const restored=importSaveFile(exportSaveFile(loaded))!
 assert.equal(restored.airportDevelopment!.CGH.capacity,loaded.airportDevelopment!.CGH.capacity)
 assert.equal(restored.airportDevelopment!.CGH.personalSlots,41)
 assert.equal(readFileSync(process.argv[2],'utf8'),raw)
 console.log('Save: limites respeitados, CGH base grande e +41 uma única vez; arquivo intacto.')
}
console.log('OK: limites 4/3/2, realocação da IA, reembolso sem duplicação, concessão CGH e bases grandes.')
