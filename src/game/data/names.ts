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

/**
 * Peças para batizar as concorrentes geradas.
 *
 * O jogo passou de doze companhias escritas à mão para até quatrocentas,
 * geradas a partir do mapa, e não dá para escrever quatrocentos nomes. Estes
 * são os pedaços de que eles são feitos.
 *
 * Nada aqui é nome de companhia de verdade, e a escolha dos pedaços é
 * deliberada: são palavras de geografia, de céu e de metal — o vocabulário que
 * companhia aérea usa em todo lugar do mundo — e nenhuma delas carrega o nome
 * de um país, de uma companhia existente ou de uma marca. Um par que por
 * acaso lembre uma empresa real é acaso, e o jogo continua dizendo em toda
 * parte que as companhias dele são fictícias.
 */
export const PECAS_NOME = {
  /** Prefixos de lugar e de céu. */
  cabeca: [
    'Atlas', 'Vega', 'Zenith', 'Condor', 'Aurora', 'Halcyon', 'Solaris', 'Nimbus',
    'Vertex', 'Aurea', 'Boreal', 'Meridian', 'Cobalt', 'Lumen', 'Orion', 'Cirrus',
    'Pinnacle', 'Everest', 'Sirius', 'Tempest', 'Quartz', 'Onyx', 'Aster', 'Peregrine',
    'Marlin', 'Kestrel', 'Falcon', 'Ibis', 'Heron', 'Oriole', 'Lynx', 'Cedar',
    'Basalt', 'Granite', 'Delta Sul', 'Alba', 'Selva', 'Estuary', 'Harbour', 'Summit',
    'Corvus', 'Lyra', 'Altair', 'Rigel', 'Vela', 'Carina', 'Pavo', 'Tucana',
  ],
  /** Sufixos de companhia, em várias línguas. */
  cauda: [
    'Air', 'Airways', 'Linhas Aéreas', 'Jet', 'Wings', 'Air Lines', 'Express',
    'Connect', 'Aviación', 'Aero', 'Skyways', 'Airlink', 'Transportes Aéreos',
    'Luftlinien', 'Aérien', 'Volo', 'Havayolu', 'Airlines',
  ],
  /** Paleta das caudas: distinguíveis entre si no mapa e na lista. */
  cores: [
    '#e11d48', '#0ea5e9', '#f59e0b', '#10b981', '#b45309', '#dc2626', '#2563eb',
    '#a855f7', '#14b8a6', '#6366f1', '#ef4444', '#7c3aed', '#0891b2', '#65a30d',
    '#db2777', '#ea580c', '#4f46e5', '#059669', '#9333ea', '#0d9488',
  ],
} as const
