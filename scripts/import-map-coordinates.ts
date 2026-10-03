// Visual only. Inputs downloaded from OurAirports and DECEA; never changes airport operating limits.
import {readFileSync,writeFileSync} from 'node:fs'
import {AIRPORTS} from '../src/game/data/airports'
const csv=(file:string)=>{
 const rows=readFileSync(file,'utf8').trim().split(/\r?\n/).map(line=>[...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(m=>m[1].replace(/^"|"$/g,'').replace(/""/g,'"')))
 const headers=rows.shift()!
 return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])))
}
const records=csv(process.argv[2]),points:Record<string,number[]>={}
for(const a of AIRPORTS){
 const r=records.find(r=>r.iata_code===a.iata&&r.iso_country===a.cc&&r.type!=='closed')
 if(r)points[a.iata]=[Number(r.longitude_deg),Number(r.latitude_deg)]
}
const dms=(s:string)=>{const n=s.slice(0,-1),deg=n.length-(n.includes('.')?n.length-n.indexOf('.'):0)-4;return (Number(n.slice(0,deg))+Number(n.slice(deg,deg+2))/60+Number(n.slice(deg+2))/3600)*(/[SW]$/.test(s)?-1:1)}
const official=JSON.parse(readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,'')) as Record<string,{id:string;lat:string;lon:string;length:number}[]>
const runways:Record<string,(string|number)[][]>={}
for(const [id,rows] of Object.entries(official)){
 runways[id]=[]
 for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];if(!b)throw new Error(id);runways[id].push([a.id,b.id,dms(a.lat),dms(a.lon),dms(b.lat),dms(b.lon),Math.round(a.length/.3048)])}
}
writeFileSync('src/ui/data/airportCoordinates.json',JSON.stringify(points)+'\n')
writeFileSync('src/ui/data/verifiedRunways.json',JSON.stringify(runways)+'\n')
console.log(`${Object.keys(points).length} pontos; ${Object.keys(runways).length} aeroportos com cabeceiras DECEA.`)
