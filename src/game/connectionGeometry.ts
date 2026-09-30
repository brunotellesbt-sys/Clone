import { AIRPORT_BY_IATA, mesmoSistemaAeroportuario } from './data/airports'
import { distanceBetween } from './geo'

export const DESVIO_MAXIMO = 1.8
export const ETAPA_MINIMA_CONEXAO = 60

/** Regra única para oferta na malha, tela de rotas e venda de passagens. */
export function connectionPathAllowed(from: string, via: string, to: string) {
  const a = AIRPORT_BY_IATA[from], h = AIRPORT_BY_IATA[via], b = AIRPORT_BY_IATA[to]
  if (!a || !h || !b || from === via || via === to || from === to) return false
  if (mesmoSistemaAeroportuario(a, b)) return false
  const direct = distanceBetween(from, to)
  if (direct < ETAPA_MINIMA_CONEXAO) return false
  return distanceBetween(from, via) + distanceBetween(via, to) <= direct * DESVIO_MAXIMO
}
