import assert from 'node:assert/strict'
import { newGame } from '../src/game/engine'
import { baseDemand } from '../src/game/demand'
import { largestPassengerAircraft } from '../src/game/routeCapacity'
import { activeHubs, cityDevelopment, competitorHubs, hubExtraSlots, hubGrowthRateMultiplier, invalidateHubActivity, nearbyHubDemand, stepHubDevelopment } from '../src/game/hubDevelopment'
import { ensureAirports } from '../src/game/airportInfrastructure'
import { aiFleetHours, stepCompetitors } from '../src/game/ai'
import { makeRng } from '../src/game/rng'
import { exportSaveFile, importSaveFile } from '../src/game/save'
import { AIRPORT_BY_IATA } from '../src/game/data/airports'
import { aeroportoServe } from '../src/game/spec'

for (const [from, to] of [['SDU','CGH'],['GRU','JFK'],['MAO','GYN'],['FOR','JDO'],['GRU','PGZ'],['VAL','SSA']]) {
  const plane = largestPassengerAircraft(from, to, 2027)!
  assert(plane && aeroportoServe(plane,AIRPORT_BY_IATA[from]) && aeroportoServe(plane,AIRPORT_BY_IATA[to]))
  const d = baseDemand(from,to,129,0,2027,false)
  assert(d.total >= 2 * plane.maxSeats - 1e-8)
  assert.equal(d.total,baseDemand(to,from,129,0,2027,false).total)
  assert(Math.abs(d.total-Object.values(d.pax).reduce((a,b)=>a+b,0))<1e-8)
  if(plane.family==='turboprop') assert.equal(d.pax.w+d.pax.c+d.pax.f,0)
}
assert.equal(largestPassengerAircraft('SDU','JFK',2027),undefined)
assert(baseDemand('SDU','JFK',0,0).total>0,'O&D sem direto ainda pode viajar por conexão')
assert.equal(baseDemand('GRU','CGH',0,0).total,0)
assert.equal(baseDemand('SDU','CGH',0,0).pax.f,0)
assert.equal(hubGrowthRateMultiplier(2,40,0),2)
assert.equal(hubGrowthRateMultiplier(2,40,1),4)
assert.equal(hubGrowthRateMultiplier(22,40,0),1.5)
assert.equal(hubGrowthRateMultiplier(22,40,1),2.5)
assert.equal(hubGrowthRateMultiplier(2,0,0),1)

const s = newGame({ name:'Economia', code:'EC', hub:'MAO', seed:19, densidade:'enxuta' })
s.airline.hubs.push('PVH')
s.competitors = [{...s.competitors[0],hub:'MAO',hubs:['MAO','PVH'],cash:1e9,fleetSize:10,
  routes:[{key:'MAO-PVH',from:'MAO',to:'PVH',freq:20,seats:180,fare:1,quality:1}]}]
assert.equal(nearbyHubDemand(s,'MAO','PVH'),2)
assert.equal(nearbyHubDemand(undefined,'MAO','PVH'),1)
stepHubDevelopment(s)
assert.equal(cityDevelopment(s,'MAO').traffic,1)
for(let day=1;day<=365;day++) { s.day=day; stepHubDevelopment(s) }
const development = cityDevelopment(s,'MAO')
assert(development.traffic>1.009 && development.traffic<1.012)
assert(development.population>1 && development.purchasingPower>1)
assert.equal(hubExtraSlots(s,'MAO'),0,'hub comprado sem voos próprios não ganha slots da IA')
const flying=structuredClone(s)
flying.airline.fleet=[{id:'test',typeId:'e195e2',groundedUntil:0}] as typeof flying.airline.fleet
flying.airline.escala=[{id:'test-leg',aircraftId:'test',from:'MAO',to:'PVH',dow:0,saida:480}]
ensureAirports(flying)
assert(hubExtraSlots(flying,'MAO')>0)
const loaded=importSaveFile(exportSaveFile(s))!
assert.deepEqual(loaded.hubDevelopment,s.hubDevelopment)
assert.deepEqual(loaded.competitors[0].hubs,['MAO','PVH'])
const copy=structuredClone(s)
copy.competitors=[]
copy.hubDevelopment=undefined
assert.equal(cityDevelopment(copy,'MAO').traffic,1)
assert.equal(activeHubs(copy).size,0)
assert.equal(nearbyHubDemand(copy,'MAO','PVH'),1)
const accumulated=cityDevelopment(s,'MAO').traffic
const earnedPending=s.hubDevelopment!.pending?.['BR:Manaus'] ?? 0
s.competitors=[]
invalidateHubActivity(s)
for(let day=366;day<=400;day++){s.day=day;stepHubDevelopment(s)}
assert(Math.abs(cityDevelopment(s,'MAO').traffic - accumulated * Math.exp(earnedPending)) < 1e-10,
  'hub inativo apenas recebe o crédito já acumulado antes de encerrar')

// Empresa madura com capacidade de reinvestir abre bases e cresce gradualmente.
const world=newGame({name:'Expansão',code:'EX',hub:'GRU',seed:22,densidade:'enxuta'})
const rival=world.competitors.find(c=>AIRPORT_BY_IATA[c.hub].cc==='BR')!
rival.cash=1e9
rival.desde=-30*365
world.competitors=[rival]
world.airline.hubs=['GRU','MAO','PVH','SSA','FOR','BSB','SDU']
world.airline.fleet=Array.from({length:46},()=>({groundedUntil:0})) as typeof world.airline.fleet
world.airline.routes=Array.from({length:224},()=>({})) as typeof world.airline.routes
const before=rival.fleetSize
for(let week=1;week<=52;week++){
  world.day=week*7
  stepCompetitors(world.competitors,world.day,makeRng(week+42),{},224,2027,world)
  assert(aiFleetHours(rival)<=rival.fleetSize*18+1e-8,'oferta cabe na frota')
  assert(rival.cash>=0)
  assert.equal(new Set(rival.routes.map(r=>r.key)).size,rival.routes.length)
  for(const r of rival.routes) assert(r.seats<=largestPassengerAircraft(r.from,r.to,2028)!.maxSeats)
}
assert(rival.fleetSize>before)
assert(competitorHubs(rival).length>1)
assert(rival.routes.some(r=>r.from!==rival.hub))
console.log(`OK: pisos, classes, persistência, crescimento local e IA: ${before} → ${rival.fleetSize} aeronaves; ${competitorHubs(rival).length} hubs, ${rival.routes.length} rotas.`)
