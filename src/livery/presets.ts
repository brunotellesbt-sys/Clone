import type { Livery, LiveryV1 } from '../game/types'

/** Base de qualquer pintura nova: branco de fábrica, sem enfeite. */
export const BLANK_LIVERY: Livery = {
  v: 2,
  fuselage: '#f8fafc',
  belly: '#cbd5e1',
  bellyAt: 0.62,
  nose: '#334155',
  noseStyle: 'body',
  cheat: '#1d4ed8',
  cheat2: '#93c5fd',
  cheatStyle: 'straight',
  cheatAt: 0.62,
  cheatWidth: 0.16,
  tail: '#1d4ed8',
  tailAccent: '#f8fafc',
  tailStyle: 'solid',
  stab: '#1d4ed8',
  wing: '#e2e8f0',
  winglet: '#1d4ed8',
  engine: '#e2e8f0',
  engineCowl: '#334155',
  gear: '#7b8798',
  titles: '#1d4ed8',
  titleFont: 'wide',
  titleSize: 0.34,
  titleAt: 0.16,
  regColor: '#475569',
  showReg: true,
  windows: true,
  windowColor: '#1e293b',
  doors: true,
}

const make = (patch: Partial<Livery>): Livery => ({ ...BLANK_LIVERY, ...patch })

export const LIVERY_PRESETS: { name: string; livery: Livery }[] = [
  { name: 'Clássica', livery: make({}) },
  {
    name: 'Tropical',
    livery: make({
      fuselage: '#ffffff', belly: '#e2e8f0', bellyAt: 0.66,
      cheat: '#16a34a', cheat2: '#facc15', cheatStyle: 'wave', cheatAt: 0.6, cheatWidth: 0.2,
      tail: '#facc15', tailAccent: '#16a34a', tailStyle: 'swoosh', stab: '#facc15',
      wing: '#f1f5f9', winglet: '#16a34a', engine: '#f1f5f9', engineCowl: '#166534',
      titles: '#166534', titleFont: 'sans',
    }),
  },
  {
    name: 'Meia-noite',
    livery: make({
      fuselage: '#0f172a', belly: '#020617', bellyAt: 0.7, nose: '#020617', noseStyle: 'custom',
      cheat: '#38bdf8', cheat2: '#0ea5e9', cheatStyle: 'double', cheatAt: 0.58, cheatWidth: 0.1,
      tail: '#0f172a', tailAccent: '#38bdf8', tailStyle: 'chevron', stab: '#0f172a',
      wing: '#1e293b', winglet: '#38bdf8', engine: '#1e293b', engineCowl: '#38bdf8',
      titles: '#e2e8f0', windowColor: '#93c5fd', regColor: '#94a3b8',
    }),
  },
  {
    name: 'Terracota',
    livery: make({
      fuselage: '#fef3c7', belly: '#fde68a', bellyAt: 0.58,
      cheat: '#b45309', cheat2: '#f59e0b', cheatStyle: 'wide', cheatAt: 0.66, cheatWidth: 0.26,
      tail: '#b45309', tailAccent: '#fef3c7', tailStyle: 'stripes', stab: '#b45309',
      wing: '#fde68a', winglet: '#b45309', engine: '#fde68a', engineCowl: '#7c2d12',
      titles: '#7c2d12', titleFont: 'serif',
    }),
  },
  {
    name: 'Metálica',
    livery: make({
      fuselage: '#94a3b8', belly: '#64748b', bellyAt: 0.5, nose: '#0f172a', noseStyle: 'dark',
      cheat: '#0f172a', cheat2: '#dc2626', cheatStyle: 'split', cheatAt: 0.6, cheatWidth: 0.14,
      tail: '#dc2626', tailAccent: '#0f172a', tailStyle: 'gradient', stab: '#dc2626',
      wing: '#94a3b8', winglet: '#dc2626', engine: '#475569', engineCowl: '#0f172a',
      titles: '#0f172a', titleFont: 'mono',
    }),
  },
  {
    name: 'Aurora',
    livery: make({
      fuselage: '#ffffff', belly: '#ede9fe', bellyAt: 0.68,
      cheat: '#7c3aed', cheat2: '#22d3ee', cheatStyle: 'fade', cheatAt: 0.6, cheatWidth: 0.22,
      tail: '#7c3aed', tailAccent: '#22d3ee', tailStyle: 'gradient', stab: '#7c3aed',
      wing: '#f5f3ff', winglet: '#22d3ee', engine: '#ede9fe', engineCowl: '#5b21b6',
      titles: '#5b21b6', titleFont: 'sans',
    }),
  },
  {
    name: 'Bandeirante',
    livery: make({
      fuselage: '#ffffff', belly: '#dbeafe', bellyAt: 0.72,
      cheat: '#15803d', cheat2: '#facc15', cheatStyle: 'double', cheatAt: 0.64, cheatWidth: 0.09,
      tail: '#15803d', tailAccent: '#facc15', tailStyle: 'split', stab: '#15803d',
      wing: '#eff6ff', winglet: '#facc15', engine: '#e2e8f0', engineCowl: '#15803d',
      titles: '#15803d', titleFont: 'wide',
    }),
  },
]

/** Converte a pintura antiga para o modelo por peça, sem perder as cores. */
export function migrateLivery(old: Livery | LiveryV1 | undefined | null): Livery {
  if (!old) return { ...BLANK_LIVERY }
  if ((old as Livery).v === 2) return { ...BLANK_LIVERY, ...(old as Livery) }
  const v1 = old as LiveryV1
  const cheatStyle = (['none', 'straight', 'wide', 'double', 'wave', 'split'] as const).includes(
    v1.cheatStyle as never,
  )
    ? (v1.cheatStyle as Livery['cheatStyle'])
    : 'straight'
  return {
    ...BLANK_LIVERY,
    fuselage: v1.base ?? BLANK_LIVERY.fuselage,
    belly: v1.belly ?? BLANK_LIVERY.belly,
    cheat: v1.cheat ?? BLANK_LIVERY.cheat,
    cheat2: v1.cheat ?? BLANK_LIVERY.cheat2,
    cheatStyle,
    tail: v1.tail ?? BLANK_LIVERY.tail,
    tailAccent: v1.tailAccent ?? BLANK_LIVERY.tailAccent,
    tailStyle: (v1.tailStyle as Livery['tailStyle']) ?? 'solid',
    stab: v1.tail ?? BLANK_LIVERY.stab,
    engine: v1.engine ?? BLANK_LIVERY.engine,
    winglet: v1.winglet ?? BLANK_LIVERY.winglet,
    titles: v1.titles ?? BLANK_LIVERY.titles,
    titleFont: (v1.titleFont as Livery['titleFont']) ?? 'wide',
    windows: v1.windows ?? true,
  }
}
