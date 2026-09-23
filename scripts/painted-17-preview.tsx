import { createRoot } from 'react-dom/client'
import { AIRCRAFT_BY_ID } from '../src/game/data/aircraft'
import { AircraftArt } from '../src/livery/AircraftArt'
import { LIVERY_PRESETS } from '../src/livery/presets'
import '../src/styles.css'

const ids = [
  'an148', 'an158', 'il96', 'sj100', 'tu204',
  'atr72f', 'b737f', 'a321f', 'b752f', 'tu204f', 'b763f',
  'a332f', 'il96f', 'b748f', 'an124', 'an225', 'belugaxl',
]
const livery = LIVERY_PRESETS.find(p => p.name === 'Bandeirante')!.livery

createRoot(document.getElementById('root')!).render(
  <main style={{ width: 1320, margin: '0 auto', padding: '22px 28px 30px', background: '#0e1523', color: '#e8eef9' }}>
    <h1 style={{ margin: '0 0 4px', fontSize: 28 }}>Pintura simulada · 17 aeronaves</h1>
    <p style={{ margin: '0 0 18px', color: '#a5b4ca' }}>Prévia gerada pelo renderizador do jogo com o preset Bandeirante. Não altera sua partida.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {ids.map(id => <section key={id} data-painted-model={id} style={{ padding: '8px 12px 10px', border: '1px solid #334155', borderRadius: 12, background: '#162235' }}>
        <strong style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>{AIRCRAFT_BY_ID[id].name} <span style={{ color: '#91a6c5' }}>· {id}</span></strong>
        <div className="plane-frame" style={{ margin: 0 }}>
          <AircraftArt type={AIRCRAFT_BY_ID[id]} livery={livery} titles="AERO BRASIL" registration="PR-BRA" flagCC="BR" />
        </div>
      </section>)}
    </div>
  </main>,
)
