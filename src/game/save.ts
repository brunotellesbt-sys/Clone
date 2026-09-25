import { migrateLivery } from '../livery/presets'
import { completarNumeros, migrarEscala, sincronizarMalha } from './escala'
import { AIRCRAFT_BY_ID, ehCargueiro } from './data/aircraft'
import { AIRPORT_BY_IATA } from './data/airports'
import { clampPitch, defaultCabin, normalizarCabine } from './cabin'
import { engineIdFor } from './spec'
import type { Aircraft, GameState } from './types'

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
  s.airline.routes = (s.airline.routes ?? []).filter(
    (r) => AIRPORT_BY_IATA[r.from] && AIRPORT_BY_IATA[r.to],
  )
  s.airline.loans = s.airline.loans ?? []
  s.airline.codeshareNumbers ??= {}
  s.competitors = s.competitors ?? []
  s.ledger = s.ledger ?? []
  s.notices = s.notices ?? []
  s.lastShare = s.lastShare ?? {}

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

  migrarEscala(s)
  s.airline.escala = (s.airline.escala ?? []).filter(
    (p) => AIRPORT_BY_IATA[p.from] && AIRPORT_BY_IATA[p.to] &&
      s.airline.fleet.some((a) => a.id === p.aircraftId),
  )
  completarNumeros(s)
  sincronizarMalha(s)

  s.version = SAVE_VERSION
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

export function getSlotInfo(slot: number): SlotSummary | null {
  migrateOldSaveIfNeeded()
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot))
    if (!raw) return null
    const parsed = migrate(JSON.parse(raw) as GameState)
    if (!parsed || !parsed.airline) return null
    return {
      slot,
      name: parsed.airline.name,
      code: parsed.airline.code,
      hub: parsed.airline.hubs[0] ?? '---',
      day: parsed.day,
      cash: parsed.airline.cash,
    }
  } catch {
    return null
  }
}

export function saveGame(state: GameState, slot = getActiveSlot()) {
  migrateOldSaveIfNeeded()
  try {
    localStorage.setItem(SLOT_KEY(slot), JSON.stringify(state))
    setActiveSlot(slot)
    return true
  } catch {
    return false
  }
}

export function loadGame(slot = getActiveSlot()): GameState | null {
  migrateOldSaveIfNeeded()
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot))
    if (!raw) return null
    const parsed = migrate(JSON.parse(raw) as GameState)
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
  try {
    localStorage.removeItem(SLOT_KEY(slot))
  } catch {
    /* ignora */
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
