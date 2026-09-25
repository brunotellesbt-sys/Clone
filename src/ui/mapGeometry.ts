import { geoInterpolate, type GeoProjection } from 'd3-geo'
import type { Airport } from '../game/data/airports'

/** A posição e a tangente usam o mesmo grande círculo do traçado D3. */
export function flightPose(project: GeoProjection, a: Airport, b: Airport, phase: number, worldWidth = 1000) {
  const curve = geoInterpolate([a.lon, a.lat], [b.lon, b.lat])
  const t = Math.max(0, Math.min(1, phase))
  const point = project(curve(t))!
  const before = project(curve(Math.max(0, t - 0.00001)))!
  const after = project(curve(Math.min(1, t + 0.00001)))!
  let dx = after[0] - before[0]
  // Cruzar a linha de data não inverte o rumo.
  if (dx > worldWidth / 2) dx -= worldWidth
  if (dx < -worldWidth / 2) dx += worldWidth
  return { x: point[0], y: point[1], angle: Math.atan2(after[1] - before[1], dx) * 180 / Math.PI }
}

/** Sprites do APK têm nariz para baixo; o ícone de contingência aponta para cima. */
export const spriteRotation = (original: boolean) => original ? -90 : 90
export const MAP_MAX_ZOOM = 72
