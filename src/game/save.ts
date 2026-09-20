import { normalizeSeats } from './seatModels'
import { migrateLivery } from '../livery/presets'
import { migrarEscala, sincronizarMalha } from './escala'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { AIRPORT_BY_IATA } from './data/airports'
import { clampPitch, defaultCabin } from './cabin'
import { engineIdFor } from './spec'
import type { Aircraft, GameState } from './types'

export const SAVE_VERSION = 2

export const SLOTS = [1, 2, 3] as const
export type SlotId = (typeof SLOTS)[number]

const LEGACY_KEY = 'skyline-tycoon:save'
const LEGACY_SLOT_0_KEY = 'skyline-tycoon:save:0'
const SLOT_KEY = (n: number) => `skyline-tycoon:save:${n}`
const ACTIVE_SLOT_KEY = 'skyline-tycoon:active-slot'

/** Modelos que trocaram de id quando o catálogo ganhou as variantes reais. */
const RENAMED: Record<string, string> = { a220: 'a220300' }

/**
 * Traz um save antigo para o formato atual: id de modelo renomeado, motor de
 * série e passo de poltrona. Save da versão 1 não guardava nem um nem outro.
 */
function migrate(s: GameState): GameState | null {
  if (!s || (s.version !== 1 && s.version !== SAVE_VERSION)) return null
  if (!s.airline || !s.airline.hubs?.some((h) => AIRPORT_BY_IATA[h])) return null

  // Save de versão anterior pode não ter listas que o jogo de hoje percorre sem
  // checar, ou pode citar aeroporto que saiu do catálogo. Faltando uma lista, a
  // tela quebra no primeiro `.map()` e o jogador vê tela preta — foi o que
  // motivou a barreira de erro em `Boundary.tsx`. Aqui o save chega inteiro ou
  // não chega.
  s.airline.hubs = s.airline.hubs.filter((h) => AIRPORT_BY_IATA[h])
  s.airline.fleet = s.airline.fleet ?? []
  s.airline.routes = (s.airline.routes ?? []).filter(
    (r) => AIRPORT_BY_IATA[r.from] && AIRPORT_BY_IATA[r.to],
  )
  s.airline.loans = s.airline.loans ?? []
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
    ac.seatConfig = normalizeSeats(t, ac.seatConfig)
    if (!ac.seats || typeof ac.seats.y !== 'number') ac.seats = defaultCabin(t).seats
    // Save antigo não guardava o país da matrícula: cai no da base de hoje.
    ac.cc = ac.cc || AIRPORT_BY_IATA[s.airline.hubs[0]]?.cc || 'BR'
    return [ac]
  })
  /**
   * A malha: save anterior à escala por perna guardava rotação por rota. A
   * conversão reproduz a mesma grade em pernas, e depois disso a escala é a
   * fonte — `sincronizarMalha` recalcula `freq` e `aircraftIds` a partir dela,
   * inclusive num save que já tinha escala mas cuja frota mudou.
   */
  migrarEscala(s)
  s.airline.escala = (s.airline.escala ?? []).filter(
    (p) => AIRPORT_BY_IATA[p.from] && AIRPORT_BY_IATA[p.to] &&
      s.airline.fleet.some((a) => a.id === p.aircraftId),
  )
  sincronizarMalha(s)

  s.version = SAVE_VERSION
  return s
}

/**
 * Migra o save legados (`skyline-tycoon:save` ou `skyline-tycoon:save:0`) para o Slot 1 (`skyline-tycoon:save:1`).
 */
export function migrateSaveSlots() {
  try {
    if (typeof localStorage === 'undefined') return
    const slot1Exists = !!localStorage.getItem(SLOT_KEY(1))
    if (!slot1Exists) {
      const legacySave = localStorage.getItem(LEGACY_KEY) || localStorage.getItem(LEGACY_SLOT_0_KEY)
      if (legacySave) {
        localStorage.setItem(SLOT_KEY(1), legacySave)
        localStorage.removeItem(LEGACY_KEY)
        localStorage.removeItem(LEGACY_SLOT_0_KEY)
      }
    } else {
      localStorage.removeItem(LEGACY_KEY)
      localStorage.removeItem(LEGACY_SLOT_0_KEY)
    }
  } catch {
    /* ignora */
  }
}

export function getActiveSlot(): SlotId {
  try {
    if (typeof localStorage === 'undefined') return 1
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY)
    const num = raw ? parseInt(raw, 10) : 1
    if (num === 1 || num === 2 || num === 3) return num as SlotId
  } catch {
    /* ignora */
  }
  return 1
}

export function setActiveSlot(slot: number): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (slot === 1 || slot === 2 || slot === 3) {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(slot))
    }
  } catch {
    /* ignora */
  }
}

export function saveGame(state: GameState, slot = 1): boolean {
  try {
    migrateSaveSlots()
    const targetSlot = (slot >= 1 && slot <= 3) ? slot : 1
    localStorage.setItem(SLOT_KEY(targetSlot), JSON.stringify(state))
    setActiveSlot(targetSlot)
    return true
  } catch {
    return false
  }
}

export function loadGame(slot = 1): GameState | null {
  try {
    migrateSaveSlots()
    const targetSlot = (slot >= 1 && slot <= 3) ? slot : 1
    const raw = localStorage.getItem(SLOT_KEY(targetSlot))
    if (!raw) return null
    const parsed = migrate(JSON.parse(raw) as GameState)
    if (!parsed) return null
    parsed.paused = true
    setActiveSlot(targetSlot)
    return parsed
  } catch {
    return null
  }
}

export function hasSave(slot = 1): boolean {
  try {
    migrateSaveSlots()
    const targetSlot = (slot >= 1 && slot <= 3) ? slot : 1
    return !!localStorage.getItem(SLOT_KEY(targetSlot))
  } catch {
    return false
  }
}

export function clearSave(slot = 1): void {
  try {
    migrateSaveSlots()
    const targetSlot = (slot >= 1 && slot <= 3) ? slot : 1
    localStorage.removeItem(SLOT_KEY(targetSlot))
  } catch {
    /* ignora */
  }
}

export interface SlotSummary {
  slot: number
  airlineName: string
  code: string
  hub: string
  day: number
  startYear: number
  cash: number
  fleetCount: number
  routesCount: number
}

export function getSlotSummary(slot = 1): SlotSummary | null {
  try {
    migrateSaveSlots()
    const game = loadGame(slot)
    if (!game) return null
    return {
      slot,
      airlineName: game.airline.name,
      code: game.airline.code,
      hub: game.airline.hubs[0] ?? '---',
      day: game.day,
      startYear: game.startYear,
      cash: game.airline.cash,
      fleetCount: game.airline.fleet.length,
      routesCount: game.airline.routes.length,
    }
  } catch {
    return null
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
