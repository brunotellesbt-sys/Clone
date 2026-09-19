/** Confere as configurações de cabine de todos os modelos: `npm run cabines`. */
import { AIRCRAFT, ehCargueiro } from '../src/game/data/aircraft'
import {
  abreastOf, ajustarClasse, cabinLength, checkCabin, LAYOUTS, LAYOUT_BY_ID, layoutsDe,
  limiteDaClasse, PITCH_RANGE, sumSeats,
} from '../src/game/cabin'
import { CABIN_LABEL, CABINS, type CabinClass, type Cabins } from '../src/game/types'

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
 * A cabine tem que reproduzir a capacidade que o fabricante publica.
 *
 * Esta é a trava que amarra o modelo ao mundo, e os números não são escolhidos
 * a dedo: são a **capacidade típica de duas classes publicada**, levantada pelo
 * `npm run assentos` das tabelas de especificação de cada família. Só entram as
 * linhas que se identificam sozinhas — "2-class seats" ou "Typical seating" com
 * a repartição explícita —, porque "Passenger capacity" quer dizer classe única
 * em metade dos artigos, e confundir as duas fazia a comparação acusar o jogo
 * de estar 19% baixo no 737-700 quando o errado era comparar coisas diferentes.
 *
 * Medido: erro médio absoluto de **3,7%** em dez modelos, pior caso 9%. A
 * tolerância é 11%, logo acima do pior, porque o padrão "duas classes" do jogo
 * tem uma repartição fixa e o fabricante publica a dele — dois desenhos
 * parecidos, nunca iguais.
 *
 * Foi esta trava que achou a executiva grande demais no padrão doméstico: com
 * 9% de cabine da frente a 40", o erro médio era 5,4% e o 737 MAX 8 saía 13%
 * abaixo do publicado. A resposta certa era apertar o padrão, não a
 * tolerância.
 *
 * Um caso conhecido fica **fora** da lista, e registrado: o 777-300ER publica
 * 396 em duas classes e o jogo monta 434. Não é erro de cabine — o padrão
 * doméstico põe 10% de executiva a 40", e a configuração de duas classes de um
 * widebody de longo curso tem cabine da frente muito maior, com cama plana.
 * Comparar os dois mediria a diferença entre eles, não a da cabine.
 */
console.log('\ncapacidade publicada, duas classes\n')
{
  const PUBLICADO: [string, number][] = [
    ['a319neo', 140], ['a320neo', 165], ['a321neo', 206],
    ['b37m', 153], ['b38m', 178], ['b39m', 193],
    ['e170', 66], ['e175', 76], ['e190', 96], ['e195', 100],
  ]
  const TOLERANCIA = 0.11
  let pior = 0
  let soma = 0
  for (const [id, pub] of PUBLICADO) {
    const t = AIRCRAFT.find((x) => x.id === id)
    if (!t) continue
    const jogo = sumSeats(LAYOUT_BY_ID.domestic.build(t).seats)
    const erro = jogo / pub - 1
    soma += Math.abs(erro)
    pior = Math.max(pior, Math.abs(erro))
    const ok = Math.abs(erro) <= TOLERANCIA
    if (!ok) falhas++
    console.log(
      `${ok ? 'ok   ' : 'FALHA'} ${t.name.padEnd(12)} ${String(jogo).padStart(4)} contra ` +
        `${String(pub).padStart(4)} publicados  ${erro >= 0 ? '+' : ''}${(erro * 100).toFixed(0)}%`,
    )
  }
  console.log(`      erro médio ${((soma / PUBLICADO.length) * 100).toFixed(1)}%, ` +
    `pior ${(pior * 100).toFixed(0)}%`)
}

console.log('\nclasses por família\n')
/**
 * Primeira classe é de fuselagem larga, executiva para de regional para cima,
 * e turboélice voa em classe única.
 *
 * A regra vale em três lugares que é fácil deixar desencontrados — o padrão do
 * catálogo, a trava de capacidade e a validação de `setCabin` —, então ela é
 * medida nos três de uma vez: o padrão mais caro que cada aeronave aceita não
 * pode montar classe que a família não tem, e a trava tem que devolver zero
 * para a classe barrada mesmo com a cabine vazia.
 */
{
  const PROIBIDO: Record<string, CabinClass[]> = {
    turboprop: ['w', 'c', 'f'],
    regional: ['f'],
    narrowbody: ['f'],
    widebody: [],
  }
  let erradas = 0
  for (const t of AIRCRAFT) {
    if (ehCargueiro(t)) continue
    const proibidas = PROIBIDO[t.family] ?? []
    for (const l of LAYOUTS) {
      const { seats, pitch } = l.build(t)
      for (const c of proibidas) {
        if (seats[c] > 0) {
          console.log(`FALHA ${t.name}: padrão "${l.name}" montou ${seats[c]} em ${CABIN_LABEL[c]}`)
          erradas++
        }
        const teto = limiteDaClasse(t, { y: 0, w: 0, c: 0, f: 0 }, pitch, c)
        if (teto > 0) {
          console.log(`FALHA ${t.name}: a trava deixa ${teto} assentos em ${CABIN_LABEL[c]}`)
          erradas++
        }
      }
    }
    // e o padrão oferecido tem que ser o que a aeronave comporta
    const oferecidos = layoutsDe(t)
    for (const l of oferecidos) {
      for (const c of proibidas) {
        if (l.exige.includes(c)) {
          console.log(`FALHA ${t.name}: "${l.name}" é oferecido e exige ${CABIN_LABEL[c]}`)
          erradas++
        }
      }
    }
    if (oferecidos.length === 0) {
      console.log(`FALHA ${t.name}: nenhum padrão de cabine oferecido`)
      erradas++
    }
  }
  falhas += erradas
  const turbo = AIRCRAFT.filter((t) => t.family === 'turboprop')
  const larga = AIRCRAFT.filter((t) => t.family === 'widebody')
  console.log(
    `${erradas === 0 ? 'ok   ' : 'FALHA'} ${AIRCRAFT.length} modelos: ` +
      `${turbo.length} turboélices só com econômica, ` +
      `${larga.length} de fuselagem larga são os únicos com primeira`,
  )
  console.log(`      um turboélice oferece ${layoutsDe(turbo[0]).length} padrão(ões), ` +
    `um de fuselagem larga oferece ${layoutsDe(larga[0]).length}`)
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
