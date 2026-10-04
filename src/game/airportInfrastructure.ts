import { blockHours } from './economy'
import { specOf } from './spec'
import { distanceBetween } from './geo'
import { AIRPORT_BY_IATA, type Airport } from './data/airports'
import type { GameState, Perna } from './types'
import { cityDevelopment } from './hubDevelopment'
import { derivaDoPais } from './data/crescimento'
import { RUNWAY_CORRECTIONS } from './data/runwayCorrections'

export type WorkKind = 'slots' | 'runway' | 'category'
export interface HubWeek { day: number; population: number; capacity: number; own: number; rivals: number; passengers: number; connections: number; demands: Record<string, number> }
export interface AirportWorks { kind: WorkKind; start: number; end: number; contribution: number; automatic: boolean }
export interface AirportDevelopment {
  slotPolicy?: number;
  hubSince?: number; baseSince?: number; personalSlots?: number; lastDemand?: number; since: number; lastDay: number; baseCapacity: number; capacity: number; level: number;
  /** Referência de construção legada em pés; comprimento físico via effectiveAirport. */
  runway: number; category: Airport['escopo']; reserved: number; idle: number[];
  operatingDays: number; passengers: number; connections: number; earned: number;
  government: number; operator: number; work?: AirportWorks; history: HubWeek[];
  completed: AirportWorks[]; lastExpansion: number;
}
const restricted = new Set(['SDU', 'CGH', 'PLU'])
export const WORK_LABEL: Record<WorkKind,string> = {slots:'Capacidade e terminal',runway:'Ampliação de pista',category:'Categoria do aeroporto'}
export const WORK_DAYS: Record<WorkKind,number> = {slots:365,runway:730,category:913}
const sum = (v: Record<string,number>) => Object.values(v).reduce((a,b)=>a+b,0)
const occupancyCache = new WeakMap<GameState,{day:number; legs:Perna[]|undefined; size:number; map:Map<string,{days:number[];rivals:number}>}>()
const revisions=new WeakMap<GameState,number>()
export const airportRevision=(s:GameState)=>revisions.get(s)??0
export function invalidateAirportUsage(s:GameState) { revisions.set(s,airportRevision(s)+1);occupancyCache.delete(s); admittedCache.delete(s); rivalCache.delete(s) }
/** Atualiza só a malha da IA que mudou, preservando os movimentos do jogador. */
export function updateRivalUsage(s:GameState, before:{from:string;to:string;freq:number}[], after:{from:string;to:string;freq:number}[]) {
  const usage=airportUsage(s)
  for(const [routes,sign] of [[before,-1],[after,1]] as const)for(const r of routes)for(const id of [r.from,r.to]) {
    let u=usage.get(id);if(!u){u={days:Array(7).fill(0),rivals:0};usage.set(id,u)}
    u.rivals=Math.max(0,u.rivals+sign*r.freq*2)
  }
  revisions.set(s,airportRevision(s)+1);rivalCache.delete(s)
  // Mudanças de concorrentes distantes não alteram a admissão da frota própria.
  // Compara os limites efetivos antes de repetir toda a escala por aeronave.
  const limits=admittedLimits.get(s)
  if(!limits||[...limits].some(([id,limit])=>airportSlots(s,id).ownLimit!==limit))admittedCache.delete(s)
}
export function flightMovements(s:GameState,p:Perna):[string,number][] {
  const ac=s.airline.fleet.find(a=>a.id===p.aircraftId)
  const hours=ac?blockHours(specOf(ac.typeId,ac.engineId),distanceBetween(p.from,p.to)):0
  const arrival=p.saida+Math.round(hours*60)+AIRPORT_BY_IATA[p.to].fuso-AIRPORT_BY_IATA[p.from].fuso
  return [[p.from,p.dow],[p.to,((p.dow+Math.floor(arrival/1440))%7+7)%7]]
}
export function airportUsage(s:GameState) {
  const cached=occupancyCache.get(s)
  if(cached && cached.day===s.day && cached.legs===s.airline.escala && cached.size===s.airline.escala?.length)return cached.map
  const map=new Map<string,{days:number[];rivals:number}>()
  const get=(id:string)=>{let a=map.get(id);if(!a){a={days:Array(7).fill(0),rivals:0};map.set(id,a)}return a}
  for(const p of s.airline.escala??[])for(const [id,dow] of flightMovements(s,p))get(id).days[dow]++
  for(const c of s.competitors)for(const r of c.routes)for(const id of [r.from,r.to])get(id).rivals+=Math.max(0,r.freq)*2
  occupancyCache.set(s,{day:s.day,legs:s.airline.escala,size:s.airline.escala?.length??0,map});return map
}
export function initialCapacity(s:GameState,id:string) {
  const u=airportUsage(s).get(id), used=(u?.rivals??0)+Math.max(0,...(u?.days??[]))
  // Migração preserva malha já existente e deixa 25% + 24 movimentos de folga.
  return Math.max(Math.floor(AIRPORT_BY_IATA[id].slots*cityDevelopment(s,id).traffic),Math.ceil(used*1.25)+24)
}
/** Base persistida: uma correção cadastral não concede nem desfaz obras. */
export const infrastructureRunwayBase = (id:string) => RUNWAY_CORRECTIONS[id]?.previousFeet ?? AIRPORT_BY_IATA[id].runway
export const physicalRunwayLimit = (id:string) => AIRPORT_BY_IATA[id].runway + Math.max(0,14000-infrastructureRunwayBase(id))
export function effectiveAirport(s:GameState|undefined,id:string):Airport {
  const a=AIRPORT_BY_IATA[id], d=s?.airportDevelopment?.[id]
  if(!a||!d)return a
  const extension=d.runway-infrastructureRunwayBase(id), expanded=extension>0
  if(!extension&&d.category===a.escopo&&d.capacity===a.slots&&d.level===a.tier)return a
  return {...a,runway:a.runway+extension,pistaOperacional:expanded?(a.pistaOperacional??a.runway)+extension:a.pistaOperacional,
    tetoAssentos:expanded&&!restricted.has(id)?undefined:a.tetoAssentos,escopo:d.category,slots:d.capacity,tier:d.level as Airport['tier']}
}
export function airportSlots(s:GameState,id:string) {
  const d=s.airportDevelopment?.[id],u=airportUsage(s).get(id)
  const normal=d?.capacity??initialCapacity(s,id)
  const capacity=d?.work?Math.floor(normal/2):normal
  const own=Math.max(0,...(u?.days??[])), rivals=u?.rivals??0
  const isHub=s.airline.hubs.includes(id)
  const allocation=d?.reserved??(isHub?own+hubSlotMargin(own):0)
  const reserved=Math.min(capacity,Math.floor(allocation*(d?.work?.5:1)))
  const rivalLimit=Math.max(0,capacity-reserved)
  const rivalsOperating=Math.min(rivals,rivalLimit)
  const ownLimit=isHub?reserved:Math.max(reserved,capacity-rivalsOperating)
  return {normal,capacity,own,rivals,rivalsOperating,reserved,ownLimit,free:Math.max(0,ownLimit-own),over:Math.max(0,own-ownLimit)}
}
/** Reserva inicial: malha existente + 10%, entre 6 e 16 movimentos por dia. */
export const hubSlotMargin=(own:number)=>own===0?24:Math.max(6,Math.min(16,Math.ceil(own*.1)))
/** Bases sem hub: ao menos 30 movimentos próprios no pico, mesmo com um destino. */
export function largeOperations(s:GameState) {
 return [...airportUsage(s)].map(([id,u])=>({id,movements:Math.max(0,...u.days)}))
   .filter(a=>a.movements>=30&&!s.airline.hubs.includes(a.id)).sort((a,b)=>b.movements-a.movements||a.id.localeCompare(b.id))
}
/** Hubs já têm acompanhamento próprio; não recebem a progressão de base também. */
export const largeBases=(s:GameState)=>largeOperations(s).map(a=>a.id)
export function populationAt(s:GameState,id:string) {
  const a=AIRPORT_BY_IATA[id]
  return a.pop*1e6*Math.pow(derivaDoPais(a.cc,s.day),.55)*cityDevelopment(s,id).population
}
export function ensureAirports(s:GameState) {
  let migrated=false
  s.airportDevelopment??={}
  const ids=Object.keys(AIRPORT_BY_IATA)
  for(const id of ids)if(!s.airportDevelopment[id]) {
    const a=AIRPORT_BY_IATA[id],capacity=initialCapacity(s,id),own=Math.max(0,...(airportUsage(s).get(id)?.days??[]))
    s.airportDevelopment[id]={since:s.day,lastDay:s.day,baseCapacity:capacity,capacity,level:a.tier,runway:infrastructureRunwayBase(id),category:a.escopo,
      slotPolicy:2,reserved:s.airline.hubs.includes(id)?Math.min(capacity,own+hubSlotMargin(own)):0,
      idle:[],operatingDays:0,passengers:0,connections:0,earned:0,government:0,operator:0,history:[],completed:[],lastExpansion:s.day}
  }
  for(const id of s.airline.hubs) {
    const d=s.airportDevelopment[id]
    if(d.slotPolicy!==2) {
      migrated=true
      const own=Math.max(0,...(airportUsage(s).get(id)?.days??[]))
      // Mantém direitos adquiridos após um ano; retira somente a folga inicial.
      if(d.idle.length<365)d.reserved=Math.min(d.capacity,own+hubSlotMargin(own)+d.earned*Math.max(2,Math.ceil(d.baseCapacity*.025))+d.completed.filter(w=>w.kind==='slots').length*Math.ceil(d.baseCapacity*(restricted.has(id)?.15:.35)))
      d.slotPolicy=2
    }
    if(d.hubSince===undefined) {
      d.hubSince=s.day;d.idle=[]
      const u=airportUsage(s).get(id),own=Math.max(0,...(u?.days??[]))
      d.reserved=Math.max(d.reserved,Math.min(d.capacity,own+hubSlotMargin(own)))
    }
  }
  s.hubInvestments??=Object.fromEntries(s.airline.hubs.map((id,i)=>[id,i===0?0:20e6]))
  // Benefício pedido para a operação existente em CGH, não para toda partida nova.
  if(!s.cghExtraSlotsGranted&&(s.airline.escala??[]).some(p=>p.from==='CGH'||p.to==='CGH')){
    const d=s.airportDevelopment.CGH,before=airportSlots(s,'CGH')
    d.capacity+=41;d.personalSlots=(d.personalSlots??0)+41
    d.reserved=Math.max(d.reserved,before.own)+41
    s.cghExtraSlotsGranted=true;migrated=true
  }
  for(const id of largeBases(s)) {
    const d=s.airportDevelopment[id]
    if(d.baseSince===undefined){d.baseSince=s.day;d.idle=[]}
  }
  if(migrated)invalidateAirportUsage(s)
}
export function growthProgress(s:GameState,id:string) {
  const d=s.airportDevelopment?.[id]
  const a=AIRPORT_BY_IATA[id],pop=populationAt(s,id)/(a.pop*1e6)
  const capacity=d?.capacity??initialCapacity(s,id),base=d?.baseCapacity??capacity,level=d?.level??a.tier
  const populationLimit=Math.floor(base*(1+.25*level)*Math.max(1,Math.pow(pop,.7)))
  const increment=Math.max(2,Math.ceil(base*.025)), earned=d?.earned??0
  const delay=s.airline.hubs.includes(id)?1:1.2
  return {populationLimit,increment,daysNeeded:Math.ceil(180*(earned+1)*delay),paxNeeded:Math.ceil(base*100*(earned+1)*delay),demandNeeded:base*20,
    canGrow:capacity+increment<=populationLimit}
}
export function workOffer(s:GameState,id:string,kind:WorkKind) {
  const d=s.airportDevelopment?.[id],a=effectiveAirport(s,id)
  const total=({slots:180e6,runway:1800e6,category:3200e6}[kind])*(.65+a.tier*.35)*(restricted.has(id)?2.5:1)
  const both=!!d&&d.operator>=1&&d.government>=1
  const share=both?0:d&&d.operator>=1?.35:.45
  let reason=''
  if(!s.airline.hubs.includes(id))reason='Aporte disponível somente nos seus hubs.'
  else if(d?.work)reason='Uma obra já está em andamento.'
  else if(restricted.has(id)&&kind!=='slots')reason='Aeroporto restrito: pista e categoria não podem ser ampliadas.'
  else if(kind==='slots'&&d&&d.capacity+Math.ceil(d.baseCapacity*(restricted.has(id)?.15:.35))>d.baseCapacity*(restricted.has(id)?1.6:3)*Math.max(1,Math.pow(populationAt(s,id)/(AIRPORT_BY_IATA[id].pop*1e6),.7)))reason='Limite físico local: aguarde crescimento populacional para outro projeto.'
  else if(kind==='runway'&&(d?.runway??infrastructureRunwayBase(id))>=14000)reason='Pista no limite do projeto.'
  else if(kind==='category'&&a.escopo==='int')reason='Já é internacional.'
  else if(!d||Math.max(d.operator,d.government)<1)reason='Ainda não há interesse aprovado do governo ou da administradora.'
  return {total,contribution:Math.round(total*share),duration:WORK_DAYS[kind],reason,both}
}
export function startAirportWork(s:GameState,id:string,kind:WorkKind):string|null {
  ensureAirports(s)
  const offer=workOffer(s,id,kind)
  if(offer.reason)return offer.reason
  if(s.airline.cash<offer.contribution)return 'Caixa insuficiente para o aporte.'
  s.airline.cash-=offer.contribution
  s.airportDevelopment![id].work={kind,start:s.day,end:s.day+offer.duration,contribution:offer.contribution,automatic:false}
  invalidateAirportUsage(s);return null
}
export function finishAirportWorks(s:GameState) {
  for(const [id,d] of Object.entries(s.airportDevelopment??{}))if(d.work&&s.day>=d.work.end) {
    const w=d.work
    if(w.kind==='slots'){const added=Math.ceil(d.baseCapacity*(restricted.has(id)?.15:.35));d.capacity+=added;if(s.airline.hubs.includes(id))d.reserved+=added;d.level=Math.min(5,d.level+1)}
    if(w.kind==='runway')d.runway=Math.min(14000,d.runway+2000)
    if(w.kind==='category')d.category=d.category==='dom'?'reg':'int'
    d.completed.push(w);d.work=undefined;d.operator=0;d.government=0;d.lastExpansion=s.day
    s.notices.push({day:s.day,kind:'info',text:`${id}: obra de ${WORK_LABEL[w.kind].toLowerCase()} concluída; capacidade restaurada.`})
  }
  invalidateAirportUsage(s)
}
/** Admissão por movimentos: não apaga a malha quando há interdição temporária. */
const admittedCache=new WeakMap<GameState,Set<string>>()
const admittedLimits=new WeakMap<GameState,Map<string,number>>()
export function admittedFlights(s:GameState) {
  const cached=admittedCache.get(s);if(cached)return cached
  const counts=new Map<string,number[]>(),accepted=new Set<string>()
  const schedules=new Map<string,Perna[]>()
  const limits=new Map<string,number>()
  const limit=(id:string)=>{let n=limits.get(id);if(n===undefined){n=airportSlots(s,id).ownLimit;limits.set(id,n)}return n}
  for(const p of s.airline.escala??[]){const list=schedules.get(p.aircraftId)??[];list.push(p);schedules.set(p.aircraftId,list)}
  for(const legs of schedules.values()) {
    const required=new Map<string,number[]>()
    for(const p of legs)for(const [id,dow] of flightMovements(s,p)){const days=required.get(id)??Array(7).fill(0);days[dow]++;required.set(id,days)}
    if([...required].some(([id,days])=>days.some((n,dow)=>n+(counts.get(id)?.[dow]??0)>limit(id))))continue
    for(const [id,days] of required){const total=counts.get(id)??Array(7).fill(0);days.forEach((n,i)=>total[i]+=n);counts.set(id,total)}
    for(const p of legs)accepted.add(p.id)
  }
  admittedLimits.set(s,limits);admittedCache.set(s,accepted);return accepted
}
const rivalCache=new WeakMap<GameState,Map<object,number>>()
export function rivalFrequency(s:GameState,r:{from:string;to:string;freq:number}) {
  let result=rivalCache.get(s)
  if(!result) {
    result=new Map<object,number>()
    const routes=s.competitors.flatMap(c=>c.routes)
    const budgets=new Map<string,number>()
    for(const id of airportUsage(s).keys()) {
      const a=airportSlots(s,id)
      budgets.set(id,Math.max(0,a.capacity-Math.max(a.reserved,Math.min(a.own,a.ownLimit))))
    }
    const constrained=[...airportUsage(s)].some(([id,u])=>u.rivals>(budgets.get(id)??0))
    if(!constrained)for(const route of routes)result.set(route,route.freq)
    else {
      // Rodadas de rotações inteiras, nas duas pontas, com prioridade diária rotativa.
      const offset=s.day%Math.max(1,routes.length),ordered=[...routes.slice(offset),...routes.slice(0,offset)]
      for(let round=0;round<Math.max(0,...routes.map(x=>x.freq));round++)for(const route of ordered) {
        if(round>=route.freq||[route.from,route.to].some(id=>(budgets.get(id)??0)<2))continue
        result.set(route,(result.get(route)??0)+1)
        for(const id of [route.from,route.to])budgets.set(id,budgets.get(id)!-2)
      }
    }
    rivalCache.set(s,result)
  }
  return result.get(r)??0
}

function airportDailyTraffic(s:GameState) {
  const map=new Map<string,{passengers:number;connections:number;longDirect:number;flights:number}>()
  const get=(id:string)=>{let v=map.get(id);if(!v){v={passengers:0,connections:0,longDirect:0,flights:0};map.set(id,v)}return v}
  for(const r of s.airline.routes){const h=r.history.at(-1);if(h?.day===s.day)for(const id of [r.from,r.to]){const v=get(id);v.flights+=h.flights*2;if(!r.cargo)v.passengers+=sum(h.pax);if(r.distance>1500)v.longDirect+=sum(h.localPax??h.pax)}}
  for(const j of s.connectionJourneys??[])if(!j.cancelled&&j.second.day===s.day)get(j.via).connections+=sum(j.pax)
  return map
}
export function recordAirportDay(s:GameState,demands:Record<string,Record<string,number>>,weekly:boolean) {
  ensureAirports(s)
  const bases=new Set([...s.airline.hubs,...largeBases(s)])
  const trafficByAirport=airportDailyTraffic(s)
  for(const [id,d] of Object.entries(s.airportDevelopment!)) {
    if(!airportUsage(s).has(id)&&!s.airline.hubs.includes(id)&&!d.work)continue
    if(d.lastDay>=s.day)continue
    d.lastDay=s.day
    const a=AIRPORT_BY_IATA[id],use=airportSlots(s,id),traffic=trafficByAirport.get(id)??{passengers:0,connections:0,longDirect:0,flights:0}
    if(traffic.flights>0)d.operatingDays++
    d.passengers+=traffic.passengers;d.connections+=traffic.connections
    if(bases.has(id)) {
      // Cada faixa livre deve permanecer disponível por 365 observações diárias.
      const days=s.airline.hubs.includes(id)?365:438
      d.idle.push(Math.max(0,use.capacity-use.own-use.rivals));if(d.idle.length>days)d.idle.shift()
      if(d.idle.length===days)d.reserved=Math.min(use.normal,Math.max(d.reserved,use.own+Math.min(...d.idle)))
    } else {d.idle=[];d.reserved=Math.max(d.personalSlots??0,d.reserved)}
    if(!weekly)continue
    d.lastDemand=s.airline.routes.filter(r=>r.aircraftIds.length>0&&(r.from===id||r.to===id)).reduce((n,r)=>n+(demands[id]?.[r.id]??0),0)
    const progress=growthProgress(s,id)
    if(!d.work&&progress.canGrow&&d.operatingDays>=progress.daysNeeded&&
      d.passengers+d.connections*3>=progress.paxNeeded&&(d.lastDemand??0)>=progress.demandNeeded) {d.capacity+=progress.increment;if(bases.has(id))d.reserved=Math.max(d.reserved,use.ownLimit)+progress.increment;d.earned++}
    const popGrowth=populationAt(s,id)/(a.pop*1e6)-1
    const load=(use.own+use.rivals)/Math.max(1,use.normal)
    const connectionRatio=traffic.connections/Math.max(1,traffic.passengers)
    // Interesses amadurecem lentamente, com pesos diferentes e limite de população.
    const operatorReady=load>.72&&(traffic.passengers>200||use.rivals>50)
    const governmentReady=popGrowth>.3&&load>.5
    if(s.day-d.lastExpansion>365) {
      d.operator=Math.min(1,d.operator+(operatorReady?(1+Math.min(1,connectionRatio*3))/1040:-.002))
      d.government=Math.min(1,d.government+(governmentReady?(1+Math.min(1,traffic.longDirect/Math.max(1,traffic.passengers)))/780:-.002))
      d.operator=Math.max(0,d.operator);d.government=Math.max(0,d.government)
    }
    if(!d.work&&d.operator>=1&&d.government>=1) {
      const kind:WorkKind=!restricted.has(id)&&d.category!=='int'&&popGrowth>1?'category':!restricted.has(id)&&d.runway<10000&&popGrowth>.75?'runway':'slots'
      const blocked=kind==='slots'&&d.capacity+Math.ceil(d.baseCapacity*(restricted.has(id)?.15:.35))>d.baseCapacity*(restricted.has(id)?1.6:3)*Math.max(1,Math.pow(1+popGrowth,.7))
      if(!blocked) {
      d.work={kind,start:s.day,end:s.day+WORK_DAYS[kind],contribution:0,automatic:true}
      s.notices.push({day:s.day,kind:'info',text:`${id}: governo e administradora iniciaram ${WORK_LABEL[kind].toLowerCase()}; slots pela metade durante a obra.`})
      }
    }
    if(bases.has(id)) {
      const routes=s.airline.routes.filter(r=>r.from===id||r.to===id)
      const passengers=routes.reduce((n,r)=>n+r.history.filter(h=>h.day>s.day-7).reduce((v,h)=>v+sum(h.pax),0),0)
      const connections=(s.connectionJourneys??[]).filter(j=>!j.cancelled&&j.via===id&&j.second.day>s.day-7&&j.second.day<=s.day).reduce((n,j)=>n+sum(j.pax),0)
      d.history.push({day:s.day,population:populationAt(s,id),capacity:airportSlots(s,id).capacity,own:use.own,rivals:use.rivals,passengers,connections,demands:demands[id]??{}})
      if(d.history.length>104)d.history.shift()
    }
  }
  invalidateAirportUsage(s)
}
