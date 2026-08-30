import { useMemo, useState } from 'react'
import { AIRCRAFT_BY_ID, acLabel } from '../game/data/aircraft'
import { AIRPORTS, AIRPORT_BY_IATA } from '../game/data/airports'
import { baseDemand, CLASS_FARE_MULT } from '../game/demand'
import { sumCabins } from '../game/economy'
import { distanceBetween, odKey } from '../game/geo'
import {
  assignAircraft, closeRoute, dayOfYear, estimateRoute, money, num, openRoute, pct,
  routeCapacityLimit, routeEconomics, routeSlotCost, setAllFrequencies, setFare, setFrequency,
  slotsFree, typeOf, unassignAircraft,
} from '../game/engine'
import { CABIN_LABEL, CABINS, type Route } from '../game/types'
import { useGame } from '../store/useGame'
import { Bar, Card, Empty, Modal, Spark } from './components/Bits'

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function RoutesView() {
  const { state } = useGame()
  const [selId, setSelId] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const routes = state.airline.routes
  const sel = routes.find((r) => r.id === selId) ?? routes[0] ?? null

  return (
    <div className="split">
      <Card
        title={`Rotas (${routes.length})`}
        right={<button className="btn primary sm" onClick={() => setOpening(true)}>Abrir rota</button>}
      >
        {routes.length === 0 ? (
          <Empty>Nenhuma rota. Toda linha precisa sair de uma das suas bases ({state.airline.hubs.join(', ')}).</Empty>
        ) : (
          <div className="scroll" style={{ maxHeight: 540 }}>
            <table>
              <thead>
                <tr>
                  <th>Rota</th><th className="r">Dist.</th><th className="r">Aviões</th><th className="r">Voos</th>
                  <th className="r">Aproveit.</th><th className="r">Fatia</th><th className="r">Resultado 14d</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const e = routeEconomics(state, r)
                  return (
                    <tr key={r.id} className={`click ${sel?.id === r.id ? 'on' : ''}`} onClick={() => setSelId(r.id)}>
                      <td><b>{r.from} → {r.to}</b><br /><span className="muted">{AIRPORT_BY_IATA[r.to].city}</span></td>
                      <td className="r">{num(r.distance)}</td>
                      <td className="r">{r.aircraftIds.length}</td>
                      <td className="r">{Math.max(...r.freq)}/dia</td>
                      <td className="r">{e.days ? pct(e.loadFactor, 1) : '—'}</td>
                      <td className="r">{pct(e.share)}</td>
                      <td className={`r ${e.profit >= 0 ? 'good' : 'bad'}`}>{money(e.profit)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {sel ? <RouteDetail route={sel} onClosed={() => setSelId(null)} /> : <Card title="Detalhe"><Empty>Selecione uma rota.</Empty></Card>}
      {opening && <OpenRouteModal onClose={() => setOpening(false)} onOpened={(id) => { setSelId(id); setOpening(false) }} />}
    </div>
  )
}

function RouteDetail({ route, onClosed }: { route: Route; onClosed: () => void }) {
  const { state, act, toast } = useGame()
  const e = routeEconomics(state, route)
  const limit = routeCapacityLimit(state, route)
  const free = state.airline.fleet.filter((a) => !a.routeId || a.routeId === route.id)
  const hist = route.history.map((h) => h.profit)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title={`${route.from} → ${route.to} · ${AIRPORT_BY_IATA[route.to].city}`}>
        <div className="grid g2" style={{ gap: 8, fontSize: 13, marginBottom: 10 }}>
          <div><span className="muted">Distância</span><br />{num(route.distance)} nm</div>
          <div><span className="muted">Mercado hoje</span><br />{num(e.demand.total)} pax/dia</div>
          <div><span className="muted">Sua fatia</span><br />{pct(e.share, 1)}</div>
          <div><span className="muted">Tarifa base</span><br />${e.demand.refFare.toFixed(0)}</div>
        </div>
        <Spark values={hist.length > 1 ? hist : [0, 0]} w={330} h={44} color={e.profit >= 0 ? '#34d399' : '#fb7185'} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>resultado diário</span>
          <span className={e.profit >= 0 ? 'good' : 'bad'}>{money(e.profit)} em {e.days} dias</span>
        </div>
      </Card>

      <Card title="Aeronaves alocadas">
        {route.aircraftIds.length === 0 && <p className="bad" style={{ marginTop: 0 }}>Sem avião: a rota não voa.</p>}
        {route.aircraftIds.map((id) => {
          const ac = state.airline.fleet.find((a) => a.id === id)
          if (!ac) return null
          return (
            <div key={id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{ac.reg} · {acLabel(typeOf(ac))} <span className="muted">{sumCabins(ac.seats)} assentos</span></span>
              <button className="btn sm" onClick={() => act((s) => unassignAircraft(s, id))}>Retirar</button>
            </div>
          )
        })}
        <label className="field" style={{ marginTop: 8 }}>
          <span>Adicionar aeronave</span>
          <select
            value=""
            onChange={(ev) => {
              const err = act((s) => assignAircraft(s, ev.target.value, route.id))
              if (err) toast(err, 'error')
            }}
          >
            <option value="">— escolher —</option>
            {free.filter((a) => a.routeId !== route.id).map((a) => (
              <option key={a.id} value={a.id}>{a.reg} · {acLabel(typeOf(a))}</option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Capacidade da alocação: até {limit} rotações por dia. Slots livres: {slotsFree(state, route.from)} em {route.from}, {slotsFree(state, route.to)} em {route.to}.
        </p>
      </Card>

      <Card title="Frequência" right={
        <div className="row tight">
          <button className="btn sm" onClick={() => act((s) => setAllFrequencies(s, route.id, limit))}>Máximo</button>
          <button className="btn sm" onClick={() => act((s) => setAllFrequencies(s, route.id, 1))}>1×</button>
        </div>
      }>
        <div className="row tight" style={{ justifyContent: 'space-between' }}>
          {route.freq.map((f, i) => (
            <div key={i} style={{ textAlign: 'center', flex: 1 }}>
              <div className="muted" style={{ fontSize: 11 }}>{DOW[i]}</div>
              <input
                type="number" min={0} max={Math.max(1, limit)} value={f}
                style={{ textAlign: 'center', padding: '5px 2px' }}
                onChange={(ev) => {
                  const err = act((s) => setFrequency(s, route.id, i, +ev.target.value))
                  if (err) toast(err, 'error')
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tarifas">
        {CABINS.map((c) => {
          const abs = e.demand.refFare * CLASS_FARE_MULT[c] * route.fare[c]
          return (
            <label className="field" key={c}>
              <span>
                {CABIN_LABEL[c]} — ${abs.toFixed(0)} ({route.fare[c].toFixed(2)}× a referência)
              </span>
              <input
                type="range" min={0.55} max={1.9} step={0.01} value={route.fare[c]}
                onChange={(ev) => act((s) => setFare(s, route.id, c, +ev.target.value))}
              />
            </label>
          )
        })}
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Barato enche o avião e rouba mercado, mas derruba a receita por passageiro. A econômica é a mais
          sensível a preço; a executiva quase não liga.
        </p>
      </Card>

      <button className="btn danger" onClick={() => { act((s) => closeRoute(s, route.id)); onClosed() }}>
        Encerrar rota
      </button>
    </div>
  )
}

function OpenRouteModal({ onClose, onOpened }: { onClose: () => void; onOpened: (id: string) => void }) {
  const { state, act, toast } = useGame()
  const [hub, setHub] = useState(state.airline.hubs[0])
  const [q, setQ] = useState('')
  const [dest, setDest] = useState<string | null>(null)
  const doy = dayOfYear(state)

  const options = useMemo(() => {
    const open = new Set(state.airline.routes.map((r) => odKey(r.from, r.to)))
    return AIRPORTS.filter((a) => a.iata !== hub && !open.has(odKey(hub, a.iata)))
      .map((a) => {
        const dist = distanceBetween(hub, a.iata)
        const d = baseDemand(hub, a.iata, state.day, doy)
        const rivals = state.competitors.reduce(
          (n, c) => n + c.routes.filter((r) => r.key === odKey(hub, a.iata)).length, 0)
        return { a, dist, demand: d, rivals }
      })
      .filter((o) => o.dist > 110)
      .filter((o) => !q || `${o.a.iata} ${o.a.city} ${o.a.country}`.toLowerCase().includes(q.toLowerCase()))
      .sort((x, y) => y.demand.total - x.demand.total)
      .slice(0, 90)
  }, [hub, q, state, doy])

  const chosen = options.find((o) => o.a.iata === dest) ?? null
  const usable = chosen
    ? Object.values(AIRCRAFT_BY_ID).filter(
        (t) => t.range >= chosen.dist && t.runway <= Math.min(AIRPORT_BY_IATA[hub].runway, chosen.a.runway) &&
          state.startYear + state.day / 365 >= t.since,
      )
    : []
  const best = chosen && usable.length
    ? usable
        .map((t) => ({ t, est: estimateRoute(state, hub, chosen.a.iata, t.id, Math.max(1, Math.round(chosen.demand.total / (t.maxSeats * 3)))) }))
        .sort((x, y) => y.est.profit - x.est.profit)
        .slice(0, 4)
    : []

  return (
    <Modal title="Abrir nova rota" onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="field" style={{ flex: '0 0 200px', marginBottom: 0 }}>
          <span>Saindo de</span>
          <select value={hub} onChange={(e) => setHub(e.target.value)}>
            {state.airline.hubs.map((h) => (
              <option key={h} value={h}>{h} — {AIRPORT_BY_IATA[h].city}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Buscar destino</span>
          <input type="text" value={q} placeholder="cidade, país ou código" onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 330px' }}>
        <div className="scroll" style={{ maxHeight: 400 }}>
          <table>
            <thead>
              <tr><th>Destino</th><th className="r">Dist.</th><th className="r">Mercado</th><th className="r">Tarifa base</th><th className="r">Concorrentes</th></tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.a.iata} className={`click ${dest === o.a.iata ? 'on' : ''}`} onClick={() => setDest(o.a.iata)}>
                  <td><b>{o.a.iata}</b> {o.a.city} <span className="muted">{o.a.country}</span></td>
                  <td className="r">{num(o.dist)} nm</td>
                  <td className="r">{num(o.demand.total)}/dia</td>
                  <td className="r">${o.demand.refFare.toFixed(0)}</td>
                  <td className="r">{o.rivals || <span className="good">livre</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {!chosen && <Empty>Escolha um destino para ver a projeção.</Empty>}
          {chosen && (
            <Card title={`${hub} → ${chosen.a.iata}`}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Custo de abertura</span><b>{money(routeSlotCost(hub, chosen.a.iata, 1))}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Slots livres</span>
                  <b>{slotsFree(state, hub)} / {slotsFree(state, chosen.a.iata)}</b>
                </div>
              </div>
              {best.length === 0 ? (
                <p className="bad">Nenhuma aeronave do catálogo alcança esse destino com a pista disponível.</p>
              ) : (
                <>
                  <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                    Melhores aviões para a etapa
                  </h4>
                  {best.map(({ t, est }) => (
                    <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{acLabel(t)}</b>
                        <span className={est.profit >= 0 ? 'good' : 'bad'}>{money(est.profit)}/dia</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {est.blockH.toFixed(1)} h de voo · {num(est.pax)} pax/dia · receita {money(est.revenue)}
                      </span>
                      <Bar value={est.revenue ? Math.max(0, est.profit / est.revenue) : 0} />
                    </div>
                  ))}
                </>
              )}
              <button
                className="btn primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => {
                  const err = act((s) => openRoute(s, hub, chosen.a.iata))
                  if (err) return toast(err, 'error')
                  const r = state.airline.routes[state.airline.routes.length - 1]
                  onOpened(r.id)
                }}
              >
                Abrir por {money(routeSlotCost(hub, chosen.a.iata, 1))}
              </button>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  )
}
