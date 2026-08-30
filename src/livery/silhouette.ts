import type { AircraftType, Shape } from '../game/data/aircraft'

export const VIEW_W = 1000
export const VIEW_H = 300
const MARGIN = 14

export interface Geometry {
  k: number
  L: number
  D: number
  x0: number
  xEnd: number
  cy: number
  ground: number
  top: number
  bottom: number
  noseEnd: number
  tailStart: number

  fuselage: string
  /** Filete dorsal: a barbatana que emenda a deriva na fuselagem. */
  dorsal: string | null
  /** Cabine de comando: moldura, vidros recuados, reflexo e limpadores. */
  cockpit: {
    /** Envelope escuro do envidraçamento — vira a moldura e os montantes. */
    frame: string
    /** Cada vidro, já recuado dentro da moldura. */
    panes: string[]
    /** Reflexo diagonal atravessando o para-brisa. */
    glare: string
    /** Limpadores do para-brisa. */
    wipers: string
    /** Emenda do radome com a fuselagem. */
    seam: string
    /** Fim do envidraçamento: a cabine de passageiros começa a partir daqui. */
    xEnd: number
  }
  fin: string
  finBase: { x: number; y: number; w: number; h: number }
  stab: string
  wing: string
  /** Carenagem asa-fuselagem. */
  fairing: string | null
  winglet: string | null
  /** Carenagens dos trilhos de flape: as canoas por baixo do bordo de fuga. */
  flapTracks: string[]
  /**
   * Nacela: um contorno só para o capô inteiro, mais o aro do bocal, a face do
   * fan e o cone de escape. Nada de caixa com triângulo atrás.
   */
  nacelles: {
    cowl: string
    lip: string
    plug: string
    pylon: string
    /** Centro e raio da face do fan, para o escuro da entrada. */
    fx: number
    fy: number
    fr: number
  }[]
  props: { cx: number; cy: number; r: number }[]
  windows: { x: number; y: number; w: number; h: number }[]
  upperWindows: { x: number; y: number; w: number; h: number }[]
  doors: { x: number; y: number; w: number; h: number }[]
  gear: { strut: string; wheels: { cx: number; cy: number; r: number }[] }[]
  apu: string | null
}

const fuseHeight = (s: Shape) => (s.deck === 'double' ? s.fuseD * 1.17 : s.fuseD)
const gearHeight = (s: Shape) => (s.wing === 'high' ? s.fuseD * 0.3 : s.fuseD * 0.52)

const n = (v: number) => Math.round(v * 100) / 100

type Pt = [number, number]
type Cubic = [Pt, Pt, Pt, Pt]

const poly = (pts: Pt[]) => `M ${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')} Z`

/** Encolhe um polígono empurrando cada vértice para o centro — vira o recuo do vidro dentro da moldura. */
function inset(pts: Pt[], d: number): Pt[] {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
  return pts.map(([x, y]) => {
    const dx = cx - x
    const dy = cy - y
    const len = Math.hypot(dx, dy) || 1
    const f = Math.min(0.45, d / len)
    return [x + dx * f, y + dy * f] as Pt
  })
}

/** Ponto sobre a cúbica do dorso do nariz, para ancorar a emenda do radome na curva certa. */
function bez([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ]
}

/**
 * Silhueta lateral desenhada com as formas que um avião de linha tem de fato:
 * radome caído, para-brisa inclinado, seção constante, cone de cauda com
 * upsweep, filete dorsal emendando a deriva, estabilizador em flecha, asa com
 * carenagem de raiz, nacela em quatro peças e trem com bogie.
 *
 * Tudo sai do comprimento, diâmetro, altura e envergadura reais do modelo,
 * então cada tipo fica com a proporção dele.
 */
export function geometry(t: AircraftType): Geometry {
  const s = t.shape
  const fh = fuseHeight(s)
  const gearM = gearHeight(s)

  const k = Math.min((VIEW_W - MARGIN * 2) / s.length, (VIEW_H - MARGIN * 2) / s.height)
  const L = s.length * k
  const D = fh * k
  const totalH = s.height * k

  const x0 = (VIEW_W - L) / 2
  const xEnd = x0 + L
  const ground = (VIEW_H + totalH) / 2
  const bottom = ground - gearM * k
  const top = bottom - D
  const cy = bottom - D / 2
  const finTop = ground - totalH

  const X = (f: number) => x0 + L * f
  const Y = (f: number) => cy + D * f

  const slim = s.prop || s.mount === 'rear'
  // no 747 o radome é curto: a cabine fica lá em cima, no arranque do convés
  const noseF = s.deck === 'hump' ? 0.055 : slim ? 0.075 : s.fuseD > 5 ? 0.1 : 0.085
  const noseEnd = X(noseF)
  const tailConeStart = slim ? 0.78 : 0.76
  const tailStart = X(tailConeStart)

  // ------------------------------------------------------------- fuselagem
  const humped = s.deck === 'hump'
  const dbl = s.deck === 'double'
  const humpY = -0.85
  // no 747 o nariz já sobe rumo ao convés superior: o radome termina mais alto
  const noseTopF = humped ? -0.58 : -0.5

  // Dorso do nariz. O último ponto de controlo tem a mesma altura do fim da
  // curva: assim o radome entra no teto sem cotovelo.
  const noseTop: Cubic = [
    [x0, Y(0.1)],
    [X(noseF * 0.16), Y(-0.1)],
    [X(noseF * 0.5), Y(noseTopF)],
    [noseEnd, Y(noseTopF)],
  ]
  const humpCurve: Cubic = [
    [noseEnd, Y(noseTopF)],
    [X(noseF * 1.7), Y(noseTopF - 0.05)],
    [X(0.115), Y(humpY)],
    [X(0.15), Y(humpY)],
  ]

  const crown: string[] = []
  if (humped) {
    crown.push(
      `C ${n(humpCurve[1][0])} ${n(humpCurve[1][1])}, ${n(humpCurve[2][0])} ${n(humpCurve[2][1])}, ${n(humpCurve[3][0])} ${n(humpCurve[3][1])}`,
      `L ${n(X(0.32))} ${n(Y(humpY))}`,
      `C ${n(X(0.38))} ${n(Y(humpY))}, ${n(X(0.385))} ${n(Y(-0.5))}, ${n(X(0.45))} ${n(Y(-0.5))}`,
      `L ${n(X(tailConeStart))} ${n(Y(-0.5))}`,
    )
  } else {
    crown.push(`L ${n(X(tailConeStart))} ${n(Y(-0.5))}`)
  }

  // Linha do teto amostrada: a cabine e a emenda do radome pousam nela em vez
  // de usarem alturas fixas, e assim ficam coladas ao dorso em qualquer modelo.
  const crownPts: Pt[] = []
  for (let i = 0; i <= 32; i++) crownPts.push(bez(noseTop, i / 32))
  if (humped) {
    for (let i = 1; i <= 32; i++) crownPts.push(bez(humpCurve, i / 32))
    crownPts.push([X(0.32), Y(humpY)])
  } else {
    crownPts.push([X(tailConeStart), Y(-0.5)])
  }
  const crownYAt = (x: number) => {
    if (x <= crownPts[0][0]) return crownPts[0][1]
    for (let i = 1; i < crownPts.length; i++) {
      const [ax, ay] = crownPts[i - 1]
      const [bx, by] = crownPts[i]
      if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1)
    }
    return crownPts[crownPts.length - 1][1]
  }

  const tipY = -0.2 // a ponta do cone fica acima da linha de centro
  const fuselage = [
    // radome: ponta um pouco abaixo do eixo, subindo até o teto
    `M ${n(x0)} ${n(Y(0.1))}`,
    `C ${n(noseTop[1][0])} ${n(noseTop[1][1])}, ${n(noseTop[2][0])} ${n(noseTop[2][1])}, ${n(noseEnd)} ${n(Y(noseTopF))}`,
    ...crown,
    // cone de cauda, terminando em ponta acima do eixo
    `C ${n(X(tailConeStart + 0.1))} ${n(Y(-0.5))}, ${n(X(0.95))} ${n(Y(tipY - 0.13))}, ${n(X(0.988))} ${n(Y(tipY + 0.01))}`,
    // ponta do cone arredondada: é onde fica o escape da APU, não um corte reto
    `C ${n(X(1.004))} ${n(Y(tipY + 0.055))}, ${n(X(1.004))} ${n(Y(tipY + 0.145))}, ${n(X(0.988))} ${n(Y(tipY + 0.19))}`,
    // barriga do cone subindo forte: o upsweep
    `C ${n(X(0.92))} ${n(Y(tipY + 0.5))}, ${n(X(tailConeStart + 0.06))} ${n(Y(0.5))}, ${n(X(tailConeStart - 0.02))} ${n(Y(0.5))}`,
    `L ${n(X(noseF * 0.85))} ${n(Y(0.5))}`,
    `C ${n(X(noseF * 0.45))} ${n(Y(0.5))}, ${n(X(noseF * 0.12))} ${n(Y(0.34))}, ${n(x0)} ${n(Y(0.1))}`,
    'Z',
  ].join(' ')

  // --------------------------------------------------------------- cabine
  // O envidraçamento é o que dá cara de avião ao nariz. Vai montado como um
  // avião de verdade: para-brisa muito deitado para trás, montantes entre os
  // vidros, janela lateral corrediça e a janelinha de trás fechando em cunha.
  // A moldura sai como uma peça só e os vidros ficam recuados dentro dela —
  // assim os montantes aparecem sozinhos, na espessura certa.
  const cockpit = (() => {
    const nl = L * noseF

    // Início e fim do envidraçamento, em comprimentos de nariz. Os números
    // saem da estação real das janelas de cada família: num 737 o para-brisa
    // começa a 3 m do bico e a última janela acaba a 6,3 m.
    const [f0, f1] = humped
      ? [0.9, 1.95]
      : dbl
        ? [0.56, 1.24]
        : slim
          ? [0.7, 1.85]
          : s.fuseD > 5
            ? [0.58, 1.32]
            : [0.85, 1.85]
    const xF = x0 + nl * f0
    const xB = x0 + nl * f1

    // Altura da faixa de vidro: sai do comprimento dela, porque a proporção do
    // envidraçamento (uns 4,5 para 1) é a mesma em qualquer avião de linha —
    // se fosse fração da fuselagem, o jato pequeno saía com uma fresta.
    const h = Math.min(D * 0.3, Math.max(D * 0.15, (xB - xF) / (slim ? 3.8 : 4.5)))
    // folga entre o teto da fuselagem e o topo do vidro
    const clear = dbl ? 0.22 : humped ? 0.06 : slim ? 0.075 : 0.085

    const xAt = (p: number) => xF + (xB - xF) * p
    const yTop = (p: number) => crownYAt(xAt(p)) + D * clear
    const yBot = (p: number) => yTop(p) + h

    // larguras relativas: para-brisa largo, corrediça no meio, janelinha atrás
    const weights = [1.3, 1, 0.78]
    const total = weights.reduce((a, b) => a + b, 0)
    const stops = [0]
    let acc = 0
    for (const wgt of weights) {
      acc += wgt / total
      stops.push(acc)
    }

    // inclinação de cada montante: o da frente deita muito para trás (é a
    // inclinação do para-brisa), os do meio ficam quase em pé e o de trás
    // deita para a frente, fechando a cunha
    const last = stops.length - 1
    const rakeAt = (i: number) => (i === 0 ? h * 0.98 : i === last ? -h * 0.46 : h * (0.32 - i * 0.06))

    const posts = stops.map((p, i) => ({
      b: [xAt(p), yBot(p)] as Pt,
      t: [xAt(p) + rakeAt(i), yTop(p)] as Pt,
    }))

    const frame = poly([...posts.map((q) => q.t), ...posts.map((q) => q.b).reverse()])

    const gap = Math.max(0.75, h * 0.1)
    const panes = posts.slice(0, -1).map((a, i) => {
      const b = posts[i + 1]
      return poly(inset([a.t, b.t, b.b, a.b], gap))
    })

    // reflexo diagonal atravessando o vidro — depois recortado na moldura
    const glare = poly([
      [xF + h * 0.3, yTop(0) + h * 0.05],
      [xB + h, yTop(1) - h * 0.15],
      [xB + h, yTop(1) + h * 0.14],
      [xF, yTop(0) + h * 0.44],
    ])

    // limpadores: dois traços curtos apoiados na soleira do para-brisa
    const wipers = [0.3, 0.6]
      .map((p) => {
        const q = stops[1] * p
        const bx = xAt(q)
        const by = yBot(q)
        return `M ${n(bx)} ${n(by - h * 0.02)} L ${n(bx + h * 0.34)} ${n(by - h * 0.3)}`
      })
      .join(' ')

    // emenda do radome: a linha que separa o nariz de fibra da fuselagem.
    // Fica logo à frente do para-brisa, recortada depois pela fuselagem.
    const sx = xF - h * 0.55
    const seam =
      `M ${n(sx)} ${n(crownYAt(sx) - 2)} ` +
      `C ${n(sx - D * 0.02)} ${n(cy - D * 0.22)}, ${n(sx - D * 0.05)} ${n(cy + D * 0.1)}, ${n(sx - D * 0.09)} ${n(Y(0.62))}`

    return { frame, panes, glare, wipers, seam, xEnd: xB }
  })()

  // ------------------------------------------------------------------ cauda
  // Regra do desenho: a raiz de todo apêndice fica ENTERRADA dentro do corpo,
  // e o corpo é pintado por cima. Assim não sobra contorno atravessando nada.
  const finH = top - finTop
  const isT = s.tail === 'ttail'
  const finRootF = isT ? 0.72 : 0.66
  const finRootBackF = isT ? 0.89 : 0.88
  const finRootX = X(finRootF)
  const finRootBackX = X(finRootBackF)
  const finRootY = Y(-0.36) // dentro da fuselagem
  const sweep = finH * (isT ? 0.5 : 0.62)
  const tipChord = (finRootBackX - finRootX) * (isT ? 0.5 : 0.36)

  const fin = [
    `M ${n(finRootX)} ${n(finRootY)}`,
    // bordo de ataque numa curva só, da raiz à ponta
    `C ${n(finRootX + sweep * 0.3)} ${n(Y(-0.5) - finH * 0.34)}, ${n(finRootX + sweep * 0.74)} ${n(finTop + finH * 0.28)}, ${n(finRootX + sweep)} ${n(finTop + finH * 0.055)}`,
    // ponta arredondada, não em bico
    `C ${n(finRootX + sweep + tipChord * 0.26)} ${n(finTop - finH * 0.014)}, ${n(finRootX + sweep + tipChord * 0.76)} ${n(finTop + finH * 0.004)}, ${n(finRootX + sweep + tipChord)} ${n(finTop + finH * 0.08)}`,
    // bordo de fuga reto, descendo até dentro da fuselagem
    `L ${n(finRootBackX)} ${n(finRootY)}`,
    'Z',
  ].join(' ')
  const finBase = {
    x: finRootX,
    y: finTop,
    w: Math.max(finRootBackX - finRootX, sweep + tipChord),
    h: finH + D * 0.16,
  }

  // filete dorsal: emenda a deriva no dorso, e também nasce enterrado
  const dorsal = isT
    ? null
    : [
        `M ${n(X(finRootF - 0.15))} ${n(Y(-0.42))}`,
        `C ${n(X(finRootF - 0.06))} ${n(Y(-0.56))}, ${n(finRootX - L * 0.015)} ${n(Y(-0.63))}, ${n(finRootX + sweep * 0.2)} ${n(Y(-0.5) - finH * 0.2)}`,
        `L ${n(finRootX + sweep * 0.06)} ${n(Y(-0.4))}`,
        'Z',
      ].join(' ')

  // Estabilizador horizontal. No de cauda convencional a raiz entra no cone;
  // no de cauda em T ele senta no topo da deriva, com a raiz dentro dela.
  const stab = (() => {
    if (isT) {
      const rx = finRootX + sweep + tipChord * 0.1
      const ry = finTop + finH * 0.075
      const tx = rx + tipChord * 1.25
      return [
        `M ${n(rx - tipChord * 0.95)} ${n(ry + finH * 0.035)}`,
        `C ${n(rx - tipChord * 0.2)} ${n(ry - finH * 0.01)}, ${n(tx - tipChord * 0.5)} ${n(ry - finH * 0.035)}, ${n(tx)} ${n(ry - finH * 0.05)}`,
        `L ${n(tx + tipChord * 0.34)} ${n(ry - finH * 0.005)}`,
        `C ${n(tx - tipChord * 0.4)} ${n(ry + finH * 0.045)}, ${n(rx - tipChord * 0.2)} ${n(ry + finH * 0.075)}, ${n(rx - tipChord * 0.95)} ${n(ry + finH * 0.035)}`,
        'Z',
      ].join(' ')
    }
    // raiz dentro do cone, ponta um pouco acima por causa do diedro
    const rx = X(0.775)
    const ry = Y(-0.18)
    const tx = X(0.985)
    const ty = Y(-0.5)
    const rc = L * 0.125
    const tc = L * 0.062
    return [
      `M ${n(rx)} ${n(ry)}`,
      `C ${n(rx + (tx - rx) * 0.42)} ${n(ry - (ry - ty) * 0.56)}, ${n(tx - (tx - rx) * 0.22)} ${n(ty + D * 0.015)}, ${n(tx)} ${n(ty)}`,
      `L ${n(tx + tc)} ${n(ty + D * 0.05)}`,
      `C ${n(tx - (tx - rx) * 0.26)} ${n(ty + D * 0.11)}, ${n(rx + rc * 0.8)} ${n(ry + D * 0.05)}, ${n(rx + rc)} ${n(ry + D * 0.09)}`,
      'Z',
    ].join(' ')
  })()

  // ------------------------------------------------------------------- asa
  // De perfil a asa é uma faixa esguia que sai da carenagem, vai para trás com
  // o enflechamento do modelo e afina até a ponta. O bordo de fuga tem o
  // degrau que todo jato de linha tem, na junção do flape com o aileron, e por
  // baixo dele ficam as canoas dos trilhos de flape.
  const spanPx = s.span * k
  const under = ground - bottom
  const high = s.wing === 'high'
  // Enflechamento: ~25° nos jatos, quase reto no turboélice.
  const sweepBack = Math.min(spanPx * (s.prop ? 0.11 : 0.27), L * 0.36)
  const rake = s.winglet === 'raked' ? sweepBack * 0.2 : 0

  const wRootF = high ? 0.3 : 0.31
  const wRootX = X(wRootF)
  const rootChord = L * (s.prop ? 0.15 : 0.21)
  // A raiz fica enterrada: a carenagem e a fuselagem tapam por cima.
  const wRootY = high ? Y(-0.52) : Y(0.3)
  const drop = high ? D * 0.2 : Math.min(under * 0.98, D * 0.6)
  const wTipX = wRootX + sweepBack + rake
  const wTipY = wRootY + drop
  // Afilamento real de asa de transporte: a ponta tem menos de um terço da raiz.
  const tipChordW = rootChord * (s.prop ? 0.45 : 0.3)

  // Bordo de fuga: da raiz à ponta, com o degrau da junção flape/aileron.
  const teRoot: Pt = [wRootX + rootChord, wRootY + D * 0.02]
  const teTip: Pt = [wTipX + tipChordW, wTipY + D * 0.03]
  const kink: Pt = [
    teRoot[0] + (teTip[0] - teRoot[0]) * 0.42,
    teRoot[1] + (teTip[1] - teRoot[1]) * 0.42 + D * 0.035,
  ]

  const wing = [
    `M ${n(wRootX)} ${n(wRootY)}`,
    // bordo de ataque numa curva só
    `C ${n(wRootX + sweepBack * 0.36)} ${n(wRootY + drop * 0.26)}, ${n(wTipX - sweepBack * 0.28)} ${n(wTipY - drop * 0.24)}, ${n(wTipX)} ${n(wTipY)}`,
    // ponta arredondada
    `Q ${n(wTipX + tipChordW * 0.55)} ${n(wTipY - D * 0.012)} ${n(teTip[0])} ${n(teTip[1])}`,
    // bordo de fuga externo até o degrau
    `C ${n(teTip[0] - (teTip[0] - kink[0]) * 0.42)} ${n(teTip[1] + D * 0.012)}, ${n(kink[0] + (teTip[0] - kink[0]) * 0.3)} ${n(kink[1])}, ${n(kink[0])} ${n(kink[1])}`,
    // e do degrau para a raiz
    `C ${n(kink[0] - (kink[0] - teRoot[0]) * 0.34)} ${n(kink[1] + D * 0.012)}, ${n(teRoot[0] + (kink[0] - teRoot[0]) * 0.22)} ${n(teRoot[1] + D * 0.03)}, ${n(teRoot[0])} ${n(teRoot[1])}`,
    'Z',
  ].join(' ')

  // Canoas dos trilhos de flape. Vão desenhadas ATRÁS da asa: aparece só a
  // barriga delas por baixo do bordo de fuga, que é como se vê num avião.
  const flapTracks: string[] = []
  const trackCount = s.prop ? 2 : spanPx > 620 ? 4 : 3
  for (let i = 0; i < trackCount; i++) {
    const f = 0.12 + (i * 0.46) / Math.max(1, trackCount - 1)
    const tx = teRoot[0] + (teTip[0] - teRoot[0]) * f
    const ty = teRoot[1] + (teTip[1] - teRoot[1]) * f + D * 0.02
    const len = D * (0.26 - f * 0.07)
    const hh = D * (0.075 - f * 0.014)
    flapTracks.push(
      [
        `M ${n(tx - len * 0.8)} ${n(ty - hh)}`,
        `C ${n(tx - len * 0.2)} ${n(ty - hh * 0.9)}, ${n(tx + len * 0.3)} ${n(ty - hh * 0.4)}, ${n(tx + len * 0.72)} ${n(ty + hh * 0.05)}`,
        `C ${n(tx + len * 0.3)} ${n(ty + hh * 0.75)}, ${n(tx - len * 0.2)} ${n(ty + hh * 0.9)}, ${n(tx - len * 0.8)} ${n(ty + hh * 0.6)}`,
        'Z',
      ].join(' '),
    )
  }

  const fairing = high
    ? null
    : [
        `M ${n(wRootX - L * 0.05)} ${n(Y(0.42))}`,
        `C ${n(wRootX - L * 0.005)} ${n(Y(0.72))}, ${n(wRootX + rootChord * 0.86)} ${n(Y(0.74))}, ${n(wRootX + rootChord * 1.16)} ${n(Y(0.42))}`,
        'Z',
      ].join(' ')

  const winglet = makeWinglet(s.winglet, wTipX, wTipY, tipChordW, D)

  // -------------------------------------------------------------- nacelas
  const nacelles: Geometry['nacelles'] = []
  const props: Geometry['props'] = []

  /**
   * Um turbofan de perfil: bocal gordo e arredondado, capô do fan largo,
   * reversor afinando, bocal de escape estreito e o cone saindo dele. Tudo em
   * curva — é uma peça torneada, não um caixote.
   */
  /**
   * Perfil de um turbofan: aro de admissão saliente, capô do fan gordo e
   * curto, reversor afinando, bocal de escape estreito e o cone saindo dele.
   * As proporções são as de um motor real de perfil — o ponto mais gordo fica
   * logo atrás do bocal, não no meio.
   */
  const buildNacelle = (cx: number, ncy: number, nw: number, nh: number, pylonTo: [number, number]) => {
    const l = cx - nw / 2
    const r = nh / 2
    const lip = l + nw * 0.04
    const fat = l + nw * 0.17
    const fanEnd = l + nw * 0.46
    const revEnd = l + nw * 0.76
    const noz = l + nw * 0.96
    return {
      cowl: [
        `M ${n(lip)} ${n(ncy - r * 0.78)}`,
        `C ${n(lip + nw * 0.04)} ${n(ncy - r * 0.96)}, ${n(fat - nw * 0.03)} ${n(ncy - r)}, ${n(fat)} ${n(ncy - r)}`,
        `C ${n(fat + nw * 0.12)} ${n(ncy - r)}, ${n(fanEnd - nw * 0.06)} ${n(ncy - r * 0.99)}, ${n(fanEnd)} ${n(ncy - r * 0.96)}`,
        `C ${n(fanEnd + nw * 0.14)} ${n(ncy - r * 0.92)}, ${n(revEnd - nw * 0.06)} ${n(ncy - r * 0.8)}, ${n(revEnd)} ${n(ncy - r * 0.68)}`,
        `C ${n(revEnd + nw * 0.1)} ${n(ncy - r * 0.56)}, ${n(noz - nw * 0.05)} ${n(ncy - r * 0.4)}, ${n(noz)} ${n(ncy - r * 0.32)}`,
        `L ${n(noz)} ${n(ncy + r * 0.32)}`,
        `C ${n(noz - nw * 0.05)} ${n(ncy + r * 0.4)}, ${n(revEnd + nw * 0.1)} ${n(ncy + r * 0.58)}, ${n(revEnd)} ${n(ncy + r * 0.72)}`,
        `C ${n(revEnd - nw * 0.06)} ${n(ncy + r * 0.84)}, ${n(fanEnd + nw * 0.14)} ${n(ncy + r * 0.96)}, ${n(fanEnd)} ${n(ncy + r)}`,
        `C ${n(fanEnd - nw * 0.06)} ${n(ncy + r * 1.02)}, ${n(fat + nw * 0.12)} ${n(ncy + r * 1.04)}, ${n(fat)} ${n(ncy + r * 1.04)}`,
        `C ${n(fat - nw * 0.03)} ${n(ncy + r * 1.04)}, ${n(lip + nw * 0.04)} ${n(ncy + r)}, ${n(lip)} ${n(ncy + r * 0.82)}`,
        `C ${n(l - nw * 0.015)} ${n(ncy + r * 0.5)}, ${n(l - nw * 0.015)} ${n(ncy - r * 0.46)}, ${n(lip)} ${n(ncy - r * 0.78)}`,
        'Z',
      ].join(' '),
      // aro do bocal: a borda saliente da admissão
      lip: [
        `M ${n(lip)} ${n(ncy - r * 0.78)}`,
        `C ${n(l - nw * 0.015)} ${n(ncy - r * 0.46)}, ${n(l - nw * 0.015)} ${n(ncy + r * 0.5)}, ${n(lip)} ${n(ncy + r * 0.82)}`,
        `L ${n(lip + nw * 0.055)} ${n(ncy + r * 0.7)}`,
        `C ${n(l + nw * 0.05)} ${n(ncy + r * 0.44)}, ${n(l + nw * 0.05)} ${n(ncy - r * 0.4)}, ${n(lip + nw * 0.055)} ${n(ncy - r * 0.66)}`,
        'Z',
      ].join(' '),
      // cone de escape, saindo do bocal
      plug: [
        `M ${n(noz - nw * 0.01)} ${n(ncy - r * 0.3)}`,
        `C ${n(noz + nw * 0.07)} ${n(ncy - r * 0.22)}, ${n(noz + nw * 0.14)} ${n(ncy - r * 0.08)}, ${n(noz + nw * 0.17)} ${n(ncy)}`,
        `C ${n(noz + nw * 0.14)} ${n(ncy + r * 0.08)}, ${n(noz + nw * 0.07)} ${n(ncy + r * 0.22)}, ${n(noz - nw * 0.01)} ${n(ncy + r * 0.3)}`,
        'Z',
      ].join(' '),
      // pilone: da nacela até dentro da asa
      pylon: [
        `M ${n(l + nw * 0.36)} ${n(ncy - r * 0.9)}`,
        `C ${n(l + nw * 0.42)} ${n(ncy - r * 1.6)}, ${n(pylonTo[0] - nw * 0.1)} ${n(pylonTo[1] + nh * 0.5)}, ${n(pylonTo[0])} ${n(pylonTo[1])}`,
        `L ${n(pylonTo[0] + nw * 0.22)} ${n(pylonTo[1] + nh * 0.12)}`,
        `C ${n(pylonTo[0] + nw * 0.12)} ${n(pylonTo[1] + nh * 0.66)}, ${n(l + nw * 0.78)} ${n(ncy - r * 1.25)}, ${n(l + nw * 0.72)} ${n(ncy - r * 0.78)}`,
        'Z',
      ].join(' '),
      fx: lip + nw * 0.03,
      fy: ncy,
      fr: r * 0.72,
    }
  }

  // A nacela sai do fan do motor instalado: um GTF de 2,06 m e um LEAP de
  // 1,98 m não desenham a mesma peça, e o Trent 7000 de 2,84 m muito menos.
  const cowlD = (t.fan + 0.34) * k

  if (s.mount === 'rear') {
    const nh = cowlD
    const nw = nh * 2.3
    const cx = X(0.7)
    const ncy = Y(-0.5) - nh * 0.15
    nacelles.push(buildNacelle(cx, ncy, nw, nh, [cx - nw * 0.36, ncy + nh * 0.62]))
  } else if (s.prop) {
    // Turboélice: a nacela é comprida e fina, e o disco da hélice vem do
    // diâmetro real (3,93 m no ATR, 4,11 m no Dash 8).
    // No turboélice o `fan` é o diâmetro da HÉLICE; a nacela sai da fuselagem.
    const nh = D * 0.46
    const nw = nh * 2.7
    const cx = wRootX + rootChord * 0.2
    const ncy = wRootY + nh * 0.12
    nacelles.push(buildNacelle(cx, ncy, nw, nh, [cx + nw * 0.12, ncy + nh * 0.9]))
    props.push({ cx: cx - nw * 0.52, cy: ncy, r: (t.fan / 2) * k })
  } else {
    const count = s.engines === 2 ? 1 : 2
    // O motor tem de caber entre a asa e o chão: é por isso que o 737 tem a
    // nacela achatada embaixo e o A320neo precisou de trem mais alto.
    const nh = Math.min(cowlD, under * 1.15)
    const nw = nh * 2.15
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0.19 : 0.1 + i * 0.34
      const sc = count === 1 ? 1 : 0.95 - i * 0.04
      const cx = wRootX + sweepBack * f + nw * 0.12
      const ncy = bottom + under * 0.1 + drop * f * 0.9
      nacelles.push(buildNacelle(cx, ncy, nw * sc, nh * sc, [cx + nw * 0.24, wRootY + drop * f * 0.92]))
    }
  }

  // ---------------------------------------------------------------- janelas
  const winSize = Math.max(1.7, D * 0.075)
  const rowY = Y(s.deck === 'double' ? -0.04 : -0.14)
  const windows: Geometry['windows'] = []
  const step = winSize * 2.1
  // a cabine de passageiros só começa depois do envidraçamento do cockpit
  const cabinStart = cockpit.xEnd + D * 0.5
  for (let x = cabinStart; x < X(tailConeStart + 0.12); x += step) {
    windows.push({ x, y: rowY, w: winSize, h: winSize * 1.2 })
  }

  const upperWindows: Geometry['upperWindows'] = []
  if (dbl) {
    for (let x = cabinStart - D * 0.2; x < X(tailConeStart + 0.06); x += step) {
      upperWindows.push({ x, y: Y(-0.34), w: winSize, h: winSize * 1.2 })
    }
  } else if (humped) {
    for (let x = X(0.215); x < X(0.34); x += step) {
      upperWindows.push({ x, y: Y(humpY + 0.13), w: winSize, h: winSize * 1.2 })
    }
  }

  const doorW = D * 0.12
  const doors: Geometry['doors'] = [
    { x: cabinStart + D * 0.12, y: Y(-0.34), w: doorW, h: D * 0.62 },
    { x: X(tailConeStart + 0.04), y: Y(-0.34), w: doorW, h: D * 0.62 },
  ]
  if (L > 430) doors.push({ x: X(0.5), y: Y(-0.34), w: doorW, h: D * 0.62 })
  if (L > 640) doors.push({ x: X(0.3), y: Y(-0.34), w: doorW, h: D * 0.62 })

  // ------------------------------------------------------------------ trem
  const strutW = Math.max(2.4, D * 0.095)
  const wheelR = Math.max(2, D * 0.12)
  /**
   * Perna de trem: cilindro amortecedor grosso em cima, haste fina embaixo e,
   * quando é bogie, a viga que carrega os dois pares de rodas.
   */
  const mkGear = (x: number, wheels: number) => {
    const yTop = bottom - D * 0.1
    const yBot = ground - wheelR
    const mid = yTop + (yBot - yTop) * 0.46
    const half = ((wheels - 1) / 2) * wheelR * 2.05
    const beam = wheels > 1
      ? ` M ${n(x - half - wheelR * 0.5)} ${n(yBot - wheelR * 0.3)} L ${n(x + half + wheelR * 0.5)} ${n(yBot - wheelR * 0.3)}` +
        ` L ${n(x + half + wheelR * 0.4)} ${n(yBot + wheelR * 0.16)} L ${n(x - half - wheelR * 0.4)} ${n(yBot + wheelR * 0.16)} Z`
      : ''
    return {
      strut:
        `M ${n(x - strutW * 0.72)} ${n(yTop)} L ${n(x + strutW * 0.72)} ${n(yTop)} ` +
        `L ${n(x + strutW * 0.6)} ${n(mid)} L ${n(x + strutW * 0.32)} ${n(mid)} ` +
        `L ${n(x + strutW * 0.32)} ${n(yBot)} L ${n(x - strutW * 0.32)} ${n(yBot)} ` +
        `L ${n(x - strutW * 0.32)} ${n(mid)} L ${n(x - strutW * 0.6)} ${n(mid)} Z` + beam,
      wheels: Array.from({ length: wheels }, (_, i) => ({
        cx: x + (i - (wheels - 1) / 2) * wheelR * 2.05,
        cy: yBot,
        r: wheelR,
      })),
    }
  }
  const bogie = s.fuseD > 5.2 ? 3 : 2
  const gear: Geometry['gear'] = [
    mkGear(X(noseF + 0.05), 1),
    mkGear(wRootX + rootChord * 0.72, high ? 2 : bogie),
  ]

  // Escape da APU: fica DENTRO do cone, recortado pela fuselagem.
  const apu =
    `M ${n(X(0.984))} ${n(Y(tipY + 0.03))} ` +
    `C ${n(X(0.998))} ${n(Y(tipY + 0.07))}, ${n(X(0.998))} ${n(Y(tipY + 0.13))}, ${n(X(0.984))} ${n(Y(tipY + 0.17))} Z`

  return {
    k, L, D, x0, xEnd, cy, ground, top, bottom, noseEnd, tailStart,
    fuselage, dorsal, cockpit, fin, finBase, stab, wing, fairing, winglet, flapTracks,
    nacelles, props, windows, upperWindows, doors, gear, apu,
  }
}

/**
 * Winglet, com a proporção de cada tipo real: a aleta mista do 737 NG sobe
 * curvada, a sharklet do neo é mais vertical e afiada, a cerca do A320 clássico
 * é a peça pequena para cima e para baixo, e a dividida do MAX tem lâmina
 * embaixo. Ponta enflechada não tem aleta nenhuma — é a asa que continua.
 */
function makeWinglet(kind: Shape['winglet'], x: number, y: number, chordRaw: number, D: number): string | null {
  // A base ocupa exatamente a corda da ponta da asa: assim não sobra um pedaço
  // de bordo de fuga solto para fora da aleta.
  const c = chordRaw
  const h = Math.min(chordRaw * 0.85, D * 0.32)
  switch (kind) {
    case 'none':
    case 'raked':
      return null
    case 'fence':
      return (
        `M ${n(x + c * 0.06)} ${n(y + h * 0.02)} L ${n(x + c * 0.3)} ${n(y - h * 0.62)} ` +
        `L ${n(x + c * 0.72)} ${n(y - h * 0.55)} L ${n(x + c * 0.62)} ${n(y + h * 0.06)} Z ` +
        `M ${n(x + c * 0.16)} ${n(y + h * 0.08)} L ${n(x + c * 0.34)} ${n(y + h * 0.45)} ` +
        `L ${n(x + c * 0.72)} ${n(y + h * 0.38)} L ${n(x + c * 0.66)} ${n(y + h * 0.1)} Z`
      )
    case 'blended':
      // sobe com a curva que dá o nome à peça, e a ponta cai para trás
      return (
        `M ${n(x + c * 0.02)} ${n(y + h * 0.06)} ` +
        `C ${n(x + c * 0.14)} ${n(y - h * 0.5)}, ${n(x + c * 0.4)} ${n(y - h * 0.92)}, ${n(x + c * 0.6)} ${n(y - h * 1.12)} ` +
        `L ${n(x + c * 1.02)} ${n(y - h * 0.98)} ` +
        `C ${n(x + c * 0.78)} ${n(y - h * 0.66)}, ${n(x + c * 0.94)} ${n(y - h * 0.1)}, ${n(x + c * 1.08)} ${n(y + h * 0.1)} Z`
      )
    case 'sharklet':
      return (
        `M ${n(x + c * 0.04)} ${n(y + h * 0.04)} ` +
        `C ${n(x + c * 0.2)} ${n(y - h * 0.44)}, ${n(x + c * 0.34)} ${n(y - h * 0.88)}, ${n(x + c * 0.44)} ${n(y - h * 1.2)} ` +
        `L ${n(x + c * 0.86)} ${n(y - h * 1.08)} ` +
        `C ${n(x + c * 0.74)} ${n(y - h * 0.448)}, ${n(x + c * 0.94)} ${n(y - h * 0.12)}, ${n(x + c * 1.04)} ${n(y + h * 0.1)} Z`
      )
    case 'split':
      // a aleta dividida do MAX: cimitarra em cima, lâmina embaixo
      return (
        `M ${n(x + c * 0.04)} ${n(y + h * 0.04)} ` +
        `C ${n(x + c * 0.18)} ${n(y - h * 0.4)}, ${n(x + c * 0.3)} ${n(y - h * 0.664)}, ${n(x + c * 0.4)} ${n(y - h * 0.886)} ` +
        `L ${n(x + c * 0.8)} ${n(y - h * 0.88)} ` +
        `C ${n(x + c * 0.68)} ${n(y - h * 0.5)}, ${n(x + c * 0.88)} ${n(y - h * 0.08)}, ${n(x + c)} ${n(y + h * 0.08)} Z ` +
        `M ${n(x + c * 0.14)} ${n(y + h * 0.1)} L ${n(x + c * 0.36)} ${n(y + h * 0.62)} ` +
        `L ${n(x + c * 0.74)} ${n(y + h * 0.456)} L ${n(x + c * 0.8)} ${n(y + h * 0.12)} Z`
      )
    default:
      return null
  }
}

export const FONT_STACK: Record<string, string> = {
  sans: '"Inter", "Helvetica Neue", Arial, sans-serif',
  wide: '"Archivo Black", "Arial Black", Impact, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
}
