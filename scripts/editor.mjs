import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png' }
const root='dist'
const server=createServer((req,res)=>{let p=join(root,normalize(decodeURIComponent(req.url.split('?')[0])));if(!existsSync(p)||p.endsWith('/'))p=join(root,'index.html');res.writeHead(200,{'Content-Type':MIME[extname(p)]??'application/octet-stream'});res.end(readFileSync(p))})
await new Promise(r=>server.listen(4176,r))
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const page=await b.newPage({viewport:{width:1500,height:1100}})
const errs=[]; page.on('pageerror',e=>errs.push(e.message))
await page.goto('http://localhost:4176/',{waitUntil:'networkidle'})
await page.getByRole('button',{name:'Decolar'}).click(); await page.waitForTimeout(500)
await page.getByRole('button',{name:'Pintura'}).click(); await page.waitForTimeout(500)
await page.screenshot({path:'/tmp/editor-fuselagem.png'})
for (const tab of ['Faixa','Cauda','Asa e motores','Texto']) {
  await page.getByRole('button',{name:tab,exact:true}).click(); await page.waitForTimeout(250)
}
await page.screenshot({path:'/tmp/editor-texto.png'})
await page.getByRole('button',{name:'Sortear'}).click(); await page.waitForTimeout(400)
await page.screenshot({path:'/tmp/editor-sorteio.png'})
console.log('erros:',errs.length?errs.slice(0,4):'nenhum')
await b.close(); server.close()
