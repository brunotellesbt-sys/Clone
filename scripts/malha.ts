/**
 * Confere a malha: horário, conexão e os três tempos mínimos.
 *
 * A regra de conexão é fácil de quebrar sem ninguém notar — um sinal trocado no
 * cálculo da espera, um fuso somado duas vezes, e a tela passa a oferecer
 * conexão de quarenta minutos entre um voo que chega de Lisboa e outro que sai
 * para Recife, que é impossível: o passageiro tem que passar pela alfândega.
 */
import { AIRPORT_BY_IATA, AIRPORT_BY_IATA as AP, noToqueDeRecolher } from '../src/game/data/airports'
import {
  assinarAcordo, assignAircraft, buyAircraft, newGame, openRoute, romperAcordo,
  setAllFrequencies, setFrequency, setHorario,
} from '../src/game/engine'
import {
  atratividadeHorario, conexoesNaBase, conflitosDeAeronave, hhmm, MCT_ALFANDEGA,
  MCT_DOMESTICA, MCT_INTERNACIONAL, mct, rotacoesDa, rotacoesDoDia, voosColados,
} from '../src/game/malha'

let falhas = 0
const conferir = (ok: boolean, oque: string, extra = '') => {
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${oque}${extra ? `  ${extra}` : ''}`)
  if (!ok) falhas++
}

// ------------------------------------------------------- tempos mínimos
console.log('tempo mínimo de conexão\n')
conferir(mct(false, false) === MCT_DOMESTICA, 'doméstica com doméstica: 40 min')
conferir(mct(true, true) === MCT_INTERNACIONAL, 'internacional com internacional em trânsito: 60 min')
conferir(mct(true, false) === MCT_ALFANDEGA, 'internacional que chega e doméstica que sai: 3 h')
conferir(mct(false, true) === MCT_ALFANDEGA, 'doméstica que chega e internacional que sai: 3 h')

// ------------------------------------------------------------- uma malha
const s = newGame({ name: 'Teste', code: 'TT', hub: 'GRU', seed: 7 })
s.airline.cash = 5e9
const rotas: string[] = []
for (const destino of ['REC', 'SSA', 'LIS']) {
  const err = openRoute(s, 'GRU', destino)
  if (err) { console.log('FALHA não abriu GRU-' + destino + ': ' + err); falhas++; continue }
  const r = s.airline.routes[s.airline.routes.length - 1]
  rotas.push(r.id)
  const tipo = destino === 'LIS' ? 'b789' : 'a320neo'
  buyAircraft(s, tipo, false)
  assignAircraft(s, s.airline.fleet[s.airline.fleet.length - 1].id, r.id)
  setAllFrequencies(s, r.id, 2)
}

console.log('\nrotações\n')
for (const id of rotas) {
  const r = s.airline.routes.find((x) => x.id === id)!
  for (const rot of rotacoesDa(s, r)) {
    console.log(
      `     ${r.from}-${r.to} ${rot.indice + 1}ª  parte ${hhmm(rot.saida)}` +
        `  chega ${hhmm(rot.chegadaDestino)}  volta ${hhmm(rot.voltaBase)}` +
        `  (${rot.internacional ? 'internacional' : 'doméstica'})`,
    )
  }
}

const conexoes = conexoesNaBase(s, 'GRU')
console.log(`\nconexões em GRU: ${conexoes.length}\n`)
for (const c of conexoes.slice(0, 8)) {
  const de = s.airline.routes.find((x) => x.id === c.de.routeId)!
  const para = s.airline.routes.find((x) => x.id === c.para.routeId)!
  console.log(
    `     ${de.from}-${de.to} chega ${hhmm(c.de.voltaBase)} → ${para.from}-${para.to} parte ` +
      `${hhmm(c.para.saida)}  espera ${c.espera} min (mínimo ${c.minimo})`,
  )
}

conferir(
  conexoes.every((c) => c.espera >= c.minimo),
  'nenhuma conexão oferecida abaixo do mínimo dela',
)
const lis = s.airline.routes.find((r) => r.to === 'LIS')
const comAlfandega = conexoes.filter(
  (c) => c.de.routeId === lis?.id || c.para.routeId === lis?.id,
)
conferir(
  comAlfandega.every((c) => c.minimo === MCT_ALFANDEGA),
  'conexão entre a internacional e uma doméstica exige alfândega',
  `${comAlfandega.length} pares`,
)
conferir(
  AIRPORT_BY_IATA.LIS.cc !== AIRPORT_BY_IATA.GRU.cc,
  'GRU-LIS é mesmo internacional',
)

// ------------------------------------------------- voos colados no mesmo destino
//
// Com **duas** caudas, porque com uma só o conflito de aeronave já impede que
// duas partidas fiquem a vinte minutos uma da outra — e é isso que se quer.
const rec = s.airline.routes.find((r) => r.to === 'REC')!
buyAircraft(s, 'a320neo', false)
assignAircraft(s, s.airline.fleet[s.airline.fleet.length - 1].id, rec.id)
conferir(voosColados(s, rec).length === 0, 'espalhado no dia, nenhum voo fica colado')
setHorario(s, rec.id, 0, 8 * 60)
setHorario(s, rec.id, 1, 8 * 60 + 20)
const colados = voosColados(s, rec)
conferir(colados.length === 1, 'dois aviões partindo com 20 min de diferença são apontados como colados')
setHorario(s, rec.id, 1, 9 * 60)
conferir(voosColados(s, rec).length === 0, 'com 60 min de diferença o aviso some')

// ------------------------------------------- a aeronave em dois lugares
//
// Numa rota de um avião só: é a rotação seguinte da **mesma cauda** que não
// pode sair enquanto a anterior está no ar.
console.log('\nconflito de aeronave\n')
const rec2 = s.airline.routes.find((r) => r.to === 'SSA')!
conferir(conflitosDeAeronave(s, rec2).length === 0, 'a escala padrão não põe o avião em dois lugares')
const bloqueio = setHorario(s, rec2.id, 1, rotacoesDa(s, rec2)[0].saida + 10)
conferir(
  !!bloqueio,
  'marcar a 2ª rotação dez minutos depois da 1ª é recusado',
  bloqueio ?? '(foi aceito, e não devia)',
)
conferir(conflitosDeAeronave(s, rec2).length === 0, 'a recusa não deixou conflito para trás')

// ----------------------------------------------------- fuso e atratividade
console.log('\nfuso e horário\n')
const fusos: [string, number, string][] = [
  ['GRU', -180, 'Brasília'],
  ['PEK', 480, 'a China inteira no horário de Pequim'],
  ['MAD', 60, 'Espanha no fuso de Berlim, não no solar'],
  ['DEL', 330, 'Índia com meia hora de deslocamento'],
  ['KTM', 345, 'Nepal com quarenta e cinco minutos'],
  ['LHR', 0, 'Londres'],
]
for (const [iata, esperado, porque] of fusos) {
  const ok = AP[iata]?.fuso === esperado
  if (!ok) falhas++
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${iata}  ${AP[iata]?.fuso} min  ${porque}`)
}
const pico = atratividadeHorario(8 * 60)
const madrugada = atratividadeHorario(3 * 60 + 30)
conferir(pico > 1 && madrugada < 0.5, 'madrugada vale menos da metade do pico',
  `${madrugada.toFixed(2)} contra ${pico.toFixed(2)}`)
conferir(
  atratividadeHorario(0) === atratividadeHorario(24 * 60),
  'a curva fecha na volta do dia',
)

// ----------------------------------------------- toque de recolher
console.log('\ntoque de recolher\n')
const sCgh = newGame({ name: 'T', code: 'TT', hub: 'CGH', seed: 3 })
sCgh.airline.cash = 5e9
openRoute(sCgh, 'CGH', 'BSB')
const rCgh = sCgh.airline.routes[0]
buyAircraft(sCgh, 'a320neo', false)
assignAircraft(sCgh, sCgh.airline.fleet[0].id, rCgh.id)
setAllFrequencies(sCgh, rCgh.id, 1)
const noite = setHorario(sCgh, rCgh.id, 0, 23 * 60 + 30)
conferir(!!noite, 'Congonhas recusa partida às 23:30', noite ?? '(aceitou)')
conferir(!setHorario(sCgh, rCgh.id, 0, 9 * 60), 'e aceita às 09:00')
conferir(noToqueDeRecolher('LHR', 3 * 60), 'Heathrow fechado às 3h')
conferir(!noToqueDeRecolher('GRU', 3 * 60), 'Guarulhos aberto às 3h — não tem restrição')

// --------------------------------------------------------- dia magro
console.log('\ndia de frequência menor\n')
const rMagro = s.airline.routes.find((r) => r.to === 'SSA')!
setAllFrequencies(s, rMagro.id, 2)
setHorario(s, rMagro.id, 0, 3 * 60)
setHorario(s, rMagro.id, 1, 18 * 60)
setFrequency(s, rMagro.id, 6, 1) // sábado com um voo só
const doSabado = rotacoesDoDia(s, rMagro, 6)
conferir(
  doSabado.length === 1 && doSabado[0].saida === 18 * 60,
  'no dia de um voo só, fica o de maior procura e não o primeiro',
  doSabado.map((r) => hhmm(r.saida)).join(' '),
)

// ------------------------------------------------------------- interline
//
// Num estado limpo: os blocos acima remexeram horário e frequência, e medir
// interline em cima disso mediria o resto do teste, não o interline.
console.log('\ninterline\n')
const si = newGame({ name: 'Teste', code: 'TT', hub: 'GRU', seed: 7 })
si.airline.cash = 5e9
for (const destino of ['REC', 'SSA', 'LIS']) {
  if (openRoute(si, 'GRU', destino)) continue
  const r = si.airline.routes[si.airline.routes.length - 1]
  buyAircraft(si, destino === 'LIS' ? 'b789' : 'a320neo', false)
  assignAircraft(si, si.airline.fleet[si.airline.fleet.length - 1].id, r.id)
  setAllFrequencies(si, r.id, 2)
}
const antes = conexoesNaBase(si, 'GRU').length
const parceira = si.competitors.find((c) =>
  c.routes.some((r) => r.from === 'GRU' || r.to === 'GRU'))
if (!parceira) {
  console.log('ok    nenhuma concorrente toca GRU nesta semente — nada a conectar')
} else {
  const err = assinarAcordo(si, parceira.id)
  conferir(!err, `acordo com ${parceira.name} assinado`, err ?? '')
  const depois = conexoesNaBase(si, 'GRU')
  conferir(depois.length > antes, 'o acordo abre conexões novas', `${antes} → ${depois.length}`)
  const doAcordo = depois.filter((c) => c.parceira)
  conferir(
    doAcordo.length > 0 && doAcordo.every((c) => c.espera >= c.minimo),
    'conexão interline respeita o mesmo tempo mínimo',
    `${doAcordo.length} pares`,
  )
  romperAcordo(si, parceira.id)
  conferir(
    conexoesNaBase(si, 'GRU').length === antes,
    'romper o acordo devolve a malha ao que era',
  )
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
