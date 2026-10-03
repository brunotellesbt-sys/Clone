import { memo, useEffect, useId, useMemo, useState } from 'react'
import { satelliteTiles, type MapBounds, type MapViewport, type SatelliteTile } from './mapTiles'

const loadedImages=new Set<string>()
function Tile({ tile,active }: { tile: SatelliteTile;active:boolean }) {
  const [status, setStatus] = useState(loadedImages.has(tile.key)?'loaded':'loading')
  // Um pixel da imagem evita frestas escuras do antialiasing entre blocos adjacentes.
  const size = tile.size * (1 + 1 / 512)
  return <image className="map-satellite-tile" data-active={active} data-level={tile.level} data-status={status} href={tile.url}
    x={tile.x} y={tile.y} width={size} height={size} preserveAspectRatio="none"
    opacity={status === 'loaded' ? 1 : 0} onLoad={() => {loadedImages.add(tile.key);if(loadedImages.size>512)loadedImages.delete(loadedImages.values().next().value!);setStatus('loaded')}} onError={() => setStatus('error')} />
}

export const SatelliteTiles = memo(function SatelliteTiles({ view, pixelScale, bounds }: {
  view: MapViewport; pixelScale: number; bounds: MapBounds
}) {
  const clip = useId().replace(/:/g, '')
  const [stableView, setStableView] = useState(view)
  // Evita baixar vários níveis intermediários durante pinça/roda; o fundo local continua visível.
  useEffect(() => {
    const timer = window.setTimeout(() => setStableView(view), 60)
    return () => window.clearTimeout(timer)
  }, [view])
  const tiles = useMemo(() => satelliteTiles(stableView, pixelScale, bounds), [stableView, pixelScale, bounds])
  const [retained,setRetained]=useState<SatelliteTile[]>([])
  useEffect(()=>{
    setRetained(old=>{
      const combined=new Map(old.map(tile=>[tile.key,tile]))
      for(const tile of tiles){combined.delete(tile.key);combined.set(tile.key,tile)}
      return [...combined.values()].slice(-64)
    })
  },[tiles])
  const current=new Set(tiles.map(tile=>tile.key))
  // Mantém o detalhe anterior enquanto o novo chega. Limite fixo de nós e
  // mosaicos fora da janela não são desenhados durante a animação dos voos.
  const display=[...new Map([...retained,...tiles].map(tile=>[tile.key,tile])).values()]
    .filter(tile=>current.has(tile.key)||(loadedImages.has(tile.key)&&
      tile.x*view.k+view.x<=bounds.right&&(tile.x+tile.size)*view.k+view.x>=bounds.left&&
      tile.y*view.k+view.y<=bounds.bottom&&(tile.y+tile.size)*view.k+view.y>=bounds.top))
    .sort((a,b)=>a.level-b.level)
  return <g className="map-satellite-details" pointerEvents="none" clipPath={`url(#${clip})`}>
    <defs><clipPath id={clip}><rect x="0" y="10" width="1000" height="500" /></clipPath></defs>
    {display.map(tile => <Tile key={tile.key} tile={tile} active={current.has(tile.key)} />)}
  </g>
})
