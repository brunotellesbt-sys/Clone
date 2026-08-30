/** Companhias fictícias — nomes inventados, nenhuma relação com empresas reais. */
export const AI_AIRLINES: { name: string; code: string; hub: string; color: string }[] = [
  { name: 'Andes Continental', code: 'AC', hub: 'SCL', color: '#e11d48' },
  { name: 'Aurora Nordic', code: 'AN', hub: 'CPH', color: '#0ea5e9' },
  { name: 'Meridian Air', code: 'MD', hub: 'JFK', color: '#f59e0b' },
  { name: 'Pacifica Wings', code: 'PW', hub: 'SIN', color: '#10b981' },
  { name: 'Copperline', code: 'CP', hub: 'JNB', color: '#b45309' },
  { name: 'Vermelho Linhas Aéreas', code: 'VM', hub: 'GRU', color: '#dc2626' },
  { name: 'Baltic Blue', code: 'BB', hub: 'FRA', color: '#2563eb' },
  { name: 'Sahara Star', code: 'SS', hub: 'DXB', color: '#a855f7' },
  { name: 'Monsoon Air', code: 'MA', hub: 'DEL', color: '#14b8a6' },
  { name: 'Southern Cross', code: 'SX', hub: 'SYD', color: '#6366f1' },
  { name: 'Rising Sun Air', code: 'RS', hub: 'HND', color: '#ef4444' },
  { name: 'Cardinal Express', code: 'CE', hub: 'ORD', color: '#7c3aed' },
]

const SUFFIX = ['Air', 'Airways', 'Linhas Aéreas', 'Jet', 'Wings', 'Air Lines', 'Express', 'Connect']
const PREFIX = ['Atlas', 'Vega', 'Norte', 'Zenith', 'Condor', 'Aurora', 'Halcyon', 'Solaris', 'Nimbus', 'Vertex', 'Aurea', 'Boreal']

export function suggestAirlineName(rng: () => number) {
  const p = PREFIX[Math.floor(rng() * PREFIX.length)]
  const s = SUFFIX[Math.floor(rng() * SUFFIX.length)]
  return `${p} ${s}`
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export function suggestCode(rng: () => number) {
  return LETTERS[Math.floor(rng() * 26)] + LETTERS[Math.floor(rng() * 26)]
}
