// A ficha efetiva de uma aeronave é a do modelo com a motorização escolhida
// aplicada por cima: um A320neo com GTF e um com LEAP não têm o mesmo consumo,
// nem a mesma conta de oficina, nem o mesmo preço.
import { AIRCRAFT_BY_ID, type AircraftType } from './data/aircraft'
import { ENGINES, type Engine } from './data/engines'

const cache = new Map<string, AircraftType>()

/** O id de motor válido para o tipo: o pedido, se existir, senão o de série. */
export const engineIdFor = (t: AircraftType, engineId?: string | null) =>
  engineId && t.engines.includes(engineId) ? engineId : t.engines[0]

export const enginesOf = (t: AircraftType): Engine[] =>
  t.engines.map((id) => ENGINES[id]).filter(Boolean)

/** O tipo com a motorização aplicada. Memoizado: entra em conta de voo diária. */
export function withEngine(t: AircraftType, engineId?: string | null): AircraftType {
  const id = engineIdFor(t, engineId)
  const key = `${t.id}:${id}`
  const hit = cache.get(key)
  if (hit) return hit
  const e = ENGINES[id]
  const out: AircraftType = e
    ? {
        ...t,
        burn: Math.round(t.burn * e.burn),
        maint: Math.round(t.maint * e.maint * 1000) / 1000,
        price: Math.round((t.price + e.price) * 10) / 10,
        range: Math.round(t.range * e.range),
        runway: Math.round(t.runway * e.runway),
        fan: e.fan,
        since: Math.max(t.since, e.since),
      }
    : t
  cache.set(key, out)
  return out
}

export const specOf = (typeId: string, engineId?: string | null) =>
  withEngine(AIRCRAFT_BY_ID[typeId], engineId)
