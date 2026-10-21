import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {browserPath,artifact} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try{
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.URL??'http://127.0.0.1:5173/',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const {newGame,addHub,openRoute,buyAircraft,assignAircraft,setFrequency}=await import('/src/game/engine.ts')
  const {invalidateAirportUsage,ensureAirports,airportSlots}=await import('/src/game/airportInfrastructure.ts')
  const {saveGame}=await import('/src/game/save.ts')
  const s=newGame({name:'Bases',code:'BS',hub:'GRU',seed:7,densidade:'enxuta'})
  s.competitors=[];invalidateAirportUsage(s);s.airline.cash=1e10;s.airline.reputation=1
  if(addHub(s,'CGH'))throw new Error('hub')
  delete s.cghExtraSlotsGranted
  for(const id of ['SDU','GIG','VIX','CWB','FLN']){
   const routeError=openRoute(s,'CGH',id)
   if(routeError)throw new Error(`Rota CGH–${id}: ${routeError}`)
   const purchaseError=buyAircraft(s,'e195e2',false)
   if(purchaseError)throw new Error(`Compra para CGH–${id}: ${purchaseError}`)
   // Operação estabelecida: três idas e voltas exigem seis direitos no destino.
   // Os dois movimentos da entrada inicial continuam sendo a regra do jogo.
   s.airportDevelopment[id].reserved=6
   invalidateAirportUsage(s)
   const r=s.airline.routes.at(-1),a=s.airline.fleet.at(-1)
   a.base='CGH'
   const assignmentError=assignAircraft(s,a.id,r.id)
   if(assignmentError)throw new Error(`Alocação CGH–${id}: ${assignmentError}`)
   ensureAirports(s)
   for(let day=0;day<7;day++){
    const error=setFrequency(s,r.id,day,3)
    if(error)throw new Error(`Escala CGH–${id}, dia ${day}: ${error}`)
    if(r.freq[day]!==3)throw new Error(`CGH–${id}, dia ${day}: ${r.freq[day]} rotações; esperado 3`)
   }
  }
  ensureAirports(s)
  if(airportSlots(s,'CGH').own<30)throw new Error(`Fixture com apenas ${airportSlots(s,'CGH').own} movimentos`)
  saveGame(s,1)
 })
 await page.reload({waitUntil:'networkidle'})
 await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
 await page.getByRole('button',{name:'Bases grandes',exact:true}).click()
 assert.equal(await page.getByRole('button',{name:/^CGH ·/}).count(),0)
 assert.equal(await page.locator('.hubs-panel option[value=CGH]').count(),0)
 await page.getByRole('button',{name:'Hubs',exact:true}).click()
 await page.locator('.hubs-panel select').first().selectOption('CGH')
 assert.equal(await page.getByRole('progressbar').count(),4)
 await page.getByRole('button',{name:'Fechar hub',exact:true}).click()
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 assert.equal(await page.getByRole('button',{name:'Confirmar fechamento'}).count(),0)
 await page.getByRole('button',{name:'Fechar hub',exact:true}).click()
 await page.getByRole('button',{name:'Confirmar fechamento'}).click()
 await page.getByRole('button',{name:'Bases grandes',exact:true}).click()
 await page.getByText('Acompanhamento de bases grandes',{exact:true}).waitFor()
 await page.getByRole('button',{name:/^CGH · \d+ mov\.\/dia$/}).click()
 assert(await page.getByText(/período de 438 dias/).isVisible())
 assert(await page.getByText(/Concessão única: \+41/).isVisible())
 assert.equal(await page.getByRole('progressbar').count(),4)
 for(const width of [360,412,1365]){
  await page.setViewportSize({width,height:900})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.screenshot({path:artifact(`bases-grandes-${width}.png`),fullPage:true})
 }
 await page.waitForFunction(async()=>{const {loadGame}=await import('/src/game/save.ts');const s=loadGame(1);return !s.airline.hubs.includes('CGH')&&s.airportDevelopment.CGH.personalSlots===41})
 assert.equal(errors.length,0,errors.join('\n'))
 console.log('OK: barras, fechar/cancelar hub, CGH sem hub, benefício persistente e bases grandes responsivas.')
}finally{await browser.close()}
