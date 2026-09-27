import { baseDemand, cargoDemand } from './demand'
import { DISTRIBUTION_RATE, sumCabins } from './economy'
import { distanceBetween, odKey } from './geo'
import type { ConnectionJourney, FlightCostBreakdown, GameState } from './types'

/** Receita líquida e custo operacional dos trechos próprios já realizados. */
export function connectionResult(journey: ConnectionJourney) {
  let revenue = 0, cost = 0, measured = 0, owned = 0
  for (const side of ['first', 'second'] as const) {
    const leg = journey[side]
    if (!leg.own) continue
    owned++
    const expense = journey[`${side}Cost`]
    if (expense === undefined) continue // saves anteriores e voo ainda não operado
    const cargoRate = distanceBetween(leg.from, leg.to) > 2200 ? .11 : .05
    revenue += journey[`${side}Revenue`] * (1 + cargoRate) * (1 - DISTRIBUTION_RATE)
    cost += expense
    measured++
  }
  return { revenue, cost, profit: measured ? revenue - cost : null,
    complete: !journey.cancelled && measured === owned && owned > 0 }
}

const COST_LABEL: Record<keyof FlightCostBreakdown, string> = {
  fuel: 'Combustível', crew: 'Tripulação', maintenance: 'Manutenção',
  fees: 'Taxas aeroportuárias', handling: 'Atendimento em solo', catering: 'Serviço de bordo',
}

/** Diagnóstico calculado só com a operação real dos últimos 14 dias. */
export function deficitRoutes(state: GameState) {
  return state.airline.routes.flatMap(route => {
    const history = route.history.filter(d => d.day > state.day - 14 && d.day <= state.day)
    const revenue = history.reduce((n, d) => n + d.revenue, 0)
    const cost = history.reduce((n, d) => n + d.cost, 0)
    if (cost <= revenue || !history.length) return []
    const cargo = !!route.cargo
    const carried = history.reduce((n, d) => n + (cargo ? d.tons ?? 0 : sumCabins(d.pax)), 0)
    const offered = history.reduce((n, d) => n + (cargo ? d.tonsOffered ?? 0 : d.seats), 0)
    const days = Math.max(1, Math.min(14, state.day - route.openedDay + 1))
    const date = new Date(Date.UTC(state.startYear, 0, 1 + state.day))
    const doy = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000)
    const demand = cargo ? cargoDemand(route.from, route.to, state.day, doy).tons :
      baseDemand(route.from, route.to, state.day, doy, state.startYear).total
    const breakdown = history.reduce((sum, d) => {
      if (d.costBreakdown) for (const key of Object.keys(COST_LABEL) as (keyof FlightCostBreakdown)[])
        sum[key] += d.costBreakdown[key]
      return sum
    }, { fuel: 0, crew: 0, maintenance: 0, fees: 0, handling: 0, catering: 0 })
    const detailedCost = Object.values(breakdown).reduce((n, value) => n + value, 0)
    const largest = detailedCost >= cost * .8 ? (Object.keys(COST_LABEL) as (keyof FlightCostBreakdown)[])
      .map(key => ({ label: COST_LABEL[key], amount: breakdown[key], share: breakdown[key] / detailedCost }))
      .sort((a, b) => b.amount - a.amount)[0] : null
    const competitors = state.competitors.reduce((n, c) => n + Number(c.routes.some(r => r.key === odKey(route.from, route.to))), 0)
    return [{ route, revenue, cost, profit: revenue - cost, carried, offered,
      days, demand, largest, competitors, cargo }]
  }).sort((a, b) => a.profit - b.profit)
}
