import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {geoDistance} from 'd3-geo'
import {AIRPORT_BY_IATA as AP} from '../src/game/data/airports'
import {airportMapPoint,airportFlightPath,buildFlightPath,visualRunwayReverse,type AirportProcedures} from '../src/ui/airportFlightPaths'
const data=(id:string):AirportProcedures=>JSON.parse(readFileSync(`public/flight-paths/${id[0]}.json`,'utf8'))[id]
for(const [from,to] of [['SDU','CGH'],['GIG','GRU'],['PVH','RBR']]) {
  for(const reversed of [false,true]) {
    const d=data(from),a=data(to),path=buildFlightPath(AP[from],AP[to],d,a,reversed,reversed)
    const r=[...d.runways].sort((x,y)=>y[6]-x[6])[0],s=[...a.runways].sort((x,y)=>y[6]-x[6])[0]
    const start:[number,number]=reversed?[r[5],r[4]]:[r[3],r[2]]
    const end:[number,number]=reversed?[s[3],s[2]]:[s[5],s[4]]
    assert.deepEqual(path.points[0],start,`${from} sai da cabeceira da maior pista`)
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
