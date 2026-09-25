import { useState } from 'react'
import { useGame } from '../store/useGame'
import { CABINS, CABIN_SHORT } from '../game/types'
import { gameDate, num } from '../game/engine'
import { sumCabins } from '../game/economy'
import { Card, Empty } from './components/Bits'

export function ConnectionsView() {
  const { state } = useGame()
  const [hub, setHub] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(7)
  const date = (day: number) => new Date(gameDate(state).getTime() + (day - state.day) * 86400000)
    .toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
  const all = (state.connectionJourneys ?? []).filter(j => j.first.day >= state.day - period + 1 && (!hub || j.via === hub))
  const trips = all.filter(j => `${j.first.from} ${j.via} ${j.second.to} ${j.first.number} ${j.second.number}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.first.day - a.first.day || a.first.departure - b.first.departure)
  const active = all.filter(j => !j.cancelled)
  const passengers = active.reduce((n, j) => n + sumCabins(j.pax), 0)
  const boardings = active.reduce((n, j) => n + sumCabins(j.pax) * (Number(j.first.own && j.first.day <= state.day) + Number(j.second.own && j.second.day <= state.day)), 0)
  const waiting = active.filter(j => j.second.day > state.day).reduce((n, j) => n + sumCabins(j.pax), 0)
  return <div className="grid" style={{ gap: 14 }}>
    <Card title="Conexões">
      <p className="muted">Cada viagem liga dois voos e reserva o mesmo número de passageiros nos dois trechos. Eles contam na lotação de cada voo, mas não como demanda local atendida entre essas duas pontas.</p>
      <div className="connection-filters">
        <label>Hub<select aria-label="Hub das conexões" value={hub} onChange={e => setHub(e.target.value)}><option value="">Todos os hubs</option>{state.airline.hubs.map(h => <option key={h}>{h}</option>)}</select></label>
        <label>Período<select aria-label="Período das conexões" value={period} onChange={e => setPeriod(Number(e.target.value))}><option value={1}>Último dia</option><option value={7}>7 dias</option><option value={14}>14 dias</option></select></label>
        <label>Buscar<input type="search" aria-label="Buscar conexão" placeholder="Aeroporto ou número do voo" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      <div className="grid g3" style={{ gap: 14 }}>
        <div><span className="muted">Passageiros com conexão</span><br /><b>{num(passengers)}</b><small className="dim"> · cada viajante contado uma vez</small></div>
        <div><span className="muted">Embarques nos seus voos</span><br /><b>{num(boardings)}</b><small className="dim"> · dois quando os dois trechos são seus</small></div>
        <div><span className="muted">Aguardando próximo trecho</span><br /><b>{num(waiting)}</b></div>
      </div>
    </Card>
    <Card title="Itinerários vendidos">
      {trips.length ? <div className="scroll"><table className="connection-journeys">
        <thead><tr><th>Viagem</th><th>Voos</th><th className="r">Passageiros</th><th>Espera</th><th>Situação</th></tr></thead>
        <tbody>{trips.map(j => <tr key={j.id}>
          <td><b>{j.first.from} → {j.via} → {j.second.to}</b><br /><small className="muted">{date(j.first.day)}</small></td>
          <td>{j.first.number} → {j.second.number}<br /><small className="muted">{j.first.operator}{j.first.operator !== j.second.operator && ` / ${j.second.operator}`}</small></td>
          <td className="r"><b>{num(sumCabins(j.pax))}</b><br /><small className="muted">{CABINS.filter(c => j.pax[c]).map(c => `${CABIN_SHORT[c]} ${j.pax[c]}`).join(' · ')}</small></td>
          <td>{Math.floor(j.wait / 60)}h{String(j.wait % 60).padStart(2, '0')}</td>
          <td className={j.cancelled ? 'bad' : 'good'}>{j.cancelled ? 'Conexão interrompida' : j.second.day > state.day ? `Próximo voo em ${date(j.second.day)}` : 'Concluída'}</td>
        </tr>)}</tbody>
      </table></div> : <Empty>Nenhuma conexão apurada neste filtro. Programe chegadas e partidas compatíveis em um hub e avance o jogo.</Empty>}
      <p className="muted" style={{ fontSize: 12 }}>Preço, tempo total, espera, conveniência do aeroporto e concorrência de voos diretos influenciam a escolha. Conexões ocupam lugares vagos; quando o voo enche, parte dos assentos deixa de atender passageiros locais. A demanda local permanece disponível.</p>
    </Card>
  </div>
}
