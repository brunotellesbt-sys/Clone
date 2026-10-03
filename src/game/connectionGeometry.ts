import { AIRPORT_BY_IATA, mesmoSistemaAeroportuario } from './data/airports'
import { distanceBetween } from './geo'

/** Limite de caminho alinhado; desvios excepcionais usam as regras abaixo. */
export const DESVIO_MAXIMO = 1.45
export const ETAPA_MINIMA_CONEXAO = 60

/** Regra única para oferta na malha, tela de rotas e venda de passagens. */
export function connectionPathAllowed(from: string, via: string, to: string, strictOnly = false) {
  const a = AIRPORT_BY_IATA[from], h = AIRPORT_BY_IATA[via], b = AIRPORT_BY_IATA[to]
  if (!a || !h || !b || from === via || via === to || from === to) return false
  if (mesmoSistemaAeroportuario(a, b)) return false
  const direct = distanceBetween(from, to)
  const first = distanceBetween(from, via), second = distanceBetween(via, to)
  // Alimentação regional sem direto: limita o desvio absoluto, não só a razão
  // entre cidades próximas. Cada trecho pode ter até 1.000 km; não aplica um
  // segundo teto menor à soma, que excluía CAW–BSB–VDC antes de comparar ofertas.
  // A distância adicional ainda limita a volta; malha.ts verifica alternativas.
  const regional = !strictOnly && a.cc === h.cc && h.cc === b.cc &&
    Math.max(first, second) * 1.852 <= 1000 &&
    (first + second - direct) * 1.852 <= 1100
  if (regional) return true
  // Em uma conexão internacional o hub pode ficar fora da linha direta (por
  // exemplo LIS–GRU–REC), desde que o desvio continue proporcional e não
  // vire uma volta ao mundo. A regra doméstica abaixo permanece mais rígida.
  const international = a.cc !== h.cc || h.cc !== b.cc
  if (international && !strictOnly) {
    return direct >= ETAPA_MINIMA_CONEXAO &&
      first + second <= direct * 1.8 && Math.max(first, second) <= direct * 1.55
  }
  if (direct < ETAPA_MINIMA_CONEXAO) return false
  // Um caminho alinhado, mesmo competindo com direto, pode aceitar até 45% de
  // acréscimo. Isso cobre, por exemplo, GIG–SSA–CKS (35,7%), mantendo o limite
  // de cada perna próximo do percurso original para impedir retornos.
  return first + second <= direct * DESVIO_MAXIMO && Math.max(first, second) <= direct * 1.05
}
