import assert from 'node:assert/strict'
import {connectionPathAllowed} from '../src/game/connectionGeometry'
import {connectionAllowed,conexoesNaBase} from '../src/game/malha'
import {newGame,openRoute,buyAircraft,dowOf} from '../src/game/engine'
import {marcarVoo,noTempo} from '../src/game/escala'
import {allocateConnections} from '../src/game/connections'
import {airportSlots,ensureAirports,invalidateAirportUsage,airportUsage,updateRivalUsage} from '../src/game/airportInfrastructure'
import {odKey} from '../src/game/geo'
for(const [a,h,b] of [['FOR','GRU','PVH'],['BSB','GRU','PVH'],['GIG','MAO','GRU']]) {
  assert(!connectionPathAllowed(a,h,b));assert(!connectionPathAllowed(b,h,a))
}
for(const [a,h,b] of [['RBR','PVH','CZS'],['OAL','PVH','JPR']])for(const [from,to] of [[a,b],[b,a]]) {
  assert(connectionPathAllowed(from,h,to));assert(!connectionPathAllowed(from,h,to,true))
  const s=newGame({name:'Regional',code:'RG',hub:h,seed:7,densidade:'enxuta'})
  s.competitors=[];s.airline.cash=1e10;invalidateAirportUsage(s)
  for(const [origin,destination,hour] of [[from,h,8],[h,to,12]] as const) {
    assert.equal(openRoute(s,origin,destination),null);assert.equal(buyAircraft(s,'e195e2',false),null)
    const ac=s.airline.fleet.at(-1)!;ac.base=origin
    assert.equal(marcarVoo(s,ac.id,origin,destination,dowOf(s),hour*60),null)
  }
  // Aproxima a segunda partida para ficar dentro da janela doméstica.
  s.airline.escala![1].saida=noTempo(s,s.airline.escala![0]).chegadaLocal+60;invalidateAirportUsage(s)
  assert(conexoesNaBase(s,h).length>0,`${from}-${h}-${to}: oferta na malha`)
  const locals=s.airline.routes.map(route=>({route,voos:s.airline.escala!.filter(p=>odKey(p.from,p.to)===odKey(route.from,route.to)),seats:{y:120,w:0,c:0,f:0},local:{y:20,w:0,c:0,f:0}}))
  allocateConnections(s,locals,dowOf(s),1)
  assert(s.connectionJourneys!.some(j=>j.first.from===from&&j.second.to===to&&j.pax.y>0),`${from}-${to}: vende e embarca`)
  const d=s.airportDevelopment![h];d.slotPolicy=undefined;d.reserved=90;ensureAirports(s)
  assert.equal(airportSlots(s,h).free,6,'migração retira apenas folga inicial')
  assert.equal(d.capacity,90,'capacidade física não muda')
  const old=[...airportUsage(s)].map(([id,v])=>[id,v.rivals])
  const rival={from,to,freq:1};s.competitors=[{routes:[rival]} as any]
  updateRivalUsage(s,[],[rival]);assert(!connectionAllowed(s,from,h,to),'direto ativo remove exceção regional')
  const incremental=[...airportUsage(s)].map(([id,v])=>[id,v.rivals]).sort()
  invalidateAirportUsage(s);assert.deepEqual([...airportUsage(s)].map(([id,v])=>[id,v.rivals]).sort(),incremental,'atualização parcial equivale ao cálculo completo')
  assert(old.length>0)
}
console.log('OK: exemplos regionais nos dois sentidos vendidos, desvios longos bloqueados, concorrência direta, slots e cache incremental.')
