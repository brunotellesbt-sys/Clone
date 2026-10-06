import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {browserPath,artifact} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.URL??'http://127.0.0.1:5173/',{waitUntil:'networkidle'})
  await page.evaluate(async()=>{
    const {newGame,openRoute}=await import('/src/game/engine.ts')
    const {saveGame}=await import('/src/game/save.ts')
    const s=newGame({name:'Infraestrutura',code:'IH',hub:'PVH',seed:4,densidade:'enxuta'})
    s.speed=0;s.airline.cash=10e9;openRoute(s,'PVH','MAO');s.airportDevelopment.PVH.operator=1;s.airportDevelopment.PVH.government=.0002
    if(!saveGame(s,1))throw new Error('Falha ao gravar fixture')
  })
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
  await page.locator('.nav button').filter({hasText:'Hubs'}).click()
  await page.getByText('0.02%',{exact:true}).waitFor()
  assert(await page.getByText(/90 dias de operação em hub ou 108 dias em base grande/).isVisible())
  for(const width of [360,390,430,1280]){
    await page.setViewportSize({width,height:900})
    assert(await page.getByText('Acompanhamento de hubs',{exact:true}).isVisible())
    const over=await page.evaluate(()=>{const m=document.querySelector('main');return Math.max(document.documentElement.scrollWidth-innerWidth,m.scrollWidth-m.clientWidth)})
    assert(over<=1,`Painel não cabe em ${width}px`)
  }
  await page.getByRole('button',{name:'Revisar aporte'}).first().click()
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Pagar e iniciar obra'}).count(),0)
  await page.getByRole('button',{name:'Revisar aporte'}).first().click()
  await page.getByRole('button',{name:'Pagar e iniciar obra'}).click()
  await page.getByText(/em andamento: faltam/).waitFor()
  await page.waitForFunction(async()=>{const {loadGame}=await import('/src/game/save.ts');return loadGame(1)?.airportDevelopment?.PVH?.work?.kind==='slots'})
  const saved=await page.evaluate(async()=>{const {loadGame}=await import('/src/game/save.ts');return loadGame(1)})
  assert.equal(saved.airportDevelopment.PVH.work.kind,'slots')
  assert(saved.airline.cash<10e9)
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
  await page.locator('.nav button').filter({hasText:'Hubs'}).click()
  await page.getByText(/em andamento: faltam/).waitFor()
  await page.setViewportSize({width:390,height:900})
  await page.getByText('Obras e negociação',{exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({path:artifact('hubs-obra-mobile.png')})
  assert.equal(errors.length,0,errors.join('\n'))
  console.log('OK: painel responsivo, cancelamento, aporte e obra persistente após reabrir.')
} finally {await browser.close()}
