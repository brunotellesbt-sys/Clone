import { useState } from 'react'
import { acLabel, AIRCRAFT_BY_ID } from '../game/data/aircraft'
import {
  getSubstituteMap,
  setAircraftReserve,
  setReserveCountForModel,
  suggestedReserveCount,
} from '../game/reserve'
import { useGame } from '../store/useGame'
import { Bar, Card, Empty, Kpi } from './components/Bits'
import { LiveryEditor } from './LiveryEditor'

type SubTab = 'reserva' | 'pintura'

export function MaintenanceView() {
  const { state, act, toast } = useGame()
  const [subTab, setSubTab] = useState<SubTab>('reserva')

  const fleet = state.airline.fleet
  const substituteMap = getSubstituteMap(state, state.day)

  // Identifica todos os modelos presentes na frota
  const uniqueTypeIds = Array.from(new Set(fleet.map((a) => a.typeId)))

  const totalActive = fleet.filter((a) => !a.isReserve).length
  const totalReserve = fleet.filter((a) => a.isReserve).length
  const totalGrounded = fleet.filter((a) => a.groundedUntil > state.day).length

  // Mapeamento reverso para saber quem está substituindo quem
  const substitutingReverseMap = new Map<string, string>()
  for (const [groundedId, reserveAc] of substituteMap.entries()) {
    const groundedAc = fleet.find((a) => a.id === groundedId)
    if (groundedAc) {
      substitutingReverseMap.set(reserveAc.id, groundedAc.reg)
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* Navegação entre Reserva de Manutenção e Pintura */}
      <div className="nav" style={{ margin: 0, padding: '6px 12px' }}>
        <button
          className={subTab === 'reserva' ? 'on' : ''}
          onClick={() => setSubTab('reserva')}
        >
          🛠️ Reserva e Manutenção
        </button>
        <button
          className={subTab === 'pintura' ? 'on' : ''}
          onClick={() => setSubTab('pintura')}
        >
          🎨 Pintura da Frota
        </button>
      </div>

      {subTab === 'pintura' ? (
        <LiveryEditor />
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {/* Indicadores gerais de manutenção e reserva */}
          <div className="grid g4">
            <Card className="tight">
              <Kpi label="Total na Frota" value={`${fleet.length}`} hint="aeronaves" />
            </Card>
            <Card className="tight">
              <Kpi label="Frota em Escala" value={`${totalActive}`} hint="operando voos" />
            </Card>
            <Card className="tight">
              <Kpi
                label="Alocadas em Reserva"
                value={`${totalReserve}`}
                tone={totalReserve > 0 ? 'good' : undefined}
                hint="prontas para substituição"
              />
            </Card>
            <Card className="tight">
              <Kpi
                label="Em Manutenção Hoje"
                value={`${totalGrounded}`}
                tone={totalGrounded > 0 ? 'warn' : undefined}
                hint="hangar / revisão"
              />
            </Card>
          </div>

          <Card
            title="Gestão da Reserva de Manutenção"
            right={
              <span className="muted" style={{ fontSize: 12 }}>
                Substituição automática em voos
              </span>
            }
          >
            <p className="dim" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.5 }}>
              Aeronaves alocadas na <b>reserva</b> ficam de prontidão em solo. Quando uma cauda
              da malha entra em manutenção pesada, a aeronave reserva do mesmo modelo assume
              temporariamente os voos até o fim da manutenção. Depois disso, ela retorna ao
              pool de reserva.
            </p>

            {fleet.length === 0 ? (
              <Empty>Nenhuma aeronave na frota. Compre ou arrende aeronaves no mercado.</Empty>
            ) : (
              <div className="grid" style={{ gap: 16 }}>
                {uniqueTypeIds.map((typeId) => {
                  const model = AIRCRAFT_BY_ID[typeId]
                  const modelFleet = fleet.filter((a) => a.typeId === typeId)
                  const reserves = modelFleet.filter((a) => a.isReserve)
                  const active = modelFleet.filter((a) => !a.isReserve)
                  const suggested = suggestedReserveCount(state, typeId)

                  return (
                    <div
                      key={typeId}
                      className="card tight"
                      style={{
                        background: 'var(--panel-bg-soft, rgba(255,255,255,0.02))',
                        border: '1px solid var(--line)',
                        padding: 12,
                        borderRadius: 8,
                      }}
                    >
                      <div
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <b style={{ fontSize: 15 }}>{acLabel(model)}</b>
                          <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                            Total: {modelFleet.length} · Ativas: {active.length} · Reserva:{' '}
                            {reserves.length}
                          </span>
                        </div>

                        <div className="row tight" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <span
                            className="chip"
                            style={{
                              background:
                                reserves.length === suggested
                                  ? 'rgba(52, 211, 153, 0.15)'
                                  : 'rgba(255, 181, 71, 0.15)',
                              borderColor:
                                reserves.length === suggested ? 'var(--green)' : 'var(--amber)',
                              color: 'inherit',
                              fontSize: 12,
                            }}
                          >
                            Sugestão do jogo: <b>{suggested}</b> {suggested === 1 ? 'reserva' : 'reservas'}
                          </span>

                          {reserves.length !== suggested && (
                            <button
                              className="btn sm primary"
                              onClick={() => {
                                const err = act((s) =>
                                  setReserveCountForModel(s, typeId, suggested),
                                )
                                if (err) toast(err, 'error')
                                else
                                  toast(
                                    `Reserva de ${acLabel(model)} ajustada para a sugestão (${suggested}).`,
                                  )
                              }}
                            >
                              Aplicar sugestão ({suggested})
                            </button>
                          )}

                          <button
                            className="btn sm"
                            disabled={active.length === 0}
                            onClick={() => {
                              const err = act((s) =>
                                setReserveCountForModel(s, typeId, reserves.length + 1),
                              )
                              if (err) toast(err, 'error')
                            }}
                          >
                            + 1 Reserva
                          </button>

                          <button
                            className="btn sm"
                            disabled={reserves.length === 0}
                            onClick={() => {
                              const err = act((s) =>
                                setReserveCountForModel(s, typeId, reserves.length - 1),
                              )
                              if (err) toast(err, 'error')
                            }}
                          >
                            - 1 Reserva
                          </button>
                        </div>
                      </div>

                      <div className="scroll">
                        <table style={{ width: '100%', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Matrícula</th>
                              <th className="r">Idade</th>
                              <th className="r">Estado</th>
                              <th>Status do Voo / Reserva</th>
                              <th className="r">Alocação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modelFleet.map((a) => {
                              const isGrounded = a.groundedUntil > state.day
                              const substitutingReg = substitutingReverseMap.get(a.id)

                              return (
                                <tr key={a.id}>
                                  <td>
                                    <b>{a.reg}</b>
                                    {a.leased && (
                                      <span className="chip grey sm" style={{ marginLeft: 6 }}>
                                        arrendado
                                      </span>
                                    )}
                                  </td>
                                  <td className="r">{a.age.toFixed(1)} a</td>
                                  <td className="r" style={{ minWidth: 80 }}>
                                    <Bar
                                      value={a.condition}
                                      tone={a.condition < 0.4 ? '#fb7185' : undefined}
                                    />
                                  </td>
                                  <td>
                                    {a.isReserve ? (
                                      isGrounded ? (
                                        <span className="chip bad">Manutenção (Reserva)</span>
                                      ) : substitutingReg ? (
                                        <span className="chip good">
                                          Substituindo <b>{substitutingReg}</b>
                                        </span>
                                      ) : (
                                        <span className="chip info">Em Reserva (Disponível)</span>
                                      )
                                    ) : isGrounded ? (
                                      <span className="chip bad">
                                        Em Manutenção
                                        {substituteMap.has(a.id) ? ' (Substituído)' : ' (Sem reserva)'}
                                      </span>
                                    ) : (
                                      <span className="chip grey">Ativa na Malha</span>
                                    )}
                                  </td>
                                  <td className="r">
                                    {a.isReserve ? (
                                      <button
                                        className="btn sm"
                                        onClick={() => {
                                          const err = act((s) => setAircraftReserve(s, a.id, false))
                                          if (err) toast(err, 'error')
                                        }}
                                      >
                                        Remover da Reserva
                                      </button>
                                    ) : (
                                      <button
                                        className="btn sm primary"
                                        onClick={() => {
                                          const err = act((s) => setAircraftReserve(s, a.id, true))
                                          if (err) toast(err, 'error')
                                        }}
                                      >
                                        Alocar na Reserva
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
