/** NASA GIBS WMTS, CRS84/500m: origem (-180,90), blocos de 512 px e 288° no nível 0.
 * https://nasa-gibs.github.io/gibs-api-docs/access-basics/
 * Mesma projeção equiretangular dos aeroportos, sem reprojetar ou deslocar os voos. */
export interface MapViewport { k: number; x: number; y: number }
export interface MapBounds { left: number; top: number; right: number; bottom: number }
export const MAP_BOUNDS: MapBounds = { left: 0, top: 0, right: 1000, bottom: 520 }
export interface SatelliteTile { key: string; url: string; x: number; y: number; size: number; level: number }
export function satelliteTiles(view: MapViewport, pixelScale: number, bounds: MapBounds = MAP_BOUNDS): SatelliteTile[] {
  if (view.k < 2) return []
  const level = Math.max(0, Math.min(11, Math.ceil(Math.log2(800 * view.k * pixelScale / 512))))
  const size = 800 / 2 ** level
  const columns = Math.ceil(1000 / size), rows = Math.ceil(500 / size)
  const left = Math.max(0, Math.floor((bounds.left - view.x) / view.k / size) - 1)
  const right = Math.min(columns - 1, Math.floor((bounds.right - view.x) / view.k / size) + 1)
  const top = Math.max(0, Math.floor(((bounds.top - view.y) / view.k - 10) / size) - 1)
  const bottom = Math.min(rows - 1, Math.floor(((bounds.bottom - view.y) / view.k - 10) / size) + 1)
  const tiles: SatelliteTile[] = []
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    const key = `${level}/${row}/${col}`
    const span=288/2**level,west=-180+col*span,north=90-row*span
    const detail=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${west},${north-span},${west+span},${north}&bboxSR=4326&imageSR=4326&size=512,512&format=jpg&f=image`
    tiles.push({ key, level, x: col * size, y: 10 + row * size, size,
      url: level>7?detail:`https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/${key}.jpeg` })
  }
  return tiles
}
