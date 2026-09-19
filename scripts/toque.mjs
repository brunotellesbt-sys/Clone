// Confere o mapa num celular: pinça para aproximar e afastar, e arrasto com um
// dedo. Roda contra o `npm run dev`.
//
// Existe porque gesto de dois dedos não dá para verificar com mouse. O mapa
// tratava um ponteiro só — o segundo dedo era descartado na entrada do
// `pointermove` e o primeiro continuava arrastando, então a pinça saía como um
// arrasto trêmulo. Isso passa despercebido em qualquer teste de desktop, e é
// justamente o que um jogador de celular faz primeiro.
//
// O toque é despachado pelo protocolo do navegador (`Input.dispatchTouchEvent`),
// porque a API de alto nível do Playwright só sabe tocar com um dedo.
import { browserPath, artifact, comRelogio } from './browser.mjs'
import { chromium, devices } from 'playwright'

// o relógio do jogo anda devagar de propósito; os roteiros usam o acelerado
const URL = comRelogio(process.env.URL ?? 'http://localhost:5173/')
const browser = await chromium.launch({ executablePath: browserPath })
// um celular de verdade: toque, tela estreita e proporção alta
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

const cdp = await context.newCDPSession(page)
const toque = (type, pontos) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: pontos.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i + 1 })),
  })

/** Abre e fecha os dedos em torno do centro, em `passos` quadros. */
async function pincar(centro, de, para, passos = 12) {
  const pt = (d) => [
    { x: centro.x - d / 2, y: centro.y },
    { x: centro.x + d / 2, y: centro.y },
  ]
  await toque('touchStart', pt(de))
  for (let i = 1; i <= passos; i++) {
    await toque('touchMove', pt(de + ((para - de) * i) / passos))
    await page.waitForTimeout(24)
  }
  await toque('touchEnd', [])
  await page.waitForTimeout(220)
}

/** Arrasta com um dedo só. */
async function arrastar(de, dx, dy, passos = 10) {
  await toque('touchStart', [de])
  for (let i = 1; i <= passos; i++) {
    await toque('touchMove', [{ x: de.x + (dx * i) / passos, y: de.y + (dy * i) / passos }])
    await page.waitForTimeout(24)
  }
  await toque('touchEnd', [])
  await page.waitForTimeout(220)
}

const transform = () => page.locator('.mapwrap svg > g').first().getAttribute('transform')
const escala = async () => Number((await transform()).match(/scale\(([\d.]+)\)/)[1])
const travou = async () => (await page.getByText('O jogo travou aqui').count()) > 0

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)

const box = await page.locator('.mapwrap svg').first().boundingBox()
conferir(!!box, 'o mapa aparece na tela de celular')
const centro = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
await page.screenshot({ path: artifact('toque-1-inicio.png') })

// ------------------------------------------------------------- aproximar
const antes = await escala()
await pincar(centro, 60, 260)
const aproximou = await escala()
conferir(aproximou > antes * 1.5, 'a pinça aberta aproxima', `${antes.toFixed(2)}x → ${aproximou.toFixed(2)}x`)
conferir(!(await travou()), 'aproximar não derruba a tela')
await page.screenshot({ path: artifact('toque-2-aproximado.png') })

// --------------------------------------------------------------- afastar
await pincar(centro, 260, 70)
const afastou = await escala()
conferir(afastou < aproximou * 0.8, 'a pinça fechada afasta', `${aproximou.toFixed(2)}x → ${afastou.toFixed(2)}x`)
conferir(!(await travou()), 'afastar não derruba a tela')

// ------------------------------------------------------- arrastar com dedo
await pincar(centro, 60, 300)
const antesArrasto = await transform()
await arrastar(centro, -90, -60)
const depoisArrasto = await transform()
conferir(antesArrasto !== depoisArrasto, 'um dedo arrasta o mapa', `${antesArrasto} → ${depoisArrasto}`)
conferir(!(await travou()), 'arrastar com o dedo não derruba a tela')
await page.screenshot({ path: artifact('toque-3-arrastado.png') })

/*
 * O mundo continua preenchendo o quadro.
 *
 * É a mesma trava do arrasto de mouse, e a pinça podia furá-la por outro
 * caminho: ela move e escala no mesmo gesto, então sem passar por `limitar` o
 * mapa sairia da moldura deixando faixa preta na borda.
 */
const m = (await transform()).match(/translate\((-?[\d.]+),(-?[\d.]+)\) scale\(([\d.]+)\)/)
const [, tx, ty, k] = m.map(Number)
conferir(tx <= 0.5 && ty <= 0.5, 'a pinça não empurra o mapa para fora do quadro', `x=${tx.toFixed(0)} y=${ty.toFixed(0)}`)
conferir(k >= 1, 'e não afasta além do mundo inteiro', `${k.toFixed(2)}x`)

/*
 * Um toque só continua sendo um toque.
 *
 * A pinça marca o gesto como "andou" para o segundo dedo nunca virar clique.
 * Se essa marca não fosse zerada quando o próximo dedo desce, tocar num
 * aeroporto depois de pinçar deixaria de escolher a base — e o jogador de
 * celular ficaria sem conseguir fundar a companhia pelo mapa.
 */
await pincar(centro, 60, 240)
await page.waitForTimeout(200)
const antesToque = await page.getByRole('button', { name: /Decolar de/ }).textContent()
let escolheu = false
const marcadores = page.locator('.mapwrap svg circle[cx][fill]:not([fill="none"])')
for (let i = 0; i < Math.min(16, await marcadores.count()) && !escolheu; i++) {
  const b = await marcadores.nth(i).boundingBox()
  if (!b || b.x < box.x || b.x > box.x + box.width || b.y < box.y || b.y > box.y + box.height) continue
  const alvo = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  await toque('touchStart', [alvo])
  await toque('touchEnd', [])
  await page.waitForTimeout(320)
  escolheu = (await page.getByRole('button', { name: /Decolar de/ }).textContent()) !== antesToque
}
conferir(escolheu, 'tocar num aeroporto ainda escolhe a base depois de pinçar', antesToque)

/*
 * O botão de zoom e o gesto falam da mesma vista.
 *
 * O gesto mede contra uma cópia da vista guardada fora do React, para não
 * depender do render; os botões escreviam direto no estado e deixavam essa
 * cópia velha. O sintoma é o mapa saltar de volta no primeiro toque depois de
 * usar o botão — some o zoom que o botão tinha dado.
 */
await page.getByTitle('Aproximar').click()
await page.waitForTimeout(300)
const comBotao = await escala()
await arrastar(centro, -40, -25)
const depoisDoBotao = await escala()
conferir(
  Math.abs(depoisDoBotao - comBotao) < 0.01,
  'arrastar depois do botão de zoom não desfaz o zoom do botão',
  `${comBotao.toFixed(2)}x → ${depoisDoBotao.toFixed(2)}x`,
)

// ------------------------------------------------- pinça não vira escolha
const base = await page.getByRole('button', { name: /Decolar de/ }).textContent()
await pincar(centro, 80, 200)
conferir(
  (await page.getByRole('button', { name: /Decolar de/ }).textContent()) === base,
  'pinçar não troca a base escolhida',
)

conferir(!(await travou()), 'o jogo segue de pé no fim')
const ruins = erros.filter((e) => !/favicon|Download the React/i.test(e))
conferir(ruins.length === 0, 'nenhum erro de página', ruins.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
