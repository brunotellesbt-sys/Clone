export type OrdenacaoRotas = 'dist-asc' | 'dist-desc' | 'demand-desc' | 'demand-asc'

export const ORDENACOES_ROTAS: { id: OrdenacaoRotas; label: string }[] = [
  { id: 'dist-asc', label: 'Distância ↑' },
  { id: 'dist-desc', label: 'Distância ↓' },
  { id: 'demand-desc', label: 'Demanda ↓' },
  { id: 'demand-asc', label: 'Demanda ↑' },
]

export function compararPorOrdenacao(
  ordem: OrdenacaoRotas,
  a: { distance: number; demand: number },
  b: { distance: number; demand: number },
) {
  if (ordem === 'dist-asc') return a.distance - b.distance
  if (ordem === 'dist-desc') return b.distance - a.distance
  if (ordem === 'demand-asc') return a.demand - b.demand
  return b.demand - a.demand
}

