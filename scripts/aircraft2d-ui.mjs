import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { browserPath, artifact } from './browser.mjs'

const base = process.env.QA_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ executablePath: browserPath })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', e => { if (e.type() === 'error') errors.push(`${e.text()} ${e.location().url}`) })
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`) })
  await page.goto(`${base}/scripts/aircraft2d-preview.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelectorAll('[data-aircraft2d]').length === 63)
  assert.equal(await page.locator('[data-aircraft2d]').count(), 63)
  for (const ids of ['q200,q300,crj200,erj135,erj140,erj145,ssj100', 'a318,b712,b736,a343,a346,b744', 'a320,a320neo,b737,b77w,crj900,atr72,a388,b748', 'a220100,a319,a321,b739,a332,a359,e175,c919']) {
    await page.goto(`${base}/scripts/aircraft2d-preview.html?ids=${ids}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(n => document.querySelectorAll('[data-aircraft2d]').length === n, ids.split(',').length)
    await page.screenshot({ path: artifact(`modelos-${ids.split(',')[0]}.png`), fullPage: true })
  }
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Decolar' }).click()
  await page.getByTitle('Pausar (espaço)').click()
  await page.getByRole('button', { name: 'Pintura', exact: true }).click()
  await page.getByLabel('Aeronave da pintura').selectOption('a320')
  await page.locator('[data-aircraft2d=airbusa320]').waitFor()
  await page.getByLabel('Motor da prévia').selectOption('v2527')
  await page.getByLabel('Opção de asa').selectOption('sharklet')
  await page.getByLabel('Motor', { exact: true }).fill('#ff00aa')
  await page.getByRole('button', { name: 'Camadas originais' }).click()
  await page.getByRole('button', { name: 'NH', exact: true }).click()
  assert((await page.locator('.a2-layer input[type=checkbox]:checked').count()) > 0)
  await page.getByRole('button', { name: 'Textos e símbolos' }).click()
  await page.getByLabel('Texto da inscrição').fill('TESTE ÁEREO')
  await page.getByLabel('Fonte do ZIP').selectOption({ index: 1 })
  await page.getByLabel('Local da inscrição').selectOption('tail')
  await page.getByLabel('Símbolo do ZIP').selectOption({ index: 1 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: artifact('editor-pintura-2d.png'), fullPage: true })
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  const png = await pngDownload
  await png.saveAs(artifact('pintura-a320.png'))
  const pngData = readFileSync(artifact('pintura-a320.png')).toString('base64')
  const pixels = await page.evaluate(async data => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    const rgba = ctx.getImageData(0, 0, img.width, img.height).data
    let colored = 0, alpha = 0
    for (let i = 0; i < rgba.length; i += 4) { if (rgba[i+3] > 0) alpha++; if (rgba[i] > 200 && rgba[i+1] < 70 && rgba[i+2] > 100 && rgba[i+3] > 128) colored++ }
    return { width: img.width, alpha, colored }
  }, pngData)
  assert.equal(pixels.width, 2400)
  assert(pixels.alpha > 100000, 'PNG não contém todas as camadas')
  assert(pixels.colored > 1000, 'PNG perdeu a pintura do motor')
  const jsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar pintura do modelo' }).click()
  await (await jsonDownload).saveAs(artifact('pintura-a320.json'))
  await page.getByRole('button', { name: 'Limpar ajustes deste modelo' }).click()
  await page.getByLabel('Importar pintura 2D').setInputFiles(artifact('pintura-a320.json'))
  await page.getByRole('button', { name: 'Textos e símbolos' }).click()
  await page.getByLabel('Local da inscrição').selectOption('primary')
  assert.equal(await page.getByLabel('Texto da inscrição').inputValue(), 'TESTE ÁEREO')
  await page.getByLabel('Aeronave da pintura').selectOption('b737')
  await page.getByRole('button', { name: 'Textos e símbolos' }).click()
  assert.equal(await page.getByLabel('Texto da inscrição').inputValue(), '')
  await page.getByLabel('Aeronave da pintura').selectOption('a320')
  await page.getByRole('button', { name: 'Textos e símbolos' }).click()
  assert.equal(await page.getByLabel('Texto da inscrição').inputValue(), 'TESTE ÁEREO')
  await page.getByTitle('Jogo', { exact: true }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline-tycoon:save:1')))
  assert.equal(saved.airline.livery.aircraft2d.a320.marks.primary.text, 'TESTE ÁEREO')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Pintura', exact: true }).click()
  await page.getByLabel('Aeronave da pintura').selectOption('a320')
  await page.getByRole('button', { name: 'Textos e símbolos' }).click()
  assert.equal(await page.getByLabel('Texto da inscrição').inputValue(), 'TESTE ÁEREO')
  // Carregamento real de save anterior, seguido de reforma e recarregamento.
  const old = readFileSync(artifact('partida-antiga.json'), 'utf8')
  await page.evaluate(raw => localStorage.setItem('skyline-tycoon:save:1', raw), old)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  assert(await page.getByText(/dia 405/).count())
  await page.getByRole('button', { name: 'Frota', exact: true }).click()
  await page.getByRole('button', { name: 'Cabine', exact: true }).click()
  await page.getByRole('button', { name: 'Quatro classes', exact: true }).click()
  await page.getByLabel('Poltrona c', { exact: true }).selectOption('biz_reverse_herringbone')
  await page.getByLabel('Distribuição c', { exact: true }).selectOption('1-2-1')
  await page.getByLabel('Poltrona f', { exact: true }).selectOption('first_apartment')
  for (const [c, n] of Object.entries({ Primeira: 1, Executiva: 4, Premium: 3, Econômica: 10 })) {
    await page.getByLabel(`Fileiras de ${c}`, { exact: true }).fill(String(n))
  }
  assert.equal(await page.getByText('134 de 440 passageiros').count(), 1)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: artifact('cabine-2d.png'), fullPage: true })
  await page.locator('.a2-seatmap').screenshot({ path: artifact('mapa-assentos-2d.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.a2-seat-card').first().screenshot({ path: artifact('cabine-mobile-2d.png') })
  assert(await page.locator('.a2-seat-card').first().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'cartão de cabine transborda no celular')
  await page.setViewportSize({ width: 1500, height: 1050 })
  const button = page.getByRole('button', { name: 'Reconfigurar', exact: true })
  assert(await button.isEnabled())
  await button.click()
  await page.getByTitle('Jogo', { exact: true }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline-tycoon:save:1')))
  assert.equal(after.airline.fleet[0].seatConfig.c.layout, '1-2-1')
  assert.equal(after.airline.fleet[0].seatConfig.f.style, 'first_apartment')
  assert(after.airline.cash < JSON.parse(old).airline.cash)
  assert.equal(after.airline.fleet[0].groundedUntil, 409)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Frota', exact: true }).click()
  await page.getByRole('button', { name: 'Cabine', exact: true }).click()
  assert.equal(await page.getByLabel('Poltrona c', { exact: true }).inputValue(), 'biz_reverse_herringbone')
  assert.equal(await page.getByLabel('Distribuição c', { exact: true }).inputValue(), '1-2-1')
  // Comprar de verdade pela interface evita cadastrar aviões que só funcionam via engine.
  await page.evaluate(raw => localStorage.setItem('skyline-tycoon:save:1', raw), readFileSync(artifact('partida-catalogo.json'), 'utf8'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  if (await page.getByTitle('Pausar (espaço)').count()) await page.getByTitle('Pausar (espaço)').click()
  await page.getByRole('button', { name: 'Mercado', exact: true }).click()
  const acquisitions = [
    ['q200', 'bombardierq200'], ['q300', 'bombardierq300'], ['crj200', 'bombardiercrj200'],
    ['erj135', 'embraere135'], ['erj140', 'embraere140'], ['erj145', 'embraere145'],
    ['ssj100', 'sukhoisuperjet100'], ['a318', 'airbusa318', 'PW6124A'],
    ['b712', 'boeing717200'], ['b736', 'boeing737600'], ['a343', 'airbusa340300'],
    ['a346', 'airbusa340600'], ['b744', 'boeing747400', 'RB211-524G'],
  ]
  for (const [index, [id, source, engine]] of acquisitions.entries()) {
    await page.getByLabel('Buscar aeronave').fill(id)
    const rows = page.locator('tbody tr')
    assert.equal(await rows.count(), 1, `${id}: busca deve encontrar somente o modelo escolhido`)
    await rows.first().click()
    await page.locator(`[data-aircraft2d=${source}]`).waitFor()
    if (engine) {
      await page.getByRole('button', { name: new RegExp(engine) }).click()
      await page.waitForFunction(name => [...document.querySelectorAll('.opt.on')].some(el => el.textContent.includes(name)), engine)
    }
    if (id === 'q200') assert.match(await page.locator('.opt.on').innerText(), /shp · hélice/)
    const buy = page.getByRole('button', { name: index % 2 ? 'Arrendar' : 'Comprar', exact: true })
    assert(await buy.isEnabled(), `${id}: aquisição indisponível`)
    if (id === 'b744') {
      await page.setViewportSize({ width: 1500, height: 1400 })
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: artifact('mercado-classicos.png'), fullPage: true })
    }
    await buy.click()
  }
  await page.getByLabel('Buscar aeronave').fill('nenhum-modelo-xyz')
  assert(await page.getByText('Nenhuma aeronave corresponde à busca nesta categoria.').isVisible())
  await page.getByTitle('Jogo', { exact: true }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  const catalogue = await page.evaluate(() => JSON.parse(localStorage.getItem('skyline-tycoon:save:1')))
  assert.deepEqual(catalogue.airline.fleet.map(a => a.typeId), acquisitions.map(([id]) => id))
  assert.deepEqual(catalogue.airline.fleet.map(a => a.leased), acquisitions.map((_, i) => Boolean(i % 2)))
  assert.equal(catalogue.airline.fleet.find(a => a.typeId === 'a318').engineId, 'pw6124a')
  assert.equal(catalogue.airline.fleet.find(a => a.typeId === 'b744').engineId, 'rb524g')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Frota', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Cabine', exact: true }).count(), 13)
  assert.deepEqual(errors, [])
  console.log('OK: 63 modelos; camadas e variantes; PNG com fontes e motor; importação/exportação; isolamento entre modelos; save antigo e reforma persistida; 13 novos tipos comprados/arrendados no mercado e recarregados na frota. Sem erros de console/rede.', pixels)
} catch (error) {
  console.error('Erros do navegador:', errors)
  throw error
} finally { await browser.close() }
