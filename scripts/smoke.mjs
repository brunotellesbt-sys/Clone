import { browserPath, artifact } from './browser.mjs'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.otf': 'font/otf', '.ttf': 'font/ttf' }
const root = 'dist'
const server = createServer((req, res) => {
  let p = join(root, normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: artifact('shot-1-novo.png') })

// fundar a companhia
await page.getByRole('button', { name: 'Decolar' }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: artifact('shot-2-painel.png') })

// comprar um avião
await page.getByRole('button', { name: 'Mercado', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('row', { name: /Embraer E190/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Comprar' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: artifact('shot-3-mercado.png') })

// abrir uma rota
await page.getByRole('button', { name: 'Rotas' }).first().click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(500)
await page.getByPlaceholder('cidade, país ou código').fill('Recife')
await page.waitForTimeout(400)
await page.getByRole('row', { name: /REC/ }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: artifact('shot-4-abrir-rota.png') })
await page.getByRole('button', { name: /^Abrir por/ }).click()
await page.waitForTimeout(500)

// marcar a semana inteira: dedicar cauda e frequência saíram da tela da rota,
// e quem marca voo agora é o cartão "Marcar voo", com dia, hora e cauda
const todos = page.getByRole('button', { name: 'Todos', exact: true })
if (await todos.count()) { await todos.click(); await page.waitForTimeout(300) }
const marcar = page.getByRole('button', { name: /^Marcar/ }).first()
if (await marcar.count()) { await marcar.click(); await page.waitForTimeout(600) }
await page.screenshot({ path: artifact('shot-5-rota.png') })

// rodar o tempo
await page.getByTitle('40× mais rápido').click()
await page.waitForTimeout(6000)
await page.getByRole('button', { name: 'Painel' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: artifact('shot-6-rodando.png') })

// pintura
await page.getByRole('button', { name: 'Pintura' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: artifact('shot-7-pintura.png') })

// ranking e finanças
await page.getByRole('button', { name: 'Finanças' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: artifact('shot-8-financas.png') })
await page.getByRole('button', { name: 'Ranking' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: artifact('shot-9-ranking.png') })

const summary = await page.evaluate(() => {
  const raw = localStorage.getItem('skyline-tycoon:save:0')
  if (!raw) return 'sem save'
  const s = JSON.parse(raw)
  return `dia ${s.day}, caixa ${Math.round(s.airline.cash / 1e6)}M, frota ${s.airline.fleet.length}, rotas ${s.airline.routes.length}`
})
console.log('estado:', summary)
console.log('erros de console:', errors.length ? errors.slice(0, 10) : 'nenhum')
await browser.close()
server.close()
if (errors.length) process.exitCode = 1
