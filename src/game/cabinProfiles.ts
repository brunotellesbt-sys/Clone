import { checkCabin, clampPitch, normalizarCabine } from './cabin'
import { AIRCRAFT_BY_ID, ehCargueiro } from './data/aircraft'
import { normalizeSeatPitch, normalizeSeats } from './seatModels'
import { CABINS, type CabineSalva, type Cabins, type GameState, type SeatConfig } from './types'

type CabinLayout = Pick<CabineSalva, 'seats' | 'pitch' | 'seatConfig'>

/** Classes sem assentos não fazem parte da configuração instalada. */
export const chaveCabine = ({ seats, pitch, seatConfig }: CabinLayout) => JSON.stringify(
  CABINS.map(c => seats[c] > 0 ? [seats[c], pitch[c], seatConfig?.[c]?.style, seatConfig?.[c]?.layout] : []),
)

export const cabinesDoModelo = (s: GameState, typeId: string) =>
  (s.airline.cabines ?? []).filter(c => c.typeId === typeId)

function adicionarCabine(s: GameState, typeId: string, layout: CabinLayout, nome: string) {
  const lista = (s.airline.cabines ??= [])
  const ids = new Set(lista.map(c => c.id))
  let numero = lista.length + 1
  while (ids.has(`cb-${numero}`)) numero++
  lista.push({ ...structuredClone(layout), id: `cb-${numero}`, nome, typeId })
}

/** Registra a configuração entregue pela fábrica ou pela oficina. */
export function guardarCabineInstalada(s: GameState, typeId: string, layout: CabinLayout) {
  const lista = cabinesDoModelo(s, typeId)
  const chave = chaveCabine(layout)
  if (lista.some(c => chaveCabine(c) === chave)) return
  const nomes = new Set(lista.map(c => c.nome.toLowerCase()))
  let numero = lista.length + 1
  while (nomes.has(`cabine ${numero}`)) numero++
  adicionarCabine(s, typeId, layout, `Cabine ${numero}`)
}

/** Permite guardar uma cabine em edição sem pagar a reforma. */
export function salvarCabine(
  s: GameState, typeId: string, nome: string, seats: Cabins, pitch: Cabins, seatConfig?: SeatConfig,
): string | null {
  const t = AIRCRAFT_BY_ID[typeId]
  if (!t) return 'Modelo inexistente.'
  const limpo = nome.trim().slice(0, 32)
  if (!limpo) return 'Dê um nome à configuração.'
  const cfg = normalizeSeats(t, seatConfig, pitch)
  const p = seatConfig ? clampPitch(pitch) : normalizeSeatPitch(clampPitch(pitch), cfg)
  const chk = checkCabin(t, seats, p, seatConfig ?? cfg)
  if (!chk.ok) return chk.seatError ?? 'Essa configuração não é válida. Ajuste antes de salvar.'

  const layout = { seats, pitch: p, seatConfig: cfg }
  const lista = cabinesDoModelo(s, typeId)
  const chave = chaveCabine(layout)
  const igual = lista.find(c => chaveCabine(c) === chave)
  if (igual) return renomearCabine(s, igual.id, limpo)

  const anterior = lista.find(c => c.nome.toLowerCase() === limpo.toLowerCase())
  if (anterior) Object.assign(anterior, structuredClone(layout), { nome: limpo })
  else adicionarCabine(s, typeId, layout, limpo)
  return null
}

export function renomearCabine(s: GameState, id: string, nome: string): string | null {
  const cabine = s.airline.cabines?.find(c => c.id === id)
  if (!cabine) return 'Configuração não encontrada.'
  const limpo = nome.trim().slice(0, 32)
  if (!limpo) return 'Dê um nome à configuração.'
  if (cabinesDoModelo(s, cabine.typeId).some(c => c.id !== id && c.nome.toLowerCase() === limpo.toLowerCase()))
    return 'Já existe uma configuração com esse nome para este modelo.'
  cabine.nome = limpo
  return null
}

export function apagarCabine(s: GameState, id: string): string | null {
  const lista = s.airline.cabines
  const i = lista?.findIndex(c => c.id === id) ?? -1
  if (!lista || i < 0) return 'Configuração não encontrada.'
  lista.splice(i, 1)
  return null
}

/** Os saves antigos podiam ter a mesma cabine guardada com nomes diferentes. */
export function migrarCabines(lista: CabineSalva[], idsRenomeados: Record<string, string>): CabineSalva[] {
  const chaves = new Set<string>()
  return lista.flatMap(c => {
    const typeId = idsRenomeados[c.typeId] ?? c.typeId
    const t = AIRCRAFT_BY_ID[typeId]
    if (!t || ehCargueiro(t)) return []
    const layout = normalizarCabine(t, c.seats, clampPitch(c.pitch), c.seatConfig)
    const chave = `${typeId}:${chaveCabine(layout)}`
    if (chaves.has(chave)) return []
    chaves.add(chave)
    return [{ ...c, ...layout, typeId }]
  })
}
