import assert from 'node:assert/strict'
import { AIRCRAFT_BY_ID, ehCargueiro } from '../src/game/data/aircraft'
import { crewFor, defaultCabin } from '../src/game/cabin'
import { flightCost } from '../src/game/economy'
import { estimateRoute, newGame } from '../src/game/engine'

for(const [seats,expected] of [[0,0],[50,1],[51,2],[100,2],[101,3],[150,3],[151,4],[200,4],[201,5],[250,5],[251,6]])
  assert.equal(crewFor({y:seats,w:0,c:0,f:0}),expected)
assert.equal(crewFor({y:114,w:0,c:12,f:0}),3)
assert.equal(crewFor({y:100,w:20,c:20,f:10}),3,'classes não adicionam tripulação obrigatória')
for(const id of ['e195','e195e2','a319','a319neo'])
  assert.equal(crewFor(defaultCabin(AIRCRAFT_BY_ID[id],1).seats),3,id)
assert.equal(crewFor({y:AIRCRAFT_BY_ID.a319.maxSeats,w:0,c:0,f:0}),4,'A319 de 156 lugares continua exigindo quatro')
const t=AIRCRAFT_BY_ID.a319
const old=flightCost(t,500,'GRU','BSB',.82,2,100,12,4)
const updated=flightCost(t,500,'GRU','BSB',.82,2,100,12,3)
assert(updated.total<old.total)
for(const key of ['fuel','maintenance','fees','handling','catering','blockH'] as const) assert.equal(old[key],updated[key])
assert.equal(flightCost(t,500,'GRU','BSB',.82,2,10,0,3).crew,updated.crew,'voo vazio não reduz comissários pela lotação')

const s=newGame({name:'Tripulação',code:'TC',hub:'GRU',seed:12,densidade:'enxuta'})
s.competitors=[]
const estimate=estimateRoute(s,'GRU','BSB','a319',1)
const expected=flightCost(t,estimate.dist,'GRU','BSB',s.fuelPrice,2,estimate.pax/2,estimate.pax*.12/2,3).total*2
assert.equal(estimate.cost,expected,'estimativa usa a configuração, não o máximo certificado')
let reductions=0
for(const type of Object.values(AIRCRAFT_BY_ID)) {
  if(ehCargueiro(type)){assert.equal(type.crew,0);continue}
  const seats=defaultCabin(type,1).seats
  const total=Object.values(seats).reduce((a,b)=>a+b,0)
  const prior=Math.max(1,Math.ceil(total/50)+Math.ceil((seats.c+seats.f)/18))
  assert.equal(crewFor(seats),Math.ceil(total/50),type.id)
  assert(crewFor(seats)<=prior,type.id)
  if(crewFor(seats)<prior)reductions++
}
console.log(`OK: faixas de tripulação, E195/E2/A319, custo e estimativa; ${reductions} modelos com redução na cabine padrão.`)
