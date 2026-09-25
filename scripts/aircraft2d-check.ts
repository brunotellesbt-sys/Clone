import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { join } from 'node:path'
import { AIRCRAFT_ALL, AIRCRAFT_BY_ID, FAMILY_OF } from '../src/game/data/aircraft'
import { ENGINES } from '../src/game/data/engines'
import { GENERATED_2D, PAINTABLE_2D, SOURCE_2D, paintConfig2d, selectedLayers, wingOptions, type Model2D } from '../src/livery/aircraft2d'
import { apeloDaPoltrona, SEAT_BY_ID, SEAT_MODELS, seatFamily, seatLayouts } from '../src/game/seatModels'
import { checkCabin, cabinUsed, classesDe, defaultCabin, LAYOUTS } from '../src/game/cabin'
import { advanceDay, assignAircraft, buyAircraft, newGame, openRoute, setCabin } from '../src/game/engine'
import { exportSave, importSave } from '../src/game/save'
import { BLANK_LIVERY } from '../src/livery/presets'
import type { GameState, SeatConfig } from '../src/game/types'

const inventory = JSON.parse(readFileSync('public/aircraft2d/inventory.json', 'utf8'))
for (const id of ['a21lr', 'a21xlr']) {
  assert.equal(seatFamily(AIRCRAFT_BY_ID[id]), 'A320', `${id}: mesma família do A321 no APK`)
  assert.deepEqual(seatLayouts(AIRCRAFT_BY_ID[id], 'y', 'eco_standard'), seatLayouts(AIRCRAFT_BY_ID.a321, 'y', 'eco_standard'))
}
const library = JSON.parse(readFileSync('public/aircraft2d/library.json', 'utf8')) as { id: string }[]
const seen = new Set<string>()
for (const entry of inventory.entries) {
  if (seen.has(entry.file)) continue
  assert.equal(createHash('sha256').update(readFileSync('public/aircraft2d/' + entry.file)).digest('hex'), entry.sha256)
  seen.add(entry.file)
}
let variants = 0
const warnings: string[] = []
const models = JSON.parse(readFileSync('public/aircraft2d/models.json', 'utf8')) as { id: string; name: string }[]
assert.equal(new Set(AIRCRAFT_ALL.map(t => t.id)).size, AIRCRAFT_ALL.length, 'IDs publicados não podem se repetir')
const added = ['q200', 'q300', 'crj200', 'erj135', 'erj140', 'erj145', 'ssj100', 'a318', 'b712', 'b736', 'a343', 'a346', 'b744']
let flights = 0
for (const id of added) {
  const type = AIRCRAFT_BY_ID[id]
  assert(type && SOURCE_2D[id] && FAMILY_OF[id])
  for (const layout of LAYOUTS) {
    const cabin = layout.build(type)
    assert(checkCabin(type, cabin.seats, cabin.pitch).ok, `${id}: layout ${layout.id} não cabe`)
  }
  for (const engineId of type.engines) {
    assert(ENGINES[engineId], `${id}: motor ausente no catálogo`)
    for (const leased of [false, true]) {
      const game = newGame({ name: 'Frota clássica', code: 'FC', hub: 'GRU', seed: 42 })
      game.airline.cash = 2e9
      assert.equal(buyAircraft(game, id, leased, { engineId }), null, `${id}/${engineId}: aquisição`)
      const ac = game.airline.fleet[0]
      assert.equal(ac.engineId, engineId)
      assert.equal(ac.leased, leased)
      assert.equal(openRoute(game, 'GRU', 'GIG'), null)
      const route = game.airline.routes[0]
      assert.equal(assignAircraft(game, ac.id, route.id), null, `${id}: alocação em rota`)
      for (let d = 0; d < 7; d++) advanceDay(game)
      const flown = route.history.reduce((n, d) => n + d.flights, 0)
      assert(flown > 0 && ac.hours > 0 && ac.cycles > 0, `${id}: precisa voar após a compra`)
      assert(route.history.some(d => d.revenue > 0 && d.seats > 0), `${id}: precisa transportar passageiros`)
      assert(Number.isFinite(game.airline.cash))
      const seatConfig: SeatConfig = { y: { style: 'eco_standard', layout: seatLayouts(type, 'y', 'eco_standard')[0] } }
      assert.equal(setCabin(game, ac.id, { y: Math.min(20, type.maxSeats), w: 0, c: 0, f: 0 }, { y: 31, w: 38, c: 60, f: 83 }, seatConfig), null)
      const restored = importSave(exportSave(game))!
      assert.equal(restored.airline.fleet[0].typeId, id)
      assert.equal(restored.airline.fleet[0].engineId, engineId)
      assert.deepEqual(restored.airline.fleet[0].seatConfig?.y, seatConfig.y)
      assert(classesDe(type).every(c => !!restored.airline.fleet[0].seatConfig?.[c]?.style),
        'O save conserva um modelo de poltrona para cada classe disponível')
      flights += flown
    }
  }
}
const erj145: Model2D = JSON.parse(readFileSync('public/aircraft2d/models/embraere145.json', 'utf8'))
assert(!selectedLayers(erj145, AIRCRAFT_BY_ID.erj145, 'ae3007a1').layers.some(l => /^(xr_|winglet)/.test(l.name)), 'LR não pode exibir as peças do XR')
assert(!SOURCE_2D.sj100, 'Superjet com SaM146 não substitui SJ-100 com PD-8')
assert.deepEqual(AIRCRAFT_BY_ID.sj100.engines, ['pd8'])
for (const [id, source] of Object.entries(SOURCE_2D)) {
  const t = AIRCRAFT_BY_ID[id]
  assert(t && !t.payload, `Correspondência inválida: ${id}`)
  const model: Model2D = JSON.parse(readFileSync(`public/aircraft2d/models/${source}.json`, 'utf8'))
  for (const l of model.layers) { assert.deepEqual(l.size, model.size); assert(seen.has(l.file)); assert(seen.has(l.small)) }
  for (const engine of t.engines) for (const winglet of [undefined, ...wingOptions(model, id)]) {
    const selection = selectedLayers(model, t, engine, { winglet })
    assert.equal(selection.layers.filter(l => l.name === 'fuselage').length, 1)
    assert.equal(selection.layers.filter(l => /^engine_(ge|pw|rr|cfm|iae|ea|pj|ae)$/.test(l.name)).length, 1, `${id} ${engine} tem motores sobrepostos/ausentes`)
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
const seats = { y: 90, w: 0, c: 16, f: 0 }, pitch = { y: 31, w: 38, c: 50, f: 94 }
const layout: SeatConfig = { c: { style: 'biz_reverse_herringbone', layout: '1-2-1' } }
assert(cabinUsed(t, seats, pitch, layout) > cabinUsed(t, seats, pitch), 'Mapa deve mudar a ocupação real')
assert(checkCabin(t, seats, pitch, layout).ok)
assert(!checkCabin(t, seats, { ...pitch, c: 40 }, layout).ok)
assert(!checkCabin(t, { ...seats, y: -1 }, pitch).ok)
assert(!checkCabin(t, { ...seats, y: NaN }, pitch).ok)
assert(!checkCabin(AIRCRAFT_BY_ID.a320, seats, pitch, { c: { style: 'biz_suite', layout: '3-4-3' } }).ok)
for (const model of SEAT_MODELS) {
  assert(inventory.entries.some((e: {source: string}) => e.source.endsWith(`assets_seat_images_jpg_${model.id}.jpg`)))
  for (const layout of seatLayouts(t, model.cabin, model.id)) {
    const row = `assets_seat_icons_png_resized_light_images_${model.icon}_${layout.replaceAll('-', '')}.webp`
    const single = `assets_seat_icons_png_single_seat_resized_light_images_${model.icon}.webp`
    assert(library.some(item => item.id === row || item.id === single), `${model.id}/${layout}: desenho de assento ausente no ZIP`)
  }
}
assert.equal(seatLayouts(AIRCRAFT_BY_ID.a320, 'c', 'biz_wide_suite').length, 0,
  'A suíte ampla não cabe no A320 no catálogo original')
assert.deepEqual(seatLayouts(t, 'c', 'biz_wide_suite'), ['1-2-1'])
assert.equal(SEAT_BY_ID.biz_wide_suite.minPitch, 54, 'Passo original da suíte ampla')
assert.equal(SEAT_BY_ID.biz_wide_suite.extraCost, 40000, 'Preço original da suíte ampla')
assert.equal(apeloDaPoltrona('biz_wide_suite', 54), 115, 'Apelo original da suíte ampla')
assert(Math.abs(apeloDaPoltrona('prem_eco_luxury', 40) - 98.48333333333333) < 1e-8)
const s = newGame({ name: 'Teste 2D', code: 'TD', hub: 'GRU', seed: 42 })
s.airline.cash = 1e9
assert.equal(buyAircraft(s, 'a359', false), null)
const ac = s.airline.fleet[0]
assert.equal(setCabin(s, ac.id, seats, pitch, layout), null)
assert.deepEqual(ac.seatConfig?.c, layout.c)
const cash = s.airline.cash
assert(setCabin(s, ac.id, { ...seats, y: -1 }, pitch))
assert.equal(s.airline.cash, cash, 'Reforma inválida não cobra nem altera aeronave')
s.airline.livery.aircraft2d = { a359: { engine: '#12ab34', winglet: 'winglet', marks: { primary: { text: 'TEXTO ÁÉ', x: .4, y: .2, color: '#abcdef', scale: .12, rotation: 12 } } } }
const restored = importSave(exportSave(s))!
assert.deepEqual(restored.airline.fleet[0].seatConfig?.c, layout.c)
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
assert(['y', 'w', 'c', 'f'].every(c => !!migrated.airline.fleet[0].seatConfig?.[c as keyof SeatConfig]?.style),
  'A migração preenche modelos de assento explícitos')
const qa = process.env.QA_DIR ?? '.qa'
mkdirSync(qa, { recursive: true })
writeFileSync(join(qa, 'partida-antiga.json'), JSON.stringify(old))
writeFileSync(join(qa, 'partida-integrada.json'), JSON.stringify(s))
const catalogue = newGame({ name: 'Catálogo clássico', code: 'CC', hub: 'GRU', seed: 42 })
catalogue.airline.cash = 2e9
writeFileSync(join(qa, 'partida-catalogo.json'), JSON.stringify(catalogue))

const unused = models.filter(m => !Object.values(SOURCE_2D).includes(m.id))
const noSource = AIRCRAFT_ALL.filter(m => !SOURCE_2D[m.id])
const regenerated = new Set([
  'an148', 'an158', 'il96', 'sj100', 'tu204',
  'atr72f', 'b737f', 'a321f', 'b752f', 'tu204f', 'b763f', 'a332f',
  'il96f', 'b748f', 'an124', 'an225', 'belugaxl',
])
assert.deepEqual(new Set(noSource.map(t => t.id)), regenerated, 'os perfis sem base no ZIP precisam estar catalogados')
assert.deepEqual(new Set(Object.keys(GENERATED_2D)), regenerated, 'todos os perfis próprios precisam abrir na oficina 2D')
const pngSize = (file: string) => {
  const png = readFileSync(file)
  assert.equal(png.subarray(1, 4).toString(), 'PNG', `${file}: imagem inválida`)
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}
for (const t of noSource) {
  const folder = t.payload === undefined ? 'aircraft' : 'freighters'
  const sprite = `public/sprites/${folder}/${t.id}.png`
  assert.deepEqual(pngSize(sprite), [1536, 1024], `${t.id}: sprite regenerado ausente ou com tamanho errado`)
  assert.deepEqual(pngSize(`public/sprites/planemasks/${t.id}.png`), [1536, 1024], `${t.id}: silhueta ausente`)
  assert.equal(PAINTABLE_2D[t.id], `generated_${t.id}`)
  const generated: Model2D = JSON.parse(readFileSync(`public/aircraft2d/models/generated_${t.id}.json`, 'utf8'))
  assert.deepEqual(generated.size, [1536, 1024])
  assert.equal(generated.layers.filter(l => l.name === 'fuselage').length, 1)
  assert.equal(generated.layers.filter(l => l.name === 'tail').length, 1)
  assert.equal(generated.layers.filter(l => l.name === 'engine').length, 1)
  assert.equal(generated.layers.filter(l => l.name === 'finish').length, 1)
  for (const l of generated.layers) {
    assert.deepEqual(l.size, generated.size)
    assert.deepEqual(pngSize(`public/aircraft2d/${l.file}`), generated.size)
  }
  const painted = selectedLayers(generated, t, t.engines[0], paintConfig2d(BLANK_LIVERY, t.id)).layers
  assert.equal(painted.filter(l => l.pattern).length, 2, `${t.id}: padrões de pintura inicial ausentes`)
  const gear = readFileSync(`public/sprites/gearmasks/${t.id}.png`)
  const chunks: Buffer[] = []
  for (let offset = 8; offset + 12 <= gear.length;) {
    const length = gear.readUInt32BE(offset)
    if (gear.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(gear.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  assert(chunks.length && inflateSync(Buffer.concat(chunks)).every(byte => byte === 0), `${t.id}: trem de pouso não foi removido`)
  if (folder === 'aircraft') {
    for (const part of ['fuselagemasks', 'wingmasks', 'enginemasks', 'gearmasks', 'tailmasks', 'windowmasks']) {
      assert.deepEqual(pngSize(`public/sprites/${part}/${t.id}.png`), [1536, 1024], `${t.id}: setor ${part} ausente`)
    }
  }
}
const report = [
  '# Correspondência de aeronaves 2D', '',
  `Fonte única: ${inventory.archive}. SHA-256: \`${inventory.sha256}\`.`, '',
  `${inventory.sourceFiles} recursos gráficos importados; ${seen.size} arquivos únicos. As 57 bases e ambas as resoluções foram preservadas.`, '',
  `${Object.keys(SOURCE_2D).length} modelos do catálogo usam ${new Set(Object.values(SOURCE_2D)).size} bases do ZIP. Motores e winglets são selecionados por variante; ${variants} combinações verificadas.`, '',
  '| Modelo no jogo | Base do ZIP |', '|---|---|',
  ...Object.entries(SOURCE_2D).map(([id, source]) => `| ${AIRCRAFT_BY_ID[id].maker} ${AIRCRAFT_BY_ID[id].name} (${id}) | ${models.find(m => m.id === source)?.name} |`), '',
  '## Bases que sobraram', '', ...(unused.length ? unused.map(m => `- ${m.name}`) : ['Nenhuma. Todas as 57 bases possuem uma aeronave utilizável no catálogo.']), '',
  'As 13 bases antes sem correspondência agora estão cadastradas para compra, arrendamento, rotas, cabine e pintura. Fichas e fontes em [FONTES-AERONAVES-CLASSICAS.md](FONTES-AERONAVES-CLASSICAS.md).', '',
  'O Sukhoi Superjet 100 (ssj100) do ZIP usa SaM146. O SJ-100 (sj100) existente usa PD-8 e conserva arte e ficha próprias.', '',
  '## Modelos novos sem arte equivalente no ZIP', '', ...noSource.map(m => `- ${m.maker} ${m.name} (${m.id})`), '',
  'Esses 12 cargueiros e cinco modelos de passageiros não têm base equivalente no ZIP: usam perfis regenerados com GPT Image, sem trem de pouso, e 15 camadas de pintura por modelo com padrões derivados do acervo original. A alocação de 28 poltronas por fileiras atende todos os aviões de passageiros. Cargueiros não recebem cabine de passageiros.', '',
  '## Variantes compartilhadas e limitações', '',
  '- A319/A320/A321neo usam as opções neo das respectivas bases. A321LR/XLR compartilham a base A321neo: portas e detalhes exclusivos de LR/XLR não estão individualizados no ZIP.',
  '- A350-900ULR compartilha a base A350-900. ATR 42/72 usam as bases de família; o ZIP não distingue todas as subvariantes.',
  '- A nova entrada ERJ145 é LR: as camadas de strakes e winglets do XR ficam preservadas no acervo, sem aparecer no LR. O 747-400 cadastrado usa a asa com winglet, não a opção doméstica 400D. Essas subvariantes não são novos tipos de catálogo nesta integração.',
  ...[...new Set(warnings)].map(w => '- ' + w),
  '- Pinturas e opções de asa são visuais. A ficha de motorização, consumo, alcance e desempenho do catálogo continua sendo a do avião comprado.', '',
]
mkdirSync('docs', { recursive: true })
writeFileSync('docs/INTEGRACAO-AERONAVES-2D.md', report.join('\n'))
console.log(`OK: ${seen.size} hashes; ${variants} combinações; ${SEAT_MODELS.length} poltronas; ${regenerated.size} sprites regenerados; 13 tipos comprados e arrendados, ${flights} voos, reforma e save; ${unused.length} bases sem correspondência.`)
