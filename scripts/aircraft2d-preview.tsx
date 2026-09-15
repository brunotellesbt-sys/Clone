import React from 'react'
import { createRoot } from 'react-dom/client'
import { AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { AircraftArt } from '../src/livery/AircraftArt'
import { SOURCE_2D } from '../src/livery/aircraft2d'
import { BLANK_LIVERY } from '../src/livery/presets'
import { aircraftPng } from '../src/livery/export'
import { SeatMapEditor } from '../src/ui/SeatMapEditor'
import '../src/styles.css'

const params = new URLSearchParams(location.search)
const ids = params.get('ids')?.split(',') ?? Object.keys(SOURCE_2D)
function App() {
  return <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
    {ids.map(id => <div key={id} data-type={id} className="plane-frame"><b>{id} · {AIRCRAFT_BY_ID[id].name}</b>
      <AircraftArt type={AIRCRAFT_BY_ID[id]} engineId={params.get('engine') ?? undefined} livery={{ ...BLANK_LIVERY, engine: '#22aaff', cheatStyle: 'none' }} titles="SKYLINE" registration="PT-ABC" flagCC="BR" />
    </div>)}
    {params.has('seats') && <SeatMapEditor type={AIRCRAFT_BY_ID.a359} seats={{ y: 160, w: 24, c: 16, f: 4 }} pitch={{ y: 31, w: 38, c: 76, f: 94 }} config={{ c: { style: 'biz_reverse_herringbone', layout: '1-2-1' }, f: { style: 'first_apartment', layout: '1-2-1' } }} change={() => {}} />}
  </div>
}
// Somente a página de QA expõe o exportador para conferir pixels do PNG no teste.
Object.assign(window, { qaAircraftPng: aircraftPng })
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
