import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry as GeoGeometry } from 'geojson'
import world from 'world-atlas/countries-110m.json'
import { AIRPORTS, AIRPORT_BY_IATA } from '../game/data/airports'
import { interpolate } from '../game/geo'
import type { GameState } from '../game/types'

const W = 1000
const H = 520

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = feature(world as any, (world as any).objects.countries) as unknown as FeatureCollection<GeoGeometry>

interface Props {
  state: GameState
  height?: number
  selected?: string | null
  onPick?: (iata: string) => void
  focus?: string | null
  showCompetitors?: boolean
}

export function MapView({ state, height = 520, selected, onPick, focus, showCompetitors = true }: Props) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{ iata: string; x: number; y: number } | null>(null)
  const [t, setT] = useState(0)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const projection = useMemo(
    () => geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' }),
    [],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const project = (lon: number, lat: number) => projection([lon, lat]) ?? [0, 0]

  const landPath = useMemo(() => path(land) ?? '', [path])
  const gratPath = useMemo(() => path(geoGraticule10()) ?? '', [path])

  // animação das aeronaves
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      if (now - last > 55) {
        setT((v) => (v + 0.0016) % 1)
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // centraliza numa base ao trocar de foco
  useEffect(() => {
    if (!focus || !AIRPORT_BY_IATA[focus]) return
    const ap = AIRPORT_BY_IATA[focus]
    const [px, py] = project(ap.lon, ap.lat)
    const k = 2.1
    setView({ k, x: W / 2 - px * k, y: H / 2 - py * k })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  const hubs = new Set(state.airline.hubs)
  const routes = state.airline.routes
  const compRoutes = showCompetitors
    ? state.competitors.flatMap((c) => c.routes.slice(0, 10).map((r) => ({ ...r, color: c.color })))
    : []

  const arc = (from: string, to: string) => {
    const a = AIRPORT_BY_IATA[from]
    const b = AIRPORT_BY_IATA[to]
    if (!a || !b) return ''
    return path({ type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }) ?? ''
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    const my = ((e.clientY - rect.top) / rect.height) * H
    setView((v) => {
      const k = Math.min(9, Math.max(1, v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)))
      const s = k / v.k
      return { k, x: mx - (mx - v.x) * s, y: my - (my - v.y) * s }
    })
  }

  function onDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return
    const rect = svgRef.current!.getBoundingClientRect()
    const sx = W / rect.width
    const sy = H / rect.height
    setView((v) => ({
      ...v,
      x: drag.current!.vx + (e.clientX - drag.current!.x) * sx,
      y: drag.current!.vy + (e.clientY - drag.current!.y) * sy,
    }))
  }
  const onUp = () => { drag.current = null }

  const dotR = (tier: number) => (1.4 + tier * 0.62) / Math.sqrt(view.k)
  const stroke = (w: number) => w / Math.sqrt(view.k)

  const hoverAp = hover ? AIRPORT_BY_IATA[hover.iata] : null

  return (
    <div className="mapwrap" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <defs>
          <radialGradient id="ocean" cx="50%" cy="12%">
            <stop offset="0%" stopColor="#122a48" />
            <stop offset="100%" stopColor="#060d1c" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#ocean)" />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={gratPath} fill="none" stroke="#1b2c4a" strokeWidth={stroke(0.5)} />
          <path d={landPath} fill="#1d3252" stroke="#33507f" strokeWidth={stroke(0.6)} />

          {compRoutes.map((r, i) => (
            <path key={`c${i}`} d={arc(r.from, r.to)} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke(0.7)} />
          ))}

          {routes.map((r) => {
            const prof = r.history.length ? r.history[r.history.length - 1].profit : 0
            const color = r.history.length === 0 ? '#64748b' : prof >= 0 ? '#34d399' : '#fb7185'
            return (
              <path key={r.id} d={arc(r.from, r.to)} fill="none" stroke={color} strokeOpacity={0.85}
                strokeWidth={stroke(1.5)} strokeLinecap="round" />
            )
          })}

          {routes.slice(0, 60).map((r, i) => {
            const a = AIRPORT_BY_IATA[r.from]
            const b = AIRPORT_BY_IATA[r.to]
            if (!a || !b) return null
            const phase = (t + i * 0.137) % 1
            const [lon, lat] = interpolate(a, b, phase)
            const [x, y] = project(lon, lat)
            const [lon2, lat2] = interpolate(a, b, Math.min(1, phase + 0.01))
            const [x2, y2] = project(lon2, lat2)
            const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI
            const s = 1.5 / Math.sqrt(view.k)
            return (
              <g key={`p${r.id}`} transform={`translate(${x},${y}) rotate(${ang}) scale(${s})`}>
                <path d="M4.5 0 L-3 2.6 L-1.6 0 L-3 -2.6 Z" fill="#e2f4ff" stroke="#0b1220" strokeWidth="0.4" />
              </g>
            )
          })}

          {AIRPORTS.map((a) => {
            const isHub = hubs.has(a.iata)
            const isSel = selected === a.iata
            const served = routes.some((r) => r.from === a.iata || r.to === a.iata)
            if (!isHub && !served && a.tier < 3 && view.k < 2.2) return null
            return (
              <g key={a.iata}>
                <circle
                  cx={project(a.lon, a.lat)[0]}
                  cy={project(a.lon, a.lat)[1]}
                  r={dotR(a.tier) * (isHub ? 1.7 : 1)}
                  fill={isHub ? '#38bdf8' : served ? '#a5b4fc' : '#4c5f86'}
                  stroke={isSel ? '#fff' : 'rgba(4,10,20,.7)'}
                  strokeWidth={stroke(isSel ? 1.4 : 0.6)}
                  style={{ cursor: 'pointer' }}
                  onPointerEnter={(e) => setHover({ iata: a.iata, x: e.clientX, y: e.clientY })}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => { e.stopPropagation(); onPick?.(a.iata) }}
                />
                {(isHub || (view.k > 2.6 && a.tier >= 4)) && (
                  <text
                    x={project(a.lon, a.lat)[0] + dotR(a.tier) * 2}
                    y={project(a.lon, a.lat)[1] + 2.5 / Math.sqrt(view.k)}
                    fontSize={7.5 / Math.sqrt(view.k)}
                    fill={isHub ? '#bae6fd' : '#8ea3c9'}
                    style={{ pointerEvents: 'none', fontWeight: 700 }}
                  >
                    {a.iata}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="map-tools">
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(9, v.k * 1.35) }))} title="Aproximar">+</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(1, v.k / 1.35) }))} title="Afastar">−</button>
        <button onClick={() => setView({ k: 1, x: 0, y: 0 })} title="Ver o mundo todo">⤢</button>
      </div>

      <div className="map-legend">
        <span><b style={{ color: '#38bdf8' }}>●</b> base</span>
        <span><b style={{ color: '#34d399' }}>—</b> rota no lucro</span>
        <span><b style={{ color: '#fb7185' }}>—</b> rota no prejuízo</span>
        {showCompetitors && <span className="muted">linhas fracas: concorrência</span>}
      </div>

      {hoverAp && (
        <div className="map-tip" style={{ left: Math.min(hover!.x - 8, window.innerWidth - 220), top: hover!.y - 62 }}>
          <b>{hoverAp.iata}</b> · {hoverAp.city}, {hoverAp.country}
          <br />
          <span className="muted">
            pista {hoverAp.runway.toLocaleString('pt-BR')} ft · {hoverAp.pop.toFixed(1)} mi hab
          </span>
        </div>
      )}
    </div>
  )
}
