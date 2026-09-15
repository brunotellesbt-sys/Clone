import { Fragment, useId } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Livery, PaintMark2D } from '../game/types'
import { asset2d, isAsset2d, selectedLayers, useModel2d, type Layer2D, type Box } from './aircraft2d'
import { LiveryPlane } from './LiveryPlane'
import { Bandeira } from './Flag'
import { emblemHref } from './emblems'

interface Props { type: AircraftType; livery: Livery; engineId?: string | null; titles?: string; registration?: string; flagCC?: string; className?: string }
export function RasterAircraft(props: Props) {
  const { type, livery: l, titles = '', registration = '', flagCC, className } = props
  const { data: model, error } = useModel2d(type.id)
  const uid = useId().replace(/:/g, '')
  if (!model) return <span data-aircraft2d-error={error}><LiveryPlane {...props} /></span>
  const cfg = l.aircraft2d?.[type.id] ?? {}
  const { layers } = selectedLayers(model, type, props.engineId ?? type.engines[0], cfg)
  const [w, h] = model.size
  const body = model.layers.find(x => x.name === 'fuselage')!
  const tail = model.layers.find(x => x.name === 'tail')!
  const [bx, by, br, bb] = model.bodyBox
  const bw = br - bx, bh = bb - by
  const titleY = type.shape.deck === 'double' ? .46 : type.shape.deck === 'hump' ? .54 : .2
  const titleX = type.shape.deck === 'hump' ? .4 : .15 + l.titleAt * .6
  const image = (layer: Layer2D) => <image href={asset2d(layer.file)} width={w} height={h} />
  // Nesses arquivos a base da nacela é um bloco de cor, e "wing" fornece
  // o contorno e o acabamento. Recorta o bloco pelo contorno antes de pintar.
  const engineFinish = ['bombardierq400', 'comacarj21', 'bombardier_crj1000', 'bombardiercrj700', 'bombardiercrj900'].includes(model.id)
    ? layers.find(x => x.name === 'wing') : undefined
  const maskId = (layer: Layer2D) => `${uid}-${layer.id}`
  const paint = (layer: Layer2D, color: string) => <rect width={w} height={h} fill={color} mask={`url(#${maskId(layer)})`} />
  function color(layer: Layer2D): string | undefined {
    const n = layer.name
    if (layer.pattern) return cfg.layers?.[layer.id] ?? undefined
    if (n === 'fuselage') return l.fuselage
    if (n === 'tail') return l.tail
    if (n === 'tail_base') return l.tail
    if (/detail|effect|shadow|core|exhaust|prop/.test(n)) return undefined
    if (/^engine_/.test(n)) return cfg.engine ?? l.engine ?? l.fuselage
    if (/^(winglet|sharklet|scimitar|wingtip_fence)(_|$)/.test(n)) return l.winglet
    // Estes nomes no ZIP incluem acabamentos de fuselagem/asa/nacela juntos.
    // Só as máscaras de cor originais recebem tinta; acabamentos mantêm os pixels.
    return undefined
  }
  const sectorLayer = (sector: string) => sector === 'tail' ? tail : sector === 'engine' ? layers.find(x => /^engine_(cfm|ge|pw|rr|iae|ea|pj|ae)$/.test(x.name)) :
    sector === 'winglet' ? layers.find(x => /^(winglet|sharklet|scimitar|wingtip_fence)$/.test(x.name)) : body
  const marks = Object.entries(cfg.marks ?? {})
  function mark(slot: string, m: PaintMark2D) {
    const layer = sectorLayer(slot)
    if (!layer?.box) return null
    const [x, y, r, b] = layer.box as Box
    const ww = r - x, hh = b - y
    const cx = x + ww * m.x, cy = y + hh * m.y
    const size = Math.max(2, hh * m.scale)
    const family = m.font && isAsset2d(m.font) ? `${uid}-font-${slot}` : 'Arial, sans-serif'
    return <g key={slot} mask={`url(#${maskId(layer)})`}>
      {m.font && isAsset2d(m.font) && <style>{`@font-face{font-family:"${family}";src:url("${asset2d(m.font)}")}`}</style>}
      <g transform={`translate(${cx} ${cy}) rotate(${m.rotation})`}>
        {m.file && isAsset2d(m.file) && <>
          <mask id={`${uid}-logo-${slot}`} style={{ maskType: 'alpha' }} x={-size} y={-size} width={size * 2} height={size * 2} maskUnits="userSpaceOnUse">
            <image href={asset2d(m.file)} x={-size} y={-size / 2} width={size * 2} height={size} preserveAspectRatio="xMidYMid meet" />
          </mask>
          <rect x={-size} y={-size / 2} width={size * 2} height={size} fill={m.color} mask={`url(#${uid}-logo-${slot})`} />
        </>}
        {m.text && <text textAnchor="middle" dominantBaseline="middle" fill={m.color} fontFamily={family} fontSize={size} fontWeight="bold"
          textLength={Math.min(ww * .8, m.text.length * size * .6)} lengthAdjust="spacingAndGlyphs">{m.text}</text>}
      </g>
    </g>
  }
  // Inscrições antes do acabamento preservam portas, janelas, sombras e rebites.
  const bodyMarks = <g mask={`url(#${maskId(body)})`}>
    {!cfg.marks?.primary && <text x={bx + bw * titleX} y={by + bh * titleY} fontFamily={l.titleFont === 'serif' ? 'Georgia' : l.titleFont === 'mono' ? 'monospace' : 'Arial'}
      fontSize={bh * l.titleSize * .6} fill={l.titles} fontWeight="bold" textLength={Math.min(bw * .52, titles.length * bh * l.titleSize * .36)} lengthAdjust="spacingAndGlyphs">{titles}</text>}
    {marks.filter(([slot]) => !['tail', 'engine', 'winglet'].includes(slot)).map(([slot, m]) => mark(slot, m!))}
    {l.showReg && <text x={bx + bw * .76} y={by + bh * .65} fill={l.regColor} fontSize={bh * (l.regSize === 'large' ? .12 : l.regSize === 'small' ? .065 : .09)}>{registration}</text>}
    {l.flag && flagCC && <g transform={`translate(${bx + bw * .86} ${by + bh * .53})`}><Bandeira cc={flagCC} x={0} y={0} h={bh * .11} /></g>}
  </g>
  const lastBodyPattern = Math.max(body.order, ...model.layers.filter(x => x.pattern && x.sector === 'fuselage').map(x => x.order))
  const firstFinish = layers.find(x => x.order > lastBodyPattern && !x.pattern)
  const tailFinish = layers.find(x => x.order > tail.order && !x.pattern) ?? body
  const tailMark = cfg.marks?.tail
  const tailDecoration = tailMark ? mark('tail', tailMark) : l.emblem !== 'none' && <g mask={`url(#${maskId(tail)})`}>
    <mask id={`${uid}-emblem`} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
      <image href={emblemHref(l.emblem) ?? undefined} x={model.tailBox[0] + (model.tailBox[2] - model.tailBox[0]) * .35} y={model.tailBox[1] + (model.tailBox[3] - model.tailBox[1]) * .27} width={(model.tailBox[2] - model.tailBox[0]) * .5} height={(model.tailBox[3] - model.tailBox[1]) * .5} />
    </mask>
    <rect width={w} height={h} fill={l.emblemColor} mask={`url(#${uid}-emblem)`} />
  </g>
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} role="img" aria-label={`${type.maker} ${type.name}`} data-aircraft2d={model.id}>
    <defs>
      {engineFinish && <>
        <filter id={`${uid}-opaque`} x={0} y={0} width={w} height={h} filterUnits="userSpaceOnUse"><feComponentTransfer><feFuncA type="linear" slope={255} /></feComponentTransfer></filter>
        <mask id={`${uid}-engine-shape`} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}><g filter={`url(#${uid}-opaque)`}>{image(engineFinish)}</g></mask>
      </>}
      {layers.filter(x => color(x) || [body.id, tail.id].includes(x.id) || x === sectorLayer('engine') || x === sectorLayer('winglet')).map(layer =>
      <mask key={layer.id} id={maskId(layer)} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
        <g mask={engineFinish && layer === sectorLayer('engine') ? `url(#${uid}-engine-shape)` : undefined}>{image(layer)}</g>
      </mask>)}
    </defs>
    {layers.map(layer => <Fragment key={layer.id}>
      {layer === tailFinish && tailDecoration}
      {layer === firstFinish && bodyMarks}
      {color(layer) ? paint(layer, color(layer)!) : image(layer)}
      {layer === body && <g mask={`url(#${maskId(body)})`}>
        <rect x={bx} y={by + bh * l.bellyAt} width={bw} height={bh} fill={l.belly} />
        {l.cheatStyle !== 'none' && !layers.some(p => p.pattern && p.sector === 'fuselage') &&
          <rect x={bx} y={by + bh * l.cheatAt} width={bw} height={bh * l.cheatWidth * .5} fill={l.cheat} />}
      </g>}
      {(['engine', 'winglet'] as const).filter(slot => sectorLayer(slot)?.id === layer.id).map(slot => cfg.marks?.[slot] ? mark(slot, cfg.marks[slot]!) : null)}
    </Fragment>)}
    {!firstFinish && bodyMarks}
  </svg>
}
