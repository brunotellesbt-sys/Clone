import {geoDistance,geoInterpolate,type GeoProjection} from 'd3-geo'
import type {Airport} from '../game/data/airports'
type Point=[number,number]
interface Procedure {kind:string;name:string;c?:Point[];r?:Record<string,Point[]>;t?:Record<string,Point[]>}
export interface AirportProcedures {
  runways:[string,string,number,number,number,number,number][];
  configs:{c:string[];d:string[];a:string[]}[];procedures:Procedure[]
}
const loaded=new Map<string,AirportProcedures>(),requests=new Map<string,Promise<void>>()
let revision=0
export function loadFlightProcedures(ids:string[]) {
  return Promise.all([...new Set(ids.map(id=>id[0]))].map(prefix=>{
    let request=requests.get(prefix)
    if(!request){request=fetch(`${import.meta.env.BASE_URL}flight-paths/${prefix}.json`).then(r=>{if(!r.ok)throw new Error('procedures unavailable');return r.json()}).then(data=>{for(const [id,value] of Object.entries(data))loaded.set(id,value as AirportProcedures);revision++}).catch(()=>{requests.delete(prefix)});requests.set(prefix,request)}
    return request
  }))
}
const swap=([lat,lon]:Point):Point=>[lon,lat]
const length=(points:Point[])=>points.slice(1).reduce((n,p,i)=>n+geoDistance(points[i],p),0)
/** Orientação predominante da base original; não inventa vento na simulação. */
function terminal(data:AirportProcedures|undefined,other:Point,departure:boolean):Point[] {
  if(!data?.runways.length)return []
  const config=data.configs.find(c=>departure?c.d.length>0:c.a.length>0) ??
    data.configs.find(c=>c.c.length>0) ?? data.configs[0]
  const preferred=[...(departure?config?.d??[]:config?.a??[]),...config?.c??[]]
  const runway=[...data.runways].sort((a,b)=>b[6]-a[6]).find(r=>preferred.includes(r[0])||preferred.includes(r[1]))??data.runways[0]
  const reverse=preferred.includes(runway[1])&&!preferred.includes(runway[0]),id=runway[reverse?1:0]
  const start:Point=reverse?[runway[5],runway[4]]:[runway[3],runway[2]]
  const end:Point=reverse?[runway[3],runway[2]]:[runway[5],runway[4]]
  const options:Point[][]=[]
  for(const p of data.procedures) {
    if(p.kind!==(departure?'SID':'APP'))continue
    if(departure&&!p.r?.[id])continue
    if(!departure&&!p.name.includes(id)&&!p.r?.[id])continue
    const core=[...(p.r?.[id]??[]),...(p.c??[])].map(swap)
    for(const transition of [[],...Object.values(p.t??{})]) {
      const points=departure?[start,end,...core,...transition.map(swap)]:[...transition.map(swap),...core,start,end]
      options.push(points.filter((point,i)=>!i||geoDistance(points[i-1],point)>1e-8))
    }
  }
  options.sort((a,b)=>length(a)+geoDistance(departure?a.at(-1)!:a[0],other)-length(b)-geoDistance(departure?b.at(-1)!:b[0],other))
  return options[0]??[start,end]
}
export function buildFlightPath(a:Airport,b:Airport,from?:AirportProcedures,to?:AirportProcedures) {
  const departure=terminal(from,[b.lon,b.lat],true),arrival=terminal(to,[a.lon,a.lat],false)
  const points:Point[]=[...(departure.length?departure:[[a.lon,a.lat] as Point]),...(arrival.length?arrival:[[b.lon,b.lat] as Point])]
  const distances=[0];const curves:ReturnType<typeof geoInterpolate>[]=[]
  for(let i=1;i<points.length;i++){distances.push(distances[i-1]+geoDistance(points[i-1],points[i]));curves.push(geoInterpolate(points[i-1],points[i]))}
  const total=distances.at(-1)!
  const point=(phase:number):Point=>{
    const d=Math.max(0,Math.min(1,phase))*total
    let index=1;while(index<distances.length-1&&distances[index]<d)index++
    return curves[index-1]((d-distances[index-1])/Math.max(1e-12,distances[index]-distances[index-1])) as Point
  }
  return {points,point,slice:(from:number,to:number)=>[point(from),...points.filter((_,i)=>distances[i]>from*total&&distances[i]<to*total),point(to)]}
}
const paths=new Map<string,ReturnType<typeof buildFlightPath>>()
export function airportFlightPath(a:Airport,b:Airport) {
  const key=`${revision}:${a.iata}:${b.iata}`
  let result=paths.get(key)
  if(!result){if(paths.size>1500)paths.clear();result=buildFlightPath(a,b,loaded.get(a.iata),loaded.get(b.iata));paths.set(key,result)}
  return result
}
export function airportFlightPose(project:GeoProjection,a:Airport,b:Airport,phase:number) {
  const route=airportFlightPath(a,b),point=project(route.point(phase))!,before=project(route.point(Math.max(0,phase-.000001)))!,after=project(route.point(Math.min(1,phase+.000001)))!
  let dx=after[0]-before[0];if(dx>500)dx-=1000;if(dx< -500)dx+=1000
  return {x:point[0],y:point[1],angle:Math.atan2(after[1]-before[1],dx)*180/Math.PI}
}
