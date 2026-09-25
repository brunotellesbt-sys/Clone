import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { browserPath, artifact } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  const trips = await page.evaluate(async () => {
    const { newGame, buyAircraft, openRoute, assignAircraft, setAllFrequencies, advanceDay } = await import('/src/game/engine.ts')
    const s = newGame({ name: 'Brasa Airways', code: 'BR', hub: 'GRU', seed: 31 })
    s.airline.cash = 5e9
    s.airline.hubs.push('SSA')
    for (const d of ['REC', 'SSA', 'LIS']) {
      buyAircraft(s, d === 'LIS' ? 'a359' : 'a320neo', false)
      openRoute(s, 'GRU', d)
      const r = s.airline.routes.at(-1)
      assignAircraft(s, s.airline.fleet.at(-1).id, r.id)
      setAllFrequencies(s, r.id, 2)
      r.fare = { y: 1.9, w: 1.9, c: 1.9, f: 1.9 }
    }
    for (let i = 0; i < 7; i++) advanceDay(s)
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(s))
    return s.connectionJourneys.filter(j => j.first.day >= s.day - 6).length
  })
  assert(trips > 0)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  for (const speed of ['1×', '25×', '50×', '100×']) assert.equal(await page.getByRole('button', { name: speed, exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Conexões', exact: true }).click()
  assert.equal(await page.locator('.connection-journeys tbody tr').count(), trips)
  for (const width of [360, 412, 1365]) {
    await page.setViewportSize({ width, height: 915 })
    const fits = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main.scrollWidth <= main.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1
    })
    assert(fits, `painel de conexões cabe na largura ${width}`)
    await page.screenshot({ path: artifact(`conexoes-${width}.png`), fullPage: true })
  }
  await page.getByLabel('Hub das conexões').selectOption('SSA')
  assert.equal(await page.locator('.connection-journeys tbody tr').count(), 0)
  await page.getByLabel('Hub das conexões').selectOption('GRU')
  await page.getByLabel('Buscar conexão').fill('LIS')
  const rows = await page.locator('.connection-journeys tbody tr').allTextContents()
  assert(rows.length > 0 && rows.every(r => r.includes('LIS')))
  await page.getByRole('button', { name: 'Painel', exact: true }).click()
  await page.setViewportSize({ width: 360, height: 915 })
  await page.getByRole('button', { name: 'Configurações do mapa', exact: true }).click()
  const box = await page.locator('.map-settings').boundingBox()
  assert(box.x >= 0 && box.x + box.width <= 360)
  await page.locator('.mapwrap').scrollIntoViewIfNeeded()
  await page.screenshot({ path: artifact('mapa-configuracoes-mobile.png'), fullPage: true })
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log(`OK: ${trips} itinerários, filtros de hub/busca, velocidades e painel/mapa em 360/412/1365 px.`)
} finally {
  await browser.close()
}
