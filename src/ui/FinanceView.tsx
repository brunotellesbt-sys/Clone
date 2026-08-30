import { useState } from 'react'
import { sumCabins } from '../game/economy'
import {
  addHub, creditLimit, debtTotal, fleetValue, money, netWorth, num, pct, period,
  repayLoan, setMarketing, takeLoan,
} from '../game/engine'
import { AIRPORTS, AIRPORT_BY_IATA } from '../game/data/airports'
import { useGame } from '../store/useGame'
import { Card, Kpi, Spark } from './components/Bits'

export function FinanceView() {
  const { state, act, toast } = useGame()
  const [amount, setAmount] = useState(30)
  const [hub, setHub] = useState('')
  const p30 = period(state, 30)
  const p90 = period(state, 90)
  const p365 = period(state, 365)
  const limit = creditLimit(state)
  const fuelSeries = state.ledger.slice(-90).map((d) => d.cost / Math.max(1, d.flights))

  const candidates = AIRPORTS.filter(
    (a) => !state.airline.hubs.includes(a.iata) && a.tier >= 3,
  ).sort((a, b) => b.pop - a.pop)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        <Card className="tight"><Kpi label="Patrimônio líquido" value={money(netWorth(state))} /></Card>
        <Card className="tight"><Kpi label="Caixa" value={money(state.airline.cash)} tone={state.airline.cash < 0 ? 'bad' : undefined} /></Card>
        <Card className="tight"><Kpi label="Valor da frota" value={money(fleetValue(state))} hint={`${state.airline.fleet.length} aeronaves`} /></Card>
        <Card className="tight"><Kpi label="Dívida" value={money(debtTotal(state))} hint={`limite disponível ${money(limit)}`} /></Card>
      </div>

      <div className="split">
        <Card title="Demonstrativo">
          <table>
            <thead>
              <tr><th>Período</th><th className="r">Receita</th><th className="r">Custo</th><th className="r">Resultado</th><th className="r">Margem</th><th className="r">Pax</th><th className="r">Aproveit.</th></tr>
            </thead>
            <tbody>
              {[['30 dias', p30], ['90 dias', p90], ['12 meses', p365]].map(([label, p]) => {
                const per = p as ReturnType<typeof period>
                return (
                  <tr key={label as string}>
                    <td>{label as string} <span className="muted">({per.days} d)</span></td>
                    <td className="r">{money(per.revenue)}</td>
                    <td className="r">{money(per.cost)}</td>
                    <td className={`r ${per.profit >= 0 ? 'good' : 'bad'}`}>{money(per.profit)}</td>
                    <td className="r">{per.revenue ? pct(per.profit / per.revenue, 1) : '—'}</td>
                    <td className="r">{num(per.pax)}</td>
                    <td className="r">{per.seats ? pct(per.loadFactor, 1) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Custo médio por voo (90 dias)
            </h3>
            <Spark values={fuelSeries.length > 1 ? fuelSeries : [0, 0]} w={640} h={60} color="#fbbf24" />
            <span className="muted" style={{ fontSize: 12 }}>
              combustível hoje: ${state.fuelPrice.toFixed(2)}/kg · {num(p30.flights)} voos nos últimos 30 dias
            </span>
          </div>
        </Card>

        <div className="grid" style={{ gap: 14 }}>
          <Card title="Crédito">
            <label className="field">
              <span>Tomar empréstimo — {money(amount * 1e6)}</span>
              <input type="range" min={5} max={Math.max(5, Math.round(limit / 1e6))} value={amount} onChange={(e) => setAmount(+e.target.value)} />
            </label>
            <button className="btn primary" disabled={limit < 5e6} onClick={() => {
              const err = act((s) => takeLoan(s, amount * 1e6))
              if (err) toast(err, 'error')
            }}>
              Contratar
            </button>
            <div style={{ marginTop: 12 }}>
              {state.airline.loans.length === 0 && <span className="muted">Sem dívidas.</span>}
              {state.airline.loans.map((l) => (
                <div key={l.id} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span>{money(l.balance)} <span className="muted">a {(l.rate * 100).toFixed(1)}% a.a.</span></span>
                  <button className="btn sm" onClick={() => act((s) => repayLoan(s, l.id, l.balance))}>Quitar</button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Marketing">
            <label className="field">
              <span>Investimento diário — {money(state.airline.marketing)}</span>
              <input type="range" min={0} max={300000} step={5000} value={state.airline.marketing}
                onChange={(e) => act((s) => setMarketing(s, +e.target.value))} />
            </label>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Puxa a reputação para cima e melhora sua atratividade nas rotas disputadas. Reputação atual: {pct(state.airline.reputation)}.
            </p>
          </Card>

          <Card title="Bases">
            <div className="row tight" style={{ marginBottom: 10 }}>
              {state.airline.hubs.map((h) => (
                <span key={h} className="chip">{h} · {AIRPORT_BY_IATA[h].city}</span>
              ))}
            </div>
            <label className="field">
              <span>Abrir nova base</span>
              <select value={hub} onChange={(e) => setHub(e.target.value)}>
                <option value="">— escolher —</option>
                {candidates.map((a) => (
                  <option key={a.iata} value={a.iata}>
                    {a.city} ({a.iata}) — {money(4.5e6 * a.tier + 6e6)}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" disabled={!hub} onClick={() => {
              const err = act((s) => addHub(s, hub))
              if (err) toast(err, 'error')
              else setHub('')
            }}>
              Abrir base
            </button>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Bases exigem reputação e custam caro, mas abrem uma nova frente de rotas.
            </p>
          </Card>
        </div>
      </div>

      <Card title="Passageiros por classe (30 dias)">
        <div className="grid g4">
          {(['y', 'w', 'c', 'f'] as const).map((c) => {
            const total = state.ledger.slice(-30).reduce((s, d) => s + d.pax[c], 0)
            const all = state.ledger.slice(-30).reduce((s, d) => s + sumCabins(d.pax), 0)
            const label = { y: 'Econômica', w: 'Premium', c: 'Executiva', f: 'Primeira' }[c]
            return <Kpi key={c} label={label} value={num(total)} hint={all ? pct(total / all, 1) + ' do total' : '—'} />
          })}
        </div>
      </Card>
    </div>
  )
}
