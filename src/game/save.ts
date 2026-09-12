import { migrateLivery } from '../livery/presets'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import { AIRPORT_BY_IATA } from './data/airports'
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
    if (!ac.seats || typeof ac.seats.y !== 'number') ac.seats = defaultCabin(t).seats
    // Save antigo não guardava o país da matrícula: cai no da base de hoje.
    ac.cc = ac.cc || AIRPORT_BY_IATA[s.airline.hubs[0]]?.cc || 'BR'
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
