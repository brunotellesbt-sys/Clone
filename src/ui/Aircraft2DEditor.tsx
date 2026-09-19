import { useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Livery, Paint2D, PaintMark2D } from '../game/types'
import { asset2d, label2d, selectedLayers, use2d, useModel2d, wingOptions, type LibraryItem } from '../livery/aircraft2d'
import { normalizePaint2d } from '../livery/paint2dConfig'
import { downloadFile } from '../livery/export'
import { Card } from './components/Bits'

type Slot = NonNullable<Paint2D['marks']> extends Partial<Record<infer K, unknown>> ? K : never
const SLOTS: [Slot, string][] = [['primary', 'Letreiro principal'], ['secondary', 'Segundo letreiro'], ['third', 'Terceiro letreiro'], ['alliance', 'Aliança'], ['tail', 'Símbolo da cauda'], ['fuselage', 'Símbolo da fuselagem'], ['engine', 'Símbolo do motor'], ['winglet', 'Símbolo do winglet']]
const WING_LABEL: Record<string, string> = { none: 'Sem winglet', winglet: 'Winglet', scimitar: 'Split Scimitar', wingtip_fence: 'Wingtip fence', sharklet: 'Sharklet', standard: 'Padrão', enhanced: 'Ampliado' }
import { EMBLEMS } from '../livery/emblems'

const COLOR_FIELDS = ['fuselage', 'belly', 'tail', 'stab', 'winglet', 'wingTop', 'titles', 'regColor', 'cheat', 'cheat2', 'engine', 'emblemColor'] as const
const PRESENTATION_FIELDS = ['bellyAt', 'cheatStyle', 'cheatAt', 'cheatWidth', 'titleFont', 'titleSize', 'titleAt', 'regSize', 'showReg', 'flag', 'emblem'] as const
export function Aircraft2DEditor({ type, engineId, livery, change, toast }: {
  type: AircraftType; engineId: string; livery: Livery; change: (l: Livery) => void; toast: (msg: string, tone?: 'error') => void
}) {
  const { data: model, error } = useModel2d(type.id)
  const { data: library = [] } = use2d<LibraryItem[]>('library.json')
  const [tab, setTab] = useState('cores')
  const [sector, setSector] = useState('fuselage')
  const [slot, setSlot] = useState<Slot>('primary')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const cfg = livery.aircraft2d?.[type.id] ?? {}
  const set = (patch: Partial<Paint2D>) => change({ ...livery, aircraft2d: { ...livery.aircraft2d, [type.id]: { ...cfg, ...patch } } })
  const m = cfg.marks?.[slot] ?? { text: '', color: ['tail', 'engine', 'winglet'].includes(slot) ? livery.emblemColor : livery.titles, x: .5, y: ['tail', 'engine', 'winglet'].includes(slot) ? .5 : .15, scale: .15, rotation: 0 }
  const setMark = (patch: Partial<PaintMark2D>) => set({ marks: { ...cfg.marks, [slot]: { ...m, ...patch } } })
  const fonts = library.filter(a => /\.(otf|ttf)$/.test(a.id))
  const logos = library.filter(a => /LOGOS_DE|OVERLAYS_SOLTOS|BANDEIRAS/.test(a.category))
  const categories = [...new Set(library.filter(a => !/\.(otf|ttf)$/.test(a.id)).map(a => a.category))].sort()
  const gallery = library.filter(a => !/\.(otf|ttf)$/.test(a.id) && (!category || a.category === category) && label2d(a.id).toLowerCase().includes(query.toLowerCase()))
  if (!model) return <Card title="Sistema Aeronaves 2D"><p>{error ?? 'Carregando camadas originais…'}</p></Card>
  const selection = selectedLayers(model, type, engineId, cfg)
  const patterns = model.layers.filter(l => l.pattern && l.sector === sector)
  return <div className="grid" style={{ gap: 14 }}>
    <Card title="Oficina de pintura 2D" right={<span className="chip grey">{model.name}</span>}>
      <p className="dim">Cores da companhia são compartilhadas. Camadas, inscrições e opções ficam salvas para o {type.name}.</p>
      <div className="row tight" style={{ flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => downloadFile(`pintura-${type.id}.json`, new Blob([JSON.stringify({ format: 'skyline-aircraft2d', version: 1, typeId: type.id, paint: cfg, colors: Object.fromEntries(COLOR_FIELDS.map(k => [k, livery[k]])), presentation: Object.fromEntries(PRESENTATION_FIELDS.map(k => [k, livery[k]])) }, null, 2)], { type: 'application/json' }))}>Exportar pintura do modelo</button>
        <label className="btn sm">Importar pintura<input aria-label="Importar pintura 2D" type="file" accept=".json" hidden onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
          try {
            if (f.size > 250000) throw new Error('Arquivo de pintura muito grande.')
            const raw = JSON.parse(await f.text())
            if (raw.format !== 'skyline-aircraft2d' || raw.version !== 1 || raw.typeId !== type.id) throw new Error('Escolha um arquivo de pintura deste modelo.')
            const clean = normalizePaint2d({ [type.id]: raw.paint })[type.id]
            if (!clean) throw new Error('Pintura inválida.')
            const restored = { ...livery }
            for (const key of COLOR_FIELDS) {
              const color = raw.colors?.[key]
              if (typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color)) restored[key] = color
              else if (key === 'wingTop') restored.wingTop = null
              else if (key === 'engine') delete restored.engine
            }
            const pres = raw.presentation ?? {}
            for (const key of ['bellyAt', 'cheatAt', 'cheatWidth', 'titleSize', 'titleAt'] as const) {
              if (typeof pres[key] === 'number' && Number.isFinite(pres[key])) restored[key] = Math.max(0, Math.min(1, pres[key]))
            }
            for (const key of ['showReg', 'flag'] as const) if (typeof pres[key] === 'boolean') restored[key] = pres[key]
            if (['sans', 'wide', 'serif', 'mono'].includes(pres.titleFont)) restored.titleFont = pres.titleFont
            if (['small', 'medium', 'large'].includes(pres.regSize)) restored.regSize = pres.regSize
            if (typeof pres.cheatStyle === 'string') restored.cheatStyle = pres.cheatStyle === 'none' ? 'none' : 'straight'
            if (typeof pres.emblem === 'string' && /^[a-z]{1,40}$/.test(pres.emblem)) restored.emblem = pres.emblem
            change({ ...restored, aircraft2d: { ...livery.aircraft2d, [type.id]: clean } })
            toast('Pintura importada.')
          } catch (err) { toast(err instanceof Error ? err.message : 'Arquivo inválido.', 'error') }
        }} /></label>
        <button className="btn sm" onClick={() => change({ ...livery, aircraft2d: { ...livery.aircraft2d, [type.id]: {} } })}>Limpar ajustes deste modelo</button>
      </div>
      <div className="nav" style={{ marginTop: 12 }}>{[['cores', 'Cores e peças'], ['camadas', 'Camadas originais'], ['marcas', 'Textos e símbolos'], ['acervo', 'Acervo do ZIP']].map(([id, label]) => <button className={id === tab ? 'on' : ''} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>
      {tab === 'cores' && <>
        <div className="grid g3" style={{ gap: 12, marginTop: 16 }}>{([
          ['fuselage', 'Fuselagem'], ['belly', 'Barriga'], ['tail', 'Cauda'], ['winglet', 'Winglet'], ['titles', 'Letreiro'], ['regColor', 'Matrícula'], ['cheat', 'Faixa'], ['engine', 'Motor'],
        ] as [keyof Livery, string][]).map(([key, label]) => <label className="row" key={key}>{label}<input aria-label={label} type="color" value={(livery[key] as string) ?? '#cbd5e1'} onChange={e => change({ ...livery, [key]: e.target.value })} /></label>)}</div>
        <div className="grid g2" style={{ gap: 16, marginTop: 16 }}>
          <label>Barriga: {Math.round(livery.bellyAt * 100)}%<input aria-label="Altura da barriga" type="range" min="0.2" max="1" step=".01" value={livery.bellyAt} onChange={e => change({ ...livery, bellyAt: +e.target.value })} /></label>
          <label><input type="checkbox" checked={livery.cheatStyle !== 'none'} onChange={e => change({ ...livery, cheatStyle: e.target.checked ? 'straight' : 'none' })} /> Faixa simples (sem camadas decorativas)</label>
          <label><input type="checkbox" checked={livery.showReg} onChange={e => change({ ...livery, showReg: e.target.checked })} /> Mostrar matrícula</label>
          <label><input type="checkbox" checked={livery.flag} onChange={e => change({ ...livery, flag: e.target.checked })} /> Bandeira da matrícula</label>
          <label>Motor deste modelo<input aria-label="Cor do motor deste modelo" type="color" value={cfg.engine ?? livery.engine ?? livery.fuselage} onChange={e => set({ engine: e.target.value })} /><button className="btn sm" onClick={() => set({ engine: undefined })}>Usar cor da companhia</button></label>
          {wingOptions(model, type.id).length > 0 && <label>Opção de asa<select aria-label="Opção de asa" value={selection.wing} onChange={e => set({ winglet: e.target.value })}>{wingOptions(model, type.id).map(w => <option key={w} value={w}>{WING_LABEL[w]}</option>)}</select></label>}
          {model.layers.some(l => /racoon_mask|eyebrow/.test(l.name)) && <label><input type="checkbox" checked={cfg.eyeMask ?? false} onChange={e => set({ eyeMask: e.target.checked })} /> Máscara / sobrancelhas do cockpit</label>}
        </div>
      </>}
      {tab === 'camadas' && <>
        <div className="row" style={{ margin: '12px 0' }}><select aria-label="Setor das camadas" value={sector} onChange={e => setSector(e.target.value)}><option value="fuselage">Fuselagem</option><option value="tail">Cauda</option></select><span className="dim">Ative e pinte uma ou várias camadas. A ordem original é preservada.</span></div>
        <div className="row tight" style={{ flexWrap: 'wrap' }}><span className="dim">Combinações:</span>{['de', 'hu', 'oz', 'nh', 'sq', 'cz', 'ci', 'br', 'triangle', 'wavy', 'thin', 'thick'].filter(prefix => patterns.some(p => p.name.startsWith(prefix + '_'))).map(prefix => <button className="btn sm" key={prefix} onClick={() => {
          const colors = { ...cfg.layers }
          for (const p of patterns) colors[p.id] = null
          patterns.filter(p => p.name.startsWith(prefix + '_')).forEach((p, i) => { colors[p.id] = i % 2 ? livery.cheat2 : livery.cheat })
          set({ layers: colors })
        }}>{prefix.toUpperCase()}</button>)}</div>
        <div className="a2-layer-grid">{patterns.map(layer => <label className="a2-layer" key={layer.id}>
          <img src={asset2d(layer.small)} alt="" loading="lazy" />
          <span><input type="checkbox" aria-label={`Ativar ${layer.id}`} checked={!!cfg.layers?.[layer.id]} onChange={e => set({ layers: { ...cfg.layers, [layer.id]: e.target.checked ? livery.cheat : null } })} /> {layer.order} · {label2d(layer.name)}</span>
          <input type="color" aria-label={`Cor ${layer.id}`} disabled={!cfg.layers?.[layer.id]} value={cfg.layers?.[layer.id] ?? livery.cheat} onChange={e => set({ layers: { ...cfg.layers, [layer.id]: e.target.value } })} />
        </label>)}</div>
      </>}
      {tab === 'marcas' && <>
        {/*
          * O emblema da deriva mora aqui, e antes não morava em lugar nenhum.
          *
          * O catálogo de emblemas só era oferecido pelo editor vetorial, que o
          * jogo usa em 5 dos 68 modelos — nos outros 63, que são os que se voa,
          * não havia como escolher um. O desenhista sempre soube pintá-lo: o
          * `RasterAircraft` já desenha `livery.emblem` na cauda da arte 2D. O
          * que faltava era o controle.
          */}
        <h4 className="sub" style={{ marginTop: 16 }}>Emblema da deriva</h4>
        <div className="grid g3" style={{ gap: 14 }}>
          <label>Emblema
            <select aria-label="Emblema" value={livery.emblem}
              onChange={e => change({ ...livery, emblem: e.target.value })}>
              {EMBLEMS.map(em => <option key={em.id} value={em.id}>{em.label}</option>)}
            </select>
          </label>
          {livery.emblem !== 'none' && <>
            <label className="row">Cor do emblema
              <input type="color" aria-label="Cor do emblema" value={livery.emblemColor}
                onChange={e => change({ ...livery, emblemColor: e.target.value })} />
            </label>
            <label>Tamanho
              <select aria-label="Tamanho do emblema" value={livery.emblemSize}
                onChange={e => change({ ...livery, emblemSize: e.target.value as Livery['emblemSize'] })}>
                <option value="small">Pequeno</option>
                <option value="medium">Médio</option>
                <option value="large">Grande</option>
              </select>
            </label>
          </>}
        </div>
        <p className="dim" style={{ fontSize: 12, margin: '6px 0 0' }}>
          O emblema é pintado na deriva. Uma inscrição no <b>Símbolo da cauda</b>, abaixo, ocupa o
          mesmo lugar e passa na frente dele.
        </p>

        <h4 className="sub" style={{ marginTop: 18 }}>Inscrições</h4>
        <div className="grid g2" style={{ gap: 14 }}>
          <label>Local da inscrição<select aria-label="Local da inscrição" value={slot} onChange={e => setSlot(e.target.value as Slot)}>{SLOTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Texto<input type="text" aria-label="Texto da inscrição" value={m.text ?? ''} maxLength={80} onChange={e => setMark({ text: e.target.value })} placeholder="Nome, slogan ou identificação" /></label>
          <label>Fonte do ZIP<select aria-label="Fonte do ZIP" value={m.font ?? ''} onChange={e => setMark({ font: e.target.value || undefined })}><option value="">Padrão</option>{fonts.map(f => <option key={f.id} value={f.file}>{label2d(f.id).replace(/^fonts /, '')}</option>)}</select></label>
          <label>Símbolo do ZIP<select aria-label="Símbolo do ZIP" value={m.file ?? ''} onChange={e => setMark({ file: e.target.value || undefined })}><option value="">Nenhum</option>{logos.map(f => <option key={f.id} value={f.file}>{label2d(f.id)}</option>)}</select></label>
          <label className="row">Cor da inscrição<input type="color" aria-label="Cor da inscrição" value={m.color} onChange={e => setMark({ color: e.target.value })} /></label>
          {(['x', 'y', 'scale', 'rotation'] as const).map(key => <label key={key}>{({ x: 'Posição horizontal', y: 'Posição vertical', scale: 'Tamanho', rotation: 'Rotação' })[key]}: {m[key].toFixed(2)}<input aria-label={key} type="range" min={key === 'rotation' ? -180 : key === 'scale' ? .02 : 0} max={key === 'rotation' ? 180 : key === 'scale' ? 2 : 1} step={key === 'rotation' ? 1 : .01} value={m[key]} onChange={e => setMark({ [key]: +e.target.value })} /></label>)}
        </div>
        <button className="btn sm" onClick={() => { const marks = { ...cfg.marks }; delete marks[slot]; set({ marks }) }}>Restaurar esta inscrição</button>
      </>}
      {tab === 'acervo' && <>
        <p className="dim">Referências, templates, fundos, símbolos, motores e assentos originais. As camadas editáveis estão na aba Camadas originais.</p>
        <div className="row"><input type="text" aria-label="Buscar no acervo" placeholder="Buscar no acervo" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /><select aria-label="Categoria do acervo" value={category} onChange={e => { setCategory(e.target.value); setPage(0) }}><option value="">Todas as categorias</option>{categories.map(c => <option key={c} value={c}>{c.replace(/\d+_/g, '').replace(/_/g, ' ')}</option>)}</select></div>
        <div className="a2-layer-grid">{gallery.slice(page * 48, (page + 1) * 48).map(a => <a className="a2-layer" href={asset2d(a.file)} target="_blank" rel="noreferrer" key={a.id}><img loading="lazy" src={asset2d(a.file)} alt={label2d(a.id)} /><small>{label2d(a.id)}</small></a>)}</div>
        <div className="row"><button className="btn sm" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><span>{gallery.length} arquivos · página {page + 1}</span><button className="btn sm" disabled={(page + 1) * 48 >= gallery.length} onClick={() => setPage(page + 1)}>Próxima</button></div>
      </>}
      {selection.warning && <p className="dim">{selection.warning}</p>}
    </Card>
  </div>
}
