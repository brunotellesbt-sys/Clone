import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const root = 'dist'
const server = createServer((req, res) => {
  let p = join(root, normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(p) || p.endsWith('/')) p = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/shot-1-novo.png' })

// fundar a companhia
await page.getByRole('button', { name: 'Decolar' }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/shot-2-painel.png' })

// comprar um avião
await page.getByRole('button', { name: 'Mercado', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('row', { name: /Embraer E190/ }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Comprar' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shot-3-mercado.png' })

// abrir uma rota
await page.getByRole('button', { name: 'Rotas' }).first().click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(500)
await page.getByPlaceholder('cidade, país ou código').fill('Recife')
await page.waitForTimeout(400)
await page.getByRole('row', { name: /REC/ }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-4-abrir-rota.png' })
await page.getByRole('button', { name: /^Abrir por/ }).click()
await page.waitForTimeout(500)

// alocar o avião e subir a frequência
const sel = page.locator('select').filter({ hasText: 'escolher' }).first()
if (await sel.count()) { await sel.selectOption({ index: 1 }); await page.waitForTimeout(300) }
const maxBtn = page.getByRole('button', { name: 'Máximo' })
if (await maxBtn.count()) await maxBtn.click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shot-5-rota.png' })

// rodar o tempo
await page.getByTitle('40× mais rápido').click()
await page.waitForTimeout(6000)
await page.getByRole('button', { name: 'Painel' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/shot-6-rodando.png' })

// pintura
await page.getByRole('button', { name: 'Pintura' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/shot-7-pintura.png' })

// ranking e finanças
await page.getByRole('button', { name: 'Finanças' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-8-financas.png' })
await page.getByRole('button', { name: 'Ranking' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-9-ranking.png' })

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
