import assert from 'node:assert/strict'
import {newGame,openRoute} from '../src/game/engine'
import {ensureAirports,growthProgress,infrastructureInterestRates,invalidateAirportUsage,recordAirportDay} from '../src/game/airportInfrastructure'

const s=newGame({name:'Interesse',code:'IN',hub:'PVH',seed:81,densidade:'enxuta'})
s.competitors=[];invalidateAirportUsage(s);ensureAirports(s)
const d=s.airportDevelopment!.PVH
assert.equal(growthProgress(s,'PVH').daysNeeded,90)
s.airline.hubs=[];assert.equal(growthProgress(s,'PVH').daysNeeded,108);s.airline.hubs=['PVH']
d.earned=2;assert.equal(growthProgress(s,'PVH').daysNeeded,270);d.earned=0
assert.equal(growthProgress(s,'PVH').paxNeeded,d.baseCapacity*100,'tráfego exigido não foi reduzido')
openRoute(s,'PVH','MAO');const r=s.airline.routes[0]
d.capacity=100
s.airline.escala=Array.from({length:60},(_,i)=>({id:`leg${i}`,aircraftId:'fixture',from:'PVH',to:'MAO',dow:2,saida:480+i}))
invalidateAirportUsage(s)
// Uma malha que voa durante a semana, mas não no dia da revisão.
for(let week=1;week<=52;week++){
 s.day=week*7
 r.history=Array.from({length:6},(_,i)=>({day:s.day-6+i,flights:30,seats:700,pax:{y:700,w:0,c:0,f:0},loadFactor:1,revenue:0,cost:0,profit:0}))
 recordAirportDay(s,{},true)
 if(week===1){assert(d.operator>0,'administradora avança antes de um ano');assert(d.government>0,'governo avança sem exigir 30% de crescimento')}
}
assert(d.operator>0&&d.operator<.05,`administradora no primeiro ano: ${d.operator}`)
assert(d.government>0&&d.government<.05,`governo no primeiro ano: ${d.government}`)
const stable=infrastructureInterestRates(.8,.1,1000,100,100,0)
assert.deepEqual(infrastructureInterestRates(.8,.1,1000,100,100,0),stable,'mesmos indicadores mantêm o ritmo')
assert(infrastructureInterestRates(.8,.1,1000,300,100,0).operator>stable.operator,'conexões valorizadas pela administradora')
assert(infrastructureInterestRates(.8,.1,1000,100,600,0).government>stable.government,'diretos longos valorizados pelo governo')
assert(infrastructureInterestRates(.95,.6,2000,400,900,0).operator>stable.operator)
assert(infrastructureInterestRates(.95,.6,2000,400,900,0).government>stable.government)
assert(infrastructureInterestRates(0,0,0,0,0,0).operator<0,'operação ausente pode reduzir interesse')
assert.equal(d.idle.length,52,'observações de ociosidade não foram encurtadas')
console.log(`OK: lotes de 90/108 dias, ociosidade intacta; 1º ano ${(d.operator*100).toFixed(2)}% adm. / ${(d.government*100).toFixed(2)}% gov.; progressão semanal gradual.`)
