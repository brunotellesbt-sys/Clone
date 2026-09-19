// Mede o transbordo horizontal de cada tela num celular. Roda contra o
// `npm run dev`.
//
// O pedido era claro: no celular só se rola para baixo, nunca para o lado. Isso
// é medível, e medir é o único jeito de não ficar caçando o vazamento a olho —
// basta um elemento com largura fixa maior que a tela para a página inteira
// começar a deslizar, e a lista abaixo diz qual é.
//
// A régua é a largura de rolagem contra a largura visível. Tabela larga dentro
// da própria caixa de rolagem não conta: ali o dedo rola a tabela, não a
// interface, que é o comportamento que se quer.
import { browserPath, artifact } from './browser.mjs'
import { chromium, devices } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: browserPath })
const context = await browser.newContext({ ...devices['Pixel 7'] })
const page = await context.newPage()
const erros = []
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + e.message))

const falhas = []
const conferir = (ok, oque, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${oque}${extra ? `  ${extra}` : ''}`)
  if (!ok) falhas.push(oque)
}

/**
 * Quem está passando da largura da tela.
 *
 * Varre os elementos e devolve os que terminam além da borda direita do corpo,
 * ignorando quem está dentro de uma caixa que rola sozinha — essa é a saída
 * legítima para tabela larga.
 */
async function vazamentos() {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    const tela = document.documentElement.clientWidth
    /**
     * O retângulo que sobra depois dos recortes dos ancestrais.
     *
     * A primeira versão descartava qualquer elemento com um ancestral
     * `overflow: hidden` — e `body` tem um, então ela descartava tudo e dava
     * verde numa tela visivelmente cortada. O que importa não é existir
     * recorte, é o que continua **aparecendo** fora da tela depois dele.
     *
     * `main` é a exceção: ele rola, mas rolar `main` para o lado é exatamente o
     * que não se quer no celular. Então ele não conta como saída legítima — só
     * caixa menor, como uma tabela larga com rolagem própria.
     */
    const visivel = (el) => {
      const r = el.getBoundingClientRect()
      let [x0, x1] = [r.left, r.right]
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const s = getComputedStyle(p)
        const pr = p.getBoundingClientRect()
        /*
         * Caixa que rola sozinha resolve o transbordo dela — **desde que ela
         * mesma caiba na tela**. Uma tabela larga dentro de uma caixa que
         * também transborda não está resolvida: as duas juntas arrastam a
         * página, que é o que não se quer.
         */
        if (p !== main && /(auto|scroll)/.test(s.overflowX) && pr.right <= tela + 1 && pr.left >= -1) return null
        if (p === main || s.overflowX === 'visible') continue
        x0 = Math.max(x0, pr.left)
        x1 = Math.min(x1, pr.right)
      }
      return x1 > x0 ? [x0, x1] : null
    }
    const vistos = []
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      const v = visivel(el)
      if (!v) continue
      // largura pedida, não a recortada: é ela que empurra a rolagem de `main`.
      // A própria rolagem interna só conta em quem não foi feito para rolar.
      const rola = /(auto|scroll)/.test(getComputedStyle(el).overflowX)
        ? 0 : el.scrollWidth - el.clientWidth
      const passa = Math.max(v[1] - tela, -v[0], rola)
      if (passa <= 1) continue
      // `main` é a vítima, não o culpado: quem o alarga é o que está dentro
      if (el === main) continue
      vistos.push(el)
      out.push({
        el,
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 40),
        txt: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 26),
        passa: Math.round(passa),
      })
    }
    /*
     * O culpado é o **mais fundo**, não o mais de fora.
     *
     * Um `div.wrap` aparece largo porque alguma coisa lá dentro o empurra, e
     * apontar para ele não diz nada. Quem não tem descendente vazando é quem
     * tem largura própria demais — é nele que se mexe.
     */
    return out
      .filter((o) => !out.some((x) => x !== o && o.el.contains(x.el)))
      .slice(0, 6)
      .map(({ el, ...r }) => r)
  })
}

async function medir(nome) {
  await page.waitForTimeout(450)
  const largura = await page.evaluate(() => {
    const m = document.querySelector('main') ?? document.body
    return {
      rola: Math.round(m.scrollWidth),
      cabe: Math.round(m.clientWidth),
      corpo: Math.round(document.documentElement.scrollWidth),
      tela: Math.round(document.documentElement.clientWidth),
    }
  })
  const folga = Math.max(largura.rola - largura.cabe, largura.corpo - largura.tela)
  // a rolagem lateral é só metade: conteúdo centralizado mais largo que a tela
  // não rola, ele some pelos dois lados — foi assim que o modal ficou cortado
  const vaza = await vazamentos()
  conferir(
    folga <= 1 && vaza.length === 0,
    `${nome}: cabe na largura da tela`,
    folga > 1 ? `rola ${folga}px para o lado` : vaza.length ? `${vaza.length} elemento(s) fora` : '',
  )
  for (const v of vaza) console.log(`       ↳ +${v.passa}px  ${v.tag}.${v.cls}  "${v.txt}"`)
  return folga
}

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)

// ------------------------------------------------------------- fundação
await medir('fundação')
await page.screenshot({ path: artifact('mobile-1-fundacao.png'), fullPage: true })
// Santos Dumont: é a base do relato, e de lá Congonhas é rota de verdade — de
// Guarulhos ela nem aparece na lista, porque tem 25 km
await page.getByPlaceholder(/sigla, cidade/).fill('SDU')
await page.waitForTimeout(400)
await page.locator('.achado').first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: /Decolar de/ }).click()
await page.waitForTimeout(1000)

// compra uma aeronave e abre uma rota, para as telas terem conteúdo de verdade
const aba = async (nome) => {
  // a aba de rotas carrega o contador no rótulo ("Rotas 3"), então nada de exato
  await page.locator('.nav button').filter({ hasText: nome }).first().click()
  await page.waitForTimeout(700)
}
await aba('Mercado')
await page.getByRole('button', { name: /^Comprar/ }).first().click()
await page.waitForTimeout(700)
await aba('Rotas')
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(600)
await medir('modal de abrir rota')
await page.screenshot({ path: artifact('mobile-2-modal.png'), fullPage: true })
await page.getByPlaceholder(/cidade, país ou código/).fill('CGH')
await page.waitForTimeout(700)
const destino = page.locator('.modal select').last()
await destino.selectOption({ index: 1 })
await page.waitForTimeout(600)
await medir('modal com destino escolhido')
await page.screenshot({ path: artifact('mobile-3-modal-destino.png'), fullPage: true })
await page.getByRole('button', { name: /^Abrir por/ }).click()
await page.waitForTimeout(900)

// ------------------------------------------------------------ cada tela
for (const nome of ['Painel', 'Rotas', 'Frota', 'Mercado', 'Finanças', 'Pintura', 'Ranking']) {
  await aba(nome)
  await medir(nome)
  await page.screenshot({ path: artifact(`mobile-tela-${nome.toLowerCase()}.png`), fullPage: true })
}

/*
 * As subtelas também.
 *
 * Medir as sete abas dava verde e o jogador continuava achando tela cortada, e
 * o motivo é simples: metade do jogo não está na primeira dobra de uma aba. O
 * editor de pintura tem seis seções e só a primeira era medida; a cabine é um
 * modal que nenhuma aba abre sozinha; a grade da frota e os horários da rota só
 * aparecem com algo selecionado. Tela que não é aberta não é medida, e tela que
 * não é medida é onde o defeito mora.
 */
await aba('Pintura')
/*
 * As seções da pintura dependem do modelo: com arte 2D o jogo mostra o editor
 * 2D (quatro abas), e sem ela o vetorial (seis seções). Mede as que existirem —
 * listar só um dos dois deixaria metade do editor sem medida, que foi como o
 * emblema passou 63 modelos sem controle nenhum e ninguém notou.
 */
for (const secao of [
  'Cores e peças', 'Camadas originais', 'Textos e símbolos', 'Acervo do ZIP',
  'Fuselagem', 'Faixa', 'Cauda e emblema', 'Bordos da asa', 'Texto', 'Detalhes',
]) {
  const b = page.getByRole('button', { name: secao, exact: true }).first()
  if (!(await b.count())) continue
  await b.click()
  await page.waitForTimeout(450)
  await medir(`Pintura · ${secao}`)
}

await aba('Frota')
const linhaFrota = page.locator('tbody tr.click').first()
if (await linhaFrota.count()) {
  await linhaFrota.click()
  await page.waitForTimeout(600)
  await medir('Frota · aeronave selecionada')
  await page.screenshot({ path: artifact('mobile-tela-frota-detalhe.png'), fullPage: true })
  const cabine = page.getByRole('button', { name: /Cabine/ }).first()
  if (await cabine.count()) {
    await cabine.click()
    await page.waitForTimeout(800)
    await medir('modal de cabine')
    await page.screenshot({ path: artifact('mobile-modal-cabine.png'), fullPage: true })
    await page.getByRole('button', { name: 'Fechar' }).first().click()
    await page.waitForTimeout(400)
  }
}

await aba('Rotas')
const linhaRota = page.locator('tbody tr.click').first()
if (await linhaRota.count()) {
  await linhaRota.click()
  await page.waitForTimeout(600)
  await medir('Rotas · rota selecionada')
  await page.screenshot({ path: artifact('mobile-tela-rota-detalhe.png'), fullPage: true })
}

conferir((await page.getByText('O jogo travou aqui').count()) === 0, 'o jogo segue de pé no fim')
const ruins = erros.filter((e) => !/favicon|Download the React/i.test(e))
conferir(ruins.length === 0, 'nenhum erro de página', ruins.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
