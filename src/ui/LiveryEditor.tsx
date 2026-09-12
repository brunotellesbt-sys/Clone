import { useState } from 'react'
import { AIRCRAFT_ALL, acLabel, AIRCRAFT_BY_ID } from '../game/data/aircraft'
import type { Livery } from '../game/types'
import { AircraftArt } from '../livery/AircraftArt'
import { creditLine, creditSource } from '../livery/art'
import { EMBLEMS } from '../livery/emblems'
import { BLANK_LIVERY, LIVERY_PRESETS } from '../livery/presets'
import { useGame } from '../store/useGame'
import { Card } from './components/Bits'

const PALETTE = [
  '#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#1e293b', '#0f172a', '#020617',
  '#fecaca', '#fb7185', '#e11d48', '#9f1239', '#7f1d1d',
  '#fed7aa', '#fb923c', '#ea580c', '#c2410c', '#7c2d12',
  '#fef08a', '#facc15', '#eab308', '#a16207', '#713f12',
  '#bbf7d0', '#4ade80', '#16a34a', '#15803d', '#064e3b',
  '#a5f3fc', '#22d3ee', '#0891b2', '#0e7490', '#164e63',
  '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8', '#1e3a8a',
  '#ddd6fe', '#a78bfa', '#7c3aed', '#6d28d9', '#4c1d95',
  '#fbcfe8', '#f472b6', '#db2777', '#be185d', '#831843',
]

type SectionId = 'fuselagem' | 'faixa' | 'cauda' | 'asa' | 'texto' | 'detalhes'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'fuselagem', label: 'Fuselagem' },
  { id: 'faixa', label: 'Faixa' },
  { id: 'cauda', label: 'Cauda' },
  { id: 'asa', label: 'Asa e motores' },
  { id: 'texto', label: 'Texto' },
  { id: 'detalhes', label: 'Detalhes' },
]

type OptColorKey = Extract<keyof Livery,
  'leadingEdge' | 'wingTop' | 'trailingEdge' | 'cockpit' | 'crown' | 'cabin' | 'lowerBody'>

type ColorKey = Extract<
  keyof Livery,
  | 'fuselage' | 'belly' | 'nose' | 'cheat' | 'cheat2' | 'tail' | 'tailAccent' | 'stab'
  | 'wing' | 'winglet' | 'engine' | 'engineCowl' | 'gear' | 'titles' | 'regColor' | 'windowColor'
  | 'emblemColor' | 'emblemAccent'
>

export function LiveryEditor() {
  const { state, act, toast } = useGame()
  const [preview, setPreview] = useState('b737')
  const [section, setSection] = useState<SectionId>('fuselagem')
  const [openField, setOpenField] = useState<ColorKey | OptColorKey | null>('fuselage')
  const livery = state.airline.livery
  const type = AIRCRAFT_BY_ID[preview]
  // Sem escolha de motor nesta tela: mostra a arte do motor de série.
  const previewEngineId = type.engines[0]

  const set = <K extends keyof Livery>(k: K, v: Livery[K]) =>
    act((s) => {
      ;(s.airline.livery as Livery)[k] = v
    })

  const apply = (l: Livery) =>
    act((s) => {
      s.airline.livery = structuredClone(l)
    })

  function exportPng() {
    const svg = document.querySelector('#livery-preview svg') as SVGSVGElement | null
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 2400
      canvas.height = Math.round((img.height / img.width) * 2400) || 720
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0d1425'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      try {
        const a = document.createElement('a')
        a.download = `${state.airline.code}-${type.id}.png`
        a.href = canvas.toDataURL('image/png')
        a.click()
        toast('Imagem da pintura baixada.')
      } catch {
        toast('A imagem de origem bloqueou o download neste navegador.', 'error')
      }
    }
    img.onerror = () => toast('Não consegui gerar o PNG neste navegador.', 'error')
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  }

  /** Cor opcional: nula herda de outro setor, e o editor diz de qual. */
  const OptColor = ({ k, label, herdaDe, herdaCor }: {
    k: OptColorKey; label: string; herdaDe: string; herdaCor: string
  }) => {
    const atual = livery[k]
    return (
      <ColorField
        label={label}
        value={atual ?? herdaCor}
        herdado={atual ? undefined : herdaDe}
        onHerdar={() => set(k, null as Livery[OptColorKey])}
        open={openField === k}
        onToggle={() => setOpenField(openField === k ? null : k)}
        onChange={(v) => set(k, v as Livery[OptColorKey])}
      />
    )
  }

  const Color = ({ k, label }: { k: ColorKey; label: string }) => (
    <ColorField
      label={label}
      value={livery[k] as string}
      open={openField === k}
      onToggle={() => setOpenField(openField === k ? null : k)}
      onChange={(v) => set(k, v as Livery[ColorKey])}
    />
  )

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card
        title="Pintura da frota"
        right={
          <div className="row tight">
            <select value={preview} onChange={(e) => setPreview(e.target.value)} style={{ width: 230 }}>
              {AIRCRAFT_ALL.map((a) => (
                <option key={a.id} value={a.id}>{acLabel(a)}</option>
              ))}
            </select>
            <button className="btn sm" onClick={exportPng}>Baixar PNG</button>
          </div>
        }
      >
        <div className="plane-frame" id="livery-preview">
          <AircraftArt
            type={type}
            engineId={previewEngineId}
            livery={livery}
            titles={state.airline.name}
            registration={`${state.airline.code}-ABC`}
          />
        </div>
        {creditLine(preview, previewEngineId) && (
          <p className="muted" style={{ fontSize: 11, margin: '6px 2px 0' }}>
            {creditLine(preview, previewEngineId)}{' '}
            <a
              href={creditSource(preview, previewEngineId) ?? '#'}
              target="_blank" rel="noreferrer" style={{ color: 'var(--ink-3)' }}
            >
              ver arquivo
            </a>
          </p>
        )}
      </Card>

      <div className="split">
        <Card>
          <div className="nav" style={{ margin: '-14px -14px 10px', padding: '6px 8px 0', borderRadius: '12px 12px 0 0' }}>
            {SECTIONS.map((s) => (
              <button key={s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          {section === 'fuselagem' && (
            <>
              <Color k="fuselage" label="Cor principal" />
              {/* As três faixas horizontais. Nulo herda a cor principal: sem
                  isso elas cobririam a fuselagem inteira e "Cor principal"
                  deixaria de ter efeito visível. */}
              <OptColor k="crown" label="Dorso (acima das janelas)" herdaDe="cor principal" herdaCor={livery.fuselage} />
              <OptColor k="cabin" label="Faixa da cabine" herdaDe="cor principal" herdaCor={livery.fuselage} />
              <OptColor k="lowerBody" label="Ventre (abaixo do motor)" herdaDe="cor principal" herdaCor={livery.fuselage} />
              <Color k="belly" label="Barriga" />
              <Slider
                label="Onde a barriga começa"
                value={livery.bellyAt} min={0.2} max={1} step={0.01}
                display={livery.bellyAt >= 0.99 ? 'sem barriga' : `${Math.round(livery.bellyAt * 100)}% da altura`}
                onChange={(v) => set('bellyAt', v)}
              />
              <Select
                label="Radome (bico)"
                value={livery.noseStyle}
                options={[
                  { v: 'body', label: 'Igual à fuselagem' },
                  { v: 'dark', label: 'Cinza-escuro, padrão de fábrica' },
                  { v: 'custom', label: 'Cor própria' },
                ]}
                onChange={(v) => set('noseStyle', v as Livery['noseStyle'])}
              />
              {livery.noseStyle === 'custom' && <Color k="nose" label="Cor do radome" />}
            </>
          )}

          {section === 'faixa' && (
            <>
              <Select
                label="Desenho da pintura"
                value={livery.cheatStyle}
                options={[
                  { v: 'none', label: 'Sem faixa' },
                  { v: 'straight', label: 'Reta' },
                  { v: 'wide', label: 'Larga, descendo até a barriga' },
                  { v: 'double', label: 'Dupla, com duas cores' },
                  { v: 'wave', label: 'Onda subindo para a cauda' },
                  { v: 'split', label: 'Meia-fuselagem em diagonal' },
                  { v: 'fade', label: 'Degradê ao longo do avião' },
                  { v: 'chevron', label: 'Galões repetidos' },
                  { v: 'delta', label: 'Cunha subindo para a cauda' },
                  { v: 'diagonal', label: 'Faixa inclinada' },
                  { v: 'ribbon', label: 'Fitas cruzadas' },
                  { v: 'triband', label: 'Três filetes' },
                  { v: 'checker', label: 'Fileira de losangos' },
                  { v: 'billboard', label: 'Bloco na traseira' },
                  { v: 'sunray', label: 'Leque de raios' },
                ]}
                onChange={(v) => set('cheatStyle', v as Livery['cheatStyle'])}
              />
              {livery.cheatStyle !== 'none' && (
                <>
                  <Color k="cheat" label="Cor da faixa" />
                  {(livery.cheatStyle === 'double' || livery.cheatStyle === 'fade') && (
                    <Color k="cheat2" label="Segunda cor" />
                  )}
                  <Slider
                    label="Altura na fuselagem"
                    value={livery.cheatAt} min={0.05} max={0.95} step={0.01}
                    display={`${Math.round(livery.cheatAt * 100)}% da altura`}
                    onChange={(v) => set('cheatAt', v)}
                  />
                  <Slider
                    label="Espessura"
                    value={livery.cheatWidth} min={0.03} max={0.5} step={0.01}
                    display={`${Math.round(livery.cheatWidth * 100)}% da fuselagem`}
                    onChange={(v) => set('cheatWidth', v)}
                  />
                </>
              )}
            </>
          )}

          {section === 'cauda' && (
            <>
              <Color k="tail" label="Deriva" />
              <Select
                label="Desenho da deriva"
                value={livery.tailStyle}
                options={[
                  { v: 'solid', label: 'Lisa' },
                  { v: 'stripes', label: 'Listras' },
                  { v: 'swoosh', label: 'Curva' },
                  { v: 'gradient', label: 'Degradê' },
                  { v: 'split', label: 'Bipartida' },
                  { v: 'chevron', label: 'Chevron' },
                ]}
                onChange={(v) => set('tailStyle', v as Livery['tailStyle'])}
              />
              {livery.tailStyle !== 'solid' && <Color k="tailAccent" label="Cor do detalhe" />}
              <Color k="stab" label="Estabilizador horizontal" />
              <Select
                label="Emblema"
                value={livery.emblem}
                options={EMBLEMS.map((e) => ({ v: e.id, label: e.label }))}
                onChange={(v) => set('emblem', v as Livery['emblem'])}
              />
              {livery.emblem !== 'none' && (
                <>
                  <Color k="emblemColor" label="Cor do emblema" />
                  <Color k="emblemAccent" label="Cor de destaque do emblema" />
                </>
              )}
            </>
          )}

          {section === 'asa' && (
            <>
              <Color k="wing" label="Asa" />
              <OptColor k="leadingEdge" label="Bordo de ataque" herdaDe="cor da asa" herdaCor={livery.wing} />
              <OptColor k="wingTop" label="Dorso da asa" herdaDe="cor da asa" herdaCor={livery.wing} />
              <OptColor k="trailingEdge" label="Bordo de fuga" herdaDe="cor da asa" herdaCor={livery.wing} />
              <Color k="winglet" label="Winglet" />
              <Color k="engine" label="Nacela do motor" />
              <Color k="engineCowl" label="Aro do bocal" />
              {/* só a perna: o pneu é preto e não entra na livery */}
              <Color k="gear" label="Perna do trem" />
            </>
          )}

          {section === 'texto' && (
            <>
              <Color k="titles" label="Letreiro" />
              <Select
                label="Tipografia"
                value={livery.titleFont}
                options={[
                  { v: 'wide', label: 'Bold larga' },
                  { v: 'sans', label: 'Sem serifa' },
                  { v: 'serif', label: 'Serifada' },
                  { v: 'mono', label: 'Monoespaçada' },
                ]}
                onChange={(v) => set('titleFont', v as Livery['titleFont'])}
              />
              <Select
                label="Tamanho da letra"
                value={String(tamanhoDoLetreiro(livery.titleSize))}
                options={TAMANHOS_DE_LETREIRO.map((t) => ({ v: String(t.v), label: t.label }))}
                onChange={(v) => set('titleSize', +v)}
              />
              <Slider
                label="Posição ao longo da fuselagem"
                value={livery.titleAt} min={0} max={0.75} step={0.01}
                display={livery.titleAt < 0.25 ? 'à frente' : livery.titleAt < 0.5 ? 'no meio' : 'atrás'}
                onChange={(v) => set('titleAt', v)}
              />
              <Toggle label="Mostrar matrícula" value={livery.showReg} onChange={(v) => set('showReg', v)} />
              {livery.showReg && <Color k="regColor" label="Cor da matrícula" />}
            </>
          )}

          {section === 'detalhes' && (
            <>
              <Toggle label="Janelas" value={livery.windows} onChange={(v) => set('windows', v)} />
              {livery.windows && <Color k="windowColor" label="Cor das janelas" />}
              <OptColor k="cockpit" label="Cabine de comando" herdaDe="sem pintura" herdaCor={livery.windowColor} />
              <Toggle label="Contorno das portas" value={livery.doors} onChange={(v) => set('doors', v)} />
            </>
          )}
        </Card>

        <div className="grid" style={{ gap: 14 }}>
          <Card title="Modelos prontos">
            <div className="row tight">
              {LIVERY_PRESETS.map((p) => (
                <button key={p.name} className="btn sm" onClick={() => apply(p.livery)}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="row tight" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => apply(BLANK_LIVERY)}>Voltar ao branco</button>
              <button className="btn sm" onClick={() => apply(randomLivery())}>Sortear</button>
            </div>
          </Card>

          <Card title="Peças pintadas">
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Cada parte tem cor própria. A faixa e o letreiro ainda têm posição e espessura ajustáveis.
            </p>
            <div className="row tight">
              {(
                [
                  ['fuselage', 'fuselagem'], ['belly', 'barriga'], ['nose', 'radome'], ['cheat', 'faixa'],
                  ['tail', 'deriva'], ['stab', 'estabilizador'], ['wing', 'asa'], ['winglet', 'winglet'],
                  ['engine', 'nacela'], ['engineCowl', 'bocal'], ['gear', 'trem'], ['titles', 'letreiro'],
                  ['windowColor', 'janelas'],
                ] as [ColorKey, string][]
              ).map(([k, label]) => (
                <span key={k} className="chip grey" style={{ gap: 6 }}>
                  <i
                    style={{
                      width: 10, height: 10, borderRadius: 3, background: livery[k] as string,
                      border: '1px solid rgba(255,255,255,.25)', display: 'inline-block',
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ColorField({
  label, value, open, onToggle, onChange, herdado, onHerdar,
}: {
  label: string; value: string; open: boolean; onToggle: () => void; onChange: (v: string) => void
  /** Texto do estado herdado, quando a cor é opcional e ainda não foi escolhida. */
  herdado?: string
  onHerdar?: () => void
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--line-soft)', padding: '8px 0' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none',
          border: 0, padding: 0, textAlign: 'left', color: 'inherit',
        }}
      >
        <span
          style={{
            width: 22, height: 22, borderRadius: 6, background: value,
            border: '1px solid rgba(255,255,255,.25)', flex: '0 0 auto',
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 11, fontFamily: herdado ? 'inherit' : 'monospace' }}>
          {herdado ?? value}
        </span>
        <span className="muted" style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`swatch ${value.toLowerCase() === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => onChange(c)}
                aria-label={`cor ${c}`}
              />
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              type="color" value={value} onChange={(e) => onChange(e.target.value)}
              style={{ width: 44, padding: 2, height: 32 }}
            />
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
          </div>
          {onHerdar && !herdado && (
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={onHerdar}>
              Voltar a herdar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tamanhos de letreiro, em fração da altura da fuselagem.
 *
 * Era um controle contínuo de 12% a 70%, e continuar assim não faz sentido: a
 * arte limita o letreiro ao dorso (entre o topo da fuselagem e a fileira de
 * janela) e ao vão até a asa, então metade do curso do controle não mudava
 * nada — o número subia e a letra ficava igual, presa no teto da caixa. Cinco
 * degraus nomeados dizem o que se ganha, e o maior deles é o que a caixa
 * aguenta em qualquer aeronave da frota.
 */
const TAMANHOS_DE_LETREIRO = [
  { v: 0.16, label: 'Discreto' },
  { v: 0.22, label: 'Pequeno' },
  { v: 0.28, label: 'Médio' },
  { v: 0.36, label: 'Grande' },
  { v: 0.48, label: 'Enorme' },
]

/** O degrau mais perto do valor guardado — pinturas antigas caem no vizinho. */
function tamanhoDoLetreiro(v: number): number {
  return TAMANHOS_DE_LETREIRO.reduce((a, b) => (Math.abs(b.v - v) < Math.abs(a.v - v) ? b : a)).v
}

function Slider({
  label, value, min, max, step, display, onChange,
}: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="field" style={{ marginTop: 12 }}>
      <span>
        {label} — <b style={{ color: 'var(--ink-2)' }}>{display}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

function Select({
  label, value, options, onChange,
}: { label: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="field" style={{ marginTop: 12 }}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row" style={{ gap: 8, padding: '10px 0' }}>
      <input type="checkbox" checked={value} style={{ width: 'auto' }} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

/** Sorteia uma pintura coerente: uma cor de marca, um apoio e um corpo claro. */
function randomLivery(): Livery {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
  const brand = pick(['#e11d48', '#ea580c', '#eab308', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#0f172a'])
  const accent = pick(['#ffffff', '#facc15', '#22d3ee', '#f472b6', '#4ade80', '#f1f5f9'])
  const body = pick(['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#0f172a'])
  const dark = body === '#0f172a'
  return {
    ...BLANK_LIVERY,
    fuselage: body,
    belly: dark ? '#020617' : pick(['#cbd5e1', '#e2e8f0', '#94a3b8']),
    bellyAt: 0.5 + Math.random() * 0.35,
    nose: '#1e293b',
    noseStyle: pick(['body', 'dark', 'custom'] as const),
    cheat: brand,
    cheat2: accent,
    cheatStyle: pick(['straight', 'wide', 'double', 'wave', 'split', 'fade'] as const),
    cheatAt: 0.45 + Math.random() * 0.35,
    cheatWidth: 0.08 + Math.random() * 0.22,
    tail: brand,
    tailAccent: accent,
    tailStyle: pick(['solid', 'stripes', 'swoosh', 'gradient', 'split', 'chevron'] as const),
    stab: brand,
    emblem: pick(['none', 'none', ...EMBLEMS.filter((e) => e.id !== 'none').map((e) => e.id)]),
    emblemColor: accent,
    emblemAccent: dark ? '#f8fafc' : brand,
    wing: dark ? '#1e293b' : '#e2e8f0',
    winglet: brand,
    engine: dark ? '#1e293b' : '#e2e8f0',
    engineCowl: brand,
    titles: dark ? '#f8fafc' : brand,
    titleFont: pick(['wide', 'sans', 'serif', 'mono'] as const),
    titleSize: 0.26 + Math.random() * 0.18,
    titleAt: Math.random() * 0.3,
    windowColor: dark ? '#93c5fd' : '#1e293b',
  }
}
