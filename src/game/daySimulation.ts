import { applyDayUpdate, type DayUpdate } from './dayUpdate'
import type { GameState } from './types'

/** Reutiliza a cópia do worker enquanto não houver ações do jogador. */
export class DaySimulation {
  private worker: Worker
  private synced?: { state: GameState; revision: number }
  private pending?: { resolve: (u: DayUpdate) => void; reject: (e: Error) => void }

  constructor() {
    this.worker = new Worker(new URL('./dayWorker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = ({ data }: MessageEvent<{ update?: DayUpdate; error?: string }>) => {
      const job = this.pending
      this.pending = undefined
      if (data.update) job?.resolve(data.update)
      else job?.reject(new Error(data.error ?? 'Resultado de simulação inválido'))
    }
    this.worker.onerror = event => {
      const job = this.pending
      this.pending = undefined
      job?.reject(new Error(event.message || 'Falha na simulação'))
    }
  }

  async advance(state: GameState, revision: number) {
    if (this.pending) throw new Error('Já existe um dia em cálculo')
    const reusable = this.synced?.state === state && this.synced.revision === revision
    this.synced = undefined
    const update = await new Promise<DayUpdate>((resolve, reject) => {
      this.pending = { resolve, reject }
      try {
        this.worker.postMessage(reusable ? {} : { state })
      } catch (error) {
        this.pending = undefined
        reject(error)
      }
    })
    const next = applyDayUpdate(state, update)
    this.synced = { state: next, revision }
    return next
  }

  dispose() {
    this.worker.terminate()
    this.pending?.reject(new Error('Simulação interrompida'))
    this.pending = undefined
    this.synced = undefined
  }
}
