/** Amplia uma região do avião para caçar defeito de traço: npx tsx scripts/zoom.tsx b737 tail */
import { createServer } from 'node:http'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { AIRCRAFT } from '../src/game/data/aircraft'
import { LiveryPlane } from '../src/livery/LiveryPlane'
import { BLANK_LIVERY } from '../src/livery/presets'
import { geometry } from '../src/livery/silhouette'

const [id, zone = 'tail'] = process.argv.slice(2)
const t = AIRCRAFT.find((a) => a.id === id)!
const g = geometry(t)
const svg = renderToStaticMarkup(
  createElement(LiveryPlane, {
    type: t,
    livery: { ...BLANK_LIVERY, fuselage: '#f4f7fb', titles: '#1e3a8a' },
    titles: 'SKYLINE', registration: 'PR-SKY', showShadow: false,
  }),
)
const zones: Record<string, [number, number, number, number]> = {
  tail: [g.tailStart - g.L * 0.04, g.ground - (g.ground - (g.cy - g.D * 3)) * 0.42, g.L * 0.3, g.D * 3.2],
  wing: [g.x0 + g.L * 0.22, g.cy - g.D * 0.9, g.L * 0.55, g.D * 2.4],
  nose: [g.x0 - g.D * 0.1, g.cy - g.D * 1.1, g.L * 0.24, g.D * 2],
}
const v = zones[zone] ?? zones.tail
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e7ecf4}svg{width:100vw}</style>${
  svg.replace(/viewBox="[^"]*"/, `viewBox="${v.join(' ')}"`)}`
const server = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html) })
await new Promise<void>((r) => server.listen(4181, () => r()))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: Math.round(1400 * v[3] / v[2]) }, deviceScaleFactor: 2 })
await p.goto('http://localhost:4181/')
await p.waitForTimeout(150)
await p.screenshot({ path: `/tmp/zoom-${id}-${zone}.png` })
await b.close(); server.close()
console.log('ok')
