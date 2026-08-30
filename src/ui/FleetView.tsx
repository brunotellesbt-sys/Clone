import { useState } from 'react'
import { AIRCRAFT_BY_ID, acLabel } from '../game/data/aircraft'
import { ENGINES, engineLabel } from '../game/data/engines'
import {
  abreastOf, cabinLength, checkCabin, clampPitch, crewFor, LAYOUTS, PITCH_RANGE,
  pitchFare, pitchName, rowLayout, rowsOf, sumSeats,
} from '../game/cabin'
import { CLASS_FARE_MULT } from '../game/demand'
import { resaleValue, sumCabins } from '../game/economy'
import { assignAircraft, modelOf, money, num, pct, sellAircraft, setCabin, typeOf, unassignAircraft } from '../game/engine'
import { useGame } from '../store/useGame'
import { CABIN_LABEL, CABINS, type Aircraft, type Cabins } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { Bar, Card, Empty, Modal } from './components/Bits'

export function FleetView() {
  const { state, act, toast } = useGame()
  const [selId, setSelId] = useState<string | null>(null)
  const [config, setConfig] = useState<Aircraft | null>(null)
  const fleet = state.airline.fleet
  const sel = fleet.find((a) => a.id === selId) ?? fleet[0] ?? null

  return (
    <div className="split">
      <Card title={`Frota (${fleet.length})`}>
        {fleet.length === 0 ? (
          <Empty>Nenhuma aeronave. Compre ou arrende no mercado.</Empty>
        ) : (
          <div className="scroll" style={{ maxHeight: 560 }}>
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th><th>Modelo</th><th>Motor</th><th className="r">Cabine</th>
                  <th className="r">Idade</th><th className="r">Estado</th><th>Rota</th><th></th>
                </tr>
              </thead>
              <tbody>
                {fleet.map((a) => {
                  const t = modelOf(a)
                  const eng = ENGINES[a.engineId]
                  const route = state.airline.routes.find((r) => r.id === a.routeId)
                  const grounded = a.groundedUntil > state.day
                  const premium = [a.seats.f && `${a.seats.f}F`, a.seats.c && `${a.seats.c}C`, a.seats.w && `${a.seats.w}W`]
                    .filter(Boolean).join(' ')
                  return (
                    <tr key={a.id} className={`click ${sel?.id === a.id ? 'on' : ''}`} onClick={() => setSelId(a.id)}>
                      <td><b>{a.reg}</b>{a.leased && <span className="chip grey" style={{ marginLeft: 6 }}>arrendado</span>}</td>
                      <td>{acLabel(t)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{eng?.name ?? '—'}</td>
                      <td className="r">
                        {sumCabins(a.seats)}{' '}
                        <span className="muted" style={{ fontSize: 11 }}>{premium || 'classe única'}</span>
                      </td>
                      <td className="r">{a.age.toFixed(1)} a</td>
                      <td className="r" style={{ minWidth: 78 }}>
                        <Bar value={a.condition} tone={a.condition < 0.4 ? '#fb7185' : undefined} />
                      </td>
                      <td>
                        {grounded ? <span className="chip bad">hangar</span> : route ? `${route.from}–${route.to}` : <span className="muted">parado</span>}
                      </td>
                      <td className="r">
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); setConfig(a) }}>Cabine</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid" style={{ gap: 14 }}>
        {sel && (
          <>
            <Card title={`${acLabel(modelOf(sel))} · ${sel.reg}`}>
              <div className="plane-frame" style={{ marginBottom: 12 }}>
                <AircraftArt type={typeOf(sel)} livery={state.airline.livery} titles={state.airline.name} registration={sel.reg} />
              </div>
              <div className="grid g2" style={{ gap: 8, fontSize: 13 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="muted">Motorização</span><br />
                  {ENGINES[sel.engineId] ? engineLabel(ENGINES[sel.engineId]) : '—'}
                </div>
                <div><span className="muted">Horas de voo</span><br />{num(sel.hours)} h</div>
                <div><span className="muted">Ciclos</span><br />{num(sel.cycles)}</div>
                <div><span className="muted">Estado</span><br />{pct(sel.condition)}</div>
                <div><span className="muted">Idade</span><br />{sel.age.toFixed(1)} anos</div>
                <div><span className="muted">Alcance</span><br />{num(typeOf(sel).range)} nm</div>
                <div><span className="muted">Comissários</span><br />{crewFor(sel.seats)}</div>
                <div><span className="muted">Passo econômica</span><br />{sel.pitch.y}″ · {pitchName('y', sel.pitch.y)}</div>
                <div>
                  <span className="muted">Valor</span><br />
                  {sel.leased ? `${money(sel.lease)}/mês` : money(resaleValue(typeOf(sel), sel.age, sel.condition))}
                </div>
              </div>
            </Card>

            <Card title="Alocação">
              <label className="field">
                <span>Rota</span>
                <select
                  value={sel.routeId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    const err = act((s) => (v ? assignAircraft(s, sel.id, v) : (unassignAircraft(s, sel.id), null)))
                    if (err) toast(err, 'error')
                  }}
                >
                  <option value="">— sem rota —</option>
                  {state.airline.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.from} → {r.to} ({num(r.distance)} nm)
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn danger"
                onClick={() => {
                  const err = act((s) => sellAircraft(s, sel.id))
                  if (err) toast(err, 'error')
                  else setSelId(null)
                }}
              >
                {sel.leased ? 'Devolver ao arrendador' : `Vender por ${money(resaleValue(typeOf(sel), sel.age, sel.condition))}`}
              </button>
            </Card>
          </>
        )}
      </div>

      {config && <CabinModal ac={config} onClose={() => setConfig(null)} />}
    </div>
  )
}

function CabinModal({ ac, onClose }: { ac: Aircraft; onClose: () => void }) {
  const { act, toast } = useGame()
  const t = AIRCRAFT_BY_ID[ac.typeId]
  const [seats, setSeats] = useState<Cabins>({ ...ac.seats })
  const [pitch, setPitch] = useState<Cabins>(clampPitch(ac.pitch))

  const chk = checkCabin(t, seats, pitch)
  const total = sumSeats(seats)
  const inches = cabinLength(t)

  const set = (k: keyof Cabins, v: number) => setSeats((s) => ({ ...s, [k]: Math.max(0, Math.round(v)) }))
  const setP = (k: keyof Cabins, v: number) => setPitch((p) => ({ ...p, [k]: Math.round(v) }))

  // Quanto a configuração rende, em "assentos econômicos padrão".
  const units = CABINS.reduce((sum, c) => sum + seats[c] * CLASS_FARE_MULT[c] * pitchFare(c, pitch[c]), 0)
  const denseRows = Math.floor((inches - 90) / 28)
  const denseUnits = Math.min(denseRows * t.abreast, t.maxSeats) * pitchFare('y', 28)

  return (
    <Modal wide title={`Cabine do ${acLabel(t)} · ${ac.reg}`} onClose={onClose}>
      <p className="dim" style={{ marginTop: 0 }}>
        A cabine do {t.name} tem <b>{(inches / 39.37).toFixed(1)} m</b> úteis e limite de saídas de{' '}
        <b>{t.maxSeats} passageiros</b>. Cada fileira come o passo que você escolher: passo maior
        rende mais por assento e leva menos gente. É a conta que a companhia faz de verdade.
      </p>

      <div className="row tight" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {LAYOUTS.map((l) => (
          <button
            key={l.id} className="btn sm" title={l.note}
            onClick={() => {
              const built = l.build(t)
              setSeats(built.seats)
              setPitch(built.pitch)
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Classe</th><th>Fileira</th><th style={{ minWidth: 130 }}>Assentos</th>
            <th style={{ minWidth: 130 }}>Passo</th><th className="r">Fileiras</th>
            <th className="r">Ocupa</th><th className="r">Tarifa</th>
          </tr>
        </thead>
        <tbody>
          {CABINS.map((c) => {
            const [min, , max] = PITCH_RANGE[c]
            const rows = seats[c] > 0 ? rowsOf(t, seats, c) : 0
            return (
              <tr key={c}>
                <td><b>{CABIN_LABEL[c]}</b><br /><small className="muted">{pitchName(c, pitch[c])}</small></td>
                <td className="muted">{rowLayout(t, c)}</td>
                <td>
                  <input
                    type="range" min={0} max={t.maxSeats} step={abreastOf(t, c)}
                    value={seats[c]} onChange={(e) => set(c, +e.target.value)}
                  />
                  <b>{seats[c]}</b>
                </td>
                <td>
                  <input type="range" min={min} max={max} value={pitch[c]} onChange={(e) => setP(c, +e.target.value)} />
                  <b>{pitch[c]}″</b>
                </td>
                <td className="r">{rows || '—'}</td>
                <td className="r">{rows ? `${((rows * pitch[c]) / 39.37).toFixed(1)} m` : '—'}</td>
                <td className="r">{(CLASS_FARE_MULT[c] * pitchFare(c, pitch[c])).toFixed(2)}×</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="grid g2" style={{ gap: 16, alignItems: 'center' }}>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span className={chk.overLength ? 'bad' : 'dim'}>
              {(chk.used / 39.37).toFixed(1)} m de {(inches / 39.37).toFixed(1)} m
            </span>
            <span className={chk.overLimit ? 'bad' : 'dim'}>{total} de {t.maxSeats} passageiros</span>
          </div>
          <Bar value={chk.used / inches} tone={chk.overLength ? '#fb7185' : undefined} />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
            <span className="dim">Comissários exigidos</span><b>{crewFor(seats)}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <span className="dim">Receita com o avião cheio</span>
            <b className={units >= denseUnits ? 'good' : 'bad'}>
              {denseUnits > 0 ? `${units >= denseUnits ? '+' : ''}${((units / denseUnits - 1) * 100).toFixed(0)}%` : '—'}
              <span className="muted" style={{ fontWeight: 400 }}> vs. alta densidade</span>
            </b>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn primary"
            disabled={!chk.ok || total === 0}
            onClick={() => {
              const err = act((s) => setCabin(s, ac.id, seats, pitch))
              if (err) toast(err, 'error')
              else onClose()
            }}
          >
            Reconfigurar
          </button>
        </div>
      </div>
      {chk.overLength && <p className="bad" style={{ fontSize: 12, marginBottom: 0 }}>Não cabe: tire assentos ou reduza o passo.</p>}
      {chk.overLimit && <p className="bad" style={{ fontSize: 12, marginBottom: 0 }}>Acima do limite de saídas de emergência do modelo.</p>}
    </Modal>
  )
}
