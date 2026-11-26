import { CabinModal } from './CabinModal'
import { SEAT_BY_ID } from '../game/seatModels'
import { useState } from 'react'
import { acLabel, ehCargueiro } from '../game/data/aircraft'
import { AIRPORT_BY_IATA } from '../game/data/airports'
import { ENGINES, engineLabel } from '../game/data/engines'
import { motivoDoPar } from '../game/spec'
import { crewFor } from '../game/cabin'
import { resaleValue, sumCabins } from '../game/economy'
import {
  assignAircraft, km, modelOf, money, num, pct, sellAircraft, typeOf, unassignAircraft,
} from '../game/engine'
import { useGame } from '../store/useGame'
import type { Aircraft } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { Bar, Card, Empty } from './components/Bits'
import { Grade } from './components/Grade'
import { pernasDe, quebrasDe } from '../game/escala'
import {inspectionSummary} from '../game/groundInspection'

export function FleetView() {
  const { state, act, toast, setPlanningAircraftId } = useGame()
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
          <div className="scroll alta">
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th><th>Modelo</th><th>Motor</th><th className="r">Cabine</th>
                  <th className="r">Idade</th><th className="r">Estado</th><th>Escala</th><th></th>
                </tr>
              </thead>
              <tbody>
                {fleet.map((a) => {
                  const t = modelOf(a)
                  const eng = ENGINES[a.engineId]
                  const route = state.airline.routes.find((r) => r.id === a.routeId)
                  const voos = pernasDe(state, a.id).length
                  const quebrada = quebrasDe(state, a.id).length > 0
                  const grounded = a.groundedUntil > state.day
                  const premium = [a.seats.f && `${a.seats.f}F`, a.seats.c && `${a.seats.c}C`, a.seats.w && `${a.seats.w}W`]
                    .filter(Boolean).join(' ')
                  return (
                    <tr key={a.id} className={`click ${sel?.id === a.id ? 'on' : ''}`} onClick={() => { setSelId(a.id); setPlanningAircraftId(a.id) }}>
                      <td><b>{a.reg}</b>{a.leased && <span className="chip grey" style={{ marginLeft: 6 }}>arrendado</span>}</td>
                      <td>{acLabel(t)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{eng?.name ?? '—'}</td>
                      <td className="r">
                        {/* Cargueiro não tem cabine: o número que descreve ele é a carga paga. */}
                        {ehCargueiro(t) ? (
                          <>{t.payload} t <span className="muted" style={{ fontSize: 11 }}>carga</span></>
                        ) : (
                          <>{sumCabins(a.seats)}{' '}
                            <span className="muted" style={{ fontSize: 11 }}>{premium || 'classe única'}</span></>
                        )}
                      </td>
                      <td className="r">{a.age.toFixed(1)} a</td>
                      <td className="r" style={{ minWidth: 78 }}>
                        <Bar value={a.condition} tone={a.condition < 0.4 ? '#fb7185' : undefined} />
                      </td>
                      <td>
                        {grounded ? (
                          <span className="chip bad">hangar</span>
                        ) : a.isReserve ? (
                          <span className="chip info">reserva</span>
                        ) : voos === 0 ? (
                          <span className="muted">parado</span>
                        ) : (
                          <>
                            {route ? `${route.from}–${route.to}` : <span title="circula por mais de uma rota">malha</span>}
                            <span className="muted" style={{ fontSize: 11 }}> · {voos} voos</span>
                            {quebrada && <span className="alerta" title="a escala da semana não fecha"> ⚠</span>}
                          </>
                        )}
                      </td>
                      <td className="r">
                        {ehCargueiro(t)
                          ? <span className="muted" style={{ fontSize: 11 }}>sem cabine</span>
                          : <button className="btn sm" onClick={(e) => { e.stopPropagation(); setPlanningAircraftId(a.id); setConfig(a) }}>Cabine</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid" style={{ gap: 14 }} onFocusCapture={() => { if (sel) setPlanningAircraftId(sel.id) }}>
        {sel && (
          <>
            <Card title={`${acLabel(modelOf(sel))} · ${sel.reg}`}>
              <div className="plane-frame" style={{ marginBottom: 12 }}>
                <AircraftArt
                  type={typeOf(sel)} engineId={sel.engineId}
                  livery={state.airline.livery} titles={state.airline.name} registration={sel.reg}
                  flagCC={sel.cc}
                />
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
                <div><span className="muted">Alcance</span><br />{km(typeOf(sel).range)}</div>
                {ehCargueiro(typeOf(sel)) ? (
                  <div><span className="muted">Carga útil</span><br />{typeOf(sel).payload} t</div>
                ) : (
                  <>
                    <div><span className="muted">Comissários</span><br />{crewFor(sel.seats)}</div>
                    <div><span className="muted">Poltrona econômica</span><br />{sel.pitch.y}″ · {SEAT_BY_ID[sel.seatConfig?.y?.style ?? '']?.name ?? 'Padrão'}</div>
                  </>
                )}
                <div>
                  <span className="muted">Valor</span><br />
                  {sel.leased ? `${money(sel.lease)}/mês` : money(resaleValue(typeOf(sel), sel.age, sel.condition))}
                </div>
              </div>
            </Card>

            <Card title="Escala da semana">
              <Grade ac={sel} />
              {(()=>{const summary=inspectionSummary(state,sel.id);return <p className="muted" style={{fontSize:12}}>Inspeções em solo: {summary.stops} paradas de pelo menos 2h na semana · redução média do desgaste por voo: {pct(summary.averageReduction,1)}. Benefício inicial de 5%, +2,5 pontos a cada 30 min completos, limitado a 65%. A manutenção pesada continua necessária.</p>})()}
              <label className="field" style={{ marginTop: 12 }}>
                <span>Dedicar a uma rota — monta ida e volta nos sete dias</span>
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    const err = act((s) => (v ? assignAircraft(s, sel.id, v) : (unassignAircraft(s, sel.id), null)))
                    if (err) toast(err, 'error')
                  }}
                >
                  <option value="">— escolher rota —</option>
                  {state.airline.routes.filter((r) => {
                    const t = typeOf(sel)
                    return !!r.cargo === ehCargueiro(t) && r.distance <= t.range &&
                      !motivoDoPar(t, AIRPORT_BY_IATA[r.from], AIRPORT_BY_IATA[r.to])
                  }).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.from} → {r.to} ({km(r.distance)})
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" style={{ marginBottom: 10 }} onClick={() => act((s) => unassignAircraft(s, sel.id))}>
                Esvaziar a escala
              </button>
              <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
                Para a cauda circular — sair do Rio, pousar em Fortaleza e emendar para Congonhas —
                marque voo a voo na tela de rotas. Aqui ela só recebe a escala pronta de um par.
              </p>
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
