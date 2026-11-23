import type { GameState } from './types'

export const MAX_EXTERNAL_SAVE_BYTES = 50_000_000

/** JSON integral compactado em gzip, sem duplicar os campos em base64. */
export function exportSaveFile(state: GameState, pretty = true): string {
  return JSON.stringify({
    format: 'the-airline-simulator-save',
    fileVersion: 1,
    exportedAt: new Date().toISOString(),
    game: state,
  }, null, pretty ? 2 : undefined)
}

export async function compressSaveFile(state: GameState): Promise<Blob> {
  const compressed = await gzipSaveText(exportSaveFile(state, false))
  if (compressed.size > MAX_EXTERNAL_SAVE_BYTES)
    throw new Error('A partida compactada ultrapassa 50 MB. Nenhum arquivo foi gerado.')
  return compressed
}

export async function gzipSaveText(json: string): Promise<Blob> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream, { headers: { 'Content-Type': 'application/gzip' } }).blob()
}

export async function readSaveText(file: Blob) {
  const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (signature[0] !== 0x1f || signature[1] !== 0x8b) return file.text()
  return new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
}
