import { writeFileSync } from 'node:fs'
import { TRAVEL_EVENTS } from '../src/game/data/travelEvents'
import { eventsForYear } from '../src/game/travelCalendar'
import { AIRPORT_BY_IATA } from '../src/game/data/airports'

const list = eventsForYear(2027)
const events = TRAVEL_EVENTS.filter(e => e.category === 'evento')
const airports = [...new Set(TRAVEL_EVENTS.flatMap(e => e.airports.map(a => a.iata)))]
const countries = [...new Map(airports.map(iata => [AIRPORT_BY_IATA[iata].cc, AIRPORT_BY_IATA[iata].country])).values()]
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
const sources = new Set(TRAVEL_EVENTS.flatMap(e => e.sources.map(s => s.url)))
const date = (d: number) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
let doc = `# Catálogo mundial de demanda\n\nPesquisa revisada em 28/09/2026. Gerado por \`npx tsx scripts/calendar-catalog.ts\`.\n\n` +
  `**${events.length} eventos distintos**, mais **${TRAVEL_EVENTS.length - events.length} períodos de férias e temporadas**; ${airports.length} aeroportos, ${countries.length} países e territórios, ${sources.size} fontes distintas. Férias, semanas e aeroportos não são contados como novos eventos.\n\n` +
  `Datas-base de 2027. A simulação amplia cada intervalo para semanas completas, de segunda a domingo. Projeções não são anúncios oficiais das edições futuras. Os bônus são escolhas de balanceamento do jogo.\n\n` +
  `Cobertura: ${countries.join('; ')}.\n\n`
for (const [category, title] of [['evento', 'Eventos'], ['ferias', 'Férias e temporadas']]) {
  doc += `## ${title}\n\n| Evento / período | Lugar | Datas-base | Referência | Aeroportos (+Y) | Fontes |\n| --- | --- | --- | --- | --- | --- |\n`
  for (const o of list.filter(o => o.event.category === category)) {
    const e = o.event
    doc += `| ${e.name} | ${e.place} | ${date(o.actualStart)}–${date(o.actualEnd)} | ${o.certainty} | ${e.airports.map(a => `${a.iata} +${Math.round(a.boost * 100)}%`).join(', ')} | ${e.sources.map(s => `[${s.title}](${s.url})`).join(' · ')} |\n`
  }
  doc += '\n'
}
writeFileSync('docs/calendario-catalogo.md', doc.trimEnd() + '\n')
console.log(JSON.stringify({ events: events.length, holidays: TRAVEL_EVENTS.length - events.length,
  airports: airports.length, countries: countries.length, sources: sources.size }))
