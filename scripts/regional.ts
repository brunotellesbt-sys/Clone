/**
 * A etapa regional fecha a conta?
 *
 * O relato foi direto: Rio–Campos dos Goytacazes dava resultado negativo com
 * qualquer aeronave do catálogo. Dava mesmo, e não por falta de passageiro —
 * 70 por dia num par de 126 km não é pouco para um turboélice. Dois números
 * matavam a rota antes de ela existir: um handling de 700 fixos por decolagem,
 * que cobrava de um ATR de 48 lugares quase o que cobra de um 777, e uma
 * tarifa de referência com só 34 de parte fixa, que num bilhete de 126 km
 * dava menos da metade do que o assento custava para voar.
 *
 * Isso é medível, e sem medida volta. A régua aqui é modesta de propósito:
 * **existe pelo menos uma aeronave do catálogo que fecha no azul** no par
 * regional de verdade — não "dá dinheiro", só "fecha". Rota de 30 passageiros
 * por dia continua no vermelho, e tem que continuar.
 */
import { AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { AIRPORTS, AIRPORT_BY_IATA } from '../src/game/data/airports'
import { baseDemand, pisoDoPar } from '../src/game/demand'
import { distanceBetween } from '../src/game/geo'
import { aeroportoServe, pistaServe } from '../src/game/spec'
import { estimateRoute, newGame, num } from '../src/game/engine'

const s = newGame({ name: 'Teste', code: 'TT', hub: 'SDU', seed: 42 })
const TURBO = Object.values(AIRCRAFT_BY_ID).filter((t) => t.family === 'turboprop')
const falhas: string[] = []
const conferir = (ok: boolean, oque: string, extra = '') => {
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${oque}${extra ? `  ${extra}` : ''}`)
  if (!ok) falhas.push(oque)
}

/** O melhor que o catálogo consegue nesse par, varrendo modelo e frequência. */
function melhorRota(from: string, to: string) {
  const a = AIRPORT_BY_IATA[from]
  const b = AIRPORT_BY_IATA[to]
  const dist = distanceBetween(from, to)
  let melhor = { id: '', freq: 0, profit: -Infinity, pax: 0 }
  for (const t of Object.values(AIRCRAFT_BY_ID)) {
    if (t.payload !== undefined || t.range < dist || !pistaServe(t, a, b)) continue
    if (s.startYear < t.since) continue
    for (const freq of [1, 2, 3, 4, 6, 8]) {
      const e = estimateRoute(s, from, to, t.id, freq)
      if (e && e.profit > melhor.profit) melhor = { id: t.id, freq, profit: e.profit, pax: e.pax }
    }
  }
  return { ...melhor, dist }
}

// ------------------------------------------------------- o par do relato
//
// Campos dos Goytacazes: 97.382 passageiros no ano publicado (2017), 126 km de
// Santos Dumont. É o menor par que ainda é rota de linha de verdade no Brasil,
// e é o piso que o jogo tem que sustentar.
//
// Belo Horizonte–Macaé fica **de fora** de propósito: 39 passageiros por dia
// não é rota de linha, e obrigar esse par a fechar seria pedir ao jogo que
// invente passageiro.
for (const [from, to] of [['SDU', 'CAW'], ['GRU', 'CAW'], ['SDU', 'MEA'], ['GRU', 'MEA']]) {
  const m = melhorRota(from, to)
  const d = baseDemand(from, to, 0, 180)
  conferir(m.profit > 0, `${from}–${to} fecha no azul com alguma aeronave`,
    `${m.id || 'nenhuma'} ${m.freq}×/dia · ${num(m.profit)}/dia · mercado ${num(d.total)} pax/dia`)
}

// ------------------------------------------------------------------- o piso
//
// O piso de demanda é decisão de projeto, com número dado: um par que aceita
// jato regional vale pelo menos um E195 cheio — 112 na econômica e 8 na
// premium —, e um par que só aceita turboélice vale pelo menos um ATR 42
// cheio, 38 em classe única e nada na premium.
//
// Ele **substituiu** a trava anterior, que exigia que Rio–Cabo Frio não
// fechasse. Cabo Frio aceita E195, então agora ele tem piso e fecha; a trava
// velha e o piso novo não podem valer ao mesmo tempo, e quem manda é o pedido.
for (const [from, to] of [['SDU', 'CFB'], ['SDU', 'CAW'], ['GRU', 'MEA'], ['CNF', 'PLU']]) {
  const d = baseDemand(from, to, 0, 180)
  const piso = pisoDoPar(AIRPORT_BY_IATA[from], AIRPORT_BY_IATA[to])
  conferir(d.pax.y >= piso.y - 0.5 && d.pax.w >= piso.w - 0.5,
    `${from}–${to} respeita o piso de ${piso.y}+${piso.w}`,
    `y ${num(d.pax.y)} · w ${num(d.pax.w)}`)
}

// Par que só aceita turboélice não ganha premium: turboélice não tem premium.
{
  const so = AIRPORTS.filter((a) => !aeroportoServe(AIRCRAFT_BY_ID.e195, a) &&
    TURBO.some((t) => aeroportoServe(t, a)))
  conferir(so.length > 0, 'existe aeroporto que só aceita turboélice', `${so.length} deles`)
  const par = so.length > 1 ? [so[0], so[1]] : null
  if (par) {
    const piso = pisoDoPar(par[0], par[1])
    conferir(piso.y === 38 && piso.w === 0,
      `par só de turboélice tem piso de 38 em classe única (${par[0].iata}–${par[1].iata})`,
      `${piso.y}+${piso.w}`)
  }
}

// ------------------------------------------------- o que tem que continuar caro
//
// O piso é um chão, não um nivelamento: par grande continua grande. Se um dia
// o mercado de Congonhas encostar no piso, alguma coisa zerou a conta inteira.
{
  const d = baseDemand('SDU', 'CGH', 0, 180)
  conferir(d.total > 5000, 'o par grande continua muito acima do piso',
    `${num(d.total)} pax/dia`)
}

// ------------------------------------------ e o grande continua sendo o grande
//
// O conserto era para a etapa curta. Se ele tivesse vazado para o resto da
// malha, é aqui que apareceria: a rota troncal tem que render muito mais que a
// regional, ou a decisão de frota perde o sentido.
{
  const tronco = melhorRota('GRU', 'REC')
  const regional = melhorRota('SDU', 'CAW')
  conferir(tronco.profit > regional.profit * 20,
    'a rota troncal continua valendo muito mais que a regional',
    `${num(tronco.profit)}/dia contra ${num(regional.profit)}/dia`)
}

console.log(falhas.length === 0 ? '\ntudo certo' : `\n${falhas.length} falha(s)`)
process.exit(falhas.length ? 1 : 0)
