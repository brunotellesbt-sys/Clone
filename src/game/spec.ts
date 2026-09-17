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
        // empuxo maior tira metros da decolagem nas duas medidas
        runwayMin: Math.round(t.runwayMin * e.runway),
        fan: e.fan,
        since: Math.max(t.since, e.since),
      }
    : t
  cache.set(key, out)
  return out
}

export const specOf = (typeId: string, engineId?: string | null) =>
  withEngine(AIRCRAFT_BY_ID[typeId], engineId)

/**
 * Quanto a elevação cobra de pista, por 1.000 ft.
 *
 * A regra de bolso corrente é 10%, mas ela vale para avião a pistão: turbina
 * perde menos com ar rarefeito. Calibrei contra oito operações reais conhecidas
 * — 737-800 em Santos Dumont, MAX 8 em Congonhas, A321 fora de Congonhas, A380
 * em Guarulhos, 787 em Quito, A320 em La Paz — e 10% reprova o A380 em
 * Guarulhos e o 787 em Quito, que existem. De 4 a 6% acerta sete dos oito;
 * fica 6%, que é o máximo que ainda acerta.
 */
const POR_MIL_PES = 0.06

/**
 * A pista que o tipo precisa **naquele aeroporto**, em pés.
 *
 * Não basta a pista mínima do avião: ar rarefeito cobra decolagem. Sem esta
 * conta o portão tratava La Paz, a 13.355 ft, como se fosse nível do mar.
 *
 * É ela que separa Santos Dumont de Ponta Grossa. SDU tem 1.323 m de pista a
 * 11 ft e recebe 737-800 todo dia; Ponta Grossa tem **mais** pista, 1.430 m,
 * mas a 2.588 ft — e não comporta jato comercial, que é o que se vê lá.
 */
export const pistaExigida = (t: AircraftType, ap: { elev: number }) =>
  Math.round(t.runwayMin * (1 + POR_MIL_PES * Math.max(0, ap.elev) / 1000))

/** A aeronave opera entre os dois aeroportos? Só a pista — alcance é outra conta. */
export const pistaServe = (t: AircraftType, a: { elev: number; runway: number },
                           b: { elev: number; runway: number }) =>
  pistaExigida(t, a) <= a.runway && pistaExigida(t, b) <= b.runway
