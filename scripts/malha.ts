/**
 * Confere a malha: posição da aeronave, horário, conexão e os três tempos
 * mínimos.
 *
 * A regra de conexão é fácil de quebrar sem ninguém notar — um sinal trocado no
 * cálculo da espera, um fuso somado duas vezes, e a tela passa a oferecer
 * conexão de quarenta minutos entre um voo que chega de Lisboa e outro que sai
 * para Recife, que é impossível: o passageiro tem que passar pela alfândega.
 *
 * Desde a escala por perna há uma regra nova, e mais fácil ainda de quebrar: um
 * avião só sai de onde ele está. Metade das conferências abaixo existe para isso.
 */
import { AIRPORT_BY_IATA as AP, noToqueDeRecolher } from '../src/game/data/airports'
import {
  assinarAcordo, assignAircraft, buyAircraft, newGame, openRoute, romperAcordo,
  setAllFrequencies, setFrequency, unassignAircraft,
} from '../src/game/engine'
import {
  atratividadeHorario, conexoesNaBase, hhmm, MCT_ALFANDEGA, MCT_DOMESTICA,
  MCT_INTERNACIONAL, mct, voosColados,
} from '../src/game/malha'
import {
  aeronavesPara, cabeNaEscala, DOW_CURTO, marcarVoo, noTempo, paradasDe, pernasDaRota, pernasDe,
  posicionamentos, quebrasDe, remarcarVoo, removerVoo,
} from '../src/game/escala'

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
  buyAircraft(s, destino === 'LIS' ? 'b789' : 'a320neo', false)
  assignAircraft(s, s.airline.fleet[s.airline.fleet.length - 1].id, r.id)
  setAllFrequencies(s, r.id, 2)
}

console.log('\npernas da semana\n')
for (const id of rotas) {
  const r = s.airline.routes.find((x) => x.id === id)!
  const pernas = pernasDaRota(s, r)
  const segunda = pernas.filter((p) => p.dow === 1)
  console.log(`  ${r.from}-${r.to}: ${pernas.length} na semana, ${segunda.length} na segunda`)
  conferir(pernas.length > 0, `${r.from}-${r.to} tem voo marcado`)
  conferir(
    r.freq[1] === Math.round(segunda.length / 2),
    `${r.from}-${r.to}: a frequência é derivada das pernas`,
    `freq=${r.freq[1]} pernas=${segunda.length}`,
  )
}

// -------------------------------------------- a aeronave sai de onde está
console.log('\na aeronave só sai de onde está\n')
{
  const cauda = s.airline.fleet[0]
  const pernas = pernasDe(s, cauda.id)
  const fora = pernas.find((p) => p.perna.to !== 'GRU')
  conferir(!!fora, 'a cauda de referência sai da base', fora ? `${fora.perna.from}-${fora.perna.to}` : '')
  // marcar um voo saindo de um aeroporto onde ela não está tem que ser recusado
  // ela nunca é oferecida como se já estivesse em CNF: ou está no ar, ou o voo
  // exige posicionamento vazio de onde ela pousou
  const d = cabeNaEscala(s, cauda.id, 'CNF', 'GRU', 1, 10 * 60)
  conferir(!d.ok || !!d.ferryDe, 'partir de onde a cauda não está custa voo vazio',
    d.ok ? `vazio de ${d.ferryDe}` : (d.motivo ?? ''))
  const ok = quebrasDe(s, cauda.id).length === 0
  conferir(ok, 'a escala montada pela frequência fecha a semana')
}

// ------------------------------------------- a malha triangular, o pedido
console.log('\nmalha triangular: GRU-REC, REC-CNF, CNF-GRU\n')
{
  const t = newGame({ name: 'Tri', code: 'TR', hub: 'GRU', seed: 11 })
  t.airline.cash = 5e9
  for (const [a, b] of [['GRU', 'REC'], ['GRU', 'CNF'], ['REC', 'CNF']] as const) {
    const err = openRoute(t, a, b)
    if (err) { console.log(`FALHA ${a}-${b}: ${err}`); falhas++ }
  }
  buyAircraft(t, 'a320neo', false)
  const cauda = t.airline.fleet[0].id

  const e1 = marcarVoo(t, cauda, 'GRU', 'REC', 1, 7 * 60)
  conferir(!e1, 'segunda 07:00 GRU → REC', e1 ?? '')
  // agora ela está em Recife, e é de lá que o voo seguinte pode sair
  const caro = cabeNaEscala(t, cauda, 'GRU', 'CNF', 1, 14 * 60)
  conferir(caro.ok && caro.ferryDe === 'REC', 'GRU → CNF só com voo vazio: a cauda está em REC', caro.ferryDe ?? '')
  const e2 = marcarVoo(t, cauda, 'REC', 'CNF', 1, 14 * 60)
  conferir(!e2, 'segunda 14:00 REC → CNF', e2 ?? '')
  const e3 = marcarVoo(t, cauda, 'CNF', 'GRU', 1, 19 * 60)
  conferir(!e3, 'segunda 19:00 CNF → GRU', e3 ?? '')

  conferir(quebrasDe(t, cauda).length === 0, 'o triângulo fecha a semana')
  conferir(posicionamentos(t).length === 0, 'não há voo vazio de posicionamento')
  const rGruRec = t.airline.routes.find((r) => r.to === 'REC')!
  const rRecCnf = t.airline.routes.find((r) => r.from === 'REC' || r.to === 'REC')!
  conferir(rGruRec.freq[1] > 0 || rRecCnf.freq[1] > 0, 'as rotas do triângulo registram movimento')
  console.log('  escala:', pernasDe(t, cauda).map((p) =>
    `${DOW_CURTO[p.perna.dow]} ${hhmm(p.perna.saida)} ${p.perna.from}-${p.perna.to}`).join(' · '))

  // e a mesma cauda em três rotas não pertence a nenhuma
  conferir(t.airline.fleet[0].routeId === null, 'cauda que circula não fica dedicada a rota nenhuma')

  // uma perna solta deixa a semana aberta, e isso vira voo vazio
  removerVoo(t, pernasDe(t, cauda)[2].perna.id)
  const vazios = posicionamentos(t)
  conferir(vazios.length === 1, 'tirar a última perna abre uma quebra', vazios.map((v) => `${v.from}-${v.to}`).join(','))
}

// ---------------------------------------------- a lista de disponíveis
console.log('\nquem está disponível\n')
{
  const t = newGame({ name: 'Disp', code: 'DS', hub: 'GRU', seed: 13 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'REC')
  buyAircraft(t, 'a320neo', false)
  buyAircraft(t, 'a320neo', false)
  const [a, b] = t.airline.fleet.map((x) => x.id)
  const livresAntes = aeronavesPara(t, 'GRU', 'REC', 1, 8 * 60).filter((c) => !c.impedimento)
  conferir(livresAntes.length === 2, 'as duas caudas novas estão na base', `${livresAntes.length}`)
  marcarVoo(t, a, 'GRU', 'REC', 1, 8 * 60)
  const livresDepois = aeronavesPara(t, 'GRU', 'REC', 1, 8 * 60 + 30).filter((c) => !c.impedimento)
  conferir(
    livresDepois.length === 1 && livresDepois[0].ac.id === b,
    'a cauda que decolou sai da lista e a outra fica',
    `${livresDepois.map((c) => c.ac.reg).join(',')}`,
  )
}

// ------------------------------------------------------------- conexões
console.log('\nconexões em GRU\n')
const conexoes = conexoesNaBase(s, 'GRU')
conferir(conexoes.length > 0, 'a malha gera conexão em GRU', `${conexoes.length} pares`)
for (const c of conexoes) {
  if (c.espera < c.minimo) { conferir(false, 'espera menor que o mínimo'); break }
}
conferir(conexoes.every((c) => c.espera >= c.minimo), 'nenhuma conexão abaixo do mínimo')
conferir(conexoes.every((c) => c.de.ponta !== c.para.ponta), 'ninguém conecta para o lugar de onde veio')
{
  /**
   * A alfândega, medida de propósito e não por acaso: marca-se um voo doméstico
   * saindo de GRU três horas e meia depois de um Lisboa chegar. Deixar isso a
   * cargo da grade automática dava zero pares, e um `every` sobre lista vazia
   * passa sem medir nada — é verde falso.
   */
  const rLis = s.airline.routes.find((r) => r.to === 'LIS')!
  // uma cauda de reserva: as três da malha acima estão todas no ar às 06h, e
  // sem avião livre o par nem chega a existir para ser medido
  buyAircraft(s, 'a320neo', false)
  const chegadas = pernasDaRota(s, rLis).filter((p) => p.to === 'GRU').map((p) => noTempo(s, p))
  let medido = false
  for (const chegada of chegadas) {
    const alvo = (chegada.chegadaLocal + MCT_ALFANDEGA + 30) % (24 * 60)
    const dow = (chegada.dowChegada + (chegada.chegadaLocal + MCT_ALFANDEGA + 30 >= 24 * 60 ? 1 : 0)) % 7
    // serve qualquer cauda que caiba: o que se mede aqui é o tempo mínimo da
    // conexão, não a qualidade da escala
    const livre = aeronavesPara(s, 'GRU', 'REC', dow, alvo).find((c) => !c.impedimento)
    if (!livre || marcarVoo(s, livre.ac.id, 'GRU', 'REC', dow, alvo)) continue
    const pares = conexoesNaBase(s, 'GRU').filter((c) => c.de.ponta === 'LIS' && c.para.ponta === 'REC')
    if (!pares.length) continue
    medido = true
    console.log(`  Lisboa chega ${hhmm(chegada.chegadaLocal)}, Recife sai ${hhmm(alvo)}`)
    conferir(true, 'Lisboa chegando e Recife saindo 3 h 30 depois é conexão', `${pares.length} pares`)
    conferir(
      pares.every((c) => c.minimo === MCT_ALFANDEGA),
      'e o mínimo dela é o da alfândega, não os 40 min domésticos',
      pares.map((c) => `${c.minimo} min`).join(' '),
    )
    break
  }
  conferir(
    medido && conexoesNaBase(s, 'GRU')
      .filter((c) => c.de.ponta === 'LIS' || c.para.ponta === 'LIS')
      .every((c) => c.minimo === MCT_ALFANDEGA),
    'nenhum par com Lisboa escapa da alfândega',
  )
  const exemplo = conexoes[0]
  if (exemplo) {
    console.log(`  exemplo: chega de ${exemplo.de.ponta} ${hhmm(exemplo.de.local)} → sai para ${exemplo.para.ponta} ${hhmm(exemplo.para.local)} (${exemplo.espera} min, mínimo ${exemplo.minimo})`)
  }
}

// ------------------------------------------------------- remarcar horário
console.log('\nremarcar horário\n')
{
  const t = newGame({ name: 'Hora', code: 'HR', hub: 'GRU', seed: 17 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'REC')
  buyAircraft(t, 'a320neo', false)
  const cauda = t.airline.fleet[0].id
  marcarVoo(t, cauda, 'GRU', 'REC', 1, 7 * 60)
  marcarVoo(t, cauda, 'REC', 'GRU', 1, 12 * 60)
  const ida = pernasDe(t, cauda)[0].perna
  // puxar a ida para depois da volta põe o avião em dois lugares: tem que recusar
  const erro = remarcarVoo(t, ida.id, 1, 13 * 60)
  conferir(!!erro, 'recusa remarcar a ida para depois da volta', erro ?? '')
  conferir(pernasDe(t, cauda)[0].perna.saida === 7 * 60, 'a recusa não mexe na escala')
  const ok = remarcarVoo(t, ida.id, 1, 6 * 60)
  conferir(!ok, 'aceita adiantar a ida para 06:00', ok ?? '')
  conferir(pernasDaRota(t, t.airline.routes[0]).some((p) => p.saida === 6 * 60), 'a nova hora ficou gravada')
}

// ---------------------------------------------------------- toque de recolher
console.log('\ntoque de recolher\n')
{
  const t = newGame({ name: 'Curfew', code: 'CF', hub: 'CGH', seed: 19 })
  t.airline.cash = 5e9
  openRoute(t, 'CGH', 'SDU')
  buyAircraft(t, 'a320neo', false)
  const erro = marcarVoo(t, t.airline.fleet[0].id, 'CGH', 'SDU', 1, 23 * 60 + 30)
  conferir(!!erro && erro.includes('CGH'), 'CGH recusa partida às 23:30', erro ?? '')
  conferir(noToqueDeRecolher('CGH', 23 * 60 + 30), 'CGH está fechado às 23:30')
  conferir(!noToqueDeRecolher('CGH', 9 * 60), 'CGH está aberto às 09:00')
}

// ---------------------------------------------------- dia de menor frequência
console.log('\ndia de frequência menor\n')
{
  const t = newGame({ name: 'Magro', code: 'MG', hub: 'GRU', seed: 23 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'REC')
  buyAircraft(t, 'a320neo', false)
  const r = t.airline.routes[0]
  assignAircraft(t, t.airline.fleet[0].id, r.id)
  setAllFrequencies(t, r.id, 2)
  setFrequency(t, r.id, 6, 1)
  const sabado = pernasDaRota(t, r).filter((p) => p.dow === 6 && p.from === 'GRU')
  const atr = sabado.map((p) => atratividadeHorario(p.saida))
  conferir(sabado.length === 1, 'sábado ficou com um voo de ida', `${sabado.length}`)
  conferir(
    atr.every((a) => a >= 0.9),
    'o voo que sobra no sábado é de horário bom',
    sabado.map((p) => `${hhmm(p.saida)} (${Math.round(atratividadeHorario(p.saida) * 100)}%)`).join(' '),
  )
}

// ---------------------------------------------------------------- colados
console.log('\nvoos colados\n')
{
  const t = newGame({ name: 'Colado', code: 'CO', hub: 'GRU', seed: 29 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'REC')
  buyAircraft(t, 'a320neo', false)
  buyAircraft(t, 'a320neo', false)
  const [a, b] = t.airline.fleet.map((x) => x.id)
  marcarVoo(t, a, 'GRU', 'REC', 1, 8 * 60)
  marcarVoo(t, b, 'GRU', 'REC', 1, 8 * 60 + 20)
  const pares = voosColados(t, t.airline.routes[0])
  conferir(pares.length === 1, 'duas partidas com 20 min de diferença viram aviso', `${pares.length}`)
  marcarVoo(t, a, 'REC', 'GRU', 1, 13 * 60)
  const outroDia = voosColados(t, t.airline.routes[0])
  conferir(outroDia.length === 1, 'a volta não conta como colada com a ida')
}

// -------------------------------------------------------------- interline
console.log('\ninterline\n')
{
  const t = newGame({ name: 'Inter', code: 'IN', hub: 'GRU', seed: 31 })
  t.airline.cash = 5e9
  t.airline.reputation = 0.9
  for (const d of ['REC', 'SSA']) {
    openRoute(t, 'GRU', d)
    buyAircraft(t, 'a320neo', false)
    assignAircraft(t, t.airline.fleet[t.airline.fleet.length - 1].id, t.airline.routes[t.airline.routes.length - 1].id)
    setAllFrequencies(t, t.airline.routes[t.airline.routes.length - 1].id, 2)
  }
  const antes = conexoesNaBase(t, 'GRU').length
  const parceira = t.competitors.find((c) => c.routes.some((r) => r.from === 'GRU' || r.to === 'GRU'))
  if (!parceira) {
    console.log('  (nenhuma concorrente toca GRU nesta semente; bloco pulado)')
  } else {
    const err = assinarAcordo(t, parceira.id)
    conferir(!err, `acordo com ${parceira.name}`, err ?? '')
    const depois = conexoesNaBase(t, 'GRU').length
    conferir(depois > antes, 'o acordo abre conexões novas', `${antes} → ${depois}`)
    const comParceira = conexoesNaBase(t, 'GRU').filter((c) => c.parceira)
    conferir(comParceira.every((c) => c.espera >= c.minimo), 'conexão interline respeita o mínimo')
    romperAcordo(t, parceira.id)
    conferir(conexoesNaBase(t, 'GRU').length === antes, 'romper devolve a malha ao que era')
  }
}

// ------------------------------------------------------------ escala vazia
console.log('\nfrota parada\n')
{
  const t = newGame({ name: 'Parado', code: 'PA', hub: 'GIG', seed: 37 })
  t.airline.cash = 5e9
  buyAircraft(t, 'a320neo', false)
  const paradas = paradasDe(t, t.airline.fleet[0].id)
  conferir(paradas.length === 1 && paradas[0].iata === 'GIG', 'aeronave sem escala dorme na base')
  conferir(paradas[0].ocioso, 'e é marcada como ociosa')
  openRoute(t, 'GIG', 'FOR')
  const r = t.airline.routes[0]
  // rota nova nasce voando uma vez por dia, se houver cauda parada para isso
  conferir(
    pernasDaRota(t, r).length === 14,
    'abrir rota marca uma ida e volta em cada dia da semana',
    `${pernasDaRota(t, r).length} pernas`,
  )
  conferir(quebrasDe(t, t.airline.fleet[0].id).length === 0, 'e a escala que ela monta fecha a semana')

  // esvaziada de novo, a cauda volta a dormir na base e a ser oferecida de lá
  unassignAircraft(t, t.airline.fleet[0].id)
  const livres = aeronavesPara(t, 'GIG', 'FOR', 2, 9 * 60).filter((c) => !c.impedimento)
  conferir(livres.length === 1 && !livres[0].ferryDe, 'esvaziada, ela aparece livre na base')
  const foraDeCasa = aeronavesPara(t, 'FOR', 'GIG', 2, 9 * 60).filter((c) => !c.impedimento)
  conferir(
    foraDeCasa.length === 1 && foraDeCasa[0].ferryDe === 'GIG',
    'para um voo que sai de FOR ela aparece marcada como voo vazio desde GIG',
    foraDeCasa[0]?.ferryDe ?? 'nenhuma',
  )
}

// ---------------------------------------------------- chegada com fuso
console.log('\nfuso na chegada\n')
{
  const t = newGame({ name: 'Fuso', code: 'FU', hub: 'GRU', seed: 41 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'LIS')
  buyAircraft(t, 'b789', false)
  marcarVoo(t, t.airline.fleet[0].id, 'GRU', 'LIS', 1, 22 * 60)
  const p = noTempo(t, pernasDe(t, t.airline.fleet[0].id)[0].perna)
  const delta = AP.LIS.fuso - AP.GRU.fuso
  conferir(delta > 0, 'Lisboa está à frente de São Paulo', `${delta / 60} h`)
  conferir(p.dowChegada === 2, 'o voo das 22:00 de segunda chega na terça', `${DOW_CURTO[p.dowChegada]} ${hhmm(p.chegadaLocal)}`)
  console.log(`  GRU 22:00 → LIS ${hhmm(p.chegadaLocal)} (${(p.bloco / 60).toFixed(1)} h de voo, fuso +${delta / 60} h)`)
}

// ------------------------------------------------------------- retirar cauda
console.log('\ntirar a cauda de uma rota\n')
{
  const t = newGame({ name: 'Tirar', code: 'TI', hub: 'GRU', seed: 43 })
  t.airline.cash = 5e9
  openRoute(t, 'GRU', 'REC')
  openRoute(t, 'GRU', 'SSA')
  buyAircraft(t, 'a320neo', false)
  const cauda = t.airline.fleet[0].id
  marcarVoo(t, cauda, 'GRU', 'REC', 1, 7 * 60)
  marcarVoo(t, cauda, 'REC', 'GRU', 1, 12 * 60)
  marcarVoo(t, cauda, 'GRU', 'SSA', 2, 7 * 60)
  marcarVoo(t, cauda, 'SSA', 'GRU', 2, 12 * 60)
  const rRec = t.airline.routes.find((r) => r.to === 'REC')!
  unassignAircraft(t, cauda, rRec.id)
  conferir(pernasDaRota(t, rRec).length === 0, 'os voos de GRU-REC saíram')
  conferir(pernasDe(t, cauda).length === 2, 'os de GRU-SSA ficaram', `${pernasDe(t, cauda).length}`)
}

console.log(`\n${falhas === 0 ? 'tudo certo' : `${falhas} falha(s)`}`)
process.exit(falhas ? 1 : 0)
