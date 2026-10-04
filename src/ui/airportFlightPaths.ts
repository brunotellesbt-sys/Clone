import {geoDistance,geoInterpolate,type GeoProjection} from 'd3-geo'
import type {Airport} from '../game/data/airports'
import runwayHeads from './data/runwayHeads.json'
import airportCoordinates from './data/airportCoordinates.json'
import verifiedRunways from './data/verifiedRunways.json'
type Point=[number,number]
interface Procedure {kind:string;name:string;c?:Point[];r?:Record<string,Point[]>;t?:Record<string,Point[]>}
export interface AirportProcedures {
  runways:[string,string,number,number,number,number,number][];
  configs:{c:string[];d:string[];a:string[]}[];procedures:Procedure[]
}
const loaded=new Map<string,AirportProcedures>(),requests=new Map<string,Promise<void>>()
const heads=runwayHeads as unknown as Record<string,AirportProcedures['runways'][number]>
const verified=verifiedRunways as unknown as Record<string,AirportProcedures['runways']>
const coordinates=airportCoordinates as unknown as Record<string,Point>
const airportData=(id:string)=>{
  const data=loaded.get(id)??(heads[id]?{runways:[heads[id]],configs:[],procedures:[]}:undefined)
  return verified[id]?{configs:[],procedures:[],...data,runways:verified[id]}:data
}
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
/** Três períodos locais, duas inversões por dia e nenhuma troca à meia-noite.
 * A direção é puramente visual e não participa da operação ou economia. */
export function visualRunwayReverse(iata:string,localMinutes:number) {
  const phase=((localMinutes%1440)+1440)%1440
  const seed=[...iata].reduce((n,c)=>n+c.charCodeAt(0),0)
  return Boolean((seed%2)^Number(phase>=420+seed%90)^Number(phase>=960+seed%90))
}
const mainRunway=(data:AirportProcedures|undefined)=>data?.runways.reduce<AirportProcedures['runways'][number]|undefined>((best,r)=>!best||r[6]>best[6]?r:best,undefined)
const mapPoints=new Map<string,Point>()
let pointsRevision=-1
export function airportMapPoint(a:Airport):Point {
  if(pointsRevision!==revision){mapPoints.clear();pointsRevision=revision}
  const cached=mapPoints.get(a.iata);if(cached)return cached
  const r=mainRunway(airportData(a.iata))
  const point:Point=r?geoInterpolate([r[3],r[2]],[r[5],r[4]])(.5) as Point:coordinates[a.iata]??[a.lon,a.lat]
  mapPoints.set(a.iata,point);return point
}
/** A malha liga aeroportos. Procedimentos de voo pertencem ao avião selecionado,
 * não a todas as rotas simultaneamente (o que criava leques em fixes no mar). */
export function airportNetworkPoints(a:Airport,b:Airport):Point[] {
  return [airportMapPoint(a),airportMapPoint(b)]
}
export function airportRunwayPoints(a:Airport):Point[] {
  const r=mainRunway(airportData(a.iata))
  return r?[[r[3],r[2]],[r[5],r[4]]]:[]
}
function terminal(data:AirportProcedures|undefined,other:Point,departure:boolean,reverse=false):Point[] {
  if(!data?.runways.length)return []
  const runway=mainRunway(data)!,id=runway[reverse?1:0]
  const start:Point=reverse?[runway[5],runway[4]]:[runway[3],runway[2]]
  const end:Point=reverse?[runway[3],runway[2]]:[runway[5],runway[4]]
  const runwayLength=Math.max(1e-9,geoDistance(start,end))
  // A curva do procedimento termina antes da final. Completa a aproximação e
  // a saída no prolongamento do eixo, sem ligar um waypoint lateral à cabeceira.
  const final=geoInterpolate(end,start)(1+3000/6371000/runwayLength) as Point
  const climb=geoInterpolate(start,end)(1+1500/6371000/runwayLength) as Point
  const options:Point[][]=[]
  for(const p of data.procedures) {
    if(p.kind!==(departure?'SID':'APP'))continue
    if(departure&&!p.r?.[id])continue
    if(!departure&&!p.name.includes(id)&&!p.r?.[id])continue
    const core=[...(p.r?.[id]??[]),...(p.c??[])].map(swap)
    for(const transition of [[],...Object.values(p.t??{})]) {
      const points=departure?[start,end,climb,...core,...transition.map(swap)]:[...transition.map(swap),...core,final,start,end]
      options.push(points.filter((point,i)=>!i||geoDistance(points[i-1],point)>1e-8))
    }
  }
  options.sort((a,b)=>length(a)+geoDistance(departure?a.at(-1)!:a[0],other)-length(b)-geoDistance(departure?b.at(-1)!:b[0],other))
  return options[0]??(departure?[start,end,climb]:[final,start,end])
}
export function buildFlightPath(a:Airport,b:Airport,from?:AirportProcedures,to?:AirportProcedures,reverseFrom=false,reverseTo=false) {
  const departure=terminal(from,[b.lon,b.lat],true,reverseFrom),arrival=terminal(to,[a.lon,a.lat],false,reverseTo)
  const points:Point[]=[...(departure.length?departure:[airportMapPoint(a)]),...(arrival.length?arrival:[airportMapPoint(b)])]
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
export function airportFlightPath(a:Airport,b:Airport,departureUtc=0,arrivalUtc=departureUtc) {
  const reverseFrom=visualRunwayReverse(a.iata,departureUtc+a.fuso),reverseTo=visualRunwayReverse(b.iata,arrivalUtc+b.fuso)
  const key=`${revision}:${a.iata}:${b.iata}:${reverseFrom}:${reverseTo}`
  let result=paths.get(key)
  if(!result){if(paths.size>1500)paths.clear();result=buildFlightPath(a,b,airportData(a.iata),airportData(b.iata),reverseFrom,reverseTo);paths.set(key,result)}
  return result
}
export function airportFlightPose(project:GeoProjection,a:Airport,b:Airport,phase:number,departureUtc=0,arrivalUtc=departureUtc) {
  const route=airportFlightPath(a,b,departureUtc,arrivalUtc),point=project(route.point(phase))!,before=project(route.point(Math.max(0,phase-.000001)))!,after=project(route.point(Math.min(1,phase+.000001)))!
  let dx=after[0]-before[0];if(dx>500)dx-=1000;if(dx< -500)dx+=1000
  return {x:point[0],y:point[1],angle:Math.atan2(after[1]-before[1],dx)*180/Math.PI}
}
