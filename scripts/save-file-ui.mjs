import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { browserPath } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const { newGame, openRoute } = await import('/src/game/engine.ts')
    const game = newGame({ name: 'Partida original', code: 'PO', hub: 'SSA', seed: 17 })
    openRoute(game, 'SSA', 'AJU')
    localStorage.setItem('skyline-tycoon:save:1', JSON.stringify(game))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await page.locator('button[title="Jogo"]').click()
  assert.equal(await page.locator('.modal textarea').count(), 0, 'o texto codificado saiu da tela')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar save em JSON' }).click()
  const download = await downloadPromise
  assert(download.suggestedFilename().endsWith('.json'))
  const json = JSON.parse(await readFile(await download.path(), 'utf8'))
  assert.equal(json.format, 'the-airline-simulator-save')
  assert.equal(json.game.airline.routes[0].to, 'AJU')
  assert.equal(json.game.airline.name, 'Partida original')

  const select = page.getByLabel('Selecionar arquivo de save')
  json.game.airline.name = 'Partida corrigida'
  json.game.day = 45
  await select.setInputFiles({ name: 'partida-corrigida.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) })
  await page.getByText(/partida-corrigida.json · Partida corrigida · dia 45/).waitFor()
  await page.getByRole('button', { name: 'Importar partida', exact: true }).click()
  assert(await page.getByText(/substituirá o save do Slot 1/).isVisible())
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert((await page.locator('.brand').textContent()).includes('Partida original'), 'cancelar preserva a partida')
  await page.getByRole('button', { name: 'Importar partida', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  assert((await page.locator('.brand').textContent()).includes('Partida corrigida'))
  assert.equal(await page.evaluate(async () => { const {loadGame}=await import('/src/game/save.ts');return loadGame(1).day }), 45)
  await page.locator('button[title="Jogo"]').click()
  await select.setInputFiles({ name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from('{erro') })
  await page.getByText('Arquivo de save inválido ou incompatível.').waitFor()
  assert(await page.getByRole('button', { name: 'Importar partida', exact: true }).isDisabled())
  assert((await page.locator('.brand').textContent()).includes('Partida corrigida'))
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('OK: download legível, importação confirmada, cancelamento e arquivo inválido no celular.')
} finally { await browser.close() }
