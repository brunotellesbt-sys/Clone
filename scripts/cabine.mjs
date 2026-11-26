import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { browserPath, artifact } from './browser.mjs'

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const erros = []
page.on('pageerror', e => erros.push(e.message))

try {
  await page.goto(process.env.URL ?? 'http://127.0.0.1:5173/')
  await page.getByRole('button', { name: 'Decolar de GRU', exact: true }).click()
  const aba = nome => page.getByRole('button', { name: nome, exact: true }).click()
  const modal = page.locator('.modal')
  const fechar = () => modal.getByRole('button', { name: 'Fechar', exact: true }).click()
  const eco = alvo => alvo.getByLabel('Fileiras de Econômica')
  const reduzir = async (alvo, n) => {
    const fileiras = eco(alvo)
    await fileiras.fill(String(Number(await fileiras.inputValue()) - n))
  }

  await aba('Mercado')
  const mercado = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Cabine de fábrica', exact: true }) })
  const perfisMercado = mercado.getByLabel('Configuração de cabine salva')
  const preco = () => page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Aquisição', exact: true }) })
    .locator('.num').first().innerText()
  const deSerie = await preco()
  await mercado.getByLabel('Poltrona y').selectOption('eco_comfort')
  const encomendado = await preco()
  const fileirasCompradas = await eco(mercado).inputValue()
  assert.notEqual(encomendado, deSerie, 'encomendar poltronas modifica o preço')
  await aba('Comprar')
  await perfisMercado.getByRole('option', { name: /^Cabine 1/ }).waitFor({ state: 'attached' })

  await aba('Frota')
  assert.doesNotMatch(await page.locator('tbody tr.click').first().innerText(), /hangar/i)
  await aba('Cabine')
  assert.equal(await eco(modal).inputValue(), fileirasCompradas)
  assert.equal(await modal.getByLabel('Poltrona y').inputValue(), 'eco_comfort')
  assert.equal(await modal.locator('.a2-seat-card').count(), 3)
  assert.equal(await modal.getByLabel('Fileiras de Primeira').count(), 0)
  const checarCapacidade = async () => {
    const txt = await modal.innerText()
    const [, usado, total] = txt.match(/([\d.]+) m de ([\d.]+) m/)
    const [, pax, limite] = txt.match(/(\d+) de (\d+) passageiros/)
    assert(Number(usado) <= Number(total) + 0.05, 'as fileiras cabem no comprimento útil')
    assert(Number(pax) <= Number(limite), 'o limite de saídas é respeitado')
  }
  for (const classe of ['Executiva', 'Premium', 'Econômica']) {
    await modal.getByLabel(`Fileiras de ${classe}`, { exact: true }).fill('999')
    const passo = modal.getByLabel(`Passo de ${classe}`, { exact: true })
    if (await passo.isEnabled()) await passo.fill(await passo.getAttribute('max'))
    await checarCapacidade()
  }
  assert(await modal.getByRole('button', { name: 'Reconfigurar', exact: true }).isEnabled())

  await modal.getByRole('button', { name: /^Cabine 1/ }).click()
  await reduzir(modal, 1)
  const fileirasManuais = await eco(modal).inputValue()
  await modal.getByLabel('Nome da configuração').fill('Minha ponte aérea')
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()
  await reduzir(modal, 1)
  await modal.getByRole('button', { name: /^Minha ponte aérea/ }).click()
  assert.equal(await eco(modal).inputValue(), fileirasManuais)

  await page.setViewportSize({ width: 390, height: 844 })
  assert(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
  await fechar()
  await aba('Manutenção')
  await aba('Reconfiguração')
  const perfis = page.locator('table.cabin-profiles tbody tr')
  assert.equal(await perfis.count(), 2, 'compra e cadastro manual aparecem na manutenção')
  await aba('Renomear Cabine 1')
  await page.getByLabel('Novo nome da configuração').fill('Executiva Ponte Aérea')
  await aba('Salvar nome')
  await page.getByRole('button', { name: 'Renomear Executiva Ponte Aérea', exact: true }).waitFor()
  await aba('Editar cabine')
  await reduzir(modal, 2)
  await aba('Reconfigurar')
  await modal.waitFor({ state: 'hidden' })
  assert.equal(await perfis.count(), 3, 'a reforma acrescenta uma cabine diferente')
  assert(await page.getByRole('columnheader', { name: 'Assentos por classe' }).isVisible())
  assert(await page.locator('table.cabin-profiles').evaluate(table => table.scrollWidth <= table.parentElement.clientWidth + 1))
  await page.screenshot({ path: artifact('reconfiguracao-cabines-mobile.png') })

  await aba('Mercado')
  const renomeado = perfisMercado.getByRole('option', { name: /Executiva Ponte Aérea/ })
  await perfisMercado.selectOption(await renomeado.getAttribute('value'))
  assert.equal(await preco(), encomendado)
  assert.equal(await eco(mercado).inputValue(), fileirasCompradas)
  await aba('Arrendar')
  await aba('Manutenção')
  assert.equal(await perfis.count(), 3, 'arrendar com o mesmo perfil não cria cópia')
  await aba('Mercado')
  await reduzir(mercado, 3)
  await aba('Arrendar')
  await aba('Manutenção')
  assert.equal(await perfis.count(), 4, 'arrendar com uma cabine diferente acrescenta um perfil')
  assert.equal(await page.getByLabel('Aeronave da frota').getByRole('option').count(), 3)
  assert.deepEqual(erros, [])
  console.log('OK: compra, arrendamento, reforma e cadastro manual guardam cabines distintas. Renomear e reusar funciona no celular.')
} finally {
  await browser.close()
}
