import { useMemo, useState } from 'react'
import { useGame } from '../store/useGame'
import { AIRPORT_BY_IATA } from '../game/data/airports'
import { DAY_MS, gameDayDate, mondayOf, sundayOf, utcDate } from '../game/calendarDates'
import { eventsBetween, monthBounds, type EventOccurrence } from '../game/travelCalendar'
import { Card, Empty } from './components/Bits'

const shortDate = (date: number) => new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
const longDate = (date: number) => new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const monthName = (month: number) => new Date(utcDate(Math.floor(month / 12), month % 12 + 1, 1))
  .toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const airportName = (iata: string) => `${iata} · ${AIRPORT_BY_IATA[iata]?.city ?? iata}`
const percent = (value: number) => `${Math.round(value * 100)}%`

function EventCard({ occurrence, network }: { occurrence: EventOccurrence; network: Set<string> }) {
  const { event } = occurrence
  return <details className="calendar-event" data-event={event.id}>
    <summary>
      <div className="calendar-event-heading">
        <span className={`calendar-kind ${event.category}`}>{event.category === 'ferias' ? 'Férias' : 'Evento'}</span>
        <b>{event.name}</b>
        <span className="calendar-disclosure" aria-hidden="true">⌄</span>
      </div>
      <p className="calendar-place">{event.place}</p>
      <div className="calendar-airports">
        {event.airports.map(a => <span key={a.iata} className={`calendar-airport ${network.has(a.iata) ? 'in-network' : ''}`}
          title={`${airportName(a.iata)} · acréscimo na demanda econômica${network.has(a.iata) ? ' · sua malha' : ''}`}>
          <b>{a.iata}</b> +{percent(a.boost)}
        </span>)}
      </div>
      {event.gateways && <p className="calendar-gateways">Acesso por conexão: {event.gateways.join(' · ')}</p>}
    </summary>
    <div className="calendar-event-detail">
      <p><span className="chip grey">{occurrence.certainty}</span></p>
      <p><b>Datas-base:</b> {longDate(occurrence.actualStart)}{occurrence.actualEnd !== occurrence.actualStart && ` a ${longDate(occurrence.actualEnd)}`}.</p>
      <p><b>Efeito no jogo:</b> {longDate(occurrence.start)} a {longDate(occurrence.end)}, sempre de segunda a domingo.</p>
      <p>{event.note}</p>
      {event.gateways && <p>Os aeroportos de conexão ganham passageiros quando sua malha oferece uma viagem válida até o destino do evento. Não há aumento automático em todas as rotas desses hubs.</p>}
      <p className="muted">O percentual é um ajuste da simulação. As fontes abaixo sustentam o destino e a época, não esse percentual de crescimento.</p>
      <ul>{event.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul>
    </div>
  </details>
}

export function CalendarView() {
  const { state } = useGame()
  const now = gameDayDate(state.day, state.startYear)
  const bounds = monthBounds(now)
  const [selectedMonth, setMonth] = useState(bounds.first)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('all')
  const [category, setCategory] = useState('all')
  // O horizonte acompanha o save mesmo com o calendário aberto e o relógio rodando.
  const month = Math.max(bounds.first, Math.min(bounds.last, selectedMonth))
  const start = utcDate(Math.floor(month / 12), month % 12 + 1, 1)
  const end = utcDate(Math.floor(month / 12), month % 12 + 2, 0)
  const firstWeek = mondayOf(start), lastWeek = sundayOf(end)
  const occurrences = useMemo(() => eventsBetween(firstWeek, lastWeek), [firstWeek, lastWeek])
  const network = new Set([...state.airline.hubs, ...state.airline.routes.flatMap(r => [r.from, r.to])])
  const query = normalized(search.trim())
  const visible = occurrences.filter(o => {
    const codes = [...o.event.airports.map(a => a.iata), ...(o.event.gateways ?? [])]
    return (scope === 'all' || codes.some(c => network.has(c))) &&
      (category === 'all' || o.event.category === category) &&
      (!query || normalized([o.event.name, o.event.place, ...codes.map(c => `${airportName(c)} ${AIRPORT_BY_IATA[c]?.country ?? ''}`)].join(' ')).includes(query))
  })
  const weeks = Array.from({ length: Math.floor((lastWeek - firstWeek) / (7 * DAY_MS)) + 1 }, (_, i) => firstWeek + i * 7 * DAY_MS)
  const airports = new Set(visible.flatMap(o => o.event.airports.map(a => a.iata)))
  const currentWeek = mondayOf(now)

  return <div className="grid travel-calendar">
    <Card className="calendar-header">
      <span className="eyebrow">Planejamento da malha</span>
      <h2>Calendário de demanda</h2>
      <p className="dim">Férias e eventos aumentam a procura nas rotas dos destinos indicados. Cada efeito vale pela semana inteira, sem diferença entre dias úteis e fim de semana.</p>
      <div className="calendar-controls">
        <button className="btn" aria-label="Mês anterior" disabled={month === bounds.first} onClick={() => setMonth(month - 1)}>←</button>
        <label className="calendar-month-label"><span className="muted">Mês e ano</span>
          <select aria-label="Mês e ano do calendário" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: bounds.last - bounds.first + 1 }, (_, i) => bounds.first + i).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
        </label>
        <button className="btn" aria-label="Próximo mês" disabled={month === bounds.last} onClick={() => setMonth(month + 1)}>→</button>
        <button className="btn calendar-today" onClick={() => setMonth(bounds.first)}>Mês atual</button>
      </div>
      <p className="muted calendar-horizon">Planejamento disponível até {monthName(bounds.last)} · datas da partida.</p>
      <div className="calendar-filters">
        <label>Buscar evento ou aeroporto<input type="search" aria-label="Buscar evento ou aeroporto" value={search}
          placeholder="Ex.: Parintins, BEL, Navegantes" onChange={e => setSearch(e.target.value)} /></label>
        <label>Aeroportos<select aria-label="Aeroportos do calendário" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="all">Todos os destinos</option><option value="network">Minha malha e hubs</option>
        </select></label>
        <label>Tipo<select aria-label="Tipo de período" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">Eventos e férias</option><option value="evento">Eventos</option><option value="ferias">Férias</option>
        </select></label>
      </div>
      <div className="calendar-legend"><span><i className="calendar-network-dot" /> Aeroporto da sua malha</span><span><b>+%</b> Procura extra na econômica</span><span>{visible.length} períodos · {airports.size} aeroportos</span></div>
    </Card>

    <div className="calendar-weeks" aria-label={`Semanas de ${monthName(month)}`}>
      {weeks.map(week => {
        const active = visible.filter(o => o.start <= week + 6 * DAY_MS && o.end >= week)
        return <section className={`calendar-week ${week === currentWeek ? 'current' : ''}`} key={week}>
          <div className="calendar-week-label">
            <span className="eyebrow">Segunda a domingo</span>
            <h3>{shortDate(week)} — {shortDate(week + 6 * DAY_MS)}</h3>
            {week === currentWeek && <span className="chip good">Semana atual</span>}
            <span className="muted">{active.length ? `${active.length} períodos ativos` : 'Sem período cadastrado'}</span>
          </div>
          <div className="calendar-week-events">
            {active.length ? active.map(o => <EventCard key={o.key} occurrence={o} network={network} />) :
              <Empty>{query || scope !== 'all' || category !== 'all' ? 'Nenhum período corresponde a estes filtros nesta semana.' : 'Sem evento ou férias cadastrados nesta semana. A sazonalidade e a evolução econômica continuam ativas.'}</Empty>}
          </div>
        </section>
      })}
    </div>

    <Card title="Como a procura varia">
      <div className="calendar-explainer dim">
        <p>A demanda continua fluida: a economia de cada país, seus ciclos e a estação do ano alteram a procura. Para planejar a malha, a referência de passageiros é atualizada às segundas-feiras e fica igual nos sete dias da semana.</p>
        <p>Os bônus indicados são da econômica. A premium recebe 85% desse acréscimo, a executiva 35% e a primeira 20%, apenas onde já existe procura pela classe. Exemplo: +40% na econômica corresponde a +34%, +14% e +8% nas demais classes.</p>
        <p>Na mesma rota, vale o maior bônus de férias mais o maior de evento, com teto de +120% na econômica. O mesmo evento nas duas pontas conta uma vez. O mercado é a soma de ida e volta; tarifas, concorrentes, capacidade e conexões determinam quantos passageiros sua companhia transporta.</p>
        <p>Verão do jogo: 16 de dezembro a 15 de fevereiro, expandido para semanas completas. Julho também tem temporadas nos destinos pesquisados. Cada evento se repete anualmente; datas não anunciadas aparecem como projeção nos detalhes. Abra um período para consultar as fontes.</p>
      </div>
    </Card>
  </div>
}
