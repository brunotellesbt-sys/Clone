import type { AircraftType } from '../game/data/aircraft'
import { CABIN_LABEL, type CabinClass, type Cabins, type SeatConfig } from '../game/types'
import { comportaClasse, rowLayout } from '../game/cabin'
import { rowCount, SEAT_BY_ID, SEAT_MODELS, seatLayouts } from '../game/seatModels'
import { asset2d, use2d, type LibraryItem } from '../livery/aircraft2d'

export function SeatMapEditor({ type, seats, pitch, config, change }: {
  type: AircraftType; seats: Cabins; pitch: Cabins; config?: SeatConfig; change: (c: SeatConfig, p: Cabins) => void
}) {
  const { data: library = [] } = use2d<LibraryItem[]>('library.json')
  const byName = new Map(library.map(a => [a.id, a]))
  // Da frente para o fundo, e só as classes que a aeronave comporta: um ATR
  // não tem primeira nem executiva para escolher poltrona.
  const order = (['f', 'c', 'w', 'y'] as CabinClass[]).filter(c => comportaClasse(type, c))
  return <section className="a2-cabin">
    <h3>Poltronas e mapa da cabine</h3>
    <p className="dim">Escolha o modelo da poltrona e os blocos da fileira. A distribuição entra no cálculo de espaço e no custo da reforma. O mapa é esquemático; cabines com dois conveses usam o comprimento equivalente do jogo.</p>
    <div className="grid g2" style={{ gap: 12 }}>{order.map(c => {
      const selected = config?.[c]
      const model = SEAT_BY_ID[selected?.style ?? '']
      const photo = model && byName.get(`assets_seat_images_jpg_${model.id}.jpg`)
      const options = seatLayouts(type, c, model?.id)
      return <div className="a2-seat-card" key={c}>
        <b>{CABIN_LABEL[c]} · {seats[c]} assentos</b>
        {photo && <img className="a2-seat-photo" src={asset2d(photo.file)} alt={model.name} />}
        <label>Poltrona<select aria-label={`Poltrona ${c}`} value={selected?.style ?? ''} onChange={e => {
          const style = e.target.value; const next = { ...config }
          if (!style) { delete next[c]; change(next, pitch); return }
          const choices = seatLayouts(type, c, style)
          const layout = selected?.layout ?? rowLayout(type, c)
          next[c] = { style, layout: choices.includes(layout) ? layout : choices.at(-1)! }
          change(next, { ...pitch, [c]: Math.max(pitch[c], SEAT_BY_ID[style].minPitch) })
        }}><option value="">Configuração atual do jogo</option>{SEAT_MODELS.filter(m => m.cabin === c).map(m => <option key={m.id} value={m.id}>{m.name} · mín. {m.minPitch}″</option>)}</select></label>
        <label>Distribuição<select aria-label={`Distribuição ${c}`} value={selected?.layout ?? rowLayout(type, c)} onChange={e => {
          const style = selected?.style ?? SEAT_MODELS.find(m => m.cabin === c)!.id
          change({ ...config, [c]: { style, layout: e.target.value } }, { ...pitch, [c]: Math.max(pitch[c], SEAT_BY_ID[style].minPitch) })
        }}>{options.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      </div>
    })}</div>
    <div className="a2-seatmap" aria-label="Mapa dos assentos">
      <span className="dim">FRENTE · GALLEY / SAÍDAS</span>
      {order.filter(c => seats[c] > 0).map(c => {
        const model = SEAT_BY_ID[config?.[c]?.style ?? '']
        const layout = (config?.[c]?.layout ?? rowLayout(type, c)).split('-').map(Number)
        const count = rowCount(layout.join('-'))
        const rows = Math.ceil(seats[c] / count)
        const icon = byName.get(`assets_seat_icons_png_single_seat_resized_light_images_${model?.icon ?? (c === 'y' || c === 'w' ? 'eco' : c === 'c' ? 'regional_biz' : 'regional_first')}.webp`)
        return <div className="a2-seat-zone" key={c}>
          <b>{CABIN_LABEL[c]} · {rows} fileiras · {pitch[c]}″</b>
          {Array.from({ length: rows }, (_, r) => <div className="a2-seat-row" key={r} style={{ paddingBottom: Math.max(2, pitch[c] / 7 - 3) }}>
            <small>{r + 1}</small>{layout.map((block, group) => <span className="a2-seat-block" key={group}>{Array.from({ length: block }, (_, seat) => {
              const index = r * count + layout.slice(0, group).reduce((s, n) => s + n, 0) + seat
              return <span className="a2-seat" key={seat} style={{ visibility: index < seats[c] ? 'visible' : 'hidden' }} title={`${CABIN_LABEL[c]} ${index + 1}`}>
                {icon ? <img src={asset2d(icon.file)} alt="Assento" /> : '▣'}
              </span>
            })}</span>)}
          </div>)}
          <small className="dim">DIVISÓRIA / SERVIÇOS</small>
        </div>
      })}
      <span className="dim">TRASEIRA · GALLEY / SAÍDAS</span>
    </div>
  </section>
}
