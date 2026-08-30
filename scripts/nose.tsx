/**
 * Renderiza o nariz de cada modelo em ampliação forte, para conferir a cabine
 * de comando de perto. `npx tsx scripts/nose.tsx b737 a321neo b789 atr72`
 */
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { AIRCRAFT } from '../src/game/data/aircraft'
import { LiveryPlane } from '../src/livery/LiveryPlane'
import { BLANK_LIVERY } from '../src/livery/presets'
import { geometry } from '../src/livery/silhouette'

const ids = process.argv.slice(2)
const cards = ids.map((id) => {
  const t = AIRCRAFT.find((a) => a.id === id)
  if (!t) throw new Error(`modelo desconhecido: ${id}`)
  const g = geometry(t)
  const svg = renderToStaticMarkup(
    createElement(LiveryPlane, {
      type: t,
      livery: { ...BLANK_LIVERY, fuselage: '#f4f7fb', titles: '#1e3a8a' },
      titles: 'SKYLINE',
      registration: 'PR-SKY',
      showShadow: false,
    }),
  )
  // recorte só do nariz, salvo com --cheio para ver o avião todo
  const full = process.env.FULL === '1'
  const w = g.L * 0.22
  const view = full ? '0 0 1000 300' : `${g.x0 - w * 0.06} ${g.top - g.D * 0.55} ${w} ${g.D * 1.7}`
  const cropped = svg.replace(/viewBox="[^"]*"/, `viewBox="${view}"`)
  return `<figure><figcaption>${t.maker} ${t.name}</figcaption>${cropped}</figure>`
})

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#dfe6f0;font:13px system-ui;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}
figure{margin:0;background:#fff;border-radius:8px;padding:6px}
figcaption{font-weight:700;color:#334;padding:2px 4px}
svg{width:100%;display:block}
</style>${cards.join('')}`
writeFileSync('/tmp/nose.html', html)

const server = createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(html)
})
await new Promise<void>((r) => server.listen(4177, () => r()))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4177/')
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/nose.png', fullPage: true })
await browser.close()
server.close()
console.log('ok')
