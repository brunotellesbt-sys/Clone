/**
 * Confere a malha: horário, conexão e os três tempos mínimos.
 *
 * A regra de conexão é fácil de quebrar sem ninguém notar — um sinal trocado no
 * cálculo da espera, um fuso somado duas vezes, e a tela passa a oferecer
 * conexão de quarenta minutos entre um voo que chega de Lisboa e outro que sai
 * para Recife, que é impossível: o passageiro tem que passar pela alfândega.
 */
import { AIRPORT_BY_IATA } from '../src/game/data/airports'
import { newGame, openRoute, setAllFrequencies, setHorario, buyAircraft, assignAircraft } from '../src/game/engine'
import {
  conexoesNaBase, hhmm, MCT_ALFANDEGA, MCT_DOMESTICA, MCT_INTERNACIONAL, mct,
  rotacoesDa, voosColados,
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
const rec = s.airline.routes.find((r) => r.to === 'REC')!
conferir(voosColados(s, rec).length === 0, 'espalhado no dia, nenhum voo fica colado')
setHorario(s, rec.id, 0, 8 * 60)
setHorario(s, rec.id, 1, 8 * 60 + 20)
const colados = voosColados(s, rec)
conferir(colados.length === 1, 'dois voos com 20 min de diferença são apontados como colados')
setHorario(s, rec.id, 1, 9 * 60)
conferir(voosColados(s, rec).length === 0, 'com 60 min de diferença o aviso some')

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
