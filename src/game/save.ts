import { accessSave } from './saveStorage'
import { readSaveText } from './saveFileCodec'
export { compressSaveFile, exportSaveFile, MAX_EXTERNAL_SAVE_BYTES } from './saveFileCodec'
import LZString from 'lz-string'
import {rebalanceCompetitorHubs} from './ai'
import { effectiveAirport, ensureAirports } from './airportInfrastructure'
import { migrateLivery } from '../livery/presets'
import { completarNumeros, migrarEscala, sincronizarMalha } from './escala'
import { AIRCRAFT_BY_ID, ehCargueiro } from './data/aircraft'
import { AIRPORT_BY_IATA, vooPermitido } from './data/airports'
import { clampPitch, defaultCabin, normalizarCabine } from './cabin'
import { migrarCabines } from './cabinProfiles'
import { engineIdFor } from './spec'
import type { Aircraft, GameState } from './types'

/** Mantém a leitura da compactação usada nos slots locais. */
export const encodeStoredSave = (s: GameState) => {
  const json=JSON.stringify(s)
  return json.length>1_000_000?'LZ1:'+LZString.compressToUTF16(json):json
}
export const decodeStoredSave = (raw: string): GameState => JSON.parse(
  raw.startsWith('LZ1:')?LZString.decompressFromUTF16(raw.slice(4)):raw,
)
export const SAVE_VERSION = 2
export const AVAILABLE_SLOTS = [1, 2, 3] as const

/** Modelos que trocaram de id quando o catálogo ganhou as variantes reais. */
const RENAMED: Record<string, string> = { a220: 'a220300' }

/**
 * Traz um save antigo para o formato atual: id de modelo renomeado, motor de
 * série e passo de poltrona. Save da versão 1 não guardava nem um nem outro.
 */
function migrate(s: GameState): GameState | null {
  if (!s || (s.version !== 1 && s.version !== SAVE_VERSION)) return null
  if (!s.airline || !s.airline.hubs?.some((h) => AIRPORT_BY_IATA[h])) return null

  s.airline.hubs = s.airline.hubs.filter((h) => AIRPORT_BY_IATA[h])
  s.airline.fleet = s.airline.fleet ?? []
  /**
   * Rota que a regra de hoje proíbe sai do save — e sai calada.
   *
   * O caso que motivou: Congonhas–Guarulhos, Congonhas–Viracopos e
   * Santos Dumont–Galeão. São pares da mesma região metropolitana, sem
   * mercado nenhum, e o jogo aceitava abri-los. Deixá-los num save antigo não
   * seria "respeitar o que o jogador montou": seria manter rotas cuja demanda
   * agora é zero, com aeronave presa nelas e resultado no vermelho todo dia.
   *
   * É a mesma peneira de `vooPermitido` que a tela de abrir rota usa, então
   * não há como um save carregar par que o jogo não deixaria abrir hoje.
   */
  s.airline.routes = (s.airline.routes ?? []).filter(
    (r) => AIRPORT_BY_IATA[r.from] && AIRPORT_BY_IATA[r.to] &&
      !vooPermitido(effectiveAirport(s, r.from), effectiveAirport(s, r.to)),
  )
  s.airline.loans = s.airline.loans ?? []
  s.airline.codeshareNumbers ??= {}
  s.competitors = s.competitors ?? []
  /**
   * E as rotas das concorrentes também: elas alimentam a disputa por
   * passageiro e a lista de "quantas companhias voam este par". Uma rota
   * fantasma numa concorrente roubaria fatia num mercado que não existe.
   */
  for (const c of s.competitors) {
    c.routes = (c.routes ?? []).filter((r) => {
      const a = effectiveAirport(s, r.from)
      const b = effectiveAirport(s, r.to)
      return a && b && !vooPermitido(a, b)
    })
  }
  s.ledger = s.ledger ?? []
  s.notices = s.notices ?? []
  s.lastShare = s.lastShare ?? {}
  s.speed = [4,25].includes(s.speed) ? 75 : [12,50].includes(s.speed) ? 300 : [40,100].includes(s.speed) ? 600 :
    [0, 1, 75, 300, 600].includes(s.speed) ? s.speed : 1

  s.airline.livery = migrateLivery(s.airline.livery)
  s.airline.fleet = s.airline.fleet.flatMap((raw): Aircraft[] => {
    const ac = raw as Aircraft
    ac.typeId = RENAMED[ac.typeId] ?? ac.typeId
    const t = AIRCRAFT_BY_ID[ac.typeId]
    if (!t) return []
    ac.engineId = engineIdFor(t, ac.engineId)
    ac.pitch = clampPitch(ac.pitch)
    if (!ac.seats || typeof ac.seats.y !== 'number') ac.seats = defaultCabin(t).seats
    if (ehCargueiro(t)) ac.seatConfig = undefined
    else Object.assign(ac, normalizarCabine(t, ac.seats, ac.pitch, ac.seatConfig))
    ac.cc = ac.cc || AIRPORT_BY_IATA[s.airline.hubs[0]]?.cc || 'BR'
    return [ac]
  })
  if (s.airline.cabines) s.airline.cabines = migrarCabines(s.airline.cabines, RENAMED)

  migrarEscala(s)
  s.airline.escala = (s.airline.escala ?? []).filter(
    (p) => AIRPORT_BY_IATA[p.from] && AIRPORT_BY_IATA[p.to] &&
      s.airline.fleet.some((a) => a.id === p.aircraftId),
  )
  completarNumeros(s)
  sincronizarMalha(s)

  s.version = SAVE_VERSION
  ensureAirports(s)
  rebalanceCompetitorHubs(s)
  return s
}

const LEGACY_KEY = 'skyline-tycoon:save'
const ACTIVE_SLOT_KEY = 'skyline-tycoon:active-slot'
const SLOT_KEY = (n: number) => `skyline-tycoon:save:${n}`

/**
 * Migra o save antigo (chave única `skyline-tycoon:save` ou `skyline-tycoon:save:0`)
 * para o Slot 1 (`skyline-tycoon:save:1`), se o Slot 1 ainda não existir.
 */
export function migrateOldSaveIfNeeded() {
  try {
    const slot1Data = localStorage.getItem(SLOT_KEY(1))
    const legacyData = localStorage.getItem(LEGACY_KEY)
    const slot0Data = localStorage.getItem('skyline-tycoon:save:0')

    if (!slot1Data) {
      if (legacyData) {
        localStorage.setItem(SLOT_KEY(1), legacyData)
      } else if (slot0Data) {
        localStorage.setItem(SLOT_KEY(1), slot0Data)
      }
    }

    if (legacyData) {
      localStorage.removeItem(LEGACY_KEY)
    }
    if (slot0Data) {
      localStorage.removeItem('skyline-tycoon:save:0')
    }
  } catch {
    /* ignora se o localStorage estiver desabilitado */
  }
}

export function getActiveSlot(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY)
    const parsed = raw ? parseInt(raw, 10) : 1
    if (parsed >= 1 && parsed <= 3) return parsed
  } catch {
    /* ignora */
  }
  return 1
}

export function setActiveSlot(slot: number) {
  try {
    if (slot >= 1 && slot <= 3) {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(slot))
    }
  } catch {
    /* ignora */
  }
}

export interface SlotSummary {
  slot: number
  name: string
  code: string
  hub: string
  day: number
  cash: number
}

const FILE_MARKER = 'IDB:'
type SavePointer = SlotSummary & { key: string }

function savePointer(raw: string | null): SavePointer | undefined {
  if (!raw?.startsWith(FILE_MARKER)) return
  try {
    const pointer = JSON.parse(raw.slice(FILE_MARKER.length)) as SavePointer
    return typeof pointer?.key === 'string' ? pointer : undefined
  } catch { return undefined }
}

function summary(s: GameState, slot: number): SlotSummary {
  return { slot, name: s.airline.name, code: s.airline.code, hub: s.airline.hubs[0] ?? '---',
    day: s.day, cash: s.airline.cash }
}

function removeStoredFile(key: string) {
  void accessSave('readwrite', store => store.delete(key)).catch(() => {})
}

export function getSlotInfo(slot: number): SlotSummary | null {
  migrateOldSaveIfNeeded()
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot))
    if (!raw) return null
    const pointer = savePointer(raw)
    if (pointer) return pointer
    const parsed = migrate(decodeStoredSave(raw))
    return parsed?.airline ? summary(parsed, slot) : null
  } catch {
    return null
  }
}

const saveVersions=new Map<number,number>()
const pendingSaves=new Map<number,GameState>()
// A leitura na mesma aba deve enxergar imediatamente o último estado
// confirmado, mesmo enquanto o worker termina a compressão em segundo plano.
const latestSaves=new Map<number,GameState>()
let saveWorker:Worker|undefined, saving=false, saveTimer:ReturnType<typeof setTimeout>|undefined
function invalidatePendingSave(slot:number) {
  saveVersions.set(slot,(saveVersions.get(slot)??0)+1);pendingSaves.delete(slot)
}
/** Compressão fora da interface; uma única fila coalesce cliques rápidos. */
export function queueSaveGame(state:GameState,slot=getActiveSlot()) {
  invalidatePendingSave(slot);pendingSaves.set(slot,state);latestSaves.set(slot,state)
  if(saveTimer)clearTimeout(saveTimer)
  saveTimer=setTimeout(pumpSaves,100)
}
async function storeEncodedSave(info: SlotSummary, version: number, stored: string | Blob) {
  const { slot } = info
  if (saveVersions.get(slot) !== version) return false
  const storageKey = SLOT_KEY(slot)
  const previous = savePointer(localStorage.getItem(storageKey))
  let written = false
  if (typeof stored === 'string') {
    try {
      localStorage.setItem(storageKey, stored)
      written = true
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
    }
  }
  if (!written) {
    const key = crypto.randomUUID()
    try {
      await accessSave('readwrite', store => store.put(stored, key))
      if (saveVersions.get(slot) !== version) {
        removeStoredFile(key)
        return false
      }
      localStorage.setItem(storageKey, FILE_MARKER + JSON.stringify({ ...info, key }))
    } catch (error) {
      removeStoredFile(key)
      throw error
    }
  }
  if (previous) removeStoredFile(previous.key)
  latestSaves.delete(slot)
  return true
}

function pumpSaves() {
  if (saving || !pendingSaves.size) return
  const [slot, state] = pendingSaves.entries().next().value!
  pendingSaves.delete(slot)
  const version = saveVersions.get(slot)!
  const info = summary(state, slot)
  saving = true
  if (!saveWorker) {
    try { saveWorker = new Worker(new URL('./saveWorker.ts', import.meta.url), { type: 'module' }) }
    catch { saving = false; window.dispatchEvent(new Event('game-save-error')); return }
  }
  const done = () => { saving = false; pumpSaves() }
  saveWorker.onmessage = async ({ data }) => {
    try {
      if (data.error) throw new Error(data.error)
      await storeEncodedSave(info, version, data.stored)
    } catch { if (saveVersions.get(slot) === version) window.dispatchEvent(new Event('game-save-error')) }
    finally { done() }
  }
  saveWorker.onerror = () => {
    saveWorker?.terminate()
    saveWorker = undefined
    window.dispatchEvent(new Event('game-save-error'))
    done()
  }
  try { saveWorker.postMessage({ operation: 'store', slot, state, version }) }
  catch { window.dispatchEvent(new Event('game-save-error')); done() }
}

export async function persistSaveGame(state: GameState, slot = getActiveSlot()) {
  invalidatePendingSave(slot)
  const version = saveVersions.get(slot)!
  const info = summary(state, slot)
  try {
    const stored = await runSaveWorker<string | Blob>({ operation: 'store', state, slot, version }, 'stored')
    if (!await storeEncodedSave(info, version, stored)) return false
    setActiveSlot(slot)
    return true
  } catch { return false }
}

export async function loadSaveGame(slot = getActiveSlot()) {
  const local = loadGame(slot)
  if (local) return local
  try {
    const pointer = savePointer(localStorage.getItem(SLOT_KEY(slot)))
    if (!pointer) return null
    const data = await accessSave('readonly', store => store.get(pointer.key))
    if (!data) return null
    const parsed = typeof data === 'string' ? migrate(decodeStoredSave(data)) : await readSaveFile(data)
    if (!parsed) return null
    parsed.paused = true
    setActiveSlot(slot)
    return parsed
  } catch { return null }
}

export function flushLocalSave(state: GameState, slot = getActiveSlot()) {
  try { if (!savePointer(localStorage.getItem(SLOT_KEY(slot)))) saveGame(state, slot) }
  catch { /* o navegador está encerrando a página */ }
}

export function saveGame(state: GameState, slot = getActiveSlot()) {
  invalidatePendingSave(slot)
  latestSaves.set(slot,state)
  migrateOldSaveIfNeeded()
  try {
    const previous = savePointer(localStorage.getItem(SLOT_KEY(slot)))
    localStorage.setItem(SLOT_KEY(slot), encodeStoredSave(state))
    if (previous) removeStoredFile(previous.key)
    setActiveSlot(slot)
    latestSaves.delete(slot)
    return true
  } catch {
    return false
  }
}

export function loadGame(slot = getActiveSlot()): GameState | null {
  migrateOldSaveIfNeeded()
  try {
    const queued=latestSaves.get(slot)
    if(queued) {
      const parsed=migrate(structuredClone(queued))
      if(!parsed) return null
      parsed.paused=true
      setActiveSlot(slot)
      return parsed
    }
    const raw = localStorage.getItem(SLOT_KEY(slot))
    if (!raw || raw.startsWith(FILE_MARKER)) return null
    const parsed = migrate(decodeStoredSave(raw))
    if (!parsed) return null
    parsed.paused = true
    setActiveSlot(slot)
    return parsed
  } catch {
    return null
  }
}

export function hasSave(slot = getActiveSlot()) {
  migrateOldSaveIfNeeded()
  try {
    return !!localStorage.getItem(SLOT_KEY(slot))
  } catch {
    return false
  }
}

export function clearSave(slot = getActiveSlot()) {
  invalidatePendingSave(slot)
  latestSaves.delete(slot)
  try {
    const pointer = savePointer(localStorage.getItem(SLOT_KEY(slot)))
    localStorage.removeItem(SLOT_KEY(slot))
    if (pointer) removeStoredFile(pointer.key)
  } catch {
    /* ignora */
  }
}

function runSaveWorker<T>(request: object, field: 'blob' | 'stored'): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./saveWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      worker.terminate()
      if (data[field] != null) resolve(data[field])
      else reject(new Error(data.error ?? 'Não foi possível gerar o arquivo da partida.'))
    }
    worker.onerror = event => {
      worker.terminate()
      reject(new Error(event.message || 'Não foi possível gerar o arquivo da partida.'))
    }
    try { worker.postMessage(request) }
    catch (error) { worker.terminate(); reject(error) }
  })
}

export function exportCompressedSave(state: GameState): Promise<Blob> {
  return runSaveWorker({ operation: 'export', state }, 'blob')
}

export async function readSaveFile(file: Blob): Promise<GameState | null> {
  return importSaveFile(await readSaveText(file))
}

export function importSaveFile(text: string): GameState | null {
  try {
    const file = JSON.parse(text)
    if (file?.format === 'the-airline-simulator-save' && file.fileVersion === 1 && file.game)
      return migrate(file.game as GameState)
    if (file?.version && file?.airline) return migrate(file as GameState)
    return null
  } catch {
    // Backups anteriores eram texto em base64; podem ser importados se salvos como .txt.
    return importSave(text)
  }
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))))
}

export function importSave(text: string): GameState | null {
  try {
    return migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))) as GameState)
  } catch {
    return null
  }
}
