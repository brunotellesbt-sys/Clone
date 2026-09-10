/**
 * Mede a silhueta de uma imagem para saber onde pintar.
 *
 * As imagens vêm em enquadramentos variados — umas num quadrado, outras
 * deitadas, umas com fundo transparente (a arte livre da Commons), outras com
 * fundo branco sólido (os sprites gerados por IA em `public/sprites/aircraft`)
 * — então em vez de chutar proporções o jogo rasteriza a imagem uma vez, acha
 * o recorte do avião e deduz três coisas: a faixa da fuselagem, o retângulo
 * da deriva e onde cabe o letreiro.
 *
 * "Achar o recorte" testa alfa quando a imagem tem canal alfa de verdade — as
 * quatro quinas viram a amostra do fundo, e pixel com alfa baixo é fundo. Sem
 * transparência real (as quinas saem opacas — o caso dos sprites da Meshy,
 * salvos de propósito com fundo branco sólido, não recortado), cai para a
 * mesma amostra de quina, mas comparando cor: pixel parecido com o fundo
 * amostrado é fundo, pixel diferente é avião. Uma imagem já transparente
 * nunca passa pelo segundo teste — a primeira condição já resolve, então
 * nenhuma arte da Commons muda de comportamento por causa disso.
 *
 * Esse mesmo teste gera `maskHref`: uma segunda cópia da imagem, com alfa
 * sintético (0 no fundo, 255 no avião, com uma faixa de transição pra não
 * serrilhar a borda), usada só como máscara SVG na hora de pintar. O arquivo
 * publicado continua com fundo branco — a transparência existe só nessa
 * cópia em memória, nunca é salva.
 */
export interface Measured {
  /** Caixa do avião inteiro, em fração da imagem. */
  box: [number, number, number, number]
  fuselage: [number, number]
  tail: [number, number, number, number]
  titles: [number, number]
  /**
   * Onde o emblema cabe de verdade: centro e tamanho máximo, em fração da
   * imagem. `tail` é a caixa que envolve a deriva — a deriva de verdade é um
   * trapézio dentro dela, não o retângulo inteiro. Em vez de supor a forma do
   * trapézio, isto mede a largura real de pixel na altura onde o emblema vai
   * ficar, então o tamanho já vem certo mesmo em deriva muito varrida (a que
   * mais escapa do retângulo) ou num desenho de cauda fora do comum.
   */
  emblem: { cx: number; cy: number; maxW: number; maxH: number }
  /** true quando o nariz aponta para a esquerda no arquivo original. */
  noseLeft: boolean
  /** Cópia com alfa sintético, só pra máscara SVG — ver comentário do arquivo. */
  maskHref: string
}

const cache = new Map<string, Measured | null>()
const inFlight = new Map<string, Promise<Measured | null>>()

const SAMPLE_W = 240

/**
 * Máscara exata da deriva, uma por modelo (não por motor — a nacela não muda
 * o desenho da cauda). Vem de `public/sprites/tailmasks/<id>.png`: contorno
 * de verdade, não a caixa aproximada que `analyse()` calcula abaixo. Nem todo
 * modelo tem uma (o lote foi feito por avião, sob conferência visual, não é
 * gerado sozinho) — sem arquivo, cai de volta na caixa aproximada de sempre.
 */
const namedMaskCache = new Map<string, string | null>()

/** Carrega `public/sprites/<pasta>/<id>.png` se existir; null sem tentar de novo. */
function namedMaskHref(folder: string, id: string, base: string): Promise<string | null> {
  const key = `${base}sprites/${folder}/${id}.png`
  if (namedMaskCache.has(key)) return Promise.resolve(namedMaskCache.get(key)!)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      namedMaskCache.set(key, key)
      resolve(key)
    }
    img.onerror = () => {
      namedMaskCache.set(key, null)
      resolve(null)
    }
    img.src = key
  })
}

export const tailMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('tailmasks', id, base)

/**
 * Máscara exata do trem de pouso (perna + roda), uma por modelo. Sem ela, o
 * trem cai dentro do retângulo "tudo abaixo da fuselagem" e pinta com a cor
 * da asa — visível principalmente quando asa e trem têm cores bem diferentes.
 *
 * Serve de referência e de recorte para a perna; **não** é o que o jogo pinta.
 */
export const gearMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('gearmasks', id, base)

/**
 * A perna do trem — amortecedor e viga do bogie, sem os pneus. É esta que
 * recebe a cor: pneu é borracha preta em qualquer companhia do mundo, e pintado
 * de azul ou vermelho o trem fica de brinquedo. Sai de gearmasks descontando o
 * maior círculo inscrito, que é a roda (derive_sectors.py --what gearstrut).
 */
export const gearStrutMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('gearstrutmasks', id, base)

/**
 * Máscara exata da asa, sem o motor nem o trem por cima — sem ela, a asa
 * cai no retângulo "tudo abaixo da fuselagem" de sempre, que pinta motor
 * e trem com a cor da asa (setores de pintura diferentes na vida real).
 */
export const wingMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('wingmasks', id, base)

/** Máscara exata da carenagem do motor, separada da asa. */
export const engineMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('enginemasks', id, base)

/**
 * Máscara do dispositivo de ponta de asa — winglet, sharklet, wingtip fence ou
 * ponta raked. Só existe para os modelos que têm algum: em ponta lisa (atr42,
 * atr72, b752, b753, b764, b77e) a ausência do arquivo é a resposta certa, e o
 * setor simplesmente não aparece. A lista está em
 * .claude/skills/skyline-mask-repair/pontas.md.
 */
export const wingletMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('wingletmasks', id, base)

/** Vidraça da cabine de comando (public/sprites/cockpitmasks/). */
export const cockpitMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('cockpitmasks', id, base)

/**
 * As três faixas da asa, cada uma um setor de pintura próprio: bordo de ataque,
 * dorso e bordo de fuga. Saem da divisão da própria máscara da asa ao longo da
 * corda, então formam uma partição dela — pintadas por cima da asa, na ordem em
 * que aparecem aqui.
 */
export const leadingEdgeMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('leadingedgemasks', id, base)
export const wingTopMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('wingtopmasks', id, base)
export const trailingEdgeMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('trailingedgemasks', id, base)

export function measured(href: string): Measured | null | undefined {
  return cache.get(href)
}

export function measure(href: string): Promise<Measured | null> {
  if (cache.has(href)) return Promise.resolve(cache.get(href)!)
  const running = inFlight.get(href)
  if (running) return running

  const job = new Promise<Measured | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        resolve(analyse(img))
      } catch {
        resolve(null) // canvas contaminado ou imagem estranha: segue sem medir
      }
    }
    img.onerror = () => resolve(null)
    img.src = href
  }).then((m) => {
    cache.set(href, m)
    inFlight.delete(href)
    return m
  })

  inFlight.set(href, job)
  return job
}

function analyse(img: HTMLImageElement): Measured | null {
  const w = SAMPLE_W
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * SAMPLE_W))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  // Amostra do fundo pelas quatro quinas. Quina com alfa baixo: a imagem tem
  // transparência de verdade, e o teste de primeiro-plano fica só no alfa —
  // igual ao comportamento de sempre. Quina opaca: não há transparência, e o
  // teste passa a comparar cor com a média das quinas (fundo branco sólido).
  const corners = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
  ].map(([x, y]) => (y * w + x) * 4)
  const bg = { r: 0, g: 0, b: 0, a: 0 }
  for (const i of corners) {
    bg.r += data[i] / corners.length
    bg.g += data[i + 1] / corners.length
    bg.b += data[i + 2] / corners.length
    bg.a += data[i + 3] / corners.length
  }
  const transparent = bg.a < 40
  const COLOR_TOL = 60 // soma das três diferenças de canal; janela e reflexo claro ainda contam como avião
  function isFg(i: number): boolean {
    const a = data[i + 3]
    if (a < 40) return false
    if (transparent) return true
    const dist = Math.abs(data[i] - bg.r) + Math.abs(data[i + 1] - bg.g) + Math.abs(data[i + 2] - bg.b)
    return dist >= COLOR_TOL
  }

  const rowCount = new Int32Array(h)
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!isFg(i)) continue
      rowCount[y]++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0 || y1 < 0) return null

  const planeW = x1 - x0 + 1
  // A fuselagem é a faixa de linhas que atravessa quase toda a largura do avião.
  const threshold = planeW * 0.55
  let fy0 = -1
  let fy1 = -1
  for (let y = y0; y <= y1; y++) {
    if (rowCount[y] >= threshold) {
      if (fy0 < 0) fy0 = y
      fy1 = y
    }
  }
  if (fy0 < 0) {
    fy0 = y0 + (y1 - y0) * 0.45
    fy1 = y0 + (y1 - y0) * 0.75
  }

  // A deriva é o que sobra acima da fuselagem: acha o intervalo em x.
  // Massa acima da fuselagem em cada extremidade: onde tiver mais, é a cauda.
  let leftMass = 0
  let rightMass = 0
  const colAbove = new Int32Array(w)
  for (let y = y0; y < fy0; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isFg((y * w + x) * 4)) continue
      colAbove[x]++
      if (x < x0 + planeW * 0.3) leftMass++
      else if (x > x0 + planeW * 0.7) rightMass++
    }
  }
  const noseLeft = rightMass >= leftMass

  // A deriva ocupa só a ponta da cauda. Asa alta e estabilizador também ficam
  // acima da fuselagem, então limita a busca ao terço da traseira.
  const zoneStart = noseLeft ? Math.round(x0 + planeW * 0.62) : x0
  const zoneEnd = noseLeft ? x1 : Math.round(x0 + planeW * 0.38)
  let tx0 = zoneEnd
  let tx1 = zoneStart
  let finTop = fy0
  for (let x = zoneStart; x <= zoneEnd; x++) {
    if (colAbove[x] < 2) continue
    if (x < tx0) tx0 = x
    if (x > tx1) tx1 = x
  }
  for (let y = y0; y < fy0; y++) {
    let any = false
    for (let x = tx0; x <= tx1; x++) {
      if (isFg((y * w + x) * 4)) { any = true; break }
    }
    if (any) { finTop = y; break }
  }
  if (tx1 <= tx0) {
    tx0 = noseLeft ? Math.round(x0 + planeW * 0.78) : x0
    tx1 = noseLeft ? x1 : Math.round(x0 + planeW * 0.22)
    finTop = y0
  }

  // Alguns desenhos trazem cota e legenda embaixo. Corta no maior vão vazio
  // depois da fuselagem, se ainda houver conteúdo abaixo dele.
  let cut = y1
  let gapStart = -1
  let bestGap = 0
  for (let y = fy1 + 1; y <= y1; y++) {
    const empty = rowCount[y] < planeW * 0.02
    if (empty) {
      if (gapStart < 0) gapStart = y
    } else if (gapStart >= 0) {
      const len = y - gapStart
      if (len > bestGap && len > h * 0.02) {
        bestGap = len
        cut = gapStart
      }
      gapStart = -1
    }
  }

  // Nunca guardar mais que ~1,6 alturas de fuselagem abaixo dela: o que passa
  // disso é cota, legenda ou escala do desenho, não faz parte do avião.
  const band = Math.max(1, fy1 - fy0)
  cut = Math.min(cut, Math.round(fy1 + band * 1.6))
  const boxH = cut - y0 + 1

  // Onde o emblema cabe: mede a largura real de pixel numa faixa de linhas
  // no terço superior da deriva (perto da ponta o traço fecha demais; perto
  // da base entra a carenagem com a fuselagem). Usa o MÍNIMO entre as linhas
  // amostradas, não a média — é a linha mais estreita que decide o tamanho
  // seguro, senão o emblema passa por fora numa deriva bem afunilada.
  const finH = Math.max(1, fy0 - finTop)
  const sampleY0 = Math.round(finTop + finH * 0.35)
  const sampleY1 = Math.round(finTop + finH * 0.65)
  let finMinW = tx1 - tx0 + 1
  let finCx = (tx0 + tx1) / 2
  let sampled = false
  for (let y = sampleY0; y <= sampleY1; y++) {
    let lx = -1
    let rx = -1
    for (let x = tx0; x <= tx1; x++) {
      if (!isFg((y * w + x) * 4)) continue
      if (lx < 0) lx = x
      rx = x
    }
    if (lx < 0) continue
    const rowW = rx - lx + 1
    if (!sampled || rowW < finMinW) {
      finMinW = rowW
      finCx = (lx + rx) / 2
      sampled = true
    }
  }
  // Folga de segurança: a largura medida ainda é de uma faixa de linhas, não
  // de um ponto só, então perde um pouco mais antes de virar tamanho do emblema.
  const emblemW = finMinW * 0.72
  const emblemH = Math.min(emblemW, finH * 0.4)
  const emblemCy = finTop + finH * 0.5

  // Máscara em resolução mais alta que a de medir (240px basta pra achar
  // caixa e faixa, mas fica serrilhada demais recortando pintura de perto).
  const maskW = Math.min(img.naturalWidth, 900)
  const maskH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * maskW))
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = maskW
  maskCanvas.height = maskH
  const mctx = maskCanvas.getContext('2d')
  let maskHref = ''
  if (mctx) {
    mctx.drawImage(img, 0, 0, maskW, maskH)
    const mImg = mctx.getImageData(0, 0, maskW, maskH)
    const md = mImg.data
    const FEATHER = 40 // faixa de transição suave, evita borda serrilhada
    if (!transparent) {
      for (let i = 0; i < md.length; i += 4) {
        const dist = Math.abs(md[i] - bg.r) + Math.abs(md[i + 1] - bg.g) + Math.abs(md[i + 2] - bg.b)
        md[i + 3] = dist < COLOR_TOL ? 0 : dist < COLOR_TOL + FEATHER ? Math.round((dist - COLOR_TOL) / FEATHER * 255) : 255
      }
    } // já transparente: o alfa lido do próprio desenho já é o recorte certo
    mctx.putImageData(mImg, 0, 0)
    maskHref = maskCanvas.toDataURL('image/png')
  }

  return {
    box: [x0 / w, y0 / h, (x1 + 1) / w, (y0 + boxH) / h],
    fuselage: [fy0 / h, (fy1 + 1) / h],
    tail: [tx0 / w, finTop / h, (tx1 + 1) / w, (fy0 + (fy1 - fy0) * 0.3) / h],
    titles: [(noseLeft ? x0 + planeW * 0.22 : x0 + planeW * 0.48) / w, (fy0 + (fy1 - fy0) * 0.34) / h],
    emblem: { cx: finCx / w, cy: emblemCy / h, maxW: emblemW / w, maxH: emblemH / h },
    noseLeft,
    maskHref,
  }
}
