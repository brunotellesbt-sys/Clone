export interface SeatRequest { id:string; market:string; first:string; second:string; wanted:number }

/** Reparte a procura entre TODOS os itinerários antes de ocupar os voos.
 * Cada reserva consome uma vaga nos dois trechos e no mesmo orçamento O&D.
 * A ordem alfabética de mercados não dá prioridade na venda. */
export function allocateSharedSeats(requests:SeatRequest[],markets:Map<string,number>,flights:Map<string,number>) {
  const marketTotal=new Map<string,number>(),flightTotal=new Map<string,number>()
  const add=(map:Map<string,number>,key:string,n:number)=>map.set(key,(map.get(key)??0)+n)
  for(const r of requests)add(marketTotal,r.market,Math.max(0,r.wanted))
  const targets=requests.map(r=>{
    const wanted=Math.max(0,r.wanted)*Math.min(1,(markets.get(r.market)??0)/Math.max(1e-9,marketTotal.get(r.market)??0))
    add(flightTotal,r.first,wanted);add(flightTotal,r.second,wanted)
    return {r,wanted}
  })
  const remainingMarket=new Map([...markets].map(([k,v])=>[k,Math.floor(v)]))
  const remainingFlight=new Map([...flights].map(([k,v])=>[k,Math.floor(v)]))
  const result=new Map<string,number>()
  const fractions:{r:SeatRequest;fraction:number}[]=[]
  let totalTarget=0,totalSold=0
  const room=(r:SeatRequest)=>Math.min(remainingMarket.get(r.market)??0,remainingFlight.get(r.first)??0,remainingFlight.get(r.second)??0)
  const sell=(r:SeatRequest,n:number)=>{
    result.set(r.id,(result.get(r.id)??0)+n);totalSold+=n
    add(remainingMarket,r.market,-n);add(remainingFlight,r.first,-n);add(remainingFlight,r.second,-n)
  }
  for(const {r,wanted} of targets){
    const target=wanted*Math.min(1,(flights.get(r.first)??0)/Math.max(1e-9,flightTotal.get(r.first)??0),
      (flights.get(r.second)??0)/Math.max(1e-9,flightTotal.get(r.second)??0))
    totalTarget+=target
    const count=Math.max(0,Math.min(Math.floor(target),room(r)))
    sell(r,count);fractions.push({r,fraction:target-Math.floor(target)})
  }
  // Maiores restos: evita perder um passageiro em cada combinação, sem criar
  // procura nem ultrapassar assentos. IDs resolvem somente empates exatos.
  fractions.sort((a,b)=>b.fraction-a.fraction||a.r.id.localeCompare(b.r.id))
  for(const {r,fraction} of fractions){
    if(totalSold>=Math.floor(totalTarget+1e-9))break
    if(fraction>1e-9&&room(r)>=1)sell(r,1)
  }
  return result
}
