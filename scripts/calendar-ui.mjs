import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { browserPath, artifact } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1365, height: 915 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const { newGame, openRoute } = await import('/src/game/engine.ts')
    const s = newGame({ name: 'Calendário Airways', code: 'CA', hub: 'BEL', seed: 41 })
    s.day = 172 // 22/06/2027; não usa a data real do navegador.
    s.airline.cash = 1e9
    openRoute(s, 'BEL', 'PIN')
    s.paused = true
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(s))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Calendário', exact: true }).click()
  const month = page.getByLabel('Mês e ano do calendário')
  assert.equal(await month.inputValue(), String(2027 * 12 + 5))
  assert.equal(await page.locator('.calendar-week').count(), 5, 'junho/2027 tem cinco semanas visíveis')
  assert.equal(await page.locator('.calendar-week.current').count(), 1)
  assert(await page.getByLabel('Mês anterior', { exact: true }).isDisabled())
  assert((await page.locator('.calendar-week.current').textContent()).includes('21 de jun.'))
  const options = await month.locator('option').evaluateAll(items => items.map(i => i.value))
  assert.equal(options.length, 19)
  assert.equal(options.at(-1), String(2028 * 12 + 11))
  assert.equal(Number((await page.locator('.calendar-catalog').textContent()).match(/(\d+) eventos/)[1]), 300)

  // Um catálogo mundial precisa permitir recortes geográficos e expansão acessível.
  const continent = page.getByLabel('Continente do calendário')
  const country = page.getByLabel('País do calendário')
  await continent.selectOption('EU')
  assert.equal(await country.locator('option[value="BR"]').count(), 0)
  await country.selectOption('PT')
  assert(await page.locator('[data-event="madeira-atlantic"]').count() > 0)
  assert.equal(await page.locator('[data-event="parintins"]').count(), 0)
  await continent.selectOption('SA')
  assert.equal(await country.inputValue(), 'all', 'trocar continente limpa país incompatível')
  await country.selectOption('BR')
  assert(await page.locator('[data-event="parintins"]').count() > 0)
  await continent.selectOption('all')
  const firstWeek = page.locator('.calendar-week').first()
  assert.equal(await firstWeek.locator('.calendar-event').count(), 6)
  await firstWeek.getByRole('button', { name: /Mostrar mais/ }).click()
  assert(await firstWeek.locator('.calendar-event').count() > 6)
  await firstWeek.getByRole('button', { name: 'Mostrar menos' }).click()
  assert.equal(await firstWeek.locator('.calendar-event').count(), 6)

  await page.getByLabel('Buscar evento ou aeroporto', { exact: true }).fill('Parintins')
  const event = page.locator('[data-event="parintins"]').first()
  assert(await event.isVisible())
  assert((await event.textContent()).includes('MAO · BEL · STM'))
  await page.getByLabel('Aeroportos do calendário').selectOption('network')
  assert(await event.isVisible(), 'evento acessível via BEL pertence à malha')
  await event.locator('summary').click()
  assert((await event.textContent()).includes('Recorrência anual'))
  assert((await event.textContent()).includes('21/06/2027 a 04/07/2027'))
  assert(await event.locator('a[href^="https://"]').count() >= 3)
  await page.getByLabel('Tipo de período').selectOption('ferias')
  assert.equal(await page.locator('[data-event="parintins"]').count(), 0)
  await page.getByLabel('Tipo de período').selectOption('all')
  await page.getByLabel('Buscar evento ou aeroporto', { exact: true }).fill('Belém')
  assert(await event.isVisible(), 'busca por cidade do gateway funciona com acento')

  await page.getByLabel('Aeroportos do calendário').selectOption('all')
  await page.getByLabel('Buscar evento ou aeroporto', { exact: true }).fill('')
  for (const width of [1365, 412, 360]) {
    await page.setViewportSize({ width, height: 915 })
    const fits = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main.scrollWidth <= main.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1
    })
    assert(fits, `calendário cabe na largura ${width}`)
    await page.evaluate(() => { document.querySelector('main').scrollTop = 0 })
    await page.screenshot({ path: artifact(`calendario-${width}.png`), fullPage: true })
    await page.locator('.calendar-week.current [data-event="parintins"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: artifact(`calendario-semana-${width}.png`) })
  }
  await month.selectOption(String(2028 * 12))
  await page.getByLabel('Buscar evento ou aeroporto', { exact: true }).fill('Navegantes')
  const summer = page.locator('[data-event="ferias-verao-sc"]').first()
  assert(await summer.isVisible(), 'temporada do ano anterior aparece em janeiro')
  assert((await summer.textContent()).includes('NVT +35%'))
  await summer.locator('summary').click()
  assert((await summer.textContent()).includes('13/12/2027 a 20/02/2028'))
  await summer.scrollIntoViewIfNeeded()
  await page.screenshot({ path: artifact('calendario-ferias-mobile.png') })
  await month.selectOption(String(2028 * 12 + 11))
  assert(await page.getByLabel('Próximo mês', { exact: true }).isDisabled())
  await page.getByRole('button', { name: 'Mês atual', exact: true }).click()
  assert.equal(await month.inputValue(), String(2027 * 12 + 5))

  await month.selectOption(String(2028 * 12))
  await page.getByLabel('Buscar evento ou aeroporto', { exact: true }).fill('Ano-Novo Chinês')
  const lunar = page.locator('[data-event="hong-kong-new-year"]').first()
  assert(await lunar.isVisible())
  await lunar.locator('summary').click()
  assert((await lunar.textContent()).includes('26/01/2028'), 'data HKO igual no navegador e na simulação')

  // A rota exibida usa o mesmo aumento mostrado no calendário.
  await page.getByRole('button', { name: /^Rotas/ }).click()
  await page.getByText('BEL → PIN', { exact: true }).first().click()
  assert(await page.getByText(/Férias\/eventos nesta semana: \+100%/).count() > 0)

  // Outra data-base do save: reabre no mês atual e renova o limite do próximo ano.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('skyline-tycoon:save:1'))
    s.startYear = 2028
    s.day = 0
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(s))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Calendário', exact: true }).click()
  assert.equal(await month.inputValue(), String(2028 * 12))
  assert.equal(await month.locator('option').last().getAttribute('value'), String(2029 * 12 + 11))
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('OK: calendário no mês do save, planejamento até dezembro do próximo ano, semanas, fontes, filtros, rotas e telas de 360/412/1365 px.')
} finally {
  await browser.close()
}
