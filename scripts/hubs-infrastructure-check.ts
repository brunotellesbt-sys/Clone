import assert from 'node:assert/strict'
import {newGame,openRoute,buyAircraft,advanceDay,slotsFree} from '../src/game/engine'
import {admittedFlights,airportSlots,effectiveAirport,flightMovements,ensureAirports,finishAirportWorks,growthProgress,invalidateAirportUsage,recordAirportDay,rivalFrequency,startAirportWork,workOffer} from '../src/game/airportInfrastructure'
import {marcarRotacao} from '../src/game/escala'
import {exportSaveFile,importSaveFile} from '../src/game/save'
import {AIRPORT_BY_IATA} from '../src/game/data/airports'
import {largestPassengerAircraft} from '../src/game/routeCapacity'
const setup=()=>{const s=newGame({name:'Hubs',code:'HB',hub:'PVH',seed:8,densidade:'enxuta'});s.competitors=[];s.airline.cash=20e9;s.airline.hubs.push('MAO');invalidateAirportUsage(s);ensureAirports(s);return s}
const s=setup();const free=slotsFree(s,'PVH');assert.equal(openRoute(s,'PVH','MAO'),null);assert.equal(slotsFree(s,'PVH'),free,'rota vazia não consome slots')
assert.equal(buyAircraft(s,'e195e2',false),null);const ac=s.airline.fleet[0];const r=s.airline.routes[0]
assert.equal(marcarRotacao(s,ac.id,r,1,480),null);assert.equal(airportSlots(s,'PVH').own,2,'ida e volta são dois movimentos em cada aeroporto')
const d=s.airportDevelopment!.PVH;d.capacity=4;d.reserved=4;invalidateAirportUsage(s)
assert.equal(marcarRotacao(s,ac.id,r,1,800),null)
assert(marcarRotacao(s,ac.id,r,1,1100),'agendamento não ultrapassa capacidade')
assert.equal(airportSlots(s,'PVH').own,4)
assert(workOffer(s,'PVH','slots').reason.includes('interesse'))
d.operator=1;assert.equal(workOffer(s,'PVH','slots').reason,'')
const bill=workOffer(s,'PVH','slots').contribution,cash=s.airline.cash
assert.equal(startAirportWork(s,'PVH','slots'),null);assert.equal(s.airline.cash,cash-bill);assert.equal(d.work!.end-s.day,365)
assert.equal(airportSlots(s,'PVH').capacity,2);assert(admittedFlights(s).size<s.airline.escala!.length)
const restored=importSaveFile(exportSaveFile(s))!;assert.deepEqual(restored.airportDevelopment,s.airportDevelopment,'obra e capacidade persistem')
const old=d.capacity;s.day=d.work!.end;finishAirportWorks(s);assert(d.capacity>old);assert.equal(airportSlots(s,'PVH').capacity,d.capacity);assert.equal(admittedFlights(s).size,s.airline.escala!.length)
for(const id of ['SDU','CGH','PLU']){s.airline.hubs.push(id);ensureAirports(s);s.airportDevelopment![id].operator=1;assert(workOffer(s,id,'runway').reason.includes('restrito'));assert(workOffer(s,id,'category').reason.includes('restrito'))}
const runway=setup(),rd=runway.airportDevelopment!.PVH;rd.operator=1
assert.equal(startAirportWork(runway,'PVH','runway'),null);assert.equal(rd.work!.end,730);const before=rd.runway;runway.day=730;finishAirportWorks(runway);assert.equal(effectiveAirport(runway,'PVH').runway,Math.min(14000,before+2000));assert.equal(AIRPORT_BY_IATA.PVH.runway,before,'catálogo compartilhado não é mutado')
const cat=setup(),cd=cat.airportDevelopment!.PVH;cd.category='dom';cd.operator=1;assert.equal(startAirportWork(cat,'PVH','category'),null);assert.equal(cd.work!.end,913);cat.day=913;finishAirportWorks(cat);assert.equal(effectiveAirport(cat,'PVH').escopo,'reg');assert(largestPassengerAircraft('PVH','LIM',2029,cat));cd.operator=1;assert.equal(startAirportWork(cat,'PVH','category'),null);cat.day=1826;finishAirportWorks(cat);assert.equal(effectiveAirport(cat,'PVH').escopo,'int')
const idle=setup(),di=idle.airportDevelopment!.PVH;const reserved=di.reserved
for(let day=1;day<365;day++){idle.day=day;recordAirportDay(idle,{},false)}assert.equal(di.reserved,reserved)
idle.day=365;recordAirportDay(idle,{},false);assert.equal(di.reserved,di.capacity,'somente após um ano completo a capacidade ociosa é reservada')
const natural=setup(),nd=natural.airportDevelopment!.PVH,p=growthProgress(natural,'PVH');openRoute(natural,'PVH','MAO');natural.airline.routes[0].aircraftIds=['traffic-fixture'];nd.operatingDays=p.daysNeeded;nd.passengers=p.paxNeeded;natural.day=7;recordAirportDay(natural,{PVH:{[natural.airline.routes[0].id]:p.demandNeeded}},true);assert.equal(nd.earned,1)
const both=setup(),bd=both.airportDevelopment!.PVH;bd.operator=bd.government=1;both.day=7;const beforeCash=both.airline.cash;recordAirportDay(both,{},true);assert(bd.work?.automatic);assert.equal(both.airline.cash,beforeCash)
const flow=setup();openRoute(flow,'PVH','MAO');buyAircraft(flow,'e195e2',false);for(let dow=0;dow<7;dow++)assert.equal(marcarRotacao(flow,flow.airline.fleet[0].id,flow.airline.routes[0],dow,480),null)
for(let i=0;i<8;i++)advanceDay(flow)
assert(flow.airportDevelopment!.PVH.history.length>0);assert(flow.airportDevelopment!.PVH.passengers>0)
console.log('OK: slots por movimentos, limite finito, migração, obras, restrições, categoria/pista, redistribuição anual, crescimento e apuração diária.')

const arrival=flightMovements(flow,{id:'overnight',aircraftId:flow.airline.fleet[0].id,from:'MAO',to:'PVH',dow:6,saida:1430})
assert.deepEqual(arrival,[['MAO',6],['PVH',0]],'chegada depois de meia-noite usa o dia local seguinte')
const rivals=setup();rivals.airline.escala=[];rivals.airportDevelopment!.PVH.capacity=10;rivals.airportDevelopment!.PVH.reserved=4
rivals.competitors=Array.from({length:8},(_,i)=>({...s.competitors[0],id:`c${i}`,routes:[{from:'PVH',to:'MAO',freq:1}]})) as typeof rivals.competitors
invalidateAirportUsage(rivals)
assert.equal(rivals.competitors.reduce((n,c)=>n+2*rivalFrequency(rivals,c.routes[0]),0),6,'concorrentes usam rotações inteiras dentro da capacidade restante')
console.log('OK: chegada no dia seguinte e limite conjunto da concorrência.')
