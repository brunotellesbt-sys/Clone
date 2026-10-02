import { AIRPORT_BY_IATA, mesmoSistemaAeroportuario } from './data/airports'
import { distanceBetween } from './geo'

export const DESVIO_MAXIMO = 1.35
export const ETAPA_MINIMA_CONEXAO = 60

/** Regra única para oferta na malha, tela de rotas e venda de passagens. */
export function connectionPathAllowed(from: string, via: string, to: string, directAvailable = false) {
  const a = AIRPORT_BY_IATA[from], h = AIRPORT_BY_IATA[via], b = AIRPORT_BY_IATA[to]
  if (!a || !h || !b || from === via || via === to || from === to) return false
  if (mesmoSistemaAeroportuario(a, b)) return false
  const direct = distanceBetween(from, to)
  const first = distanceBetween(from, via), second = distanceBetween(via, to)
  // Alimentação regional sem direto: limita o desvio absoluto, não só a razão
  // entre cidades próximas. Não estende essa exceção a grandes desvios nacionais.
  const regional = !directAvailable && a.cc === h.cc && h.cc === b.cc &&
    Math.max(first, second) * 1.852 <= 1000 && (first + second) * 1.852 <= 1500 &&
    (first + second - direct) * 1.852 <= 900
  if (regional) return true
  // Em uma conexão internacional o hub pode ficar fora da linha direta (por
  // exemplo LIS–GRU–REC), desde que o desvio continue proporcional e não
  // vire uma volta ao mundo. A regra doméstica abaixo permanece mais rígida.
  const international = a.cc !== h.cc || h.cc !== b.cc
  if (international && !directAvailable) {
    return direct >= ETAPA_MINIMA_CONEXAO &&
      first + second <= direct * 1.8 && Math.max(first, second) <= direct * 1.55
  }
  if (direct < ETAPA_MINIMA_CONEXAO) return false
  return first + second <= direct * DESVIO_MAXIMO && Math.max(first, second) <= direct * 1.05
}
