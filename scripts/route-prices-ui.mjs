import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {browserPath,artifact} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try {
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.URL??'http://127.0.0.1:5173/')
 await page.evaluate(async()=>{
  const {newGame,openRoute}=await import('/src/game/engine.ts'),{saveGame}=await import('/src/game/save.ts')
  const {invalidateAirportUsage}=await import('/src/game/airportInfrastructure.ts')
  const s=newGame({name:'Preços',code:'PC',hub:'GRU',seed:17,densidade:'enxuta'})
  s.airline.cash=1e10;s.competitors=[];s.paused=true;invalidateAirportUsage(s)
  if(openRoute(s,'GRU','REC')||openRoute(s,'GRU','MAO'))throw new Error('fixture')
  s.airportDevelopment.ANF.capacity=2;s.airportDevelopment.ANF.reserved=0
  saveGame(s,1)
 })
 await page.reload();await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
 await page.getByRole('button',{name:/^Rotas/}).first().click()
 const tariffs=page.locator('.card').filter({has:page.getByText('Tarifas',{exact:true})})
 assert.equal(await tariffs.locator('input[type=range]').count(),0)
 const compact=await tariffs.evaluate(el=>el.getBoundingClientRect().height)
 await tariffs.getByRole('button',{name:'Editar preços',exact:true}).click()
 assert(await tariffs.locator('input[type=range]').count()>=3)
 assert(await tariffs.evaluate(el=>el.getBoundingClientRect().height)>compact+100)
 await tariffs.locator('input[type=range]').first().fill('1.25')
 await page.waitForFunction(async()=>{const {loadGame}=await import('/src/game/save.ts');return loadGame(1).airline.routes.some(r=>r.fare.y===1.25)})
 await tariffs.getByRole('button',{name:'Fechar edição de preços'}).click()
 assert.equal(await tariffs.locator('input[type=range]').count(),0)
 await page.getByRole('button',{name:'Abrir rota',exact:true}).click()
 await page.getByPlaceholder('cidade, país ou código').fill('ANF')
 await page.getByRole('row',{name:/ANF/}).first().click()
 await page.getByText('ANF: slots disponíveis ao abrir',{exact:true}).waitFor()
 await page.getByRole('button',{name:/Abrir por/}).click()
 await page.getByRole('status').filter({hasText:'ANF'}).waitFor()
 await page.getByRole('button',{name:'Fechar',exact:true}).click()
 for(const width of [360,412,1365]){
  await page.setViewportSize({width,height:900})
  await tariffs.getByRole('button',{name:'Editar preços',exact:true}).click()
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.screenshot({path:artifact(`route-prices-${width}.png`),fullPage:true})
  await tariffs.getByRole('button',{name:'Fechar edição de preços'}).click()
 }
 assert.equal(errors.length,0,errors.join('\n'))
 console.log('OK: tarifas recolhidas/expandidas, alteração persistente, ANF com reserva inicial e telas 360/412/1365px.')
}finally{await browser.close()}
