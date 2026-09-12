/**
 * Mede, em pixel, onde o letreiro, o prefixo, a bandeira e a faixa caem em cada
 * aeronave.
 *
 * Existe porque "não pode ficar em cima da janela nem sair da fuselagem" é uma
 * afirmação verificável, e olhar 67 aeronaves à mão não verifica nada. O laço é
 * o mesmo das máscaras: medir, corrigir, medir de novo.
 *
 * Para cada peça imprime, em coordenadas da imagem do sprite:
 *
 *   fora   px da peça que caem fora de `fuselagemasks` (o tubo)
 *   janela px da peça que caem em cima de `windowmasks`
 *
 * Zero nas duas colunas é o alvo. O `getBBox()` do próprio SVG dá a caixa já com
 * a fonte que o navegador escolheu, então a medida é a que o jogador vê, não uma
 * estimativa de largura de glifo.
 *
 * A faixa é medida nos sete desenhos de filete, que são os que têm de ficar
 * abaixo da janela; as formas geométricas ficam de fora porque nelas cobrir a
 * fuselagem inteira **é** o desenho — e a fileira de janela é pintada depois
 * delas, por cima.
 *
 *   node scripts/textos.mjs               # todas as aeronaves do seletor
 *   node scripts/textos.mjs b748 a388     # só estas
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
}
const server = createServer((req, res) => {
  let p = join('dist', normalize(decodeURIComponent(req.url.split('?')[0])))
  if (!existsSync(p) || p.endsWith('/')) p = join('dist', 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4183, r))

const alvos = process.argv.slice(2)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
const erros = []
page.on('pageerror', (e) => erros.push(e.message))
await page.goto('http://localhost:4183/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Decolar' }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Pintura' }).click()
await page.waitForTimeout(500)

// Liga prefixo e bandeira: o pior caso é com os três desenhados.
await page.getByRole('button', { name: 'Texto', exact: true }).click()
await page.waitForTimeout(300)
for (const rot of ['Mostrar prefixo', 'Bandeira ao lado do prefixo']) {
  const t = page.getByText(rot, { exact: true })
  if (await t.count()) {
    const cb = t.locator('xpath=preceding-sibling::input[1]')
    if (await cb.count() && !(await cb.first().isChecked())) await cb.first().click()
  }
}

// A lista sai do próprio seletor da tela, e não da pasta de máscaras: quem não
// tem máscara é justamente quem mais precisa ser medido.
const ids = alvos.length
  ? alvos
  : await page.evaluate(() => [...document.querySelector('select').options].map((o) => o.value))

const linhas = []
for (const id of ids) {
  await page.selectOption('select', id)
  await page.waitForTimeout(500)
  const caixas = await page.evaluate(() => {
    const svg = document.querySelector('#livery-preview svg')
    if (!svg) return null
    const img = svg.querySelector('image')
    const w = Number(img?.getAttribute('width') ?? 0)
    const h = Number(img?.getAttribute('height') ?? 0)
    const pegar = (el) => {
      const b = el.getBBox()
      const m = el.getScreenCTM()
      const raiz = svg.getScreenCTM()
      // do espaço do elemento para o espaço do viewBox
      const conv = raiz.inverse().multiply(m)
      const pt = (x, y) => {
        const p = svg.createSVGPoint()
        p.x = x
        p.y = y
        const q = p.matrixTransform(conv)
        return [q.x, q.y]
      }
      const cantos = [pt(b.x, b.y), pt(b.x + b.width, b.y), pt(b.x, b.y + b.height), pt(b.x + b.width, b.y + b.height)]
      const xs = cantos.map((c) => c[0])
      const ys = cantos.map((c) => c[1])
      const cx = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
      // âncora e corpo da letra: com eles dá para saber quanto a caixa do
      // navegador sobe e desce em relação ao `y` que a arte pediu
      const fs = Number(el.getAttribute('font-size') ?? 0)
      if (fs) {
        cx.fs = fs
        cx.ancY = Number(el.getAttribute('y') ?? 0)
      }
      return cx
    }
    const textos = [...svg.querySelectorAll('text')].map(pegar)
    const bandeiras = [...svg.querySelectorAll('g > rect[stroke]')].filter((r) => r.getAttribute('fill') === 'none').map(pegar)
    return { w, h, textos, bandeiras }
  })
  if (!caixas) {
    linhas.push({ id, erro: 'sem svg' })
    continue
  }
  linhas.push({ id, ...caixas })
}

/**
 * Segunda passada: a faixa, no pior caso possível.
 *
 * Pior caso é a espessura no máximo e a altura no mínimo do curso — é o que o
 * jogador consegue pedir de mais alto. Se nem aí a faixa toca a fileira de
 * janela, o teto medido está fazendo o trabalho.
 */
const FILETES = ['straight', 'wide', 'double', 'wave', 'split', 'fade', 'triband']
const seletores = await page.$$('select')
const faixas = []
await page.getByRole('button', { name: 'Faixa', exact: true }).click()
await page.waitForTimeout(300)
const desenho = page.locator('select').nth(1)
const deslizar = async (rot, v) => {
  const s = page.getByText(rot, { exact: true }).locator('xpath=following::input[@type="range"][1]')
  if (await s.count()) await s.first().fill(String(v))
}
for (const id of ids) {
  await seletores[0].selectOption(id)
  await page.waitForTimeout(320)
  for (const estilo of FILETES) {
    await desenho.selectOption(estilo)
    await deslizar('Espessura', 0.5)
    await deslizar('Altura na fuselagem', 0.05)
    await page.waitForTimeout(120)
    const c = await page.evaluate(() => {
      const svg = document.querySelector('#livery-preview svg')
      const g = svg?.querySelector('[data-peca="faixa"]')
      if (!g) return null
      const img = svg.querySelector('image')
      const b = g.getBBox()
      // O `y` do retângulo de recorte é o compromisso da arte: abaixo desta
      // linha o filete pode pintar, acima não. Vale medir **ele**, e não a caixa
      // da faixa: o `getBBox` devolve a geometria antes do recorte (as opções
      // `clipped`/`fill` do SVG 2 o Chromium ignora), então a caixa acusava
      // encostar na janela uma faixa que aparece aparada.
      const rec = svg.querySelector('clipPath[id^="fj-"] rect')
      return {
        w: Number(img?.getAttribute('width') ?? 0),
        h: Number(img?.getAttribute('height') ?? 0),
        x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height,
        corte: rec ? rec.y.baseVal.value : null,
        recortado: !!g.getAttribute('clip-path'),
      }
    })
    if (c) faixas.push({ id, estilo, ...c })
  }
}

console.log(JSON.stringify({ linhas, faixas, erros }, null, 1))
await browser.close()
server.close()
