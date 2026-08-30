#!/usr/bin/env node
/**
 * Padroniza sprites de aeronave gerados por IA.
 *
 *   npm i -D sharp
 *   node normalize-sprites.mjs --in public/aircraft/sprites --dims dims.json \
 *                              --out public/aircraft/sprites/norm [--px-per-m 9] [--nose left]
 *
 * O problema que isto resolve: um lote gerado com o mesmo prompt sai com
 * camera, distancia e enquadramento diferentes. Lado a lado numa lista de
 * frota o defeito salta — um A320 do tamanho de um 777.
 *
 * A correcao nao e regerar, e medir: recorta cada PNG pelo canal alfa e
 * reescala pelo comprimento REAL do modelo (shape.length do catalogo), de modo
 * que todos passem a ter a mesma relacao pixel/metro. O 777 fica maior que o
 * A320 na proporcao certa, e todos ficam centrados na mesma tela.
 *
 * dims.json e so um mapa de comprimento em metros:
 *   { "a320neo": 37.6, "b789": 62.8, "atr72": 27.2 }
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('falta a dependencia sharp. Rode: npm i -D sharp')
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

const IN = flag('in', 'public/aircraft/sprites')
const OUT = flag('out', join(IN, 'norm'))
const DIMS = flag('dims', 'dims.json')
const PX_PER_M = Number(flag('px-per-m', 9))
const NOSE = flag('nose', 'left')
/** Alfa abaixo disto e considerado fundo: PNG de IA costuma ter borda suja. */
const ALPHA_MIN = 12

/** Caixa do que realmente e aviao, em pixels. */
function alphaBounds(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/**
 * De que lado esta o nariz. O cone de cauda e a deriva concentram massa
 * vertical: a metade com maior altura media de pixels opacos e a cauda.
 */
function noseSide(data, w, h, box) {
  const alturaMedia = (xa, xb) => {
    let soma = 0
    for (let x = xa; x < xb; x++) {
      let alto = h, baixo = -1
      for (let y = box.top; y < box.top + box.height; y++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
          if (y < alto) alto = y
          if (y > baixo) baixo = y
        }
      }
      if (baixo >= 0) soma += baixo - alto
    }
    return soma / Math.max(1, xb - xa)
  }
  const meio = box.left + box.width / 2
  return alturaMedia(box.left, Math.round(meio)) < alturaMedia(Math.round(meio), box.left + box.width)
    ? 'left'
    : 'right'
}

const dims = JSON.parse(await readFile(DIMS, 'utf8'))
await mkdir(OUT, { recursive: true })

const arquivos = (await readdir(IN)).filter((f) => extname(f).toLowerCase() === '.png')
if (!arquivos.length) {
  console.error(`nenhum PNG em ${IN}`)
  process.exit(1)
}

// A tela e a mesma para todos: cabe o maior aviao do lote com folga, e todos
// ficam centrados nela. Sprite de tamanho variavel exige a UI compensar depois.
const maiorM = Math.max(...arquivos.map((f) => dims[basename(f, '.png')] ?? 0))
if (!maiorM) {
  console.error('nenhum comprimento encontrado no dims.json para os arquivos de entrada')
  process.exit(1)
}
const CANVAS_W = Math.ceil((maiorM * PX_PER_M * 1.06) / 2) * 2
const CANVAS_H = Math.ceil((CANVAS_W * 0.34) / 2) * 2

console.log(`tela ${CANVAS_W}x${CANVAS_H}px | ${PX_PER_M}px por metro | nariz para ${NOSE}`)

for (const arquivo of arquivos) {
  const id = basename(arquivo, '.png')
  const comprimento = dims[id]
  if (!comprimento) {
    console.warn(`  ${id}: sem comprimento no dims.json, pulando`)
    continue
  }
  try {
    const entrada = sharp(join(IN, arquivo)).ensureAlpha()
    const { data, info } = await entrada.raw().toBuffer({ resolveWithObject: true })
    const box = alphaBounds(data, info.width, info.height)
    if (!box) {
      console.warn(`  ${id}: imagem sem pixel opaco (o fundo foi mesmo removido?)`)
      continue
    }

    const larguraAlvo = Math.round(comprimento * PX_PER_M)
    if (larguraAlvo > CANVAS_W) {
      console.warn(`  ${id}: nao cabe na tela; reduza --px-per-m`)
      continue
    }

    let img = sharp(join(IN, arquivo)).ensureAlpha().extract(box)
    if (noseSide(data, info.width, info.height, box) !== NOSE) img = img.flop()

    const recortado = await img
      .resize({ width: larguraAlvo, fit: 'inside', withoutEnlargement: false })
      .toBuffer({ resolveWithObject: true })

    const alturaEscalada = recortado.info.height
    if (alturaEscalada > CANVAS_H) {
      console.warn(`  ${id}: ${alturaEscalada}px de altura estoura a tela de ${CANVAS_H}px`)
    }
    const sobraY = Math.max(0, CANVAS_H - alturaEscalada)
    const sobraX = Math.max(0, CANVAS_W - recortado.info.width)

    await sharp(recortado.data)
      .extend({
        top: Math.floor(sobraY / 2),
        bottom: Math.ceil(sobraY / 2),
        left: Math.floor(sobraX / 2),
        right: Math.ceil(sobraX / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, arquivo))

    console.log(`  ${id}: ${box.width}x${box.height} -> ${larguraAlvo}px (${comprimento} m)`)
  } catch (err) {
    console.error(`  ${id}: ${err.message}`)
  }
}

await writeFile(
  join(OUT, 'sprites.json'),
  JSON.stringify({ canvas: [CANVAS_W, CANVAS_H], pxPerMeter: PX_PER_M, nose: NOSE }, null, 2) + '\n',
)
console.log(`\npronto em ${OUT}`)
