import {useEffect,useRef,useState} from 'react'
import {DIA,DOW_CURTO,hhmm,naSemana,pernasDe,quebrasDe} from '../../game/escala'
import {AIRPORT_BY_IATA} from '../../game/data/airports'
import type {Aircraft} from '../../game/types'
import {useGame} from '../../store/useGame'

// AircraftFlightScheduleSection do APK: coluna 38, corpo 528, margens
// verticais 10 + 15/2 e marcas a cada duas horas.
export const APK_WEEK={header:38,body:528,axis:38,padding:17.5}
export function Grade({ac}:{ac:Aircraft}) {
  const {state}=useGame(),container=useRef<HTMLDivElement>(null)
  const [width,setWidth]=useState(350),[selected,setSelected]=useState<string|null>(null)
  useEffect(()=>{
    const el=container.current;if(!el)return
    const observer=new ResizeObserver(()=>setWidth(Math.max(240,el.clientWidth)))
    observer.observe(el);setWidth(Math.max(240,el.clientWidth))
    return()=>observer.disconnect()
  },[])
  useEffect(()=>setSelected(null),[ac.id])
  const legs=pernasDe(state,ac.id),breaks=quebrasDe(state,ac.id)
  const reference=state.airline.hubs[0],offset=AIRPORT_BY_IATA[reference]?.fuso??0
  const {header,body,axis,padding}=APK_WEEK,dayWidth=(width-axis)/7,usable=body-2*padding
  const y=(minute:number)=>header+padding+minute/DIA*usable
  const blocks=legs.flatMap(p=>{
    const start=naSemana(p.partida+offset),end=start+p.bloco,out=[]
    for(let cursor=start;cursor<end;){
      const next=Math.min((Math.floor(cursor/DIA)+1)*DIA,end)
      out.push({p,dow:Math.floor(cursor/DIA)%7,from:cursor%DIA,to:next-cursor+cursor%DIA,continuation:cursor>start})
      cursor=next
    }
    return out
  })
  const chosen=legs.find(p=>p.perna.id===selected)
  return <div className="apk-week" ref={container}>
    <p className="muted" style={{fontSize:12,margin:'0 0 8px'}}>{legs.length} voos na semana · {(legs.reduce((n,p)=>n+p.bloco,0)/60).toFixed(1)} h de voo · referência {reference}</p>
    {breaks.length>0&&<p className="warn" style={{fontSize:12}}>⚠ {breaks.length} {breaks.length===1?'quebra':'quebras'} na escala: há necessidade de posicionamento vazio. Confira os trechos em Rotas.</p>}
    <svg className="apk-week-chart" role="img" aria-label={`Escala semanal de ${ac.reg}, somente consulta`} viewBox={`0 0 ${width} ${header+body}`} width="100%" height={header+body} style={{display:'block',background:'#111923',border:'1px solid #394553',borderRadius:6}}>
      <rect x={0} y={0} width={width} height={header} fill="#233343"/>
      <text x={axis/2} y={header/2+4} textAnchor="middle" fontSize={13} fill="#c5d4e0">◷</text>
      {DOW_CURTO.map((day,dow)=><g key={day}>
        <text x={axis+(dow+.5)*dayWidth} y={header/2+4} textAnchor="middle" fontSize={10} fill="#d6e1eb">{day}</text>
        <line x1={axis+dow*dayWidth} x2={axis+dow*dayWidth} y1={header} y2={header+body} stroke="#42505c" strokeWidth={.5}/>
      </g>)}
      {Array.from({length:13},(_,i)=>i*2).map(hour=><g key={hour}>
        <line x1={axis} x2={width} y1={y(hour*60)} y2={y(hour*60)} stroke="#42505c" strokeWidth={.5}/>
        <text x={axis-5} y={y(hour*60)+3} textAnchor="end" fontSize={9.5} fill="#b2bfcc">{String(hour).padStart(2,'0')}:00</text>
      </g>)}
      {blocks.map(({p,dow,from,to,continuation},i)=>{
        const h=(to-from)/DIA*usable,x=axis+dow*dayWidth+2,w=dayWidth-4
        const active=selected===p.perna.id,label=`${p.perna.from} → ${p.perna.to}, sai ${DOW_CURTO[p.perna.dow]} ${hhmm(p.perna.saida)}, pousa ${DOW_CURTO[p.dowChegada]} ${hhmm(p.chegadaLocal)} local`
        return <g key={`${p.perna.id}:${i}`} className="apk-week-flight" data-flight-id={p.perna.id} data-from-minute={from} data-to-minute={to} role="button" tabIndex={0} aria-label={label} onClick={()=>setSelected(active?null:p.perna.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(active?null:p.perna.id)}}} style={{cursor:'pointer'}}>
          <title>{label}</title>
          <rect x={x} y={y(from)} width={w} height={h} fill={active?'#efb647':'#267fa4'} stroke={active?'#fff0c2':'#76c5db'} strokeWidth={.6}/>
          {h>=12&&<text x={x+w/2} y={y(from)+h/2+(h>=26?-3:3)} textAnchor="middle" fontSize={9.5} textLength={h<26?Math.min(w-4,42):undefined} lengthAdjust="spacingAndGlyphs" fill={active?'#16212d':'#eefaff'} pointerEvents="none">{h>=26?p.perna.from:`${p.perna.from}→${p.perna.to}`}</text>}
          {h>=26&&<text x={x+w/2} y={y(from)+h/2+9} textAnchor="middle" fontSize={9.5} fill={active?'#16212d':'#eefaff'} pointerEvents="none">↓{p.perna.to}</text>}
          {h>=62&&<text x={x+w/2} y={y(from)+h/2+23} textAnchor="middle" fontSize={9} fill={active?'#16212d':'#eefaff'} pointerEvents="none">{continuation?'continua':hhmm(p.perna.saida)}</text>}
        </g>
      })}
    </svg>
    {chosen&&<p className="aviso" style={{fontSize:12,margin:'8px 0'}}><b>{chosen.perna.from} → {chosen.perna.to}</b> · partida {DOW_CURTO[chosen.perna.dow]} {hhmm(chosen.perna.saida)} · pouso {DOW_CURTO[chosen.dowChegada]} {hhmm(chosen.chegadaLocal)}. Horários locais de cada ponta.</p>}
    {!legs.length&&<p className="muted">Aeronave sem voos programados.</p>}
    <p className="muted" style={{fontSize:12,margin:'8px 0 0'}}>Grade fixa de 00h a 24h no horário de {reference}. Toque em um bloco para consultar os horários locais. Para alterar a escala, use Rotas.</p>
  </div>
}

export function ondeEsta(state:ReturnType<typeof useGame>['state'],ac:Aircraft):string {
  return pernasDe(state,ac.id).at(-1)?.perna.to??ac.base??state.airline.hubs[0]??'—'
}
