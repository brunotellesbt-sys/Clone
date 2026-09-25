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
import { AIRPORT_BY_IATA as AP, noToqueDeRecolher, vooPermitido } from '../src/game/data/airports'
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { blockHours } from '../src/game/economy'
import { frotaDaConcorrente, modeloDaRota } from '../src/game/ai'
import { aeroportoServe } from '../src/game/spec'
// Geometria de tela, não de simulação — mas é aritmética pura, e aritmética
// pura se mede aqui em vez de num navegador. Ver `gradeEscala.ts`.
import { ALTURA_MAXIMA, escalaDaGrade, menorIntervaloDoDia } from '../src/ui/gradeEscala'
import { distanceBetween } from '../src/game/geo'
import {
  assinarAcordo, assinarCodeshare, assignAircraft, buyAircraft, MINUTOS_REAIS_POR_HORA, MS_POR_DIA, newGame,
  openRoute, romperAcordo, setAllFrequencies, setFrequency, unassignAircraft,
} from '../src/game/engine'
import {
  atratividadeHorario, conexoesNaBase, hhmm, MCT_ALFANDEGA, MCT_DOMESTICA,
  MCT_INTERNACIONAL, mct, esperaMaxima, voosColados,
} from '../src/game/malha'
import {
  alterarNumeroVoo, aeronavesPara, cabeNaEscala, curfewDaPerna, DIA, DOW_CURTO, marcarVoo, noTempo, paradasDe,
  partidaUtc, pernasDaRota, pernasDe, posicionamentos, quebrasDe, remarcarVoo, removerVoo,
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
conferir(mct(false, true) === MCT_INTERNACIONAL, 'doméstica que chega e internacional que sai: 1 h, sem retirar bagagem')
conferir(esperaMaxima(false, false) === 180, 'doméstica termina em 3 h')
conferir(esperaMaxima(true, true) === 240, 'trânsito internacional termina em 4 h')
conferir(esperaMaxima(true, false) === 360, 'imigração termina em 6 h')

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

const numeradas = s.airline.escala ?? []
conferir(numeradas.every(p => !!p.numero && p.numero >= 1 && p.numero <= 9999), 'toda perna recebe número comercial')
const primeira = numeradas[0]
if (primeira) {
  const mesma = numeradas.filter(p => p.from === primeira.from && p.to === primeira.to && p.saida === primeira.saida)
  conferir(mesma.every(p => p.numero === primeira.numero), 'mesmo serviço mantém número ao longo da semana')
  const outra = numeradas.find(p => p.numero !== primeira.numero)
  if (outra) conferir(!!alterarNumeroVoo(s, outra.id, primeira.numero!), 'outro serviço não pode duplicar número')
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
      .filter((c) => c.de.ponta === 'LIS')
      .every((c) => c.minimo === MCT_ALFANDEGA),
    'chegadas de Lisboa conectando a doméstico em GRU exigem redespacho',
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
  /**
   * A parceira é a que **rende conexão**, e não a primeira da lista.
   *
   * Antes era a primeira concorrente com GRU numa ponta, e isso passava por
   * acidente: o mundo era escrito à mão e uma das doze fazia hub em Guarulhos,
   * com banco de voos de sobra. Agora o mundo é gerado, nenhuma IA divide hub
   * com o jogador, e a primeira da lista pode ser alguém com uma rota só —
   * nesta semente é CGH–GRU, um salto de 25 km cujo horário não casa com nada.
   *
   * O teste passa a perguntar o que ele sempre quis perguntar: **existe acordo
   * que abra conexão?** Assinar com quem não tem voo na hora certa não abrir
   * nada não é defeito do interline, é o interline funcionando.
   */
  const candidatas = t.competitors
    .filter((c) => c.routes.some((r) => r.from === 'GRU' || r.to === 'GRU'))
    .sort((x, y) =>
      y.routes.filter((r) => r.from === 'GRU' || r.to === 'GRU').length -
      x.routes.filter((r) => r.from === 'GRU' || r.to === 'GRU').length)
  let parceira = candidatas.find((c) => {
    const s2 = structuredClone(t)
    if (assinarAcordo(s2, c.id)) return false
    return conexoesNaBase(s2, 'GRU').length > antes
  })
  if (!parceira) {
    console.log(`  (nenhuma das ${candidatas.length} concorrentes de GRU rende conexão nesta semente; bloco pulado)`)
  } else {
    const err = assinarAcordo(t, parceira.id)
    conferir(!err, `acordo com ${parceira.name}`, err ?? '')
    const depois = conexoesNaBase(t, 'GRU').length
    conferir(depois > antes, 'o acordo abre conexões novas', `${antes} → ${depois}`)
    const comParceira = conexoesNaBase(t, 'GRU').filter((c) => c.parceira)
    conferir(comParceira.every((c) => c.espera >= c.minimo), 'conexão interline respeita o mínimo')
    const proprio = t.airline.escala![0]
    conferir(!alterarNumeroVoo(t, proprio.id, 7001), 'voo próprio pode usar número alto livre')
    conferir(!assinarCodeshare(t, parceira.id), 'codeshare pode ser assinado com parceira interline')
    const numerosParceira = Object.values(t.airline.codeshareNumbers ?? {})
    conferir(!numerosParceira.includes(7001), 'codeshare não duplica número de voo próprio')
    conferir(!!alterarNumeroVoo(t, proprio.id, numerosParceira[0]), 'voo próprio não usa número reservado ao codeshare')
    conferir(conexoesNaBase(t, 'GRU').some(c => c.codeshare), 'codeshare marca as conexões integradas')
    conferir(parceira.routes.some(r => !!t.airline.codeshareNumbers?.[`${parceira.id}:${r.key}`]),
      'rota parceira recebe número comercial da companhia')
    romperAcordo(t, parceira.id)
    conferir(conexoesNaBase(t, 'GRU').length === antes, 'romper devolve a malha ao que era')
    conferir(!t.airline.codeshares?.includes(parceira.id), 'romper interline encerra codeshare')
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
  /*
   * Rota nova nasce **sem voo**. Quem monta a escala é o jogador: por uma
   * versão ela nascia voando uma vez por dia, e o dono do jogo pediu o
   * contrário — voo que aparece sozinho na grade de uma cauda recém-comprada é
   * o jogo decidindo no lugar dele.
   */
  conferir(
    pernasDaRota(t, r).length === 0,
    'abrir rota não marca voo nenhum sozinho',
    `${pernasDaRota(t, r).length} pernas`,
  )
  conferir(paradasDe(t, t.airline.fleet[0].id)[0].ocioso, 'e a cauda comprada segue parada na base')
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

console.log('\nconversão local ↔ UTC\n')
{
  conferir(AP.DFW.fuso === -360, 'Dallas usa UTC-6 padrão', `${AP.DFW.fuso / 60} h`)
  conferir(AP.SYD.fuso === 600, 'Sydney usa UTC+10 padrão, sem horário de verão embutido', `${AP.SYD.fuso / 60} h`)
  conferir(AP.SCL.fuso === -240, 'Santiago usa UTC-4 padrão, sem horário de verão embutido', `${AP.SCL.fuso / 60} h`)
  conferir(AP.URC.fuso === 480, 'Ürümqi segue UTC+8 da aviação chinesa', `${AP.URC.fuso / 60} h`)

  const dfw = partidaUtc({ id: 'tz-dfw', aircraftId: 'x', from: 'DFW', to: 'JFK', dow: 1, saida: 8 * 60 })
  conferir(dfw === DIA + 14 * 60, '08:00 em Dallas vira 14:00 UTC', hhmm(dfw))

  const syd = partidaUtc({ id: 'tz-syd', aircraftId: 'x', from: 'SYD', to: 'AKL', dow: 1, saida: 8 * 60 })
  conferir(syd === DIA - 2 * 60, '08:00 em Sydney vira 22:00 UTC do dia anterior', `${DOW_CURTO[Math.floor(syd / DIA)]} ${hhmm(syd)}`)
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

console.log('\no relógio\n')
/**
 * Uma hora de jogo em dois minutos e meio de relógio, a 1× — o dia em uma
 * hora. As outras velocidades são múltiplos disso, como sempre foram.
 */
{
  conferir(MINUTOS_REAIS_POR_HORA === 2.5, 'uma hora de jogo custa 2,5 min reais a 1×',
    `${MINUTOS_REAIS_POR_HORA} min`)
  for (const [v, min] of [[1, 60], [25, 2.4], [50, 1.2], [100, 0.6]] as [number, number][]) {
    const real = MS_POR_DIA / v / 60000
    conferir(Math.abs(real - min) < 0.01, `a ${v}× o dia de jogo leva ${min} min`,
      `${real.toFixed(2)} min`)
  }
}

console.log('\ntoque de recolher: cada ponta no próprio relógio\n')
/**
 * Congonhas e Santos Dumont não operam das 23h às 6h — mas a regra é do
 * **movimento naquele aeroporto**, não do voo inteiro. Um voo que sai às 04:30
 * de um aeroporto aberto e pousa em Santos Dumont depois das 6 é legal; um que
 * sai de Congonhas às 22:30 e chega de madrugada num aeroporto que opera de
 * noite também. O que não existe é partir ou pousar dentro da janela fechada.
 */
{
  const t = newGame({ name: 'Curfew', code: 'CF', hub: 'SDU', seed: 9 })
  t.airline.cash = 5e9
  openRoute(t, 'SDU', 'CGH')
  openRoute(t, 'SDU', 'REC')
  openRoute(t, 'REC', 'SDU')
  buyAircraft(t, 'e195e2', false)
  const cauda = t.airline.fleet[0].id
  const casos: [string, string, number, boolean, string][] = [
    ['SDU', 'CGH', 2 * 60, false, 'SDU 02:00 é dentro da janela fechada'],
    ['SDU', 'CGH', 22 * 60 + 30, false, 'sai 22:30 de SDU mas pousaria 23:15 em CGH'],
    ['SDU', 'REC', 22 * 60 + 30, true, 'sai 22:30 de SDU e pousa de madrugada em Recife, que opera'],
    ['REC', 'SDU', 4 * 60 + 30, true, 'sai 04:30 de Recife e pousa em SDU depois das 6'],
    ['REC', 'SDU', 2 * 60, false, 'sai 02:00 de Recife e pousaria em SDU às 04:30'],
  ]
  for (const [de, para, hora, deveDeixar, oque] of casos) {
    const r = curfewDaPerna(t, cauda, de, para, hora)
    conferir(deveDeixar === (r === null), `${de}–${para} ${hhmm(hora)}: ${oque}`, r ?? '')
  }
}

console.log('\no voo vazio também gasta tempo\n')
/**
 * O vazio continua permitido e continua cobrado — mas deixou de ser de graça
 * no relógio. Um avião que pousa em Congonhas às 22:20 não amanhece em Santos
 * Dumont de graça: o trecho vazio gasta solo nas duas pontas mais o voo, e
 * passa pelo mesmo toque de recolher. É o que bloqueia o pernoite impossível.
 */
{
  const t = newGame({ name: 'Vazio2', code: 'V2', hub: 'SDU', seed: 11 })
  t.airline.cash = 5e9
  openRoute(t, 'SDU', 'CGH')
  buyAircraft(t, 'e195e2', false)
  const cauda = t.airline.fleet[0].id
  let feitos = 0
  for (let d = 0; d < 7; d++) if (!marcarVoo(t, cauda, 'SDU', 'CGH', d, 7 * 60 + 10)) feitos++
  conferir(feitos === 7, 'a ida de manhã nos sete dias cabe: o vazio de volta voa de dia',
    `${feitos} de 7`)

  /**
   * **A cauda pode pernoitar em Congonhas.** Quem decide é o jogador, e ele o
   * faz marcando a volta no dia seguinte, na hora que quiser. Recusar a ida da
   * noite porque a volta ainda não existe era o mesmo deadlock do triângulo:
   * para marcar a ida era preciso ter a volta, e para marcar a volta era
   * preciso ter a ida.
   */
  const noite = cabeNaEscala(t, cauda, 'SDU', 'CGH', 2, 21 * 60 + 35)
  conferir(noite.ok, 'a ida das 21:35 pode ser marcada: dormir fora é escolha, não erro',
    noite.motivo ?? '')
  conferir(/CGH/.test(noite.vazioSemHora ?? '') && /23h/.test(noite.vazioSemHora ?? ''),
    'mas o aviso diz que o vazio de volta não teria hora', noite.vazioSemHora ?? '(sem aviso)')

  const tarde = cabeNaEscala(t, cauda, 'SDU', 'CGH', 2, 19 * 60)
  conferir(tarde.ok && !tarde.vazioSemHora,
    'a das 19:00 nem avisa: o vazio ainda sai antes das 23h')

  /** E o gesto que resolve: marcar a volta com passageiro no dia seguinte. */
  marcarVoo(t, cauda, 'SDU', 'CGH', 2, 21 * 60 + 35)
  const comQuebra = quebrasDe(t, cauda).filter((q) => q.semHora)
  conferir(comQuebra.length > 0, 'com a ida marcada, a grade acusa o vazio sem hora',
    comQuebra[0]?.semHora ?? '(nenhuma)')
  /*
   * O que resolve é a **primeira** perna de quarta sair de Congonhas. Marcar
   * uma volta às 09:00 e deixar a ida das 07:10 de pé não resolve nada: a
   * cauda dormiu em Congonhas, e às 07:10 ela não está em Santos Dumont. Quem
   * opera troca a perna, não acrescenta outra.
   */
  const daQuarta = pernasDe(t, cauda).find(
    (p) => p.perna.dow === 3 && p.perna.from === 'SDU',
  )
  if (daQuarta) removerVoo(t, daQuarta.perna.id)
  marcarVoo(t, cauda, 'CGH', 'SDU', 3, 7 * 60 + 10)
  conferir(quebrasDe(t, cauda).filter((q) => q.semHora).length === 0,
    'e trocar a primeira perna de quarta para sair de Congonhas resolve',
    quebrasDe(t, cauda).filter((q) => q.semHora)[0]?.semHora ?? '')

  /**
   * O que continua sendo **recusado** é a falta de tempo, não a de horário:
   * dez minutos entre pousar e a perna seguinte não dão para nenhum vazio, e
   * nenhuma perna nova conserta isso — qualquer coisa marcada no meio aperta
   * ainda mais.
   */
  const u = newGame({ name: 'Curto', code: 'CT', hub: 'GRU', seed: 12 })
  u.airline.cash = 5e9
  openRoute(u, 'GRU', 'REC')
  openRoute(u, 'GRU', 'SSA')
  buyAircraft(u, 'a320neo', false)
  const outra = u.airline.fleet[0].id
  marcarVoo(u, outra, 'GRU', 'REC', 1, 8 * 60)
  const colado = cabeNaEscala(u, outra, 'GRU', 'SSA', 1, 11 * 60 + 10)
  conferir(!colado.ok, 'sem tempo para o vazio, a recusa continua dura',
    colado.motivo ?? '(aceitou)')
}

console.log('\no vazio diz qual perna o obriga\n')
/**
 * O relato: uma ponte aérea com ida 06:00 e volta 07:25 nos sete dias, e ao
 * marcar uma segunda ida às 09:30 o jogo avisava "seguiria vazia para SDU".
 * Quem montou a escala lê aquilo como erro — "mas ela já volta para SDU às
 * 07:25". Volta, só que **antes** desta partida. O que obriga o vazio é a
 * perna de depois, que é a ida de segunda, e o aviso não dizia qual era.
 */
{
  const t = newGame({ name: 'Vazio', code: 'VZ', hub: 'SDU', seed: 7 })
  t.airline.cash = 5e9
  openRoute(t, 'SDU', 'CGH')
  buyAircraft(t, 'a320neo', false)
  const cauda = t.airline.fleet[0].id
  for (let d = 0; d < 7; d++) {
    marcarVoo(t, cauda, 'SDU', 'CGH', d, 6 * 60)
    marcarVoo(t, cauda, 'CGH', 'SDU', d, 7 * 60 + 25)
  }
  const d = cabeNaEscala(t, cauda, 'SDU', 'CGH', 0, 9 * 60 + 30)
  conferir(d.ok && d.ferryPara === 'SDU', 'a segunda ida do dia cobra voo vazio',
    `${d.ferryPara ?? 'nenhum'}`)
  conferir(/SDU–CGH/.test(d.ferryParaVoo ?? ''),
    'e o aviso nomeia a perna que obriga o vazio', d.ferryParaVoo ?? '(sem nome)')
  conferir(/Seg/.test(d.ferryParaVoo ?? ''),
    'que é a de **depois** desta, não a volta que já estava marcada antes',
    d.ferryParaVoo ?? '')
  // e marcando a volta dessa segunda ida o vazio some, que é o que o aviso ensina
  marcarVoo(t, cauda, 'SDU', 'CGH', 0, 9 * 60 + 30)
  marcarVoo(t, cauda, 'CGH', 'SDU', 0, 11 * 60)
  conferir(quebrasDe(t, cauda).length === 0, 'marcar a volta dela fecha a escala',
    `${quebrasDe(t, cauda).length} quebras`)
}

console.log('\ntempo de solo por porte\n')
/**
 * O mínimo de solo entre pousar e voltar a sair, ditado pelo dono do jogo:
 * 30 min turboélice, 40 min jato regional e corredor único até o A320neo e o
 * 737 MAX 8, 50 min do A321 e do 737-900/MAX 9 para cima, 60 min fuselagem
 * larga. É piso: quem já pedia mais continua pedindo — o A380 com 110.
 */
{
  const piso: [string, number][] = [
    ['atr72', 30], ['q400', 30], ['e195', 40], ['crj900', 40],
    ['a320neo', 40], ['b38m', 40], ['b737', 40],
    ['a321neo', 50], ['b39m', 50], ['a321', 50], ['b752', 50],
    ['b789', 60], ['a333', 60], ['a388', 60],
  ]
  for (const [id, min] of piso) {
    const t = AIRCRAFT_BY_ID[id]
    if (!t) continue
    conferir(t.turn >= min, `${t.name} tem pelo menos ${min} min de solo`, `${t.turn} min`)
  }
  const fora = AIRCRAFT.filter((t) => {
    const min = t.family === 'turboprop' ? 30 : t.family === 'widebody' ? 60
      : t.family === 'regional' ? 40 : t.maxSeats > 194 ? 50 : 40
    return t.family !== 'freighter' && t.turn < min
  })
  conferir(fora.length === 0, 'nenhum modelo fica abaixo do piso da família dele',
    fora.map((t) => `${t.name} ${t.turn}`).join(', '))
}

console.log('\ntempo de etapa na ponte aérea do Sudeste\n')
/**
 * Os tempos pedidos, e a calibração pela média deles. Ver `blockHours`: casar
 * os seis exatamente exigiria uma reta de intercepto negativo, então o que se
 * mede é o centro — 199 nm dando 45 minutos — e uma folga de três minutos nas
 * pontas.
 */
{
  const pedidos: [string, string, number][] = [
    ['GIG', 'GRU', 40], ['SDU', 'GRU', 40], ['GIG', 'CGH', 45],
    ['SDU', 'CGH', 45], ['GIG', 'VCP', 50], ['SDU', 'VCP', 50],
  ]
  const t = AIRCRAFT_BY_ID.a320neo
  let soma = 0
  for (const [a, b, alvo] of pedidos) {
    const nm = distanceBetween(a, b)
    const min = blockHours(t, nm) * 60
    soma += min - alvo
    conferir(Math.abs(min - alvo) <= 3.5, `${a}-${b} sai em ${alvo} min, mais ou menos três`,
      `${nm.toFixed(0)} nm → ${min.toFixed(0)} min`)
  }
  conferir(Math.abs(soma / pedidos.length) < 0.6, 'e a média dos seis bate com a pedida',
    `${(soma / pedidos.length).toFixed(2)} min de viés`)
}

// ------------------------------------------- a escala vertical da grade
//
// A grade é a tela onde a escala é lida, e ela desenhava por cima de si mesma
// no dia cheio. O caso é este, medido de uma tela de verdade: um E195-E2 com
// doze partidas por dia, de 85 em 85 minutos, numa janela de 05:00 às 24:00.
// Em 360px isso dava 27px entre uma partida e a seguinte, e o bloco de voo
// precisa de 28 para caber hora e rota — o de cima cobria o de baixo e o
// último do dia saía cortado pela borda.
//
// Aqui se mede a aritmética, não o desenho: quantos pixels vale o intervalo
// entre dois voos consecutivos. O desenho em si tem trava própria, no
// `npm run grade`, que mede na página.
{
  const janela = 19 * 60
  const blocos = Array.from({ length: 12 * 7 }, (_, i) => ({
    dow: i % 7, de: 6 * 60 + 35 + Math.floor(i / 7) * 85,
  }))
  const intervalo = menorIntervaloDoDia(blocos, janela)
  conferir(intervalo === 85, 'o dia cheio tem 85 minutos entre uma partida e a seguinte',
    `${intervalo} min`)

  for (const [onde, bloco, base] of [['no celular', 28, 360], ['no monitor', 30, 560]] as const) {
    const { porMinuto, altura } = escalaDaGrade(janela, intervalo, bloco, base)
    conferir(intervalo * porMinuto >= bloco - 0.01,
      `${onde}, o intervalo do dia cheio comporta um bloco inteiro`,
      `${(intervalo * porMinuto).toFixed(0)}px para um bloco de ${bloco}px · grade de ${altura}px`)
  }

  // E o dia vazio continua como era: crescer sem motivo é o outro defeito.
  const folgado = escalaDaGrade(janela, 8 * 60, 28, 360)
  conferir(folgado.altura === 360, 'o dia de poucos voos não estica a grade',
    `${folgado.altura}px`)

  // O teto segura o caso patológico: duas partidas coladas não viram um poço.
  const absurdo = escalaDaGrade(janela, 1, 28, 360)
  conferir(absurdo.altura <= ALTURA_MAXIMA, 'e duas partidas coladas não viram uma grade sem fim',
    `${absurdo.altura}px`)
}

// ------------------------------------------- a frota que a rival opera
//
// O ranking dizia "118 aviões" e parava aí, o que não ajuda ninguém a decidir
// em que par entrar: uma companhia de 118 jatos regionais em etapa curta e uma
// de 118 widebody são adversárias completamente diferentes.
//
// A frota é derivada da malha, e é isso que se mede aqui — que ela **soma** a
// frota declarada, e que o modelo escolhido de fato serve a rota.
{
  const t = newGame({ name: 'Rival', code: 'RV', hub: 'GRU', seed: 3 })
  const rivais = t.competitors.filter((c) => c.routes.length > 0)
  conferir(rivais.length > 0, 'o mundo nasce com concorrente voando', `${rivais.length} companhias`)

  let somam = 0
  let servem = 0
  for (const c of rivais) {
    const frota = frotaDaConcorrente(c, t.startYear)
    // `caudas`, e não `fleetSize`: ver o comentário em `frotaDaConcorrente`
    // sobre a companhia cuja malha exige um tipo que nenhum outro substitui.
    const caudas = Math.max(c.fleetSize, frota.length)
    if (frota.reduce((n, l) => n + l.avioes, 0) === caudas) somam++
    const ok = c.routes.every((r) => {
      const m = modeloDaRota(r.seats, r.from, r.to, t.startYear)
      return !m || (m.range >= distanceBetween(r.from, r.to) &&
        aeroportoServe(m, AP[r.from]) && aeroportoServe(m, AP[r.to]))
    })
    if (ok) servem++
  }
  conferir(somam === rivais.length, 'a lista de frota soma exatamente a frota da rival',
    `${somam}/${rivais.length}`)
  conferir(servem === rivais.length, 'e o modelo escolhido alcança a etapa e pousa nas duas pontas',
    `${servem}/${rivais.length}`)

  // E a rival não abre par da mesma região metropolitana — ela passa pela
  // mesma peneira que o jogador.
  const urbanos = t.competitors.flatMap((c) =>
    c.routes.filter((r) => !!vooPermitido(AP[r.from], AP[r.to])).map((r) => r.key))
  conferir(urbanos.length === 0, 'nenhuma concorrente voa par proibido',
    urbanos.slice(0, 3).join(', '))
}

console.log(`\n${falhas === 0 ? 'tudo certo' : `${falhas} falha(s)`}`)
process.exit(falhas ? 1 : 0)
