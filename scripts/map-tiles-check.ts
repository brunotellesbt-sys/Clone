import assert from 'node:assert/strict'
import { geoEquirectangular } from 'd3-geo'
import { satelliteTiles } from '../src/ui/mapTiles'

const projection = geoEquirectangular().fitExtent([[0, 10], [1000, 510]], { type: 'Sphere' })
assert.equal(satelliteTiles({ k: 1, x: 0, y: 0 }, 1).length, 0, 'visão global usa fundo local')
for (const k of [2, 5, 16, 40, 72,144,288]) for (const pixels of [.36, 1, 2, 3]) {
  for (const [lon, lat] of [[-43.16, -22.91], [-179.5, -80], [179.5, 80], [0, 0]]) {
    const [px, py] = projection([lon, lat])!
    const view = { k, x: Math.min(0, Math.max(1000 - 1000 * k, 500 - px * k)),
      y: Math.min(0, Math.max(520 - 520 * k, 260 - py * k)) }
    const tiles = satelliteTiles(view, pixels)
    assert(tiles.length > 0 && tiles.length <= 128, `carrega apenas região visível (${tiles.length})`)
    assert(tiles.some(t => px >= t.x && px <= t.x + t.size && py >= t.y && py <= t.y + t.size), 'aeroporto coberto')
    for (const tile of tiles) {
      assert(tile.level <= 11)
      if(tile.level>7){assert(tile.url.includes('World_Imagery'));assert(tile.url.includes('imageSR=4326'))}
      const [, row, col] = tile.key.split('/').map(Number)
      const span = 288 / 2 ** tile.level
      // Confere posicionamento WMTS contra a projeção usada pelos voos, em cada nível.
      const expected = projection([-180 + col * span, 90 - row * span])!
      assert(Math.abs(expected[0] - tile.x) < 1e-8 && Math.abs(expected[1] - tile.y) < 1e-8)
      assert(tile.size * k * pixels <= 512, 'seleciona resolução suficiente até limite da fonte')
    }
    // Sem buracos no interior do mundo mesmo nos limites da grade e na linha internacional de data.
    for (let sx = 0; sx <= 1000; sx += 125) for (let sy = 0; sy <= 520; sy += 65) {
      const x = (sx - view.x) / k, y = (sy - view.y) / k
      if (y < 10 || y > 510) continue
      assert(tiles.some(t => x >= t.x - 1e-8 && x <= t.x + t.size + 1e-8 && y >= t.y - 1e-8 && y <= t.y + t.size + 1e-8))
    }
  }
}
// No celular o SVG revela mais latitude que o viewBox nominal; toda essa área precisa de detalhes.
const mobile = { left: 0, right: 1000, top: -410, bottom: 930 }
for (const k of [2.1, 5, 16, 40, 72]) {
  const [px, py] = projection([-43.16, -22.91])!
  const view = { k, x: 500 - px * k, y: 260 - py * k }
  const tiles = satelliteTiles(view, .672, mobile)
  assert(tiles.length <= 128)
  for (let sx = 0; sx <= 1000; sx += 125) for (let sy = -410; sy <= 930; sy += 20) {
    const x = (sx - view.x) / k, y = (sy - view.y) / k
    if (x < 0 || x > 1000 || y < 10 || y > 510) continue
    assert(tiles.some(t => x >= t.x && x <= t.x + t.size && y >= t.y && y <= t.y + t.size), 'celular sem faixas de baixa resolução')
  }
}
console.log('OK: detalhes alinhados à projeção, resolução por zoom/DPR, polos, linha de data e cobertura sem buracos.')
