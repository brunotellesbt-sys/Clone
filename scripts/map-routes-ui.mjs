import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {artifact,browserPath} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try {
 for(const width of [412,1365]) {
  const page=await browser.newPage({viewport:{width,height:915}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route(/https:\/\/(gibs.earthdata.nasa.gov|server.arcgisonline.com)\//,route=>route.abort())
  await page.goto(process.env.URL??'http://127.0.0.1:5173/')
  await page.evaluate(async()=>{
   const {newGame,openRoute,buyAircraft,assignAircraft,dowOf}=await import('/src/game/engine.ts')
   const {saveGame}=await import('/src/game/save.ts')
   const {invalidateAirportUsage}=await import('/src/game/airportInfrastructure.ts')
   const s=newGame({name:'Mapa trajetos',code:'MT',hub:'SDU',seed:12,densidade:'enxuta'})
   s.airline.cash=1e9;s.competitors=[];s.paused=true
   for(const to of ['CGH','BSB','SSA','GIG','VIX'])openRoute(s,'SDU',to)
   buyAircraft(s,'e195e2',false)
   const a=s.airline.fleet.at(-1),r=s.airline.routes.find(r=>r.to==='CGH')
   assignAircraft(s,a.id,r.id)
   s.day=3
   s.airline.escala=[{id:'departure-test',aircraftId:a.id,from:'SDU',to:'CGH',dow:dowOf(s),saida:299}]
   // UTC 08:00 na abertura do mapa, um minuto após sair de SDU (UTC−3).
   invalidateAirportUsage(s);saveGame(s,1)
  })
  await page.reload();await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
  await page.evaluate(async()=>{const {loadFlightProcedures}=await import('/src/ui/airportFlightPaths.ts');await loadFlightProcedures(['SDU','CGH','BSB','SSA','GIG','VIX'])})
  const map=page.locator('.mapwrap').first()
  // Espera o efeito do mapa atualizar as geometrias após o download.
  await page.waitForFunction(()=>document.querySelectorAll('.map-own-route').length>=4)
  for(const clicks of [0,17,5]) {
   for(let i=0;i<clicks;i++)await map.getByRole('button',{name:'Aproximar',exact:true}).click()
   const result=await page.evaluate(async()=>{
    const {AIRPORT_BY_IATA:ap}=await import('/src/game/data/airports.ts')
    const {airportMapPoint}=await import('/src/ui/airportFlightPaths.ts')
    const {geoEquirectangular}=await import('/node_modules/.vite/deps/d3-geo.js')
    const project=geoEquirectangular().fitExtent([[0,10],[1000,510]],{type:'Sphere'})
    const paths=[...document.querySelectorAll('.map-own-route')]
    return paths.map(p=>{
     const start=p.getPointAtLength(0),end=p.getPointAtLength(p.getTotalLength()),matrix=p.getScreenCTM()
     const error=(point,id)=>{
      const xy=project(airportMapPoint(ap[id])),actual=new DOMPoint(point.x,point.y).matrixTransform(matrix),expected=new DOMPoint(...xy).matrixTransform(matrix)
      return Math.hypot(actual.x-expected.x,actual.y-expected.y)
     }
     return {route:p.dataset.from+'-'+p.dataset.to,start:error(start,p.dataset.from),end:error(end,p.dataset.to)}
    })
   })
   assert(result.every(r=>r.start<.15&&r.end<.15),JSON.stringify(result))
  }
  // Geometria completa carregada: avião/rastro começam e terminam na pista,
  // independentemente da linha de visão geral e do nível de zoom.
  const endpoints=await page.evaluate(async()=>{
   const {AIRPORT_BY_IATA:ap}=await import('/src/game/data/airports.ts')
   const {airportFlightPath,airportFlightPose,airportRunwayPoints}=await import('/src/ui/airportFlightPaths.ts')
   const {geoEquirectangular}=await import('/node_modules/.vite/deps/d3-geo.js')
   const project=geoEquirectangular().fitExtent([[0,10],[1000,510]],{type:'Sphere'})
   const results=[]
   for(const [from,to] of [['SDU','CGH'],['CGH','SDU'],['GIG','SDU']])for(const minute of [300,900,1300]){
    const a=ap[from],b=ap[to],path=airportFlightPath(a,b,minute,minute+65)
    for(const [phase,id] of [[0,from],[1,to]]){
     const pose=airportFlightPose(project,a,b,phase,minute,minute+65)
     const delta=Math.min(...airportRunwayPoints(ap[id]).map(p=>{const q=project(p);return Math.hypot(q[0]-pose.x,q[1]-pose.y)}))
     const trail=project(path.slice(0,1)[phase===0?0:path.slice(0,1).length-1])
     results.push({delta,trail:Math.hypot(trail[0]-pose.x,trail[1]-pose.y)})
    }
   }
   return results
  })
  assert(endpoints.every(p=>p.delta<1e-8&&p.trail<1e-8),JSON.stringify(endpoints))
  const plane=map.locator('[data-flight-id="departure-test"]')
  await plane.waitFor()
  await plane.dispatchEvent('click')
  await map.locator('.map-flight-trail').waitFor()
  const alignment=await map.evaluate(el=>{
   const plane=el.querySelector('[data-flight-id="departure-test"]')
   const position=new DOMPoint(0,0).matrixTransform(plane.getScreenCTM())
   return [...el.querySelectorAll('.map-flight-trail path')].map((p,i)=>{
    const point=p.getPointAtLength(i===0?0:p.getTotalLength())
    const screen=new DOMPoint(point.x,point.y).matrixTransform(p.getScreenCTM())
    return Math.hypot(screen.x-position.x,screen.y-position.y)
   })
  })
  assert(alignment.every(error=>error<.15),`avião e rastro renderizados: ${alignment}`)
  await map.screenshot({path:artifact(`map-routes-${width}.png`)})
  assert.equal(errors.length,0,errors.join('\n'))
  await page.close()
  console.log(`OK: ${width}px, linhas ancoradas nos aeroportos em três níveis de zoom; avião/rastro nas cabeceiras com procedimentos carregados.`)
 }
}finally{await browser.close()}
