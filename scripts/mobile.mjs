/**
 * Joga o começo do jogo num viewport de celular e imprime todo erro de console.
 *
 * Existe porque o `smoke` roda em 1500x1000 com mouse, e o relato do jogador
 * veio de telefone: tela preta depois de "Decolar". Layout estreito, toque em
 * vez de clique e `devicePixelRatio` alto são três coisas que o smoke não
 * exercita.
 *
 *   node scripts/mobile.mjs            # 412x915, o Pixel comum
 *   node scripts/mobile.mjs 360 800    # outra tela
 */
import { chromium, devices } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
}
const root = 'dist'
const server = createServer((req, res) => {
  let p = join(root, normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(p) || p.endsWith('/')) p = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4179, r))

const [w, h] = [Number(process.argv[2]) || 412, Number(process.argv[3]) || 915]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({
  ...devices['Pixel 7'],
  viewport: { width: w, height: h },
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()
const erros = []
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && erros.push(`console: ${m.text()}`))

await page.goto('http://localhost:4179/', { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/mob-1-inicio.png' })

await page.getByRole('button', { name: 'Decolar' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mob-2-apos-decolar.png' })

// A tela preta do relato: o corpo existe mas não desenha nada.
const vazio = await page.evaluate(() => {
  const raiz = document.getElementById('root')
  return { filhos: raiz ? raiz.childElementCount : -1, altura: raiz ? raiz.scrollHeight : -1 }
})
console.log('após Decolar:', JSON.stringify(vazio))

for (const aba of ['Rotas', 'Frota', 'Mercado', 'Pintura', 'Finanças']) {
  const b = page.getByRole('button', { name: aba, exact: true })
  if (await b.count()) {
    await b.first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `/tmp/mob-3-${aba.toLowerCase()}.png` })
  }
}

console.log('erros:', erros.length ? erros.slice(0, 8) : 'nenhum')
await browser.close()
server.close()
