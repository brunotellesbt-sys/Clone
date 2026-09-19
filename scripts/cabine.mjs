// Confere a montagem de cabine num navegador de verdade: a trava de
// capacidade, as configurações guardadas e o que cabe num celular.
//
// As três coisas só existem na tela. A trava é fácil de escrever errado de um
// jeito que o typecheck aprova — basta o teto ser calculado com o estado velho
// e o controle passa —, e "não cabe na tela" não tem como ser visto lendo
// código: depende da fonte que o sistema resolveu usar.
import { browserPath, artifact } from './browser.mjs'
import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const erros = []
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + e.message))

const falhas = []
const conferir = (ok, oque, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${oque}${extra ? `  ${extra}` : ''}`)
  if (!ok) falhas.push(oque)
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// ------------------------------------------------------------- fundação
await page.getByPlaceholder(/sigla, cidade/).fill('GRU')
await page.waitForTimeout(300)
await page.locator('.achado').first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Decolar de GRU/ }).click()
await page.waitForTimeout(1200)

// ------------------------------------------------- cabine de fábrica
//
// Encomendar o interior na compra é a diferença entre pagar as poltronas e
// pagar poltronas mais reforma mais avião parado. O que se confere aqui é que
// o preço reage à escolha, que o avião entra com a cabine pedida e que ele
// entra voando — sem os dois a quatro dias de oficina da reconfiguração.
await page.getByRole('button', { name: 'Mercado', exact: true }).first().click()
await page.waitForTimeout(700)

const precoDaCompra = async () => {
  const txt = await page.locator('.card', { hasText: 'AQUISIÇÃO' }).first().innerText()
  const m = txt.match(/Compra à vista\s+\$([\d.,]+)\s*(mi|bi|mil)?/)
  const n = m ? parseFloat(m[1].replace(',', '.')) : 0
  return n * (m?.[2] === 'bi' ? 1e9 : m?.[2] === 'mi' ? 1e6 : m?.[2] === 'mil' ? 1e3 : 1)
}
const deSerie = await precoDaCompra()
conferir((await page.locator('.card', { hasText: 'CABINE DE FÁBRICA' }).count()) > 0,
  'o mercado oferece cabine de fábrica')
await page.getByRole('button', { name: 'Longo curso', exact: true }).click()
await page.waitForTimeout(500)
const encomendado = await precoDaCompra()
conferir(encomendado > deSerie, 'encomendar o interior sobe o preço da compra',
  `${deSerie} → ${encomendado}`)
const pedido = await page.evaluate(() => {
  const t = document.querySelector('.card .cabine')?.innerText ?? ''
  return t
})
await page.getByRole('button', { name: /^Comprar/ }).first().click()
await page.waitForTimeout(800)
conferir(pedido.length > 0, 'a cabine encomendada aparece montada na tela de compra')
await page.getByRole('button', { name: 'Frota', exact: true }).first().click()
await page.waitForTimeout(700)
// "parado" na lista é não ter voo marcado, que é o normal de um avião recém
// -comprado; quem denuncia oficina é o selo de hangar.
conferir(!/hangar/i.test(await page.locator('tbody tr.click').first().innerText()),
  'o avião encomendado entra voando, sem dia de oficina')
await page.locator('tbody tr.click').first().click()
await page.waitForTimeout(400)
conferir(/\dC|\dF|\dW/.test(await page.locator('tbody tr.click').first().innerText()),
  'ele chegou com a cabine de classes que foi encomendada')
await page.getByRole('button', { name: /Cabine/ }).first().click()
await page.waitForTimeout(700)
conferir((await page.locator('table.cabine').count()) > 0, 'a cabine abre')

const leia = () =>
  page.evaluate(() => {
    const txt = document.body.innerText
    const m = txt.match(/([\d.,]+) m de ([\d.,]+) m/)
    const p = txt.match(/(\d+) de (\d+) passageiros/)
    return {
      usado: m ? parseFloat(m[1].replace(',', '.')) : 0,
      total: m ? parseFloat(m[2].replace(',', '.')) : 0,
      pax: p ? +p[1] : 0,
      limite: p ? +p[2] : 0,
    }
  })

// ------------------------------------------------- a trava de capacidade
//
// Arrasta TODO controle de assento até o fim do curso, um por um. Se a trava
// vale, o resultado ainda cabe: nenhuma combinação de fim de curso pode
// estourar nem o comprimento nem o limite de saídas.
const barras = page.locator('table.cabine tbody tr td:nth-child(3) input[type="range"]')
const n = await barras.count()
// O avião comprado é um corredor único, e corredor único vai até a executiva:
// três controles, não quatro. Primeira classe é de fuselagem larga.
conferir(n === 3, 'o corredor único tem controle de econômica, premium e executiva', `${n}`)
const rotulos = await page.locator('table.cabine tbody tr td:first-child').allInnerTexts()
conferir(!rotulos.join(' ').includes('Primeira'),
  'e não oferece primeira classe', rotulos.map((r) => r.split('\n')[0]).join(', '))
for (let i = 0; i < n; i++) {
  const b = barras.nth(i)
  await b.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, el.max)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(250)
}
const cheio = await leia()
conferir(cheio.usado <= cheio.total + 0.05,
  'com tudo no fim do curso, ainda cabe na cabine', `${cheio.usado} m de ${cheio.total} m`)
conferir(cheio.pax <= cheio.limite,
  'com tudo no fim do curso, não passa do limite de saídas', `${cheio.pax} de ${cheio.limite}`)
conferir((await page.locator('.bad').filter({ hasText: /Não cabe|Acima do limite/ }).count()) === 0,
  'nenhum aviso de estouro, porque estourar deixou de ser possível')

// o passo também trava
const passos = page.locator('table.cabine tbody tr td:nth-child(4) input[type="range"]')
for (let i = 0; i < await passos.count(); i++) {
  await passos.nth(i).evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, el.max)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(250)
}
const esticado = await leia()
conferir(esticado.usado <= esticado.total + 0.05,
  'esticar todo o passo ao máximo também não estoura', `${esticado.usado} m de ${esticado.total} m`)
conferir(await page.getByRole('button', { name: 'Reconfigurar' }).isEnabled(),
  'o botão de aplicar continua habilitado: nada de inválido foi montado')
await page.screenshot({ path: artifact('cabine-1-trava.png'), fullPage: true })

// ------------------------------------------------ espaço para duas classes
await page.getByRole('button', { name: 'Doméstico duas classes' }).click()
await page.waitForTimeout(500)
const duas = await leia()
conferir(duas.pax >= duas.limite * 0.75,
  'duas classes aproveitam a cabine', `${duas.pax} de ${duas.limite} do certificado`)

// ------------------------------------------------ guardar e reaproveitar
await page.getByPlaceholder('nome da configuração').fill('Minha ponte aérea')
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Salvar', exact: true }).click()
await page.waitForTimeout(600)
const guardada = page.locator('.salva', { hasText: 'Minha ponte aérea' })
conferir((await guardada.count()) > 0, 'a configuração guardada aparece na lista')

// muda tudo e recarrega a guardada: tem que voltar ao que era
await page.getByRole('button', { name: 'Alta densidade' }).click()
await page.waitForTimeout(500)
const densa = await leia()
conferir(densa.pax !== duas.pax, 'trocar para alta densidade muda a cabine', `${duas.pax} → ${densa.pax}`)
await guardada.locator('button').first().click()
await page.waitForTimeout(500)
const voltou = await leia()
conferir(voltou.pax === duas.pax, 'carregar a guardada devolve a cabine salva', `${densa.pax} → ${voltou.pax}`)
await page.screenshot({ path: artifact('cabine-2-salvas.png'), fullPage: true })

// ------------------------------------------------------------ no celular
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(700)
const celular = await page.evaluate(() => {
  const m = document.querySelector('.modal')
  const alvos = [m, ...m.querySelectorAll('*')]
  let pior = 0
  let quem = ''
  for (const el of alvos) {
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    const fora = Math.max(0, Math.round(r.right - innerWidth), Math.round(-r.left))
    if (fora > pior) { pior = fora; quem = el.className || el.tagName }
  }
  return { pior, quem, rolaDeLado: Math.round(m.scrollWidth - m.clientWidth) }
})
conferir(celular.pior <= 1, 'nada do modal de cabine sai da tela do celular',
  celular.pior ? `${celular.pior}px em ${celular.quem}` : '')
conferir(celular.rolaDeLado <= 1, 'o modal não rola de lado', `${celular.rolaDeLado}px`)
const visivel = await page.locator('table.cabine tbody tr').first().isVisible()
conferir(visivel, 'as classes continuam visíveis no celular')
await page.screenshot({ path: artifact('cabine-3-celular.png'), fullPage: true })

// ------------------------------------------------------------- integridade
conferir((await page.getByText('O jogo travou aqui').count()) === 0, 'o jogo segue de pé no fim')
conferir(erros.length === 0, 'nenhum erro de página', erros.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
