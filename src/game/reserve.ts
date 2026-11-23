import { admittedFlights } from './airportInfrastructure'
import type { Aircraft, GameState } from './types'
import { escalaDe } from './escala'

export const scheduledAircraft = (s: GameState) => new Set(escalaDe(s).map(p => p.aircraftId))

export const canEnterReserve = (ac: Aircraft, scheduled: Set<string>, day: number) =>
  !ac.isReserve && ac.groundedUntil <= day && !scheduled.has(ac.id)

/**
 * Calcula a quantidade de aeronaves reserva sugerida pelo jogo para um determinado modelo (typeId).
 */
export function suggestedReserveCount(state: GameState, typeId: string): number {
  const modelFleet = state.airline.fleet.filter((a) => a.typeId === typeId)
  const activeFleet = modelFleet.filter((a) => !a.isReserve)
  if (activeFleet.length === 0) return 0

  const highRiskCount = activeFleet.filter((a) => a.condition < 0.6).length
  const baseReserve = Math.max(1, Math.ceil(activeFleet.length * 0.12))
  const riskExtra = highRiskCount >= 2 ? 1 : 0

  return baseReserve + riskExtra
}

/**
 * Mapeia cada aeronave da malha que está em manutenção pesada (grounded) para
 * uma aeronave reserva disponível do mesmo modelo no dia informado.
 */
export function getSubstituteMap(state: GameState, day: number = state.day): Map<string, Aircraft> {
  const substituteMap = new Map<string, Aircraft>()

  const grounded = state.airline.fleet.filter(ac => !ac.isReserve && ac.groundedUntil > day)
  if (!grounded.length) return substituteMap
  const scheduled = scheduledAircraft(state)
  const admitted = admittedFlights(state)
  const operating = new Set(escalaDe(state).filter(p => admitted.has(p.id)).map(p => p.aircraftId))
  // Agrupa aeronaves paradas que têm voos para cobrir.
  const groundedByModel = new Map<string, Aircraft[]>()
  for (const ac of grounded) {
    if (!operating.has(ac.id)) continue
    const list = groundedByModel.get(ac.typeId) ?? []
    list.push(ac)
    groundedByModel.set(ac.typeId, list)
  }
  if (!groundedByModel.size) return substituteMap

  // Agrupa aeronaves em reserva disponíveis (não paradas) no dia
  const reservesByModel = new Map<string, Aircraft[]>()
  for (const ac of state.airline.fleet) {
    if (ac.isReserve && ac.groundedUntil <= day && !scheduled.has(ac.id)) {
      const list = reservesByModel.get(ac.typeId) ?? []
      list.push(ac)
      reservesByModel.set(ac.typeId, list)
    }
  }

  // Associa 1-para-1 a reserva disponível para cada aeronave em manutenção
  for (const [typeId, groundedList] of groundedByModel) {
    const reserveList = reservesByModel.get(typeId) ?? []
    const limit = Math.min(groundedList.length, reserveList.length)
    for (let i = 0; i < limit; i++) {
      substituteMap.set(groundedList[i].id, reserveList[i])
    }
  }

  return substituteMap
}

/**
 * Retorna a aeronave efetiva que realizará o voo.
 * Se a aeronave atribuída na escala estiver em manutenção, porém houver uma reserva
 * alocada substituindo-a, retorna a reserva.
 */
export function getEffectiveAircraft(
  state: GameState,
  acId: string,
  substituteMap?: Map<string, Aircraft>,
  day: number = state.day,
): Aircraft | undefined {
  const ac = state.airline.fleet.find((a) => a.id === acId)
  if (!ac) return undefined
  if (ac.groundedUntil <= day) return ac

  const map = substituteMap ?? getSubstituteMap(state, day)
  return map.get(ac.id) ?? ac
}

/**
 * Define se uma aeronave específica é reserva de manutenção.
 */
export function setAircraftReserve(state: GameState, acId: string, isReserve: boolean): string | null {
  const ac = state.airline.fleet.find((a) => a.id === acId)
  if (!ac) return 'Aeronave não encontrada.'

  if (isReserve && !ac.isReserve) {
    if (ac.groundedUntil > state.day) return 'A aeronave está em manutenção.'
    if (scheduledAircraft(state).has(acId)) return 'Remova todos os voos da malha antes de colocar a aeronave em reserva.'
    ac.isReserve = true
  } else if (!isReserve && ac.isReserve) {
    ac.isReserve = false
  }

  return null
}

/**
 * Altera a quantidade de aeronaves alocadas na reserva para um modelo específico.
 */
export function setReserveCountForModel(state: GameState, typeId: string, targetCount: number): string | null {
  const modelFleet = state.airline.fleet.filter((a) => a.typeId === typeId)
  const currentReserves = modelFleet.filter((a) => a.isReserve)
  const count = Math.max(0, Math.min(modelFleet.length, targetCount))

  if (count === currentReserves.length) return null

  if (count > currentReserves.length) {
    const needed = count - currentReserves.length
    const scheduled = scheduledAircraft(state)
    const available = modelFleet.filter(ac => canEnterReserve(ac, scheduled, state.day))
    if (available.length < needed) return 'Faltam aeronaves disponíveis sem voos na malha para atingir essa quantidade.'
    for (const ac of available.slice(0, needed)) ac.isReserve = true
  } else {
    // Precisa de menos reservas: remove o excesso da reserva
    const toRemove = currentReserves.slice(count)
    for (const ac of toRemove) {
      setAircraftReserve(state, ac.id, false)
    }
  }

  return null
}
