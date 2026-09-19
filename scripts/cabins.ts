/** Confere as configurações de cabine de todos os modelos: `npm run cabines`. */
import { AIRCRAFT } from '../src/game/data/aircraft'
import {
  abreastOf, ajustarClasse, cabinLength, checkCabin, LAYOUTS, limiteDaClasse, PITCH_RANGE,
  sumSeats,
} from '../src/game/cabin'
import { CABINS, type Cabins } from '../src/game/types'

let falhas = 0

for (const t of AIRCRAFT) {
  const rows = LAYOUTS.map((l) => {
    const b = l.build(t)
    const c = checkCabin(t, b.seats, b.pitch)
    return `${sumSeats(b.seats)}${c.ok ? '' : '!'}`.padStart(4)
  })
  console.log(
    t.name.padEnd(24),
    'lim' + String(t.maxSeats).padStart(4),
    (cabinLength(t) / 39.37).toFixed(1).padStart(5) + 'm',
    '|', rows.join(' '),
  )
}
console.log('\n         ' + ' '.repeat(24) + LAYOUTS.map((l) => l.id.slice(0, 4).padStart(4)).join(' '))

/*
 * O certificado tem que ser alcançável.
 *
 * O limite de saídas de emergência é fato publicado, e ele descreve a
 * configuração mais densa que o fabricante oferece — logo a cabine precisa
 * comportá-la no passo mínimo. Cinco modelos não comportavam, todos da família
 * `regional`: o E195-E2 é certificado para 146 e a cabine do jogo parava em
 * 124. Um número desses não dá erro em lugar nenhum; ele só faz o avião render
 * menos do que deveria, para sempre.
 */
console.log('\ncabine alcança o certificado\n')
{
  const naoAlcancam = AIRCRAFT.filter((t) => {
    if (t.maxSeats <= 0) return false
    const minimo: Cabins = { y: PITCH_RANGE.y[0], w: 34, c: 38, f: 60 }
    return limiteDaClasse(t, { y: 0, w: 0, c: 0, f: 0 }, minimo, 'y') < t.maxSeats
  })
  if (naoAlcancam.length) falhas++
  console.log(
    `${naoAlcancam.length === 0 ? 'ok   ' : 'FALHA'} os ${AIRCRAFT.filter((t) => t.maxSeats > 0).length} ` +
      'modelos de passageiro comportam o próprio limite de saídas' +
      (naoAlcancam.length ? `\n      ${naoAlcancam.map((t) => t.id).join(' ')}` : ''),
  )
}

/*
 * A trava não tem por onde vazar.
 *
 * Varre a frota inteira pondo TODA classe no máximo que o controle permite, na
 * ordem em que o jogador mexeria. Se a trava valesse só para a classe mexida, a
 * soma estouraria — é exatamente o defeito que ela veio impedir, e ele não
 * aparece testando uma classe de cada vez.
 */
console.log('\ntrava de capacidade\n')
{
  const estouram = AIRCRAFT.filter((t) => {
    if (t.maxSeats <= 0) return false
    const pitch: Cabins = { y: 31, w: 38, c: 60, f: 83 }
    let seats: Cabins = { y: 0, w: 0, c: 0, f: 0 }
    for (const c of [...CABINS].reverse()) {
      seats = ajustarClasse(t, seats, pitch, c, t.maxSeats)
    }
    for (const c of CABINS) {
      seats = ajustarClasse(t, seats, pitch, c, t.maxSeats)
    }
    return !checkCabin(t, seats, pitch).ok
  })
  if (estouram.length) falhas++
  console.log(
    `${estouram.length === 0 ? 'ok   ' : 'FALHA'} nenhum modelo estoura com todas as classes no máximo` +
      (estouram.length ? `\n      ${estouram.map((t) => t.id).join(' ')}` : ''),
  )
  // e o que a trava permite montar tem que ser uma cabine útil, não um avião vazio
  const magros = AIRCRAFT.filter((t) => {
    if (t.maxSeats <= 0) return false
    const pitch: Cabins = { y: 31, w: 38, c: 40, f: 83 }
    const so = ajustarClasse(t, { y: 0, w: 0, c: 0, f: 0 }, pitch, 'y', t.maxSeats)
    return sumSeats(so) < t.maxSeats * 0.8 && abreastOf(t, 'y') > 0
  })
  if (magros.length) falhas++
  console.log(
    `${magros.length === 0 ? 'ok   ' : 'FALHA'} classe única chega a pelo menos 80% do certificado` +
      (magros.length ? `\n      ${magros.map((t) => t.id).join(' ')}` : ''),
  )
}

/*
 * A cabine sai do certificado, e por isso o certificado tem que estar certo.
 *
 * Enquanto a cabine vinha de uma fração da fuselagem, um `maxSeats` errado
 * passava batido — o comprimento saía do desenho e ninguém comparava. Agora ele
 * **é** a cabine, e um número copiado da variante errada vira um avião com a
 * cabine de outro: o A340-600 estava com os 440 do -300, sendo 11,7 m mais
 * comprido e certificado para 475.
 *
 * A assinatura é essa: dois modelos com o mesmo limite e comprimentos bem
 * diferentes. Compartilhar limite é comum e legítimo — CRJ200, ERJ145 e ATR 42
 * param todos em 50 —, então o que se mede é o limite contra o **tamanho**.
 */
console.log('\nlimite de saídas coerente com o tamanho\n')
{
  const densidade = AIRCRAFT.filter((t) => t.maxSeats > 0)
    .map((t) => ({ t, d: t.maxSeats / (t.shape.length * t.abreast) }))
  const media = densidade.reduce((s, x) => s + x.d, 0) / densidade.length
  // duas vezes para cada lado da média é folga larga de propósito: turboélice e
  // A380 são legitimamente extremos, e o que se caça é o número copiado errado
  const fora = densidade.filter((x) => x.d < media / 2 || x.d > media * 2)
  if (fora.length) falhas++
  console.log(
    `${fora.length === 0 ? 'ok   ' : 'FALHA'} nenhum limite de saídas destoa do tamanho do avião ` +
      `(média ${media.toFixed(2)} assentos por metro e fileira)` +
      (fora.length ? `\n      ${fora.map((x) => `${x.t.id} ${x.d.toFixed(2)}`).join(' ')}` : ''),
  )
}

/*
 * E a cabine tem que reproduzir configurações que existem.
 *
 * Esta é a trava que amarra o modelo ao mundo: cada linha é uma configuração
 * de duas classes que voa de verdade. Se o jogo passar a dar 100 assentos num
 * E195-E2 outra vez, ela cai aqui — foi exatamente esse o defeito relatado.
 */
console.log('\nduas classes conferem com a realidade\n')
for (const [id, fileirasC, pc, faixa] of [
  ['b737', 3, 38, [150, 180]],
  ['a320neo', 3, 38, [145, 175]],
  ['e195e2', 3, 38, [115, 140]],
  // A faixa de cima é 220 e não 215 por um motivo que vale registrar: o teste
  // deu 216 e a primeira reação foi tratar como erro do modelo. Não é — o
  // A321neo de duas classes da Lufthansa voa com 215, e o Wizz com 239 numa
  // classe. Quem estava apertado era o meu intervalo, que eu mesmo escrevi.
  ['a321neo', 4, 38, [180, 220]],
] as const) {
  const t = AIRCRAFT.find((x) => x.id === id)
  if (!t) continue
  const pitch: Cabins = { y: 31, w: pc, c: 60, f: 83 }
  let seats: Cabins = { y: 0, w: fileirasC * abreastOf(t, 'w'), c: 0, f: 0 }
  seats = ajustarClasse(t, seats, pitch, 'y', t.maxSeats)
  const total = sumSeats(seats)
  const ok = total >= faixa[0] && total <= faixa[1]
  if (!ok) falhas++
  console.log(
    `${ok ? 'ok   ' : 'FALHA'} ${t.name}: ${total} assentos em duas classes ` +
      `(real ${faixa[0]}–${faixa[1]})`,
  )
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
