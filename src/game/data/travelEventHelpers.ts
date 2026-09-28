import type { EventRule, TravelEvent } from './travelEvents'

export const fixed = (m: number, d: number, em = m, ed = d): EventRule =>
  ({ kind: 'fixed', start: [m, d], end: [em, ed] })
export const weekday = (month: number, weekday: number, nth: number, duration = 1, offset = 0): EventRule =>
  ({ kind: 'weekday', month, weekday, nth, duration, offset })
export const easter = (startOffset: number, endOffset = startOffset): EventRule =>
  ({ kind: 'easter', startOffset, endOffset })

/** Datas futuras não anunciadas são projeções por padrão, nunca confirmações implícitas. */
export function event(id: string, name: string, place: string, codes: string, boost: number,
  rule: EventRule, url: string, options: Partial<Pick<TravelEvent, 'basis' | 'note' | 'confirmed' | 'category'>> = {}): TravelEvent {
  return { id, name, place, category: 'evento', basis: 'projecao', rule,
    airports: codes.split(' ').map(iata => ({ iata, boost })),
    note: 'Janela anual projetada para planejamento; a programação e as datas de futuras edições dependem do organizador.',
    sources: [{ title: `${name} · fonte de turismo ou organização`, url },
      ...(rule.kind === 'chinese' ? [{ title: 'Observatório de Hong Kong · conversão do calendário lunar',
        url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm' }] : [])], ...options }
}
export const recurring = { basis: 'recorrencia' } as const
export function edition(year: number, from: string, to = from) {
  return { confirmed: { [year]: [`${year}-${from}`, `${year}-${to}`] as [string, string] } }
}
