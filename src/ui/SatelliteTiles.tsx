import { memo, useEffect, useId, useMemo, useState } from 'react'
import { satelliteTiles, type MapBounds, type MapViewport, type SatelliteTile } from './mapTiles'

function Tile({ tile }: { tile: SatelliteTile }) {
  const [status, setStatus] = useState('loading')
  // Um pixel da imagem evita frestas escuras do antialiasing entre blocos adjacentes.
  const size = tile.size * (1 + 1 / 512)
  return <image className="map-satellite-tile" data-level={tile.level} data-status={status} href={tile.url}
    x={tile.x} y={tile.y} width={size} height={size} preserveAspectRatio="none"
    opacity={status === 'loaded' ? 1 : 0} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
}

export const SatelliteTiles = memo(function SatelliteTiles({ view, pixelScale, bounds }: {
  view: MapViewport; pixelScale: number; bounds: MapBounds
}) {
  const clip = useId().replace(/:/g, '')
  const [stableView, setStableView] = useState(view)
  // Evita baixar vários níveis intermediários durante pinça/roda; o fundo local continua visível.
  useEffect(() => {
    const timer = window.setTimeout(() => setStableView(view), 120)
    return () => window.clearTimeout(timer)
  }, [view])
  const tiles = useMemo(() => satelliteTiles(stableView, pixelScale, bounds), [stableView, pixelScale, bounds])
  return <g className="map-satellite-details" pointerEvents="none" clipPath={`url(#${clip})`}>
    <defs><clipPath id={clip}><rect x="0" y="10" width="1000" height="500" /></clipPath></defs>
    {tiles.map(tile => <Tile key={tile.key} tile={tile} />)}
  </g>
})
