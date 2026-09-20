/**
 * Confere o escopo dos aeroportos contra casos conhecidos da vida real.
 *
 * O escopo é índice de jogo derivado de dois sinais fracos — o degrau e a
 * palavra "internacional" no nome oficial — mais uma lista à mão. Derivação
 * assim envelhece mal e em silêncio: mudar o degrau de um aeroporto muda o que
 * ele aceita, e ninguém percebe. Esta tabela é o que segura isso.
 */
import { AIRPORTS, AIRPORT_BY_IATA, ESCOPO_LABEL, vooPermitido, type Escopo } from '../src/game/data/airports'
import { baseDemand } from '../src/game/demand'
import { AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { aeroportoServe } from '../src/game/spec'

/** O que cada aeroporto deve ser, e por quê. */
const ESPERADO: [string, Escopo, string][] = [
  ['CGH', 'dom', 'Congonhas perdeu a alfândega para Guarulhos em 1985'],
  ['SDU', 'dom', 'Santos Dumont não opera com aeroporto internacional'],
  ['AEP', 'reg', 'Aeroparque: cabotagem mais regional'],
  ['IGU', 'reg', 'Foz do Iguaçu: internacional de fronteira'],
  // O nome da OurAirports é "Cabo Frio Airport", sem a palavra que o escopo
  // procura — e por isso ele saía doméstico. É Internacional de Cabo Frio,
  // com alfândega, linha da Aerolíneas de Buenos Aires e 747 já recebido.
  ['CFB', 'int', 'Cabo Frio: internacional que o nome público não declara'],
  ['LCY', 'reg', 'London City: pista curta, alfândega de curto curso'],
  ['GRU', 'int', 'Guarulhos'],
  ['GIG', 'int', 'Galeão'],
  ['BSB', 'int', 'Brasília'],
  ['VCP', 'int', 'Viracopos'],
  ['CNF', 'int', 'Confins'],
  ['LHR', 'int', 'Heathrow'],
  ['CDG', 'int', 'Charles de Gaulle'],
  ['JFK', 'int', 'Kennedy'],
  ['MIA', 'int', 'Miami'],
  ['LIS', 'int', 'Lisboa'],
  ['HND', 'int', 'Haneda, de volta ao longo curso desde 2010'],
]

/** Pares que têm que passar, e pares que têm que ser barrados. */
const PARES: [string, string, boolean, string][] = [
  ['SDU', 'CGH', true, 'ponte aérea: doméstico entre dois domésticos'],
  ['CGH', 'BSB', true, 'doméstico até um internacional, dentro do país'],
  ['SDU', 'AEP', false, 'Santos Dumont não faz internacional'],
  ['CGH', 'AEP', false, 'Congonhas não faz internacional'],
  ['AEP', 'GRU', true, 'Aeroparque–São Paulo: regional dentro da América do Sul'],
  ['AEP', 'SCL', true, 'Aeroparque–Santiago: regional'],
  ['AEP', 'MIA', false, 'Aeroparque não sai da América do Sul'],
  ['IGU', 'LIS', false, 'Foz do Iguaçu não atravessa o Atlântico'],
  ['GRU', 'LHR', true, 'internacional com internacional'],
  ['GRU', 'MIA', true, 'internacional com internacional'],
]

let falhas = 0
console.log('escopo de cada aeroporto\n')
for (const [iata, esperado, porque] of ESPERADO) {
  const a = AIRPORT_BY_IATA[iata]
  const ok = a?.escopo === esperado
  if (!ok) falhas++
  console.log(
    `${ok ? 'ok   ' : 'FALHA'} ${iata}  ${(a ? ESCOPO_LABEL[a.escopo] : 'ausente').padEnd(15)}` +
      `${ok ? '' : `esperado ${ESCOPO_LABEL[esperado]}  `}${porque}`,
  )
}

console.log('\npares de rota\n')
for (const [x, y, deveriaPassar, porque] of PARES) {
  const motivo = vooPermitido(AIRPORT_BY_IATA[x], AIRPORT_BY_IATA[y])
  const ok = deveriaPassar === !motivo
  if (!ok) falhas++
  console.log(
    `${ok ? 'ok   ' : 'FALHA'} ${x}-${y}  ${(motivo ? 'barrado' : 'passa').padEnd(9)}${porque}` +
      (motivo && !deveriaPassar ? '' : motivo ? `\n         ${motivo}` : ''),
  )
}

// --------------------------------------------------- tabelas de dados velhas
//
// O `K` da demanda já mudou uma vez depois dos fatores de Furness terem sido
// calculados, e ninguém rodou `npm run fluxo` de novo: as razões que eram 2,6 a
// 3,7 viraram 4,1 a 5,4 e o PR foi mergeado assim. Tabela derivada envelhece em
// silêncio; esta amostra é o barulho.
console.log('\nequilíbrio do fluxo\n')
const AMOSTRA = ['GRU', 'CGH', 'VCP', 'SDU', 'LHR', 'ATL', 'REC', 'LIS', 'NRT', 'JNB']
const ALVO = 3
const razoes: number[] = []
for (const iata of AMOSTRA) {
  const base = AIRPORT_BY_IATA[iata]
  if (!base) continue
  let soma = 0
  for (const b of AIRPORTS) {
    if (b.iata === iata || vooPermitido(base, b)) continue
    soma += baseDemand(iata, b.iata, 0, 180).total
  }
  const razao = soma / base.paxDia
  razoes.push(razao)
  const ok = razao > ALVO * 0.6 && razao < ALVO * 1.6
  if (!ok) falhas++
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${iata}  razão ${razao.toFixed(2)} (alvo ${ALVO})`)
}
const media = razoes.reduce((s, r) => s + r, 0) / Math.max(1, razoes.length)
const perto = Math.abs(media / ALVO - 1) < 0.35
if (!perto) falhas++
console.log(
  `${perto ? 'ok   ' : 'FALHA'} média ${media.toFixed(2)}` +
    (perto ? '' : ' — rode `npm run fluxo` e cole a tabela em movimento.ts'),
)

// ------------------------------------------------- o teto não pode achatar
//
// O teto do par existe para nenhuma ligação passar do que a ponta menor move.
// Enquanto ele era um `Math.min`, dois pares que o encostavam saíam idênticos:
// de Santos Dumont, Congonhas e Guarulhos davam os mesmos 13.955 passageiros,
// embora Guarulhos mova o dobro de Congonhas. A trava aqui é a **ordem**, que é
// o que o jogador lê na tela.
console.log('\nteto do par não achata a ordem\n')
{
  const par = (x: string, y: string) => baseDemand(x, y, 0, 180).total
  const casos: [string, string, string][] = [
    ['SDU', 'CGH', 'GRU'],
    ['SDU', 'GRU', 'VCP'],
    ['GIG', 'CGH', 'SDU'],
  ]
  for (const [de, maior, menor] of casos) {
    const a = par(de, maior)
    const b = par(de, menor)
    const ok = a > b * 1.005
    if (!ok) falhas++
    console.log(
      `${ok ? 'ok   ' : 'FALHA'} ${de}: ${maior} (${Math.round(a)}) acima de ${menor} (${Math.round(b)})` +
        (ok ? '' : ' — o teto está achatando os dois'),
    )
  }
}

// ---------------------------------------------------- cidade de cada aeroporto
//
// O `city` é o que o jogador lê no mapa e na busca de base, e ele já apontou
// para a cidade grande da região em vez do município do aeroporto. O conserto
// inteiro está em `scripts/cidades.py`, que mede contra a OurAirports; estas
// são as âncoras que não podem regredir em silêncio.
console.log('\ncidade do aeroporto\n')
for (const [iata, cidade] of [
  ['SOD', 'Sorocaba'],
  ['SJK', 'Sao Jose dos Campos'],
  ['VCP', 'Campinas'],
  ['CGH', 'Sao Paulo'],
  ['GRU', 'Sao Paulo'],
  ['LHR', 'Londres'],
  ['PEK', 'Pequim'],
  ['EWR', 'Nova York'],
] as const) {
  const a = AIRPORT_BY_IATA[iata]
  const ok = a?.city === cidade
  if (!ok) falhas++
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${iata} é ${cidade}${ok ? '' : ` — está como ${a?.city}`}`)
}

console.log('\nfuso do aeroporto\n')
for (const [iata, esperado, porque] of [
  ['DFW', -360, 'Dallas fica no horário central, não no das Montanhas'],
  ['SEA', -480, 'Seattle segue a costa do Pacífico padrão'],
  ['SYD', 600, 'Sydney fica em UTC+10 quando o jogo ignora horário de verão'],
  ['SCL', -240, 'Santiago fica em UTC-4 quando o jogo ignora horário de verão'],
  ['URC', 480, 'Ürümqi usa UTC+8 na malha aérea chinesa'],
  ['PHX', -420, 'Phoenix não troca para horário de verão'],
  ['AZA', -420, 'Mesa/Phoenix acompanha o mesmo Arizona sem DST'],
  ['MEL', 600, 'Melbourne na Austrália não pode herdar o UTC-5 da homônima da Flórida'],
  ['MLB', -300, 'Melbourne, Flórida, continua em UTC-5'],
  ['YQY', -240, 'Sydney, Nova Escócia, continua em UTC-4'],
] as const) {
  const a = AIRPORT_BY_IATA[iata]
  const ok = a?.fuso === esperado
  if (!ok) falhas++
  console.log(
    `${ok ? 'ok   ' : 'FALHA'} ${iata} ${a ? `UTC${a.fuso >= 0 ? '+' : ''}${a.fuso / 60}` : 'ausente'}` +
      `${ok ? '' : ` — esperado UTC${esperado >= 0 ? '+' : ''}${esperado / 60}`}` +
      `  ${porque}`,
  )
}

// ------------------------------------------------- teto de porte do aeroporto
//
// Onde a pista não é quem manda, o catálogo carrega um teto à mão. Ele é fácil
// de perder de vista: some numa regravação do catálogo e ninguém nota, porque
// o jogo continua funcionando — só volta a oferecer A321neo em Pampulha.
console.log('\nteto de porte\n')
for (const [iata, maior, barrado] of [
  ['PLU', 'b73g', 'a319'],
] as const) {
  const ap = AIRPORT_BY_IATA[iata]
  const passa = ap && aeroportoServe(AIRCRAFT_BY_ID[maior], ap)
  const barra = ap && !aeroportoServe(AIRCRAFT_BY_ID[barrado], ap)
  if (!passa || !barra) falhas++
  console.log(
    `${passa && barra ? 'ok   ' : 'FALHA'} ${iata} recebe ${AIRCRAFT_BY_ID[maior].name} ` +
      `e recusa ${AIRCRAFT_BY_ID[barrado].name}` +
      (passa && barra ? ` (teto ${ap.tetoAssentos} lugares)` : ''),
  )
}

// O movimento de Pampulha é o de 2004, o ano em que ela ainda era o aeroporto
// de Belo Horizonte — em 2005 o movimento foi para Confins. Se este número cair
// para o de hoje, a regra do pico histórico deixou de valer em algum lugar.
{
  const plu = AIRPORT_BY_IATA.PLU
  const anual = plu ? plu.paxDia * 365 : 0
  const ok = plu?.medido && anual > 2.8e6 && anual < 3.2e6
  if (!ok) falhas++
  console.log(
    `${ok ? 'ok   ' : 'FALHA'} PLU no pico de 2004 (${(anual / 1e6).toFixed(2)} mi/ano, ` +
      `${plu?.medido ? 'medido' : 'ESTIMADO'})`,
  )
}

// ------------------------------------------- movimento que não pode ser real
//
// A raspagem das listas erra de um jeito só: atribui a linha ao aeroporto
// errado. E quando erra, erra por ordem de grandeza — YXU, o aeroporto de
// London em Ontário, saiu com os 84 milhões de passageiros de Heathrow e
// liderou o Canadá à frente de Toronto por dois anos sem ninguém notar,
// porque o jogo continua funcionando com um número errado.
//
// A assinatura é essa: um aeroporto de degrau baixo liderando o próprio país
// por cima de um de degrau alto. Aeroporto pequeno pode ter muito movimento —
// Aeroparque passa Ezeiza —, mas não por cima de um degrau 4 ou 5.
console.log('\nmovimento plausível\n')
{
  const porPais = new Map<string, typeof AIRPORTS>()
  for (const a of AIRPORTS) {
    const l = porPais.get(a.cc) ?? []
    l.push(a)
    porPais.set(a.cc, l)
  }
  const suspeitos: string[] = []
  for (const [, lista] of porPais) {
    const ordem = [...lista].sort((x, y) => y.paxDia - x.paxDia)
    const topo = ordem[0]
    const grande = ordem.find((a) => a.tier >= 4)
    if (topo.tier <= 2 && grande && grande.paxDia < topo.paxDia) {
      suspeitos.push(
        `${topo.iata} (${topo.city}, ${topo.country}) tem ${(topo.paxDia * 365 / 1e6).toFixed(0)} mi/ano ` +
          `e passa ${grande.iata} com ${(grande.paxDia * 365 / 1e6).toFixed(0)} mi`,
      )
    }
  }
  // Aeroparque à frente de Ezeiza é real: é o aeroporto doméstico de Buenos
  // Aires e move mais gente que o internacional. Fica na lista conhecida.
  const conhecidos = ['AEP', 'FBM']
  const novos = suspeitos.filter((s) => !conhecidos.some((c) => s.startsWith(c)))
  if (novos.length) falhas++
  console.log(`${novos.length === 0 ? 'ok   ' : 'FALHA'} nenhum aeroporto pequeno lidera o país por engano` +
    (novos.length ? `\n      ${novos.join('\n      ')}` : ''))
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
