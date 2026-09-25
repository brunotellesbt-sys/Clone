// Confere o mapa num navegador de verdade: arrasto, zoom, arrasto com zoom,
// clique no avião e escolha de base. Roda contra o `npm run dev`.
//
// Existe porque o travamento ao arrastar só aparecia com os eventos de ponteiro
// chegando colados — reproduzir na mão não pega, e "parece que funciona" não
// serve para um defeito que apagava a tela do jogador.
import { browserPath, artifact, comRelogio } from './browser.mjs'
import { chromium } from 'playwright'

/*
 * Este roteiro precisa **ver** o avião cruzar o mapa, então ele não usa o
 * acelerador cheio dos outros: com o dia em 900 ms o marcador pisca por cem
 * milissegundos e a varredura vira sorteio. Cento e vinte põe o dia em trinta
 * segundos, que é o passo em que a animação do mapa foi desenhada.
 */
const URL = comRelogio(process.env.URL ?? 'http://localhost:5173/', 120)
const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const erros = []
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + e.message))

const falhas = []
const conferir = (ok, oque) => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${oque}`)
  if (!ok) falhas.push(oque)
}
const transform = () => page.locator('.mapwrap svg > g').first().getAttribute('transform')
const travou = async () => (await page.getByText('O jogo travou aqui').count()) > 0

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// ---------------------------------------------------------------- fundação
conferir((await page.getByPlaceholder(/sigla, cidade/).count()) > 0, 'a base se escolhe por busca, não por lista suspensa')

await page.getByPlaceholder(/sigla, cidade/).fill('SDU')
await page.waitForTimeout(250)
await page.locator('.achado').first().click()
await page.waitForTimeout(700)
conferir((await page.getByRole('button', { name: /Decolar de SDU/ }).count()) > 0, 'Santos Dumont aceito como base')
await page.screenshot({ path: artifact('mapa-1-fundacao.png') })

const box = await page.locator('.mapwrap svg').first().boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// clicar num aeroporto do mapa escolhe a base
await page.mouse.move(cx, cy)
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -260); await page.waitForTimeout(80) }
const antesZoom = await transform()
conferir(/scale\((?!1\))/.test(antesZoom ?? ''), `a roda aproxima (${antesZoom})`)

// zoom fundo: a roda tem que passar de 9, que era o teto antigo
for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, -260); await page.waitForTimeout(40) }
const fundo = Number((await transform()).match(/scale\(([\d.]+)\)/)[1])
conferir(fundo > 9, `o zoom passa do teto antigo (${fundo.toFixed(1)}x)`)
await page.screenshot({ path: artifact('mapa-0-zoom.png') })
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(40) }

// ------------------------------------------------------- arrasto com zoom
const arrastar = async (dx, dy, soltarFora) => {
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let s = 1; s <= 10; s++) await page.mouse.move(cx + (dx * s) / 10, cy + (dy * s) / 10)
  if (soltarFora) await page.mouse.move(box.x + box.width + 140, box.y - 110)
  await page.mouse.up()
  await page.waitForTimeout(140)
}

const antes = await transform()
await arrastar(-170, -90, false)
const depois = await transform()
conferir(antes !== depois, `arrastar com zoom move o mapa (${antes} → ${depois})`)
conferir(!(await travou()), 'arrastar não derruba a tela')
await page.screenshot({ path: artifact('mapa-2-arrasto.png') })

// ida e volta: tem que voltar para perto de onde estava
await arrastar(170, 90, false)
conferir(!(await travou()), 'arrastar de volta não derruba a tela')

// soltar o ponteiro fora do mapa — o caso que derrubava
for (let i = 0; i < 12 && !(await travou()); i++) await arrastar(i % 2 ? 150 : -150, i % 3 ? 80 : -80, true)
conferir(!(await travou()), 'soltar o ponteiro fora do mapa não derruba a tela')

// arrasto e zoom intercalados
for (let i = 0; i < 8 && !(await travou()); i++) {
  await page.mouse.wheel(0, i % 2 ? 220 : -220)
  await arrastar(i % 2 ? -120 : 120, 70, i % 2 === 0)
}
conferir(!(await travou()), 'zoom e arrasto intercalados não derrubam a tela')

// o mundo não sai da tela: afastado tudo, a translação volta a zero
await page.locator('.map-tools button[title="Ver o mundo todo"]').click()
await page.waitForTimeout(200)
conferir((await transform()) === 'translate(0,0) scale(1)', 'afastado, o mapa preenche o quadro')

// arrastar não pode contar como clique na base
const baseAntes = await page.getByRole('button', { name: /^Decolar de/ }).textContent()
await arrastar(-200, -120, false)
conferir(
  (await page.getByRole('button', { name: /^Decolar de/ }).textContent()) === baseAntes,
  'arrastar o mapa não troca a base escolhida',
)

// Clicar num marcador troca a base — o arrasto não pode ter roubado o clique.
// Do mundo todo: aproximado, a folga de culagem desenha marcador fora do quadro,
// e nesse o Playwright não consegue clicar.
await page.locator('.map-tools button[title="Ver o mundo todo"]').click()
await page.waitForTimeout(350)
let trocou = false
const marcadores = page.locator('.mapwrap svg circle[cx][fill]:not([fill="none"])')
for (let i = 0; i < Math.min(14, await marcadores.count()) && !trocou; i++) {
  const b = await marcadores.nth(i).boundingBox()
  if (!b || b.x < box.x || b.x > box.x + box.width || b.y < box.y || b.y > box.y + box.height) continue
  await marcadores.nth(i).click({ force: true })
  await page.waitForTimeout(250)
  trocou = (await page.getByRole('button', { name: /^Decolar de/ }).textContent()) !== baseAntes
}
conferir(trocou, 'clicar num aeroporto do mapa escolhe a base')

// ------------------------------------------------------------ dentro do jogo
// volta para GRU: daqui para a frente o teste depende de uma base conhecida
await page.getByPlaceholder(/sigla, cidade/).fill('GRU')
await page.waitForTimeout(300)
await page.locator('.achado').first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Decolar de GRU/ }).click()
await page.waitForTimeout(800)

// uma rota, para ter avião no mapa
await page.getByRole('button', { name: 'Mercado', exact: true }).click()
await page.waitForTimeout(400)
await page.getByRole('row', { name: /Embraer E190/ }).first().click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'Comprar' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Rotas' }).first().click()
await page.waitForTimeout(350)
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(500)
await page.getByPlaceholder('cidade, país ou código').fill('Recife')
await page.waitForTimeout(450)
await page.getByRole('row', { name: /REC/ }).first().click()
await page.waitForTimeout(400)
// o destino sai de menu suspenso, e a distância vem em km
const menu = page.locator('.modal select').last()
conferir((await menu.locator('option').count()) > 1, 'o destino é um menu suspenso')
conferir(/\d+ km/.test(await menu.locator('option').nth(1).textContent()), 'o menu mostra a distância em km')
await page.getByRole('button', { name: /^Abrir por/ }).click()
await page.waitForTimeout(500)
conferir(/km/.test(await page.locator('table').first().textContent()), 'a tabela de rotas mostra km')

// a rota nasce sem voo: quem marca é o jogador, e sem perna marcada não há
// avião no mapa para clicar
await page.getByRole('button', { name: 'Marcar', exact: true }).first().click()
await page.waitForTimeout(600)
conferir((await page.locator('.horarios tbody tr').count()) > 0, 'o voo marcado entra na semana')

await page.getByRole('button', { name: 'Painel', exact: true }).click()
await page.waitForTimeout(900)

// O relógio do mapa agora obedece à pausa, e o jogo nasce pausado: sem tirar da
// pausa, o mapa fica congelado nas 08:00 e o marcador só apareceria se houvesse
// um voo no ar exatamente naquele minuto.
await page.locator('.speed button').nth(1).click()
await page.waitForTimeout(400)

// O avião no mapa é uma perna da escala, e ela só está no ar durante o bloco:
// o relógio da tela roda o dia inteiro, então o marcador aparece e some. Contar
// num instante é sorteio; o que vale conferir é que ele aparece no dia.
const aviao = page.locator('.mapwrap svg g[transform*="rotate"]').first()
let apareceu = false
for (let i = 0; i < 60 && !apareceu; i++) {
  apareceu = (await aviao.count()) > 0
  if (!apareceu) await page.waitForTimeout(500)
}
conferir(apareceu, 'o avião aparece no mapa em algum momento do dia')
conferir(/\d{2}:\d{2} em \w{3}/.test(await page.locator('.map-legend').innerText()),
  'a legenda mostra a hora que os aviões estão seguindo')
// Pausa para clicar: com o relógio correndo, entre achar o marcador e clicar
// nele o voo já pousou e o clique cai no vazio. É o que um jogador faz também.
await page.locator('.speed button').first().click()
await page.waitForTimeout(300)
await aviao.click({ force: true })
await page.waitForTimeout(400)
conferir((await page.locator('.map-card').count()) > 0, 'clicar no avião abre o cartão do voo')
conferir((await page.locator('.mapwrap path[stroke-dasharray]').count()) > 0, 'o que falta do trajeto sai pontilhado')

/*
 * O traçado só existe enquanto o voo está no ar.
 *
 * Ele é desenhado a partir do voo escolhido, e o voo escolhido é uma perna da
 * escala: quando ela pousa, sai da lista dos que estão no ar e o traçado vai
 * junto. A seleção é solta no pouso pelo mesmo motivo — sem isso ela ficava
 * guardada e a linha voltava sozinha na volta seguinte do relógio, sem ninguém
 * ter clicado em nada.
 */
await page.locator('.speed button').nth(1).click()
await page.waitForTimeout(300)
let pousou = false
for (let i = 0; i < 60 && !pousou; i++) {
  pousou = (await page.locator('.map-card').count()) === 0
  if (!pousou) await page.waitForTimeout(400)
}
conferir(pousou, 'ao pousar, o cartão do voo se fecha sozinho')
conferir((await page.locator('.mapwrap path[stroke-dasharray]').count()) === 0,
  'e o traçado some com ele: linha só enquanto o voo está no ar')
await page.screenshot({ path: artifact('mapa-3-trajeto.png') })
await page.locator('.speed button').first().click()
await page.getByLabel('Aeroporto GRU', { exact: true }).click({ force: true })
await page.locator('.map-airport-card.hub').waitFor()
conferir((await page.locator('.map-airport-card.hub').count()) === 1, 'clicar na base abre painel de aeroporto destacado')
conferir(/Seus voos.*hora local/is.test(await page.locator('.map-airport-card').innerText()), 'painel do aeroporto mostra os voos na hora local')
await page.screenshot({ path: artifact('mapa-4-aeroporto.png') })
conferir(!(await travou()), 'o jogo segue de pé no fim')

const ruins = erros.filter((e) => !/favicon|Download the React/i.test(e))
if (ruins.length) console.log('\nconsole:', ruins.slice(0, 8).map((e) => e.slice(0, 200)))
conferir(!ruins.some((e) => e.startsWith('PAGEERROR')), 'nenhum erro de página')

await browser.close()
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo')
process.exit(falhas.length ? 1 : 0)
