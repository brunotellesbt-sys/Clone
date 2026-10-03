// Small geometry index derived only from the existing APK departure/arrival data.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs'
const heads={}
for(const file of readdirSync('public/flight-paths').filter(f=>/^[A-Z]\.json$/.test(f))) {
  const airports=JSON.parse(readFileSync(`public/flight-paths/${file}`,'utf8'))
  for(const [iata,data] of Object.entries(airports)){
    const runway=[...data.runways].sort((a,b)=>b[6]-a[6])[0]
    if(runway)heads[iata]=runway
  }
}
mkdirSync('src/ui/data',{recursive:true})
writeFileSync('src/ui/data/runwayHeads.json',JSON.stringify(heads)+'\n')
console.log(`Índice visual: ${Object.keys(heads).length} pistas principais.`)
