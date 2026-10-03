import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {geoDistance} from 'd3-geo'
import {AIRPORT_BY_IATA as AP} from '../src/game/data/airports'
import {airportMapPoint,airportFlightPath,buildFlightPath,visualRunwayReverse,type AirportProcedures} from '../src/ui/airportFlightPaths'
import verified from '../src/ui/data/verifiedRunways.json'
const data=(id:string):AirportProcedures=>JSON.parse(readFileSync(`public/flight-paths/${id[0]}.json`,'utf8'))[id]
for(const [from,to] of [['SDU','CGH'],['GIG','GRU'],['PVH','RBR']]) {
  for(const reversed of [false,true]) {
    const d=data(from),a=data(to),path=buildFlightPath(AP[from],AP[to],d,a,reversed,reversed)
    const r=[...d.runways].sort((x,y)=>y[6]-x[6])[0],s=[...a.runways].sort((x,y)=>y[6]-x[6])[0]
    const start:[number,number]=reversed?[r[5],r[4]]:[r[3],r[2]]
    const end:[number,number]=reversed?[s[3],s[2]]:[s[5],s[4]]
    assert.deepEqual(path.points[0],start,`${from} sai da cabeceira da maior pista`)
    const [takeoffStart,takeoffEnd,climb]=path.points
    assert(Math.abs(geoDistance(takeoffStart,climb)-geoDistance(takeoffStart,takeoffEnd)-geoDistance(takeoffEnd,climb))<1e-9,'saída acompanha o prolongamento da pista')
    const [final,threshold,stop]=path.points.slice(-3)
    assert(Math.abs(geoDistance(final,stop)-geoDistance(final,threshold)-geoDistance(threshold,stop))<1e-9,'final de pouso alinhada ao eixo da pista')
    assert(geoDistance(path.point(0),start)<1e-10)
    assert(geoDistance(path.point(1),end)<1e-10,`${to} termina na pista`)
    assert(path.points.every(p=>p.every(Number.isFinite)))
    assert.deepEqual(path.slice(.2,.8)[0],path.point(.2),'rastro usa a posição do avião')
    const marker=airportMapPoint(AP[from])
    assert(geoDistance(marker,[r[3],r[2]])<=geoDistance([r[3],r[2]],[r[5],r[4]]),'marcador na pista desde o primeiro quadro')
    const initial=airportFlightPath(AP[from],AP[to]).points[0]
    assert(initial.every(Number.isFinite),'cabeceira disponível sem aguardar fetch')
  }
  let changes=0,previous=visualRunwayReverse(from,-1)
  for(let minute=0;minute<1440;minute++){
    const current=visualRunwayReverse(from,minute)
    if(current!==previous)changes++
    previous=current
  }
  assert(changes>0&&changes<=3,`${from}: limite diário de inversões`)
  assert.equal(visualRunwayReverse(from,0),visualRunwayReverse(from,1440))
}
console.log('OK: pista principal, cabeceiras nos dois sentidos, rastro alinhado e no máximo três inversões visuais por dia.')
for(const [id,runways] of Object.entries(verified)){
 const r=[...runways].sort((a,b)=>Number(b[6])-Number(a[6]))[0]
 const ends=[[Number(r[3]),Number(r[2])],[Number(r[5]),Number(r[4])]] as [number,number][]
 const path=airportFlightPath(AP[id],AP[id==='SDU'?'GRU':'SDU'])
 assert(ends.some(p=>geoDistance(p,path.points[0])<1e-10),`${id}: trajeto usa coordenada verificada já no primeiro quadro`)
 const length=geoDistance(ends[0],ends[1])*6371000,published=Number(r[6])*.3048
 assert(length<=published+120&&length>=published*.6,`${id}: cabeceiras dentro da pista, admitindo cabeceira deslocada`)
}
const sdu=verified.SDU.find(r=>r[0]==='02R')!
assert(Math.abs(Number(sdu[2])-(-22-54/60-59.48/3600))<1e-10,'SDU: THR 02R conferida com AD 2.12 DECEA')
