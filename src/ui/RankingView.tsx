import { AIRPORT_BY_IATA } from '../game/data/airports'
import { money, netWorth, num, pct, period } from '../game/engine'
import { useGame } from '../store/useGame'
import { Card, Empty } from './components/Bits'

export function RankingView() {
  const { state } = useGame()
  const p30 = period(state, 30)

  const rows = [
    ...state.competitors.map((c) => ({
      id: c.id, name: c.name, code: c.code, hub: c.hub, color: c.color,
      revenue: c.revenue30, routes: c.routes.length, fleet: c.fleetSize,
      reputation: c.reputation, me: false,
    })),
    {
      id: 'me', name: state.airline.name, code: state.airline.code, hub: state.airline.hubs[0],
      color: state.airline.livery.tail, revenue: p30.revenue, routes: state.airline.routes.length,
      fleet: state.airline.fleet.length, reputation: state.airline.reputation, me: true,
    },
  ].sort((a, b) => b.revenue - a.revenue)

  const myRank = rows.findIndex((r) => r.me) + 1
  const leader = rows[0]

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Mercado mundial">
        <p className="dim" style={{ marginTop: 0 }}>
          Você é a <b>{myRank}ª</b> companhia por receita entre {rows.length}. A líder, {leader.name},
          fatura {money(leader.revenue)} por mês{leader.me ? ' — e é você.' : `, ${(leader.revenue / Math.max(1, p30.revenue)).toFixed(1)}× o seu.`}
        </p>
        {state.ledger.length === 0 ? (
          <Empty>Comece a voar para entrar no ranking.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Companhia</th><th>Base</th><th className="r">Receita (30 d)</th>
                <th className="r">Rotas</th><th className="r">Frota</th><th className="r">Reputação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={r.me ? 'on' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.color, marginRight: 8 }} />
                    <b>{r.name}</b> <span className="muted">{r.code}</span>
                    {r.me && <span className="chip" style={{ marginLeft: 8 }}>você</span>}
                  </td>
                  <td>{r.hub} <span className="muted">{AIRPORT_BY_IATA[r.hub]?.city}</span></td>
                  <td className="r">{money(r.revenue)}</td>
                  <td className="r">{num(r.routes)}</td>
                  <td className="r">{num(r.fleet)}</td>
                  <td className="r">{pct(r.reputation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Onde você encosta na concorrência">
        <div className="scroll" style={{ maxHeight: 320 }}>
          <table>
            <thead><tr><th>Rota</th><th className="r">Sua fatia</th><th>Rivais no par</th></tr></thead>
            <tbody>
              {state.airline.routes.map((r) => {
                const key = r.from < r.to ? `${r.from}-${r.to}` : `${r.to}-${r.from}`
                const rivals = state.competitors.filter((c) => c.routes.some((x) => x.key === key))
                return (
                  <tr key={r.id}>
                    <td><b>{r.from} → {r.to}</b></td>
                    <td className="r">{pct(state.lastShare[key] ?? 0, 1)}</td>
                    <td>
                      {rivals.length === 0 ? <span className="good">monopólio</span> : rivals.map((c) => (
                        <span key={c.id} className="chip grey" style={{ marginRight: 4 }}>{c.name}</span>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Patrimônio">
        <b className="num" style={{ fontSize: 26 }}>{money(netWorth(state))}</b>
      </Card>
    </div>
  )
}
