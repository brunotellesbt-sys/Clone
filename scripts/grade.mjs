// Confere a malha num navegador de verdade: a grade semanal da aeronave, a
// lista de quem está disponível para um voo, e o encadeamento que faz a cauda
// circular em vez de ficar presa a um par de aeroportos.
//
// Existe porque a regra central da malha — "o avião só sai de onde ele está" —
// é fácil de verificar no terminal e fácil de quebrar na tela: basta a lista
// oferecer uma cauda que a gravação recusa, ou a grade desenhar o voo no dia
// errado, e o jogador passa a montar escala no escuro.
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

// --------------------------------------------------------- compra e rota
const aba = async (nome) => {
  await page.getByRole('button', { name: nome, exact: true }).first().click()
  await page.waitForTimeout(600)
}

await aba('Mercado')
// o primeiro narrowbody que o mercado oferece serve: o que se testa é a escala
const comprar = page.getByRole('button', { name: /^Comprar/ }).first()
await comprar.click()
await page.waitForTimeout(700)

await aba('Rotas')
await page.getByRole('button', { name: 'Abrir rota' }).click()
await page.waitForTimeout(500)
await page.getByPlaceholder(/cidade, país ou código/).fill('FOR')
await page.waitForTimeout(600)
await page.locator('.scroll tbody tr').first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Abrir por/ }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: artifact('grade-1-rota.png'), fullPage: true })

// ------------------------------------------------------- marcar um voo
conferir((await page.getByText('Marcar voo').count()) > 0, 'a rota abre com a tela de marcar voo')
const disponiveis = page.locator('h4.sub', { hasText: /Disponíveis em GIG/ })
conferir((await disponiveis.count()) > 0, 'a lista diz quem está disponível na base')

const marcar = page.getByRole('button', { name: 'Marcar', exact: true }).first()
conferir((await marcar.count()) > 0, 'há ao menos uma cauda oferecida para o voo')
await marcar.click()
await page.waitForTimeout(700)

const linhas = await page.locator('.horarios tbody tr').count()
conferir(linhas >= 1, 'o voo marcado aparece na lista da semana', `${linhas} linha(s)`)

// no mesmo horário a cauda está no ar: ninguém pode ser oferecido como livre
const aindaLivre = await page.getByRole('button', { name: 'Marcar', exact: true }).count()
const motivo = await page.locator('details').innerText().catch(() => '')
conferir(
  aindaLivre === 0,
  'no mesmo horário a cauda não é oferecida de novo',
  motivo.replace(/\n/g, ' ').slice(0, 90),
)

// ------------------------------------------ o voo de volta sai de Fortaleza
await page.getByRole('button', { name: /FOR → GIG/ }).click()
await page.waitForTimeout(400)
await page.locator('input[type="time"]').first().fill('14:00')
await page.waitForTimeout(500)
const voltaMarcar = page.getByRole('button', { name: 'Marcar', exact: true }).first()
conferir((await voltaMarcar.count()) > 0, 'de FOR a cauda aparece disponível para voltar')
await voltaMarcar.click()
await page.waitForTimeout(700)
const linhas2 = await page.locator('.horarios tbody tr').count()
conferir(linhas2 > linhas, 'a volta entra na semana', `${linhas} → ${linhas2}`)
await page.screenshot({ path: artifact('grade-2-voos.png'), fullPage: true })

// -------------------------------------------------------- a grade semanal
await aba('Frota')
await page.waitForTimeout(600)
conferir((await page.locator('.grade-corpo').count()) > 0, 'a frota mostra a grade semanal')
const colunas = await page.locator('.grade-dia').count()
conferir(colunas === 7, 'a grade tem os sete dias', `${colunas}`)
const blocos = await page.locator('.grade-voo').count()
conferir(blocos >= 2, 'os voos marcados aparecem como blocos na grade', `${blocos}`)
const primeiro = await page.locator('.grade-voo').first().innerText()
conferir(/GIG|FOR/.test(primeiro), 'o bloco nomeia as duas pontas do trecho', primeiro.replace(/\n/g, ' '))
await page.screenshot({ path: artifact('grade-3-semana.png'), fullPage: true })

// tirar um voo pela grade
await page.locator('.grade-voo').first().click()
await page.waitForTimeout(600)
const depois = await page.locator('.grade-voo').count()
conferir(depois < blocos, 'clicar no bloco tira o voo da escala', `${blocos} → ${depois}`)

// ------------------------------------------------------------- integridade
conferir((await page.getByText('O jogo travou aqui').count()) === 0, 'o jogo segue de pé no fim')
conferir(erros.length === 0, 'nenhum erro de página', erros.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
