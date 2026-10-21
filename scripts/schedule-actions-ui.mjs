import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {artifact,browserPath} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try {
 const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.URL??'http://127.0.0.1:5173/')
 const setup=await page.evaluate(async()=>{
  const {newGame,openRoute,buyAircraft,dowOf}=await import('/src/game/engine.ts')
  const {marcarVoo}=await import('/src/game/escala.ts'),{saveGame}=await import('/src/game/save.ts')
  const {invalidateAirportUsage}=await import('/src/game/airportInfrastructure.ts')
  const s=newGame({name:'Grade e undo',code:'GU',hub:'GRU',seed:38,densidade:'enxuta'})
  s.competitors=[];s.airline.cash=1e10;s.paused=true;invalidateAirportUsage(s)
  openRoute(s,'GRU','REC');buyAircraft(s,'e195e2',false);buyAircraft(s,'e195e2',false)
  const err=marcarVoo(s,s.airline.fleet[0].id,'GRU','REC',dowOf(s),420)
  if(err)throw Error(err)
  saveGame(s,1)
  return {reg:s.airline.fleet[1].reg,first:s.airline.escala[0].id}
 })
 await page.reload();await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
 await page.getByRole('button',{name:/^Rotas/}).first().click()
 const mark=page.locator('.card').filter({has:page.getByRole('heading',{name:'Marcar voo',exact:true})})
 assert(await mark.getByRole('button',{name:'Desfazer último movimento',exact:true}).isDisabled())
 await mark.getByRole('button',{name:'Todos',exact:true}).click()
 await mark.locator('.row').filter({has:page.getByText(setup.reg,{exact:true})}).getByRole('button',{name:'Marcar 7 dias',exact:true}).click()
 await mark.getByRole('button',{name:'Desfazer último movimento (7)',exact:true}).waitFor()
 await mark.getByRole('button',{name:'Desfazer último movimento (7)',exact:true}).click()
 const remaining=await page.evaluate(async()=>{const {loadGame}=await import('/src/game/save.ts');return loadGame(1).airline.escala.map(p=>p.id)})
 assert.deepEqual(remaining,[setup.first])
 await mark.getByRole('button',{name:'Hoje',exact:true}).click()
 await mark.locator('.row').filter({has:page.getByText(setup.reg,{exact:true})}).getByRole('button',{name:'Marcar',exact:true}).click()
 await mark.getByRole('button',{name:'Desfazer último movimento (1)',exact:true}).click()
 await mark.locator('summary').filter({hasText:'não pode'}).click()
 await mark.getByText(/está no ar:.*pousa em REC.*horário local/).waitFor()
 for(const width of [360,412,1365]) {
  await page.setViewportSize({width,height:900})
  await page.getByRole('button',{name:'Frota',exact:true}).click()
  const chart=page.locator('.apk-week-chart')
  await chart.waitFor()
  assert.equal(await chart.getAttribute('height'),'566')
  const ticks=await chart.locator('text').allTextContents()
  assert(ticks.includes('00:00')&&ticks.includes('24:00')&&ticks.includes('Dom')&&ticks.includes('Sáb'))
  const legsBefore=await page.evaluate(async()=>{const {loadGame}=await import('/src/game/save.ts');return JSON.stringify(loadGame(1).airline.escala)})
  await chart.locator('.apk-week-flight').first().click()
  assert.equal(await page.locator('.apk-week input').count(),0)
  const positions=await chart.locator('.apk-week-flight').evaluateAll(groups=>groups.map(g=>{
   const r=g.querySelector('rect'),from=Number(g.dataset.fromMinute),to=Number(g.dataset.toMinute)
   return {actual:Number(r.getAttribute('y')),expected:38+17.5+from/1440*493,height:Number(r.getAttribute('height')),expectedHeight:(to-from)/1440*493}
  }))
  assert(positions.every(p=>Math.abs(p.actual-p.expected)<1e-8&&Math.abs(p.height-p.expectedHeight)<1e-8))
  const after=await page.evaluate(async()=>{const {loadGame}=await import('/src/game/save.ts');return JSON.stringify(loadGame(1).airline.escala)})
  assert.equal(after,legsBefore,'consultar a grade não altera horários')
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.locator('.apk-week').screenshot({path:artifact(`schedule-apk-${width}.png`)})
  await page.getByRole('button',{name:/^Rotas/}).first().click()
 }
 assert.equal(errors.length,0,errors.join('\n'))
 console.log('OK: desfazer 7 dias/1 dia sem remover voo anterior; pouso informado; grade fixa somente consulta em 360/412/1365 px.')
}finally{await browser.close()}
