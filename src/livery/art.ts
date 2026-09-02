/**
 * Arte real das aeronaves.
 *
 * O jogo procura por `public/aircraft/<id>.(svg|png|webp)` e usa a imagem
 * como MÁSCARA: a silhueta verdadeira do modelo entra, e a pintura da
 * companhia é aplicada por cima, recortada nela. Assim a forma é a do avião
 * de verdade e as cores continuam sendo suas.
 *
 * Sem imagem para um modelo, cai no desenho vetorial paramétrico.
 */
export interface ArtEntry {
  /** Caminho relativo à raiz publicada. */
  file: string
  /** Largura e altura do arquivo, para o enquadramento. */
  w: number
  h: number
  /** Onde ficam as regiões pintáveis, em fração da imagem (0–1). */
  regions?: {
    /** Recorte do avião na imagem: [x0, y0, x1, y1]. Corta cota e legenda. */
    box?: [number, number, number, number]
    /** Faixa vertical ocupada pela fuselagem (barriga e cheatline). */
    fuselage?: [number, number]
    /** Retângulo da deriva: [x0, y0, x1, y1]. */
    tail?: [number, number, number, number]
    /** Onde escrever o letreiro: [x, y] em fração. */
    titles?: [number, number]
  }
  /** Crédito exigido pela licença. */
  credit?: { author: string; license: string; source: string }
}

export type ArtManifest = Record<string, ArtEntry>

let cache: ArtManifest | null = null
let pending: Promise<ArtManifest> | null = null

/** Carrega o manifesto uma vez. A ausência do arquivo é normal: usa-se o vetor. */
export function loadArtManifest(base = import.meta.env.BASE_URL): Promise<ArtManifest> {
  if (cache) return Promise.resolve(cache)
  if (pending) return pending
  pending = fetch(`${base}aircraft/manifest.json`, { cache: 'force-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: ArtManifest) => {
      cache = m ?? {}
      return cache
    })
    .catch(() => {
      cache = {}
      return cache
    })
  return pending
}

/**
 * Chave composta `id:motor` primeiro — o motor muda o tamanho da nacela e às
 * vezes o desenho inteiro (mesmo padrão de chave que `spec.ts` já usa para a
 * ficha efetiva). Sem entrada por motor, cai na entrada só do modelo; sem
 * nenhuma das duas, cai no vetor.
 */
export const artFor = (id: string, engineId?: string | null): ArtEntry | undefined =>
  (engineId && cache?.[`${id}:${engineId}`]) || cache?.[id]

/** Linha de crédito exigida pela licença, quando a imagem vem de terceiros. */
export function creditLine(id: string, engineId?: string | null): string | null {
  const c = artFor(id, engineId)?.credit
  if (!c || !c.license) return null
  return `Silhueta: ${c.author || 'autor na página do arquivo'} · ${c.license}`
}

export const creditSource = (id: string, engineId?: string | null): string | null =>
  artFor(id, engineId)?.credit?.source ?? null

/** Regiões padrão, deduzidas das proporções típicas de um avião de linha. */
export const DEFAULT_REGIONS: {
  fuselage: [number, number]
  tail: [number, number, number, number]
  titles: [number, number]
} = {
  fuselage: [0.42, 0.72],
  tail: [0.72, 0.0, 1.0, 0.55],
  titles: [0.24, 0.44],
}
