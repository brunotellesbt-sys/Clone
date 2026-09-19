import {
  DOW_CURTO, hhmm, lerHora, paradasDe, pernasDe, quebrasDe, remarcarVoo, removerVoo,
} from '../../game/escala'
import { AIRPORT_BY_IATA } from '../../game/data/airports'
import { typeOf } from '../../game/engine'
import type { Aircraft } from '../../game/types'
import { useGame } from '../../store/useGame'
import { useEffect, useState } from 'react'
import { escalaDaGrade, menorIntervaloDoDia } from '../gradeEscala'

/**
 * A grade não mostra mais as vinte e quatro horas.
 *
 * Mostrava, e o preço era caro: 560px divididos por 24 davam 23px de hora, e
 * um voo de 50 minutos virava um retângulo de 19px com três linhas de texto
 * dentro — ilegível, e ainda por cima sobrando madrugada vazia por metade da
 * tela. A janela agora é a que tem voo, com uma hora de folga de cada lado, e
 * a escala se estica para preencher a altura: uma escala de 06:00 às 22:00
 * ganha 35px por hora, quase o dobro.
 *
 * Quando há voo de madrugada a janela abre sozinha e volta a ser o dia todo —
 * quem manda é a escala, não um horário fixo que eu tenha escolhido aqui.
 */
const ALTURA = 560
const ALTURA_CELULAR = 360
const FOLGA = 60

/**
 * O bloco de voo tem altura mínima, e ela manda na escala da grade.
 *
 * Dentro dele vão duas linhas — a hora e a rota —, e duas linhas precisam de
 * pixel. Quando a escala apertava, o mínimo de 18px atropelava a aritmética:
 * doze voos por dia a 85 minutos de intervalo, numa janela de dezenove horas
 * espremida em 360px, davam 27px de distância entre partidas para blocos que
 * pediam mais que isso — eles encavalavam, e o último saía cortado pela borda.
 *
 * Então a altura deixou de ser constante. A janela continua sendo a da escala,
 * mas a grade cresce até o menor intervalo do dia caber num bloco inteiro. Num
 * dia de dois voos nada muda; num dia de doze ela fica mais alta e a página
 * rola para baixo, que é o único sentido em que o celular rola.
 *
 * A conta em si está em `gradeEscala.ts`, fora do React, para poder ser medida
 * no terminal — foi ela que errou, não o desenho.
 */
const BLOCO = 30
const BLOCO_CELULAR = 28

/**
 * No celular a grade cabe inteira na tela, sem rolar de lado.
 *
 * Ela rolava: sete colunas de 74px mais a régua pediam 570px, e num telefone
 * de 360 isso é a semana pela metade — para ver sexta-feira era preciso
 * arrastar, e comparar segunda com sexta ficava impossível, que é justamente o
 * que uma grade semanal existe para deixar fazer.
 *
 * Cabe porque a coluna encolhe e a fonte encolhe junto — não porque o bloco
 * perde informação. Ele já mostrou só a hora, e a grade virava doze horários
 * empilhados sem dizer para onde nenhum deles ia; quem quisesse saber tinha
 * que tocar em cada um. Hora em cima, rota embaixo, nas duas larguras: é a
 * mesma leitura no telefone e no monitor.
 *
 * O nome do dia fica inteiro — "D S T Q Q S S" economiza quinze pixels que não
 * faziam falta e troca segunda por sábado e terça por quinta. A altura de
 * partida também encolhe, de 560 para 360, porque a tela do celular é estreita
 * e comprida: uma grade de 560px com 46px de coluna é um poço, não uma semana.
 * De partida, e não final — o dia cheio estica a grade, como diz `BLOCO`.
 */
const ehCelular = () => typeof window !== 'undefined' && window.innerWidth <= 760

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
  // A largura da janela entra no desenho, então ela é estado: sem isto, virar
  // o telefone de lado deixava a grade com a altura da orientação anterior.
  const [estreito, setEstreito] = useState(ehCelular)
  useEffect(() => {
    const ao = () => setEstreito(ehCelular())
    window.addEventListener('resize', ao)
    return () => window.removeEventListener('resize', ao)
  }, [])
  const { state, act, toast } = useGame()
  /**
   * O voo aberto para mexer, e não apagado no clique.
   *
   * Clicar no bloco apagava o voo direto — sem pergunta, sem desfazer, e no
   * celular um toque torto custava uma perna da escala. Pior: a grade é onde
   * se **lê** o horário, e era o único lugar do jogo onde não dava para
   * mudá-lo. Agora o clique abre a perna: a hora vira um campo, e apagar
   * passou a ser um botão com nome.
   */
  const [aberto, setAberto] = useState<string | null>(null)
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

  // A janela vertical: do primeiro ao último minuto com voo, mais uma hora de
  // folga, arredondado para a hora cheia. Sem voo nenhum, o dia comercial.
  const minutos = blocos.flatMap((b) => [b.de, b.ate])
  const de = minutos.length ? Math.max(0, Math.floor((Math.min(...minutos) - FOLGA) / 60) * 60) : 6 * 60
  const ate = minutos.length
    ? Math.min(24 * 60, Math.ceil((Math.max(...minutos) + FOLGA) / 60) * 60)
    : 22 * 60
  const janela = Math.max(60, ate - de)
  const blocoMin = estreito ? BLOCO_CELULAR : BLOCO
  const { porMinuto, altura } = escalaDaGrade(
    janela, menorIntervaloDoDia(blocos, janela), blocoMin, estreito ? ALTURA_CELULAR : ALTURA,
  )

  /**
   * As marcas de hora seguem a escala, não um número que eu tenha escolhido.
   *
   * O passo era fixo por largura de tela — de três em três horas no celular —,
   * e numa grade que agora cresce com a lotação do dia isso deixava a régua
   * rala no meio de um monte de linha de voo. A regra é uma só: duas marcas
   * vizinhas precisam de 26 pixels entre elas, que é o que um número de dez
   * pixels pede para não encostar no de baixo.
   */
  const passo = [60, 120, 180, 360].find((p) => p * porMinuto >= 26) ?? 360
  const marcas: number[] = []
  for (let m = Math.ceil(de / passo) * passo; m <= ate; m += passo) marcas.push(m)

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
      {/*
        * Uma quebra por trecho, não uma por dia.
        *
        * Marcar a mesma perna nos sete dias sem a volta produz sete quebras
        * iguais, e a tela imprimia o mesmo parágrafo de três linhas sete
        * vezes — meia tela de aviso repetido antes de chegar na grade, que é o
        * que o jogador veio ver. O trecho é o mesmo; o que muda é quantas
        * vezes ele acontece, e isso cabe em duas palavras.
        */}
      {[...quebras.reduce((m, q) => {
        const chave = `${q.antes.to}→${q.depois.from}`
        m.set(chave, {
          de: q.antes.to, para: q.depois.from,
          vezes: (m.get(chave)?.vezes ?? 0) + 1,
          semHora: m.get(chave)?.semHora ?? q.semHora,
        })
        return m
      }, new Map<string, { de: string; para: string; vezes: number; semHora?: string }>()).values()]
        .map((q) => (
          <p key={`${q.de}${q.para}`} className="aviso erro" style={{ margin: '0 0 8px' }}>
            {q.vezes > 1 && <><b>{q.vezes}×</b> na semana: </>}
            ela pousa em <b>{q.de}</b> e a perna seguinte sai de <b>{q.para}</b>. O jogo não
            teleporta o avião: ele voa <b>vazio</b> de {q.de} para {q.para}, pagando combustível e
            tripulação sem vender assento. Marque um voo nesse trecho e o vazio some.
            {/* O pernoite impossível: dormir fora é escolha do jogador, mas se
                o vazio de volta não tem hora que caiba, a escala não fecha. */}
            {q.semHora && (
              <>
                {' '}<b>E esse vazio não tem hora em que caiba:</b> {q.semHora} Enquanto ficar
                assim, a semana não fecha — a volta precisa ser marcada com passageiro.
              </>
            )}
          </p>
        ))}

      <div className="rolagem-x">
        <div className={`grade-corpo ${estreito ? 'apertada' : ''}`}>
          {/*
            * A régua começa onde a pista começa.
            *
            * O espaço do nome do dia aparece vazio aqui de propósito: a régua
            * mora na mesma coluna flex que as pistas, e sem esse pedaço ela
            * arrancava lá de cima, jogando cada número uma linha acima da hora
            * que ele nomeia — "09" ao lado do voo das 08:00. Pelo mesmo motivo
            * a altura da escala agora é a da **pista**, e não a da caixa
            * inteira: era a diferença entre as duas que cortava o último voo
            * do dia pela borda.
            */}
          <div className="grade-horas">
            <div className="grade-dia-nome" aria-hidden>&nbsp;</div>
            <div className="grade-regua" style={{ height: altura }}>
              {marcas.map((m) => (
                <span key={m} style={{ top: (m - de) * porMinuto }}>{estreito ? hhmm(m).slice(0, 2) : hhmm(m)}</span>
              ))}
            </div>
          </div>
          {DOW_CURTO.map((nome, dow) => (
            <div key={dow} className="grade-dia">
              <div className="grade-dia-nome">{nome}</div>
              <div className="grade-pista" style={{ height: altura }}>
                {marcas.map((m) => (
                  <div key={m} className="grade-linha" style={{ top: (m - de) * porMinuto }} />
                ))}
                {blocos.filter((b) => b.dow === dow).map((b, i) => {
                  const alto = Math.max(blocoMin, (b.ate - b.de) * porMinuto)
                  // O bloco de um voo curto é maior que o voo; perto da borda
                  // essa sobra passava do fim da pista e sumia no corte. Ela
                  // sobe em vez de sumir — o topo continua na hora certa em
                  // todo voo que não encosta na última linha da grade.
                  const topo = Math.min((b.de - de) * porMinuto, altura - alto)
                  return (
                  <button
                    key={`${b.p.perna.id}:${i}`}
                    className={`grade-voo ${aberto === b.p.perna.id ? 'on' : ''}`}
                    style={{ top: topo, height: alto }}
                    title={`${b.p.perna.from} ${hhmm(b.p.perna.saida)} → ${b.p.perna.to} ${hhmm(b.p.chegadaLocal)} · ${AIRPORT_BY_IATA[b.p.perna.to].city} · clique para mexer`}
                    onClick={() => setAberto((x) => (x === b.p.perna.id ? null : b.p.perna.id))}
                  >
                    {/* Duas linhas, nesta ordem: a hora é o que se procura na
                        grade, a rota é o que diz qual voo é aquele. A origem
                        fica — sem ela a grade de uma cauda que serve três
                        pontas vira uma lista de destinos sem começo, e é
                        justamente quem emenda trecho que precisa ler a ponta
                        de onde o próximo sai. Cabem porque a escala da grade
                        agora é calculada para caberem. */}
                    <span className="grade-hora">{hhmm(b.p.perna.saida)}</span>
                    <span className="grade-rota">
                      {b.p.perna.from}<span className="grade-seta">→</span>{b.p.perna.to}
                    </span>
                  </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {(() => {
        const p = pernas.find((x) => x.perna.id === aberto)
        if (!p) return null
        return (
          <div className="grade-editor">
            <b>{p.perna.from} → {p.perna.to}</b>
            <span className="muted">{DOW_CURTO[p.perna.dow]}</span>
            <label>
              Parte às
              <input
                type="time" value={hhmm(p.perna.saida)}
                onChange={(e) => {
                  const m = lerHora(e.target.value)
                  if (m === null) return
                  const err = act((s) => remarcarVoo(s, p.perna.id, p.perna.dow, m))
                  if (err) toast(err, 'error')
                }}
              />
            </label>
            <span className="muted">chega {hhmm(p.chegadaLocal)} em {AIRPORT_BY_IATA[p.perna.to].city}</span>
            <button className="btn sm danger" onClick={() => {
              act((s) => removerVoo(s, p.perna.id))
              setAberto(null)
            }}>Tirar da escala</button>
          </div>
        )
      })()}

      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
        {typeOf(ac).name} · {ac.reg} · {typeOf(ac).turn} min de solo entre uma perna e a seguinte.
        Clique num voo para mudar a hora ou tirá-lo da escala. A hora é a local da
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
