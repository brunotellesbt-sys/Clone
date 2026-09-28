import { TRAVEL_EVENTS, type TravelEvent } from './data/travelEvents'
import { DAY_MS, chineseDate, easterDate, mondayOf, nthWeekday, sundayOf, utcDate } from './calendarDates'
import type { Cabins } from './types'
import { LUNAR_FESTIVAL_DATES } from './data/lunarFestivalDates'

export interface EventOccurrence {
  event: TravelEvent
  key: string
  year: number
  /** Datas-base da celebração/temporada. */
  actualStart: number
  actualEnd: number
  /** Efeito comercial: sempre segunda a domingo, inclusive. */
  start: number
  end: number
  certainty: 'Datas confirmadas' | 'Recorrência anual' | 'Projeção anual' | 'Temporada do jogo'
}
const byYear = new Map<number, EventOccurrence[]>()
const byWeek = new Map<number, Map<string, EventOccurrence[]>>()

export function eventDates(event: TravelEvent, year: number): [number, number] {
  const confirmed = event.confirmed?.[year]
  if (confirmed) return confirmed.map(d => Date.parse(d + 'T00:00:00Z')) as [number, number]
  const rule = event.rule
  if (rule.kind === 'chinese') {
    const start = chineseDate(year, rule.month, rule.day)
    return [start, start + (rule.duration - 1) * DAY_MS]
  }
  if (rule.kind === 'fixed') {
    const start = utcDate(year, ...rule.start)
    let end = utcDate(year, ...rule.end)
    if (end < start) end = utcDate(year + 1, ...rule.end)
    return [start, end]
  }
  if (rule.kind === 'easter') {
    const easter = easterDate(year)
    return [easter + rule.startOffset * DAY_MS, easter + rule.endOffset * DAY_MS]
  }
  if (rule.kind === 'weekday') {
    const start = nthWeekday(year, rule.month, rule.weekday, rule.nth) + (rule.offset ?? 0) * DAY_MS
    return [start, start + (rule.duration - 1) * DAY_MS]
  }
  // Primeiro sábado estritamente após 15/09. Extensões não anunciadas ficam como projeção.
  const start = utcDate(year, 9, 16)
  return [start + ((6 - new Date(start).getUTCDay() + 7) % 7) * DAY_MS, nthWeekday(year, 10, 0, 1)]
}

export function eventsForYear(year: number) {
  let list = byYear.get(year)
  if (!list) {
    list = TRAVEL_EVENTS.map(event => {
      const [actualStart, actualEnd] = eventDates(event, year)
      const certainty: EventOccurrence['certainty'] = event.confirmed?.[year] ? 'Datas confirmadas' :
        event.rule.kind === 'chinese' && !LUNAR_FESTIVAL_DATES[year] ? 'Projeção anual' :
        event.basis === 'recorrencia' ? 'Recorrência anual' :
          event.basis === 'regra-do-jogo' ? 'Temporada do jogo' : 'Projeção anual'
      return { event, key: event.id + ':' + year, year, actualStart, actualEnd,
        start: mondayOf(actualStart), end: sundayOf(actualEnd + (event.afterDays ?? 0) * DAY_MS), certainty }
    }).sort((a, b) => a.start - b.start || a.event.name.localeCompare(b.event.name))
    if (byYear.size >= 6) byYear.delete(byYear.keys().next().value!)
    byYear.set(year, list)
  }
  return list
}

/** Inclui temporadas iniciadas em dezembro/outubro do ano anterior e semanas limítrofes. */
export function eventsBetween(start: number, end: number) {
  const list: EventOccurrence[] = []
  for (let year = new Date(start).getUTCFullYear() - 1; year <= new Date(end).getUTCFullYear() + 1; year++)
    list.push(...eventsForYear(year).filter(e => e.start <= end && e.end >= start))
  return list.sort((a, b) => a.start - b.start || a.event.name.localeCompare(b.event.name))
}

function airportWeek(date: number) {
  const week = mondayOf(date)
  let index = byWeek.get(week)
  if (!index) {
    index = new Map()
    for (const occurrence of eventsBetween(week, week + 6 * DAY_MS)) {
      for (const { iata } of occurrence.event.airports) {
        const list = index.get(iata) ?? []
        list.push(occurrence)
        index.set(iata, list)
      }
    }
    if (byWeek.size >= 160) byWeek.delete(byWeek.keys().next().value!)
    byWeek.set(week, index)
  }
  return index
}

export const MAX_CALENDAR_BOOST = 1.2
const NO_EFFECT = { boost: 0, multipliers: { y: 1, w: 1, c: 1, f: 1 } as Cabins, events: [] as EventOccurrence[] }
/** Os boosts são ajustes de jogo; não são percentuais medidos nas fontes turísticas. */
export function routeCalendarEffect(from: string, to: string, date: number) {
  const index = airportWeek(date)
  if (!index.has(from) && !index.has(to)) return NO_EFFECT
  const unique = new Map<string, { occurrence: EventOccurrence; boost: number }>()
  for (const iata of [from, to]) for (const occurrence of index.get(iata) ?? []) {
    const boost = occurrence.event.airports.find(a => a.iata === iata)!.boost
    const old = unique.get(occurrence.event.id)
    if (!old || boost > old.boost) unique.set(occurrence.event.id, { occurrence, boost })
  }
  // Não multiplica dois aeroportos do mesmo evento nem soma festas semelhantes.
  let holidays = 0, events = 0
  for (const item of unique.values()) {
    if (item.occurrence.event.category === 'ferias') holidays = Math.max(holidays, item.boost)
    else events = Math.max(events, item.boost)
  }
  const boost = Math.min(MAX_CALENDAR_BOOST, holidays + events)
  const multipliers: Cabins = { y: 1 + boost, w: 1 + boost * .85, c: 1 + boost * .35, f: 1 + boost * .2 }
  return { boost, multipliers, events: [...unique.values()].map(v => v.occurrence) }
}

export function monthBounds(now: number) {
  const date = new Date(now), year = date.getUTCFullYear()
  return { first: year * 12 + date.getUTCMonth(), last: (year + 1) * 12 + 11 }
}
