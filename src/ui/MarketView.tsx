import { useMemo, useState } from 'react'
import { AIRCRAFT_ALL, acLabel, ehCargueiro, FAMILY_OF, type AircraftType } from '../game/data/aircraft'
import { AIRPORT_BY_IATA } from '../game/data/airports'
import { engineLabel, type Engine } from '../game/data/engines'
import {
  cabinComfort, cabinLength, defaultCabin, LAYOUTS, rowLayout, sumSeats,
} from '../game/cabin'
import { custoDeFabrica, SEAT_MODELS } from '../game/seatModels'
import { SOURCE_2D } from '../livery/aircraft2d'
import { SeatMapEditor } from './SeatMapEditor'
import { useCabine } from './useCabine'
import { leaseMonthly, marketPrice } from '../game/economy'
import {
  buyAircraft, cabinesDoModelo, km, metros, money, num, PRAZO_DO_ARRENDAMENTO,
} from '../game/engine'
import { enginesOf, withEngine } from '../game/spec'
import { useGame } from '../store/useGame'
import { AircraftArt } from '../livery/AircraftArt'
import { Card } from './components/Bits'
import { CabineTabela } from './components/CabineTabela'
import { CABINS, type Cabins, type SeatConfig } from '../game/types'

const FAMILY_LABEL: Record<string, string> = {
  turboprop: 'Turboélice', regional: 'Regional', narrowbody: 'Corredor único', widebody: 'Fuselagem larga',
  freighter: 'Cargueiro',
}

export function MarketView() {
  const { state, act, toast } = useGame()
  const [selId, setSelId] = useState('a320neo')
  const [fam, setFam] = useState('todos')
  const [query, setQuery] = useState('')
  const [engineId, setEngineId] = useState<string | null>(null)
  const year = state.startYear + state.day / 365

  const model = AIRCRAFT_ALL.find((a) => a.id === selId) ?? AIRCRAFT_ALL[0]
  const options = enginesOf(model)
  const chosen = options.find((e) => e.id === engineId) ?? options[0]
  const sel = withEngine(model, chosen?.id)

  const list = useMemo(() => {
    const term = query.toLowerCase().replace(/[^a-z0-9]/g, '')
    return AIRCRAFT_ALL.filter(a => (fam === 'todos' || a.family === fam) &&
      `${acLabel(a)} ${a.id} ${FAMILY_OF[a.id]}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(term))
  }, [fam, query])

  function pick(t: AircraftType) {
    setSelId(t.id)
    setEngineId(null)
  }

  const price = marketPrice(sel)
  const lease = leaseMonthly(sel)
  const available = year >= sel.since

  return (
    <div className="split">
      <Card
        title="Catálogo"
        right={
          <div className="row tight">
            {['todos', 'turboprop', 'regional', 'narrowbody', 'widebody', 'freighter'].map((f) => (
              <button key={f} className={`btn sm ${fam === f ? 'primary' : ''}`} onClick={() => setFam(f)}>
                {f === 'todos' ? 'Todos' : FAMILY_LABEL[f]}
              </button>
            ))}
          </div>
        }
      >
        <label className="row" style={{ marginBottom: 12 }}>Buscar aeronave
          <input aria-label="Buscar aeronave" type="search" placeholder="Nome, fabricante ou modelo" value={query} onChange={e => setQuery(e.target.value)} />
          <span className="muted">{list.length} {list.length === 1 ? 'modelo' : 'modelos'}</span>
        </label>
        <div className="scroll alta">
          <table>
            <thead>
              <tr>
                <th>Modelo</th><th>Família</th><th className="r">Máx. / carga</th><th className="r">Fileira</th>
                <th className="r">Alcance</th><th className="r">Pista</th><th className="r">Consumo</th><th className="r">Preço</th>
              </tr>
            </thead>
            <tbody>
              {!list.length && <tr><td colSpan={8} className="dim">Nenhuma aeronave corresponde à busca nesta categoria.</td></tr>}
              {list.map((a) => {
                const ok = year >= a.since
                return (
                  <tr key={a.id} className={`click ${model.id === a.id ? 'on' : ''}`} onClick={() => pick(a)}>
                    <td>
                      <b>{acLabel(a)}</b>
                      {!ok && <span className="chip bad" style={{ marginLeft: 6 }}>{a.since}</span>}
                    </td>
                    <td className="muted">{FAMILY_OF[a.id] ?? ''}</td>
                    {/* Cargueiro não tem assento nem fileira: o que o define é a carga paga. */}
                    <td className="r">{ehCargueiro(a) ? `${a.payload} t` : a.maxSeats}</td>
                    <td className="r">{ehCargueiro(a) ? '—' : rowLayout(a, 'y')}</td>
                    <td className="r">{km(a.range)}</td>
                    <td className="r">{metros(a.runwayMin)}</td>
                    <td className="r">{num(a.burn)} kg/h</td>
                    <td className="r">{money(marketPrice(a))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid" style={{ gap: 14 }}>
        <Card
          title={acLabel(model)}
          right={<span className="chip grey">{FAMILY_OF[model.id] ?? FAMILY_LABEL[model.family]}</span>}
        >
          <div className="plane-frame" style={{ marginBottom: 12 }}>
            <AircraftArt
              type={sel} engineId={chosen?.id} livery={state.airline.livery}
              titles={state.airline.name} registration={state.airline.code}
              flagCC={AIRPORT_BY_IATA[state.airline.hubs[0]]?.cc}
            />
          </div>
          <div className="grid g2" style={{ gap: 8, fontSize: 13 }}>
            <div><span className="muted">Alcance</span><br />{km(sel.range)}</div>
            <div><span className="muted">Velocidade</span><br />{num(sel.speed)} kt</div>
            <div><span className="muted">Pista mín.</span><br />{metros(sel.runwayMin)}</div>
            <div><span className="muted">Consumo</span><br />{num(sel.burn)} kg/h</div>
            {/* Um cargueiro não tem cabine: mostrar assento e fileira nele seria
                inventar número. O que descreve a peça é a carga paga. */}
            {ehCargueiro(model) ? (
              <>
                <div><span className="muted">Carga paga</span><br />{model.payload} t</div>
                <div><span className="muted">Cabine</span><br />sem cabine</div>
              </>
            ) : (
              <>
                <div><span className="muted">Limite de saídas</span><br />{model.maxSeats} passageiros</div>
                <div><span className="muted">Econômica</span><br />{rowLayout(model, 'y')}</div>
                <div><span className="muted">Executiva</span><br />{rowLayout(model, 'c')}</div>
                <div><span className="muted">Cabine útil</span><br />{(cabinLength(model) / 39.37).toFixed(1)} m</div>
              </>
            )}
          </div>
        </Card>

        {options.length > 0 && (
          <Card
            title="Motorização"
            right={
              <span className="muted" style={{ fontSize: 12 }}>
                {options.length === 1 ? 'motor único' : `${options.length} opções de fábrica`}
              </span>
            }
          >
            <div className="grid" style={{ gap: 8 }}>
              {options.map((e) => (
                <EngineOption key={e.id} engine={e} prop={model.shape.prop} on={chosen?.id === e.id} year={year} onPick={() => setEngineId(e.id)} />
              ))}
            </div>
          </Card>
        )}

        <Encomenda
          key={`${model.id}-${chosen?.id ?? ''}`}
          model={model} price={price} lease={lease} available={available} since={sel.since}
          onAcquire={(arrendar, cabine) => {
            const err = act((s) => buyAircraft(s, model.id, arrendar, { engineId: chosen?.id, cabine }))
            if (err) toast(err, 'error')
          }}
        />
      </div>
    </div>
  )
}


/**
 * Cabine de fábrica e aquisição, no mesmo componente porque são a mesma
 * decisão: o preço que aparece no botão depende do interior escolhido acima.
 *
 * O editor é o **mesmo** da tela da frota — foto da poltrona, distribuição da
 * fileira e mapa dos assentos. Quem compra um avião quer ver o que está
 * comprando, e duas telas de cabine com aparências diferentes seriam duas
 * telas para manter.
 */
function Encomenda({ model, price, lease, available, since, onAcquire }: {
  model: AircraftType; price: number; lease: number; available: boolean; since: number
  onAcquire: (lease: boolean, cabine?: { seats: Cabins; pitch: Cabins; seatConfig?: SeatConfig }) => void
}) {
  const { state } = useGame()
  const serie = useMemo(() => defaultCabin(model, 1), [model])
  const cab = useCabine(model, { ...serie, seatConfig: {} })
  const [mexeu, setMexeu] = useState(false)
  const salvas = cabinesDoModelo(state, model.id)
  const carga = ehCargueiro(model)

  const encomenda = { seats: cab.seats, pitch: cab.pitch, seatConfig: cab.seatConfig }
  // Só cobra interior de quem encomendou: a cabine de série já vem no preço.
  const extra = mexeu && !carga ? custoDeFabrica(cab.seats, cab.seatConfig) : 0
  const mostrada = mexeu ? encomenda : serie
  const conforto = cabinComfort(model, mostrada.seats, mostrada.pitch, mexeu ? cab.seatConfig : undefined)
  // O arrendador não cobra o interior à vista: ele dilui no contrato. Ver
  // `buyAircraft`, que é quem manda — aqui só se repete a conta para a tela.
  const mensal = lease + extra / PRAZO_DO_ARRENDAMENTO
  const comprar = (arrendar: boolean) => onAcquire(arrendar, mexeu && !carga ? encomenda : undefined)

  /**
   * Carrega um padrão já com a poltrona mais simples de cada classe escolhida.
   *
   * Os padrões do catálogo não nomeiam poltrona — eles dizem quantos assentos
   * e em que passo. Carregar um deles e deixar a poltrona em "configuração
   * atual do jogo" fazia a foto sumir e escondia justamente a escolha que esta
   * tela existe para oferecer. A mais barata da classe custa zero, então o
   * padrão continua saindo pelo mesmo preço — o que muda é ele ficar à vista.
   */
  const carregar = (b: { seats: Cabins; pitch: Cabins; seatConfig?: SeatConfig }) => {
    const cfg: SeatConfig = { ...b.seatConfig }
    for (const c of CABINS) {
      if (cfg[c]) continue
      const base = SEAT_MODELS.find((m) => m.cabin === c && m.minPitch <= b.pitch[c])
      if (base) cfg[c] = { style: base.id, layout: rowLayout(model, c) }
    }
    cab.carregar({ ...b, seatConfig: cfg })
    setMexeu(true)
  }

  return (
    <>
      {!carga && (
        <Card
          title="Cabine de fábrica"
          right={
            <span className="muted" style={{ fontSize: 12 }}>
              {sumSeats(mostrada.seats)} de {model.maxSeats}
            </span>
          }
        >
          {/*
            Escolher aqui sai mais barato do que escolher depois: as poltronas
            custam o mesmo, mas a reforma — 240 mil e dois a quatro dias de
            avião parado — só existe para quem recebe o interior de série e
            troca em seguida.
          */}
          <div className="lista-curta row tight" style={{ flexWrap: 'wrap' }}>
            <button className={`btn sm ${mexeu ? '' : 'primary'}`}
              onClick={() => { cab.carregar({ ...serie, seatConfig: {} }); setMexeu(false) }}>
              De série
            </button>
            {LAYOUTS.map((l) => (
              <button key={l.id} className="btn sm" title={l.note}
                onClick={() => carregar({ ...l.build(model), seatConfig: {} })}>
                {l.name}
              </button>
            ))}
            {salvas.map((c) => (
              <button key={c.id} className="btn sm" onClick={() => carregar(c)}>{c.nome}</button>
            ))}
          </div>

          <CabineTabela t={model} seats={cab.seats} pitch={cab.pitch} seatConfig={cab.seatConfig}
            setAssentos={(c, v) => { cab.setAssentos(c, v); setMexeu(true) }}
            setPasso={(c, v) => { cab.setPasso(c, v); setMexeu(true) }} />

          {SOURCE_2D[model.id] && (
            <SeatMapEditor
              type={model} seats={cab.seats} pitch={cab.pitch} config={cab.seatConfig}
              change={(c, p) => { cab.aplicar({ seats: cab.seats, pitch: p, config: c }); setMexeu(true) }}
            />
          )}

          <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 10 }}>
            Conforto desta cabine: <b>{(conforto * 100).toFixed(0)}</b> — passo e modelo de
            poltrona entram nele, e a média da frota puxa a reputação da companhia mês a mês.
            {' '}
            {mexeu
              ? `Interior encomendado: ${money(extra)}, cobrado junto com a aeronave. O avião entra voando — quem remonta depois paga a reforma e fica com a cauda parada.`
              : 'De série, o avião chega com a cabine padrão do modelo, sem custo de interior. Mexa em qualquer coisa acima para encomendar a sua.'}
          </p>
        </Card>
      )}

      <Card title="Aquisição">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="dim">Compra à vista</span><b className="num">{money(price + extra)}</b>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="dim">Arrendamento</span>
          <b className="num">{money(mensal)}/mês{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              + 2 meses de caução
              {extra > 0 ? ` · o interior entra na mensalidade, em ${PRAZO_DO_ARRENDAMENTO} meses` : ''}
            </span>
          </b>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          {carga
            ? `Leva até ${model.payload} t de carga paga e só voa em rota de carga.`
            : `Entra com ${sumSeats(mostrada.seats)} assentos${mostrada.seats.c > 0 ? `, ${mostrada.seats.c} na executiva` : ', em classe única'}. Dá para remontar depois, na tela da frota, pagando a reforma.`}
        </p>
        <div className="row">
          <button className="btn primary" disabled={!available || state.airline.cash < price + extra}
            onClick={() => comprar(false)}>
            Comprar
          </button>
          <button className="btn" disabled={!available || state.airline.cash < mensal * 2}
            onClick={() => comprar(true)}>
            Arrendar
          </button>
        </div>
        {!available && (
          <p className="bad" style={{ fontSize: 12, marginBottom: 0 }}>Disponível a partir de {since}.</p>
        )}
      </Card>
    </>
  )
}

function EngineOption({
  engine, prop, on, year, onPick,
}: { engine: Engine; prop: boolean; on: boolean; year: number; onPick: () => void }) {
  const later = year < engine.since
  const d = (v: number, higherIsBetter = false) => {
    const p = (v - 1) * 100
    if (Math.abs(p) < 0.4) return <span className="muted">igual</span>
    const good = higherIsBetter ? p > 0 : p < 0
    return <b className={good ? 'good' : 'bad'}>{p > 0 ? '+' : ''}{p.toFixed(1)}%</b>
  }
  return (
    <button type="button" className={`opt ${on ? 'on' : ''}`} disabled={later} onClick={onPick}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b>{engineLabel(engine)}</b>
        {later ? (
          <span className="chip bad">a partir de {engine.since}</span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            {num(engine.thrust)} {prop ? 'shp · hélice' : 'lbf · fan'} {engine.fan.toFixed(2)} m
          </span>
        )}
      </div>
      <div className="row tight" style={{ gap: 12, fontSize: 12, margin: '5px 0' }}>
        <span className="muted">consumo {d(engine.burn)}</span>
        <span className="muted">oficina {d(engine.maint)}</span>
        <span className="muted">alcance {d(engine.range, true)}</span>
        <span className="muted">ruído {d(engine.noise)}</span>
        {engine.price !== 0 && (
          <span className="muted">preço {engine.price > 0 ? '+' : ''}{engine.price} M</span>
        )}
      </div>
      <small className="dim">{engine.note}</small>
    </button>
  )
}
