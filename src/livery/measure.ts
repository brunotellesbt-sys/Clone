/**
 * Mede a silhueta de uma imagem para saber onde pintar.
 *
 * As imagens da Commons vêm em enquadramentos variados — umas num quadrado,
 * outras deitadas — então em vez de chutar proporções o jogo rasteriza a
 * imagem uma vez, acha o recorte do avião pelo canal alfa e deduz três coisas:
 * a faixa da fuselagem, o retângulo da deriva e onde cabe o letreiro.
 */
export interface Measured {
  /** Caixa do avião inteiro, em fração da imagem. */
  box: [number, number, number, number]
  fuselage: [number, number]
  tail: [number, number, number, number]
  titles: [number, number]
  /** true quando o nariz aponta para a esquerda no arquivo original. */
  noseLeft: boolean
}

const cache = new Map<string, Measured | null>()
const inFlight = new Map<string, Promise<Measured | null>>()

const SAMPLE_W = 240

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

  const rowCount = new Int32Array(h)
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]
      if (a < 40) continue
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
      if (data[(y * w + x) * 4 + 3] < 40) continue
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
      if (data[(y * w + x) * 4 + 3] >= 40) { any = true; break }
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
  return {
    box: [x0 / w, y0 / h, (x1 + 1) / w, (y0 + boxH) / h],
    fuselage: [fy0 / h, (fy1 + 1) / h],
    tail: [tx0 / w, finTop / h, (tx1 + 1) / w, (fy0 + (fy1 - fy0) * 0.3) / h],
    titles: [(noseLeft ? x0 + planeW * 0.22 : x0 + planeW * 0.48) / w, (fy0 + (fy1 - fy0) * 0.34) / h],
    noseLeft,
  }
}
