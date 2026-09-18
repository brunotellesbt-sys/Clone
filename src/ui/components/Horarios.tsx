import { AIRPORT_BY_IATA } from '../../game/data/airports'
import {
  conexoesDaRota, hhmm, JANELA_COLADO, lerHora, MCT_ALFANDEGA, MCT_DOMESTICA,
  MCT_INTERNACIONAL, rotacoesDa, rotuloMct, voosColados, type Conexao, type Rotacao,
} from '../../game/malha'
import { espalharHorarios, setHorario } from '../../game/engine'
import type { Route } from '../../game/types'
import { useGame } from '../../store/useGame'
import { Card } from './Bits'

const dur = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/**
 * Horário de cada rotação, e o que ele conecta.
 *
 * O jogador marca a hora de partida; tudo o mais — chegada no destino, volta na
 * base, conexão que abre e conexão que fecha — é consequência e aparece do lado.
 * É a tela onde a malha deixa de ser uma lista de rotas e vira uma malha.
 */
export function Horarios({ route }: { route: Route }) {
  const { state, act, toast } = useGame()
  const rots = rotacoesDa(state, route)
  const { base, entrando, saindo } = conexoesDaRota(state, route)
  const colados = voosColados(state, route)
  const destino = AIRPORT_BY_IATA[route.to]
  const domestica = AIRPORT_BY_IATA[base].cc === destino.cc

  if (rots.length === 0) {
    return (
      <Card title="Horários e conexões">
        <p className="muted" style={{ margin: 0 }}>
          A rota está sem frequência: não há voo para marcar.
        </p>
      </Card>
    )
  }

  return (
    <Card
      title="Horários e conexões"
      right={
        <button className="btn sm" onClick={() => act((s) => espalharHorarios(s, route.id))}>
          Espalhar no dia
        </button>
      }
    >
      <div className="rolagem-x">
      <table className="horarios">
        <thead>
          <tr>
            <th>Rotação</th>
            <th>Parte</th>
            <th className="r">Chega {route.to}</th>
            <th className="r">Volta {base}</th>
            <th className="r">Conexões</th>
          </tr>
        </thead>
        <tbody>
          {rots.map((rot) => {
            const entra = entrando.filter((c) => c.para.indice === rot.indice)
            const sai = saindo.filter((c) => c.de.indice === rot.indice)
            const colado = colados.some(([x, y]) => x.indice === rot.indice || y.indice === rot.indice)
            return (
              <tr key={rot.indice}>
                <td>{rot.indice + 1}ª{colado && <span className="alerta" title={`Outro voo para ${route.to} a menos de ${JANELA_COLADO} min`}> ⚠</span>}</td>
                <td>
                  <input
                    type="time"
                    value={hhmm(rot.saida)}
                    onChange={(e) => {
                      const m = lerHora(e.target.value)
                      if (m === null) return
                      const err = act((s) => setHorario(s, route.id, rot.indice, m))
                      if (err) toast(err, 'error')
                    }}
                  />
                </td>
                <td className="r">{hhmm(rot.chegadaDestino)}</td>
                <td className="r">{hhmm(rot.voltaBase)}</td>
                <td className="r">
                  <span className={entra.length ? 'good' : 'muted'} title="passageiros que chegam de outra rota e embarcam nesta">
                    {entra.length} entram
                  </span>
                  <span className="muted"> · </span>
                  <span className={sai.length ? 'good' : 'muted'} title="passageiros que chegam nesta rota e seguem em outra">
                    {sai.length} seguem
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>

      {colados.length > 0 && (
        <p className="aviso">
          {colados.length === 1 ? 'Dois voos' : `${colados.length} pares de voos`} para {route.to} saem
          com menos de {JANELA_COLADO} min de diferença. É permitido — ponte aérea faz isso de
          propósito —, mas eles disputam o mesmo pico e costumam voltar os dois pela metade.
        </p>
      )}

      <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
        <ListaConexao
          titulo={`Chegam e embarcam nesta rota`}
          vazio="Nenhuma rota sua chega a tempo de alimentar esta."
          conexoes={entrando}
          outraPonta={(c) => c.de.routeId}
        />
        <ListaConexao
          titulo={`Chegam desta rota e seguem viagem`}
          vazio="A volta desta rota não alcança nenhuma partida sua."
          conexoes={saindo}
          outraPonta={(c) => c.para.routeId}
        />
      </div>

      <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
        Tempo mínimo de conexão: <b>{MCT_DOMESTICA} min</b> entre duas domésticas,{' '}
        <b>{MCT_INTERNACIONAL} min</b> entre duas internacionais em trânsito e{' '}
        <b>{MCT_ALFANDEGA / 60} h</b> quando o passageiro cruza a fronteira aqui — aí ele pega a
        bagagem na esteira, passa na imigração e na receita e redespacha. Esta rota é{' '}
        <b>{domestica ? 'doméstica' : 'internacional'}</b>: ela conecta com outra{' '}
        {domestica ? 'doméstica' : 'internacional'} em {domestica ? MCT_DOMESTICA : MCT_INTERNACIONAL} min,
        e com uma {domestica ? 'internacional' : 'doméstica'} só depois de {MCT_ALFANDEGA / 60} h.
      </p>
    </Card>
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
  const { state } = useGame()
  const nomeDa = (routeId: string) => {
    const r = state.airline.routes.find((x) => x.id === routeId)
    return r ? `${r.from}–${r.to}` : '?'
  }
  return (
    <div>
      <h4 className="sub">{titulo}</h4>
      {conexoes.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{vazio}</p>
      ) : (
        <div className="conexoes">
          {conexoes.slice(0, 8).map((c, i) => (
            <div key={i} className="conexao">
              <b>{nomeDa(outraPonta(c))}</b>
              <span className="muted">{hora(c)}</span>
              <span className={c.espera - c.minimo < 20 ? 'warn' : 'dim'}>{dur(c.espera)}</span>
              <small className="muted">{rotuloMct(c.minimo)}</small>
            </div>
          ))}
          {conexoes.length > 8 && (
            <span className="muted" style={{ fontSize: 11 }}>e mais {conexoes.length - 8}</span>
          )}
        </div>
      )}
    </div>
  )
}

const hora = (c: Conexao) => `${hhmm(c.de.voltaBase)} → ${hhmm(c.para.saida)}`

/** Todas as conexões de uma base, para a visão geral da malha. */
export function resumoConexoes(conexoes: Conexao[]) {
  const porTipo = new Map<number, number>()
  for (const c of conexoes) porTipo.set(c.minimo, (porTipo.get(c.minimo) ?? 0) + 1)
  return [...porTipo.entries()].sort((a, b) => a[0] - b[0])
}

export type { Rotacao }
