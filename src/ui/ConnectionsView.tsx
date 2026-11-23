import { useMemo, useState } from 'react'
import { useGame } from '../store/useGame'
import { DESVIO_MAXIMO } from '../game/connections'
import { CABINS, CABIN_SHORT } from '../game/types'
import { money, num } from '../game/engine'
import { gameDayDate } from '../game/calendarDates'
import { hhmm } from '../game/escala'
import { sumCabins } from '../game/economy'
import { connectionResult } from '../game/financeDiagnostics'
import { Card, Empty } from './components/Bits'
import { lastPage, Pagination } from './components/Pagination'
import { usePlanningQuery } from './usePlanningQuery'

const ROWS_PER_PAGE = 50
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
})

export function ConnectionsView() {
  const { state } = useGame()
  const [hub, setHub] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(7)
  const [resultOrder, setResultOrder] = useState<'best' | 'worst'>('best')
  const [schedulePage, setSchedulePage] = useState(0)
  const [soldPage, setSoldPage] = useState(0)
  const schedule = usePlanningQuery({ query: 'connections' })
  const q = search.trim().toLowerCase()
  const date = (day: number) => dateFormat.format(gameDayDate(day, state.startYear))
  const history = state.connectionJourneys
  const day = state.day
  const { sold, passengers, boardings, waiting } = useMemo(() => {
    let passengers = 0
    let boardings = 0
    let waiting = 0
    const sold = []
    for (const j of history ?? []) {
      if (j.first.day < day - period + 1 || (hub && j.via !== hub)) continue
      sold.push({
        j, result: connectionResult(j),
        searchable: `${j.first.from} ${j.via} ${j.second.to} ${j.first.number} ${j.second.number}`.toLowerCase(),
      })
      if (j.cancelled) continue
      const count = sumCabins(j.pax)
      passengers += count
      boardings += count * (Number(j.first.own && j.first.day <= day) + Number(j.second.own && j.second.day <= day))
      if (j.second.day > day) waiting += count
    }
    return { sold, passengers, boardings, waiting }
  }, [history, day, period, hub])

  const ordered = useMemo(() => [...sold].sort((a, b) => {
    const av = a.result.profit
    const bv = b.result.profit
    if (av === null || bv === null) return av === null ? (bv === null ? b.j.first.day - a.j.first.day : 1) : -1
    return (resultOrder === 'best' ? bv - av : av - bv) || b.j.first.day - a.j.first.day
  }), [sold, resultOrder])
  const trips = useMemo(() => q ? ordered.filter(trip => trip.searchable.includes(q)) : ordered, [ordered, q])
  const malha = useMemo(() => schedule?.rows.filter(r =>
    (!hub || r.via === hub) && (!q || `${r.from} ${r.via} ${r.to}`.toLowerCase().includes(q)),
  ) ?? [], [schedule, hub, q])

  const schedulePageIndex = Math.min(schedulePage, lastPage(malha.length, ROWS_PER_PAGE))
  const soldPageIndex = Math.min(soldPage, lastPage(trips.length, ROWS_PER_PAGE))
  const scheduleRows = malha.slice(schedulePageIndex * ROWS_PER_PAGE, (schedulePageIndex + 1) * ROWS_PER_PAGE)
  const soldRows = trips.slice(soldPageIndex * ROWS_PER_PAGE, (soldPageIndex + 1) * ROWS_PER_PAGE)
  const diagnostic = schedule?.totals.filter(d => !hub || d.hub === hub)
  const pairs = diagnostic?.reduce((n, d) => n + d.pairs, 0) ?? 0
  const rejected = diagnostic?.reduce((n, d) => n + d.rejected, 0) ?? 0
  const hubs = hub ? [hub] : state.airline.hubs

  return <div className="grid" style={{ gap: 14 }}>
    <Card title="Conexões">
      <p className="muted">Cada conexão reserva o mesmo número de passageiros nos dois trechos. Quando a procura local deixa lugares vagos, as conexões podem ocupar todos os assentos físicos se houver passageiros interessados e a tarifa cobrir o custo adicional.</p>
      <div className="connection-filters">
        <label>Hub<select aria-label="Hub das conexões" value={hub} onChange={e => { setHub(e.target.value); setSchedulePage(0); setSoldPage(0) }}><option value="">Todos os hubs</option>{state.airline.hubs.map(h => <option key={h}>{h}</option>)}</select></label>
        <label>Período<select aria-label="Período das conexões" value={period} onChange={e => { setPeriod(Number(e.target.value)); setSoldPage(0) }}><option value={1}>Último dia</option><option value={7}>7 dias</option><option value={14}>14 dias</option></select></label>
        <label>Buscar<input type="search" aria-label="Buscar conexão" placeholder="Aeroporto ou número do voo" value={search} onChange={e => { setSearch(e.target.value); setSchedulePage(0); setSoldPage(0) }} /></label>
      </div>
      <div className="grid g3" style={{ gap: 14 }}>
        <div><span className="muted">Passageiros com conexão</span><br /><b>{num(passengers)}</b><small className="dim"> · cada viajante contado uma vez</small></div>
        <div><span className="muted">Embarques nos seus voos</span><br /><b>{num(boardings)}</b><small className="dim"> · dois quando os dois trechos são seus</small></div>
        <div><span className="muted">Aguardando próximo trecho</span><br /><b>{num(waiting)}</b></div>
      </div>
      {state.conexoesApuradasEm === undefined ? (
        <p className="aviso" style={{ margin: '10px 0 0' }}>
          <b>Nenhum dia foi apurado ainda.</b> As conexões são vendidas quando o dia vira, e desde que a
          apuração entrou no jogo nenhum dia passou neste save.
          {pairs - rejected > 0 && <> A regra já enxerga <b>{pairs - rejected}</b>{' '}
            {pairs - rejected === 1 ? 'par válido' : 'pares válidos'} nos seus voos.</>}
          {' '}Tire da pausa e deixe o dia virar.
        </p>
      ) : passengers === 0 && diagnostic && (
        <p className="aviso" style={{ margin: '10px 0 0' }}>
          {pairs === 0
            ? <>Em {hubs.join(', ') || 'nenhuma base'} <b>nenhum par dos seus voos casa no relógio</b>: não há
              chegada e partida separadas pelo tempo mínimo de conexão. É aqui que marcar um voo resolve.</>
            : rejected >= pairs
              ? <>A regra vê <b>{pairs}</b> {pairs === 1 ? 'par dos seus voos' : 'pares dos seus voos'} que
                casam no relógio, mas <b>nenhum tem um trajeto viável</b>: há desvio excessivo
                ou existe uma alternativa muito melhor com horário compatível.</>
              : <>A regra vê <b>{pairs}</b> {pairs === 1 ? 'par dos seus voos' : 'pares dos seus voos'} que
                casam no relógio{rejected > 0 && <> ({rejected} {rejected === 1 ? 'rodeia' : 'rodeiam'} demais)</>}.
                Os que sobram não venderam no último dia apurado (dia {state.conexoesApuradasEm}): o passageiro
                preferiu um voo direto — inclusive o seu, se você voa o mesmo par sem escala —, ou o avião já saiu
                sem espaço para novas conexões. Classes cheias pela procura local mantêm o teto de 40% para conexões. Onde sobram assentos, a conexão pode ocupar todas as vagas físicas.</>}
        </p>
      )}
    </Card>
    <Card title="Conexões da malha" right={schedule && <span className="muted">{num(malha.length)}</span>}>
      {schedule === undefined ? <p className="muted" role="status">Calculando as conexões da malha…</p>
      : schedule === null ? <p className="bad" role="status">Não foi possível calcular as conexões da malha.</p>
      : malha.length ? <>
        <div className="scroll media"><table className="connection-journeys" aria-label="Tabela de conexões da malha">
          <thead><tr><th>Viagem</th><th className="r">Chega → sai</th></tr></thead>
          <tbody>{scheduleRows.map(g => <tr key={`${g.via}:${g.from}:${g.to}:${g.arrival}:${g.departure}`}>
            <td><b>{g.from} → {g.via} → {g.to}</b><br /><small className="muted">{g.days} {g.days === 1 ? 'dia' : 'dias'}/sem.</small></td>
            <td className="r">{hhmm(g.arrival)} → {hhmm(g.departure)}<br /><small className="muted">espera {Math.floor(g.wait / 60)}h{String(g.wait % 60).padStart(2, '0')}</small></td>
          </tr>)}</tbody>
        </table></div>
        <Pagination label="Páginas de conexões da malha" page={schedulePageIndex} size={ROWS_PER_PAGE} total={malha.length} onChange={setSchedulePage} />
      </> : <Empty>Nenhum par dos seus voos casa no relógio sem rodear demais neste filtro.</Empty>}
      <p className="muted" style={{ fontSize: 12 }}>Horários compatíveis e trajetos proporcionais (referência doméstica: {DESVIO_MAXIMO.toFixed(2)}× a distância direta). Conexões regionais e internacionais admitem desvios adicionais quando não há opção muito melhor no mesmo horário. Voos diretos disputam passageiros com conexões alinhadas, sem apagá-las. As vendas são apuradas quando o dia vira.</p>
    </Card>
    <Card title="Itinerários vendidos" className="connection-sold" right={<label className="field" style={{ marginBottom: 0 }}><span>Ordenar resultado</span>
      <select aria-label="Ordenar resultado das conexões" value={resultOrder} onChange={e => { setResultOrder(e.target.value as 'best' | 'worst'); setSoldPage(0) }}>
        <option value="best">Maior lucro primeiro</option><option value="worst">Maior prejuízo primeiro</option>
      </select></label>}>
      {trips.length ? <><div className="scroll"><table className="connection-journeys">
        <thead><tr><th>Viagem</th><th className="r">Lucro / prejuízo</th><th>Voos</th><th className="r">Passageiros</th><th>Espera</th><th>Situação</th></tr></thead>
        <tbody>{soldRows.map(({ j, result }) => <tr key={j.id}>
          <td><b>{j.first.from} → {j.via} → {j.second.to}</b><br /><small className="muted">{date(j.first.day)}</small></td>
          <td className={`r ${result.profit === null ? 'muted' : result.profit >= 0 ? 'good' : 'bad'}`}>
            <b>{result.profit === null ? '—' : money(result.profit)}</b><br />
            <small>{result.profit === null ? 'sem custos apurados' : result.complete ? 'operação concluída' : 'resultado parcial'}</small>
          </td>
          <td>{j.first.number} → {j.second.number}<br /><small className="muted">{j.first.operator}{j.first.operator !== j.second.operator && ` / ${j.second.operator}`}</small></td>
          <td className="r"><b>{num(sumCabins(j.pax))}</b><br /><small className="muted">{CABINS.filter(c => j.pax[c]).map(c => `${CABIN_SHORT[c]} ${j.pax[c]}`).join(' · ')}</small></td>
          <td>{Math.floor(j.wait / 60)}h{String(j.wait % 60).padStart(2, '0')}</td>
          <td className={j.cancelled ? 'bad' : 'good'}>{j.cancelled ? 'Conexão interrompida' : j.second.day > state.day ? `Próximo voo em ${date(j.second.day)}` : 'Concluída'}</td>
        </tr>)}</tbody>
      </table></div>
      <Pagination label="Páginas de itinerários vendidos" page={soldPageIndex} size={ROWS_PER_PAGE} total={trips.length} onChange={setSoldPage} />
      </> : <Empty>Nenhuma conexão apurada neste filtro.</Empty>}
      <p className="muted" style={{ fontSize: 12 }}>O resultado atribui a cada conexão sua receita líquida e uma parcela proporcional do custo dos voos próprios que já operaram. Antes do próximo trecho, aparece como parcial. Preço, espera, desvio e concorrência de voos diretos influenciam a escolha. Conexões preenchem lugares vagos; se a classe já sairia cheia, podem ocupar até 40% dela.</p>
    </Card>
  </div>
}
