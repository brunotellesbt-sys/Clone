import assert from 'node:assert/strict'
import { buyAircraft, computeCompetitorRevenue, newGame, openRoute } from '../src/game/engine'
import { baseDemand } from '../src/game/demand'
import { DISTRIBUTION_RATE, SELLABLE, ticketRevenue } from '../src/game/economy'
import { activeHubs, cityDevelopment, invalidateHubActivity, stepHubDevelopment } from '../src/game/hubDevelopment'
import { connectionPathAllowed } from '../src/game/connectionGeometry'
import { conexoesNaBase, conexoesDaRota } from '../src/game/malha'
import { blocoDe, DIA, naSemana } from '../src/game/escala'
import { odKey } from '../src/game/geo'
import { gameDayDate } from '../src/game/calendarDates'
import { exportSaveFile, importSaveFile } from '../src/game/save'

// Receita da IA precisa cair quando o jogador disputa o mesmo mercado.
const s = newGame({name:'Auditoria',code:'AU',hub:'FOR',seed:9,densidade:'enxuta'})
s.airline.cash=1e9
assert.equal(openRoute(s,'FOR','JDO'),null)
assert.equal(buyAircraft(s,'a320neo',false),null)
s.competitors=[{...s.competitors[0],hub:'FOR',hubs:['FOR'],routes:[
  {key:odKey('FOR','JDO'),from:'FOR',to:'JDO',seats:194,freq:2,fare:1,quality:1},
]}]
computeCompetitorRevenue(s,0)
const uncontested=s.competitors[0].revenue30
s.airline.escala=Array.from({length:14},(_,i)=>({id:`p${i}`,aircraftId:s.airline.fleet[0].id,
  from:i%2?'JDO':'FOR',to:i%2?'FOR':'JDO',dow:Math.floor(i/2),saida:i%2?840:480}))
invalidateHubActivity(s)
computeCompetitorRevenue(s,0)
assert(s.competitors[0].revenue30<uncontested,'receita não pode ignorar a oferta do jogador')

// Multiplicador de conexão nunca cria receita além dos lugares vendáveis.
const capState=structuredClone(s)
capState.airline.escala=[]
capState.competitors[0].routes=['JFK','LAX','MIA','LHR','LIS','MAD','CDG','DXB','DOH','FRA','AMS','BCN','MEX','PTY','SCL','EZE','BOG','LIM','REC','SSA']
  .map((to,i)=>({key:odKey('GRU',to),from:'GRU',to,seats:1,freq:1,fare:1,quality:1,hora:480+i}))
computeCompetitorRevenue(capState,0)
const cap=2*SELLABLE
const seats={y:cap*.88,w:cap*.042,c:cap*.072,f:cap*.006}
const maxRevenue=capState.competitors[0].routes.reduce((sum,r)=>sum+ticketRevenue(seats,{y:1,w:1,c:1,f:1},
  baseDemand(r.from,r.to,0,0,2027,true,capState).refFare)*(1-DISTRIBUTION_RATE)*30,0)
assert(capState.competitors[0].revenue30<=maxRevenue+1e-8,'conexões respeitam capacidade')

// Janeiro de 2027 começa sexta: dia 3 e dia 10 são segundas.
const original=structuredClone(s.competitors)
const empty=()=>{const x=structuredClone(s);x.day=3;x.airline.escala=[];x.competitors=[];x.hubDevelopment=undefined;stepHubDevelopment(x);return x}
const late=empty(), full=empty()
full.competitors=structuredClone(original)
for(let day=4;day<=10;day++) {
  late.day=day;full.day=day
  if(day===10)late.competitors=structuredClone(original)
  stepHubDevelopment(late);stepHubDevelopment(full)
}
const one=Math.log(cityDevelopment(late,'FOR').traffic),seven=Math.log(cityDevelopment(full,'FOR').traffic)
assert(Math.abs(seven-7*one)<1e-10,'hub recém-aberto não ganha sete dias de crédito')
const closed=empty()
closed.competitors=structuredClone(original)
for(let day=4;day<=9;day++){closed.day=day;stepHubDevelopment(closed)}
const restored=importSaveFile(exportSaveFile(closed))!
assert.deepEqual(restored.hubDevelopment,closed.hubDevelopment,'crédito pendente sobrevive ao save')
closed.competitors=[];closed.day=10;stepHubDevelopment(closed)
assert(Math.abs(Math.log(cityDevelopment(closed,'FOR').traffic)-6*one)<1e-10,'encerrar hub não apaga os dias operados')
assert.equal(activeHubs(closed).size,0)

// Mesma geografia em vendas e listas, inclusive mantendo diagnósticos separados.
assert.equal(connectionPathAllowed('GIG','MAO','GRU'),false)
assert.equal(connectionPathAllowed('GRU','MAO','GIG'),false)
assert.equal(connectionPathAllowed('SDU','BSB','LIM'),true)
assert.equal(connectionPathAllowed('LHR','GRU','SDU'),true)
assert.equal(connectionPathAllowed('GRU','BSB','CGH'),false)
const bad=newGame({name:'Geografia',code:'GE',hub:'MAO',seed:3,densidade:'enxuta'})
bad.airline.cash=1e9;bad.competitors=[]
openRoute(bad,'GIG','MAO');openRoute(bad,'MAO','GRU')
buyAircraft(bad,'a320neo',false);buyAircraft(bad,'a320neo',false)
const first={id:'in',aircraftId:bad.airline.fleet[0].id,from:'GIG',to:'MAO',dow:1,saida:480}
const second={id:'out',aircraftId:bad.airline.fleet[1].id,from:'MAO',to:'GRU',dow:1,saida:0}
const arrival=first.saida+blocoDe(bad,first)-60 // MAO uma hora atrás de GIG
const departure=naSemana(first.dow*DIA+arrival+90)
second.dow=Math.floor(departure/DIA);second.saida=departure%DIA
bad.airline.escala=[first,second]
assert(conexoesNaBase(bad,'MAO',true).length>0,'horários de teste são compatíveis')
assert.equal(conexoesNaBase(bad,'MAO').length,0,'itinerário absurdo não aparece na oferta')
for(const route of bad.airline.routes){const c=conexoesDaRota(bad,route);assert.equal(c.entrando.length+c.saindo.length,0)}
assert.equal(new Date(gameDayDate(365,2027)).getUTCFullYear(),2028)
assert.equal(new Date(gameDayDate(365,2028)).getUTCFullYear(),2028)
console.log('OK: concorrência na receita, capacidade de conexão, crédito diário/semanal, persistência e rejeição GIG–MAO–GRU nas listas.')
