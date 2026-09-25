import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright'
import { artifact, browserPath } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ ...devices['Pixel 7'] })
const errors = []
page.on('pageerror', e => errors.push(e.message))

try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const { newGame, buyAircraft } = await import('/src/game/engine.ts')
    const s = newGame({ name: 'Cabines APK', code: 'CA', hub: 'GRU', seed: 42 })
    s.airline.cash = 2e9
    buyAircraft(s, 'a359', false)
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(s))
    localStorage.setItem('skyline-tycoon:active-slot', '1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await page.locator('.nav button').filter({ hasText: 'Frota' }).click()
  await page.locator('tbody tr.click').first().click()
  await page.getByRole('button', { name: /Cabine/ }).first().click()

  await page.getByLabel('Poltrona c').selectOption('biz_wide_suite')
  await page.getByLabel('Poltrona w').selectOption('prem_eco_luxury')
  assert.equal(await page.getByLabel('Poltrona c').inputValue(), 'biz_wide_suite')
  assert.equal(await page.getByLabel('Poltrona w').inputValue(), 'prem_eco_luxury')
  assert.equal(await page.getByLabel('Distribuição c').inputValue(), '1-2-1')
  assert.equal(await page.getByLabel('Passo de Executiva').inputValue(), '54')
  assert.equal(await page.getByLabel('Passo de Executiva').isDisabled(), true)
  assert.match(await page.locator('.a2-seat-card').filter({ has: page.getByLabel('Poltrona c') }).textContent(), /115% apelo/)
  assert.equal(await page.getByRole('option', { name: /Poltrona padrão/ }).count(), 0)
  await page.waitForFunction(() => {
    const photos = [...document.querySelectorAll('.a2-seat-photo')].filter(x => /Suíte ampla|Premium luxo/.test(x.alt))
    return photos.length === 2 && photos.every(x => x.complete && x.naturalWidth > 0)
  })
  assert.match(await page.locator('.a2-seat-card').filter({ has: page.getByLabel('Poltrona c') }).textContent(), /Suíte ampla|apelo/)
  assert.equal(errors.length, 0, errors.join('\n'))
  await page.getByLabel('Poltrona c').scrollIntoViewIfNeeded()
  await page.screenshot({ path: artifact('cabine-modelos-escolhidos.png'), fullPage: true })
  console.log('ok: Suíte ampla e Premium luxo mantêm o modelo selecionado, fotos do APK e apelo visível no celular')
} finally {
  await browser.close()
}
