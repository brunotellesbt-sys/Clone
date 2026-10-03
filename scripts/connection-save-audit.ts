import assert from 'node:assert/strict'
import {readFileSync,createReadStream} from 'node:fs'
import {createHash} from 'node:crypto'
import {importSaveFile} from '../src/game/save'
import {advanceDay} from '../src/game/engine'
import {conexoesNaBase} from '../src/game/malha'
import {connectionWindow} from '../src/game/connectionRules'
import {sumCabins} from '../src/game/economy'
import {CABINS,type GameState} from '../src/game/types'

const file=process.argv[2]
assert(file,'Informe o caminho do JSON exportado; o arquivo é somente lido.')
const raw=readFileSync(file,'utf8'),parsed=importSaveFile(raw)
assert(parsed,'Save inválido')
const s:GameState=parsed
const initialDay=s.day,offered=s.airline.hubs.reduce((n,h)=>n+conexoesNaBase(s,h).length,0)
const targets=['GIG-SSA-CKS','RBR-PVH-CZS','CZS-PVH-RBR','CGH-BSB-BEL','VIX-SDU-CGH','VDC-BSB-CAW']
const totals=Object.fromEntries(targets.map(key=>[key,0]))
const times:number[]=[]
for(let i=0;i<7;i++){
 const t=performance.now();advanceDay(s);times.push(performance.now()-t)
 const boarding=new Map<string,Record<string,number>>()
 for(const j of s.connectionJourneys??[]){
  if(j.cancelled)continue
  if(j.first.day===s.day){
   const key=[j.first.from,j.via,j.second.to].join('-')
   if(key in totals)totals[key]+=sumCabins(j.pax)
   const window=connectionWindow(j.first.from,j.via,j.second.to)
   assert(j.wait>=window.min&&j.wait<=window.max,`${key}: janela`)
   assert(!['GIG-FOR-CGH','FLN-BSB-POA','FOR-GRU-PVH','BSB-GRU-PVH'].includes(key),key)
  }
  for(const leg of [j.first,j.second])if(leg.own&&leg.day===s.day){
   const count=boarding.get(leg.id)??{y:0,w:0,c:0,f:0}
   for(const cb of CABINS)count[cb]+=j.pax[cb]
   boarding.set(leg.id,count)
  }
 }
 for(const p of s.airline.escala??[]){
  const last=p.ultimoVoo;if(last?.day!==s.day)continue
  const ac=s.airline.fleet.find(a=>a.id===p.aircraftId)!
  for(const cb of CABINS){
   assert(last.pax[cb]<=ac.seats[cb]+1e-7,`${p.id}: capacidade`)
   assert(Math.abs(last.pax[cb]-(last.localPax?.[cb]??0)-(last.connectionPax?.[cb]??0))<1e-7,`${p.id}: locais + conexões`)
   assert.equal(last.connectionPax?.[cb]??0,boarding.get(p.id)?.[cb]??0,`${p.id}: mesmas reservas nos dois trechos`)
  }
 }
}
const digest=createHash('sha256').update(raw).digest('hex')
const after=createHash('sha256');for await(const chunk of createReadStream(file))after.update(chunk)
assert.equal(after.digest('hex'),digest,'save original intacto')
for(const key of targets)assert(totals[key]>0,`${key}: vendas ao longo da semana`)
console.log(JSON.stringify({initialDay,finalDay:s.day,offered,weeklyPassengers:totals,meanAdvanceMs:Math.round(times.reduce((n,v)=>n+v,0)/times.length),saveUnchanged:true}))
