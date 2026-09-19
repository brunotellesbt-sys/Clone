// Confere a lista de destinos da abertura de rota, num navegador de verdade:
// quantas linhas cabem sem rolar, e o menu de porte.
//
// As duas coisas que este script mede são as que não dá para ver lendo o código:
// altura em pixel depende da fonte que o sistema resolveu usar, e recorte de
// menu depende do `overflow` do contêiner que rola. O menu de porte já nasceu
// `absolute` dentro de um `overflow: auto` e aparecia pela metade na última
// linha visível — que é justamente onde o jogador mais desce para olhar.
import { browserPath, artifact } from './browser.mjs'
import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
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
await page.getByPlaceholder(/sigla, cidade/).fill('GIG')
await page.waitForTimeout(250)
await page.locator('.achado').first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Decolar de GIG/ }).click()
await page.waitForTimeout(900)

await page.getByRole('button', { name: 'Rotas', exact: true }).first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(800)

// ----------------------------------------------------- quantas linhas cabem
const cabem = await page.evaluate(() => {
  const caixa = document.querySelector('.lista-destinos')
  const corpo = caixa.getBoundingClientRect()
  const cabeca = caixa.querySelector('thead').getBoundingClientRect()
  let n = 0
  for (const tr of caixa.querySelectorAll('tbody tr')) {
    const r = tr.getBoundingClientRect()
    // inteira, e abaixo do cabeçalho grudado
    if (r.top >= cabeca.bottom - 1 && r.bottom <= corpo.bottom + 1) n++
  }
  return { n, altura: Math.round(corpo.height) }
})
conferir(cabem.n === 4, 'quatro destinos por vez, não sete', `${cabem.n} linhas em ${cabem.altura}px`)

// A lista não pode rolar de lado: o que some na esquerda é a sigla do aeroporto,
// e a lista inteira existe para mostrar a sigla do aeroporto.
const lado = await page.evaluate(() => {
  const c = document.querySelector('.lista-destinos')
  return { caixa: Math.round(c.clientWidth), tabela: Math.round(c.scrollWidth) }
})
conferir(lado.tabela <= lado.caixa + 1, 'a lista não rola de lado', `${lado.tabela}px em ${lado.caixa}px`)

// --------------------------------------------------------- o menu de porte
const porte = page.locator('.lista-destinos .porte').first()
conferir((await porte.count()) > 0, 'cada destino traz o teto de porte')
const rotulo = await porte.locator('summary').innerText()
conferir(rotulo.trim().length > 2, 'o rótulo fechado nomeia a maior aeronave', rotulo.replace(/\n/g, ' '))

// abrir o da ÚLTIMA linha visível é o caso que pegava o recorte
const ultimo = page.locator('.lista-destinos tbody tr').nth(3).locator('.porte summary')
await ultimo.click()
await page.waitForTimeout(350)
const menu = page.locator('.porte-menu')
conferir((await menu.count()) === 1, 'clicar no ícone abre o menu')
const recorte = await page.evaluate(() => {
  const m = document.querySelector('.porte-menu')
  const r = m.getBoundingClientRect()
  // o ponto do meio do menu pertence ao menu? se o contêiner o cortou, não.
  const meio = document.elementFromPoint(r.left + r.width / 2, r.bottom - 6)
  return {
    dentroDaTela: r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight + 1,
    visivel: !!meio && m.contains(meio),
  }
})
conferir(recorte.visivel, 'o menu não é cortado pela lista que rola')
conferir(recorte.dentroDaTela, 'o menu cabe na tela')
const texto = (await menu.innerText()).replace(/\n/g, ' · ')
conferir(/lug|t$|t ·/.test(texto), 'o menu lista as aeronaves com a medida', texto.slice(0, 80))

// clicar no ícone não pode escolher o destino por tabela
const escolhido = await page.locator('.lista-destinos tbody tr.on').count()
conferir(escolhido === 0, 'abrir o menu não escolhe o destino sem querer')
await page.screenshot({ path: artifact('destinos-1-porte.png'), fullPage: true })

// --------------------------------------------------------- Pampulha no jogo
await page.getByPlaceholder(/cidade, país ou código/).fill('PLU')
await page.waitForTimeout(700)
const linhaPlu = page.locator('.lista-destinos tbody tr', { hasText: 'PLU' }).first()
conferir((await linhaPlu.count()) > 0, 'PLU está na lista de destinos')
await linhaPlu.locator('.porte summary').click()
await page.waitForTimeout(350)
const tetoPlu = await page.locator('.porte-menu').innerText()
conferir(
  /149 lugares/.test(tetoPlu) && !/A32[01]/.test(tetoPlu),
  'o menu de PLU mostra o teto de 149 e nenhum A320/A321',
  tetoPlu.replace(/\n/g, ' · ').slice(0, 100),
)
await page.screenshot({ path: artifact('destinos-2-plu.png'), fullPage: true })

// ------------------------------------------- o vizinho curto aparece na lista
//
// A lista escondia qualquer destino a menos de 110 km da base, e com isso
// escondia aeroporto que existe: do Galeão, Macaé são 87 nm (161 km) e Cabo
// Frio 66 nm (122 km) — a simulação mede em milha náutica, e a tela converte. O
// jogador procurava pelo nome e não achava nada — o aeroporto estava no
// catálogo, a lista é que não mostrava. Quem decide se o par vale a pena é a
// demanda, não o filtro.
for (const [termo, sigla] of [['Macae', 'MEA'], ['Cabo Frio', 'CFB'], ['Campos dos', 'CAW']]) {
  await page.getByPlaceholder(/cidade, país ou código/).fill(termo)
  await page.waitForTimeout(650)
  const achou = await page.locator('.lista-destinos tbody tr', { hasText: sigla }).count()
  conferir(achou > 0, `procurar por "${termo}" acha ${sigla} na lista`)
}
// e o irmão de metrópole continua fora: Santos Dumont fica a 8 km do Galeão
await page.getByPlaceholder(/cidade, país ou código/).fill('SDU')
await page.waitForTimeout(650)
conferir((await page.locator('.lista-destinos tbody tr', { hasText: 'SDU' }).count()) === 0,
  'o aeroporto da própria cidade continua fora da lista')

// ------------------------------------------------------------- no celular
//
// A medida do `npm run mobile` é a da página, e ela passa mesmo quando a tabela
// transborda dentro da própria caixa que rola — foi assim que o destino virou
// uma letra só num telefone sem nenhum teste reclamar.
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(600)
await page.getByPlaceholder(/cidade, país ou código/).fill('')
await page.waitForTimeout(700)
const noCelular = await page.evaluate(() => {
  const c = document.querySelector('.lista-destinos')
  const primeira = c.querySelector('tbody td:first-child')
  return {
    caixa: Math.round(c.clientWidth),
    tabela: Math.round(c.scrollWidth),
    destino: Math.round(primeira.getBoundingClientRect().width),
    colunas: c.querySelectorAll('thead th:not([hidden])').length,
    porte: !!c.querySelector('tbody .porte'),
  }
})
conferir(noCelular.tabela <= noCelular.caixa + 1, 'no celular a tabela cabe na caixa',
  `${noCelular.tabela}px em ${noCelular.caixa}px`)
conferir(noCelular.destino >= 140, 'no celular a sigla e a cidade ainda cabem',
  `${noCelular.destino}px para o destino`)
conferir(noCelular.porte, 'no celular o porte continua na lista')
await page.screenshot({ path: artifact('destinos-3-celular.png'), fullPage: true })
await page.setViewportSize({ width: 1600, height: 1000 })

// ------------------------------------------------------------- integridade
conferir((await page.getByText('O jogo travou aqui').count()) === 0, 'o jogo segue de pé no fim')
conferir(erros.length === 0, 'nenhum erro de página', erros.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
