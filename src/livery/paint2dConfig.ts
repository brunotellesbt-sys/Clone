import type { Paint2D, PaintMark2D } from '../game/types'

const color = (s: unknown) => typeof s === 'string' && /^#[a-f0-9]{6}$/i.test(s) ? s : undefined
const file = (s: unknown) => typeof s === 'string' && /^assets\/[a-f0-9]{24}\.(webp|png|jpg|jpeg|otf|ttf|svg)$/.test(s) ? s : undefined
const num = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
const slots = ['primary', 'secondary', 'third', 'alliance', 'tail', 'fuselage', 'engine', 'winglet'] as const

/** Saves e arquivos importados não podem introduzir URLs nem transformações ilimitadas. */
export function normalizePaint2d(raw: unknown): Record<string, Paint2D> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, Paint2D> = {}
  for (const [model, value] of Object.entries(raw).slice(0, 100)) {
    if (!/^[a-z0-9]+$/.test(model) || !value || typeof value !== 'object') continue
    const input = value as Record<string, unknown>
    const p: Paint2D = { layers: {}, marks: {} }
    if (input.layers && typeof input.layers === 'object') for (const [id, c] of Object.entries(input.layers).slice(0, 150)) {
      if (/^(options_)?[a-z0-9_]+$/.test(id) && (c === null || color(c))) p.layers![id] = c
    }
    p.engine = color(input.engine)
    if (typeof input.winglet === 'string' && /^[a-z_]{1,30}$/.test(input.winglet)) p.winglet = input.winglet
    p.eyeMask = input.eyeMask === true
    if (input.marks && typeof input.marks === 'object') for (const slot of slots) {
      const m = (input.marks as Record<string, PaintMark2D>)[slot]
      if (!m || typeof m !== 'object') continue
      p.marks![slot] = { text: typeof m.text === 'string' ? m.text.slice(0, 80) : undefined,
        file: file(m.file), font: file(m.font), color: color(m.color) ?? '#1d4ed8',
        x: num(m.x, .5, 0, 1), y: num(m.y, .3, 0, 1), scale: num(m.scale, .25, .02, 2), rotation: num(m.rotation, 0, -180, 180) }
    }
    out[model] = p
  }
  return out
}
