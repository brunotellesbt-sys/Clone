import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {AIRPORTS, AIRPORT_BY_IATA} from '../src/game/data/airports'
import {RUNWAY_CORRECTIONS} from '../src/game/data/runwayCorrections'
import {AIRCRAFT_ALL} from '../src/game/data/aircraft'
import {aeroportoServe, motivoDoPar, withEngine} from '../src/game/spec'
import {newGame} from '../src/game/engine'
import {effectiveAirport, ensureAirports, finishAirportWorks, startAirportWork, workOffer} from '../src/game/airportInfrastructure'
import {exportSaveFile, importSaveFile} from '../src/game/save'

const before=JSON.parse(readFileSync(new URL('./fixtures/runways-before.json',import.meta.url),'utf8'))
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const variants=AIRCRAFT_ALL.flatMap(t=>t.engines.map(e=>withEngine(t,e)))
assert.equal(AIRPORTS.length,before.airports)
assert.equal(variants.length,before.variants)
// A única alteração posterior autorizada é a exceção de PAV. Mantém o
// contrato anterior para todos os aeroportos e verifica a exceção à parte.
assert.equal(hash(AIRPORTS.map(a=>[a.iata,...variants.map(t=>aeroportoServe(t,a.iata==='PAV'?{...a,iata:undefined}:a))])),before.permissions,'demais permissões intactas, incluindo carga e motores')
for(const t of variants) {
  const pav=AIRPORT_BY_IATA.PAV
  const exception=['a319neo','b37m','b38m','b39m','b310m'].includes(t.id)
  assert.equal(aeroportoServe(t,pav),exception||aeroportoServe(t,{...pav,iata:undefined}),`PAV/${t.id}`)
  if(exception)assert.equal(motivoDoPar(t,pav,AIRPORT_BY_IATA.GRU),null,'exceção vale também ao programar a rota')
}
assert.equal(hash(AIRPORTS.map(a=>[a.iata,a.paxDia,a.slots,a.tier,a.escopo,a.pop,a.gdp,a.tour,a.elev,a.tetoAssentos])),before.economy,'demanda e demais índices intactos')
const s=newGame({name:'Pistas',code:'PT',hub:'PVH',seed:8,densidade:'enxuta'})
s.airline.cash=100e9
ensureAirports(s)
const restricted=new Set(['SDU','CGH','PLU'])
for(const old of before.changed) {
  const id=old.iata,a=AIRPORT_BY_IATA[id],d=s.airportDevelopment![id],correction=RUNWAY_CORRECTIONS[id]
  assert.equal(correction.previousFeet,old.runway)
  assert.equal(Math.round(a.runway*.3048),correction.meters)
  assert.equal(d.runway,old.runway,'novo jogo usa a mesma base de obras')
  // Reproduz saves anteriores: nenhuma obra, obra parcial no limite e várias ampliações.
  for(const value of [old.runway,old.runway+1,Math.min(14000,old.runway+2000),14000]) {
    d.runway=value
    const extension=value-old.runway, expanded=extension>0
    const oldEffective={...old,runway:value,
      pistaOperacional:expanded?(old.pistaOperacional??old.runway)+extension:old.pistaOperacional,
      tetoAssentos:expanded&&!restricted.has(id)?undefined:old.tetoAssentos}
    const current=effectiveAirport(s,id)
    assert.equal(current.runway,a.runway+extension,`${id}: somente obra real aumenta comprimento`)
    for(const t of variants)assert.equal(aeroportoServe(t,current),aeroportoServe(t,oldEffective),`${id}/${t.id}: save com pista ${value}`)
  }
  d.runway=old.runway
}
// Pista corrigida sem teto: ampliar fisicamente não libera aeronaves no cadastro.
// Pista corrigida com teto: carregar save não remove o teto por falsa ampliação.
for(const id of ['PNZ','THE','PQC']) {
  s.airline.hubs.push(id)
  const d=s.airportDevelopment![id],old=before.changed.find((a:{iata:string})=>a.iata===id)
  d.operator=1
  const pre=effectiveAirport(s,id).runway
  assert.equal(startAirportWork(s,id,'runway'),null)
  s.day=d.work!.end;finishAirportWorks(s)
  const extension=Math.min(2000,14000-old.runway)
  assert.equal(d.runway,old.runway+extension)
  assert.equal(effectiveAirport(s,id).runway,pre+extension)
  d.runway=14000;d.operator=1
  assert(workOffer(s,id,'runway').reason.includes('limite'))
}
const restored=importSaveFile(exportSaveFile(s))!
assert(restored)
for(const {iata} of before.changed)assert.deepEqual(effectiveAirport(restored,iata),effectiveAirport(s,iata),'reimportar não soma correção duas vezes')
assert.equal(hash(restored.airportDevelopment),hash(s.airportDevelopment),'save preserva obras e seus valores legados (JSON omite undefined)')
assert.equal(Math.round(AIRPORT_BY_IATA.MEA.runway*.3048),1410,'fonte antiga não substitui pista nova de Macaé')
console.log(`OK: ${AIRPORTS.length} aeroportos × ${variants.length} variantes; 26 comprimentos, economia, saves e obras preservados.`)
