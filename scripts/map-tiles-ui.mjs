import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { artifact, browserPath } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
try {
  for (const width of [1365, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 915 }, deviceScaleFactor: width === 360 ? 2 : 1 })
    const errors = [], requested = []
    page.on('pageerror', e => errors.push(e.message))
    const live = process.env.LIVE_MAP === '1'
    await page.route(/https:\/\/(gibs.earthdata.nasa.gov|server.arcgisonline.com)\//, async route => {
      requested.push(route.request().url())
      if (live) return route.continue()
      // CI valida geometria/carregamento sem depender da disponibilidade do serviço público.
      return route.fulfill({ contentType: 'image/jpeg', body: readFileSync('public/nasa-blue-marble.jpg') })
    })
    await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/sigla, cidade/).fill('SDU')
    await page.locator('.achado').first().click()
    const map = page.locator('.mapwrap').first()
    const airportCenter = () => map.locator('[aria-label="Aeroporto SDU"]').evaluate(el => {
      const box = el.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    })
    const centerBefore = await airportCenter()
    for (let i = 0; i < 24; i++) await map.getByRole('button', { name: 'Aproximar', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.mapwrap svg > g')?.getAttribute('transform')?.includes('scale(288)'))
    const centerAfter = await airportCenter()
    assert(Math.abs(centerBefore.x - centerAfter.x) < 1 && Math.abs(centerBefore.y - centerAfter.y) < 1,
      'os botões de zoom mantêm o aeroporto centralizado')
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('.map-satellite-tile')]
      return tiles.length > 0 && tiles.every(t => Number(t.dataset.level) >= 6 && t.getAttribute('opacity') === '1')
    }, null, { timeout: 45000 })
    const details = await map.locator('.map-satellite-tile').evaluateAll(tiles => tiles.map(t => ({
      level: Number(t.dataset.level), x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')),
    })))
    assert(details.length <= 128 && details.every(t => t.level >= 6), 'zoom profundo usa mosaico de alta resolução')
    if (live) {
      await map.screenshot({ path: artifact(`mapa-nitido-${width}.png`) })
      await map.locator('.map-satellite-details').evaluate(g => g.style.visibility = 'hidden')
      await map.screenshot({ path: artifact(`mapa-antigo-${width}.png`) })
      await map.locator('.map-satellite-details').evaluate(g => g.style.visibility = '')
    }
    // Uma falha de rede não bloqueia os controles nem cobre o fundo local com ícones quebrados.
    await page.unroute(/https:\/\/(gibs.earthdata.nasa.gov|server.arcgisonline.com)\//)
    await page.route('https://gibs.earthdata.nasa.gov/**', route => route.abort())
    for (let i = 0; i < 8; i++) await map.getByRole('button', { name: 'Afastar', exact: true }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('.map-satellite-tile')].some(t =>
      t.dataset.status === 'error' && t.getAttribute('opacity') === '0'))
    assert(await map.locator('image[href$="nasa-blue-marble.jpg"]').isVisible())
    assert.equal(await page.getByText('O jogo travou aqui').count(), 0)
    assert.equal(errors.length, 0, errors.join('\n'))
    assert(requested.length > 0)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    console.log(`OK: ${width}px, detalhes carregados no zoom 288×, fundo sem rede, controles e tela intactos.`)
    await page.close()
  }
} finally { await browser.close() }
