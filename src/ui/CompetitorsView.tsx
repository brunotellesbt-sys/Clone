import { Fragment, useMemo, useState } from 'react'
import { AIRPORT_BY_IATA } from '../game/data/airports'
import { frotaDaConcorrente } from '../game/ai'
import { baseDemand, CLASS_FARE_MULT } from '../game/demand'
import { allocateMarket, SELLABLE, type Carrier } from '../game/economy'
import { dayOfYear, km, modelOf, num, pct } from '../game/engine'
import { cabinComfort } from '../game/cabin'
import { pernasDaRota } from '../game/escala'
import { atratividadeHorario, horaDaConcorrente } from '../game/malha'
import { distanceBetween, odKey } from '../game/geo'
import { moedaDoPais, tarifa } from '../game/money'
import type { Competitor, GameState, Route } from '../game/types'
import { useGame } from '../store/useGame'
import { Card, Empty } from './components/Bits'

function ofertaConcorrente(comp: Competitor, r: Competitor['routes'][number]): Carrier {
  const total = r.seats * r.freq * 2 * SELLABLE
  return {
    id: comp.id,
    seats: { y: total * 0.88, w: total * 0.042, c: total * 0.072, f: total * 0.006 },
    freq: r.freq, fareMult: r.fare, quality: r.quality * atratividadeHorario(horaDaConcorrente(r)),
  }
}

function ofertaJogador(s: GameState, r: Route): Carrier | null {
  const voos = pernasDaRota(s, r).flatMap(p => {
    const a = s.airline.fleet.find(x => x.id === p.aircraftId && x.groundedUntil <= s.day)
    return a ? [{ p, a }] : []
  })
  if (!voos.length) return null
  const seats = { y: 0, w: 0, c: 0, f: 0 }
  let comfort = 0
  let horario = 0
  for (const { p, a } of voos) {
    for (const c of ['y', 'w', 'c', 'f'] as const) seats[c] += a.seats[c] * SELLABLE / 7
    const type = modelOf(a)
    comfort += type.comfort * cabinComfort(type, a.seats, a.pitch, a.seatConfig) * (0.85 + 0.15 * a.condition)
    horario += atratividadeHorario(p.saida)
  }
  return {
    id: `P:${r.id}`, freq: voos.length / 14, fareMult: (r.fare.y * 3 + r.fare.c) / 4,
    quality: (0.72 + 0.55 * s.airline.reputation) * (1 + Math.min(0.12, s.airline.marketing / 2.4e6)) *
      (comfort / voos.length) * (horario / voos.length), seats,
  }
}

export function CompetitorsView() {
  const { state } = useGame()
  const [onlyOverlap, setOnlyOverlap] = useState(false)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const mine = useMemo(() => new Set(state.airline.routes.filter(r => !r.cargo).map(r => odKey(r.from, r.to))), [state.airline.routes, state.airline.routes.length, state.day])
  const companies = useMemo(() => state.competitors.map(comp => ({
    comp, overlap: comp.routes.filter(r => mine.has(r.key)).length,
  })).sort((a, b) => b.overlap - a.overlap || b.comp.fleetSize - a.comp.fleetSize), [state.competitors, state.day, mine])
  const filtered = companies.filter(({ comp, overlap }) =>
    (!onlyOverlap || overlap > 0) &&
    `${comp.name} ${comp.code} ${comp.hub}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const selected = filtered.find(x => x.comp.id === picked)?.comp ?? filtered[0]?.comp
  /** Um modelo aberto por vez: dois abertos viram uma tela de rolagem. */
  const [modelo, setModelo] = useState<string | null>(null)
  const frota = selected ? frotaDaConcorrente(selected, state.startYear + state.day / 365) : []
  const routes = useMemo(() => {
    if (!selected) return []
    const doy = dayOfYear(state)
    return selected.routes.map(r => {
      const demand = baseDemand(r.from, r.to, state.day, doy)
      const competitors = state.competitors.flatMap(c => c.routes.filter(x => x.key === r.key).map(x => ofertaConcorrente(c, x)))
      const myRoute = state.airline.routes.find(x => !x.cargo && odKey(x.from, x.to) === r.key)
      const own = myRoute && ofertaJogador(state, myRoute)
      if (own) competitors.push(own)
      const allocation = allocateMarket(demand, competitors).find(x => x.id === selected.id)
      const supply = r.seats * r.freq * 2 * SELLABLE
      const passengers = allocation ? Object.values(allocation.pax).reduce((a, b) => a + b, 0) : 0
      return { r, demand, overlap: !!myRoute, load: Math.min(1, passengers / Math.max(1, supply)) }
    }).sort((a, b) => Number(b.overlap) - Number(a.overlap) || b.demand.total - a.demand.total)
  }, [selected, state, state.day, state.airline.routes.length])

  return <div className="grid" style={{ gap: 14 }}>
    <Card title="Companhias aéreas" right={<span className="muted">{state.competitors.length} no mercado</span>}>
      <p className="muted" style={{ marginTop: 0 }}>Compare malha, frota, frequência, tarifas e lotação estimada com as outras companhias.</p>
      <div className="row tight" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <input aria-label="Buscar companhia" placeholder="Buscar companhia, código ou base" value={query} onChange={e => setQuery(e.target.value)} />
        <label className="row tight"><input type="checkbox" checked={onlyOverlap} onChange={e => setOnlyOverlap(e.target.checked)} /> Só rotas que disputo</label>
      </div>
      <div className="competitors-layout">
        <div className="competitors-list" aria-label="Lista de companhias">
          {filtered.length ? filtered.map(({ comp, overlap }) =>
            <button key={comp.id} className={selected?.id === comp.id ? 'on' : ''} onClick={() => setPicked(comp.id)}>
              <span className="competitor-mark" style={{ background: comp.color }} />
              <span><b>{comp.name}</b><small>{comp.code} · {comp.hub} · {comp.routes.length} rotas · {comp.fleetSize} aviões</small></span>
              {overlap > 0 && <strong>{overlap}</strong>}
            </button>
          ) : <Empty>Nenhuma companhia corresponde ao filtro.</Empty>}
        </div>
        <div className="competitors-detail">
          {selected ? <>
            <h3>{selected.name} <small className="muted">{selected.code}</small>{state.airline.codeshares?.includes(selected.id) && <small className="good"> · codeshare ativo</small>}</h3>
            <div className="grid g4" style={{ gap: 10 }}>
              <div><small className="muted">Base</small><br /><b>{selected.hub} · {AIRPORT_BY_IATA[selected.hub]?.city}</b></div>
              <div><small className="muted">Aeronaves</small><br /><b>{selected.fleetSize}</b></div>
              <div><small className="muted">Rotas comigo</small><br /><b>{routes.filter(x => x.overlap).length}</b></div>
              <div><small className="muted">Reputação</small><br /><b>{pct(selected.reputation)}</b></div>
            </div>
            {/*
              * Com o que ela voa, e onde.
              *
              * A tela dizia "118 aviões" e parava aí — um número sem nenhuma
              * consequência para quem decide em que par entrar. Uma companhia
              * de 118 jatos regionais em etapa curta e uma de 118 widebody são
              * adversárias completamente diferentes, e é o modelo que diz qual
              * das duas está do outro lado.
              *
              * Clicar no modelo abre as rotas dele. A rival não tem matrícula:
              * a frota sai da malha, pelo avião que leva a oferta de cada rota,
              * alcança a etapa, pousa nas duas pistas e gasta menos por
              * assento — ver `frotaDaConcorrente`.
              */}
            <h4 className="sub" style={{ marginTop: 14 }}>Frota</h4>
            {frota.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>Sem malha: a companhia ainda não voa.</p> : (
              <div className="rolagem-x"><table className="compacta">
                <thead><tr><th>Modelo</th><th className="r">Aviões</th><th className="r">Rotas</th><th className="r">Assentos/dia</th><th>Onde voa</th></tr></thead>
                <tbody>{frota.map(l => <Fragment key={l.typeId}>
                  <tr className="click" onClick={() => setModelo(m => m === l.typeId ? null : l.typeId)}>
                    <td><b>{l.nome}</b> <small className="muted">{modelo === l.typeId ? '▾' : '▸'}</small></td>
                    <td className="r"><b>{num(l.avioes)}</b></td>
                    <td className="r muted">{num(l.rotas)}</td>
                    <td className="r muted">{num(l.assentosDia)}</td>
                    <td><small className="muted">{l.trechos.slice(0, 3).map(t => `${t.from}–${t.to}`).join(' · ')}{l.trechos.length > 3 ? ` +${l.trechos.length - 3}` : ''}</small></td>
                  </tr>
                  {modelo === l.typeId && <tr><td colSpan={5} style={{ background: 'var(--sky-1)' }}>
                    <table className="compacta">
                      <thead><tr><th>Rota</th><th className="r">Distância</th><th className="r">Voos/dia</th><th className="r">Lugares</th></tr></thead>
                      <tbody>{l.trechos.map(t => <tr key={t.key}>
                        <td><b>{t.from} → {t.to}</b> <span className="muted">{AIRPORT_BY_IATA[t.to]?.city}</span></td>
                        <td className="r muted">{km(distanceBetween(t.from, t.to))}</td>
                        <td className="r">{num(t.freq)}</td>
                        <td className="r muted">{num(t.seats)}</td>
                      </tr>)}</tbody>
                    </table>
                  </td></tr>}
                </Fragment>)}</tbody>
              </table></div>
            )}
            <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
              A rival não tem matrícula: a frota sai da malha dela. Para cada rota entra o modelo que leva a
              oferta, alcança o destino com a pista das duas pontas e gasta menos por assento; as caudas são
              repartidas por hora de voo.
            </p>

            <h4 className="sub" style={{ marginTop: 14 }}>Malha</h4>
            <div className="rolagem-x"><table>
              <thead><tr><th>Rota</th><th className="r">Voos/dia por sentido</th><th className="r">Lugares/voo</th><th className="r">Lotação estimada</th><th className="r">Tarifa econômica</th><th className="r">Executiva</th></tr></thead>
              <tbody>{routes.map(({ r, demand, overlap, load }) => {
                const currency = moedaDoPais(AIRPORT_BY_IATA[r.from].cc)
                return <tr key={r.key} className={overlap ? 'competitor-overlap' : ''}>
                  <td><b>{r.from} → {r.to}</b>{overlap && <small className="good"> · disputa sua rota</small>}<br /><small className="muted">{AIRPORT_BY_IATA[r.to]?.city}</small>
                    {state.airline.codeshares?.includes(selected.id) && state.airline.codeshareNumbers?.[`${selected.id}:${r.key}`] &&
                      <small className="good"> · vendido como {state.airline.code}{state.airline.codeshareNumbers[`${selected.id}:${r.key}`]}</small>}</td>
                  <td className="r">{r.freq}</td><td className="r">{num(r.seats)}</td>
                  <td className="r">{pct(load)}</td>
                  <td className="r">{tarifa(demand.refFare * r.fare, currency)}</td>
                  <td className="r">{tarifa(demand.refFare * CLASS_FARE_MULT.c * r.fare, currency)}</td>
                </tr>
              })}</tbody>
            </table></div>
            <p className="muted" style={{ fontSize: 11 }}>A lotação é estimada com demanda atual, oferta e tarifas de todas as companhias nesta rota.</p>
          </> : <Empty>Selecione uma companhia.</Empty>}
        </div>
      </div>
    </Card>
  </div>
}
