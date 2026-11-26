import { useState } from 'react'
import { sumSeats } from '../game/cabin'
import { cabinesDoModelo, renomearCabine } from '../game/cabinProfiles'
import { acLabel, AIRCRAFT_BY_ID, ehCargueiro } from '../game/data/aircraft'
import { CABINS, CABIN_SHORT } from '../game/types'
import { useGame } from '../store/useGame'
import { CabinModal } from './CabinModal'
import { Card, Empty } from './components/Bits'

export function CabinReconfiguration() {
  const { state, act, toast, setPlanningAircraftId } = useGame()
  const [modelo, setModelo] = useState('')
  const [aeronave, setAeronave] = useState('')
  const [editando, setEditando] = useState('')
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null)

  const frota = state.airline.fleet.filter(ac => !ehCargueiro(AIRCRAFT_BY_ID[ac.typeId]))
  const modelos = [...new Set([...frota, ...(state.airline.cabines ?? [])].map(c => c.typeId))]
    .map(typeId => AIRCRAFT_BY_ID[typeId])
    .sort((a, b) => acLabel(a).localeCompare(acLabel(b), 'pt-BR'))
  const typeId = modelos.find(t => t.id === modelo)?.id ?? modelos[0]?.id
  const salvas = typeId ? cabinesDoModelo(state, typeId) : []
  const doModelo = frota.filter(ac => ac.typeId === typeId).sort((a, b) => a.reg.localeCompare(b.reg))
  const escolhida = doModelo.find(ac => ac.id === aeronave) ?? doModelo[0]
  const emEdicao = frota.find(ac => ac.id === editando)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Configurações salvas">
        <p className="muted">Cada configuração diferente é salva por modelo ao comprar, arrendar ou reconfigurar uma aeronave de passageiros.</p>
        {typeId ? (
          <label className="field">
            <span>Modelo da cabine</span>
            <select aria-label="Modelo da cabine" value={typeId} onChange={e => {
              setModelo(e.target.value)
              setRenomeando(null)
            }}>
              {modelos.map(t => <option key={t.id} value={t.id}>{acLabel(t)}</option>)}
            </select>
          </label>
        ) : <Empty>Nenhuma aeronave de passageiros ou configuração salva.</Empty>}
        {typeId && (salvas.length ? (
          <div className="scroll media">
            <table className="compacta cabin-profiles">
              <thead><tr><th>Configuração</th><th>Assentos por classe</th><th>Ação</th></tr></thead>
              <tbody>
                {salvas.map(c => (
                  <tr key={c.id}>
                    <td><b>{c.nome}</b></td>
                    <td>{CABINS.filter(classe => c.seats[classe] > 0)
                      .map(classe => `${c.seats[classe]}${CABIN_SHORT[classe]}`).join(' · ')}</td>
                    <td>
                      <button className="btn sm" aria-label={`Renomear ${c.nome}`} onClick={() => setRenomeando(c)}>
                        Renomear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Este modelo ainda não tem configurações salvas.</Empty>)}
        {renomeando && (
          <form className="row" onSubmit={e => {
            e.preventDefault()
            const err = act(s => renomearCabine(s, renomeando.id, renomeando.nome))
            if (err) toast(err, 'error')
            else setRenomeando(null)
          }}>
            <label className="field" style={{ flex: '1 1 180px', marginTop: 12 }}>
              <span>Novo nome da configuração</span>
              <input autoFocus maxLength={32} aria-label="Novo nome da configuração" value={renomeando.nome}
                onChange={e => setRenomeando({ id: renomeando.id, nome: e.target.value })} />
            </label>
            <button className="btn primary" disabled={!renomeando.nome.trim()}>Salvar nome</button>
            <button type="button" className="btn" onClick={() => setRenomeando(null)}>Cancelar</button>
          </form>
        )}
      </Card>
      {typeId && (
        <Card title="Reconfigurar cabine">
          {escolhida ? (
            <>
              <label className="field">
                <span>Aeronave da frota</span>
                <select aria-label="Aeronave da frota" value={escolhida.id} onChange={e => setAeronave(e.target.value)}>
                  {doModelo.map(ac => <option key={ac.id} value={ac.id}>{ac.reg} · {sumSeats(ac.seats)} assentos</option>)}
                </select>
              </label>
              <button className="btn primary" onClick={() => {
                setPlanningAircraftId(escolhida.id)
                setEditando(escolhida.id)
              }}>Editar cabine</button>
            </>
          ) : <Empty>Nenhuma aeronave deste modelo na frota.</Empty>}
        </Card>
      )}
      {emEdicao && <CabinModal ac={emEdicao} onClose={() => setEditando('')} />}
    </div>
  )
}
