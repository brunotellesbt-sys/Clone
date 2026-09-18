import { DOW_CURTO, hhmm, paradasDe, pernasDe, quebrasDe, removerVoo } from '../../game/escala'
import { AIRPORT_BY_IATA } from '../../game/data/airports'
import { typeOf } from '../../game/engine'
import type { Aircraft } from '../../game/types'
import { useGame } from '../../store/useGame'

const ALTURA = 560
const HORA = ALTURA / 24

/**
 * A semana de uma cauda, hora a hora.
 *
 * Sete colunas e vinte e quatro linhas: é a grade que qualquer despachante
 * reconhece, e é a única forma de enxergar de relance o que a escala por perna
 * tornou possível — a aeronave que sai do Rio, dorme em Fortaleza e emenda para
 * Congonhas aparece como três blocos em três colunas, não como três rotas.
 *
 * O bloco é desenhado na **hora local da partida**, porque é a hora que o
 * jogador marcou e a que ele procura na tela. Um voo que atravessa a meia-noite
 * é cortado na borda da coluna e continua na seguinte, que é o que ele faz de
 * verdade.
 */
export function Grade({ ac }: { ac: Aircraft }) {
  const { state, act } = useGame()
  const pernas = pernasDe(state, ac.id)
  const quebras = quebrasDe(state, ac.id)
  const paradas = paradasDe(state, ac.id)

  /** Horas de voo na semana — o número que diz se a cauda está sendo usada. */
  const horasSemana = pernas.reduce((h, p) => h + p.bloco, 0) / 60
  const ocioso = paradas.find((p) => p.ocioso)

  /** Cada perna pode render dois retângulos: o do dia da partida e o que vaza. */
  const blocos = pernas.flatMap((p) => {
    const inicio = p.perna.saida
    const fim = inicio + p.bloco
    const pedacos = [{ dow: p.perna.dow, de: inicio, ate: Math.min(fim, 24 * 60) }]
    if (fim > 24 * 60) {
      pedacos.push({ dow: (p.perna.dow + 1) % 7, de: 0, ate: Math.min(fim - 24 * 60, 24 * 60) })
    }
    return pedacos.map((pd, i) => ({ ...pd, p, cabeca: i === 0 }))
  })

  return (
    <div className="grade">
      <div className="grade-topo">
        <span className="muted" style={{ fontSize: 12 }}>
          {pernas.length} voos na semana · {horasSemana.toFixed(1)} h de voo
        </span>
        {quebras.length > 0 && (
          <span className="alerta" title="a aeronave não termina a semana onde começa">
            ⚠ {quebras.length === 1 ? 'a escala não fecha' : `${quebras.length} quebras na escala`}
          </span>
        )}
      </div>

      {ocioso && (
        <p className="aviso" style={{ margin: '0 0 10px' }}>
          {ac.reg} está parado em <b>{ocioso.iata}</b> a semana inteira. Um avião sem escala custa
          arrendamento, depreciação e hangar e não traz um passageiro.
        </p>
      )}
      {quebras.map((q, i) => (
        <p key={i} className="aviso erro" style={{ margin: '0 0 8px' }}>
          Ela pousa em <b>{q.antes.to}</b> e a perna seguinte sai de <b>{q.depois.from}</b>. O jogo
          não teleporta o avião: ele voa <b>vazio</b> de {q.antes.to} para {q.depois.from}, pagando
          combustível e tripulação sem vender assento. Marque um voo nesse trecho e o vazio some.
        </p>
      ))}

      <div className="rolagem-x">
        <div className="grade-corpo" style={{ height: ALTURA }}>
          <div className="grade-horas">
            {Array.from({ length: 13 }, (_, i) => i * 2).map((h) => (
              <span key={h} style={{ top: h * HORA }}>{String(h).padStart(2, '0')}:00</span>
            ))}
          </div>
          {DOW_CURTO.map((nome, dow) => (
            <div key={dow} className="grade-dia">
              <div className="grade-dia-nome">{nome}</div>
              <div className="grade-pista">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="grade-linha" style={{ top: i * 2 * HORA }} />
                ))}
                {blocos.filter((b) => b.dow === dow).map((b, i) => (
                  <button
                    key={`${b.p.perna.id}:${i}`}
                    className="grade-voo"
                    style={{ top: b.de * (HORA / 60), height: Math.max(22, (b.ate - b.de) * (HORA / 60)) }}
                    title={`${b.p.perna.from} ${hhmm(b.p.perna.saida)} → ${b.p.perna.to} ${hhmm(b.p.chegadaLocal)} · ${AIRPORT_BY_IATA[b.p.perna.to].city} · clique para apagar`}
                    onClick={() => act((s) => removerVoo(s, b.p.perna.id))}
                  >
                    <b>{b.p.perna.from}</b>
                    <span className="grade-seta">✈</span>
                    <b>{b.p.perna.to}</b>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
        {typeOf(ac).name} · {ac.reg}. Clique num voo para tirá-lo da escala. A hora é a local da
        origem — é a que você marcou e a que o aeroporto usa.
      </p>
    </div>
  )
}

/** Onde a cauda está agora, para as telas que só precisam da linha. */
export function ondeEsta(state: ReturnType<typeof useGame>['state'], ac: Aircraft): string {
  const pernas = pernasDe(state, ac.id)
  if (!pernas.length) return ac.base ?? state.airline.hubs[0] ?? '—'
  // a última perna da semana diz onde ela dorme no fim dela
  return pernas[pernas.length - 1].perna.to
}
