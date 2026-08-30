import { useMemo, useState } from 'react'
import { AIRCRAFT, acLabel, FAMILY_OF, type AircraftType } from '../game/data/aircraft'
import { engineLabel, type Engine } from '../game/data/engines'
import { cabinLength, defaultCabin, rowLayout, sumSeats } from '../game/cabin'
import { leaseMonthly, marketPrice } from '../game/economy'
import { buyAircraft, money, num } from '../game/engine'
import { enginesOf, withEngine } from '../game/spec'
import { useGame } from '../store/useGame'
import { AircraftArt } from '../livery/AircraftArt'
import { Card } from './components/Bits'

const FAMILY_LABEL: Record<string, string> = {
  turboprop: 'Turboélice', regional: 'Regional', narrowbody: 'Corredor único', widebody: 'Fuselagem larga',
}

export function MarketView() {
  const { state, act, toast } = useGame()
  const [selId, setSelId] = useState('a320neo')
  const [fam, setFam] = useState('todos')
  const [engineId, setEngineId] = useState<string | null>(null)
  const year = state.startYear + state.day / 365

  const model = AIRCRAFT.find((a) => a.id === selId) ?? AIRCRAFT[0]
  const options = enginesOf(model)
  const chosen = options.find((e) => e.id === engineId) ?? options[0]
  const sel = withEngine(model, chosen?.id)

  const list = useMemo(() => AIRCRAFT.filter((a) => fam === 'todos' || a.family === fam), [fam])

  function pick(t: AircraftType) {
    setSelId(t.id)
    setEngineId(null)
  }

  function acquire(lease: boolean) {
    const err = act((s) => buyAircraft(s, model.id, lease, { engineId: chosen?.id }))
    if (err) toast(err, 'error')
  }

  const price = marketPrice(sel)
  const lease = leaseMonthly(sel)
  const available = year >= sel.since
  const cabin = defaultCabin(model, 1)

  return (
    <div className="split">
      <Card
        title="Catálogo"
        right={
          <div className="row tight">
            {['todos', 'turboprop', 'regional', 'narrowbody', 'widebody'].map((f) => (
              <button key={f} className={`btn sm ${fam === f ? 'primary' : ''}`} onClick={() => setFam(f)}>
                {f === 'todos' ? 'Todos' : FAMILY_LABEL[f]}
              </button>
            ))}
          </div>
        }
      >
        <div className="scroll" style={{ maxHeight: 560 }}>
          <table>
            <thead>
              <tr>
                <th>Modelo</th><th>Família</th><th className="r">Máx.</th><th className="r">Fileira</th>
                <th className="r">Alcance</th><th className="r">Pista</th><th className="r">Consumo</th><th className="r">Preço</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const ok = year >= a.since
                return (
                  <tr key={a.id} className={`click ${model.id === a.id ? 'on' : ''}`} onClick={() => pick(a)}>
                    <td>
                      <b>{acLabel(a)}</b>
                      {!ok && <span className="chip bad" style={{ marginLeft: 6 }}>{a.since}</span>}
                    </td>
                    <td className="muted">{FAMILY_OF[a.id] ?? ''}</td>
                    <td className="r">{a.maxSeats}</td>
                    <td className="r">{rowLayout(a, 'y')}</td>
                    <td className="r">{num(a.range)} nm</td>
                    <td className="r">{num(a.runway)} ft</td>
                    <td className="r">{num(a.burn)} kg/h</td>
                    <td className="r">{money(marketPrice(a))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid" style={{ gap: 14 }}>
        <Card
          title={acLabel(model)}
          right={<span className="chip grey">{FAMILY_OF[model.id] ?? FAMILY_LABEL[model.family]}</span>}
        >
          <div className="plane-frame" style={{ marginBottom: 12 }}>
            <AircraftArt
              type={sel} livery={state.airline.livery}
              titles={state.airline.name} registration={state.airline.code}
            />
          </div>
          <div className="grid g2" style={{ gap: 8, fontSize: 13 }}>
            <div><span className="muted">Alcance</span><br />{num(sel.range)} nm</div>
            <div><span className="muted">Velocidade</span><br />{num(sel.speed)} kt</div>
            <div><span className="muted">Pista</span><br />{num(sel.runway)} ft</div>
            <div><span className="muted">Consumo</span><br />{num(sel.burn)} kg/h</div>
            <div><span className="muted">Limite de saídas</span><br />{model.maxSeats} passageiros</div>
            <div><span className="muted">Econômica</span><br />{rowLayout(model, 'y')}</div>
            <div><span className="muted">Executiva</span><br />{rowLayout(model, 'c')}</div>
            <div><span className="muted">Cabine útil</span><br />{(cabinLength(model) / 39.37).toFixed(1)} m</div>
          </div>
        </Card>

        {options.length > 0 && (
          <Card
            title="Motorização"
            right={
              <span className="muted" style={{ fontSize: 12 }}>
                {options.length === 1 ? 'motor único' : `${options.length} opções de fábrica`}
              </span>
            }
          >
            <div className="grid" style={{ gap: 8 }}>
              {options.map((e) => (
                <EngineOption key={e.id} engine={e} on={chosen?.id === e.id} year={year} onPick={() => setEngineId(e.id)} />
              ))}
            </div>
          </Card>
        )}

        <Card title="Aquisição">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="dim">Compra à vista</span><b className="num">{money(price)}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="dim">Arrendamento</span>
            <b className="num">{money(lease)}/mês <span className="muted" style={{ fontWeight: 400 }}>+ 2 meses de caução</span></b>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Entra com {sumSeats(cabin.seats)} assentos
            {cabin.seats.c > 0 ? `, ${cabin.seats.c} na executiva` : ', em classe única'}. A cabine
            se remonta depois, na tela da frota.
          </p>
          <div className="row">
            <button className="btn primary" disabled={!available || state.airline.cash < price} onClick={() => acquire(false)}>
              Comprar
            </button>
            <button className="btn" disabled={!available || state.airline.cash < lease * 2} onClick={() => acquire(true)}>
              Arrendar
            </button>
          </div>
          {!available && (
            <p className="bad" style={{ fontSize: 12, marginBottom: 0 }}>Disponível a partir de {sel.since}.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function EngineOption({
  engine, on, year, onPick,
}: { engine: Engine; on: boolean; year: number; onPick: () => void }) {
  const later = year < engine.since
  const d = (v: number, higherIsBetter = false) => {
    const p = (v - 1) * 100
    if (Math.abs(p) < 0.4) return <span className="muted">igual</span>
    const good = higherIsBetter ? p > 0 : p < 0
    return <b className={good ? 'good' : 'bad'}>{p > 0 ? '+' : ''}{p.toFixed(1)}%</b>
  }
  return (
    <button type="button" className={`opt ${on ? 'on' : ''}`} disabled={later} onClick={onPick}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b>{engineLabel(engine)}</b>
        {later ? (
          <span className="chip bad">a partir de {engine.since}</span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            {num(engine.thrust)} lbf · fan {engine.fan.toFixed(2)} m
          </span>
        )}
      </div>
      <div className="row tight" style={{ gap: 12, fontSize: 12, margin: '5px 0' }}>
        <span className="muted">consumo {d(engine.burn)}</span>
        <span className="muted">oficina {d(engine.maint)}</span>
        <span className="muted">alcance {d(engine.range, true)}</span>
        <span className="muted">ruído {d(engine.noise)}</span>
        {engine.price !== 0 && (
          <span className="muted">preço {engine.price > 0 ? '+' : ''}{engine.price} M</span>
        )}
      </div>
      <small className="dim">{engine.note}</small>
    </button>
  )
}
