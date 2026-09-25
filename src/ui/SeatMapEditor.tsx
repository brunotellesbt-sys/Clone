import type { AircraftType } from '../game/data/aircraft'
import { abreastOf, cabinComfort, comportaClasse, limiteDaClasse, passoMaximo, PITCH_RANGE, rowLayout, sumSeats } from '../game/cabin'
import { CABIN_LABEL, type CabinClass, type Cabins, type SeatConfig } from '../game/types'
import { apeloDaPoltrona, confortoDaPoltrona, rowCount, SEAT_BY_ID, seatModelsFor, seatLayouts } from '../game/seatModels'
import { money } from '../game/engine'
import { asset2d, use2d, type LibraryItem } from '../livery/aircraft2d'

const ORDER: CabinClass[] = ['f', 'c', 'w', 'y']

/** The same row graphics and chair photos that ship in the supplied APK. */
export function SeatMapEditor({ type, seats, pitch, config, change, setAssentos, setPasso }: {
  type: AircraftType
  seats: Cabins
  pitch: Cabins
  config?: SeatConfig
  change: (c: SeatConfig, p: Cabins) => void
  setAssentos: (c: CabinClass, n: number) => void
  setPasso: (c: CabinClass, n: number) => void
}) {
  const { data: library = [] } = use2d<LibraryItem[]>('library.json')
  const byName = new Map(library.map(a => [a.id, a]))
  const order = ORDER.filter(c => comportaClasse(type, c))
  const comfort = cabinComfort(type, seats, pitch, config)
  const reputationBonus = (value: number) => Math.min(0.12, Math.max(-0.06, (value - 1) * 0.55))
  return <section className="a2-cabin">
    <h3>Alocação de assentos</h3>
    <p className="dim">Monte a cabine por fileiras, da frente para o fundo. Escolha a poltrona, a distribuição e o espaço entre fileiras. O limite de saídas e o comprimento útil do avião são aplicados a cada mudança.</p>
    <div className="a2-cabin-planner">{order.map(c => {
      const selected = config?.[c]
      const model = SEAT_BY_ID[selected?.style ?? '']
      const photo = model && byName.get(`assets_seat_images_jpg_${model.id}.jpg`)
      const choices = seatLayouts(type, c, model?.id)
      const defaultLayout = rowLayout(type, c)
      const layout = selected?.layout && choices.includes(selected.layout) ? selected.layout :
        choices.includes(defaultLayout) ? defaultLayout : choices.at(-1)!
      const abreast = abreastOf(type, c, config)
      const rows = Math.ceil(seats[c] / abreast)
      const available = c === 'y'
        ? limiteDaClasse(type, seats, pitch, c, config)
        : limiteDaClasse(type, { ...seats, y: 0 }, pitch, c, config)
      const maxPitch = passoMaximo(type, seats, pitch, c, config)
      const gain = 0.4 * confortoDaPoltrona(model?.id, pitch[c], type, layout) *
        seats[c] / Math.max(1, sumSeats(seats)) * (0.96 + 0.04 * type.abreast / 6)
      const reputationGain = 100 * (reputationBonus(comfort) - reputationBonus(comfort - gain))
      return <div className="a2-seat-card" key={c}>
        <div className="a2-seat-card-head"><b>{CABIN_LABEL[c]}</b><span>{seats[c]} assentos · {rows} fileiras</span></div>
        <div className="a2-seat-benefit" title="Índice de apelo do APK, que pode superar 100%. Ganho máximo de reputação comparado ao menor apelo da classe; o efeito na companhia depende do restante da frota.">
          <strong>👍 {Math.round(apeloDaPoltrona(model?.id, pitch[c], type, layout))}% apelo</strong>
          <span>até +{reputationGain.toFixed(1)} p.p. no alvo de reputação</span>
        </div>
        {photo && <img className="a2-seat-photo" src={asset2d(photo.file)} alt={`Poltrona ${model.name}`} />}
        <div className="a2-seat-controls">
          <label>Modelo de poltrona<select aria-label={`Poltrona ${c}`} value={selected?.style ?? ''} onChange={e => {
            const style = e.target.value
            const next = { ...config }
            const allowed = seatLayouts(type, c, style)
            next[c] = { style, layout: allowed.includes(layout) ? layout : allowed.at(-1)! }
            change(next, { ...pitch, [c]: Math.max(SEAT_BY_ID[style].minPitch, Math.min(pitch[c], SEAT_BY_ID[style].maxPitch)) })
          }}>{seatModelsFor(type, c).map(m =>
            <option key={m.id} value={m.id}>{m.name} · {m.fixedPitch ? `${m.minPitch}″` : `${m.minPitch}–${m.maxPitch}″`}</option>)}</select></label>
          <label>Assentos por fileira<select aria-label={`Distribuição ${c}`} value={layout} onChange={e => {
            const style = selected?.style ?? seatModelsFor(type, c)[0].id
            change({ ...config, [c]: { style, layout: e.target.value } },
              { ...pitch, [c]: Math.max(pitch[c], SEAT_BY_ID[style].minPitch) })
          }}>{choices.map(r => <option key={r} value={r}>{r} · {rowCount(r)} assentos</option>)}</select></label>
          <label>Fileiras<div className="a2-row-count">
            <button type="button" aria-label={`Retirar uma fileira de ${CABIN_LABEL[c]}`} disabled={rows === 0}
              onClick={() => setAssentos(c, Math.max(0, rows - 1) * abreast)}>−</button>
            <input aria-label={`Fileiras de ${CABIN_LABEL[c]}`} type="number" min="0" max={Math.ceil(Math.max(available, seats[c]) / abreast)}
              value={rows} onChange={e => setAssentos(c, Math.max(0, Math.floor(Number(e.target.value) || 0)) * abreast)} />
            <button type="button" aria-label={`Adicionar uma fileira de ${CABIN_LABEL[c]}`}
              disabled={(rows + 1) * abreast > available}
              onClick={() => setAssentos(c, (rows + 1) * abreast)}>+</button>
          </div></label>
          <label>Espaço entre fileiras · {pitch[c]}″{model?.fixedPitch ? ' · fixo' : ''}
            <input aria-label={`Passo de ${CABIN_LABEL[c]}`} type="range" min={Math.max(PITCH_RANGE[c][0], model?.minPitch ?? 0)}
              max={Math.max(pitch[c], maxPitch)} disabled={model?.fixedPitch} value={pitch[c]} onChange={e => setPasso(c, Number(e.target.value))} />
          </label>
        </div>
        <small className="dim">{available} assentos possíveis · {((rows * pitch[c]) / 39.37).toFixed(1)} m ocupados pelas fileiras<br />
          {model && `${money(model.extraCost)} por poltrona`}{model?.width && ` · largura ${model.width}″`}{model?.bedLength && ` · cama ${model.bedLength}″`}</small>
      </div>
    })}</div>
    <div className="a2-seatmap" aria-label="Mapa da cabine">
      <span className="dim">FRENTE · GALLEY / SAÍDAS</span>
      {order.filter(c => seats[c] > 0).map(c => {
        const model = SEAT_BY_ID[config?.[c]?.style ?? '']
        const allowed = seatLayouts(type, c, model?.id)
        const configured = rowLayout(type, c, config)
        const layout = allowed.includes(configured) ? configured : allowed.at(-1)!
        const blocks = layout.split('-').map(Number)
        const count = rowCount(layout)
        const rows = Math.ceil(seats[c] / count)
        const iconName = model?.icon ?? (c === 'y' || c === 'w' ? 'eco' : c === 'c' ? 'regional_biz' : 'regional_first')
        const rowArt = byName.get(`assets_seat_icons_png_resized_light_images_${iconName}_${layout.replaceAll('-', '')}.webp`)
        const singleName = iconName === 'staggered_suite' ? 'suite' : iconName === 'room_suite' ? 'apartment' : iconName
        const seatArt = byName.get(`assets_seat_icons_png_single_seat_resized_light_images_${singleName}.webp`)
        return <div className="a2-seat-zone" key={c}>
          <b>{CABIN_LABEL[c]} · {model?.name ?? 'Poltrona'} · {rows} fileiras · {pitch[c]}″</b>
          {Array.from({ length: rows }, (_, r) => {
            const full = (r + 1) * count <= seats[c]
            return <div className="a2-seat-row" key={r} style={{ paddingBottom: Math.max(2, pitch[c] / 7 - 3) }}>
              <small>{r + 1}</small>
              {full && rowArt ? <img className="a2-seat-layout" src={asset2d(rowArt.file)} alt={`${layout}: fileira ${r + 1}`} /> :
                blocks.map((block, group) => <span className="a2-seat-block" key={group}>{Array.from({ length: block }, (_, seat) => {
                  const index = r * count + blocks.slice(0, group).reduce((s, n) => s + n, 0) + seat
                  return <span className="a2-seat" key={seat} style={{ visibility: index < seats[c] ? 'visible' : 'hidden' }} title={`${CABIN_LABEL[c]} ${index + 1}`}>
                    {seatArt ? <img src={asset2d(seatArt.file)} alt="Assento" /> : '▣'}
                  </span>
                })}</span>)}
            </div>
          })}
          <small className="dim">DIVISÓRIA / SERVIÇOS</small>
        </div>
      })}
      <span className="dim">TRASEIRA · GALLEY / SAÍDAS</span>
    </div>
  </section>
}
