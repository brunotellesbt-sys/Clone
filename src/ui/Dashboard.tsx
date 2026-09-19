import { useState } from 'react'
import { AIRPORT_BY_IATA, ESCOPO_LABEL } from '../game/data/airports'
import { BuscaAeroporto } from './components/BuscaAeroporto'
import { sumCabins } from '../game/economy'
import {
  addHub, debtTotal, fleetValue, HUB_COST, km, money, netWorth, num, pct, period, routeEconomics,
} from '../game/engine'
import { useGame } from '../store/useGame'
import { Card, Kpi, Spark } from './components/Bits'
import { MapView } from './MapView'

export function Dashboard({ go }: { go: (tab: string) => void }) {
  const { state, act, toast } = useGame()
  const [hub, setHub] = useState('')
  /**
   * Base nova sai de busca, não de lista suspensa, e sem piso de degrau: a
   * trava que existia deixava Santos Dumont e Congonhas de fora por serem
   * degrau 2 e 3 numa lista que só aceitava 3 para cima.
   */
  const jaEBase = (a: { iata: string }) => state.airline.hubs.includes(a.iata)
  const p30 = period(state, 30)
  const p7 = period(state, 7)
  const daily = state.ledger.slice(-60).map((d) => d.profit)
  let running = 0
  const cashSeries = state.ledger.slice(-60).map((d) => (running += d.profit))

  const best = [...state.airline.routes]
    .map((r) => ({ r, e: routeEconomics(state, r) }))
    .sort((a, b) => b.e.profit - a.e.profit)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        <Card className="tight"><Kpi label="Caixa" value={money(state.airline.cash)} tone={state.airline.cash < 0 ? 'bad' : undefined} hint={`dívida ${money(debtTotal(state))}`} /></Card>
        <Card className="tight"><Kpi label="Patrimônio" value={money(netWorth(state))} hint={`frota ${money(fleetValue(state))}`} /></Card>
        <Card className="tight"><Kpi label="Lucro (30 d)" value={money(p30.profit)} tone={p30.profit >= 0 ? 'good' : 'bad'} hint={`margem ${p30.revenue ? pct(p30.profit / p30.revenue) : '—'}`} /></Card>
        <Card className="tight"><Kpi label="Aproveitamento" value={p7.seats ? pct(p7.loadFactor, 1) : '—'} hint={`${num(p7.pax)} pax em 7 dias`} /></Card>
      </div>

      <div className="split">
        <Card title="Malha" right={<button className="btn sm" onClick={() => go('rotas')}>Gerenciar rotas</button>}>
          <div style={{ margin: '-4px -4px 0' }}>
            <MapView state={state} height={430} focus={state.airline.hubs[0]} />
          </div>
        </Card>

        <div className="grid" style={{ gap: 14 }}>
          <Card title="Resultado diário">
            <Spark values={daily.length > 1 ? daily : [0, 0]} w={330} h={54} color={p7.profit >= 0 ? '#34d399' : '#fb7185'} />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>últimos {Math.min(60, state.ledger.length)} dias</span>
              <span className={`num ${p7.profit >= 0 ? 'good' : 'bad'}`} style={{ fontWeight: 700 }}>
                {money(p7.profit / Math.max(1, p7.days))}/dia
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Spark values={cashSeries.length > 1 ? cashSeries : [0, 0]} w={330} h={40} color="#38bdf8" />
              <span className="muted" style={{ fontSize: 12 }}>acumulado no período</span>
            </div>
          </Card>

          <Card title="Companhia">
            <div className="grid g2" style={{ gap: 10 }}>
              <Kpi label="Reputação" value={pct(state.airline.reputation)} />
              <Kpi label="Frota" value={`${state.airline.fleet.length}`} hint={`${state.airline.routes.length} rotas`} />
              <Kpi label="Bases" value={state.airline.hubs.join(' · ')} />
              <Kpi label="Combustível" value={`$${state.fuelPrice.toFixed(2)}/kg`} tone={state.fuelPrice > 1 ? 'warn' : undefined} />
            </div>
          </Card>

          {/*
            * O cartão de bases mora aqui, e não nas Finanças.
            *
            * Ele existia — em Finanças → Bases — e ninguém achava, porque
            * ninguém procura "abrir base" na tela de dinheiro. Abrir base é
            * decisão de malha: acontece olhando o mapa e percebendo que a
            * próxima rota não sai de lugar nenhum. É aqui, ao lado do mapa,
            * que a pergunta nasce.
            */}
          <Card title="Bases">
            <div className="row tight" style={{ marginBottom: 10 }}>
              {state.airline.hubs.map((h) => (
                <span key={h} className="chip">{h} · {AIRPORT_BY_IATA[h].city}</span>
              ))}
            </div>
            <label className="field">
              <span>Abrir nova base</span>
              <BuscaAeroporto
                placeholder="sigla, cidade ou país"
                fora={jaEBase}
                extra={(a) => ESCOPO_LABEL[a.escopo]}
                onPick={setHub}
              />
            </label>
            {hub && (
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span>
                  <b>{hub}</b> <span className="muted">{AIRPORT_BY_IATA[hub].city}</span>
                  {' · '}{money(HUB_COST)}
                </span>
                <button className="btn sm" onClick={() => setHub('')}>Trocar</button>
              </div>
            )}
            <button className="btn" disabled={!hub} onClick={() => {
              const err = act((s) => addHub(s, hub))
              if (err) toast(err, 'error')
              else setHub('')
            }}>
              Abrir base
            </button>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Base custa {money(HUB_COST)} em qualquer aeroporto e exige reputação — quanto maior
              o aeroporto, mais reputação. O escopo dele decide o que a base alcança: um
              doméstico não abre nenhuma rota internacional.
            </p>
          </Card>

          <Card title="Avisos">
            <div className="scroll baixa">
              {state.notices.length === 0 && <span className="muted">Nada por aqui.</span>}
              {state.notices.slice(0, 14).map((n, i) => (
                <div key={i} className="notice">
                  <span className={n.kind === 'good' ? 'good' : n.kind === 'bad' ? 'bad' : 'dim'}>{n.text}</span>
                  <small style={{ marginLeft: 'auto' }}>d{n.day}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Rotas por resultado (14 dias)" right={<button className="btn sm" onClick={() => go('rotas')}>Abrir rota</button>}>
        {best.length === 0 ? (
          <div className="list-empty">
            Nenhuma rota ainda. Compre uma aeronave no <button className="btn sm" onClick={() => go('mercado')}>mercado</button> e abra sua primeira linha.
          </div>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Rota</th><th className="r">Distância</th><th className="r">Voos/dia</th>
                  <th className="r">Pax (14d)</th><th className="r">Aproveit.</th><th className="r">Fatia</th>
                  <th className="r">Receita</th><th className="r">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {best.map(({ r, e }) => (
                  <tr key={r.id} className="click" onClick={() => go('rotas')}>
                    <td><b>{r.from}</b> → {r.to} <span className="muted">{AIRPORT_BY_IATA[r.to].city}</span></td>
                    <td className="r">{km(r.distance)}</td>
                    <td className="r">{Math.max(...r.freq)}</td>
                    <td className="r">{num(e.pax)}</td>
                    <td className="r">{e.days ? pct(e.loadFactor, 1) : '—'}</td>
                    <td className="r">{pct(e.share)}</td>
                    <td className="r">{money(e.revenue)}</td>
                    <td className={`r ${e.profit >= 0 ? 'good' : 'bad'}`}>{money(e.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {state.airline.fleet.length > 0 && state.airline.routes.length === 0 && (
        <Card title="Próximo passo">
          Você tem {state.airline.fleet.length} aeronave(s) parada(s). Abra uma rota e aloque o avião para começar a faturar.
        </Card>
      )}
      <div className="muted" style={{ fontSize: 12 }}>
        Passageiros transportados no total: {num(state.ledger.reduce((s, d) => s + sumCabins(d.pax), 0))}
      </div>
    </div>
  )
}
