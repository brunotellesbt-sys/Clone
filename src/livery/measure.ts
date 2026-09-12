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
 * A hélice dos turboélices (atr42, atr72, q400), pá e cone — a terceira peça de
 * cor original, junto com motor e trem. `tirar_helice.py` já a tinha expulsado
 * dos setores de asa e motor, com razão (pá não é chapa pintável), mas peça que
 * não é de ninguém fica com a cor de fundo da silhueta: sem este recorte o
 * atr42 saía com hélice branca.
 */
export const propMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('propmasks', id, base)

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
 * A nacela inteira e o trem inteiro — as peças de **cor original**.
 *
 * Voltaram a ter carregador aqui, e por um motivo novo: a livery não pinta mais
 * nenhuma das duas, e o jogo desenha a foto opaca em cima delas para que a peça
 * fique exatamente como ela é. Antes eram só referência de medida; agora são o
 * recorte de onde a pintura **não** vai.
 */
export const gearMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('gearmasks', id, base)
export const engineMaskHref = (id: string, base = import.meta.env.BASE_URL) => namedMaskHref('enginemasks', id, base)

/*
 * `enginecowlmasks`, `gearstrutmasks` e `tyremasks` seguem no repositório —
 * são referência de medida e origem dos recortes — mas não têm carregador
 * aqui: desde que motor e trem passaram a ficar com a cor original, a livery
 * não pinta nenhuma das três, e a arte usa a peça **inteira** para saber onde
 * não pintar.
 */

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

/** Uma linha do perfil: todas as corridas contínuas dela, em fração da largura. */
export type ProfileRow = Array<[number, number]>

const perfilCache = new Map<string, ProfileRow[] | null>()

/**
 * O perfil é medido na resolução **nativa** da máscara, e não reduzido a
 * `SAMPLE_W` como o resto.
 *
 * Reduzir é o que as outras medidas fazem porque só precisam de uma caixa. Aqui
 * a pergunta é "esta linha está inteira dentro do tubo?", e reduzir responde
 * errado: o `drawImage` reduzido interpola, uma linha de destino cobre três da
 * origem, e uma lasca de tubo no meio dessas três passava de linha cheia. Era
 * assim que o topo da caixa do letreiro terminava acima do dorso no b78x e no
 * a339 — 21% e 31% da área fora, medidos, com a faixa aprovada.
 *
 * O teto existe para não ler uma imagem absurda; os sprites têm 1536 de largura.
 */
const PERFIL_MAX_W = 2048

/**
 * Perfil da peça: para cada linha amostrada, **todas** as corridas contínuas
 * dela em x.
 *
 * Substitui medir uma faixa por vez. Faixa por vez obriga uma medição nova a
 * cada mudança de livery — o prefixo sobe e desce com a listra, o letreiro
 * muda de altura com o tamanho da letra —, e medição assíncrona no meio do
 * desenho pisca. Com o perfil na mão, qualquer faixa se resolve na hora:
 * `entre()` cruza as linhas dela.
 *
 * Todas as corridas, e não a maior de cada linha: numa asa alta a asa corta o
 * tubo em duas na mesma linha, e qual pedaço é o maior muda de linha para
 * linha — no an148 a linha de cima tem a maior corrida atrás da asa e a de
 * baixo na frente dela. Guardando só a maior, cruzar as duas dava um intervalo
 * que não está dentro de nenhuma das duas, e o letreiro saía em cima da asa.
 */
export function tubeProfile(href: string): Promise<ProfileRow[] | null> {
  if (perfilCache.has(href)) return Promise.resolve(perfilCache.get(href)!)
  return carregar(href)
    .then((img) => {
      if (!img) return null
      try {
        return medirPerfil(img)
      } catch {
        return null
      }
    })
    .then((v) => {
      perfilCache.set(href, v)
      return v
    })
}

function medirPerfil(img: HTMLImageElement): ProfileRow[] {
  const w = Math.min(PERFIL_MAX_W, img.naturalWidth)
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const linhas: ProfileRow[] = []
  for (let y = 0; y < h; y++) {
    const corridas: ProfileRow = []
    let ini = -1
    for (let x = 0; x <= w; x++) {
      const dentro = x < w && data[(y * w + x) * 4] > 128
      if (dentro && ini < 0) ini = x
      if (!dentro && ini >= 0) {
        corridas.push([ini / w, x / w])
        ini = -1
      }
    }
    linhas.push(corridas)
  }
  return linhas
}

/**
 * A primeira e a última linha não vazia de um perfil, em fração da altura.
 *
 * Serve para a fileira de janela, e existe em vez de `pieceBox` porque a caixa
 * é medida reduzida a `SAMPLE_W`: janela tem 6 px de altura, e reduzida a menos
 * de um pixel a borda de baixo se perde. A diferença chegava a 13 px no b737 —
 * e 13 px é exatamente o que fazia a onda encostar na janela com o teto dela
 * respeitado.
 */
export function faixaDoPerfil(perfil: ProfileRow[] | null): [number, number] | null {
  if (!perfil || !perfil.length) return null
  const n = perfil.length
  let de = -1
  let ate = -1
  for (let y = 0; y < n; y++) {
    if (!perfil[y].length) continue
    if (de < 0) de = y
    ate = y
  }
  return de < 0 ? null : [de / n, (ate + 1) / n]
}

/** Interseção de duas listas de intervalos ordenadas. */
function cruzar(a: ProfileRow, b: ProfileRow): ProfileRow {
  const out: ProfileRow = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const ini = Math.max(a[i][0], b[j][0])
    const fim = Math.min(a[i][1], b[j][1])
    if (fim > ini) out.push([ini, fim])
    if (a[i][1] < b[j][1]) i++
    else j++
  }
  return out
}

/**
 * Como `entre`, mas devolve **todas** as corridas livres da faixa, da maior
 * para a menor. Serve para escolher onde pôr a peça quando a maior corrida não
 * é a que interessa — o prefixo quer a de trás, o letreiro a da frente.
 */
export function entreTodas(
  perfil: ProfileRow[] | null,
  y0: number,
  y1: number,
): ProfileRow | null {
  if (!perfil || !perfil.length) return null
  const n = perfil.length
  // Faixa que sai da imagem é faixa inválida, não faixa aparada: aparar aceitaria
  // texto desenhado acima do avião só porque a parte de cima não tem linha.
  if (y0 < 0 || y1 > 1 || y1 <= y0) return null
  // Toda linha que a caixa **toca**, arredondando para fora. Arredondar para o
  // mais próximo deixava a linha da borda de fora da conta.
  const de = Math.max(0, Math.floor(y0 * n))
  const ate = Math.min(n - 1, Math.ceil(y1 * n) - 1)
  if (ate < de) return null
  let atual: ProfileRow | null = null
  for (let y = de; y <= ate; y++) {
    const l = perfil[y]
    if (!l.length) return null
    atual = atual ? cruzar(atual, l) : l.slice()
    if (!atual.length) return null
  }
  if (!atual || !atual.length) return null
  return atual.slice().sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
}

const runCache = new Map<string, [number, number] | null>()

/**
 * O trecho mais longo de fileira de janela **sem porta**, em fração da largura.
 *
 * Serve para achar onde o letreiro cabe bem. A fileira de janela é interrompida
 * exatamente onde há porta e saída de emergência, então o maior trecho contínuo
 * de janelas é o maior pano de fuselagem limpo que existe — é ali que a
 * companhia escreve o nome, e é ali que ele não cai em cima de porta.
 *
 * O vão entre duas janelas vizinhas conta como janela: janela é retângulo
 * isolado, e sem fechar esses vãos cada janela seria um "trecho" de 6px. Fecha-se
 * até três vezes a largura de uma janela; porta é bem mais larga que isso.
 */
export function windowSpan(href: string): Promise<[number, number] | null> {
  if (runCache.has(href)) return Promise.resolve(runCache.get(href)!)
  return carregar(href)
    .then((img) => {
      if (!img) return null
      try {
        return medirCorrida(img)
      } catch {
        return null
      }
    })
    .then((v) => {
      runCache.set(href, v)
      return v
    })
}

/**
 * Também em resolução nativa, e pelo mesmo motivo do perfil — aqui o motivo é
 * pior ainda: janela tem 6 px de largura, e reduzida a um quarto de pixel ela
 * sobrevive ou desaparece conforme a fase do arredondamento. Com metade das
 * janelas perdidas a mediana mente, todo vão parece porta, e o trecho "limpo"
 * do b764 dava 45 px — 3% do avião. Não sobrando vão nenhum para o letreiro, a
 * arte caía no palpite e escrevia acima do dorso.
 */
function medirCorrida(img: HTMLImageElement): [number, number] | null {
  const w = Math.min(PERFIL_MAX_W, img.naturalWidth)
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const tem = new Array<boolean>(w).fill(false)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4] > 128) {
        tem[x] = true
        break
      }
    }
  }

  // largura típica de uma janela: a mediana das corridas cheias
  const cheias: number[] = []
  let n = 0
  for (let x = 0; x <= w; x++) {
    if (x < w && tem[x]) n++
    else if (n) {
      cheias.push(n)
      n = 0
    }
  }
  if (!cheias.length) return null
  cheias.sort((a, b) => a - b)
  const janela = Math.max(1, cheias[Math.floor(cheias.length / 2)])

  // fecha vão de até três janelas: o que sobrar aberto é porta
  const fechado = tem.slice()
  let vazio = 0
  for (let x = 0; x < w; x++) {
    if (!tem[x]) {
      vazio++
      continue
    }
    if (vazio > 0 && vazio <= janela * 3) {
      for (let k = x - vazio; k < x; k++) fechado[k] = true
    }
    vazio = 0
  }

  let melhor: [number, number] | null = null
  let ini = -1
  for (let x = 0; x <= w; x++) {
    const dentro = x < w && fechado[x]
    if (dentro && ini < 0) ini = x
    if (!dentro && ini >= 0) {
      if (!melhor || x - ini > melhor[1] - melhor[0]) melhor = [ini, x]
      ini = -1
    }
  }
  return melhor ? [melhor[0] / w, melhor[1] / w] : null
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
