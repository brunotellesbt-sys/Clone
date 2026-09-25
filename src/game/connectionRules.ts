import { AIRPORT_BY_IATA } from './data/airports'

// Bilhetes integrados no mesmo aeroporto. Troca de aeroporto não é conexão da malha.
// Fontes e limites de modelagem: docs/conexoes-itinerarios.md.
const SCHENGEN = new Set('AT BE BG HR CZ DK EE FI FR DE GR HU IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH'.split(' '))
const US_PRECLEARANCE = new Set('AUH AUA BDA NAS DUB SNN YYC YEG YHZ YUL YOW YYZ YVR YWG'.split(' '))

export function connectionWindow(from: string, via: string, to: string) {
  const a = AIRPORT_BY_IATA[from], h = AIRPORT_BY_IATA[via], b = AIRPORT_BY_IATA[to]
  if (!a || !h || !b) return { min: 180, max: 360, recheck: true }
  const arrivalInternational = a.cc !== h.cc
  const departureInternational = h.cc !== b.cc
  if (!arrivalInternational && !departureInternational) return { min: 40, max: 180, recheck: false }
  // Nos EUA, a admissão ocorre na primeira chegada, mesmo continuando ao exterior.
  if (h.cc === 'US' && arrivalInternational && !US_PRECLEARANCE.has(from))
    return { min: 180, max: 360, recheck: true }
  const throughBags = SCHENGEN.has(h.cc) || h.cc === 'GB' || via === 'BOG' ||
    (h.cc === 'US' && US_PRECLEARANCE.has(from))
  const recheck = arrivalInternational && !departureInternational && !throughBags
  return { min: recheck ? 180 : 60, max: recheck ? 360 : 240, recheck }
}
