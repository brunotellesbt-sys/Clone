import { useMemo, useState } from 'react'
import { AIRPORTS, AIRPORT_BY_IATA, CONTINENTE_LABEL, ESCOPO_LABEL, temNomeOficial } from '../game/data/airports'
import { suggestAirlineName, suggestCode } from '../game/data/names'
import { LIVERY_PRESETS } from '../livery/presets'
import { AIRCRAFT_BY_ID } from '../game/data/aircraft'
import { EMBLEMS } from '../livery/emblems'
import type { EmblemId, Livery } from '../game/types'
import { DENSIDADES, DENSIDADE_PADRAO, paisesDe } from '../game/ai'
import { vagasDoMundo } from '../game/mundo'
import type { Densidade } from '../game/types'
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
  const [densidade, setDensidade] = useState<Densidade>(DENSIDADE_PADRAO)
  const [emblem, setEmblem] = useState<EmblemId>('none')
  const [emblemCor, setEmblemCor] = useState('#ffffff')
  // O crachá atrás do emblema é o que dá contraste com a deriva. Sem ele aqui,
  // um emblema branco numa deriva clara sumia na fundação e só aparecia no
  // editor, depois — e quem escolheu a cor foi o jogador, não o preset.
  const [emblemFundo, setEmblemFundo] = useState('#1d4ed8')
  const [emblemTam, setEmblemTam] = useState<Livery['emblemSize']>('medium')
  const [bandeira, setBandeira] = useState(true)
  const ap = AIRPORT_BY_IATA[hub]
  /**
   * O mundo escolhido, contado das próprias vagas em vez de deduzido dos
   * cortes: duas fontes de verdade para a mesma regra viram uma regra e um
   * defeito no dia em que a primeira mudar.
   */
  const mundo = useMemo(() => {
    const vagas = vagasDoMundo(paisesDe(densidade), ap.cc)
    return {
      total: Math.max(0, vagas.length - 1),
      // uma das vagas do país é a do jogador
      emCasa: Math.max(0, vagas.filter((v) => v.cc === ap.cc).length - 1),
    }
  }, [ap.cc, densidade])
  /**
   * A pintura da fundação é o preset **mais o que o jogador escolheu aqui**.
   *
   * Antes era só o preset, e o resto — emblema, cor dele, bandeira do prefixo —
   * só existia no editor, depois de fundada a companhia. Emblema e bandeira são
   * identidade, não acabamento: quem funda uma companhia decide isso antes de
   * pintar o primeiro avião, não meses depois.
   */
  const livery: Livery = useMemo(() => ({
    ...LIVERY_PRESETS[preset].livery,
    emblem,
    emblemColor: emblemCor,
    emblemAccent: emblemFundo,
    emblemSize: emblemTam,
    flag: bandeira,
  }), [preset, emblem, emblemCor, emblemFundo, emblemTam, bandeira])

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
              <div>
                <b>{num(ap.paxDia)}</b>
                <span title={ap.medido
                  ? 'movimento publicado do ano de pico'
                  : 'sem número publicado: estimado pela bacia, pelo degrau e pela pista, com erro típico de 2,5×'}>
                  pax/dia {ap.medido ? '(pico)' : '(estimado)'}
                </span>
              </div>
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
            <h3>Concorrência</h3>
            <div className="row tight" style={{ flexWrap: 'wrap' }}>
              {DENSIDADES.map((d) => (
                <button key={d.id} className={`btn sm ${d.id === densidade ? 'primary' : ''}`}
                  onClick={() => setDensidade(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
              {mundo.total} concorrentes no mundo — {DENSIDADES.find((d) => d.id === densidade)?.texto}.{' '}
              {/* O jogador precisa saber o que ele mesmo vai enfrentar em casa,
                  que é diferente do total: o número grande é o mundo, o pequeno
                  é a briga dele. */}
              {/* Sem preposição antes do país: "Em Brasil" e "Em Estados Unidos"
                  estão errados, e acertar o artigo de 233 países exigiria uma
                  tabela de gênero e número para ganhar meia palavra. */}
              {ap.country}: {mundo.emCasa === 0
                ? 'nenhum concorrente local'
                : `você disputa com ${mundo.emCasa} ${mundo.emCasa === 1 ? 'companhia' : 'companhias'} de casa`}.
            </p>
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
              O mundo não fica parado: de tempos em tempos alguém funda uma companhia
              nova onde há demanda sobrando — raro, e nunca antes de quinze anos de jogo.
            </p>
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
            <div className="grid g2" style={{ gap: 10, marginTop: 12 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span>Emblema da deriva</span>
                <select value={emblem} onChange={(e) => setEmblem(e.target.value)}>
                  {EMBLEMS.map((em) => <option key={em.id} value={em.id}>{em.label}</option>)}
                </select>
              </label>
              {emblem !== 'none' ? (
                <div className="grid g2" style={{ gap: 8 }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span>Cor</span>
                    <input type="color" aria-label="Cor do emblema" value={emblemCor}
                      onChange={(e) => setEmblemCor(e.target.value)} />
                  </label>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span>Fundo</span>
                    <input type="color" aria-label="Cor de destaque do emblema" value={emblemFundo}
                      onChange={(e) => setEmblemFundo(e.target.value)} />
                  </label>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span>Tamanho</span>
                    <select value={emblemTam}
                      onChange={(e) => setEmblemTam(e.target.value as Livery['emblemSize'])}>
                      <option value="small">Pequeno</option>
                      <option value="medium">Médio</option>
                      <option value="large">Grande</option>
                    </select>
                  </label>
                </div>
              ) : <div />}
            </div>
            <label className="row" style={{ marginTop: 10, gap: 8 }}>
              <input type="checkbox" checked={bandeira} onChange={(e) => setBandeira(e.target.checked)} />
              <span>Bandeira de {ap.country} ao lado do prefixo</span>
            </label>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}>
              Dá para redesenhar tudo depois, no editor de pintura — cores por peça, faixa,
              letreiro e as camadas de cada modelo.
            </p>
          </div>

          <button
            className="btn primary grande cta"
            disabled={!name.trim() || code.length < 2}
            onClick={() => onStart(newGame({
              name: name.trim(), code, hub, livery: structuredClone(livery), densidade,
            }))}
          >
            Decolar de {hub}
          </button>
        </div>
      </div>
    </div>
  )
}
