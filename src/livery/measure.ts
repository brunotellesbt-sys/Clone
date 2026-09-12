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
 * A silhueta do avião inteiro — o recorte de toda a pintura.
 *
 * Vem de arquivo (`public/sprites/planemasks/<sprite>.png`, um por sprite, não
 * por modelo: as variantes de motor são renders diferentes) porque a silhueta
 * calculada aqui no navegador não serve para estes desenhos. `analyse()` chama
 * de avião o pixel que estiver a mais de `COLOR_TOL` do fundo, e o sprite é um
 * avião **branco em fundo branco**: dorso da fuselagem, meio da nacela e dorso
 * da asa passam de 245 de luminância e não alcançam o limiar. Medido no b737:
 * 164.743px reconhecidos contra 241.166px de avião — **32% ficava fora**, sem
 * tinta, deixando o fundo da página aparecer no meio da peça. Era a mancha
 * escura no motor; e a rampa de transição de 40 níveis do mesmo teste, cruzando
 * chapa clara, era o aspecto borrado da fuselagem.
 *
 * A regra certa é inundação a partir da borda (o fundo é o que encosta na
 * moldura), que é o que `maskcore.silhueta()` faz — e roda uma vez, fora do
 * jogo, em `silhueta_batch.py`. Sem o arquivo, cai na cópia com alfa sintético
 * de `analyse()`, que ainda é o caminho da arte da Commons.
 */
export function planeMaskHref(file: string, base = import.meta.env.BASE_URL): Promise<string | null> {
  if (/^https?:\/\//.test(file)) return Promise.resolve(null)
  const nome = file.split('/').pop()?.replace(/\.png$/i, '')
  if (!nome) return Promise.resolve(null)
  return namedMaskHref('planemasks', nome, base)
}

/**
 * O pneu, recortado do trem (`tyremasks` = `gearmasks` menos `gearstrutmasks`).
 * Não é setor de livery: a cor é fixa na arte, porque borracha é preta em
 * qualquer companhia. Existe como máscara porque deixar a peça **sem** pintura
 * não a torna preta — a foto é de um avião branco de fábrica e entra por
 * `multiply` a 30%, então o resultado nunca desce de ~70% de luminância. Era
 * por isso que a roda saía cinza.
 */
export const tyreMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('tyremasks', id, base)

/**
 * A hélice dos turboélices (atr42, atr72, q400), pá e cone. Como o pneu, cor
 * fixa na arte. `tirar_helice.py` já tinha expulsado a pá dos setores de asa e
 * motor, com razão — pá não é chapa pintável —, mas peça que não é de ninguém
 * fica com a cor de fundo da silhueta: com o recorte novo, que cobre o avião
 * inteiro, o atr42 ganhou uma hélice branca.
 */
export const propMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('propmasks', id, base)

/**
 * A perna do trem — amortecedor e viga do bogie, sem os pneus. É esta que
 * recebe a cor: pneu é borracha preta em qualquer companhia do mundo, e pintado
 * de azul ou vermelho o trem fica de brinquedo. Sai de `gearmasks` descontando
 * o maior círculo inscrito, que é a roda (derive_sectors.py --what gearstrut).
 *
 * `gearmasks` e `enginemasks` continuam no repositório como **referência de
 * medida** e origem destes recortes, mas não têm carregador aqui: o jogo pinta
 * a perna e a carenagem, nunca a peça inteira.
 */
export const gearStrutMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('gearstrutmasks', id, base)

/**
 * Máscara exata da asa, sem o motor nem o trem por cima — sem ela, a asa
 * cai no retângulo "tudo abaixo da fuselagem" de sempre, que pinta motor
 * e trem com a cor da asa (setores de pintura diferentes na vida real).
 */
export const wingMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('wingmasks', id, base)

/**
 * Máscara do dispositivo de ponta de asa — winglet, sharklet, wingtip fence ou
 * ponta raked. Só existe para os modelos que têm algum: em ponta lisa (atr42,
 * atr72, b752, b753, b764, b77e) a ausência do arquivo é a resposta certa, e o
 * setor simplesmente não aparece. A lista está em
 * .claude/skills/skyline-mask-repair/pontas.md.
 */
export const wingletMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('wingletmasks', id, base)

/**
 * A carenagem do motor — a chapa que leva tinta. O bocal de escape, o plug e o
 * fan ficam de fora: são metal exposto e nenhuma companhia os pinta, mesma
 * razão do pneu. `enginemasks` continua sendo a nacela inteira, para medir e
 * para recortar esta; é esta aqui que o jogo pinta.
 */
export const engineCowlMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('enginecowlmasks', id, base)

/**
 * A fileira de janela de passageiro. Sem ela os controles "Janelas" e "Cor das
 * janelas" existiam no editor e não faziam nada na arte de foto: a janela vinha
 * da foto e pronto.
 */
export const windowMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('windowmasks', id, base)

/**
 * O tubo da fuselagem (`fuselagemasks`), usado para recortar a **faixa**.
 *
 * A faixa é desenho de fuselagem e não tem o que fazer embaixo da asa: pintada
 * sobre a silhueta inteira, ela vaza pelas frestas que as máscaras de asa e
 * motor deixam entre si e aparece como respingo de cor no intradorso. Recortada
 * pelo tubo, some o respingo e no tubo nada muda.
 *
 * A cor de fundo da fuselagem continua sendo pintada sobre a silhueta inteira,
 * e é de propósito: é ela que garante que nenhum pedaço do avião fique sem
 * tinta. Recortar **ela** pelo tubo é que abriria buraco.
 */
export const bodyMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('fuselagemasks', id, base)

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

/**
 * As duas divisas que cortam a fuselagem em dorso, cabine e ventre, em fração
 * da altura da imagem. Medidas por aeronave (topo da fileira de janela e centro
 * da nacela) em `faixas_fuselagem.py`.
 *
 * São **linhas**, não máscaras, e de propósito: a arte pinta a fuselagem como
 * retângulo recortado pela silhueta inteira, então faixa reta encaixa nesse
 * mesmo desenho. Faixa recortada por `fuselagemasks` abriria um anel de foto
 * crua na divisa de cada peça — 1,4% a 2,2% da silhueta, já medido.
 */
export interface FuseBands {
  crown: number
  belly: number
}

let bandsPromise: Promise<Record<string, FuseBands>> | null = null

export function fuseBands(base = import.meta.env.BASE_URL): Promise<Record<string, FuseBands>> {
  if (!bandsPromise) {
    bandsPromise = fetch(`${base}sprites/fusebands.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return bandsPromise
}

export function measured(href: string): Measured | null | undefined {
  return cache.get(href)
}

/** Caixa de uma peça e onde o emblema cabe dentro dela, em fração da imagem. */
export interface PieceBox {
  box: [number, number, number, number]
  emblem: { cx: number; cy: number; maxW: number; maxH: number }
}

const pieceCache = new Map<string, PieceBox | null>()

/**
 * Mede a caixa da deriva na **própria máscara** dela.
 *
 * A caixa vinha de `analyse()`, que a deduz do que sobra acima da faixa da
 * fuselagem. É dedução frágil e acoplada: melhorar a medida da faixa move a
 * caixa da cauda junto, e no a388 — convés superior alto, faixa alta — a caixa
 * passou a começar depois do bordo de ataque, deixando metade da deriva branca.
 * Com `tailmasks` conferida para as 55, a caixa não precisa ser deduzida: ela é
 * o contorno da peça.
 *
 * Serve também para o emblema, pela mesma razão de sempre — a deriva é um
 * trapézio, não um retângulo, então o tamanho seguro sai da **linha mais
 * estreita** da faixa onde o emblema vai, não da largura da caixa.
 */
export function pieceBox(href: string): Promise<PieceBox | null> {
  if (pieceCache.has(href)) return Promise.resolve(pieceCache.get(href)!)
  return carregar(href)
    .then((img) => {
      if (!img) return null
      try {
        return medirPeca(img)
      } catch {
        return null
      }
    })
    .then((b) => {
      pieceCache.set(href, b)
      return b
    })
}

function medirPeca(img: HTMLImageElement): PieceBox | null {
  const w = SAMPLE_W
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * SAMPLE_W))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const dentro = (x: number, y: number) => data[(y * w + x) * 4] > 128

  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentro(x, y)) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null

  const alt = Math.max(1, y1 - y0)
  const de = Math.round(y0 + alt * 0.35)
  const ate = Math.round(y0 + alt * 0.65)
  let menorW = x1 - x0 + 1
  let cx = (x0 + x1) / 2
  let medido = false
  for (let y = de; y <= ate; y++) {
    let lx = -1
    let rx = -1
    for (let x = x0; x <= x1; x++) {
      if (!dentro(x, y)) continue
      if (lx < 0) lx = x
      rx = x
    }
    if (lx < 0) continue
    const larg = rx - lx + 1
    if (!medido || larg < menorW) {
      menorW = larg
      cx = (lx + rx) / 2
      medido = true
    }
  }
  const emblemW = menorW * 0.72
  return {
    box: [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h],
    emblem: { cx: cx / w, cy: (y0 + alt * 0.5) / h, maxW: emblemW / w, maxH: Math.min(emblemW, alt * 0.4) / h },
  }
}

function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Mede sobre o **recorte**, não sobre a foto, quando o recorte existe.
 *
 * Todas as zonas daqui saem do mesmo teste de primeiro plano, e ele erra pelo
 * mesmo motivo que errava a silhueta: no sprite branco em fundo branco, chapa
 * clara não alcança `COLOR_TOL`. A caixa da deriva saía menor que a deriva, e
 * como a pintura da cauda é um retângulo recortado pela máscara, o que sobrava
 * de fora ficava com a cor da fuselagem — o fio branco no bordo de ataque e a
 * mordida na ponta. A faixa da fuselagem e a caixa do emblema saíam do mesmo
 * teste e do mesmo jeito.
 *
 * Medido sobre `planemasks/<sprite>.png` o problema some sozinho: ali o avião é
 * branco sólido sobre preto sólido, e o mesmo teste acerta cada pixel. A foto
 * continua sendo o caminho de quem não tem recorte (a arte da Commons).
 */
export function measure(href: string, base = import.meta.env.BASE_URL): Promise<Measured | null> {
  if (cache.has(href)) return Promise.resolve(cache.get(href)!)
  const running = inFlight.get(href)
  if (running) return running

  const job = planeMaskHref(href, base)
    .then((recorte) => (recorte ? carregar(recorte) : null))
    .then((img) => img ?? carregar(href))
    .then((img) => {
      if (!img) return null
      try {
        return analyse(img)
      } catch {
        return null // canvas contaminado ou imagem estranha: segue sem medir
      }
    })
    .then((m) => {
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
  const colAbove = new Int32Array(w)
  for (let y = y0; y < fy0; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isFg((y * w + x) * 4)) continue
      colAbove[x]++
    }
  }

  // De que lado está a cauda: **o ponto mais alto do avião é a deriva**, em
  // todo airliner, inclusive nos de cauda em T.
  //
  // Antes isto saía de comparar a massa acima da fuselagem nas duas pontas, e
  // errava no a388: o convés superior avança até o nariz, joga massa para o
  // lado errado e invertia a resposta. A caixa da deriva ia parar na ponta
  // oposta à máscara e o resultado era uma deriva **sem pintura nenhuma** —
  // interseção vazia. Conferido nas 55 contra a máscara de cauda: o ponto mais
  // alto acerta todas.
  const topBand = y0 + Math.max(2, Math.round((fy1 - y0) * 0.05))
  let topSum = 0
  let topCount = 0
  for (let y = y0; y <= topBand; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isFg((y * w + x) * 4)) continue
      topSum += x
      topCount++
    }
  }
  const tailCx = topCount ? topSum / topCount : (x0 + x1) / 2
  const noseLeft = tailCx > (x0 + x1) / 2

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
