import assert from 'node:assert/strict'
import { newGame, openRoute } from '../src/game/engine'
import { exportSave, exportSaveFile, importSaveFile } from '../src/game/save'

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
