import { useMemo, useState } from 'react'
import { AIRPORTS, AIRPORT_BY_IATA } from '../game/data/airports'
import { suggestAirlineName, suggestCode } from '../game/data/names'
import { LIVERY_PRESETS } from '../livery/presets'
import { AIRCRAFT_BY_ID } from '../game/data/aircraft'
import { newGame, money, START_CASH } from '../game/engine'
import { makeRng } from '../game/rng'
import type { GameState } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { MapView } from './MapView'

const starters = AIRPORTS.filter((a) => a.tier >= 3).sort((a, b) => a.city.localeCompare(b.city))

export function NewGame({ onStart, onCancel }: { onStart: (s: GameState) => void; onCancel?: () => void }) {
  const rng = useMemo(() => makeRng(Date.now() % 100000), [])
  const [name, setName] = useState(() => suggestAirlineName(rng))
  const [code, setCode] = useState(() => suggestCode(rng))
  const [hub, setHub] = useState('GRU')
  const [preset, setPreset] = useState(0)
  const ap = AIRPORT_BY_IATA[hub]
  const livery = LIVERY_PRESETS[preset].livery

  const preview = useMemo(() => newGame({ name, code, hub, livery, seed: 1 }), [name, code, hub, livery])

  return (
    <div className="wrap" style={{ padding: '22px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, letterSpacing: '-0.03em' }}>Fundar uma companhia aérea</h1>
          <p className="dim" style={{ margin: '4px 0 0' }}>
            Você começa com {money(START_CASH)} em caixa, um certificado de operador e nenhum avião.
          </p>
        </div>
        {onCancel && <button className="btn" onClick={onCancel}>Voltar</button>}
      </div>

      <div className="split">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <MapView state={preview} height={430} selected={hub} onPick={(i) => AIRPORT_BY_IATA[i].tier >= 3 && setHub(i)} showCompetitors={false} focus={hub} />
        </div>

        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <h3>Identidade</h3>
            <label className="field">
              <span>Nome</span>
              <input type="text" value={name} maxLength={26} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="row">
              <label className="field" style={{ flex: '0 0 96px' }}>
                <span>Código</span>
                <input type="text" value={code} maxLength={3} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Base principal</span>
                <select value={hub} onChange={(e) => setHub(e.target.value)}>
                  {starters.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.city} — {a.iata} ({a.country})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              {ap.city}: {ap.pop.toFixed(1)} milhões de habitantes, pista de {ap.runway.toLocaleString('pt-BR')} ft,
              {' '}{ap.slots} slots por dia. Bases grandes têm mais demanda e mais concorrência.
            </p>
          </div>

          <div className="card">
            <h3>Pintura inicial</h3>
            <div className="plane-frame" style={{ marginBottom: 10 }}>
              <AircraftArt type={AIRCRAFT_BY_ID.a320} livery={livery} titles={name} registration={code} />
            </div>
            <div className="row tight">
              {LIVERY_PRESETS.map((p, i) => (
                <button key={p.name} className={`btn sm ${i === preset ? 'primary' : ''}`} onClick={() => setPreset(i)}>
                  {p.name}
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}>
              Dá para redesenhar tudo depois, no editor de pintura.
            </p>
          </div>

          <button
            className="btn primary"
            style={{ padding: '12px', fontSize: 15 }}
            disabled={!name.trim() || code.length < 2}
            onClick={() => onStart(newGame({ name: name.trim(), code, hub, livery: structuredClone(livery) }))}
          >
            Decolar
          </button>
        </div>
      </div>
    </div>
  )
}
