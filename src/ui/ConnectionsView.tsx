import { useState } from 'react'
import { useGame } from '../store/useGame'
import { conexoesNaBase } from '../game/malha'
import { distanceBetween } from '../game/geo'
import { DESVIO_MAXIMO } from '../game/connections'
import { CABINS, CABIN_SHORT } from '../game/types'
import { gameDate, num } from '../game/engine'
import { sumCabins } from '../game/economy'
import { Card, Empty } from './components/Bits'

export function ConnectionsView() {
  const { state } = useGame()
  const [hub, setHub] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(7)
  const date = (day: number) => new Date(gameDate(state).getTime() + (day - state.day) * 86400000)
    .toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
  const all = (state.connectionJourneys ?? []).filter(j => j.first.day >= state.day - period + 1 && (!hub || j.via === hub))
  const trips = all.filter(j => `${j.first.from} ${j.via} ${j.second.to} ${j.first.number} ${j.second.number}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.first.day - a.first.day || a.first.departure - b.first.departure)
  const active = all.filter(j => !j.cancelled)
  const passengers = active.reduce((n, j) => n + sumCabins(j.pax), 0)
  const boardings = active.reduce((n, j) => n + sumCabins(j.pax) * (Number(j.first.own && j.first.day <= state.day) + Number(j.second.own && j.second.day <= state.day)), 0)
  const waiting = active.filter(j => j.second.day > state.day).reduce((n, j) => n + sumCabins(j.pax), 0)

  /**
   * Por que não há conexão — perguntado às **mesmas regras** que vendem.
   *
   * A tela mostrava três zeros e um recado mandando programar chegadas e
   * partidas compatíveis. Quem já programou lê isso e conclui que o jogo não
   * viu os voos dele; quase sempre o jogo viu, e recusou por outro motivo.
   * Aqui ela pergunta à regra: quantos pares de horário existem na base, e
   * quantos deles o desvio reprova.
   *
   * O desvio é o motivo que mais engana, porque não tem nada a ver com
   * horário: Recife–Fortaleza–Maceió casa perfeitamente no relógio e roda sete
   * vezes a distância do voo direto. Nenhum passageiro compra isso, e nenhum
   * aviso sobre "chegadas compatíveis" explicaria.
   */
  const hubs = hub ? [hub] : state.airline.hubs
  const diagnostico = hubs.map(h => {
    const pares = conexoesNaBase(state, h)
    const rodeio = pares.filter(c => {
      const direto = distanceBetween(c.de.ponta, c.para.ponta)
      return direto > 0 &&
        (distanceBetween(c.de.ponta, h) + distanceBetween(h, c.para.ponta)) / direto > DESVIO_MAXIMO
    }).length
    return { h, pares: pares.length, rodeio }
  })
  /**
   * As conexões da malha: o que a escala oferece, e não o que vendeu.
   *
   * O quadro de itinerários é por dia — ele só existe depois que o dia vira e
   * o passageiro compra. Este aqui é a malha: todo par de voos **seus** que a
   * regra aceita — casa no relógio e não rodeia demais —, agrupado pelo
   * horário, com quantos dias da semana ele se repete. É o que a tela de rotas
   * já mostra por rota ("chegam em BSB e embarcam nesta rota"), aqui juntado
   * por base. Aparece com o jogo pausado, porque não depende de venda.
   */
  const malha = (() => {
    const grupos = new Map<string, { via: string; de: string; para: string; chega: number; sai: number; espera: number; dias: Set<number> }>()
    for (const h of hubs) for (const c of conexoesNaBase(state, h)) {
      if (c.parceira || c.codeshare || c.de.parceira || c.para.parceira) continue
      const direto = distanceBetween(c.de.ponta, c.para.ponta)
      if (!direto || (distanceBetween(c.de.ponta, h) + distanceBetween(h, c.para.ponta)) / direto > DESVIO_MAXIMO) continue
      const chave = `${h}|${c.de.ponta}|${c.para.ponta}|${c.de.local}|${c.para.local}`
      const g = grupos.get(chave) ?? { via: h, de: c.de.ponta, para: c.para.ponta, chega: c.de.local, sai: c.para.local, espera: c.espera, dias: new Set<number>() }
      g.dias.add(Math.floor(c.de.quando / (24 * 60)) % 7)
      grupos.set(chave, g)
    }
    const q = search.toLowerCase()
    return [...grupos.values()]
      .filter(g => !q || `${g.de} ${g.via} ${g.para}`.toLowerCase().includes(q))
      .sort((a, b) => a.via.localeCompare(b.via) || a.chega - b.chega || a.sai - b.sai)
  })()
  const hm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`

  const pares = diagnostico.reduce((n, d) => n + d.pares, 0)
  const rodeio = diagnostico.reduce((n, d) => n + d.rodeio, 0)

  return <div className="grid" style={{ gap: 14 }}>
    <Card title="Conexões">
      <p className="muted">Cada viagem liga dois voos e reserva o mesmo número de passageiros nos dois trechos. Eles contam na lotação de cada voo, mas não como demanda local atendida entre essas duas pontas.</p>
      <div className="connection-filters">
        <label>Hub<select aria-label="Hub das conexões" value={hub} onChange={e => setHub(e.target.value)}><option value="">Todos os hubs</option>{state.airline.hubs.map(h => <option key={h}>{h}</option>)}</select></label>
        <label>Período<select aria-label="Período das conexões" value={period} onChange={e => setPeriod(Number(e.target.value))}><option value={1}>Último dia</option><option value={7}>7 dias</option><option value={14}>14 dias</option></select></label>
        <label>Buscar<input type="search" aria-label="Buscar conexão" placeholder="Aeroporto ou número do voo" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      <div className="grid g3" style={{ gap: 14 }}>
        <div><span className="muted">Passageiros com conexão</span><br /><b>{num(passengers)}</b><small className="dim"> · cada viajante contado uma vez</small></div>
        <div><span className="muted">Embarques nos seus voos</span><br /><b>{num(boardings)}</b><small className="dim"> · dois quando os dois trechos são seus</small></div>
        <div><span className="muted">Aguardando próximo trecho</span><br /><b>{num(waiting)}</b></div>
      </div>
      {/* O diagnóstico só aparece quando há o que explicar: com conexão
          vendida, ele seria ruído sobre um número que já fala. */}
      {/*
        * Primeiro: algum dia já foi apurado?
        *
        * A conexão é vendida dentro da virada do dia. Um save pausado desde
        * antes de a apuração existir mostrava zero — e zero lia como "o jogo
        * olhou seus voos e não achou nada", quando na verdade ele nunca olhou.
        */}
      {state.conexoesApuradasEm === undefined ? (
        <p className="aviso" style={{ margin: '10px 0 0' }}>
          <b>Nenhum dia foi apurado ainda.</b> As conexões são vendidas quando o dia vira, e desde que a
          apuração entrou no jogo nenhum dia passou neste save.
          {pares - rodeio > 0 && <> A regra já enxerga <b>{pares - rodeio}</b>{' '}
            {pares - rodeio === 1 ? 'par válido' : 'pares válidos'} nos seus voos.</>}
          {' '}Tire da pausa e deixe o dia virar.
        </p>
      ) : passengers === 0 && (
        <p className="aviso" style={{ margin: '10px 0 0' }}>
          {pares === 0
            ? <>Em {hubs.join(', ') || 'nenhuma base'} <b>nenhum par dos seus voos casa no relógio</b>: não há
              chegada e partida separadas pelo tempo mínimo de conexão. É aqui que marcar um voo resolve.</>
            : rodeio >= pares
              ? <>A regra vê <b>{pares}</b> {pares === 1 ? 'par dos seus voos' : 'pares dos seus voos'} que
                casam no relógio, e <b>todos rodeiam demais</b>: passar pela base custa mais de
                {' '}{DESVIO_MAXIMO.toFixed(1)}× o voo direto, e ninguém compra isso.</>
              : <>A regra vê <b>{pares}</b> {pares === 1 ? 'par dos seus voos' : 'pares dos seus voos'} que
                casam no relógio{rodeio > 0 && <> ({rodeio} {rodeio === 1 ? 'rodeia' : 'rodeiam'} demais)</>}.
                Os que sobram não venderam no último dia apurado (dia {state.conexoesApuradasEm}): o passageiro
                preferiu um voo direto — inclusive o seu, se você voa o mesmo par sem escala —, ou o avião já saiu
                cheio de gente local, e conexão só ocupa lugar vago.</>}
        </p>
      )}
    </Card>
    <Card title="Conexões da malha" right={<span className="muted">{malha.length}</span>}>
      {/* Duas colunas, no padrão da tela de rotas: com quatro, "Dias" saía
          cortado na borda do celular, e aqui nada rola de lado. */}
      {malha.length ? <div className="scroll media"><table className="connection-journeys">
        <thead><tr><th>Viagem</th><th className="r">Chega → sai</th></tr></thead>
        <tbody>{malha.map(g => <tr key={`${g.via}${g.de}${g.para}${g.chega}${g.sai}`}>
          <td><b>{g.de} → {g.via} → {g.para}</b><br /><small className="muted">{g.dias.size} {g.dias.size === 1 ? 'dia' : 'dias'}/sem.</small></td>
          <td className="r">{hm(g.chega)} → {hm(g.sai)}<br /><small className="muted">espera {Math.floor(g.espera / 60)}h{String(g.espera % 60).padStart(2, '0')}</small></td>
        </tr>)}</tbody>
      </table></div> : <Empty>Nenhum par dos seus voos casa no relógio sem rodear demais neste filtro.</Empty>}
      <p className="muted" style={{ fontSize: 12 }}>O que a sua escala oferece hoje, pelas regras de conexão: tempo mínimo e máximo de espera e desvio de até {DESVIO_MAXIMO.toFixed(1)}× o voo direto. Não depende de o dia virar — os itinerários vendidos, abaixo, sim.</p>
    </Card>
    <Card title="Itinerários vendidos">
      {trips.length ? <div className="scroll"><table className="connection-journeys">
        <thead><tr><th>Viagem</th><th>Voos</th><th className="r">Passageiros</th><th>Espera</th><th>Situação</th></tr></thead>
        <tbody>{trips.map(j => <tr key={j.id}>
          <td><b>{j.first.from} → {j.via} → {j.second.to}</b><br /><small className="muted">{date(j.first.day)}</small></td>
          <td>{j.first.number} → {j.second.number}<br /><small className="muted">{j.first.operator}{j.first.operator !== j.second.operator && ` / ${j.second.operator}`}</small></td>
          <td className="r"><b>{num(sumCabins(j.pax))}</b><br /><small className="muted">{CABINS.filter(c => j.pax[c]).map(c => `${CABIN_SHORT[c]} ${j.pax[c]}`).join(' · ')}</small></td>
          <td>{Math.floor(j.wait / 60)}h{String(j.wait % 60).padStart(2, '0')}</td>
          <td className={j.cancelled ? 'bad' : 'good'}>{j.cancelled ? 'Conexão interrompida' : j.second.day > state.day ? `Próximo voo em ${date(j.second.day)}` : 'Concluída'}</td>
        </tr>)}</tbody>
      </table></div> : <Empty>Nenhuma conexão apurada neste filtro.{pares > 0 && ' O quadro acima diz o que a regra viu.'}</Empty>}
      <p className="muted" style={{ fontSize: 12 }}>Preço, tempo total, espera, conveniência do aeroporto e concorrência de voos diretos influenciam a escolha. Conexões ocupam lugares vagos; quando o voo enche, parte dos assentos deixa de atender passageiros locais. A demanda local permanece disponível.</p>
    </Card>
  </div>
}
