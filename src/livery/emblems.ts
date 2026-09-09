/**
 * Emblemas fictícios pra cauda — nenhum remete a marca real, de propósito.
 * Formas geométricas simples, num quadro de 100×100, pra caber dentro de
 * qualquer caixa quadrada sem precisar recortar. Sempre desenhados em duas
 * cores (a livery já tem `tail` e `tailAccent`), então o mesmo emblema muda
 * de cara em cada companhia.
 */
import type { EmblemId } from '../game/types'

export type { EmblemId }

export const EMBLEMS: { id: EmblemId; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'fan', label: 'Leque' },
  { id: 'chevron', label: 'Galões' },
  { id: 'star', label: 'Estrela' },
  { id: 'arc', label: 'Arco' },
  { id: 'diamond', label: 'Losango' },
  { id: 'wing', label: 'Ala' },
]

/** Caminho SVG de cada emblema, em duas camadas (base e destaque). */
export function emblemPaths(id: EmblemId): { base: string[]; accent: string[] } {
  switch (id) {
    case 'fan': {
      const spokes = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2
        const x2 = (50 + Math.cos(a) * 40).toFixed(1)
        const y2 = (50 + Math.sin(a) * 40).toFixed(1)
        return `M50 50 L${x2} ${y2}`
      })
      return {
        base: ['M50 4 A46 46 0 1 1 49.99 4 Z M50 12 A38 38 0 1 0 50.01 12 Z'],
        accent: [...spokes, 'M50 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0'],
      }
    }
    case 'chevron':
      return {
        base: ['M50 6 L92 50 L74 50 L50 24 L26 50 L8 50 Z'],
        accent: ['M50 46 L92 90 L74 90 L50 64 L26 90 L8 90 Z'],
      }
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 46 : 20
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`
      })
      return { base: [`M${pts.join(' L')} Z`], accent: ['M50 50 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0'] }
    }
    case 'arc':
      return {
        base: ['M6 78 A44 44 0 0 1 94 78 L78 78 A28 28 0 0 0 22 78 Z'],
        accent: ['M6 78 A44 44 0 0 1 50 34 L50 50 A28 28 0 0 0 22 78 Z'],
      }
    case 'diamond':
      return {
        base: ['M50 4 L88 50 L50 96 L12 50 Z'],
        accent: ['M50 4 L88 50 L50 50 Z M50 96 L12 50 L50 50 Z'],
      }
    case 'wing':
      return {
        base: ['M4 62 L96 62 L96 74 L4 74 Z', 'M50 6 L62 62 L38 62 Z'],
        accent: ['M4 62 L50 46 L96 62 L50 74 Z'],
      }
    default:
      return { base: [], accent: [] }
  }
}
