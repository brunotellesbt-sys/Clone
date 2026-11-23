import { useState } from 'react'
import { acLabel, AIRCRAFT_BY_ID } from '../../game/data/aircraft'
import { AIRPORT_BY_IATA } from '../../game/data/airports'
import { dowOf, km } from '../../game/engine'
import { DIA, DOW_CURTO, SEMANA, hhmm, naSemana } from '../../game/escala'
import type { FlightOpportunity, GroundWindow } from '../../game/hubFlights'
import { useGame } from '../../store/useGame'
import { usePlanningQuery } from '../usePlanningQuery'
import { Card } from './Bits'
import { lastPage, Pagination } from './Pagination'

const FLIGHTS_PER_PAGE = 12

export function HubFlights({ id, inline = false }: { id: string; inline?: boolean }) {
  const { state } = useGame()
  const [selection, setSelection] = useState({ base: id, page: 0 })
  const currentPage = selection.base === id ? selection.page : 0
  const plan = usePlanningQuery({ query: 'flights', hub: id, dow: dowOf(state), furthestOnly: inline })
  const trips = plan?.opportunities ?? []
  const ground = inline ? plan?.groundOnly ?? [] : []
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

  const flightHours = (option: FlightOpportunity) => <>
    Sai {time(option.departure)}<br />
    {option.roundTrip ? 'Volta ao hub' : `Continua em ${option.to}`} {time(option.arrival, option.roundTrip ? id : option.to)}
  </>
  const title = `Aeronaves com janela em ${id}`
  const content = plan === undefined ? <p className="muted" role="status">Calculando janelas de voo…</p>
    : plan === null ? <p className="bad" role="status">Não foi possível calcular as janelas de voo.</p>
    : total === 0 ? <p className="muted">Nenhuma aeronave tem janela para ida e volta ou continuação da malha nesta base nos próximos 7 dias.</p>
    : <>
      <p className="dim">
        {inline
          ? 'Maior distância viável por aeronave nos próximos 7 dias. Horários locais.'
          : 'Janelas da malha programada para os próximos 7 dias. O destino mais distante considera alcance, pista, toque de recolher, slots e o próximo voo da aeronave.'}
      </p>
      <div className={inline ? 'scroll media' : 'rolagem-x'}><table aria-label="Janelas das aeronaves">
        <thead><tr>
          <th>Aeronave</th>
          {!inline && <th>Disponível na base</th>}
          <th>{inline ? 'Rota máxima' : 'Destino mais distante'}</th>
          {!inline && <th>Horário local</th>}
        </tr></thead>
        <tbody>
          {trips.slice(first, end).map(option => <tr key={`${option.ac.id}-${option.available}`}>
            <td>{aircraft(option)}{inline && <><br /><small className="muted">Em solo · {window(option)}</small></>}</td>
            {!inline && <td>{window(option)}</td>}
            <td>
              <b>{inline ? `${id} → ${option.to}` : option.to}</b> · {inline ? km(option.distance) : `${AIRPORT_BY_IATA[option.to].city} · ${km(option.distance)}`}
              {inline && <><br /><small>{flightHours(option)}</small></>}
              {option.needsRoute && <><br /><small className="muted">Requer abrir a rota</small></>}
            </td>
            {!inline && <td>{flightHours(option)}</td>}
          </tr>)}
          {ground.slice(Math.max(0, first - trips.length), Math.max(0, end - trips.length)).map(option => <tr key={option.ac.id}>
            <td>{aircraft(option)}<br /><small className="muted">Em solo · {window(option)}</small></td>
            <td className="muted">{plan.fullAtBase ? 'Base sem slots livres na semana' : 'Sem voo adicional que caiba na janela e nos slots'}</td>
          </tr>)}
        </tbody>
      </table></div>
      <Pagination label="Páginas de aeronaves disponíveis" page={page} size={FLIGHTS_PER_PAGE} total={total} onChange={page => setSelection({ base: id, page })} />
    </>

  return inline
    ? <section id="route-flight-windows" className="route-flight-windows" aria-labelledby="route-flight-windows-title">
        <h4 id="route-flight-windows-title">{title}</h4>
        {content}
      </section>
    : <Card title={title}>{content}</Card>
}
