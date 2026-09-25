import assert from 'node:assert/strict'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { AIRPORT_BY_IATA as AP } from '../src/game/data/airports'
import { flightPose, MAP_MAX_ZOOM, spriteRotation } from '../src/ui/mapGeometry'

const projection = geoEquirectangular().fitExtent([[0, 10], [1000, 510]], { type: 'Sphere' }).precision(.2 / MAP_MAX_ZOOM)
for (const [from, to] of [['SDU', 'BSB'], ['BSB', 'SDU'], ['GRU', 'LHR'], ['LHR', 'GRU'], ['LAX', 'HND'], ['HND', 'LAX']]) {
  const a = AP[from], b = AP[to]
  const segments: number[][] = []
  let previous = [0, 0]
  geoPath(projection, {
    moveTo(x: number, y: number) { previous = [x, y] },
    lineTo(x: number, y: number) { segments.push([...previous, x, y]); previous = [x, y] },
    beginPath() {}, closePath() {}, arc() {},
  })({ type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] })
  for (const phase of [.01, .2, .49, .5, .51, .8, .99]) {
    const p = flightPose(projection, a, b, phase), next = flightPose(projection, a, b, phase + .001)
    let dx = next.x - p.x
    if (dx > 500) dx -= 1000
    if (dx < -500) dx += 1000
    const dy = next.y - p.y
    for (const original of [true, false]) {
      const angle = (p.angle + spriteRotation(original)) * Math.PI / 180
      const nose = original ? 1 : -1 // PNG original aponta para baixo, ícone para cima.
      assert((-nose * Math.sin(angle)) * dx + nose * Math.cos(angle) * dy > 0, `${from}-${to}: nariz acompanha o deslocamento`)
    }
    const distance = Math.min(...segments.map(([x1, y1, x2, y2]) => {
      const vx = x2 - x1, vy = y2 - y1
      const t = Math.max(0, Math.min(1, ((p.x - x1) * vx + (p.y - y1) * vy) / (vx * vx + vy * vy)))
      return Math.hypot(p.x - x1 - vx * t, p.y - y1 - vy * t)
    }))
    assert(distance * MAP_MAX_ZOOM < .3, `${from}-${to}: avião sobre a curva também em ${MAP_MAX_ZOOM}× (${distance * MAP_MAX_ZOOM}px)`)
  }
}
console.log('OK: nariz no sentido do voo, ida/volta, linha de data e alinhamento do arco no zoom máximo.')
