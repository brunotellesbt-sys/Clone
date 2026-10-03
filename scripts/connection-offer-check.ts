import assert from 'node:assert/strict'
import {allocateSharedSeats} from '../src/game/connectionSeats'
import {connectionAllowed,conexoesNaBase,conexoesDaRota} from '../src/game/malha'
import {newGame,openRoute,buyAircraft} from '../src/game/engine'
import {noTempo,naSemana,DIA} from '../src/game/escala'
import {AIRPORT_BY_IATA as AP} from '../src/game/data/airports'
import {invalidateAirportUsage,ensureAirports} from '../src/game/airportInfrastructure'
import {connectionPathAllowed} from '../src/game/connectionGeometry'

// Dois mercados disputam os mesmos assentos; nenhum ganha tudo por aparecer
// primeiro. Trocar a ordem de entrada preserva cada reserva.
const requests=[{id:'flight-a',market:'AAA',first:'shared',second:'one',wanted:40},
 {id:'flight-z',market:'ZZZ',first:'shared',second:'two',wanted:40}]
const markets=new Map([['AAA',100],['ZZZ',100]])
const flights=new Map([['shared',40],['one',100],['two',100]])
const result=allocateSharedSeats(requests,markets,flights)
assert.equal(result.get('flight-a'),20);assert.equal(result.get('flight-z'),20)
assert.deepEqual([...allocateSharedSeats([...requests].reverse(),markets,flights)].sort(),[...result].sort())
for(let seed=1;seed<=100;seed++){
 const rs=Array.from({length:30},(_,i)=>({id:String(i),market:'m'+i%5,first:'a'+i%3,second:'b'+i%4,wanted:((i+1)*seed%47)/3}))
 const ms=new Map(Array.from({length:5},(_,i)=>['m'+i,11.5] as const))
 const fs=new Map([...Array.from({length:3},(_,i)=>['a'+i,17.8] as const),...Array.from({length:4},(_,i)=>['b'+i,13.2] as const)])
 const booked=allocateSharedSeats(rs,ms,fs)
 assert.deepEqual([...booked].sort(),[...allocateSharedSeats([...rs].reverse(),ms,fs)].sort())
 for(const [id,cap] of ms)assert(rs.filter(r=>r.market===id).reduce((n,r)=>n+booked.get(r.id)!,0)<=cap)
 for(const [id,cap] of fs)assert(rs.filter(r=>r.first===id||r.second===id).reduce((n,r)=>n+booked.get(r.id)!,0)<=cap)
}

const s=newGame({name:'Oferta',code:'OF',hub:'PVH',seed:7,densidade:'enxuta'})
s.competitors=[];s.airline.cash=1e10;s.airline.hubs.push('MAO','RBR');s.airline.escala=[]
const add=(from:string,to:string,departure:number)=>{
 if(!s.airline.routes.some(r=>[r.from,r.to].includes(from)&&[r.from,r.to].includes(to)))assert.equal(openRoute(s,from,to),null)
 assert.equal(buyAircraft(s,'e195e2',false),null)
 const ac=s.airline.fleet.at(-1)!;ac.base=from
 const local=naSemana(departure+AP[from].fuso)
 const p={id:`p${s.airline.escala!.length}`,aircraftId:ac.id,from,to,dow:Math.floor(local/DIA),saida:local%DIA}
 s.airline.escala!.push(p);invalidateAirportUsage(s);ensureAirports(s)
 return p
}
const first=add('RBR','PVH',3*DIA+12*60)
add('PVH','CZS',noTempo(s,first).chegada+60)
assert(conexoesNaBase(s,'PVH').some(c=>c.de.ponta==='RBR'&&c.para.ponta==='CZS'))
// Uma rota aberta sem voo não é alternativa. Um voo amanhã também não.
assert.equal(openRoute(s,'RBR','CZS'),null)
assert(connectionAllowed(s,'RBR','PVH','CZS'))
const direct=add('RBR','CZS',4*DIA+12*60)
assert(connectionAllowed(s,'RBR','PVH','CZS'),'direto amanhã não elimina conexão de hoje')
direct.dow=first.dow;direct.saida=first.saida;invalidateAirportUsage(s)
assert(!connectionAllowed(s,'RBR','PVH','CZS'),'direto no mesmo horário elimina volta regional muito maior')
s.airline.fleet.find(a=>a.id===direct.aircraftId)!.groundedUntil=s.day+7;invalidateAirportUsage(s)
assert(connectionAllowed(s,'RBR','PVH','CZS'),'manutenção deixa de ser alternativa')
// Rota sem frequência da concorrente não conta como alternativa.
s.competitors=[{id:'a',routes:[{from:'RBR',to:'CZS',freq:0}]} as any];invalidateAirportUsage(s)
assert(connectionAllowed(s,'RBR','PVH','CZS'))
s.competitors=[];s.airline.hubs.push('GRU','SDU','BSB')
const incoming=add('GRU','SDU',3*DIA+12*60)
add('SDU','GYN',noTempo(s,incoming).chegada+150)
assert(connectionAllowed(s,'GRU','SDU','GYN'))
const alternativeIn=add('GRU','BSB',3*DIA+12*60)
const alternativeOut=add('BSB','GYN',noTempo(s,alternativeIn).chegada+10)
assert(connectionAllowed(s,'GRU','SDU','GYN'),'alternativa com só 10 min de troca não é utilizável')
alternativeOut.saida+=30;invalidateAirportUsage(s)
assert(!connectionAllowed(s,'GRU','SDU','GYN'),'caminho menor e mais rápido com 40 min elimina volta excepcional')
// Tirar o voo próprio e substituí-lo por outro operador não cria interline.
s.airline.fleet.find(a=>a.id===alternativeOut.aircraftId)!.groundedUntil=s.day+7
s.competitors=[{id:'other',routes:[{from:'BSB',to:'GYN',freq:1,hora:600}]} as any]
invalidateAirportUsage(s)
assert(connectionAllowed(s,'GRU','SDU','GYN'),'voos próprios e de terceiros não viram caminho integrado sem acordo')
const trunk=s.airline.routes.find(r=>[r.from,r.to].includes('GRU')&&[r.from,r.to].includes('SDU'))!
assert(conexoesDaRota(s,trunk,'SDU').saindo.some(c=>c.para.ponta==='GYN'),'rota entre hubs mostra conexões na segunda ponta')
assert.equal(conexoesDaRota(s,trunk,'GRU').base,'GRU')
for(const [a,h,b] of [['GIG','FOR','CGH'],['FLN','BSB','POA'],['FOR','GRU','PVH'],['BSB','GRU','PVH']])assert(!connectionPathAllowed(a,h,b))
for(const [a,h,b] of [['GIG','SSA','CKS'],['CGH','BSB','BEL'],['VIX','SDU','CGH']])assert(connectionPathAllowed(a,h,b,true),'direto não apaga caminho alinhado')
console.log('OK: repartição simultânea, assentos/O&D, ordem independente, dia/horário, manutenção e trajetos.')
