import { AIRPORTS, AIRPORT_BY_IATA } from './data/airports'
import { AI_AIRLINES } from './data/names'
import { baseDemand } from './demand'
import { distanceBetween, odKey } from './geo'
import { between, chance, type Rng } from './rng'
import type { Competitor } from './types'

/** Escolhe destinos plausíveis a partir de um hub, por demanda potencial. */
function candidateDestinations(hub: string, day: number, limit: number) {
  return AIRPORTS.filter((a) => a.iata !== hub)
    .map((a) => {
      const d = baseDemand(hub, a.iata, day, 180)
      return { iata: a.iata, score: d.total / (1 + distanceBetween(hub, a.iata) / 4000) }
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

export function createCompetitors(rng: Rng): Competitor[] {
  return AI_AIRLINES.map((base) => {
    const aggression = between(rng, 0.7, 1.3)
    const comp: Competitor = {
      id: base.code,
      name: base.name,
      code: base.code,
      hub: base.hub,
      color: base.color,
      cash: between(rng, 200, 900) * 1e6,
      reputation: between(rng, 0.45, 0.72),
      aggression,
      routes: [],
      fleetSize: 0,
      revenue30: 0,
    }
    const dests = candidateDestinations(base.hub, 0, Math.round(between(rng, 13, 26)))
    for (const d of dests) {
      if (!chance(rng, 0.82)) continue
      addAiRoute(comp, d.iata, rng)
    }
    return comp
  })
}

function addAiRoute(comp: Competitor, dest: string, rng: Rng) {
  const dist = distanceBetween(comp.hub, dest)
  const demand = baseDemand(comp.hub, dest, 0, 180)
  // Dimensiona a oferta para pegar um pedaço do mercado, com ruído.
  const target = demand.total * between(rng, 0.05, 0.13) * comp.aggression
  const freq = Math.max(1, Math.min(10, Math.round(target / between(rng, 150, 260))))
  const seats = Math.max(70, Math.min(360, Math.round(target / Math.max(1, freq) / between(rng, 0.7, 0.95))))
  comp.routes.push({
    key: odKey(comp.hub, dest),
    from: comp.hub,
    to: dest,
    seats,
    freq,
    fare: between(rng, 0.86, 1.18),
    quality: (0.75 + 0.5 * comp.reputation) * between(rng, 0.94, 1.08),
  })
  comp.fleetSize = Math.round(comp.routes.reduce((s, r) => s + r.freq * (1 + dist / 6000), 0) / 3.2)
}

/** Decisão semanal: mexe em tarifa, oferta, abre e fecha rota. */
export function stepCompetitors(comps: Competitor[], day: number, rng: Rng, playerPressure: Record<string, number>) {
  for (const comp of comps) {
    for (const r of comp.routes) {
      const pressure = playerPressure[r.key] ?? 0
      // Reage ao jogador: se perdeu espaço, corta preço ou aumenta frequência.
      if (pressure > 0.28 && chance(rng, 0.5 * comp.aggression)) {
        r.fare = Math.max(0.72, r.fare - between(rng, 0.02, 0.07))
      } else if (pressure < 0.05 && chance(rng, 0.25)) {
        r.fare = Math.min(1.35, r.fare + between(rng, 0.01, 0.04))
      }
      if (pressure > 0.4 && chance(rng, 0.22 * comp.aggression)) r.freq = Math.min(11, r.freq + 1)
      if (pressure > 0.62 && chance(rng, 0.12)) r.freq = Math.max(1, r.freq - 1)
      r.quality = Math.min(1.3, r.quality * between(rng, 0.997, 1.006))
    }

    // Crescimento e poda.
    if (chance(rng, 0.17 * comp.aggression) && comp.routes.length < 34) {
      const dests = candidateDestinations(comp.hub, day, 60)
      const open = new Set(comp.routes.map((r) => r.key))
      const next = dests.find((d) => !open.has(odKey(comp.hub, d.iata)))
      if (next) addAiRoute(comp, next.iata, rng)
    }
    if (chance(rng, 0.1) && comp.routes.length > 10) {
      const weakest = comp.routes.reduce((w, r, i, arr) => (r.freq < arr[w].freq ? i : w), 0)
      if (chance(rng, 0.5)) comp.routes.splice(weakest, 1)
    }
    comp.reputation = Math.min(0.95, Math.max(0.3, comp.reputation + between(rng, -0.006, 0.007)))
  }
}

export const competitorHubName = (c: Competitor) => AIRPORT_BY_IATA[c.hub]?.city ?? c.hub
