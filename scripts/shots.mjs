/** Tira fotos das telas novas: mercado com motorização e o editor de cabine. */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer((req, res) => {
  let p = join('dist', normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(p) || p.endsWith('/')) p = join('dist', 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4179, r))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4179/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Decolar' }).click()
await page.waitForTimeout(600)

await page.locator('nav.nav button', { hasText: 'Mercado' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-mercado.png' })

// compra um A320neo com GTF, depois abre a cabine
const gtf = page.locator('.opt', { hasText: 'PW1127G' })
if (await gtf.count()) await gtf.first().click()
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/shot-motor.png' })
await page.getByRole('button', { name: 'Comprar', exact: true }).click()
await page.waitForTimeout(300)

await page.locator('nav.nav button', { hasText: 'Frota' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Cabine' }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shot-cabine.png' })
const longo = page.getByRole('button', { name: 'Longo curso' })
if (await longo.count()) await longo.click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/shot-cabine2.png' })
console.log('erros:', errs.length ? errs : 'nenhum')
await browser.close(); server.close()
