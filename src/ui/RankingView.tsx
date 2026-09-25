import { Fragment, useState } from 'react'
import { AIRPORT_BY_IATA } from '../game/data/airports'
import { frotaDaConcorrente } from '../game/ai'
import { distanceBetween } from '../game/geo'
import { km, money, netWorth, num, pct, period } from '../game/engine'
import { useGame } from '../store/useGame'
import { Card, Empty } from './components/Bits'

/**
 * A ficha da rival: com o que ela voa e para onde.
 *
 * A tela dizia "118 aviões" e parava aí — um número sem nenhuma consequência
 * para quem está decidindo em que par entrar. Saber que a companhia de 118
 * aeronaves tem oitenta E195 em etapa curta, e não oitenta widebody, muda
 * completamente onde vale a pena disputar.
 *
 * A frota é **derivada da malha**, e isso está dito na tela: a rival não tem
 * cauda com matrícula, ela tem rota com oferta. Ver `frotaDaConcorrente`.
 */
function FichaDaRival({ id }: { id: string }) {
  const { state } = useGame()
  const c = state.competitors.find((x) => x.id === id)
  if (!c) return null
  const ano = state.startYear + state.day / 365
  const frota = frotaDaConcorrente(c, ano)
  // as maiores primeiro: é onde o dinheiro dela está, e onde doer mais entrar
  const rotas = [...c.routes].sort((x, y) => y.seats * y.freq - x.seats * x.freq)

  return (
    <div className="grid g2" style={{ gap: 14, padding: '10px 0' }}>
      <div>
        <h4 className="sub">Frota</h4>
        {frota.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>Sem malha: a companhia ainda não voa.</p>
        ) : (
          <div className="scroll baixa">
            <table className="compacta">
              <thead>
                <tr><th>Modelo</th><th className="r">Aviões</th><th className="r">Rotas</th><th className="r">Assentos/dia</th></tr>
              </thead>
              <tbody>
                {frota.map((l) => (
                  <tr key={l.typeId}>
                    <td>{l.nome}</td>
                    <td className="r"><b>{num(l.avioes)}</b></td>
                    <td className="r muted">{num(l.rotas)}</td>
                    <td className="r muted">{num(l.assentosDia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
          A rival não tem matrícula: a frota sai da malha dela. Para cada rota entra o modelo que
          leva a oferta, alcança o destino com a pista das duas pontas e gasta menos por assento;
          as caudas são repartidas por hora de voo.
        </p>
      </div>
      <div>
        <h4 className="sub">Maiores rotas</h4>
        <div className="scroll baixa">
          <table className="compacta">
            <thead>
              <tr><th>Rota</th><th className="r">Distância</th><th className="r">Voos</th><th className="r">Assentos</th></tr>
            </thead>
            <tbody>
              {rotas.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.from} → {r.to}</b> <span className="muted">{AIRPORT_BY_IATA[r.to]?.city}</span></td>
                  <td className="r muted">{km(distanceBetween(r.from, r.to))}</td>
                  <td className="r">{num(r.freq)}/dia</td>
                  <td className="r muted">{num(r.seats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function RankingView() {
  const { state } = useGame()
  const p30 = period(state, 30)
  /** Uma ficha aberta por vez: duas abertas viram uma tela de rolagem. */
  const [aberta, setAberta] = useState<string | null>(null)

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
                <Fragment key={r.id}>
                  <tr
                    className={`${r.me ? 'on' : ''} ${r.me ? '' : 'click'}`}
                    onClick={() => !r.me && setAberta((x) => (x === r.id ? null : r.id))}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.color, marginRight: 8 }} />
                      <b>{r.name}</b> <span className="muted">{r.code}</span>
                      {r.me && <span className="chip" style={{ marginLeft: 8 }}>você</span>}
                      {/* O convite é preciso: sem ele, uma linha que abre
                          parece uma linha que não faz nada. */}
                      {!r.me && (
                        <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                          {aberta === r.id ? '▾ fechar' : '▸ frota e malha'}
                        </span>
                      )}
                    </td>
                    <td>{r.hub} <span className="muted">{AIRPORT_BY_IATA[r.hub]?.city}</span></td>
                    <td className="r">{money(r.revenue)}</td>
                    <td className="r">{num(r.routes)}</td>
                    <td className="r">{num(r.fleet)}</td>
                    <td className="r">{pct(r.reputation)}</td>
                  </tr>
                  {aberta === r.id && !r.me && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--sky-1)' }}>
                        <FichaDaRival id={r.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Onde você encosta na concorrência">
        <div className="scroll media">
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
