import assert from 'node:assert/strict'
import { buyAircraft, newGame, openRoute } from '../src/game/engine'
import { chaveCabine, renomearCabine } from '../src/game/cabinProfiles'
import { compressSaveFile, exportSave, exportSaveFile, importSaveFile, MAX_EXTERNAL_SAVE_BYTES, readSaveFile, encodeStoredSave, decodeStoredSave } from '../src/game/save'

const game = newGame({ name: 'Save de teste', code: 'ST', hub: 'SSA', seed: 17 })
assert.equal(openRoute(game, 'SSA', 'AJU'), null)
game.day = 45
const file = exportSaveFile(game)
const parsed = JSON.parse(file)
assert.equal(parsed.format, 'the-airline-simulator-save')
assert.equal(parsed.fileVersion, 1)
assert.equal(parsed.game.airline.name, 'Save de teste')
assert.equal(parsed.game.airline.routes[0].to, 'AJU')
assert.equal(importSaveFile(file)?.day, 45)
assert.equal(importSaveFile(file)?.airline.routes[0].to, 'AJU')
assert.equal(importSaveFile(JSON.stringify(game))?.airline.name, 'Save de teste')
assert.equal(importSaveFile(exportSave(game))?.day, 45)
assert.equal(importSaveFile('{incompleto'), null)
assert.equal(importSaveFile(JSON.stringify({ ...parsed, fileVersion: 99 })), null)
assert.equal(importSaveFile(JSON.stringify({ ...parsed, game: { ...parsed.game, version: 99 } })), null)
console.log('OK: arquivo JSON legível preserva partida, rotas e versão; arquivos inválidos são recusados.')

const comCabines = structuredClone(game)
assert.equal(buyAircraft(comCabines, 'e190', true), null)
const original = comCabines.airline.cabines![0]
assert.equal(renomearCabine(comCabines, original.id, 'Regional'), null)
const compactada = await compressSaveFile(comCabines)
assert.deepEqual((await readSaveFile(compactada))?.airline.cabines, [original])
const copia = { ...structuredClone(original), id: 'antiga', nome: 'Cópia' }
const semAssentos = copia.seats.f === 0 ? 'f' : 'w'
assert.equal(copia.seats[semAssentos], 0)
copia.pitch[semAssentos]++
assert.equal(chaveCabine(copia), chaveCabine(original))
copia.seatConfig = undefined
comCabines.airline.cabines!.push(copia)
assert.deepEqual(importSaveFile(exportSaveFile(comCabines))?.airline.cabines, [original])
console.log('OK: perfis viajam no save compactado, e cópias de saves antigos são consolidadas.')

const large=structuredClone(game)
large.notices=Array.from({length:12000},(_,i)=>({day:i,kind:'info' as const,text:'Histórico grande com acentos: conexão, população e operação. '.repeat(4)}))
const packed=encodeStoredSave(large)
assert(packed.startsWith('LZ1:'))
assert(packed.length<JSON.stringify(large).length/2)
assert.deepEqual(decodeStoredSave(packed),large)
assert.deepEqual(decodeStoredSave(JSON.stringify(game)),game)
console.log('OK: armazenamento compactado sem perda e leitura de saves antigos.')


// O arquivo antigo passa de 92 MB em UTF-8, inclusive com dados de jogo em português.
const big = structuredClone(game)
big.notices = Array.from({ length: 65_000 }, (_, day) => ({
  day, kind: 'info', text: 'Conexão em operação. '.repeat(55) + day,
}))
const oldFile = new Blob([exportSaveFile(big)])
assert(oldFile.size >= 92_000_000)
const compressed = await compressSaveFile(big)
assert(compressed.size <= MAX_EXTERNAL_SAVE_BYTES)
assert.deepEqual((await readSaveFile(compressed))?.notices, big.notices)
assert.deepEqual((await readSaveFile(oldFile))?.notices, big.notices)
console.log(`OK: ${(oldFile.size / 1e6).toFixed(2)} MB → ${(compressed.size / 1e6).toFixed(2)} MB, histórico integral e leitura do arquivo original.`)
