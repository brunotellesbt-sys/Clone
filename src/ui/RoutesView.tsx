import { useMemo, useState } from 'react'
import { AIRCRAFT_BY_ID, acLabel, ehCargueiro } from '../game/data/aircraft'
import { AIRPORTS, AIRPORT_BY_IATA, ESCOPO_LABEL, vooPermitido } from '../game/data/airports'
import { baseDemand, cargoDemand, CLASS_FARE_MULT } from '../game/demand'
import { sumCabins } from '../game/economy'
import { distanceBetween, odKey } from '../game/geo'
import { pistaServe } from '../game/spec'
import {
  assignAircraft, closeRoute, dayOfYear, estimateRoute, km, money, num, openRoute, pct,
  routeCapacityLimit, routeEconomics, routeSlotCost, setAllFrequencies, setFare, setFrequency,
  slotsFree, typeOf, unassignAircraft,
} from '../game/engine'
import { pernasDaRota, pernasDe } from '../game/escala'
import { CABIN_LABEL, CABINS, type Route } from '../game/types'
import { useGame } from '../store/useGame'
import { Bar, Card, Empty, Modal, Spark } from './components/Bits'
import { Horarios } from './components/Horarios'

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function RoutesView() {
  const { state } = useGame()
  const [selId, setSelId] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const routes = state.airline.routes
  const sel = routes.find((r) => r.id === selId) ?? routes[0] ?? null

  return (
    <div className="grid" style={{ gap: 14 }}>
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
                  <th>Rota</th><th className="r">Distância</th><th className="r">Aviões</th><th className="r">Voos</th>
                  <th className="r">Aproveit.</th><th className="r">Fatia</th><th className="r">Resultado 14d</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const e = routeEconomics(state, r)
                  return (
                    <tr key={r.id} className={`click ${sel?.id === r.id ? 'on' : ''}`} onClick={() => setSelId(r.id)}>
                      <td><b>{r.from} → {r.to}</b><br /><span className="muted">{AIRPORT_BY_IATA[r.to].city}</span></td>
                      <td className="r">{km(r.distance)}</td>
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
    {/* horários e conexões ocupam a largura toda: a malha não cabe na coluna
        estreita, e é a tela mais densa da rota */}
    {sel && <Horarios route={sel} />}
    </div>
  )
}

function RouteDetail({ route, onClosed }: { route: Route; onClosed: () => void }) {
  const { state, act, toast } = useGame()
  const e = routeEconomics(state, route)
  const limit = routeCapacityLimit(state, route)
  // qualquer cauda serve: com a malha, "livre" deixou de existir — o que decide
  // é a posição dela no horário, e disso cuida `assignAircraft`
  const free = state.airline.fleet
  const hist = route.history.map((h) => h.profit)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title={`${route.from} → ${route.to} · ${AIRPORT_BY_IATA[route.to].city}`}>
        <div className="grid g2" style={{ gap: 8, fontSize: 13, marginBottom: 10 }}>
          <div><span className="muted">Distância</span><br />{km(route.distance)}</div>
          <div><span className="muted">Mercado hoje</span><br />{num(e.demand.total)} {e.unidade}/dia</div>
          <div><span className="muted">Sua fatia</span><br />{pct(e.share, 1)}</div>
          <div><span className="muted">{e.cargo ? 'Frete base' : 'Tarifa base'}</span><br />${e.demand.refFare.toFixed(0)}{e.cargo ? '/t' : ''}</div>
        </div>
        <Spark values={hist.length > 1 ? hist : [0, 0]} w={330} h={44} color={e.profit >= 0 ? '#34d399' : '#fb7185'} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>resultado diário</span>
          <span className={e.profit >= 0 ? 'good' : 'bad'}>{money(e.profit)} em {e.days} dias</span>
        </div>
      </Card>

      <Card title="Quem voa esta rota">
        {route.aircraftIds.length === 0 && <p className="bad" style={{ marginTop: 0 }}>Sem voo marcado: a rota não voa.</p>}
        {route.aircraftIds.map((id) => {
          const ac = state.airline.fleet.find((a) => a.id === id)
          if (!ac) return null
          const minhas = pernasDaRota(state, route).filter((p) => p.aircraftId === id).length
          const total = pernasDe(state, id).length
          return (
            <div key={id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>
                {ac.reg} · {acLabel(typeOf(ac))}{' '}
                <span className="muted">{ehCargueiro(typeOf(ac)) ? `${typeOf(ac).payload} t` : `${sumCabins(ac.seats)} assentos`}</span>
                <br />
                <span className="muted" style={{ fontSize: 12 }}>
                  {minhas} de {total} voos da semana dela são nesta rota
                </span>
              </span>
              <button className="btn sm" title="tira desta rota os voos desta cauda; os voos dela em outras rotas ficam"
                onClick={() => act((s) => unassignAircraft(s, id, route.id))}>
                Tirar
              </button>
            </div>
          )
        })}
        <label className="field" style={{ marginTop: 8 }}>
          <span>Dedicar uma cauda a esta rota</span>
          <select
            value=""
            onChange={(ev) => {
              const err = act((s) => assignAircraft(s, ev.target.value, route.id))
              if (err) toast(err, 'error')
            }}
          >
            <option value="">— escolher —</option>
            {free.map((a) => (
              <option key={a.id} value={a.id}>{a.reg} · {acLabel(typeOf(a))}</option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Dedicar monta ida e volta nos sete dias com essa cauda. Para a aeronave circular pela
          malha — chegar aqui e seguir para outro destino — marque voo a voo abaixo. Slots livres:{' '}
          {slotsFree(state, route.from)} em {route.from}, {slotsFree(state, route.to)} em {route.to}.
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
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
          O número é <b>resultado</b>, não ordem: o jogo procura cauda parada na base naquelas horas
          e marca o que couber. Pedir cinco e receber três quer dizer que não havia avião livre — e é
          a informação que faltava antes, quando a frequência era só um número na rota.
        </p>
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
  // Passageiro ou carga é escolha da abertura: a rota nasce sem aeronave, então
  // não dá para deduzir da frota alocada.
  const [carga, setCarga] = useState(false)
  const doy = dayOfYear(state)

  const options = useMemo(() => {
    const open = new Set(state.airline.routes.map((r) => odKey(r.from, r.to)))
    // Quantos concorrentes voam cada par, contado uma vez: com três mil destinos
    // na lista, varrer as rotas de cada concorrente por destino era três mil
    // varreduras por tecla digitada.
    const rivais = new Map<string, number>()
    for (const c of state.competitors) {
      for (const r of c.routes) rivais.set(r.key, (rivais.get(r.key) ?? 0) + 1)
    }
    const busca = q.trim().toLowerCase()
    const base = AIRPORT_BY_IATA[hub]
    return AIRPORTS.filter((a) => a.iata !== hub && !open.has(odKey(hub, a.iata)))
      // O filtro de texto vem antes das contas: medir demanda de três mil
      // destinos a cada tecla é trabalho jogado fora quando o jogador já disse
      // o que procura.
      .filter((a) => !busca || `${a.iata} ${a.city} ${a.country}`.toLowerCase().includes(busca))
      .map((a) => {
        const dist = distanceBetween(hub, a.iata)
        const dp = baseDemand(hub, a.iata, state.day, doy)
        const dc = cargoDemand(hub, a.iata, state.day, doy)
        const d = carga
          ? { ...dp, total: dc.tons, refFare: dc.refRate }
          : dp
        // O destino barrado continua na lista, desativado e com o motivo: assim
        // o jogador aprende a regra de alfândega em vez de nunca ver o aeroporto
        return { a, dist, demand: d, rivals: rivais.get(odKey(hub, a.iata)) ?? 0, barrado: vooPermitido(base, a) }
      })
      .filter((o) => o.dist > 110)
      .sort((x, y) => Number(!!x.barrado) - Number(!!y.barrado) || y.demand.total - x.demand.total)
      .slice(0, 90)
  }, [hub, q, state, doy, carga])

  const chosen = options.find((o) => o.a.iata === dest) ?? null
  const usable = chosen
    ? Object.values(AIRCRAFT_BY_ID).filter(
        (t) => ehCargueiro(t) === carga &&
          t.range >= chosen.dist &&
          pistaServe(t, AIRPORT_BY_IATA[hub], chosen.a) &&
          state.startYear + state.day / 365 >= t.since,
      )
    : []
  /**
   * Cada aeronave é medida na **melhor frequência dela**, não numa arbitrada.
   *
   * A versão anterior dava a cada modelo a frequência que enchia o avião três
   * vezes — e isso premia avião pequeno por construção: frequência entra na
   * disputa por passageiro, então o menor, voando mais vezes, levava mais
   * fatia. O resultado ficava errado de um jeito visível: o A320neo aparecia
   * **abaixo** do A320-200 que ele substitui, embora custe $39,98 por assento
   * contra $43,04 do ceo. A conta não estava comparando aeronave, estava
   * comparando frequência.
   *
   * Agora cada modelo é varrido pela faixa de frequências que ele aguenta e
   * entra na lista com a que der mais lucro — que é o que um planejador faz. A
   * frequência escolhida aparece no cartão: é decisão, não detalhe.
   */
  const best = chosen && usable.length
    ? usable
        .map((t) => {
          const porAviao = t.maxSeats || (t.payload ?? 1)
          const cheio = Math.max(1, Math.round(chosen.demand.total / (porAviao * 3)))
          /**
           * O teto é o slot, não a vontade.
           *
           * Sem ele a varredura saturava no maior número que ela tentava — em
           * Santos Dumont–Congonhas todo modelo "queria" quarenta voos por dia,
           * porque o mercado é grande o bastante para absorver e o modelo não
           * cobra nada por isso. Quem cobra é o aeroporto: cada rotação gasta
           * dois movimentos em cada ponta, e é a mesma conta que `setFrequency`
           * já faz na hora de marcar de verdade.
           */
          const teto = Math.max(
            1,
            Math.min(
              Math.floor(Math.min(slotsFree(state, hub), slotsFree(state, chosen.a.iata)) / 2),
              cheio * 3,
            ),
          )
          let melhor = { freq: 1, est: estimateRoute(state, hub, chosen.a.iata, t.id, 1) }
          for (const freq of [2, 3, 4, 6, 8, 10, 14, 20, 28, 40, teto]) {
            if (freq > teto) continue
            const est = estimateRoute(state, hub, chosen.a.iata, t.id, freq)
            if (est.profit > melhor.est.profit) melhor = { freq, est }
          }
          return { t, freq: melhor.freq, est: melhor.est }
        })
        .sort((x, y) => y.est.profit - x.est.profit)
        .slice(0, 4)
    : []

  return (
    <Modal title="Abrir nova rota" onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="row tight" style={{ flex: '0 0 auto' }}>
          <button className={`btn sm ${carga ? '' : 'primary'}`} onClick={() => { setCarga(false); setDest(null) }}>
            Passageiro
          </button>
          <button className={`btn sm ${carga ? 'primary' : ''}`} onClick={() => { setCarga(true); setDest(null) }}>
            Carga
          </button>
        </div>
        <label className="field" style={{ flex: '0 0 200px', marginBottom: 0 }}>
          <span>Saindo de</span>
          <select value={hub} onChange={(e) => setHub(e.target.value)}>
            {state.airline.hubs.map((h) => (
              <option key={h} value={h}>{h} — {AIRPORT_BY_IATA[h].city}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '0 0 190px', marginBottom: 0 }}>
          <span>Filtrar a lista</span>
          <input type="text" value={q} placeholder="cidade, país ou código" onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Destino</span>
          <select value={dest ?? ''} onChange={(e) => setDest(e.target.value || null)}>
            <option value="">— escolher destino ({options.length} na lista) —</option>
            {options.map((o) => (
              <option key={o.a.iata} value={o.a.iata} disabled={!!o.barrado}>
                {o.a.iata} — {o.a.city}, {o.a.country} · {km(o.dist)} · {num(o.demand.total)} {carga ? 't' : 'pax'}/dia
                {o.barrado ? ' · indisponível' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split detalhe">
        <div className="scroll" style={{ maxHeight: 400 }}>
          <table>
            <thead>
              <tr><th>Destino</th><th className="r">Distância</th><th className="r">Mercado</th><th className="r">Tarifa base</th><th className="r">Concorrentes</th></tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.a.iata} className={`click ${dest === o.a.iata ? 'on' : ''} ${o.barrado ? 'off' : ''}`}
                  onClick={() => !o.barrado && setDest(o.a.iata)}>
                  <td>
                    <b>{o.a.iata}</b> {o.a.city} <span className="muted">{o.a.country}</span>
                    <br />
                    <span className="muted" style={{ fontSize: 11 }}>
                      {ESCOPO_LABEL[o.a.escopo]}{o.barrado ? ` · ${o.barrado}` : ''}
                    </span>
                  </td>
                  <td className="r">{km(o.dist)}</td>
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
                  <span className="muted">Distância</span><b>{km(chosen.dist)}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Custo de abertura</span><b>{money(routeSlotCost(hub, chosen.a.iata))}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Slots livres</span>
                  <b>{slotsFree(state, hub)} / {slotsFree(state, chosen.a.iata)}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Escopo</span>
                  <b>{ESCOPO_LABEL[AIRPORT_BY_IATA[hub].escopo]} → {ESCOPO_LABEL[chosen.a.escopo]}</b>
                </div>
              </div>
              {best.length === 0 ? (
                <p className="bad">Nenhuma aeronave do catálogo alcança esse destino com a pista disponível.</p>
              ) : (
                <>
                  <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                    Melhores aviões para a etapa
                  </h4>
                  {best.map(({ t, freq, est }) => (
                    <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{acLabel(t)}</b>
                        <span className={est.profit >= 0 ? 'good' : 'bad'}>{money(est.profit)}/dia</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {freq}×/dia · {est.blockH.toFixed(1)} h de voo · {num(est.pax)} {carga ? 't/dia' : 'pax/dia'}
                        {' · '}receita {money(est.revenue)}
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
                  const err = act((s) => openRoute(s, hub, chosen.a.iata, carga))
                  if (err) return toast(err, 'error')
                  const r = state.airline.routes[state.airline.routes.length - 1]
                  onOpened(r.id)
                }}
              >
                Abrir por {money(routeSlotCost(hub, chosen.a.iata))}
              </button>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  )
}
