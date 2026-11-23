import { useState } from 'react'
import { acLabel, AIRCRAFT_BY_ID } from '../../game/data/aircraft'
import { AIRPORT_BY_IATA } from '../../game/data/airports'
import { dowOf, km } from '../../game/engine'
import { DIA, DOW_CURTO, SEMANA, hhmm, naSemana } from '../../game/escala'
import type { GroundWindow } from '../../game/hubFlights'
import { useGame } from '../../store/useGame'
import { usePlanningQuery } from '../usePlanningQuery'
import { Card } from './Bits'
import { lastPage, Pagination } from './Pagination'

const FLIGHTS_PER_PAGE = 12

export function HubFlights({ id, bases, onBaseChange }: {
  id: string
  bases?: string[]
  onBaseChange?: (id: string) => void
}) {
  const { state } = useGame()
  const furthestOnly = !!bases
  const [selection, setSelection] = useState({ base: id, page: 0 })
  const currentPage = selection.base === id ? selection.page : 0
  const plan = usePlanningQuery({ query: 'flights', hub: id, dow: dowOf(state), furthestOnly })
  const trips = plan?.opportunities ?? []
  const ground = furthestOnly ? plan?.groundOnly ?? [] : []
  const total = trips.length + ground.length
  const page = Math.min(currentPage, lastPage(total, FLIGHTS_PER_PAGE))
  const first = page * FLIGHTS_PER_PAGE
  const end = first + FLIGHTS_PER_PAGE
  const time = (utc: number, airport = id) => {
    const local = naSemana(utc + AIRPORT_BY_IATA[airport].fuso)
    return `${DOW_CURTO[Math.floor(local / DIA)]} ${hhmm(local)}`
  }
  const window = (option: GroundWindow) => option.until - option.available === SEMANA
    ? 'Toda a semana'
    : `${time(option.available)} até ${time(option.until)}`
  const aircraft = (option: GroundWindow) => <><b>{option.ac.reg}</b><br /><small>{acLabel(AIRCRAFT_BY_ID[option.ac.typeId])}</small></>

  return <Card title={`Aeronaves com janela em ${id}`} right={bases && (
    <label className="field" style={{ margin: 0 }}>
      <span>Base</span>
      <select aria-label="Base para consultar aeronaves" value={id} onChange={event => {
        onBaseChange?.(event.target.value)
      }}>
        {bases.map(base => <option key={base} value={base}>{base} — {AIRPORT_BY_IATA[base].city}</option>)}
      </select>
    </label>
  )}>
    {plan === undefined ? <p className="muted" role="status">Calculando janelas de voo…</p>
      : plan === null ? <p className="bad" role="status">Não foi possível calcular as janelas de voo.</p>
      : total === 0 ? <p className="muted">Nenhuma aeronave tem janela para ida e volta ou continuação da malha nesta base nos próximos 7 dias.</p>
      : <>
        <p className="dim">
          {furthestOnly
            ? 'Maior distância viável por aeronave nos próximos 7 dias. As demais linhas mostram a maior janela em solo de cada aeronave que ficou sem encaixe.'
            : 'Janelas da malha programada para os próximos 7 dias. O destino mais distante considera alcance, pista, toque de recolher, slots e o próximo voo da aeronave.'}
        </p>
        <div className="rolagem-x"><table aria-label="Janelas das aeronaves">
          <thead><tr><th>Aeronave</th><th>Disponível na base</th><th>Destino mais distante</th><th>Horário local</th></tr></thead>
          <tbody>
            {trips.slice(first, end).map(option => <tr key={`${option.ac.id}-${option.available}`}>
              <td>{aircraft(option)}</td>
              <td>{window(option)}</td>
              <td><b>{option.to}</b> · {AIRPORT_BY_IATA[option.to].city} · {km(option.distance)}
                {option.needsRoute && <><br /><small className="muted">Requer abrir a rota</small></>}</td>
              <td>Sai {time(option.departure)}<br />{option.roundTrip ? 'Volta ao hub' : `Continua em ${option.to}`} {time(option.arrival, option.roundTrip ? id : option.to)}</td>
            </tr>)}
            {ground.slice(Math.max(0, first - trips.length), Math.max(0, end - trips.length)).map(option => <tr key={option.ac.id}>
              <td>{aircraft(option)}</td>
              <td>{window(option)}</td>
              <td colSpan={2} className="muted">{plan.fullAtBase ? 'Base sem slots livres na semana' : 'Em solo, sem voo adicional que caiba na janela e nos slots'}</td>
            </tr>)}
          </tbody>
        </table></div>
        <Pagination label="Páginas de aeronaves disponíveis" page={page} size={FLIGHTS_PER_PAGE} total={total} onChange={page => setSelection({ base: id, page })} />
      </>}
  </Card>
}
