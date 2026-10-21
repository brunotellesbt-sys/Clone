import assert from 'node:assert/strict'
import {newGame,openRoute,buyAircraft,advanceDay,dowOf,typeOf} from '../src/game/engine'
import {blockHours} from '../src/game/economy'
import {distanceBetween} from '../src/game/geo'
import {marcarLoteVoos,desfazerUltimoLote,marcarVoo,pernasDe,cabeNaEscala,DIA,SEMANA} from '../src/game/escala'
import {groundInspectionBenefit,inspectionBeforeFlights} from '../src/game/groundInspection'
import {importSaveFile,exportSaveFile} from '../src/game/save'
import {invalidateAirportUsage} from '../src/game/airportInfrastructure'
const setup=()=>{
 const s=newGame({name:'Escala',code:'ES',hub:'GRU',seed:38,densidade:'enxuta'})
 s.competitors=[];s.airline.cash=1e10;invalidateAirportUsage(s)
 assert.equal(openRoute(s,'GRU','REC'),null);assert.equal(buyAircraft(s,'e195e2',false),null)
 return s
}
const s=setup(),ac=s.airline.fleet[0]
assert.equal(marcarLoteVoos(s,ac.id,'GRU','REC',[0,1,2,3,4,5,6],600).created,7)
assert.equal(s.lastCreatedFlights?.length,7)
const previousBatch=s.lastCreatedFlights
assert.equal(marcarLoteVoos(s,ac.id,'GRU','REC',[0,1,2,3,4,5,6],600).created,0)
assert.strictEqual(s.lastCreatedFlights,previousBatch,'tentativa recusada preserva desfazer do último lote válido')
const saved=importSaveFile(exportSaveFile(s))!
assert.equal(desfazerUltimoLote(saved),null)
assert.equal(saved.airline.escala?.length,0);assert.equal(saved.airline.routes[0].aircraftIds.length,0)
assert.equal(desfazerUltimoLote(s),null)
assert.equal(marcarLoteVoos(s,ac.id,'GRU','REC',[1],600).created,1)
const first=s.airline.escala![0].id
assert.equal(marcarLoteVoos(s,ac.id,'REC','GRU',[1],900).created,1)
assert.equal(desfazerUltimoLote(s),null)
assert.equal(s.airline.escala!.length,1);assert.equal(s.airline.escala![0].id,first)
const last=s.lastCreatedFlights
assert.equal(marcarLoteVoos(s,ac.id,'GRU','REC',[1],600).created,0)
assert.equal(s.lastCreatedFlights,last,'falha não substitui lote anterior')
const p=pernasDe(s,ac.id)[0],conflict=cabeNaEscala(s,ac.id,'GRU','REC',1,610)
assert(conflict.motivo?.includes(`pousa em REC`))
assert(conflict.motivo?.includes(String(Math.floor(p.chegadaLocal/60)).padStart(2,'0')))
// Uma marcação parcial só desfaz o que foi efetivamente aceito.
assert.equal(marcarLoteVoos(s,ac.id,'GRU','REC',[1,2],600).created,1)
assert.equal(desfazerUltimoLote(s),null);assert.equal(s.airline.escala!.length,1)
assert.equal(marcarLoteVoos(s,ac.id,'REC','GRU',[1],900).created,1)
s.airline.escala!.at(-1)!.saida++
assert(desfazerUltimoLote(s),'não desfaz silenciosamente um voo posteriormente alterado')
for(const [minute,expected] of [[119,0],[120,.05],[149,.05],[150,.075],[180,.1],[1440,.65]])assert(Math.abs(groundInspectionBenefit(minute)-expected)<1e-10)

const flight=setup(),f=flight.airline.fleet[0],dow=dowOf(flight)
assert.equal(marcarVoo(flight,f.id,'GRU','REC',dow,600),null)
assert.equal(marcarVoo(flight,f.id,'REC','GRU',dow,900),null)
let legs=pernasDe(flight,f.id),arrival=legs[0].chegada
// Ajusta a volta para exatamente duas horas de solo, por tempo UTC.
flight.airline.escala![1].saida=(arrival+120-((dow*DIA)%SEMANA)-180+DIA)%DIA
invalidateAirportUsage(flight)
legs=pernasDe(flight,f.id)
const info=inspectionBeforeFlights(flight)
assert.equal(info.get(legs[1].perna.id)?.minutes,120)
const broken=structuredClone(flight);broken.airline.escala![1].from='BSB';invalidateAirportUsage(broken)
assert.equal(inspectionBeforeFlights(broken).get(legs[1].perna.id)?.benefit,0,'não conta posicionamento como inspeção em solo')
// O motor aplica a redução nas pernas de fato voadas no dia UTC.
flight.day=(dow+6)%7 // primeiro será substituído pelo dia anterior à fixture
const day=Array.from({length:7},(_,i)=>i).find(i=>{flight.day=i;return dowOf(flight)===dow})!
flight.day=day-1;f.condition=1
const before=f.condition,expected=legs.reduce((n,p)=>n+(0.00028+blockHours(typeOf(f),distanceBetween(p.perna.from,p.perna.to))*.00013)*(1-(info.get(p.perna.id)?.benefit??0)),0)
advanceDay(flight)
assert(Math.abs(before-f.condition-expected)<1e-9,'redução aplicada no desgaste diário')
console.log('OK: desfazer semanal/diário/parcial e persistente, pouso nas indisponibilidades; inspeções 2h + 30min, teto, UTC e desgaste diário.')
