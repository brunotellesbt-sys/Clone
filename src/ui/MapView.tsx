import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry as GeoGeometry } from 'geojson'
import world from 'world-atlas/countries-110m.json'
import { AIRPORTS, AIRPORT_BY_IATA, ESCOPO_LABEL, type Airport } from '../game/data/airports'
import { aircraftOf, dowOf, km, metros, num, typeOf } from '../game/engine'
import { MS_POR_DIA_NA_TELA } from './relogio'
import { blocoDe, DIA, DOW_CURTO, escalaDe, hhmm, naSemana, noTempo, partidaUtc, rotaDoPar } from '../game/escala'
import { distanceBetween, interpolate } from '../game/geo'
import { spriteMapa } from '../livery/mapSprites'
import { flightPose, MAP_MAX_ZOOM, spriteRotation } from './mapGeometry'
import type { Aircraft, GameState, Perna, Route } from '../game/types'

const W = 1000
const H = 520
const SATELLITE = `${import.meta.env.BASE_URL}nasa-blue-marble.jpg`
const PLANE_FALLBACK = `${import.meta.env.BASE_URL}assets_icons_png_vertical_plane_icon.png`
/**
 * Zoom até 72× para separar aeroportos próximos e acompanhar o avião de perto.
 */
const K_MAX = MAP_MAX_ZOOM
/**
 * O tamanho do que é desenhado cresce com a raiz do zoom, mas para de crescer
 * aqui. Sem o teto, no zoom fundo o marcador de aeroporto virava uma bola
 * cobrindo a cidade inteira — o zoom serve para separar, não para engordar.
 */
const K_DESENHO = 9

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
  const [airport, setAirport] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lines, setLines] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('skyline-map-lines') ?? '{}')
      return { own: saved?.own !== false, rivals: saved?.rivals === true, trail: saved?.trail !== false }
    }
    catch { return { own: true, rivals: false, trail: true } }
  })
  const toggleLine = (key: 'own' | 'rivals' | 'trail', enabled: boolean) => {
    const next = { ...lines, [key]: enabled }
    setLines(next)
    try { localStorage.setItem('skyline-map-lines', JSON.stringify(next)) } catch { /* preferência só nesta sessão */ }
  }
  /**
   * O relógio da tela, de 0 a 1 no dia. Começa às 8h e não à meia-noite: agora
   * que o avião no mapa é uma perna de verdade da escala, a madrugada está
   * vazia — como na vida real —, e abrir o mapa num pátio deserto parece
   * defeito. Às oito da manhã a grade está cheia.
   */
  const [t, setT] = useState(8 / 24)
  /**
   * Todos os dedos (ou o ponteiro do mouse) encostados no mapa agora.
   *
   * Era um só, e por isso a pinça não existia: o segundo dedo era descartado
   * logo na entrada do `pointermove`, e o primeiro continuava arrastando — a
   * pinça saía como um arrasto trêmulo. Guardar todos é o que permite decidir
   * entre arrastar (um) e aproximar (dois).
   */
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  /**
   * O gesto em curso, com as medidas de onde ele começou.
   *
   * As bases ficam congeladas no início e a conta é sempre contra elas, nunca
   * contra o quadro anterior: somar deltas quadro a quadro acumula erro de
   * arredondamento e a pinça vai escorregando do ponto entre os dedos.
   */
  const gesto = useRef<
    | { tipo: 'arrasto'; px: number; py: number; vx: number; vy: number; id: number }
    | { tipo: 'pinca'; dist: number; mx: number; my: number; k: number; vx: number; vy: number }
    | null
  >(null)
  /**
   * Se o ponteiro andou desde que desceu. Fica fora do gesto de propósito:
   * o `click` só chega depois do `pointerup`, quando o gesto já foi zerado, e
   * sem esta marca soltar o botão no fim de um arrasto contava como clique —
   * arrastar o mapa trocava a base escolhida.
   */
  const andou = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  /**
   * A vista de agora, fora do React.
   *
   * O estado só chega ao tratador de evento no próximo render, e gesto de dedo
   * não espera render: entre dois `pointermove` a vista já mudou. Guardar a
   * verdade aqui e espelhar em `setView` deixa cada quadro medir contra o valor
   * real, e mantém a regra que este arquivo aprendeu do jeito difícil — **nada
   * de efeito colateral dentro do atualizador do `setState`**. Foi o que
   * derrubava a tela ao arrastar.
   */
  const vista = useRef({ k: 1, x: 0, y: 0 })
  /**
   * Dedo ou mouse? Só muda o texto da legenda — não há roda para girar num
   * celular, e mandar girar a roda é instrução que não leva a lugar nenhum.
   */
  const noDedo = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  )
  const aplicar = (v: { k: number; x: number; y: number }) => {
    vista.current = v
    setView(v)
  }

  const projection = useMemo(
    () => geoEquirectangular().fitExtent([[0, 10], [W, H - 10]], { type: 'Sphere' }).precision(0.2 / view.k),
    [view.k],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const project = (lon: number, lat: number) => projection([lon, lat]) ?? [0, 0]

  const landPath = useMemo(() => path(land) ?? '', [path])
  const gratPath = useMemo(() => path(geoGraticule10()) ?? '', [path])

  /**
   * Animação das aeronaves — e ela respeita a pausa.
   *
   * Este laço era o defeito por trás de "o jogo não pausa quando aperto em
   * pausar". O relógio do jogo parava certinho: o dia trava no clique, medido
   * em todas as velocidades. O que não parava era **o mapa** — ele tem o próprio
   * `requestAnimationFrame` para mover os aviões pela rota, e ele não olhava
   * `paused`. O jogador pausava, via a frota continuar voando e concluía, com
   * razão, que a pausa não funcionava.
   *
   * O relógio da legenda sai daqui também, então parar o laço para os dois
   * juntos, que é o que se espera de uma pausa.
   */
  useEffect(() => {
    if (state.paused || state.speed === 0) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      /**
       * O relógio do mapa anda na mesma escala do jogo.
       *
       * Ele andava 0,0016 de dia a cada 55 ms — um dia inteiro em trinta e
       * quatro segundos, a 1× e a 40× igual. O avião desenhado nunca esteve
       * onde a simulação dizia que ele estava, e a legenda mostrava uma hora
       * que não era a de ninguém. Agora o passo é o tempo que passou dividido
       * pelo que um dia custa nesta velocidade (`MS_POR_DIA_NA_TELA`, que é
       * a **mesma** escala da batida do dia — ver `src/ui/relogio.ts`).
       */
      const dt = now - last
      if (dt > 55) {
        setT((v) => (v + (dt * state.speed) / MS_POR_DIA_NA_TELA) % 1)
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state.paused, state.speed])

  // centraliza numa base ao trocar de foco
  useEffect(() => {
    if (!focus || !AIRPORT_BY_IATA[focus]) return
    const ap = AIRPORT_BY_IATA[focus]
    const [px, py] = project(ap.lon, ap.lat)
    const k = 2.1
    aplicar(limitar(k, W / 2 - px * k, H / 2 - py * k))
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
      const v = vista.current
      const k = Math.min(K_MAX, Math.max(1, v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)))
      const s = k / v.k
      aplicar(limitar(k, mx - (mx - v.x) * s, my - (my - v.y) * s))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const hubs = new Set(state.airline.hubs)
  const routes = state.airline.routes
  /** O relógio do mapa é mostrado na hora da base principal. */
  const refFuso = state.airline.hubs[0] ?? 'GRU'
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
   * Os voos no ar agora, tirados da escala.
   *
   * Antes era um avião por rota, com a fase espalhada por um contador — o mapa
   * mostrava a rota, não a operação. Agora cada marcador é uma **perna** de
   * verdade do dia da semana em curso, e ele só aparece enquanto aquela perna
   * estaria no ar: o pico da manhã enche o mapa, a madrugada esvazia, e a
   * aeronave que emenda para um terceiro aeroporto aparece indo para lá.
   *
   * O relógio ainda é o da tela, e isso continua sendo verdade: o tick é diário
   * e não acompanha aeronave minuto a minuto. O que mudou é que o relógio da
   * tela agora percorre a **grade que o jogador montou**, em vez de inventar
   * uma fase por rota.
   */
  const voos = useMemo(() => {
    const dow = dowOf(state)
    /**
     * O relógio da tela, em UTC.
     *
     * Tem que ser UTC, e não hora local de cada origem: a hora marcada na perna
     * é local, então comparar hora local com hora local poria no ar, ao mesmo
     * tempo, um voo que sai 08:00 de Guarulhos e outro que sai 08:00 de Lisboa —
     * que estão a três horas de distância. É o mesmo erro que a escala já não
     * comete, e o mapa não tem por que cometer sozinho.
     */
    const agora = dow * DIA + t * DIA
    const out: {
      id: string; r: Route | undefined; ac: ReturnType<typeof aircraftOf>
      a: Airport; b: Airport; fase: number; perna: Perna; bloco: number
    }[] = []
    for (const p of escalaDe(state)) {
      const ac = aircraftOf(state, p.aircraftId)
      if (!ac || ac.groundedUntil > state.day) continue
      const a = AIRPORT_BY_IATA[p.from]
      const b = AIRPORT_BY_IATA[p.to]
      if (!a || !b) continue
      const bloco = blocoDe(state, p)
      const decorrido = naSemana(agora - partidaUtc(p))
      if (decorrido >= bloco) continue
      out.push({
        id: p.id, perna: p, bloco, a, b,
        r: rotaDoPar(state, p.from, p.to),
        ac,
        fase: bloco > 0 ? decorrido / bloco : 0,
      })
      if (out.length >= 80) break
    }
    return out
  }, [state, t])

  const vooSel = voo ? voos.find((v) => v.id === voo) : null

  /**
   * Pousou, acabou a seleção.
   *
   * O traçado e o cartão já sumiam no pouso, porque os dois dependem de o voo
   * estar no ar — mas a escolha ficava guardada. Quando o relógio da tela dava
   * a volta e aquela mesma perna decolava de novo, a linha e o cartão voltavam
   * sozinhos, sem ninguém clicar em nada.
   */
  useEffect(() => {
    if (voo && !vooSel) setVoo(null)
  }, [voo, vooSel])

  /**
   * De unidade de tela para unidade de mapa. O grupo já está escalado por
   * `view.k`, então dividir por ele devolve tamanho constante na tela; a raiz
   * por cima faz o marcador crescer um pouco ao aproximar, e o teto faz ele
   * parar de crescer no zoom fundo.
   */
  const fator = Math.sqrt(Math.min(view.k, K_DESENHO)) / view.k
  const dotR = (tier: number) => (1.4 + tier * 0.62) * fator
  const stroke = (w: number) => w * fator

  /** Os dois primeiros dedos, na ordem em que encostaram. */
  const doisDedos = () => [...dedos.current.values()].slice(0, 2)

  /**
   * (Re)começa o gesto a partir dos dedos que estão na tela agora.
   *
   * Chamado quando um dedo entra e quando um sai. Recomeçar na saída é o que
   * impede o pulo: ao soltar um dedo no fim de uma pinça, o que sobra vira um
   * arrasto novo, com base própria, em vez de continuar medindo contra uma
   * distância que não existe mais.
   */
  function refazerGesto(vista: { k: number; x: number; y: number }) {
    const [a, b] = doisDedos()
    if (a && b) {
      gesto.current = {
        tipo: 'pinca',
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        k: vista.k, vx: vista.x, vy: vista.y,
      }
    } else if (a) {
      gesto.current = { tipo: 'arrasto', px: a.x, py: a.y, vx: vista.x, vy: vista.y, id: [...dedos.current.keys()][0] }
    } else {
      gesto.current = null
    }
  }

  function onDown(e: React.PointerEvent) {
    if (e.button > 0) return
    if (!svgRef.current) return
    if (dedos.current.size === 0) andou.current = false
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size > 1) {
      /**
       * O segundo dedo já é pinça, e pinça nunca é clique — então a captura vem
       * na hora, sem esperar os 3 px que o arrasto exige. Os dois dedos são
       * capturados: num gesto de pinça é comum um deles sair da borda do mapa, e
       * sem captura ele deixaria de ser entregue no meio do movimento.
       */
      andou.current = true
      for (const id of dedos.current.keys()) {
        try { svgRef.current.setPointerCapture(id) } catch { /* sem captura, segue */ }
      }
    }
    refazerGesto(vista.current)
  }

  function onMove(e: React.PointerEvent) {
    const svg = svgRef.current
    if (!svg || !dedos.current.has(e.pointerId)) return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesto.current
    if (!g) return
    const r = svg.getBoundingClientRect()
    if (!r.width || !r.height) return
    /** De pixel da tela para unidade do `viewBox`. */
    const paraVb = (cx: number, cy: number): [number, number] =>
      [((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * H]

    if (g.tipo === 'pinca') {
      const [a, b] = doisDedos()
      if (!a || !b) return
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      /**
       * A escala é a razão entre a distância de agora e a do começo do gesto, e
       * o ponto entre os dedos fica parado.
       *
       * Parado de verdade: o ponto do mapa que estava sob o meio dos dedos no
       * início é recalculado para cair sob o meio de agora. É a mesma conta que
       * a roda do mouse já fazia em volta do cursor — a diferença é que aqui o
       * ponto de ancoragem também anda, e é isso que deixa a pinça aproximar e
       * arrastar no mesmo gesto, como qualquer mapa de celular faz.
       */
      const k = Math.min(K_MAX, Math.max(1, g.k * (dist / g.dist)))
      const [mx0, my0] = paraVb(g.mx, g.my)
      const [mx1, my1] = paraVb((a.x + b.x) / 2, (a.y + b.y) / 2)
      const px = (mx0 - g.vx) / g.k
      const py = (my0 - g.vy) / g.k
      aplicar(limitar(k, mx1 - px * k, my1 - py * k))
      return
    }

    const dx = e.clientX - g.px
    const dy = e.clientY - g.py
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
     * podia chegar antes, zerando a referência do gesto. Aí a função de
     * atualização rodava com a referência já nula e a tela inteira caía na
     * barreira de erro. Com o zoom isso nunca aconteceu porque a roda não
     * depende de referência nenhuma, que é exatamente o que o relato dizia.
     */
    const x = g.vx + dx * (W / r.width)
    const y = g.vy + dy * (H / r.height)
    aplicar(limitar(vista.current.k, x, y))
  }

  function onUp(e: React.PointerEvent) {
    if (!dedos.current.delete(e.pointerId)) return
    const svg = svgRef.current
    if (svg?.hasPointerCapture?.(e.pointerId)) {
      try { svg.releasePointerCapture(e.pointerId) } catch { /* já solta */ }
    }
    // o que sobrou vira gesto novo, medido a partir da vista de agora
    refazerGesto(vista.current)
  }

  /** Clique no vazio larga o voo selecionado — mas não quando foi arrasto. */
  const onFundo = () => { if (!andou.current) { setVoo(null); setAirport(null) } }

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
          <image href={SATELLITE} x="0" y="10" width={W} height={H - 20}
            preserveAspectRatio="none" onClick={onFundo} />
          <path d={gratPath} fill="none" stroke="#a9c5dd" strokeOpacity="0.1" strokeWidth={stroke(0.5)} />
          <path d={landPath} fill="none" stroke="#b9d7ee" strokeOpacity="0.28" strokeWidth={stroke(0.55)} onClick={onFundo} />

          {lines.rivals && compRoutes.map((r, i) => (
            <path className="map-rival-route" key={`c${i}`} d={arc(r.from, r.to)} fill="none" stroke={r.color} strokeOpacity={0.15} strokeWidth={stroke(0.7)} />
          ))}

          {lines.own && routes.map((r) => {
            // a rota escolhida sai da linha comum: quem a desenha é o traçado do
            // voo, e as duas juntas viravam três traços em cima do mesmo arco
            if (lines.trail && vooSel?.r?.id === r.id) return null
            const prof = r.history.length ? r.history[r.history.length - 1].profit : 0
            const color = r.history.length === 0 ? '#64748b' : prof >= 0 ? '#3ddc97' : '#ff7a8a'
            return (
              <path className="map-own-route" key={r.id} d={arc(r.from, r.to)} fill="none" stroke={color}
                strokeOpacity={voo ? 0.18 : 0.8}
                strokeWidth={stroke(1.5)} strokeLinecap="round" />
            )
          })}

          {/* trajeto do voo escolhido: o percorrido cheio, o que falta pontilhado */}
          {lines.trail && vooSel && (
            <g className="map-flight-trail" style={{ pointerEvents: 'none' }}>
              <path d={trecho(vooSel.a, vooSel.b, vooSel.fase, 1)} fill="none"
                stroke="#93a6c4" strokeOpacity={0.75} strokeWidth={stroke(1.7)}
                strokeLinecap="round" strokeDasharray={`${stroke(4)} ${stroke(5)}`} />
              <path d={trecho(vooSel.a, vooSel.b, 0, vooSel.fase)} fill="none"
                stroke="#7cc7ff" strokeOpacity={0.42} strokeWidth={stroke(5)} strokeLinecap="round" />
              <path d={trecho(vooSel.a, vooSel.b, 0, vooSel.fase)} fill="none"
                stroke="#bfe4ff" strokeOpacity={0.9} strokeWidth={stroke(1.5)} strokeLinecap="round" />
            </g>
          )}

          {/* Bases desenhadas por último para aeroportos vizinhos não roubarem o clique. */}
          {[...AIRPORTS.filter(a => !hubs.has(a.iata)), ...AIRPORTS.filter(a => hubs.has(a.iata))].map((a) => {
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
                  aria-label={`Aeroporto ${a.iata}`}
                  cx={px}
                  cy={py}
                  r={dotR(a.tier) * (isHub ? 1.7 : 1)}
                  fill={isSel ? '#ffc266' : isHub ? '#4fc3f7' : served ? '#a9bdf5' : '#54688f'}
                  stroke={isSel ? '#fff6e6' : 'rgba(4,10,20,.7)'}
                  strokeWidth={stroke(isSel ? 1.4 : 0.6)}
                  style={{ cursor: 'pointer' }}
                  onPointerEnter={(e) => setHover({ iata: a.iata, x: e.clientX, y: e.clientY })}
                  onPointerLeave={() => setHover(null)}
                  onClick={(e) => { e.stopPropagation(); if (!andou.current) { if (onPick) onPick(a.iata); else { setAirport(a.iata); setVoo(null) } } }}
                />
                {(isHub || isSel || (view.k > 2.6 && a.tier >= 4)) && (
                  <text
                    x={px + dotR(a.tier) * 2}
                    y={py + 2.5 * fator}
                    fontSize={7.5 * fator}
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
          {voos.map(({ id, a, b, fase, ac }) => {
            const { x, y, angle: ang } = flightPose(projection, a, b, fase, W)
            const on = voo === id
            const s = (on ? 2.2 : 1.5) * fator
            const sprite = ac ? spriteMapa(ac.typeId, on) : null
            return (
              <g key={`p${id}`} transform={`translate(${x},${y}) rotate(${ang}) scale(${s})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (!andou.current) setVoo(on ? null : id) }}>
                {/* alvo de clique folgado: a seta tem 8 px de ponta a ponta */}
                <circle r="6" fill="transparent" />
                <image href={sprite ?? PLANE_FALLBACK} x="-4" y="-4" width="8" height="8"
                  transform={`rotate(${spriteRotation(!!sprite)})`} filter={on ? 'url(#glow)' : undefined} />
              </g>
            )
          })}

        </g>
      </svg>

      {/* os botões passam pelo `aplicar` como todo o resto: escrever direto no
          estado deixaria o gesto seguinte medindo contra uma vista velha, e o
          mapa saltaria de volta no primeiro toque depois do botão */}
      <div className="map-tools">
        <button onClick={() => setSettingsOpen(!settingsOpen)} title="Configurações do mapa" aria-label="Configurações do mapa" aria-expanded={settingsOpen}>⚙</button>
        <button onClick={() => aplicar(limitar(vista.current.k * 1.35, vista.current.x, vista.current.y))} title="Aproximar" aria-label="Aproximar">+</button>
        <button onClick={() => aplicar(limitar(vista.current.k / 1.35, vista.current.x, vista.current.y))} title="Afastar" aria-label="Afastar">−</button>
        <button onClick={() => aplicar({ k: 1, x: 0, y: 0 })} title="Ver o mundo todo" aria-label="Ver o mundo todo">⤢</button>
      </div>
      {settingsOpen && <div className="map-settings" aria-label="Configurações do mapa">
        <b>Linhas no mapa</b>
        <label><input type="checkbox" checked={lines.own} onChange={e => toggleLine('own', e.target.checked)} /> Minhas rotas</label>
        <label><input type="checkbox" checked={lines.rivals} onChange={e => toggleLine('rivals', e.target.checked)} /> Rotas de outras companhias</label>
        <label><input type="checkbox" checked={lines.trail} onChange={e => toggleLine('trail', e.target.checked)} /> Trajeto do avião selecionado</label>
        <small className="muted">Zoom até {K_MAX}×</small>
      </div>}

      <div className="map-legend">
        {picking ? (
          <span>
            {noDedo ? 'Toque' : 'Clique'} num aeroporto para escolher a base ·{' '}
            {noDedo ? 'a pinça' : 'a roda'} aproxima e revela os menores
          </span>
        ) : (
          <>
            <span><i className="dot hub" /> base</span>
            <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">Imagem: NASA Earth Observatory</a>
            <span><i className="dash good" /> rota no lucro</span>
            <span><i className="dash bad" /> rota no prejuízo</span>
            {routes.length > 0 && (
              <>
                <span className="muted">{noDedo ? 'toque' : 'clique'} num avião para ver o trajeto</span>
                <span className="relogio" title={`hora local em ${refFuso}; o relógio é da tela, o tick do jogo é diário`}>
                  {hhmm(t * DIA + (AIRPORT_BY_IATA[refFuso]?.fuso ?? 0))} em {refFuso}
                  {' · '}{voos.length} no ar
                </span>
              </>
            )}
          </>
        )}
      </div>

      {vooSel && <CartaoVoo voo={vooSel} airlineCode={state.airline.code} onClose={() => setVoo(null)} />}
      {!picking && !vooSel && airport && AIRPORT_BY_IATA[airport] &&
        <CartaoAeroporto state={state} airport={AIRPORT_BY_IATA[airport]} onClose={() => setAirport(null)} />}

      {hoverAp && (
        <div className="map-tip" style={{ left: Math.min(hover!.x - 8, window.innerWidth - 220), top: hover!.y - 62 }}>
          <b>{hoverAp.iata}</b> · {hoverAp.city}, {hoverAp.country}
          <br />
          <span className="muted">
            {ESCOPO_LABEL[hoverAp.escopo]} · pista {metros(hoverAp.runway)}
            <br />
            {num(hoverAp.paxDia)} pax/dia {hoverAp.medido ? 'no pico' : '(estimado)'} · {hoverAp.pop.toFixed(1)} mi hab
          </span>
        </div>
      )}
    </div>
  )
}

function CartaoAeroporto({ state, airport, onClose }: {
  state: GameState; airport: Airport; onClose: () => void
}) {
  const base = state.airline.hubs.includes(airport.iata)
  const pernas = escalaDe(state).filter(p => p.from === airport.iata || p.to === airport.iata)
    .map(p => {
      const chegada = p.to === airport.iata
      const tempo = noTempo(state, p)
      return { p, chegada, dia: chegada ? tempo.dowChegada : p.dow, hora: chegada ? tempo.chegadaLocal : p.saida }
    }).sort((a, b) => a.dia - b.dia || a.hora - b.hora)
  const concorrentes = state.competitors.flatMap(c => c.routes
    .filter(r => r.from === airport.iata || r.to === airport.iata)
    .map(r => ({ companhia: c.name, rota: r })))
  const destinos = new Set([...pernas.map(({ p }) => p.from === airport.iata ? p.to : p.from),
    ...concorrentes.map(x => x.rota.from === airport.iata ? x.rota.to : x.rota.from)])
  return <div className={`map-card map-airport-card ${base ? 'hub' : ''}`}>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <b>{base ? '★ Sua base · ' : ''}{airport.iata}</b>
      <button className="x" onClick={onClose} title="Fechar">×</button>
    </div>
    <span>{airport.city}, {airport.country}</span>
    <small className="muted">{ESCOPO_LABEL[airport.escopo]} · {num(airport.paxDia)} passageiros/dia</small>
    <small className="dim">{destinos.size} destinos · {pernas.length} voos seus/semana · {concorrentes.length} rotas de outras companhias</small>
    <b className="map-airport-sub">Seus voos · hora local</b>
    <div className="map-airport-flights">{pernas.length ? pernas.map(({ p, chegada, dia, hora }) =>
      <small key={p.id}>{state.airline.code}{String(p.numero ?? 0).padStart(4, '0')} · {DOW_CURTO[dia]} {hhmm(hora)} · {chegada ? 'Chega de' : 'Parte para'} {chegada ? p.from : p.to}</small>
    ) : <small className="muted">Nenhum voo programado.</small>}</div>
    {concorrentes.length > 0 && <>
      <b className="map-airport-sub">Outras companhias</b>
      <div className="map-airport-flights">{concorrentes.map((x, i) =>
        <small key={`${x.companhia}-${i}`}>{x.companhia} · {x.rota.from}–{x.rota.to} · {x.rota.freq}/dia</small>
      )}</div>
    </>}
  </div>
}

/**
 * O que o jogador quer saber ao clicar num avião: qual cauda é, indo para onde
 * e a que horas.
 *
 * A matrícula aqui é a da **perna**, e não mais a primeira cauda alocada à
 * rota. Numa rota voada por três aviões, escolher a primeira da lista nomeava o
 * avião errado dois terços das vezes — e agora que a cauda circula pela malha,
 * ela também diz de onde ela veio e para onde segue depois.
 */
function CartaoVoo({
  voo, airlineCode, onClose,
}: {
  voo: { a: Airport; b: Airport; fase: number; perna: Perna; bloco: number; ac: Aircraft | undefined; r: Route | undefined }
  airlineCode: string
  onClose: () => void
}) {
  const { a, b, fase, perna, bloco, ac, r } = voo
  const dist = distanceBetween(perna.from, perna.to)
  const restante = dist * (1 - fase)
  const tipo = ac ? typeOf(ac) : null
  const chegada = perna.saida + bloco + (b.fuso - a.fuso)
  return (
    <div className="map-card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <b>{perna.numero ? `${airlineCode}${String(perna.numero).padStart(4, '0')} · ` : ''}{perna.from} → {perna.to}</b>
        <button className="x" onClick={onClose} title="Fechar">×</button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{a.city} → {b.city}</div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, marginTop: 2 }}>
        <span className="dim">{DOW_CURTO[perna.dow]} {hhmm(perna.saida)}</span>
        <span className="muted">chega {hhmm(chegada)}</span>
      </div>
      <div className="voo-barra"><i style={{ width: `${fase * 100}%` }} /></div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5 }}>
        <span className="dim">{km(dist - restante)} feitos</span>
        <span className="muted">faltam {km(restante)}</span>
      </div>
      {ac && tipo && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {tipo.maker} {tipo.name} · {ac.reg}
        </div>
      )}
      {!r && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Sem rota aberta neste par: o voo não vende assento.
        </div>
      )}
    </div>
  )
}
