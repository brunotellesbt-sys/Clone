import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry as GeoGeometry } from 'geojson'
import world from 'world-atlas/countries-110m.json'
import { AIRPORTS, AIRPORT_BY_IATA, type Airport } from '../game/data/airports'
import { aircraftOf, metros, num, typeOf } from '../game/engine'
import { interpolate } from '../game/geo'
import type { GameState, Route } from '../game/types'

const W = 1000
const H = 520
const K_MAX = 9

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = feature(world as any, (world as any).objects.countries) as unknown as FeatureCollection<GeoGeometry>

interface Props {
  state: GameState
  height?: number
  selected?: string | null
  onPick?: (iata: string) => void
  focus?: string | null
  showCompetitors?: boolean
  /**
   * Modo de escolha: mostra um degrau de aeroporto a mais em cada nível de zoom
   * e marca o que dá para clicar. Serve à fundação da companhia, onde o mapa
   * **é** o seletor — sem isso metade dos aeroportos só aparece no zoom fundo.
   */
  picking?: boolean
}

/** Mantém o mundo preenchendo o quadro: arrastar não deixa o mapa sair da tela. */
function limitar(k: number, x: number, y: number) {
  const kk = Math.min(K_MAX, Math.max(1, k))
  return {
    k: kk,
    x: Math.min(0, Math.max(W - W * kk, x)),
    y: Math.min(0, Math.max(H - H * kk, y)),
  }
}

export function MapView({
  state, height = 520, selected, onPick, focus, showCompetitors = true, picking = false,
}: Props) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{ iata: string; x: number; y: number } | null>(null)
  const [voo, setVoo] = useState<string | null>(null)
  const [t, setT] = useState(0)
  const arrasto = useRef<{ px: number; py: number; vx: number; vy: number; id: number } | null>(null)
  /**
   * Se o ponteiro andou desde que desceu. Fica fora de `arrasto` de propósito:
   * o `click` só chega depois do `pointerup`, quando o arrasto já foi zerado, e
   * sem esta marca soltar o botão no fim de um arrasto contava como clique —
   * arrastar o mapa trocava a base escolhida.
   */
  const andou = useRef(false)
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
    setView(limitar(k, W / 2 - px * k, H / 2 - py * k))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  /**
   * A roda entra por ouvinte nativo, não pelo `onWheel` do React.
   *
   * React registra o wheel como passivo no raiz, e ouvinte passivo não pode
   * chamar `preventDefault` — o zoom funcionava, mas rolava a página junto e o
   * console enchia de aviso a cada giro.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      if (!r.width || !r.height) return
      const mx = ((e.clientX - r.left) / r.width) * W
      const my = ((e.clientY - r.top) / r.height) * H
      setView((v) => {
        const k = Math.min(K_MAX, Math.max(1, v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)))
        const s = k / v.k
        return limitar(k, mx - (mx - v.x) * s, my - (my - v.y) * s)
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const hubs = new Set(state.airline.hubs)
  const routes = state.airline.routes
  /**
   * Quem a companhia serve, num conjunto: com três mil aeroportos, perguntar
   * `routes.some(...)` para cada um era varrer a lista de rotas três mil vezes
   * por quadro.
   */
  const servidos = useMemo(() => {
    const s = new Set<string>()
    for (const r of routes) {
      s.add(r.from)
      s.add(r.to)
    }
    return s
  }, [routes])
  /**
   * Degrau mínimo para aparecer no mapa, pelo zoom.
   *
   * Existe porque a lista passou de 382 para 3.085 aeroportos: desenhar todos
   * põe três mil nós de SVG com tratador de ponteiro na tela e o arrasto do mapa
   * começa a engasgar. Afastado aparece só o que é hub de verdade; aproximando,
   * o mapa vai enchendo. Base própria e destino servido aparecem sempre, em
   * qualquer zoom — esses o jogador precisa ver.
   */
  const degrau = view.k < 1.6 ? 4 : view.k < 2.4 ? 3 : view.k < 3.6 ? 2 : 1
  const degrauMin = picking ? Math.max(1, degrau - 1) : degrau
  /**
   * A janela visível em coordenadas do mapa, com uma folga de meia tela.
   *
   * Aproximado, quase tudo está fora da tela, e desenhar fora da tela custa o
   * mesmo que desenhar dentro: é o que faz o zoom profundo valer a pena — em vez
   * de três mil marcadores espalhados pelo mundo, só os da região que o jogador
   * está olhando, e aí cabe mostrar até os regionais.
   */
  const folgaX = W / view.k / 2
  const folgaY = H / view.k / 2
  const visivel = {
    x0: -view.x / view.k - folgaX,
    x1: (W - view.x) / view.k + folgaX,
    y0: -view.y / view.k - folgaY,
    y1: (H - view.y) / view.k + folgaY,
  }
  const compRoutes = showCompetitors
    ? state.competitors.flatMap((c) => c.routes.slice(0, 10).map((r) => ({ ...r, color: c.color })))
    : []

  const arc = (from: string, to: string) => {
    const a = AIRPORT_BY_IATA[from]
    const b = AIRPORT_BY_IATA[to]
    if (!a || !b) return ''
    return path({ type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }) ?? ''
  }

  /** Pedaço do grande círculo entre duas frações da rota, amostrado. */
  const trecho = (a: Airport, b: Airport, t0: number, t1: number) => {
    if (t1 - t0 < 1e-4) return ''
    const n = 40
    const pts: [number, number][] = []
    for (let i = 0; i <= n; i++) pts.push(interpolate(a, b, t0 + (t1 - t0) * (i / n)))
    return path({ type: 'LineString', coordinates: pts }) ?? ''
  }

  /**
   * Onde cada avião está no traço da rota.
   *
   * A posição é da animação, não da simulação: o tick é diário e não acompanha
   * aeronave no ar. O que o traçado mostra de verdade é a rota, o avião alocado
   * a ela e para que lado ele vai — o resto é o relógio da tela.
   */
  const voos = useMemo(
    () =>
      routes.slice(0, 60).map((r, i) => {
        const a = AIRPORT_BY_IATA[r.from]
        const b = AIRPORT_BY_IATA[r.to]
        return { r, a, b, fase: (t + i * 0.137) % 1 }
      }).filter((v) => v.a && v.b),
    [routes, t],
  )

  const vooSel = voo ? voos.find((v) => v.r.id === voo) : null

  const dotR = (tier: number) => (1.4 + tier * 0.62) / Math.sqrt(view.k)
  const stroke = (w: number) => w / Math.sqrt(view.k)

  function onDown(e: React.PointerEvent) {
    if (e.button > 0) return
    if (!svgRef.current) return
    andou.current = false
    arrasto.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, id: e.pointerId }
  }

  function onMove(e: React.PointerEvent) {
    const d = arrasto.current
    const svg = svgRef.current
    if (!d || !svg || d.id !== e.pointerId) return
    const r = svg.getBoundingClientRect()
    if (!r.width || !r.height) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    /**
     * A captura só começa quando o ponteiro anda de verdade.
     *
     * Capturar já no `pointerdown` parecia mais seguro e quebrava o clique: com
     * a captura no SVG, o navegador entrega o `click` ao ancestral comum — o
     * próprio SVG — e nem o avião nem o marcador de aeroporto recebiam nada.
     * Do jeito certo, clique continua clique e arrasto ganha a captura, que é o
     * que mantém o `pointerup` chegando mesmo se o ponteiro sair do mapa.
     */
    if (!andou.current && Math.abs(dx) + Math.abs(dy) > 3) {
      andou.current = true
      try { svg.setPointerCapture(e.pointerId) } catch { /* sem captura, segue */ }
    }
    if (!andou.current) return
    /**
     * As contas saem **aqui**, e não dentro do `setView`.
     *
     * Este era o travamento ao arrastar o mapa. `pointermove` é evento contínuo:
     * o React agenda o render para depois, e o `pointerup` — que é discreto —
     * podia chegar antes, zerando `arrasto.current`. Aí a função de atualização
     * rodava com a referência já nula e a tela inteira caía na barreira de erro.
     * Com o zoom isso nunca aconteceu porque a roda não depende de referência
     * nenhuma, que é exatamente o que o relato dizia.
     */
    const x = d.vx + dx * (W / r.width)
    const y = d.vy + dy * (H / r.height)
    setView((v) => limitar(v.k, x, y))
  }

  function onUp(e: React.PointerEvent) {
    const d = arrasto.current
    if (!d) return
    const svg = svgRef.current
    if (svg?.hasPointerCapture?.(d.id)) {
      try { svg.releasePointerCapture(d.id) } catch { /* já solta */ }
    }
    if (d.id === e.pointerId) arrasto.current = null
  }

  /** Clique no vazio larga o voo selecionado — mas não quando foi arrasto. */
  const onFundo = () => { if (!andou.current) setVoo(null) }

  const hoverAp = hover ? AIRPORT_BY_IATA[hover.iata] : null

  return (
    <div className="mapwrap" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        <defs>
          <radialGradient id="ocean" cx="50%" cy="8%">
            <stop offset="0%" stopColor="#10243d" />
            <stop offset="55%" stopColor="#0a1729" />
            <stop offset="100%" stopColor="#050c18" />
          </radialGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#ocean)" onClick={onFundo} />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={gratPath} fill="none" stroke="#18293f" strokeWidth={stroke(0.5)} />
          <path d={landPath} fill="#1a2c42" stroke="#33506e" strokeWidth={stroke(0.6)} onClick={onFundo} />

          {compRoutes.map((r, i) => (
            <path key={`c${i}`} d={arc(r.from, r.to)} fill="none" stroke={r.color} strokeOpacity={0.15} strokeWidth={stroke(0.7)} />
          ))}

          {routes.map((r) => {
            // a rota escolhida sai da linha comum: quem a desenha é o traçado do
            // voo, e as duas juntas viravam três traços em cima do mesmo arco
            if (voo === r.id) return null
            const prof = r.history.length ? r.history[r.history.length - 1].profit : 0
            const color = r.history.length === 0 ? '#64748b' : prof >= 0 ? '#3ddc97' : '#ff7a8a'
            return (
              <path key={r.id} d={arc(r.from, r.to)} fill="none" stroke={color}
                strokeOpacity={voo ? 0.18 : 0.8}
                strokeWidth={stroke(1.5)} strokeLinecap="round" />
            )
          })}

          {/* trajeto do voo escolhido: o percorrido cheio, o que falta pontilhado */}
          {vooSel && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={trecho(vooSel.a, vooSel.b, vooSel.fase, 1)} fill="none"
                stroke="#93a6c4" strokeOpacity={0.75} strokeWidth={stroke(1.7)}
                strokeLinecap="round" strokeDasharray={`${stroke(4)} ${stroke(5)}`} />
              <path d={trecho(vooSel.a, vooSel.b, 0, vooSel.fase)} fill="none"
                stroke="#7cc7ff" strokeOpacity={0.42} strokeWidth={stroke(5)} strokeLinecap="round" />
              <path d={trecho(vooSel.a, vooSel.b, 0, vooSel.fase)} fill="none"
                stroke="#bfe4ff" strokeOpacity={0.9} strokeWidth={stroke(1.5)} strokeLinecap="round" />
            </g>
          )}

          {AIRPORTS.map((a) => {
            const isHub = hubs.has(a.iata)
            const isSel = selected === a.iata
            const served = servidos.has(a.iata)
            if (!isHub && !served && a.tier < degrauMin) return null
            const [px, py] = project(a.lon, a.lat)
            if (px < visivel.x0 || px > visivel.x1 || py < visivel.y0 || py > visivel.y1) return null
            return (
              <g key={a.iata}>
                {isSel && (
                  <circle cx={px} cy={py} r={dotR(a.tier) * 3.2} fill="none"
                    stroke="#ffc266" strokeOpacity={0.7} strokeWidth={stroke(1.1)} style={{ pointerEvents: 'none' }} />
                )}
                <circle
                  cx={px}
                  cy={py}
                  r={dotR(a.tier) * (isHub ? 1.7 : 1)}
                  fill={isSel ? '#ffc266' : isHub ? '#4fc3f7' : served ? '#a9bdf5' : '#54688f'}
                  stroke={isSel ? '#fff6e6' : 'rgba(4,10,20,.7)'}
                  strokeWidth={stroke(isSel ? 1.4 : 0.6)}
                  style={{ cursor: onPick ? 'pointer' : 'default' }}
                  onPointerEnter={(e) => setHover({ iata: a.iata, x: e.clientX, y: e.clientY })}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => { e.stopPropagation(); if (!andou.current) onPick?.(a.iata) }}
                />
                {(isHub || isSel || (view.k > 2.6 && a.tier >= 4)) && (
                  <text
                    x={px + dotR(a.tier) * 2}
                    y={py + 2.5 / Math.sqrt(view.k)}
                    fontSize={7.5 / Math.sqrt(view.k)}
                    fill={isSel ? '#ffe0ac' : isHub ? '#bae6fd' : '#8ea3c9'}
                    style={{ pointerEvents: 'none', fontWeight: 700 }}
                  >
                    {a.iata}
                  </text>
                )}
              </g>
            )
          })}
          {/* avião por último: desenhado depois do aeroporto, ele fica por cima
              e o clique é dele — antes o marcador do aeroporto de origem roubava */}
          {voos.map(({ r, a, b, fase }) => {
            const [lon, lat] = interpolate(a, b, fase)
            const [x, y] = project(lon, lat)
            const [lon2, lat2] = interpolate(a, b, Math.min(1, fase + 0.01))
            const [x2, y2] = project(lon2, lat2)
            const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI
            const on = voo === r.id
            const s = (on ? 2.2 : 1.5) / Math.sqrt(view.k)
            return (
              <g key={`p${r.id}`} transform={`translate(${x},${y}) rotate(${ang}) scale(${s})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (!andou.current) setVoo(on ? null : r.id) }}>
                {/* alvo de clique folgado: a seta tem 8 px de ponta a ponta */}
                <circle r="6" fill="transparent" />
                <path d="M4.5 0 L-3 2.6 L-1.6 0 L-3 -2.6 Z"
                  fill={on ? '#ffd27a' : '#e2f4ff'} stroke="#0b1220" strokeWidth="0.4"
                  filter={on ? 'url(#glow)' : undefined} />
              </g>
            )
          })}

        </g>
      </svg>

      <div className="map-tools">
        <button onClick={() => setView((v) => limitar(v.k * 1.35, v.x, v.y))} title="Aproximar">+</button>
        <button onClick={() => setView((v) => limitar(v.k / 1.35, v.x, v.y))} title="Afastar">−</button>
        <button onClick={() => setView({ k: 1, x: 0, y: 0 })} title="Ver o mundo todo">⤢</button>
      </div>

      <div className="map-legend">
        {picking ? (
          <span>Clique num aeroporto para escolher a base · a roda aproxima e revela os menores</span>
        ) : (
          <>
            <span><i className="dot hub" /> base</span>
            <span><i className="dash good" /> rota no lucro</span>
            <span><i className="dash bad" /> rota no prejuízo</span>
            {routes.length > 0 && <span className="muted">clique num avião para ver o trajeto</span>}
          </>
        )}
      </div>

      {vooSel && <CartaoVoo state={state} r={vooSel.r} fase={vooSel.fase} onClose={() => setVoo(null)} />}

      {hoverAp && (
        <div className="map-tip" style={{ left: Math.min(hover!.x - 8, window.innerWidth - 220), top: hover!.y - 62 }}>
          <b>{hoverAp.iata}</b> · {hoverAp.city}, {hoverAp.country}
          <br />
          <span className="muted">
            pista {metros(hoverAp.runway)} · {hoverAp.pop.toFixed(1)} mi hab
          </span>
        </div>
      )}
    </div>
  )
}

/** O que o jogador quer saber ao clicar num avião: quem é, indo para onde. */
function CartaoVoo({ state, r, fase, onClose }: { state: GameState; r: Route; fase: number; onClose: () => void }) {
  const a = AIRPORT_BY_IATA[r.from]
  const b = AIRPORT_BY_IATA[r.to]
  const ac = r.aircraftIds.map((id) => aircraftOf(state, id)).find(Boolean)
  const tipo = ac ? typeOf(ac) : null
  const restante = r.distance * (1 - fase)
  return (
    <div className="map-card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <b>{r.from} → {r.to}</b>
        <button className="x" onClick={onClose} title="Fechar">×</button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{a.city} → {b.city}</div>
      <div className="voo-barra"><i style={{ width: `${fase * 100}%` }} /></div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5 }}>
        <span className="dim">{num(r.distance - restante)} nm feitos</span>
        <span className="muted">faltam {num(restante)} nm</span>
      </div>
      {ac && tipo && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {tipo.maker} {tipo.name} · {ac.reg}
        </div>
      )}
      {!ac && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Nenhuma aeronave alocada.</div>}
    </div>
  )
}
