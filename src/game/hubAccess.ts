import {AIRPORT_BY_IATA} from './data/airports'
import type {GameState} from './types'

export const hubCompanyLimit=(s:GameState,id:string)=>{
 const level=s.airportDevelopment?.[id]?.level??AIRPORT_BY_IATA[id].tier
 return level>=5?4:level===4?3:2
}
export function hubCompanies(s:GameState,id:string,except?:string){
 return Number(s.airline.hubs.includes(id)) + s.competitors.filter(c=>c.id!==except&&(c.hub===id||c.hubs?.includes(id))).length
}
export const hubHasRoom=(s:GameState,id:string,except?:string)=>hubCompanies(s,id,except)<hubCompanyLimit(s,id)
