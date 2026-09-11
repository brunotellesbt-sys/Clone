/**
 * Emblemas fictícios pra cauda — nenhum remete a marca real, de propósito.
 * Silhueta única gerada pela Meshy (`public/sprites/emblems/`, ver
 * `.claude/skills/meshy-assets/`), fundo transparente, sem texto. A cor vem
 * do jogo: a imagem entra como máscara de alfa e é pintada com
 * `emblemColor`, sobre um crachá de fundo em `emblemAccent` — assim a mesma
 * silhueta muda de cara em cada companhia, mesmo sendo um PNG fixo.
 */
import type { EmblemId } from '../game/types'

export type { EmblemId }

export const EMBLEMS: { id: EmblemId; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'windrose', label: 'Rosa dos ventos' },
  { id: 'risingsun', label: 'Sol nascente' },
  { id: 'sweptwing', label: 'Asa varrida' },
  { id: 'doublewing', label: 'Asas duplas' },
  { id: 'falcon', label: 'Falcão' },
  { id: 'phoenix', label: 'Fênix' },
  { id: 'orbit', label: 'Órbita' },
  { id: 'starburst', label: 'Estrela radiante' },
  { id: 'shield', label: 'Escudo' },
  { id: 'crestwave', label: 'Onda' },
  { id: 'mountainpeak', label: 'Picos' },
  { id: 'arrowhead', label: 'Seta' },
  { id: 'quill', label: 'Pena' },
  { id: 'hexcell', label: 'Hexágono' },
  { id: 'gyre', label: 'Turbina' },
  { id: 'constellation', label: 'Constelação' },
  { id: 'cardinal', label: 'Rosa cardinal' },
  { id: 'halo', label: 'Halo' },
  { id: 'dartwing', label: 'Dardo' },
  { id: 'laurel', label: 'Louro' },
  { id: 'comet', label: 'Cometa' },
  { id: 'jetstream', label: 'Corrente de jato' },
  { id: 'deltaform', label: 'Formação delta' },
  { id: 'thunderbolt', label: 'Raio' },
  { id: 'contrail', label: 'Rastro' },
  { id: 'skylinearc', label: 'Horizonte' },
  { id: 'meridian', label: 'Meridiano' },
  { id: 'trident', label: 'Tridente' },
  { id: 'sailwing', label: 'Vela' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'chevronarc', label: 'Galões' },
  { id: 'clarion', label: 'Clarim' },
  { id: 'beacon', label: 'Farol' },
  { id: 'sextant', label: 'Sextante' },
  { id: 'astrolabe', label: 'Astrolábio' },
  { id: 'condor', label: 'Condor' },
  { id: 'dragonfly', label: 'Libélula' },
  { id: 'spiral', label: 'Espiral' },
  { id: 'helix', label: 'Hélice dupla' },
  { id: 'prism', label: 'Prisma' },
  { id: 'keystone', label: 'Pedra angular' },
  { id: 'obelisk', label: 'Obelisco' },
  { id: 'zenith', label: 'Zênite' },
  { id: 'tessera', label: 'Mosaico' },
  { id: 'rosette', label: 'Roseta' },
  { id: 'spearhead', label: 'Ponta de lança' },
  { id: 'bridgearch', label: 'Arco' },
  { id: 'citadel', label: 'Cidadela' },
  { id: 'pennant', label: 'Flâmula' },
  { id: 'trefoil', label: 'Trevo' },
]

/** Caminho do PNG do emblema, ou `null` para `'none'`. */
export function emblemHref(id: EmblemId, base = import.meta.env.BASE_URL): string | null {
  if (!id || id === 'none') return null
  return `${base}sprites/emblems/${id}.png`
}
