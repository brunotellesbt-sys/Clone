import { admittedFlights, rivalFrequency, airportRevision } from './airportInfrastructure'
/**
 * O que a malha conecta.
 *
 * A escala — quem está onde, a que horas — mora em `escala.ts`. Aqui fica a
 * consequência comercial dela: quais chegadas alimentam quais partidas, quanto
 * isso vale em passageiro, e o que a tela precisa dizer sobre horário.
 *
 * A conexão passou a ser calculada **sobre pernas**, e isso é mais que uma troca
 * de estrutura. Antes, a unidade era a rotação de ida e volta, então só a volta
 * de uma rota podia alimentar a ida de outra. Numa malha de verdade quem alimenta
 * é qualquer chegada, venha ela de onde vier — inclusive de um voo que não volta
 * para lugar nenhum, porque a cauda segue para um terceiro aeroporto.
 *
 * Nada de React aqui: é `src/game/`, e a tela só lê o que sai daqui.
 */
import { AIRPORTS, AIRPORT_BY_IATA, mesmoSistemaAeroportuario, type Airport } from './data/airports'
import { connectionPathAllowed } from './connectionGeometry'
import { distanceNm } from './geo'
import { hashStr } from './rng'
import { blockHours } from './economy'
import { AIRCRAFT_BY_ID } from './data/aircraft'
import {
  adianteNaSemana, atratividadeHorario, DIA, escalaDe, naSemana, noTempo, pernasDaRota,
  partidaUtc, type PernaNoTempo,
} from './escala'
import type { GameState, Perna, Route } from './types'
import { connectionWindow } from './connectionRules'

export { DIA, SEMANA, hhmm, lerHora, atratividadeHorario } from './escala'

/**
 * Tempo mínimo de conexão, em minutos.
 *
 * Janelas de jogo acordadas com o jogador, conforme o procedimento de bagagem.
 * Não são tempos mínimos oficiais de aeroportos. As exceções por país e
 * aeroporto estão em connectionRules.ts.
 *
 * - **doméstica**: não sai da área restrita e a bagagem segue sozinha;
 * - **internacional sem redespacho**: pode haver controle de passaporte,
 *   mas a bagagem segue para o destino;
 * - **com alfândega**: o passageiro entra no país, pega a bagagem na esteira,
 *   passa na imigração e na receita e **redespacha** — é isso que custa as três
 *   horas, não a caminhada.
 */
export const MCT_DOMESTICA = 40
export const MCT_INTERNACIONAL = 60
export const MCT_ALFANDEGA = 180

/** Uma conexão acima disso não é conexão, é pernoite. */
export const ESPERA_MAXIMA = 360
export const esperaMaxima = (chegadaInternacional: boolean, partidaInternacional: boolean) =>
  chegadaInternacional && !partidaInternacional ? 360 : chegadaInternacional || partidaInternacional ? 240 : 180

/** A etapa cruza uma fronteira? Isso sozinho não decide se há redespacho. */
export const etapaInternacional = (a: Airport, b: Airport) => a.cc !== b.cc

/**
 * Referência genérica para consumidores antigos. Para um itinerário conhecido,
 * use connectionWindow(origem, hub, destino), que considera as exceções.
 */
export function mct(chegadaInternacional: boolean, partidaInternacional: boolean): number {
  if (chegadaInternacional === partidaInternacional) {
    return chegadaInternacional ? MCT_INTERNACIONAL : MCT_DOMESTICA
  }
  return chegadaInternacional ? MCT_ALFANDEGA : MCT_INTERNACIONAL
}

export const rotuloMct = (min: number) =>
  min === MCT_DOMESTICA ? 'doméstica' : min === MCT_INTERNACIONAL ? 'internacional em trânsito' : 'com alfândega'

/** Fuso do aeroporto, em minutos. Vem do tzdata — ver `FUSO` em `airports.ts`. */
export const fusoMin = (ap: Airport) => ap.fuso

// ------------------------------------------------------------------- conexões

/**
 * Um voo tocando a base: ou chegando nela, ou saindo dela.
 *
 * O voo da parceira de interline entra aqui do mesmo jeito, com `parceira`
 * preenchido — para o resto do cálculo ele é só mais uma chegada e mais uma
 * partida, que é o que ele é para o passageiro também.
 */
export interface Toque {
  /** Identificação do voo: a perna, ou a chave da rota da parceira. */
  id: string
  /** A outra ponta do voo — de onde ele veio, ou para onde ele vai. */
  ponta: string
  /** Minuto da semana, em UTC. */
  quando: number
  internacional: boolean
  /** Hora local na base. */
  local: number
  routeId?: string
  parceira?: string
  codeshare?: boolean
}

export interface Conexao {
  de: Toque
  para: Toque
  /** Minutos entre a chegada e a partida. */
  espera: number
  /** O mínimo exigido para esse par. */
  minimo: number
  parceira?: string
  codeshare?: boolean
}

const rotaDaPerna = (s: GameState, p: Perna) =>
  s.airline.routes.find(
    (r) => (r.from === p.from && r.to === p.to) || (r.from === p.to && r.to === p.from),
  )

function toqueDeChegada(s: GameState, t: PernaNoTempo): Toque {
  return {
    id: t.perna.id, ponta: t.perna.from, quando: t.chegada, internacional: t.internacional,
    local: t.chegadaLocal, routeId: rotaDaPerna(s, t.perna)?.id,
  }
}
function toqueDePartida(s: GameState, t: PernaNoTempo): Toque {
  return {
    id: t.perna.id, ponta: t.perna.to, quando: t.partida, internacional: t.internacional,
    local: t.perna.saida, routeId: rotaDaPerna(s, t.perna)?.id,
  }
}

/**
 * As duas pontas de uma rota de concorrente na **sua** base.
 *
 * A concorrente não tem escala de verdade: cada rota dela tem uma hora de
 * partida do hub dela e uma frequência. Daí sai o resto — se a base é o destino
 * dela, o voo chega depois do bloco e volta depois do solo.
 */
export function pontasDaConcorrente(
  cr: { key: string; from: string; to: string; hora?: number },
  base: string,
): { chega: number; parte: number; internacional: boolean; outraPonta: string } | null {
  const a = AIRPORT_BY_IATA[cr.from]
  const b = AIRPORT_BY_IATA[cr.to]
  if (!a || !b) return null
  const dist = distanceNm(a, b)
  // sem frota modelada, a referência é o porte que voaria a etapa
  const tipo = dist > 3000 ? AIRCRAFT_BY_ID.b789 : AIRCRAFT_BY_ID.a320
  const bloco = Math.round(blockHours(tipo, dist) * 60)
  const solo = tipo.turn
  const hora = horaDaConcorrente(cr)
  const internacional = etapaInternacional(a, b)
  if (cr.from === base) {
    return { parte: hora, chega: hora + 2 * bloco + solo, internacional, outraPonta: cr.to }
  }
  if (cr.to === base) {
    const delta = fusoMin(b) - fusoMin(a)
    const chega = hora + bloco + delta
    return { chega, parte: chega + solo, internacional, outraPonta: cr.from }
  }
  return null
}

/** Chegadas e partidas numa base, suas e das parceiras, em minuto da semana. */
export function toquesNaBase(s: GameState, base: string): { chegadas: Toque[]; partidas: Toque[] } {
  const chegadas: Toque[] = []
  const partidas: Toque[] = []
  for (const p of escalaDe(s)) {
    if (!admittedFlights(s).has(p.id)) continue
    if (p.from !== base && p.to !== base) continue
    const ac = s.airline.fleet.find(a => a.id === p.aircraftId)
    if (!ac || ac.groundedUntil > s.day || rotaDaPerna(s, p)?.cargo) continue
    const t = noTempo(s, p)
    if (p.to === base) chegadas.push(toqueDeChegada(s, t))
    if (p.from === base) partidas.push(toqueDePartida(s, t))
  }
  for (const comp of s.competitors) {
    if (!s.airline.acordos?.includes(comp.id) && !s.airline.codeshares?.includes(comp.id)) continue
    const codeshare = s.airline.codeshares?.includes(comp.id) ?? false
    for (const cr of comp.routes) {
      if (rivalFrequency(s, cr) <= 0) continue
      const p = pontasDaConcorrente(cr, base)
      if (!p) continue
      const fuso = AIRPORT_BY_IATA[base].fuso
      // a parceira voa todo dia; entra uma vez por dia da semana
      for (let dow = 0; dow < 7; dow++) {
        const id = `X:${comp.id}:${cr.key}:${dow}`
        chegadas.push({
          id, ponta: p.outraPonta, quando: naSemana(dow * DIA + p.chega - fuso),
          internacional: p.internacional, local: p.chega, parceira: comp.name, codeshare,
        })
        partidas.push({
          id, ponta: p.outraPonta, quando: naSemana(dow * DIA + p.parte - fuso),
          internacional: p.internacional, local: p.parte, parceira: comp.name, codeshare,
        })
      }
    }
  }
  return { chegadas, partidas }
}

/**
 * Todas as conexões possíveis numa base.
 *
 * Cada chegada é cruzada com cada partida que sai dentro da janela. Duas
 * exclusões, e as duas são de bom senso: a partida não pode ser a própria perna
 * que chegou, e não adianta conectar para o aeroporto de onde o passageiro
 * acabou de vir — ninguém voa Fortaleza–Rio–Fortaleza.
 */
interface TravelOption { departure:number; duration:number; distance:number; via?:string }
const cityKeys=new Map<string,string>()
function cityKey(id:string) {
  let key=cityKeys.get(id)
  if(!key){key=AIRPORTS.filter(a=>a.iata===id||mesmoSistemaAeroportuario(AIRPORT_BY_IATA[id],a)).map(a=>a.iata).sort()[0];cityKeys.set(id,key)}
  return key
}
const marketKey=(from:string,to:string)=>`${cityKey(from)}>${cityKey(to)}`
const marketCache=new WeakMap<GameState,{day:number;revision:number;options:Map<string,TravelOption[]>;timings:Map<string,PernaNoTempo>}>()
export function connectionAllowed(s:GameState,from:string,via:string,to:string,candidate?:Conexao) {
  // Caminhos naturalmente alinhados continuam competindo com diretos por
  // preço e horário. Só os desvios excepcionais precisam justificar a volta.
  if(connectionPathAllowed(from,via,to,true)) return true
  if(!connectionPathAllowed(from,via,to,false)) return false
  let market=marketCache.get(s)
  if(!market||market.day!==s.day||market.revision!==airportRevision(s)) {
    const options=new Map<string,TravelOption[]>(),timings=new Map<string,PernaNoTempo>()
    const operating=new Set(s.airline.fleet.filter(a=>a.groundedUntil<=s.day).map(a=>a.id))
    const passengerRoutes=new Set(s.airline.routes.filter(r=>!r.cargo).flatMap(r=>[`${r.from}>${r.to}`,`${r.to}>${r.from}`]))
    const add=(from:string,to:string,option:TravelOption)=>{
      const key=marketKey(from,to),list=options.get(key)??[]
      list.push(option);options.set(key,list)
    }
    for(const p of escalaDe(s))if(operating.has(p.aircraftId)&&admittedFlights(s).has(p.id)&&passengerRoutes.has(`${p.from}>${p.to}`)){
      const t=noTempo(s,p);timings.set(p.id,t)
      add(p.from,p.to,{departure:t.partida,duration:t.bloco,distance:distanceNm(AIRPORT_BY_IATA[p.from],AIRPORT_BY_IATA[p.to])})
    }
    // Apenas pares com horários compatíveis, de voos próprios. Não junta duas
    // concorrentes independentes para inventar um bilhete alternativo.
    for(const hub of s.airline.hubs) {
      for(const c of conexoesNaBase(s,hub,true)){
        const first=timings.get(c.de.id),second=timings.get(c.para.id)
        if(!first||!second||!connectionPathAllowed(c.de.ponta,hub,c.para.ponta,false))continue
        add(c.de.ponta,c.para.ponta,{via:hub,departure:first.partida,duration:first.bloco+c.espera+second.bloco,
          distance:distanceNm(AIRPORT_BY_IATA[c.de.ponta],AIRPORT_BY_IATA[hub])+distanceNm(AIRPORT_BY_IATA[hub],AIRPORT_BY_IATA[c.para.ponta])})
      }
    }
    // A IA oferece diretos, com o horário representativo usado no resto do
    // jogo; seus trechos não são combinados com os de outra companhia.
    for(const comp of s.competitors)for(const r of comp.routes)if(rivalFrequency(s,r)>0){
      const a=AIRPORT_BY_IATA[r.from],b=AIRPORT_BY_IATA[r.to]
      const distance=distanceNm(a,b),type=distance>3000?AIRCRAFT_BY_ID.b789:AIRCRAFT_BY_ID.a320
      const duration=Math.round(blockHours(type,distance)*60),hour=horaDaConcorrente(r)-a.fuso
      for(let day=0;day<7;day++){
        add(r.from,r.to,{departure:naSemana(day*DIA+hour),duration,distance})
        add(r.to,r.from,{departure:naSemana(day*DIA+hour+duration+type.turn),duration,distance})
      }
    }
    market={day:s.day,revision:airportRevision(s),options,timings};marketCache.set(s,market)
  }
  const candidates=candidate?[candidate]:conexoesNaBase(s,via,true).filter(c=>c.de.ponta===from&&c.para.ponta===to)
  const distance=distanceNm(AIRPORT_BY_IATA[from],AIRPORT_BY_IATA[via])+distanceNm(AIRPORT_BY_IATA[via],AIRPORT_BY_IATA[to])
  // Sem horários ainda, informa somente se o caminho é plausível.
  if(!candidates.length)return true
  return candidates.some(c=>{
    const first=market!.timings.get(c.de.id),second=market!.timings.get(c.para.id)
    if(!first||!second)return true
    const duration=first.bloco+c.espera+second.bloco
    return !(market!.options.get(marketKey(from,to))??[]).some(alt=>{
      if(alt.via===via||alt.distance>=distance*.8)return false
      const delta=naSemana(alt.departure-first.partida+7*DIA/2)-7*DIA/2
      return Math.abs(delta)<=180 && delta+alt.duration<=duration-60
    })
  })
}
const connectionsCache=new WeakMap<GameState,{day:number;revision:number;bases:Map<string,Conexao[]>}>()
export function conexoesNaBase(s: GameState, base: string, includeRejectedPaths = false): Conexao[] {
  let cache=connectionsCache.get(s)
  if(!cache||cache.day!==s.day||cache.revision!==airportRevision(s)) {
    cache={day:s.day,revision:airportRevision(s),bases:new Map()};connectionsCache.set(s,cache)
  }
  const cached=cache.bases.get(base)
  if(cached)return includeRejectedPaths?cached:cached.filter(c=>connectionAllowed(s,c.de.ponta,base,c.para.ponta,c))
  const { chegadas, partidas } = toquesNaBase(s, base)
  const sorted=partidas.flatMap(p=>[p,{...p,quando:p.quando+7*DIA}]).sort((a,b)=>a.quando-b.quando)
  const out: Conexao[] = []
  for (const de of chegadas) {
    let lo=0,hi=sorted.length
    while(lo<hi){const mid=(lo+hi)>>>1;if(sorted[mid].quando<de.quando+40)lo=mid+1;else hi=mid}
    for(let index=lo;index<sorted.length&&sorted[index].quando<=de.quando+ESPERA_MAXIMA;index++) {
      const para=sorted[index]
      if (de.id === para.id) continue
      if (de.ponta === para.ponta) continue
      // interline dos dois lados seria conexão entre dois voos que não são seus
      if (de.parceira && para.parceira) continue
      const espera = adianteNaSemana(de.quando, para.quando)
      const regra = connectionWindow(de.ponta, base, para.ponta)
      const minimo = regra.min
      if (espera < minimo || espera > regra.max) continue
      out.push({ de, para:{...para,quando:naSemana(para.quando)}, espera, minimo, parceira: de.parceira ?? para.parceira,
        codeshare: de.codeshare ?? para.codeshare })
    }
  }
  out.sort((x, y) => x.espera - y.espera)
  cache.bases.set(base,out)
  return includeRejectedPaths?out:out.filter(c=>connectionAllowed(s,c.de.ponta,base,c.para.ponta,c))
}

/**
 * Quanto uma conexão interline vale, comparada com uma da própria companhia.
 *
 * Interline permite um itinerário integrado entre empresas. O peso menor
 * representa a menor integração comercial em comparação com codeshare.
 */
export const DESCONTO_INTERLINE = 0.45

/** As conexões que alimentam ou são alimentadas por uma rota, em cada base. */
export function conexoesDaRota(s: GameState, r: Route, hub?: string) {
  const base = hub ?? (s.airline.hubs.includes(r.from) ? r.from : s.airline.hubs.includes(r.to) ? r.to : r.from)
  const todas = conexoesNaBase(s, base)
  return {
    base,
    /** Chega de outro voo e embarca nesta rota. */
    entrando: todas.filter((c) => c.para.routeId === r.id),
    /** Chega nesta rota e embarca em outro voo. */
    saindo: todas.filter((c) => c.de.routeId === r.id),
  }
}

/**
 * Voos desta rota que saem colados uns nos outros, no mesmo dia e sentido.
 *
 * Não é proibido — companhia de ponte aérea faz isso de propósito —, mas quase
 * sempre é desperdício: dois voos para o mesmo lugar com quinze minutos de
 * diferença dividem o mesmo pico de procura e voltam os dois pela metade.
 */
export const JANELA_COLADO = 30

export function voosColados(s: GameState, r: Route): [Perna, Perna][] {
  const pares: [Perna, Perna][] = []
  const pernas = pernasDaRota(s, r)
  for (let i = 0; i < pernas.length; i++) {
    for (let j = i + 1; j < pernas.length; j++) {
      const a = pernas[i]
      const b = pernas[j]
      if (a.dow !== b.dow || a.from !== b.from) continue
      if (Math.abs(a.saida - b.saida) <= JANELA_COLADO) pares.push([a, b])
    }
  }
  return pares
}

/**
 * Hora de partida de uma rota da concorrente.
 *
 * Estável e espalhada pela janela de operação: mesma chave, mesma hora, partida
 * após partida. Tirar da chave em vez de sortear mantém o save antigo válido e o
 * comportamento reproduzível na simulação de terminal.
 */
export function horaDaConcorrente(r: { key: string; hora?: number }): number {
  if (r.hora !== undefined) return r.hora
  return Math.round(6 * 60 + 15 * 60 * hashStr(`H${r.key}`))
}

/** De 0 a 1: quanto das partidas do dia sai entre 22h e 6h — o que a folha cobra a mais. */
export function fracaoNoturna(s: GameState, r: Route, dow?: number): number {
  const pernas = pernasDaRota(s, r).filter(p => dow === undefined || Math.floor(partidaUtc(p) / DIA) === dow)
  if (!pernas.length) return 0
  const noite = (min: number) => { const h = (min / 60) % 24; return h >= 22 || h < 6 }
  return pernas.filter((p) => noite(p.saida)).length / pernas.length
}

/** A média da rota no dia, que é o que entra na disputa por passageiro. */
export function atratividadeDaRota(s: GameState, r: Route, dow?: number): number {
  const pernas = pernasDaRota(s, r).filter(p => dow === undefined || Math.floor(partidaUtc(p) / DIA) === dow)
  if (!pernas.length) return 1
  return pernas.reduce((soma, p) => soma + atratividadeHorario(p.saida), 0) / pernas.length
}

/** Concorrentes abstratas mantêm estimativa de conectividade; o jogador vende itinerários. */
export const TETO_CONEXAO = 0.35
export const POR_CONEXAO = 0.025
export function fatorConexaoIA(rotasNoHub: number): number {
  return 1 + Math.min(TETO_CONEXAO, POR_CONEXAO * Math.max(0, rotasNoHub - 1))
}
