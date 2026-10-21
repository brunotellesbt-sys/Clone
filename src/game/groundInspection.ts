import {admittedFlights} from './airportInfrastructure'
import {DIA,SEMANA,blocoDe,partidaUtc} from './escala'
import type {GameState} from './types'

/** Redução do desgaste: 5% às 2h, +2,5 pontos por meia hora completa, teto 65%. */
export function groundInspectionBenefit(minutes:number) {
  return minutes<120?0:Math.min(.65,.05+Math.floor((minutes-120)/30)*.025)
}
/** Uma parada contínua, na mesma ponta. Não considera como solo o vazio entre aeroportos. */
export function inspectionBeforeFlights(s:GameState) {
  const byAircraft=new Map<string,{id:string;from:string;to:string;departure:number;arrival:number}[]>()
  const admitted=admittedFlights(s)
  for(const p of s.airline.escala??[])if(admitted.has(p.id)){
    const list=byAircraft.get(p.aircraftId)??[],departure=partidaUtc(p)
    list.push({id:p.id,from:p.from,to:p.to,departure,arrival:departure+blocoDe(s,p)})
    byAircraft.set(p.aircraftId,list)
  }
  const result=new Map<string,{minutes:number;benefit:number}>()
  for(const list of byAircraft.values()){
    list.sort((a,b)=>a.departure-b.departure)
    for(let i=0;i<list.length;i++){
      const p=list[i],previous=list[(i+list.length-1)%list.length]
      const minutes=p.from===previous.to?Math.max(0,p.departure+(i===0?SEMANA:0)-previous.arrival):0
      result.set(p.id,{minutes,benefit:groundInspectionBenefit(minutes)})
    }
  }
  return result
}
export function inspectionSummary(s:GameState,aircraftId:string) {
  const data=inspectionBeforeFlights(s)
  const legs=(s.airline.escala??[]).filter(p=>p.aircraftId===aircraftId)
  const eligible=legs.map(p=>data.get(p.id)).filter(x=>x&&x.benefit>0)
  return {stops:eligible.length,averageReduction:legs.length?legs.reduce((n,p)=>n+(data.get(p.id)?.benefit??0),0)/legs.length:0,
    longest:Math.max(0,...eligible.map(x=>x!.minutes))/DIA}
}
