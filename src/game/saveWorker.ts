import LZString from 'lz-string'
import { compressSaveFile, gzipSaveText } from './saveFileCodec'
import type { GameState } from './types'

type Request = { operation: 'export'; state: GameState }
  | { operation: 'store'; state: GameState; slot: number; version: number }

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.operation === 'export') {
      self.postMessage({ blob: await compressSaveFile(data.state) })
    } else {
      const json = JSON.stringify(data.state)
      const stored = json.length > 4_000_000 ? await gzipSaveText(json) :
        json.length > 1_000_000 ? 'LZ1:' + LZString.compressToUTF16(json) : json
      self.postMessage({ slot: data.slot, version: data.version, stored })
    }
  } catch (error) {
    self.postMessage({ ...(data.operation === 'store' && { slot: data.slot, version: data.version }),
      error: error instanceof Error ? error.message : String(error) })
  }
}
