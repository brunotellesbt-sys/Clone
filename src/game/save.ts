import { migrateLivery } from '../livery/presets'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { clampPitch, defaultCabin } from './cabin'
import { engineIdFor } from './spec'
import type { Aircraft, GameState } from './types'

export const SAVE_VERSION = 2

/** Modelos que trocaram de id quando o catálogo ganhou as variantes reais. */
const RENAMED: Record<string, string> = { a220: 'a220300' }

/**
 * Traz um save antigo para o formato atual: id de modelo renomeado, motor de
 * série e passo de poltrona. Save da versão 1 não guardava nem um nem outro.
 */
function migrate(s: GameState): GameState | null {
  if (!s || (s.version !== 1 && s.version !== SAVE_VERSION)) return null
  s.airline.livery = migrateLivery(s.airline.livery)
  s.airline.fleet = s.airline.fleet.flatMap((raw): Aircraft[] => {
    const ac = raw as Aircraft
    ac.typeId = RENAMED[ac.typeId] ?? ac.typeId
    const t = AIRCRAFT_BY_ID[ac.typeId]
    if (!t) return []
    ac.engineId = engineIdFor(t, ac.engineId)
    ac.pitch = clampPitch(ac.pitch)
    if (!ac.seats || typeof ac.seats.y !== 'number') ac.seats = defaultCabin(t).seats
    return [ac]
  })
  s.version = SAVE_VERSION
  return s
}

const KEY = 'skyline-tycoon:save'
const SLOT_KEY = (n: number) => `${KEY}:${n}`

export function saveGame(state: GameState, slot = 0) {
  try {
    localStorage.setItem(SLOT_KEY(slot), JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function loadGame(slot = 0): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot))
    if (!raw) return null
    const parsed = migrate(JSON.parse(raw) as GameState)
    if (!parsed) return null
    parsed.paused = true
    return parsed
  } catch {
    return null
  }
}

export function hasSave(slot = 0) {
  try {
    return !!localStorage.getItem(SLOT_KEY(slot))
  } catch {
    return false
  }
}

export function clearSave(slot = 0) {
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
