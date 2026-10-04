import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {browserPath} from './browser.mjs'
const browser=await chromium.launch({executablePath:browserPath})
try {
 const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(process.env.URL??'http://127.0.0.1:5173/')
 const result=await page.evaluate(async()=>{
  const {DaySimulation}=await import('/src/game/daySimulation.ts')
  const {newGame,advanceDay}=await import('/src/game/engine.ts')
  const expected=newGame({name:'Worker',code:'WK',hub:'GRU',seed:44,densidade:'enxuta'})
  let actual=structuredClone(expected),frames=0
  const simulation=new DaySimulation(),timer=setInterval(()=>frames++,5)
  try{
   for(let i=0;i<8;i++){
    advanceDay(expected);actual=await simulation.advance(actual)
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`Divergência no dia ${i+1}`)
   }
   return {frames,day:actual.day}
  }finally{clearInterval(timer);simulation.dispose()}
 })
 assert(result.frames>0,'a interface recebe eventos enquanto o worker calcula')
 // Segura respostas de dias para reproduzir cliques enquanto há um cálculo em curso.
 await page.addInitScript(()=>{
  window.__heldDays=[];window.__dayRequests=0
  const NativeWorker=window.Worker
  window.Worker=class extends NativeWorker {
   constructor(url,options){
    super(url,options);this.day=String(url).includes('dayWorker')
    if(this.day)this.addEventListener('message',event=>{
     event.stopImmediatePropagation()
     window.__heldDays.push(()=>this.onmessage?.call(this,event))
    })
   }
   postMessage(data,...args){
    if(this.day){window.__dayRequests++;window.__lastDay={day:data.state.day,fleet:data.state.airline.fleet.length,cash:data.state.airline.cash}}
    return super.postMessage(data,...args)
   }
  }
 })
 await page.goto((process.env.URL??'http://127.0.0.1:5173/')+'?relogio=1000')
 await page.evaluate(async()=>{
  const {newGame}=await import('/src/game/engine.ts'),{saveGame}=await import('/src/game/save.ts')
  const s=newGame({name:'Concorrência de cliques',code:'WK',hub:'GRU',seed:44,densidade:'enxuta'})
  s.paused=true;saveGame(s,1)
 })
 await page.reload();await page.getByRole('button',{name:'Continuar',exact:true}).first().click()
 await page.getByRole('button',{name:'600×',exact:true}).click()
 await page.waitForFunction(()=>window.__heldDays.length===1)
 await page.getByRole('button',{name:'Mercado',exact:true}).click()
 await page.getByRole('row',{name:/Embraer E190/}).first().click()
 await page.getByRole('button',{name:'Comprar',exact:true}).click()
 await page.evaluate(()=>window.__heldDays.shift()())
 await page.waitForFunction(()=>window.__dayRequests>=2)
 const afterClick=await page.evaluate(()=>window.__lastDay)
 assert.equal(afterClick.day,0,'resultado anterior ao clique foi descartado')
 assert.equal(afterClick.fleet,1,'compra preservada no próximo cálculo')
 await page.waitForFunction(()=>window.__heldDays.length===1)
 await page.getByRole('button',{name:'❚❚',exact:true}).click()
 await page.evaluate(()=>window.__heldDays.shift()())
 assert(await page.locator('.brand').innerText().then(t=>t.includes('dia 0')),'pausa não publica dia atrasado')
 await page.getByRole('button',{name:'600×',exact:true}).click()
 await page.waitForFunction(()=>window.__heldDays.length===1)
 await page.evaluate(()=>window.__heldDays.shift()())
 await page.waitForFunction(()=>document.querySelector('.brand').textContent.includes('dia 1'))
 await page.getByRole('button',{name:'❚❚',exact:true}).click()
 assert.equal(errors.length,0,errors.join('\n'))
 console.log(`OK: ${result.day} dias iguais ao motor síncrono; interface ativa, compra e pausa preservadas durante cálculo.`)
}finally{await browser.close()}
