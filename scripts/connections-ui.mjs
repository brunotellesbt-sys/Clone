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
    const trips = s.connectionJourneys.filter(j => j.first.day >= s.day - 6).length
    const d = s.airline.routes[0].history.at(-1)
    d.revenue = 100
    d.cost = 10000000
    d.profit = d.revenue - d.cost
    d.seats = 300
    d.pax = { y: 30, w: 0, c: 0, f: 0 }
    d.costBreakdown = { fuel: 6000000, crew: 1000000, maintenance: 1000000, fees: 1000000, handling: 500000, catering: 500000 }
    s.airline.routes[0].history = [d]
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(s))
    return trips
  })
  assert(trips > 0)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  for (const speed of ['1×', '25×', '50×', '100×']) assert.equal(await page.getByRole('button', { name: speed, exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Conexões', exact: true }).click()
  assert.equal(await page.locator('.connection-sold tbody tr').count(), trips)
  const moneyCells = await page.locator('.connection-sold tbody tr td:nth-child(2)').allTextContents()
  assert(moneyCells.some(v => v.includes('$')), 'conexões apuradas mostram resultado monetário')
  await page.getByLabel('Ordenar resultado das conexões').selectOption('worst')
  const firstWorst = await page.locator('.connection-sold tbody tr').first().textContent()
  assert(firstWorst)
  await page.getByLabel('Ordenar resultado das conexões').selectOption('best')
  const firstBest = await page.locator('.connection-sold tbody tr').first().textContent()
  assert(firstBest && firstWorst !== firstBest, 'ordem de lucro e prejuízo muda os itinerários')
  for (const width of [360, 412, 1365]) {
    await page.setViewportSize({ width, height: 915 })
    const fits = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main.scrollWidth <= main.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1
    })
    assert(fits, `painel de conexões cabe na largura ${width}`)
    await page.screenshot({ path: artifact(`conexoes-${width}.png`), fullPage: true })
    if (width === 360) await page.locator('.connection-sold').screenshot({ path: artifact('conexoes-vendidas-mobile.png') })
  }
  await page.getByLabel('Hub das conexões').selectOption('SSA')
  assert.equal(await page.locator('.connection-sold tbody tr').count(), 0)
  await page.getByLabel('Hub das conexões').selectOption('GRU')
  await page.getByLabel('Buscar conexão').fill('LIS')
  const rows = await page.locator('.connection-sold tbody tr').allTextContents()
  assert(rows.length > 0 && rows.every(r => r.includes('LIS')))
  await page.getByRole('button', { name: 'Finanças', exact: true }).click()
  assert(await page.getByLabel('Rota em déficit').count() === 1)
  assert((await page.getByText('Baixa ocupação:', { exact: false }).count()) > 0)
  await page.getByLabel('Rota em déficit').scrollIntoViewIfNeeded()
  await page.getByLabel('Rota em déficit').locator('xpath=ancestor::*[contains(@class, "card")][1]').screenshot({ path: artifact('financas-deficit-card.png') })
  for (const width of [360, 412]) {
    await page.setViewportSize({ width, height: 915 })
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
    assert(fits, `diagnóstico financeiro cabe na largura ${width}`)
    await page.screenshot({ path: artifact(`financas-deficit-${width}.png`), fullPage: true })
    if (width === 360) await page.getByLabel('Rota em déficit').locator('xpath=ancestor::*[contains(@class, "card")][1]')
      .screenshot({ path: artifact('financas-deficit-card-mobile.png') })
  }
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
