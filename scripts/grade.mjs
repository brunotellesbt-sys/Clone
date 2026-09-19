// Confere a malha num navegador de verdade: a grade semanal da aeronave, a
// lista de quem está disponível para um voo, e o encadeamento que faz a cauda
// circular em vez de ficar presa a um par de aeroportos.
//
// Existe porque a regra central da malha — "o avião só sai de onde ele está" —
// é fácil de verificar no terminal e fácil de quebrar na tela: basta a lista
// oferecer uma cauda que a gravação recusa, ou a grade desenhar o voo no dia
// errado, e o jogador passa a montar escala no escuro.
import { browserPath, artifact, comRelogio } from './browser.mjs'
import { chromium } from 'playwright'

// o relógio do jogo anda devagar de propósito; os roteiros usam o acelerado
const URL = comRelogio(process.env.URL ?? 'http://localhost:5173/')
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

// E só ela. "Dedicar uma cauda" e "Frequência" eram o jeito antigo de operar,
// de quando a rota era dona do avião: dois caminhos para a mesma coisa, com
// outro vocabulário e sem controle de horário. Saíram da tela.
for (const sumiu of ['Dedicar uma cauda', 'Frequência']) {
  conferir((await page.getByText(sumiu, { exact: false }).count()) === 0,
    `"${sumiu}" saiu da tela da rota`)
}

// a rota nasce vazia: quem marca voo é o jogador
const jaVoa = await page.locator('.horarios tbody tr').count()
conferir(jaVoa === 0, 'abrir rota não marca voo sozinho', `${jaVoa} voos`)

const disponiveis = page.locator('h4.sub', { hasText: /Disponíveis em GIG/ })
conferir((await disponiveis.count()) > 0, 'a cauda parada aparece disponível na base')

const marcar = page.getByRole('button', { name: 'Marcar', exact: true }).first()
conferir((await marcar.count()) > 0, 'há ao menos uma cauda oferecida para o voo')
await marcar.click()
await page.waitForTimeout(700)

const linhas = await page.locator('.horarios tbody tr').count()
conferir(linhas === 1, 'o voo marcado entra na lista da semana', `${jaVoa} → ${linhas}`)

// no mesmo horário a cauda está no ar: ninguém pode ser oferecido como livre
const aindaLivre = await page.getByRole('button', { name: /^Marcar/ }).count()
const motivo = await page.locator('details').innerText().catch(() => '')
conferir(
  aindaLivre === 0,
  'no mesmo horário a cauda não é oferecida de novo',
  motivo.replace(/\n/g, ' ').slice(0, 90),
)

/*
 * A volta sai de Fortaleza, e é lá que a cauda está.
 *
 * É o gesto central da malha: o jogador lê onde o avião pousou e marca a perna
 * seguinte de lá. Sem a volta, a semana não fecha e o jogo cobra voo vazio — o
 * aviso de quebra na grade some quando ela é marcada.
 */
await page.getByRole('button', { name: /FOR → GIG/ }).click()
await page.waitForTimeout(400)
await page.locator('input[type="time"]').first().fill('14:00')
await page.waitForTimeout(500)
const voltaMarcar = page.getByRole('button', { name: /^Marcar/ }).first()
conferir((await voltaMarcar.count()) > 0, 'de FOR a cauda aparece disponível para voltar')
await voltaMarcar.click()
await page.waitForTimeout(700)
const linhas2 = await page.locator('.horarios tbody tr').count()
conferir(linhas2 === 2, 'a volta entra na semana', `${linhas} → ${linhas2}`)
await page.screenshot({ path: artifact('grade-2-voos.png'), fullPage: true })

// -------------------------------------------------------- a grade semanal
await aba('Frota')
await page.waitForTimeout(600)
conferir((await page.locator('.grade-corpo').count()) > 0, 'a frota mostra a grade semanal')
// fechada a ida com a volta, a escala volta a fechar a semana e o aviso some
const quebrada = await page.locator('.aviso.erro').count()
conferir(quebrada === 0, 'com a volta marcada, a escala fecha e o aviso de quebra some')
const colunas = await page.locator('.grade-dia').count()
conferir(colunas === 7, 'a grade tem os sete dias', `${colunas}`)
const blocos = await page.locator('.grade-voo').count()
conferir(blocos === 2, 'os voos marcados aparecem como blocos na grade', `${blocos}`)
const primeiro = await page.locator('.grade-voo').first().innerText()
conferir(/GIG|FOR/.test(primeiro), 'o bloco nomeia as duas pontas do trecho', primeiro.replace(/\n/g, ' '))
await page.screenshot({ path: artifact('grade-3-semana.png'), fullPage: true })

// ----------------------------------------- mexer no voo pela própria grade
//
// Clicar no bloco **apagava** o voo, direto, sem pergunta e sem desfazer — no
// celular um toque torto custava uma perna da escala. E a grade é onde se lê o
// horário: era o único lugar do jogo que mostrava a hora e não deixava mudá-la.
// Agora o clique abre a perna, com a hora num campo e o apagar num botão com
// nome.
await page.locator('.grade-voo').first().click()
await page.waitForTimeout(500)
const editor = page.locator('.grade-editor')
conferir((await editor.count()) > 0, 'clicar no bloco abre a perna em vez de apagá-la')
conferir((await page.locator('.grade-voo').count()) === blocos,
  'e o voo continua na escala até alguém mandar tirar')

// A hora muda ali mesmo — dentro do que a escala aceita. A ida é às 08:00 e a
// volta às 14:00: 09:30 cabe, 15:20 não caberia, e recusar 15:20 é a trava da
// malha funcionando, não defeito do editor.
const campo = editor.locator('input[type=time]')
const antes = await campo.inputValue()
await campo.fill('09:30')
await page.waitForTimeout(800)
const naGrade = await page.locator('.grade-voo').first().innerText()
conferir(/09:30/.test(naGrade), 'mudar a hora no editor remarca o voo',
  `${antes} → ${naGrade.replace(/\n/g, ' ')}`)

// e o botão com nome tira
await editor.getByRole('button', { name: /Tirar/ }).click()
await page.waitForTimeout(600)
const depois = await page.locator('.grade-voo').count()
conferir(depois < blocos, 'o botão de tirar tira o voo da escala', `${blocos} → ${depois}`)

// ---------------------------------------------------- vários dias de uma vez
//
// A escolha do dia era uma lista suspensa, e marcar a mesma perna a semana
// inteira custava sete voltas por ela, pela lista de aeronaves e pelo botão —
// no celular, sete telas de menu. Agora são sete botões e um atalho, e o botão
// de marcar diz quantos dias vão junto.
//
// O que se mede é o efeito, não a aparência: com a semana inteira escolhida,
// **um** clique tem que acrescentar voo em mais de um dia. Fica no fim do
// roteiro de propósito — ele enche a grade, e desfazer isso no meio do
// caminho seria trabalho de arrumação em vez de medida.
{
  // O roteiro veio parar na tela da frota; a marcação mora na da rota. A aba
  // de rotas carrega o contador no rótulo ("Rotas 1"), então nada de exato.
  await page.locator('.nav button').filter({ hasText: 'Rotas' }).first().click()
  await page.waitForTimeout(700)
  await page.locator('tbody tr.click').first().click()
  await page.waitForTimeout(700)
  const dias = page.locator('.dias-semana button')
  conferir((await dias.count()) === 10, 'os sete dias e os três atalhos estão na tela',
    `${await dias.count()} botões`)
  const antes = await page.locator('.horarios tbody tr').count()
  await page.getByRole('button', { name: 'Todos', exact: true }).click()
  await page.waitForTimeout(400)
  const rotulo = await page.getByRole('button', { name: /^Marcar/ }).first().innerText()
  conferir(/7 dias/.test(rotulo), 'o botão de marcar diz quantos dias vão junto', rotulo)
  await page.getByRole('button', { name: /^Marcar/ }).first().click()
  await page.waitForTimeout(1000)
  const depois = await page.locator('.horarios tbody tr').count()
  conferir(depois - antes > 1, 'um clique com a semana escolhida marca mais de um dia',
    `${antes} → ${depois} voos na semana`)
  await page.screenshot({ path: artifact('grade-4-semana.png'), fullPage: true })
}

// ------------------------------------------------ a semana cabe no celular
//
// A grade rolava de lado num telefone: sete colunas de 74px mais a régua
// pediam 570px, e ver sexta-feira exigia arrastar. Comparar segunda com sexta
// é o que uma grade semanal existe para deixar fazer, então ela cabe inteira.
{
  // o roteiro terminou na tela da rota; a grade mora na da frota
  await page.locator('.nav button').filter({ hasText: 'Frota' }).first().click()
  await page.waitForTimeout(700)
  await page.locator('tbody tr.click').first().click()
  await page.waitForTimeout(700)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const c = document.querySelector('.grade-corpo')
    if (!c) return null
    const dias = [...document.querySelectorAll('.grade-dia')]
    return {
      rola: Math.round(c.parentElement.scrollWidth - c.parentElement.clientWidth),
      ultimoDentro: Math.round(dias[6].getBoundingClientRect().right) <= innerWidth + 1,
      altura: Math.round(c.getBoundingClientRect().height),
      nomes: dias.map((d) => d.querySelector('.grade-dia-nome').textContent).join(' '),
    }
  })
  conferir(m !== null, 'a grade está na tela para medir')
  if (m) {
    conferir(m.rola <= 1, 'no celular a grade não rola de lado', `${m.rola}px`)
    conferir(m.ultimoDentro, 'o sábado cabe na tela sem arrastar')
    conferir(m.altura <= 420, 'e ela não vira um poço vertical', `${m.altura}px de altura`)
    // o CSS põe em caixa alta; o texto do nó continua "Dom"
    conferir(/dom/i.test(m.nomes) && /sáb/i.test(m.nomes),
      'os sete dias continuam nomeados por extenso', m.nomes)
  }
  await page.screenshot({ path: artifact('grade-5-celular.png'), fullPage: true })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.waitForTimeout(500)
}

// ------------------------------------------------------------- integridade
conferir((await page.getByText('O jogo travou aqui').count()) === 0, 'o jogo segue de pé no fim')
conferir(erros.length === 0, 'nenhum erro de página', erros.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${falhas.length === 0 ? 'tudo certo' : `${falhas.length} falha(s)`}`)
process.exit(falhas.length ? 1 : 0)
