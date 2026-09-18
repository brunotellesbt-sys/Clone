/**
 * Confere o escopo dos aeroportos contra casos conhecidos da vida real.
 *
 * O escopo é índice de jogo derivado de dois sinais fracos — o degrau e a
 * palavra "internacional" no nome oficial — mais uma lista à mão. Derivação
 * assim envelhece mal e em silêncio: mudar o degrau de um aeroporto muda o que
 * ele aceita, e ninguém percebe. Esta tabela é o que segura isso.
 */
import { AIRPORT_BY_IATA, ESCOPO_LABEL, vooPermitido, type Escopo } from '../src/game/data/airports'

/** O que cada aeroporto deve ser, e por quê. */
const ESPERADO: [string, Escopo, string][] = [
  ['CGH', 'dom', 'Congonhas perdeu a alfândega para Guarulhos em 1985'],
  ['SDU', 'dom', 'Santos Dumont não opera com aeroporto internacional'],
  ['AEP', 'reg', 'Aeroparque: cabotagem mais regional'],
  ['IGU', 'reg', 'Foz do Iguaçu: internacional de fronteira'],
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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
