import { admittedFlights } from './airportInfrastructure'
import { cabinComfort } from './cabin'
import { SELLABLE, type Carrier } from './economy'
import { pernasDaRota } from './escala'
import { atratividadeHorario } from './malha'
import { specOf } from './spec'
import type { GameState, Route } from './types'

/** Oferta média diária: mesma disputa na receita da IA e no painel. */
export function playerWeeklyOffer(s: GameState, r: Route): Carrier | null {
  const flights = pernasDaRota(s, r).filter(p => admittedFlights(s).has(p.id)).flatMap(p => {
    const a = s.airline.fleet.find(x => x.id === p.aircraftId && x.groundedUntil <= s.day)
    return a ? [{ p, a }] : []
  })
  if (!flights.length) return null
  const seats = { y: 0, w: 0, c: 0, f: 0 }
  let comfort = 0, time = 0
  for (const { p, a } of flights) {
    for (const c of ['y', 'w', 'c', 'f'] as const) seats[c] += a.seats[c] * SELLABLE / 7
    const type = specOf(a.typeId, a.engineId)
    comfort += type.comfort * cabinComfort(type, a.seats, a.pitch, a.seatConfig) * (.85 + .15 * a.condition)
    time += atratividadeHorario(p.saida)
  }
  return {
    id: `P:${r.id}`, freq: flights.length / 14, fareMult: (r.fare.y * 3 + r.fare.c) / 4,
    quality: (.72 + .55 * s.airline.reputation) * (1 + Math.min(.12, s.airline.marketing / 2.4e6)) *
      comfort / flights.length * time / flights.length, seats,
  }
}
