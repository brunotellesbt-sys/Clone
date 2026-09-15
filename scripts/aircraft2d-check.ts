import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { AIRCRAFT_ALL, AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { SOURCE_2D, selectedLayers, wingOptions, type Model2D } from '../src/livery/aircraft2d'
import { SEAT_MODELS, seatLayouts } from '../src/game/seatModels'
import { checkCabin, cabinUsed, defaultCabin } from '../src/game/cabin'
import { buyAircraft, newGame, setCabin } from '../src/game/engine'
import { exportSave, importSave } from '../src/game/save'
import { BLANK_LIVERY } from '../src/livery/presets'
import type { GameState, SeatConfig } from '../src/game/types'

const inventory = JSON.parse(readFileSync('public/aircraft2d/inventory.json', 'utf8'))
const seen = new Set<string>()
for (const entry of inventory.entries) {
  if (seen.has(entry.file)) continue
  assert.equal(createHash('sha256').update(readFileSync('public/aircraft2d/' + entry.file)).digest('hex'), entry.sha256)
  seen.add(entry.file)
}
let variants = 0
const warnings: string[] = []
const models = JSON.parse(readFileSync('public/aircraft2d/models.json', 'utf8')) as { id: string; name: string }[]
for (const [id, source] of Object.entries(SOURCE_2D)) {
  const t = AIRCRAFT_BY_ID[id]
  assert(t && !t.payload, `Correspondência inválida: ${id}`)
  const model: Model2D = JSON.parse(readFileSync(`public/aircraft2d/models/${source}.json`, 'utf8'))
  for (const l of model.layers) { assert.deepEqual(l.size, model.size); assert(seen.has(l.file)); assert(seen.has(l.small)) }
  for (const engine of t.engines) for (const winglet of [undefined, ...wingOptions(model, id)]) {
    const selection = selectedLayers(model, t, engine, { winglet })
    assert.equal(selection.layers.filter(l => l.name === 'fuselage').length, 1)
    assert.equal(selection.layers.filter(l => /^engine_(ge|pw|rr|cfm|iae|ea|pj)$/.test(l.name)).length, 1, `${id} ${engine} tem motores sobrepostos/ausentes`)
    assert.equal(selection.layers.filter(l => l.pattern).length, 0)
    if (selection.warning) warnings.push(`${t.name} (${engine}): ${selection.warning}`)
    variants++
  }
}
// Duas nacelas da mesma família não podem virar a mesma opção por engano.
const a320: Model2D = JSON.parse(readFileSync('public/aircraft2d/models/airbusa320.json', 'utf8'))
const q400: Model2D = JSON.parse(readFileSync('public/aircraft2d/models/bombardierq400.json', 'utf8'))
assert(q400.bodyBox[1] > 200, 'A altura do tubo não pode incluir os pixels da deriva')
assert(q400.layers.find(x => x.id === '70_triangle_1')?.pattern, 'As últimas camadas continuam opcionais nos Q300/Q400')
const arj: Model2D = JSON.parse(readFileSync('public/aircraft2d/models/comacarj21.json', 'utf8'))
assert(selectedLayers(arj, AIRCRAFT_BY_ID.arj21, 'cf3410a').layers.some(l => l.name === 'wing'), 'O acabamento do motor do ARJ21 está na camada wing')
assert(selectedLayers(a320, AIRCRAFT_BY_ID.a320, 'v2527').layers.some(l => l.name === 'engine_iae'))
assert(!selectedLayers(a320, AIRCRAFT_BY_ID.a320neo, 'leap1a26').layers.some(l => /wingtip_fence/.test(l.name)))
assert(selectedLayers(a320, AIRCRAFT_BY_ID.a320neo, 'pw1127g').layers.some(l => l.variant === 'neo' && l.name === 'engine_pw'))
const t = AIRCRAFT_BY_ID.a359
const seats = { y: 90, w: 0, c: 16, f: 0 }, pitch = { y: 31, w: 38, c: 76, f: 94 }
const layout: SeatConfig = { c: { style: 'biz_reverse_herringbone', layout: '1-2-1' } }
assert(cabinUsed(t, seats, pitch, layout) > cabinUsed(t, seats, pitch), 'Mapa deve mudar a ocupação real')
assert(checkCabin(t, seats, pitch, layout).ok)
assert(!checkCabin(t, seats, { ...pitch, c: 40 }, layout).ok)
assert(!checkCabin(t, { ...seats, y: -1 }, pitch).ok)
assert(!checkCabin(t, { ...seats, y: NaN }, pitch).ok)
assert(!checkCabin(AIRCRAFT_BY_ID.a320, seats, pitch, { c: { style: 'biz_suite', layout: '3-4-3' } }).ok)
for (const model of SEAT_MODELS) {
  assert(inventory.entries.some((e: {source: string}) => e.source.endsWith(`assets_seat_images_jpg_${model.id}.jpg`)))
  assert(seatLayouts(t, model.cabin, model.id).length > 0)
}
const s = newGame({ name: 'Teste 2D', code: 'TD', hub: 'GRU', seed: 42 })
s.airline.cash = 1e9
assert.equal(buyAircraft(s, 'a359', false), null)
const ac = s.airline.fleet[0]
assert.equal(setCabin(s, ac.id, seats, pitch, layout), null)
assert.deepEqual(ac.seatConfig, layout)
const cash = s.airline.cash
assert(setCabin(s, ac.id, { ...seats, y: -1 }, pitch))
assert.equal(s.airline.cash, cash, 'Reforma inválida não cobra nem altera aeronave')
s.airline.livery.aircraft2d = { a359: { engine: '#12ab34', winglet: 'winglet', marks: { primary: { text: 'TEXTO ÁÉ', x: .4, y: .2, color: '#abcdef', scale: .12, rotation: 12 } } } }
const restored = importSave(exportSave(s))!
assert.deepEqual(restored.airline.fleet[0].seatConfig, layout)
assert.equal(restored.airline.livery.aircraft2d?.a359.marks?.primary?.text, 'TEXTO ÁÉ')
assert.equal(restored.airline.cash, cash)
// Uma partida anterior não traz os campos novos; deve manter frota e progresso.
const old = structuredClone(s)
old.version = 1
old.day = 405
delete old.airline.livery.aircraft2d
delete old.airline.fleet[0].seatConfig
old.airline.fleet[0].seats = defaultCabin(t).seats
old.airline.fleet[0].pitch = defaultCabin(t).pitch
old.airline.livery = { ...BLANK_LIVERY }
const migrated = importSave(exportSave(old)) as GameState
assert.equal(migrated.version, 2)
assert.equal(migrated.day, 405)
assert.equal(migrated.airline.fleet.length, 1)
assert.equal(migrated.airline.cash, cash)
assert.deepEqual(migrated.airline.fleet[0].seats, old.airline.fleet[0].seats)
const qa = process.env.QA_DIR ?? '.qa'
mkdirSync(qa, { recursive: true })
writeFileSync(join(qa, 'partida-antiga.json'), JSON.stringify(old))
writeFileSync(join(qa, 'partida-integrada.json'), JSON.stringify(s))

const unused = models.filter(m => !Object.values(SOURCE_2D).includes(m.id))
const noSource = AIRCRAFT_ALL.filter(m => !SOURCE_2D[m.id])
const report = [
  '# Correspondência de aeronaves 2D', '',
  `Fonte única: ${inventory.archive}. SHA-256: \`${inventory.sha256}\`.`, '',
  `${inventory.sourceFiles} recursos gráficos importados; ${seen.size} arquivos únicos. As 57 bases e ambas as resoluções foram preservadas.`, '',
  `50 modelos do catálogo usam 44 bases do ZIP. Motores e winglets são selecionados por variante; ${variants} combinações verificadas.`, '',
  '| Modelo no jogo | Base do ZIP |', '|---|---|',
  ...Object.entries(SOURCE_2D).map(([id, source]) => `| ${AIRCRAFT_BY_ID[id].maker} ${AIRCRAFT_BY_ID[id].name} (${id}) | ${models.find(m => m.id === source)?.name} |`), '',
  '## Modelos que sobraram', '', ...unused.map(m => `- ${m.name}`), '',
  'Esses 13 modelos permanecem em public/aircraft2d/models e no acervo. Não foram acrescentados ao catálogo econômico sem fichas de desempenho.', '',
  'O Sukhoi Superjet 100 do ZIP tem SaM146. O SJ-100 existente usa PD-8; a correspondência não foi tratada como exata.', '',
  '## Modelos novos sem arte equivalente no ZIP', '', ...noSource.map(m => `- ${m.maker} ${m.name} (${m.id})`), '',
  'Os 12 cargueiros e cinco modelos de passageiros dessa lista conservam a arte anterior. Conversões de carga não recebem janelas de passageiros.', '',
  '## Variantes compartilhadas e limitações', '',
  '- A319/A320/A321neo usam as opções neo das respectivas bases. A321LR/XLR compartilham a base A321neo: portas e detalhes exclusivos de LR/XLR não estão individualizados no ZIP.',
  '- A350-900ULR compartilha a base A350-900. ATR 42/72 usam as bases de família; o ZIP não distingue todas as subvariantes.',
  ...[...new Set(warnings)].map(w => '- ' + w),
  '- Pinturas e opções de asa são visuais. A ficha de motorização, consumo, alcance e desempenho do catálogo continua sendo a do avião comprado.', '',
]
mkdirSync('docs', { recursive: true })
writeFileSync('docs/INTEGRACAO-AERONAVES-2D.md', report.join('\n'))
console.log(`OK: ${seen.size} hashes; ${variants} combinações; ${SEAT_MODELS.length} poltronas; reforma e migração de save; ${unused.length} modelos sem correspondência.`)
