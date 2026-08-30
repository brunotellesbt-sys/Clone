import { AIRPORT_BY_IATA, type Airport } from './data/airports'

const R_NM = 3440.065 // raio da Terra em milhas náuticas
const rad = (d: number) => (d * Math.PI) / 180

/** Distância de grande círculo, em milhas náuticas. */
export function distanceNm(a: Airport, b: Airport): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const la1 = rad(a.lat)
  const la2 = rad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function distanceBetween(fromIata: string, toIata: string): number {
  return distanceNm(AIRPORT_BY_IATA[fromIata], AIRPORT_BY_IATA[toIata])
}

/** Chave canônica de um par origem/destino (independe do sentido). */
export const odKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`)

/** Ponto intermediário na rota de grande círculo, t entre 0 e 1. */
export function interpolate(a: Airport, b: Airport, t: number): [number, number] {
  const la1 = rad(a.lat), lo1 = rad(a.lon), la2 = rad(b.lat), lo2 = rad(b.lon)
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2,
      ),
    )
  if (d === 0) return [a.lon, a.lat]
  const A = Math.sin((1 - t) * d) / Math.sin(d)
  const B = Math.sin(t * d) / Math.sin(d)
  const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2)
  const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2)
  const z = A * Math.sin(la1) + B * Math.sin(la2)
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI]
}
