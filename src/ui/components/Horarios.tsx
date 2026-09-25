import {
  atratividadeHorario, conexoesDaRota, hhmm, horaDaConcorrente, JANELA_COLADO,
  voosColados, type Conexao,
} from '../../game/malha'
import { useState } from 'react'
import { alterarNumeroVoo, DOW_CURTO, lerHora, noTempo, pernasDaRota, remarcarVoo, removerVoo } from '../../game/escala'
import { odKey } from '../../game/geo'
import { aircraftOf, num } from '../../game/engine'
import type { Route } from '../../game/types'
import { useGame } from '../../store/useGame'
import { Card } from './Bits'
import { NovoVoo } from './NovoVoo'

const dur = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/**
 * Os voos de uma rota na semana, e o que eles conectam.
 *
 * Cada linha é uma **perna** — um trecho, num dia, com uma cauda —, e não mais
 * uma rotação de ida e volta: numa malha, a volta pode não existir, porque o
 * avião segue para um terceiro aeroporto. O que a tela ganha com isso é dizer a
 * verdade sobre quem voa o quê; o que ela perde é a simetria, e não era real.
 */
export function Horarios({ route }: { route: Route }) {
  const { state, act, toast } = useGame()
  const pernas = pernasDaRota(state, route)
    .map((p) => noTempo(state, p))
    .sort((a, b) => a.perna.dow - b.perna.dow || a.perna.saida - b.perna.saida)
  const { base, entrando, saindo } = conexoesDaRota(state, route)
  const colados = voosColados(state, route)
  const rivais = state.competitors.flatMap((c) =>
    c.routes.filter((r) => r.key === odKey(route.from, route.to))
      .map((r) => ({ nome: c.name, hora: horaDaConcorrente(r), freq: r.freq })),
  ).sort((a, b) => a.hora - b.hora)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <NovoVoo route={route} />

      <Card title={`Voos da semana (${pernas.length})`}>
        {pernas.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum voo marcado. Use <b>Marcar voo</b> acima: escolha o sentido, a hora e os dias,
            e o jogo mostra que caudas estão na base naquele horário.
          </p>
        ) : (
          <div className="rolagem-x">
            <table className="horarios">
              <thead>
                <tr>
                  <th>Dia</th><th>Voo</th><th>Trecho</th><th>Aeronave</th><th>Parte</th>
                  <th className="r">Chega</th><th className="r">Procura</th><th className="r">Conexões · último voo</th><th />
                </tr>
              </thead>
              <tbody>
                {pernas.map((t) => {
                  const p = t.perna
                  const ac = aircraftOf(state, p.aircraftId)
                  const apurado = p.ultimoVoo
                  const colado = colados.some(([x, y]) => x.id === p.id || y.id === p.id)
                  const peso = atratividadeHorario(p.saida)
                  return (
                    <tr key={p.id}>
                      <td>
                        {DOW_CURTO[p.dow]}
                        {colado && (
                          <span className="alerta" title={`Outro voo para ${p.to} a menos de ${JANELA_COLADO} min`}> ⚠</span>
                        )}
                      </td>
                      <td><label className="flight-number"><b>{state.airline.code}</b><input aria-label={`Número do voo ${p.from} para ${p.to}`} type="number" min="1" max="9999" key={`${p.id}-${p.numero}`} defaultValue={p.numero ?? ''}
                        onBlur={e => { const err = act(s => alterarNumeroVoo(s, p.id, Number(e.target.value))); if (err) { toast(err, 'error'); e.target.value = String(p.numero ?? '') } }} /></label></td>
                      <td><b>{p.from} → {p.to}</b></td>
                      <td>{ac ? ac.reg : <span className="bad">sem cauda</span>}</td>
                      <td>
                        <input
                          type="time"
                          value={hhmm(p.saida)}
                          onChange={(e) => {
                            const m = lerHora(e.target.value)
                            if (m === null) return
                            const err = act((s) => remarcarVoo(s, p.id, p.dow, m))
                            if (err) toast(err, 'error')
                          }}
                        />
                      </td>
                      <td className="r">
                        {hhmm(t.chegadaLocal)}
                        {t.dowChegada !== p.dow && <span className="muted"> {DOW_CURTO[t.dowChegada]}</span>}
                      </td>
                      <td className="r">
                        <span className={peso >= 1 ? 'good' : peso >= 0.8 ? 'dim' : 'warn'}
                          title="quanto a procura vale nesse horário; o pico é de manhã cedo e no fim da tarde">
                          {Math.round(peso * 100)}%
                        </span>
                      </td>
                      <td className="r">
                        {apurado ? <>
                          <span className={apurado.conexoesEntrando ? 'good' : 'muted'} title="Passageiros apurados que chegaram de outro voo">
                            {apurado.conexoesEntrando} vieram
                          </span><span className="muted"> · </span>
                          <span className={apurado.conexoesSaindo ? 'good' : 'muted'} title="Passageiros apurados que seguem em outro voo">
                            {apurado.conexoesSaindo} seguem
                          </span><br />
                          <small className="muted">{num(Object.values(apurado.pax).reduce((n, v) => n + v, 0))} passageiros · dia {apurado.day}</small>
                        </> : <span className="muted">Aguardando voo</span>}
                      </td>
                      <td className="r">
                        <button className="btn sm" onClick={() => act((s) => removerVoo(s, p.id))}>Tirar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {colados.length > 0 && (
          <p className="aviso">
            {colados.length === 1 ? 'Dois voos' : `${colados.length} pares de voos`} saem no mesmo dia e
            sentido com menos de {JANELA_COLADO} min de diferença. É permitido — ponte aérea faz isso
            de propósito —, mas eles disputam o mesmo pico e costumam voltar os dois pela metade.
          </p>
        )}

        <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
          <ListaConexao
            titulo={`Chegam em ${base} e embarcam nesta rota`}
            vazio="Nenhum voo seu chega a tempo de alimentar esta rota."
            conexoes={entrando}
            outraPonta={(c) => c.de.ponta}
          />
          <ListaConexao
            titulo="Chegam nesta rota e seguem viagem"
            vazio="Os voos desta rota não alcançam nenhuma partida sua."
            conexoes={saindo}
            outraPonta={(c) => c.para.ponta}
          />
        </div>

        {rivais.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4 className="sub">Quem mais voa este par</h4>
            <div className="conexoes">
              {rivais.map((r, i) => (
                <div key={i} className="conexao">
                  <b>{r.nome}</b>
                  <span className="muted">{hhmm(r.hora)}</span>
                  <span className="dim">{r.freq}/dia</span>
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
              Sair no mesmo horário divide o mesmo pico; sair numa faixa que ninguém cobre pega ela
              inteira, mas a procura ali pode valer menos — é o que a coluna <b>Procura</b> mede.
            </p>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
          Os passageiros são registrados quando o dia é apurado. As conexões abaixo mostram as possibilidades da grade; as janelas de transferência são aplicadas automaticamente.
        </p>
      </Card>
    </div>
  )
}

function ListaConexao({
  titulo, vazio, conexoes, outraPonta,
}: {
  titulo: string
  vazio: string
  conexoes: Conexao[]
  outraPonta: (c: Conexao) => string
}) {
  const [expandido, setExpandido] = useState(false)
  const grupos = new Map<string, { c: Conexao; dias: number }>()
  for (const c of conexoes) {
    const key = `${c.de.ponta}:${c.para.ponta}:${c.de.local}:${c.para.local}:${c.parceira ?? ''}`
    const grupo = grupos.get(key)
    if (grupo) grupo.dias++
    else grupos.set(key, { c, dias: 1 })
  }
  const lista = [...grupos.values()]
  return (
    <div>
      <h4 className="sub">{titulo}</h4>
      {conexoes.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{vazio}</p>
      ) : (
        <div className="conexoes">
          {(expandido ? lista : lista.slice(0, 8)).map(({ c, dias }, i) => (
            <div key={i} className="conexao">
              <b>{outraPonta(c)}</b>
              <span className="muted">{hhmm(c.de.local)} → {hhmm(c.para.local)}</span>
              <span className={c.espera - c.minimo < 20 ? 'warn' : 'dim'}>{dur(c.espera)}</span>
              <small className="muted">{c.parceira ? `${c.parceira}${c.codeshare ? ' · codeshare' : ''} · ` : ''}{Math.min(7, dias)} dias/sem.</small>
            </div>
          ))}
          {lista.length > 8 && (
            <button className="btn sm" onClick={() => setExpandido(!expandido)}>{expandido ? 'Mostrar menos' : `Ver mais ${lista.length - 8} conexões`}</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Todas as conexões de uma base, para a visão geral da malha. */
export function resumoConexoes(conexoes: Conexao[]) {
  const porTipo = new Map<number, number>()
  for (const c of conexoes) porTipo.set(c.minimo, (porTipo.get(c.minimo) ?? 0) + 1)
  return [...porTipo.entries()].sort((a, b) => a[0] - b[0])
}
