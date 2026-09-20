import { useEffect, useMemo, useState } from 'react'
import { AIRCRAFT_BY_ID, acLabel, ehCargueiro, type AircraftType } from '../game/data/aircraft'
import {
  AIRPORTS, AIRPORT_BY_IATA, ESCOPO_LABEL, vooPermitido, type Airport,
} from '../game/data/airports'
import { baseDemand, cargoDemand, CLASS_FARE_MULT } from '../game/demand'
import { distanceBetween, odKey } from '../game/geo'
import { CAMBIO, moedaDoPais, tarifa } from '../game/money'
import { compararPorOrdenacao, ORDENACOES_ROTAS, type OrdenacaoRotas } from '../game/routeOrdering'
import { aeroportoServe, pistaServe } from '../game/spec'
import {
  closeRoute, dayOfYear, estimateRoute, km, money, num, openRoute, pct,
  routeEconomics, routeSlotCost, setFare, slotsFree,
} from '../game/engine'
import { CABIN_LABEL, CABINS, CABIN_SHORT, type Route } from '../game/types'
import { useGame } from '../store/useGame'
import { Bar, Card, Empty, Modal, Spark } from './components/Bits'
import { Horarios } from './components/Horarios'

export function RoutesView() {
  const { state } = useGame()
  const [hubFiltro, setHubFiltro] = useState<string>('todos')
  const [ordem, setOrdem] = useState<OrdenacaoRotas>('dist-asc')
  const [selId, setSelId] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  useEffect(() => {
    if (hubFiltro !== 'todos' && !state.airline.hubs.includes(hubFiltro)) setHubFiltro('todos')
  }, [hubFiltro, state.airline.hubs])
  const routes = useMemo(() => {
    const doy = dayOfYear(state)
    return state.airline.routes
      .filter((r) => hubFiltro === 'todos' || r.from === hubFiltro || r.to === hubFiltro)
      .map((r) => ({
        route: r,
        demand: r.cargo ? cargoDemand(r.from, r.to, state.day, doy).tons : baseDemand(r.from, r.to, state.day, doy).total,
      }))
      .sort((x, y) => compararPorOrdenacao(
        ordem,
        { distance: x.route.distance, demand: x.demand },
        { distance: y.route.distance, demand: y.demand },
      ))
      .map((x) => x.route)
  }, [state, state.airline.routes, state.day, state.startYear, hubFiltro, ordem])
  const sel = routes.find((r) => r.id === selId) ?? routes[0] ?? null

  return (
   <div className="grid" style={{ gap: 14 }}>
   <div className="split">
     <Card
       title={`Rotas (${routes.length})`}
       right={(
         <div className="row tight">
           <label className="field" style={{ marginBottom: 0 }}>
             <span>Hub</span>
             <select value={hubFiltro} onChange={(e) => setHubFiltro(e.target.value)}>
               <option value="todos">Todos</option>
               {state.airline.hubs.map((h) => (
                 <option key={h} value={h}>{h}</option>
               ))}
             </select>
           </label>
           <label className="field" style={{ marginBottom: 0 }}>
             <span>Ordenar</span>
             <select value={ordem} onChange={(e) => setOrdem(e.target.value as OrdenacaoRotas)}>
               {ORDENACOES_ROTAS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
             </select>
           </label>
           <button className="btn primary sm" onClick={() => setOpening(true)}>Abrir rota</button>
         </div>
       )}
     >
       {routes.length === 0 ? (
         <Empty>Nenhuma rota. Toda linha precisa sair de uma das suas bases ({state.airline.hubs.join(', ')}).</Empty>
        ) : (
          <div className="scroll alta">
            <table>
              <thead>
                <tr>
                  <th>Rota</th><th className="r">Distância</th><th className="r">Aviões</th><th className="r">Voos</th>
                  <th className="r">Aproveit.</th><th className="r">Fatia</th><th className="r">Resultado 14d</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const e = routeEconomics(state, r)
                  return (
                    <tr key={r.id} className={`click ${sel?.id === r.id ? 'on' : ''}`} onClick={() => setSelId(r.id)}>
                      <td><b>{r.from} → {r.to}</b><br /><span className="muted">{AIRPORT_BY_IATA[r.to].city}</span></td>
                      <td className="r">{km(r.distance)}</td>
                      <td className="r">{r.aircraftIds.length}</td>
                      <td className="r">{Math.max(...r.freq)}/dia</td>
                      <td className="r">{e.days ? pct(e.loadFactor, 1) : '—'}</td>
                      <td className="r">{pct(e.share)}</td>
                      <td className={`r ${e.profit >= 0 ? 'good' : 'bad'}`}>{money(e.profit)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {sel ? <RouteDetail route={sel} onClosed={() => setSelId(null)} /> : <Card title="Detalhe"><Empty>Selecione uma rota.</Empty></Card>}
      {opening && <OpenRouteModal onClose={() => setOpening(false)} onOpened={(id) => { setSelId(id); setOpening(false) }} />}
    </div>
    {/* horários e conexões ocupam a largura toda: a malha não cabe na coluna
        estreita, e é a tela mais densa da rota */}
    {sel && <Horarios route={sel} />}
    </div>
  )
}

function RouteDetail({ route, onClosed }: { route: Route; onClosed: () => void }) {
  const { state, act } = useGame()
  const e = routeEconomics(state, route)
  const hist = route.history.map((h) => h.profit)
  // A passagem é vendida onde a viagem começa: a rota é lida na moeda da origem.
  const moeda = moedaDoPais(AIRPORT_BY_IATA[route.from].cc)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title={`${route.from} → ${route.to} · ${AIRPORT_BY_IATA[route.to].city}`}>
        <div className="grid g2" style={{ gap: 8, fontSize: 13, marginBottom: 10 }}>
          <div><span className="muted">Distância</span><br />{km(route.distance)}</div>
          <div><span className="muted">Demanda total</span><br />{num(e.demandaDia)} {e.unidade}/dia</div>
          <div><span className="muted">Atendido por você</span><br />{num(e.atendidoDia)} {e.unidade}/dia</div>
          <div><span className="muted">Restante da demanda</span><br />{num(e.restanteDia)} {e.unidade}/dia</div>
          <div><span className="muted">Sua fatia</span><br />{pct(e.share, 1)}</div>
          <div>
            <span className="muted">{e.cargo ? 'Frete base' : 'Tarifa base'}</span><br />
            {tarifa(e.demand.refFare, moeda, e.cargo ? '/t' : '')}
          </div>
        </div>
        <Spark values={hist.length > 1 ? hist : [0, 0]} w={330} h={44} color={e.profit >= 0 ? '#34d399' : '#fb7185'} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>resultado diário</span>
          <span className={e.profit >= 0 ? 'good' : 'bad'}>{money(e.profit)} em {e.days} dias</span>
        </div>
      </Card>

      {!e.cargo && (
        <Card title="Cobertura de demanda por classe">
          <table>
            <thead>
              <tr>
                <th>Classe</th><th className="r">Demanda total/dia</th>
                <th className="r">Atendido/dia</th><th className="r">Restante/dia</th>
              </tr>
            </thead>
            <tbody>
              {CABINS.filter((c) =>
                c !== 'f' || e.demand.pax.f > 0 || e.atendidoDiaCabine.f > 0 || e.restanteDiaCabine.f > 0).map((c) => (
                  <tr key={c}>
                    <td><b>{CABIN_SHORT[c]}</b> — {CABIN_LABEL[c]}</td>
                    <td className="r">{num(e.demand.pax[c])}</td>
                    <td className="r">{num(e.atendidoDiaCabine[c])}</td>
                    <td className="r">{num(e.restanteDiaCabine[c])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
            Demanda total é o mercado do dia; atendido é sua média recente; restante é o que ainda falta para cobrir 100%.
          </p>
        </Card>
      )}

      {/*
        * Duas telas saíram daqui: "Quem voa esta rota" e "Frequência".
        *
        * Elas eram o jeito antigo de operar, de quando a rota era dona da
        * aeronave — dedicar uma cauda montava ida e volta nos sete dias, e a
        * frequência pedia um número por dia e o jogo marcava o que coubesse.
        * Desde que a escala passou a ser por perna, as duas viraram um segundo
        * caminho para a mesma coisa, com outro vocabulário e nenhum controle
        * de horário: o jogador pedia cinco, recebia três e não sabia em que
        * hora nem com qual cauda.
        *
        * Quem marca voo agora é `NovoVoo`, logo abaixo, com dia, hora e cauda
        * à vista — e tirar continua sendo por perna, na lista da semana ou no
        * próprio bloco da grade.
        */}

      <Card title="Tarifas">
        {CABINS.filter((c) =>
          e.cargo ? c === 'y' : (c !== 'f' || e.demand.pax.f > 0 || e.atendidoDiaCabine.f > 0 || e.restanteDiaCabine.f > 0))
          .map((c) => {
          const abs = e.demand.refFare * CLASS_FARE_MULT[c] * route.fare[c]
          const sugerida = e.demand.refFare * CLASS_FARE_MULT[c] * e.sugestaoFare[c]
          return (
            <label className="field" key={c}>
              <span>
                {CABIN_LABEL[c]} — {tarifa(abs, moeda)} ({route.fare[c].toFixed(2)}× a referência)
                {!e.cargo && (
                  <span className="muted">
                    {' '}· sugestão 100%: {tarifa(sugerida, moeda)} ({e.sugestaoFare[c].toFixed(2)}×)
                  </span>
                )}
              </span>
              <input
                type="range" min={0.55} max={1.9} step={0.01} value={route.fare[c]}
                onChange={(ev) => act((s) => setFare(s, route.id, c, +ev.target.value))}
              />
            </label>
          )
        })}
        {!e.cargo && (
          <button
            className="btn sm"
            onClick={() => act((s) => {
              for (const c of CABINS) {
                if (c === 'f' && e.demand.pax.f <= 0 && e.atendidoDiaCabine.f <= 0 && e.restanteDiaCabine.f <= 0) continue
                setFare(s, route.id, c, e.sugestaoFare[c])
              }
            })}
          >
            Aplicar sugestão (~100% demanda)
          </button>
        )}
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Barato enche o avião e rouba mercado, mas derruba a receita por passageiro. A econômica é a mais
          sensível a preço; a executiva quase não liga.
          {moeda !== 'USD' && (
            <> A passagem é vendida em {CAMBIO[moeda].nome}, a moeda de {AIRPORT_BY_IATA[route.from].country};
            o resto da companhia — caixa, custo, frota — segue em dólar.</>
          )}
        </p>
      </Card>

      <button className="btn danger" onClick={() => { act((s) => closeRoute(s, route.id)); onClosed() }}>
        Encerrar rota
      </button>
    </div>
  )
}

/**
 * Até que aeronave o par aceita — o ícone, e o menu por trás dele.
 *
 * Distância e mercado dizem se a rota vale; nenhum dos dois diz **com o quê**
 * voar, e essa é a primeira pergunta de quem planeja. Antes o jogador só
 * descobria depois de escolher o destino e ler a lista de melhores aviões, o
 * que transforma a lista de noventa destinos numa fila de tentativa e erro.
 *
 * O rótulo fechado é o teto: o maior que pousa nas duas pontas. Aberto, o menu
 * mostra os cinco maiores, e o que barra o resto — pista ou porte, com o número
 * que faltou.
 *
 * O menu é `position: fixed` ancorado no próprio botão, e não `absolute`, por um
 * motivo simples: a lista de destinos rola, e um filho posicionado dentro de um
 * `overflow: auto` é cortado pela borda dele. Na quarta linha — a última
 * visível, que é exatamente onde o jogador mais desce para olhar — o menu
 * aparecia pela metade.
 */
function Porte({ lista, carga, de, para }: {
  lista: AircraftType[]; carga: boolean; de: string; para: string
}) {
  const [onde, setOnde] = useState<{ top: number; right: number } | null>(null)
  const medida = (t: AircraftType) => (carga ? `${t.payload ?? 0} t` : `${t.maxSeats} lug`)
  if (lista.length === 0) {
    return <span className="bad" style={{ fontSize: 11 }}>nenhuma</span>
  }
  const teto = lista[0]
  // O gargalo é a ponta que aceita menos: é ela que o jogador precisa ver.
  const pontas = [AIRPORT_BY_IATA[de], AIRPORT_BY_IATA[para]]
  const gargalo = pontas.find((p) => !aeroportoServe(teto, p)) ??
    [...pontas].sort((x, y) => (x.tetoAssentos ?? x.runway) - (y.tetoAssentos ?? y.runway))[0]
  return (
    <details
      className="porte"
      onClick={(e) => e.stopPropagation()}
      onToggle={(e) => {
        const d = e.currentTarget
        if (!d.open) return setOnde(null)
        const r = d.getBoundingClientRect()
        setOnde({ top: r.bottom + 5, right: window.innerWidth - r.right })
      }}
    >
      {/* O rótulo é o **modelo**, não o número de lugares: "até 853 lug" é uma
          medida, e quem planeja frota pensa em "até A380". A medida fica no
          menu, ao lado de cada modelo. */}
      {/* Quem limita aparece no próprio rótulo quando é a **base**, que é o
          caso que confunde: ver "A320neo" ao lado de Cabo Frio faz parecer que
          o teto é de Cabo Frio, quando os 2.550 m de lá recebem A330 e quem
          tem 4.341 ft é Santos Dumont. O menu já explicava; o rótulo, não, e é
          o rótulo que se lê sem clicar.

          No celular ele some: a coluna do destino tem 140px de folga medidos
          pelo `npm run destinos`, e a sigla extra comia 32 deles. Lá o menu
          continua sendo o caminho, e ele cabe. */}
      <summary title={`Até ${acLabel(teto)} — ${medida(teto)} · quem limita é ${gargalo.iata}`}>
        <span aria-hidden>✈</span> {teto.name}
        {gargalo.iata === de && <span className="muted so-largo"> · {de}</span>}
      </summary>
      {onde && (
        <div className="porte-menu" style={{ top: onde.top, right: onde.right }}>
          <h5>Maiores que operam {de} ↔ {para}</h5>
          {lista.slice(0, 5).map((t) => (
            <div key={t.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
              <span>{acLabel(t)}</span>
              <span className="muted">{medida(t)}</span>
            </div>
          ))}
          <p className="muted">
            {gargalo.tetoAssentos !== undefined
              ? `${gargalo.iata} recebe até ${gargalo.tetoAssentos} lugares — teto do aeroporto, não da pista.`
              : `${gargalo.iata} tem ${num(gargalo.runway)} ft de pista a ${num(gargalo.elev)} ft.`}
            {' '}Acima disso a aeronave não sai de uma das duas pontas.
          </p>
        </div>
      )}
    </details>
  )
}

/**
 * Etapa mais curta que a lista oferece, em **milhas náuticas**.
 *
 * A unidade é a da simulação inteira — `distanceBetween` devolve nm, e a tela
 * converte para quilômetro só na hora de mostrar. Um comentário anterior aqui
 * dizia "quilômetros" no mesmo número, e a prosa mentia por um fator de 1,85.
 *
 * Eram 110, e 110 escondia aeroporto que existe: Santos Dumont–Macaé são 84 nm
 * (156 km) e foi rota de linha de verdade por causa do petróleo, porque a
 * estrada leva três horas. Cabo Frio, a 60 nm (112 km), sumia pelo mesmo
 * motivo. O jogador procurava
 * pelo nome e não achava nada — o aeroporto estava no catálogo, a lista é que
 * não mostrava.
 *
 * Quem decide se o par vale a pena é a demanda, que já cobra caro por etapa
 * colada (15% até 60 nm, subindo até as 120). Aqui só ficam de fora os pares
 * que são a mesma cidade — Galeão e Santos Dumont a 8 nm, Guarulhos e
 * Congonhas a 13, Heathrow e Gatwick a 21 —, que é o que estas 45 nm (83 km)
 * cortam.
 */
const ETAPA_MINIMA = 45

function OpenRouteModal({ onClose, onOpened }: { onClose: () => void; onOpened: (id: string) => void }) {
  const { state, act, toast } = useGame()
  const [hub, setHub] = useState(state.airline.hubs[0])
  const [ordem, setOrdem] = useState<OrdenacaoRotas>('dist-asc')
  const [q, setQ] = useState('')
  const [dest, setDest] = useState<string | null>(null)
  // Passageiro ou carga é escolha da abertura: a rota nasce sem aeronave, então
  // não dá para deduzir da frota alocada.
  const [carga, setCarga] = useState(false)
  const doy = dayOfYear(state)

  const options = useMemo(() => {
    const open = new Set(state.airline.routes.map((r) => odKey(r.from, r.to)))
    // Quantos concorrentes voam cada par, contado uma vez: com três mil destinos
    // na lista, varrer as rotas de cada concorrente por destino era três mil
    // varreduras por tecla digitada.
    const rivais = new Map<string, number>()
    for (const c of state.competitors) {
      for (const r of c.routes) rivais.set(r.key, (rivais.get(r.key) ?? 0) + 1)
    }
    const busca = q.trim().toLowerCase()
    const base = AIRPORT_BY_IATA[hub]
    return AIRPORTS.filter((a) => a.iata !== hub && !open.has(odKey(hub, a.iata)))
      // O filtro de texto vem antes das contas: medir demanda de três mil
      // destinos a cada tecla é trabalho jogado fora quando o jogador já disse
      // o que procura.
      .filter((a) => !busca || `${a.iata} ${a.city} ${a.country}`.toLowerCase().includes(busca))
      .map((a) => {
        const dist = distanceBetween(hub, a.iata)
        const dp = baseDemand(hub, a.iata, state.day, doy)
        const dc = cargoDemand(hub, a.iata, state.day, doy)
        const d = carga
          ? { ...dp, total: dc.tons, refFare: dc.refRate }
          : dp
        // O destino barrado continua na lista, desativado e com o motivo: assim
        // o jogador aprende a regra de alfândega em vez de nunca ver o aeroporto
        return { a, dist, demand: d, rivals: rivais.get(odKey(hub, a.iata)) ?? 0, barrado: vooPermitido(base, a) }
      })
      .filter((o) => o.dist > ETAPA_MINIMA)
      .sort((x, y) => {
        const barrado = Number(!!x.barrado) - Number(!!y.barrado)
        if (barrado) return barrado
        return compararPorOrdenacao(
          ordem,
          { distance: x.dist, demand: x.demand.total },
          { distance: y.dist, demand: y.demand.total },
        )
      })
      .slice(0, 90)
  }, [hub, q, state, doy, carga, ordem])

  /**
   * O que **as duas pontas** aceitam, do maior para o menor.
   *
   * Filtrar só pelo destino responde a pergunta errada. Uma base de pista curta
   * não deixa de ser pista curta porque o destino é Guarulhos: o voo tem duas
   * decolagens, e a menor das duas é que manda. Mostrar um A350 no teto de um
   * destino que a base do jogador não consegue encher seria vender aeronave que
   * ele nunca vai poder marcar naquele par.
   */
  const porteAte = (destino: Airport) => {
    const b = AIRPORT_BY_IATA[hub]
    const ano = state.startYear + state.day / 365
    return Object.values(AIRCRAFT_BY_ID)
      .filter((t) => ehCargueiro(t) === carga && ano >= t.since &&
        aeroportoServe(t, b) && aeroportoServe(t, destino))
      .sort((x, y) => (y.maxSeats || y.payload || 0) - (x.maxSeats || x.payload || 0))
  }

  const chosen = options.find((o) => o.a.iata === dest) ?? null
  const usable = chosen
    ? Object.values(AIRCRAFT_BY_ID).filter(
        (t) => ehCargueiro(t) === carga &&
          t.range >= chosen.dist &&
          pistaServe(t, AIRPORT_BY_IATA[hub], chosen.a) &&
          state.startYear + state.day / 365 >= t.since,
      )
    : []
  /**
   * Cada aeronave é medida na **melhor frequência dela**, não numa arbitrada.
   *
   * A versão anterior dava a cada modelo a frequência que enchia o avião três
   * vezes — e isso premia avião pequeno por construção: frequência entra na
   * disputa por passageiro, então o menor, voando mais vezes, levava mais
   * fatia. O resultado ficava errado de um jeito visível: o A320neo aparecia
   * **abaixo** do A320-200 que ele substitui, embora custe $39,98 por assento
   * contra $43,04 do ceo. A conta não estava comparando aeronave, estava
   * comparando frequência.
   *
   * Agora cada modelo é varrido pela faixa de frequências que ele aguenta e
   * entra na lista com a que der mais lucro — que é o que um planejador faz. A
   * frequência escolhida aparece no cartão: é decisão, não detalhe.
   */
  const best = chosen && usable.length
    ? usable
        .map((t) => {
          const porAviao = t.maxSeats || (t.payload ?? 1)
          const cheio = Math.max(1, Math.round(chosen.demand.total / (porAviao * 3)))
          /**
           * O teto é o slot, não a vontade.
           *
           * Sem ele a varredura saturava no maior número que ela tentava — em
           * Santos Dumont–Congonhas todo modelo "queria" quarenta voos por dia,
           * porque o mercado é grande o bastante para absorver e o modelo não
           * cobra nada por isso. Quem cobra é o aeroporto: cada rotação gasta
           * dois movimentos em cada ponta, e é a mesma conta que `setFrequency`
           * já faz na hora de marcar de verdade.
           */
          const teto = Math.max(
            1,
            Math.min(
              Math.floor(Math.min(slotsFree(state, hub), slotsFree(state, chosen.a.iata)) / 2),
              cheio * 3,
            ),
          )
          let melhor = { freq: 1, est: estimateRoute(state, hub, chosen.a.iata, t.id, 1) }
          for (const freq of [2, 3, 4, 6, 8, 10, 14, 20, 28, 40, teto]) {
            if (freq > teto) continue
            const est = estimateRoute(state, hub, chosen.a.iata, t.id, freq)
            if (est.profit > melhor.est.profit) melhor = { freq, est }
          }
          return { t, freq: melhor.freq, est: melhor.est }
        })
        .sort((x, y) => y.est.profit - x.est.profit)
        .slice(0, 4)
    : []

  return (
    <Modal title="Abrir nova rota" onClose={onClose} wide>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="row tight" style={{ flex: '0 0 auto' }}>
          <button className={`btn sm ${carga ? '' : 'primary'}`} onClick={() => { setCarga(false); setDest(null) }}>
            Passageiro
          </button>
          <button className={`btn sm ${carga ? 'primary' : ''}`} onClick={() => { setCarga(true); setDest(null) }}>
            Carga
          </button>
        </div>
        <label className="field" style={{ flex: '0 0 200px', marginBottom: 0 }}>
          <span>Saindo de</span>
          <select value={hub} onChange={(e) => setHub(e.target.value)}>
            {state.airline.hubs.map((h) => (
              <option key={h} value={h}>{h} — {AIRPORT_BY_IATA[h].city}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '0 0 190px', marginBottom: 0 }}>
          <span>Filtrar a lista</span>
          <input type="text" value={q} placeholder="cidade, país ou código" onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '0 0 150px', marginBottom: 0 }}>
          <span>Ordenar</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as OrdenacaoRotas)}>
            {ORDENACOES_ROTAS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Destino</span>
          <select value={dest ?? ''} onChange={(e) => setDest(e.target.value || null)}>
            <option value="">— escolher destino ({options.length} na lista) —</option>
            {options.map((o) => (
              <option key={o.a.iata} value={o.a.iata} disabled={!!o.barrado}>
                {o.a.iata} — {o.a.city}, {o.a.country} · {km(o.dist)} · {num(o.demand.total)} {carga ? 't' : 'pax'}/dia
                {o.barrado ? ' · indisponível' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split detalhe">
        {/*
          * Quatro por vez, e não sete.
          *
          * A lista é de noventa destinos, então ela rola de qualquer jeito — o
          * que muda com a altura é quanto sobra da tela para a projeção do lado,
          * que é onde a decisão acontece. No celular, onde o painel desce para
          * baixo da lista, sete linhas empurravam a projeção para fora da tela.
          */}
        <div className="scroll lista-destinos">
          <table className="compacta">
            <thead>
              <tr>
                <th>Destino</th><th className="r">Distância</th><th className="r">Mercado</th>
                <th className="r">Tarifa</th><th className="r">Conc.</th><th className="r">Porte</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.a.iata} className={`click ${dest === o.a.iata ? 'on' : ''} ${o.barrado ? 'off' : ''}`}
                  onClick={() => !o.barrado && setDest(o.a.iata)}>
                  <td>
                    <b>{o.a.iata}</b> {o.a.city}{' '}
                    <span className="muted" style={{ fontSize: 11 }}>
                      {o.a.country} · {ESCOPO_LABEL[o.a.escopo]}{o.barrado ? ` · ${o.barrado}` : ''}
                    </span>
                  </td>
                  <td className="r">{km(o.dist)}</td>
                  <td className="r">{num(o.demand.total)}</td>
                  <td className="r">{tarifa(o.demand.refFare, moedaDoPais(AIRPORT_BY_IATA[hub].cc))}</td>
                  <td className="r">{o.rivals || <span className="good">livre</span>}</td>
                  <td className="r"><Porte lista={porteAte(o.a)} carga={carga} de={hub} para={o.a.iata} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {!chosen && <Empty>Escolha um destino para ver a projeção.</Empty>}
          {chosen && (
            <Card title={`${hub} → ${chosen.a.iata}`}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Distância</span><b>{km(chosen.dist)}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Custo de abertura</span><b>{money(routeSlotCost(hub, chosen.a.iata))}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Slots livres</span>
                  <b>{slotsFree(state, hub)} / {slotsFree(state, chosen.a.iata)}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Escopo</span>
                  <b>{ESCOPO_LABEL[AIRPORT_BY_IATA[hub].escopo]} → {ESCOPO_LABEL[chosen.a.escopo]}</b>
                </div>
              </div>
              {best.length === 0 ? (
                <p className="bad">Nenhuma aeronave do catálogo alcança esse destino com a pista disponível.</p>
              ) : (
                <>
                  <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                    Melhores aviões para a etapa
                  </h4>
                  {best.map(({ t, freq, est }) => (
                    <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{acLabel(t)}</b>
                        <span className={est.profit >= 0 ? 'good' : 'bad'}>{money(est.profit)}/dia</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {freq}×/dia · {est.blockH.toFixed(1)} h de voo · {num(est.pax)} {carga ? 't/dia' : 'pax/dia'}
                        {' · '}receita {money(est.revenue)}
                      </span>
                      <Bar value={est.revenue ? Math.max(0, est.profit / est.revenue) : 0} />
                    </div>
                  ))}
                </>
              )}
              <button
                className="btn primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => {
                  const err = act((s) => openRoute(s, hub, chosen.a.iata, carga))
                  if (err) return toast(err, 'error')
                  const r = state.airline.routes[state.airline.routes.length - 1]
                  onOpened(r.id)
                }}
              >
                Abrir por {money(routeSlotCost(hub, chosen.a.iata))}
              </button>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  )
}
