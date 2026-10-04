import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {browserPath,artifact} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try{
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.URL??'http://127.0.0.1:5173/',{waitUntil:'networkidle'})
 await page.evaluate(async()=>{
  const {newGame,addHub,openRoute,buyAircraft,assignAircraft,setAllFrequencies}=await import('/src/game/engine.ts')
  const {invalidateAirportUsage,ensureAirports}=await import('/src/game/airportInfrastructure.ts')
  const {saveGame}=await import('/src/game/save.ts')
  const s=newGame({name:'Bases',code:'BS',hub:'GRU',seed:7,densidade:'enxuta'})
  s.competitors=[];invalidateAirportUsage(s);s.airline.cash=1e10;s.airline.reputation=1
  if(addHub(s,'CGH'))throw new Error('hub')
  for(const id of ['SSA','SDU','BSB']){
   openRoute(s,'CGH',id);buyAircraft(s,'e195e2',false)
   const r=s.airline.routes.at(-1),a=s.airline.fleet.at(-1)
   a.base='CGH';assignAircraft(s,a.id,r.id);setAllFrequencies(s,r.id,2)
  }
  delete s.cghExtraSlotsGranted;ensureAirports(s)
  saveGame(s,1)
 })
 await page.reload({waitUntil:'networkidle'})
 await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
 await page.getByRole('button',{name:'Bases grandes',exact:true}).click()
 await page.getByRole('button',{name:/^CGH · \d+ mov\.\/dia · hub$/}).click()
 assert(await page.getByText(/Este aeroporto já é seu hub e mantém os prazos normais/).isVisible())
 assert(await page.getByText(/período de 365 dias/).isVisible())
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
