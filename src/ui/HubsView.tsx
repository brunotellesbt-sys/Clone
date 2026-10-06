import { useState } from 'react'
import { useGame } from '../store/useGame'
import { Card } from './components/Bits'
import { baseDemand } from '../game/demand'
import { money, num, pct, closeHub } from '../game/engine'
import {hubCompanies,hubCompanyLimit} from '../game/hubAccess'
import { AIRPORT_BY_IATA, ESCOPO_LABEL, SLOTS_BY_TIER } from '../game/data/airports'
import { airportSlots, largeOperations, physicalRunwayLimit, effectiveAirport, growthProgress, populationAt, startAirportWork, workOffer, WORK_LABEL, type WorkKind } from '../game/airportInfrastructure'

function Progress({label,value,total}:{label:string;value:number;total:number}){
 const ratio=Math.max(0,Math.min(1,value/Math.max(1,total)))
 return <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'10px 0'}}><span style={{flex:'1 1 180px'}}>{label}: <b>{num(value)} / {num(total)}</b></span><progress aria-label={label} value={ratio} max={1} style={{width:90,height:8,accentColor:'#3ddc97'}}/><small>{Math.floor(ratio*100)}%</small></div>
}
export function HubsView({bases=false}:{bases?:boolean}) {
  const {state:s,act,toast}=useGame()
  const [selected,setSelected]=useState(s.airline.hubs[0])
  const [closing,setClosing]=useState(false)
  const [confirm,setConfirm]=useState<WorkKind|null>(null)
  const [compare,setCompare]=useState('previous')
  const operations=bases?largeOperations(s):[]
  const options=bases?operations.map(a=>a.id):s.airline.hubs
  const id=options.includes(selected)?selected:options[0]
  if(!id)return <Card title="Bases grandes"><p>Aeroportos sem hub com pelo menos 30 pousos/decolagens da sua companhia no dia de pico aparecem aqui, mesmo com um único destino. Quinze idas e voltas no mesmo dia já contam como 30 movimentos em cada ponta. Sem contrato de hub, a progressão de slots leva 20% mais tempo.</p></Card>
  const isHub=s.airline.hubs.includes(id),idleDays=isHub?365:438
  const a=effectiveAirport(s,id),d=s.airportDevelopment?.[id],slots=airportSlots(s,id),progress=growthProgress(s,id)
  const weeks=d?.history??[],last=weeks.at(-1),previous=weeks.at(-2)
  const comparison=compare==='previous'?previous:weeks.find(w=>String(w.day)===compare)
  const weekLabel=(day:number)=>new Date(Date.UTC(s.startYear,0,1+day)).toLocaleDateString('pt-BR',{timeZone:'UTC'})
  const routes=s.airline.routes.filter(r=>!r.cargo&&(r.from===id||r.to===id))
  const remainingDays=Math.max(0,progress.daysNeeded-(d?.operatingDays??0))
  const remainingTraffic=Math.max(0,progress.paxNeeded-(d?.passengers??0)-3*(d?.connections??0))
  const delta=(v:number,old:number|undefined)=>old===undefined?'Primeira medição':`${v-old>=0?'+':''}${num(v-old)}`
  return <div className="grid hubs-panel">
    <Card title={bases?'Acompanhamento de bases grandes':'Acompanhamento de hubs'}>
      {bases&&<div aria-label="Suas bases por movimento" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>{operations.map(a=><button key={a.id} className={`btn${a.id===id?' primary':''}`} aria-pressed={a.id===id} onClick={()=>{setSelected(a.id);setConfirm(null);setClosing(false);setCompare('previous')}}>{a.id} · {a.movements} mov./dia</button>)}</div>}
      <label className="field"><span>{bases?'Base grande':'Hub'}</span><select value={id} onChange={e=>{setSelected(e.target.value);setConfirm(null);setClosing(false);setCompare('previous')}}>{options.map(h=><option key={h} value={h}>{h} — {AIRPORT_BY_IATA[h].city}</option>)}</select></label>
      <p>Companhias com hub neste aeroporto: <b>{hubCompanies(s,id)} / {hubCompanyLimit(s,id)}</b>. Nível 5: até 4; nível 4: até 3; níveis 1–3: até 2. Operar voos sem hub não ocupa uma dessas vagas.</p>
      {bases&&<p className="dim">Base grande: aeroporto sem hub com pelo menos 30 pousos/decolagens seus no dia de pico, mesmo com um único destino. Hubs aparecem somente na aba Hubs. Prazo e pontos de tráfego 20% maiores para crescimento; observação de slots ociosos por 438 dias. Nenhuma taxa de abertura.</p>}
      {id==='CGH'&&s.cghExtraSlotsGranted&&!!d?.personalSlots&&<p className="good">Concessão única: +{d.personalSlots} slots/dia exclusivos para sua companhia, sem precisar abrir hub.</p>}
      <p className="dim">Cada pouso ou decolagem usa um slot. Abrir uma rota não reserva capacidade. Os números de ocupação representam o dia de maior movimento da malha semanal.</p>
      {!bases&&<p className="dim">Sua reserva inicial cobre a malha existente e mais 10% de folga, entre 6 e 16 movimentos por dia. Um hub novo começa com 24. Slots ociosos do aeroporto só se tornam seus após um ano sem utilização; crescimento e obras também ampliam sua reserva.</p>}
      <div className="hub-metrics">
        <div><small>Slots disponíveis para sua malha</small><b>{num(slots.free)}</b></div>
        <div><small>Capacidade por dia</small><b>{num(slots.capacity)}{d?.work&&` / ${num(slots.normal)} sem obra`}</b></div>
        <div><small>Seus movimentos programados</small><b>{num(slots.own)}</b></div>
        <div><small>Outras companhias · programados</small><b>{num(slots.rivals)}</b></div>
        <div><small>Slots reservados para você</small><b>{num(slots.reserved)}</b></div>
        <div><small>Infraestrutura / categoria</small><b>Nível {a.tier}/5 · {ESCOPO_LABEL[a.escopo]}</b></div>
        <div><small>População da área atendida</small><b>{num(populationAt(s,id))}</b><small>{delta(last?.population??populationAt(s,id),previous?.population)} na última semana registrada</small></div>
        <div><small>Pista</small><b>{num(a.runway*.3048)} m</b></div>
      </div>
      {slots.over>0&&<p className="bad">A malha excede a capacidade em {num(slots.over)} movimentos no dia de pico. As escalas das aeronaves que não couberem ficam temporariamente suspensas por inteiro, para evitar aviões voando sem terem chegado à origem. A suspensão dura até você ajustar os horários ou a capacidade ser restaurada; a programação é preservada.</p>}
    </Card>
    <Card title="Quantos slots tem cada nível?">
      <p className="dim">Referência inicial de capacidade do aeroporto inteiro, compartilhada entre todas as companhias. Cada pouso ou decolagem ocupa 1 slot; uma ida e volta usa 2 em cada aeroporto.</p>
      <div className="rolagem-x"><table aria-label="Referência de slots por nível de infraestrutura"><thead><tr><th>Nível</th><th className="r">Slots/dia iniciais</th></tr></thead><tbody>{Object.entries(SLOTS_BY_TIER).map(([level,capacity])=><tr key={level} className={Number(level)===a.tier?'on':''}><td>Nível {level}{Number(level)===a.tier?' · atual':''}</td><td className="r">{num(capacity)}</td></tr>)}</tbody></table></div>
      <p><b>{id} hoje:</b> nível {a.tier}, com <b>{num(slots.normal)} slots/dia sem obra</b>, <b>{num(slots.capacity)} disponíveis fisicamente agora</b> e <b>{num(slots.free)} livres para acrescentar à sua malha</b>.</p>
      <p className="dim">A tabela não é um teto fixo nem uma quantidade garantida de slots livres. Crescimento, obras e a preservação da malha de saves existentes podem alterar a capacidade. Uma obra de slots acrescenta 35% da capacidade-base da partida (15% em SDU, CGH e PLU) e até um nível: não redefine a capacidade para o valor do próximo nível. Durante obras, a capacidade efetiva cai pela metade.</p>
    </Card>
    <div className="grid g2">
      <Card title="Próxima liberação de slots">
        <p>Próximo lote: <b>+{progress.increment} slots/dia</b>. Limite atual de população e infraestrutura: <b>{num(progress.populationLimit)}</b>.</p>
        <p>Faltam <b>{remainingDays} dias operando</b> e <b>{num(remainingTraffic)} pontos de tráfego</b>. Cada passageiro transportado soma 1; cada conexão atendida soma mais 3.</p>
        <p className="dim">Tempo-base por lote: 90 dias de operação em hub ou 108 dias em base grande. Tráfego, demanda e limite de infraestrutura também precisam atingir os requisitos.</p>
        <Progress label="Dias com operação" value={d?.operatingDays??0} total={progress.daysNeeded}/>
        <Progress label="Pontos de tráfego" value={(d?.passengers??0)+3*(d?.connections??0)} total={progress.paxNeeded}/>
        <Progress label="Demanda diária das rotas" value={d?.lastDemand??0} total={progress.demandNeeded}/>
        <p>O lote será liberado na primeira revisão semanal em que <b>as três barras estiverem completas</b>, houver espaço no limite populacional e não houver obra. As revisões acontecem às segundas-feiras do jogo. A demanda pode variar e voltar a ficar abaixo do requisito.</p>
        <p className="dim">Demanda nas rotas operadas: {num(d?.lastDemand??0)} / {num(progress.demandNeeded)} passageiros por dia. Os critérios são cumulativos e precisam ser atendidos juntos. Não há data garantida sem conhecer a malha futura. Eventos e procura semanal continuam variáveis.</p>
        {!progress.canGrow&&<p className="bad">O próximo lote depende de crescimento populacional ou ampliação da infraestrutura.</p>}
        <p>Tráfego acumulado desde o início do acompanhamento: {num(d?.passengers??0)} passageiros · {num(d?.connections??0)} conexões · {d?.operatingDays??0} dias de operação.</p>
        <Progress label="Dias observando slots ociosos" value={d?.idle.length??0} total={idleDays}/>
        <p>Redistribuição: faltam {Math.max(0,idleDays-(d?.idle.length??0))} dias de observação. Só entram slots livres para todas as companhias durante todo o período de {idleDays} dias. A transferência reserva capacidade existente; não cria slots.</p>
      </Card>
      <Card title="Movimento e variações semanais">
        <div className="rolagem-x"><table><thead><tr><th>Semana registrada em</th><th>Passageiros</th><th>Conexões</th><th>População</th><th>Slots/dia</th></tr></thead><tbody>{[...weeks].reverse().slice(0,12).map(w=><tr key={w.day}><td>{weekLabel(w.day)}</td><td>{num(w.passengers)}</td><td>{num(w.connections)}</td><td>{num(w.population)}</td><td>{w.capacity}</td></tr>)}</tbody></table></div>
        {!weeks.length&&<p className="muted">A primeira medição será publicada na próxima segunda-feira do jogo. Não inventamos histórico anterior do save.</p>}
        <p className="dim">Passageiros e conexões desta tabela são da sua companhia. Passageiros contam movimentos de chegada e saída; a conexão é contada uma vez no hub de transferência.</p>
      </Card>
    </div>
    <Card title={bases?'Demanda semanal nas rotas da base':'Demanda semanal nas rotas do hub'}>
      <label className="field"><span>Comparar demanda atual com</span><select value={compare} onChange={e=>setCompare(e.target.value)}><option value="previous">Semana anterior</option>{[...weeks].reverse().map(w=><option key={w.day} value={String(w.day)}>{weekLabel(w.day)}</option>)}</select></label>
      <div className="scroll"><table><thead><tr><th>Rota</th><th>Demanda/dia agora</th><th>Semana selecionada</th><th>Variação</th></tr></thead><tbody>{routes.map(r=>{const current=baseDemand(r.from,r.to,s.day,0,s.startYear,true,s).total;const old=comparison?.demands[r.id];return <tr key={r.id}><td>{r.from} → {r.to}</td><td>{num(current)}</td><td>{old===undefined?'—':num(old)}</td><td>{old?`${pct(current/old-1,1)} (${delta(current,old)})`:'Sem comparação'}</td></tr>})}</tbody></table></div>
      <p className="dim">Demanda soma ida e volta; não é a quantidade efetivamente transportada. O histórico mantém eventos, férias e crescimento da simulação.</p>
    </Card>
    {!bases&&<Card title="Encerrar contrato de hub">
      <p>Reembolso: <b>{money(s.hubInvestments?.[id]??0)}</b>. Devolve o investimento de abertura; o hub inicial gratuito não gera reembolso. Voos e aeronaves continuam operando. A reserva excedente de hub é liberada; uma base grande continua acumulando progresso mais lentamente.</p>
      <button className="btn" disabled={s.airline.hubs.length<=1||!!d?.work} onClick={()=>setClosing(true)}>Fechar hub</button>
      {s.airline.hubs.length<=1&&<p className="dim">É necessário manter pelo menos um hub principal.</p>}
      {d?.work&&<p className="dim">O contrato pode ser encerrado após a conclusão da obra.</p>}
      {closing&&<div><p>Encerrar {id} e receber {money(s.hubInvestments?.[id]??0)}?</p><button className="btn primary" onClick={()=>{const err=act(state=>closeHub(state,id));if(err)toast(err,'error');setClosing(false)}}>Confirmar fechamento</button> <button className="btn" onClick={()=>setClosing(false)}>Cancelar</button></div>}
    </Card>}
    {!bases&&<Card title="Obras e negociação">
      <div className="hub-metrics"><div><small>Interesse da administradora</small><b>{pct(d?.operator??0,2)}</b></div><div><small>Interesse do governo</small><b>{pct(d?.government??0,2)}</b></div></div>
      <p className="dim">O interesse é revisto semanalmente desde o início da operação, considerando a semana inteira. A administradora prioriza ocupação, movimento e conexões. O governo prioriza crescimento populacional e ligações diretas longas. Uma boa operação começa com avanço pequeno; o ritmo aumenta quando esses indicadores melhoram, e pode recuar se a operação desaparecer. 100% significa interesse aprovado. Ambos aprovados iniciam uma obra pública automaticamente; um aprovado permite negociar seu aporte.</p>
      {d?.work?<p className="alerta">{WORK_LABEL[d.work.kind]} em andamento: faltam <b>{Math.max(0,d.work.end-s.day)} dias</b>. Slots reduzidos de {slots.normal} para {slots.capacity}. {d.work.automatic?'Iniciativa conjunta pública, sem aporte seu.':`Seu aporte: ${money(d.work.contribution)}.`}</p>:<div className="hub-projects">{(['slots','runway','category'] as WorkKind[]).map(kind=>{const offer=workOffer(s,id,kind);return <section key={kind}>
        <h4>{WORK_LABEL[kind]}</h4><p>{kind==='slots'?`+${Math.ceil((d?.baseCapacity??slots.normal)*(['SDU','CGH','PLU'].includes(id)?.15:.35))} slots/dia e até um nível de infraestrutura`:kind==='runway'?`Até +610 m de pista, limite físico de ${num(physicalRunwayLimit(id)*.3048)} m`:a.escopo==='dom'?'Doméstico → regional':a.escopo==='reg'?'Regional → internacional':'Categoria máxima'}</p>
        <p>Prazo: {kind==='slots'?'1 ano':kind==='runway'?'2 anos':'2 anos e meio'}. Custo total: {money(offer.total)}. Seu aporte: <b>{money(offer.contribution)}</b>.</p>
        {offer.reason&&<p className="muted">{offer.reason}</p>}
        <button className="btn" disabled={!!offer.reason||s.airline.cash<offer.contribution} onClick={()=>setConfirm(kind)}>Revisar aporte</button>
      </section>})}</div>}
      {confirm&&!d?.work&&<div className="card"><p>Confirmar {WORK_LABEL[confirm].toLowerCase()} por {money(workOffer(s,id,confirm).contribution)}? Durante {workOffer(s,id,confirm).duration} dias a capacidade cai de {slots.normal} para {Math.floor(slots.normal/2)} movimentos/dia. Isso pode suspender voos. O aporte não é reembolsável.</p><button className="btn primary" onClick={()=>{const err=act(state=>startAirportWork(state,id,confirm));if(err)toast(err,'error');setConfirm(null)}}>Pagar e iniciar obra</button> <button className="btn" onClick={()=>setConfirm(null)}>Cancelar</button></div>}
      {!!d?.completed.length&&<p>Obras concluídas: {d.completed.map(w=>`${WORK_LABEL[w.kind]} (dia ${w.end})`).join(' · ')}.</p>}
    </Card>}
  </div>
}
