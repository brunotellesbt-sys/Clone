import { useMemo, useState } from 'react'
import { AIRPORTS, AIRPORT_BY_IATA, CONTINENTE_LABEL, ESCOPO_LABEL, temNomeOficial } from '../game/data/airports'
import { suggestAirlineName, suggestCode } from '../game/data/names'
import { LIVERY_PRESETS } from '../livery/presets'
import { AIRCRAFT_BY_ID } from '../game/data/aircraft'
import { newGame, money, num, START_CASH, metros } from '../game/engine'
import { makeRng } from '../game/rng'
import type { GameState } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { BuscaAeroporto } from './components/BuscaAeroporto'
import { MapView } from './MapView'

/**
 * Atalhos para quem não quer procurar: os maiores de cada continente.
 *
 * Não são os únicos possíveis — **qualquer** um dos 3.085 aeroportos serve de
 * base, e é por isso que a escolha é no mapa e não numa lista suspensa. Antes
 * a lista só aceitava degrau 3 para cima, o que deixava Santos Dumont, Congonhas
 * e todo aeroporto regional de fora sem nenhuma razão de jogo.
 */
const ATALHOS = ['GRU', 'GIG', 'SDU', 'CGH', 'BSB', 'LIS', 'MIA', 'JFK', 'LHR', 'DXB', 'NRT', 'SYD']

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
    <div className="wrap start">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <span className="eyebrow">Nova companhia</span>
          <h1 className="titulo">Escolha de onde tudo começa</h1>
          <p className="dim" style={{ margin: '6px 0 0', maxWidth: 560 }}>
            {money(START_CASH)} em caixa, um certificado de operador e nenhum avião.
            A base define quem você alcança no primeiro ano — e quem vai brigar com você por isso.
          </p>
        </div>
        {onCancel && <button className="btn" onClick={onCancel}>Voltar</button>}
      </div>

      <div className="split">
        <div className="grid" style={{ gap: 14 }}>
          <div className="card flush">
            <MapView
              state={preview} height={452} selected={hub} onPick={setHub}
              showCompetitors={false} focus={hub} picking
            />
          </div>

          <div className="card">
            <h3>Base principal</h3>
            <BuscaAeroporto
              placeholder="procure por sigla, cidade ou país — SDU, Recife, Portugal…"
              onPick={setHub}
              atalhos={
                <div className="row tight" style={{ marginTop: 10 }}>
                  {ATALHOS.map((i) => (
                    <button
                      key={i}
                      className={`btn sm ${i === hub ? 'primary' : ''}`}
                      onClick={() => setHub(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              }
            />
            <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
              Vale qualquer um dos {num(AIRPORTS.length)} aeroportos do jogo: clique no mapa,
              aproxime com a roda para os menores aparecerem, ou procure aqui.
            </p>
          </div>
        </div>

        <div className="grid" style={{ gap: 14 }}>
          <div className="card base-card">
            <h3>{ap.city}</h3>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <b style={{ fontSize: 30, letterSpacing: '-0.03em' }}>{ap.iata}</b>
              <span className="chip">{['—', 'regional', 'secundário', 'nacional', 'internacional', 'mega-hub'][ap.tier]}</span>
            </div>
            {temNomeOficial(ap) && (
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{ap.official}</div>
            )}
            <div className="fatos">
              <div><b>{num(ap.paxDia)}</b><span>pax/dia (pico)</span></div>
              <div><b>{metros(ap.runway)}</b><span>pista</span></div>
              <div><b>{num(ap.elev)} ft</b><span>elevação</span></div>
              <div><b>{ap.slots}</b><span>slots/dia</span></div>
            </div>
            <div className="row" style={{ marginTop: 11 }}>
              <span className={`chip ${ap.escopo === 'int' ? '' : 'grey'}`}>{ESCOPO_LABEL[ap.escopo]}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {ap.escopo === 'dom' && 'só voo doméstico — sem alfândega'}
                {ap.escopo === 'reg' && `doméstico e internacional dentro da ${CONTINENTE_LABEL[ap.cont]}`}
                {ap.escopo === 'int' && 'sem limite de destino'}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
              Base grande tem mais demanda e mais concorrência. Pista curta ou alta limita
              a aeronave: é a mesma conta que o jogo faz ao abrir rota.
            </p>
          </div>

          <div className="card">
            <h3>Identidade</h3>
            <label className="field">
              <span>Nome</span>
              <input type="text" value={name} maxLength={26} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Código</span>
              <input type="text" value={code} maxLength={3} style={{ width: 110 }}
                onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
          </div>

          <div className="card">
            <h3>Pintura inicial</h3>
            <div className="plane-frame" style={{ marginBottom: 10 }}>
              <AircraftArt
                type={AIRCRAFT_BY_ID.a320} livery={livery} titles={name} registration={code}
                flagCC={ap.cc}
              />
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
            className="btn primary grande cta"
            disabled={!name.trim() || code.length < 2}
            onClick={() => onStart(newGame({ name: name.trim(), code, hub, livery: structuredClone(livery) }))}
          >
            Decolar de {hub}
          </button>
        </div>
      </div>
    </div>
  )
}
