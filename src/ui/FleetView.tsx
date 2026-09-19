import { SeatMapEditor } from './SeatMapEditor'
import { useCabine } from './useCabine'
import { SOURCE_2D } from '../livery/aircraft2d'
import { seatChangeCost } from '../game/seatModels'
import { useState } from 'react'
import { AIRCRAFT_BY_ID, acLabel, ehCargueiro } from '../game/data/aircraft'
import { ENGINES, engineLabel } from '../game/data/engines'
import {
  abreastOf, cabinLength, checkCabin, crewFor, LAYOUTS,
  limiteDaClasse, passoMaximo, PITCH_RANGE, pitchFare, pitchName, rowLayout, rowsOf, sumSeats,
} from '../game/cabin'
import { CLASS_FARE_MULT } from '../game/demand'
import { resaleValue, sumCabins } from '../game/economy'
import {
  apagarCabine, assignAircraft, cabinesDoModelo, km, modelOf, money, num, pct, salvarCabine,
  sellAircraft, setCabin, typeOf, unassignAircraft,
} from '../game/engine'
import { useGame } from '../store/useGame'
import { CABIN_LABEL, CABINS, type Aircraft } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { Bar, Card, Empty, Modal } from './components/Bits'
import { Grade } from './components/Grade'
import { pernasDe, quebrasDe } from '../game/escala'

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
                    <tr key={a.id} className={`click ${sel?.id === a.id ? 'on' : ''}`} onClick={() => setSelId(a.id)}>
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
                          : <button className="btn sm" onClick={(e) => { e.stopPropagation(); setConfig(a) }}>Cabine</button>}
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
                <div><span className="muted">Comissários</span><br />{crewFor(sel.seats)}</div>
                <div><span className="muted">Passo econômica</span><br />{sel.pitch.y}″ · {pitchName('y', sel.pitch.y)}</div>
                <div>
                  <span className="muted">Valor</span><br />
                  {sel.leased ? `${money(sel.lease)}/mês` : money(resaleValue(typeOf(sel), sel.age, sel.condition))}
                </div>
              </div>
            </Card>

            <Card title="Escala da semana">
              <Grade ac={sel} />
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
                  {state.airline.routes.map((r) => (
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

/**
 * Montar a cabine de uma aeronave.
 *
 * Três decisões desta tela têm razão de ser, e todas vieram de o jogador bater
 * nelas:
 *
 * - **os controles não passam do que cabe.** Antes iam até `maxSeats` em toda
 *   classe e o jogo só reclamava no botão — dava para arrastar as quatro até o
 *   talo, ler "não cabe" e ter que desfazer tudo no tato. Dizer não depois de
 *   deixar tentar é a pior das duas respostas;
 * - **o passo também trava.** Esticar o passo com as fileiras já postas estoura
 *   a cabine do mesmo jeito. Quem quer mais espaço tira assento antes, que é a
 *   decisão que a tela existe para cobrar;
 * - **a cabine montada se guarda com nome.** Montar quatro classes é demorado,
 *   e repetir isso a cada avião comprado é trabalho jogado fora.
 */
function CabinModal({ ac, onClose }: { ac: Aircraft; onClose: () => void }) {
  const { state, act, toast } = useGame()
  const t = AIRCRAFT_BY_ID[ac.typeId]
  const { seats, pitch, seatConfig, aplicar, setAssentos, setPasso, carregar } =
    useCabine(t, { seats: ac.seats, pitch: ac.pitch, seatConfig: ac.seatConfig ?? {} })
  const [nome, setNome] = useState('')

  const chk = checkCabin(t, seats, pitch, seatConfig)
  const total = sumSeats(seats)
  const inches = cabinLength(t)
  const salvas = cabinesDoModelo(state, ac.typeId)

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

      <h4 className="sub">Partir de um padrão</h4>
      <div className="row tight" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {LAYOUTS.map((l) => (
          <button key={l.id} className="btn sm" title={l.note}
            onClick={() => carregar({ ...l.build(t), seatConfig: {} })}>
            {l.name}
          </button>
        ))}
      </div>

      {salvas.length > 0 && (
        <>
          <h4 className="sub">Suas configurações para o {t.name}</h4>
          <div className="row tight" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {salvas.map((cb) => (
              <span key={cb.id} className="salva">
                <button className="btn sm" title={`${sumSeats(cb.seats)} assentos`}
                  onClick={() => carregar(cb)}>
                  {cb.nome} <span className="muted">{sumSeats(cb.seats)}</span>
                </button>
                <button className="btn sm ghost" title="apagar" aria-label={`Apagar ${cb.nome}`}
                  onClick={() => act((s) => apagarCabine(s, cb.id))}>×</button>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="scroll cabine-tabela">
        <table className="cabine">
          <thead>
            <tr>
              <th>Classe</th><th className="r">Fileira</th><th>Assentos</th>
              <th>Passo</th><th className="r">Fileiras</th>
              <th className="r">Ocupa</th><th className="r">Tarifa</th>
            </tr>
          </thead>
          <tbody>
            {CABINS.map((c) => {
              const [min] = PITCH_RANGE[c]
              const rows = seats[c] > 0 ? rowsOf(t, seats, c, seatConfig) : 0
              /**
               * O teto mostrado é o **alcançável**, não o livre agora: nas
               * classes da frente ele conta com a econômica cedendo espaço, que
               * é o que o controle faz. Mostrar "cabem 0" numa executiva que o
               * próprio controle consegue pôr seria mentira da tela.
               */
              const tetoAssentos = c === 'y'
                ? limiteDaClasse(t, seats, pitch, c, seatConfig)
                : limiteDaClasse(t, { ...seats, y: 0 }, pitch, c, seatConfig)
              const tetoPasso = passoMaximo(t, seats, pitch, c, seatConfig)
              return (
                <tr key={c}>
                  <td><b>{CABIN_LABEL[c]}</b><br /><small className="muted">{pitchName(c, pitch[c])}</small></td>
                  <td className="r muted">{rowLayout(t, c, seatConfig)}</td>
                  <td>
                    <div className="campo">
                      <input
                        type="range" min={0} max={Math.max(tetoAssentos, seats[c])}
                        step={abreastOf(t, c, seatConfig)}
                        value={seats[c]} onChange={(e) => setAssentos(c, +e.target.value)}
                      />
                      <input aria-label={`Assentos na ${CABIN_LABEL[c]}`} type="number"
                        min={0} max={tetoAssentos} step={1} value={seats[c]}
                        onChange={(e) => setAssentos(c, +e.target.value)} />
                    </div>
                    {/* O teto fica à vista: controle que para sem dizer por que
                        parou parece travado, e não limitado. */}
                    <small className="muted">cabem {tetoAssentos}</small>
                  </td>
                  <td>
                    <div className="campo">
                      <input type="range" min={min} max={Math.max(tetoPasso, pitch[c])}
                        value={pitch[c]} onChange={(e) => setPasso(c, +e.target.value)} />
                      <b>{pitch[c]}″</b>
                    </div>
                    <small className="muted">até {tetoPasso}″</small>
                  </td>
                  <td className="r">{rows || '—'}</td>
                  <td className="r">{rows ? `${((rows * pitch[c]) / 39.37).toFixed(1)} m` : '—'}</td>
                  <td className="r">{(CLASS_FARE_MULT[c] * pitchFare(c, pitch[c])).toFixed(2)}×</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="resumo-cabine">
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
        <div className="grid" style={{ gap: 8 }}>
          <div className="row tight">
            <input type="text" placeholder="nome da configuração" maxLength={32}
              aria-label="Nome da configuração" value={nome} onChange={(e) => setNome(e.target.value)} />
            <button className="btn sm" disabled={!chk.ok || !nome.trim()}
              onClick={() => {
                const err = act((s) => salvarCabine(s, ac.typeId, nome, seats, pitch, seatConfig))
                if (err) toast(err, 'error')
                else { toast(`"${nome.trim()}" guardada para o ${t.name}.`, 'info'); setNome('') }
              }}>
              Salvar
            </button>
          </div>
          <button
            className="btn primary"
            disabled={!chk.ok || total === 0}
            onClick={() => {
              const err = act((s) => setCabin(s, ac.id, seats, pitch, seatConfig))
              if (err) toast(err, 'error')
              else onClose()
            }}
          >
            Reconfigurar
          </button>
        </div>
      </div>
      <p className="dim">Custo da reforma: <b>{money(seatChangeCost(seats, seatConfig))}</b> · {seats.c + seats.f > 0 ? 4 : 2} dias parado.</p>
      {chk.seatError && <p className="bad">{chk.seatError}</p>}
      {SOURCE_2D[t.id] && (
        <SeatMapEditor type={t} seats={seats} pitch={pitch} config={seatConfig}
          change={(c, p) => aplicar({ seats, pitch: p, config: c })} />
      )}
    </Modal>
  )
}
