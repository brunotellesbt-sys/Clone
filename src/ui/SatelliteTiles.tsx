import { memo, useId, useLayoutEffect, useMemo, useState } from 'react'
import { satelliteTiles, type MapBounds, type MapViewport, type SatelliteTile } from './mapTiles'

type Entry={tile:SatelliteTile;status:'loading'|'loaded'|'error';image?:HTMLImageElement;timer?:ReturnType<typeof setTimeout>}
/** Fila por viewport: seis downloads, prioridade ao que está na tela, sem
 * acumular níveis intermediários de uma pinça. Mantém até 128 imagens prontas. */
class TileCache {
  entries=new Map<string,Entry>()
  desired:string[]=[]
  busy=new Set<string>()
  constructor(private changed:()=>void){}
  update(tiles:SatelliteTile[]){
    this.desired=[...new Set(tiles.map(t=>t.key))].slice(0,128)
    const wanted=new Set(this.desired)
    for(const [key,e] of this.entries)if(e.status==='loading'&&!wanted.has(key)){
      this.cancel(key,e);this.entries.delete(key)
    }
    for(const tile of tiles)if(wanted.has(tile.key)){
      const e=this.entries.get(tile.key)??{tile,status:'loading' as const}
      this.entries.delete(tile.key);this.entries.set(tile.key,e)
    }
    for(const [key,e] of this.entries){
      if(this.entries.size<=128)break
      if(!wanted.has(key)){this.cancel(key,e);this.entries.delete(key)}
    }
    this.pump();this.changed()
  }
  private cancel(key:string,e:Entry){
    clearTimeout(e.timer)
    if(e.status==='loading'&&e.image){e.image.onload=null;e.image.onerror=null;e.image.src=''}
    this.busy.delete(key)
  }
  private pump(){
    for(const key of this.desired){
      if(this.busy.size>=6)break
      const e=this.entries.get(key)
      if(!e||e.status!=='loading'||this.busy.has(key))continue
      this.busy.add(key)
      const img=new Image();e.image=img
      const done=(status:'loaded'|'error')=>{
        if(this.entries.get(key)!==e||e.status!=='loading')return
        clearTimeout(e.timer)
        if(status==='error'){img.onload=null;img.onerror=null;img.src=''}
        e.status=status;this.busy.delete(key);this.changed();this.pump()
      }
      img.onload=()=>{img.decode().then(()=>done('loaded'),()=>done('loaded'))}
      img.onerror=()=>done('error')
      e.timer=setTimeout(()=>done('error'),15000)
      img.src=e.tile.url
    }
  }
  dispose(){for(const [key,e] of this.entries)this.cancel(key,e);this.entries.clear();this.desired=[]}
}

export const SatelliteTiles = memo(function SatelliteTiles({ view, pixelScale, bounds }: {
  view: MapViewport; pixelScale: number; bounds: MapBounds
}) {
  const clip = useId().replace(/:/g, '')
  const [,refresh]=useState(0)
  const [cache]=useState(()=>new TileCache(()=>refresh(n=>n+1)))
  const tiles = useMemo(() => satelliteTiles(view, pixelScale, bounds), [view, pixelScale, bounds])
  // Antecipação central sem bloquear os blocos da posição atual.
  const ahead = useMemo(() => {
    const k=Math.min(1152,view.k*1.8),cx=500,cy=260
    return satelliteTiles({k,x:cx-(cx-view.x)*k/view.k,y:cy-(cy-view.y)*k/view.k},pixelScale,bounds)
  },[view,pixelScale,bounds])
  useLayoutEffect(()=>{cache.update([...tiles,...ahead])},[cache,tiles,ahead])
  useLayoutEffect(()=>()=>cache.dispose(),[cache])
  const current=new Set(tiles.map(t=>t.key))
  const display=[...cache.entries.values()].sort((a,b)=>a.tile.level-b.tile.level)
  return <g className="map-satellite-details" pointerEvents="none" clipPath={`url(#${clip})`}>
    <defs><clipPath id={clip}><rect x="0" y="10" width="1000" height="500" /></clipPath></defs>
    {display.map(({tile,status})=><image key={tile.key} className="map-satellite-tile" data-active={current.has(tile.key)} data-level={tile.level} data-status={status}
      href={status==='loaded'?tile.url:undefined} x={tile.x} y={tile.y} width={tile.size} height={tile.size} preserveAspectRatio="none" opacity={status==='loaded'?1:0}/>) }
  </g>
})
