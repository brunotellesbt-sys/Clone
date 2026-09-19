import { useState } from 'react'
import { AIRPORT_BY_IATA } from '../../game/data/airports'
import {
  aeronavesPara, DOW_CURTO, hhmm, lerHora, marcarVoo, pernasDe, blocoDe, fichaDe,
} from '../../game/escala'
import { acLabel } from '../../game/data/aircraft'
import { sumCabins } from '../../game/economy'
import { dowOf, km, slotsFree } from '../../game/engine'
import { distanceBetween } from '../../game/geo'
import type { Route } from '../../game/types'
import { useGame } from '../../store/useGame'
import { Card } from './Bits'

/**
 * Marcar um voo: primeiro o voo, depois a aeronave.
 *
 * É a inversão que a malha trouxe. Antes o jogador alocava um avião numa rota e
 * só então escolhia horários, e o avião ficava preso àquele par até ser retirado.
 * Agora ele diz **que voo quer** — sentido, dia e hora — e o jogo responde quem
 * está naquele aeroporto naquele momento com folga para voá-lo.
 *
 * A lista mostra as caudas impedidas também, com o motivo. Uma aeronave que
 * pousa em Fortaleza não pode sair do Rio às 9h, e dizer isso é o que ensina a
 * montar a cadeia: o jogador lê "PR-HSR pousa em FOR", marca FOR–CGH, e a malha
 * nasce dali.
 */
export function NovoVoo({ route }: { route: Route }) {
  const { state, act, toast } = useGame()
  const [sentido, setSentido] = useState<'ida' | 'volta'>('ida')
  /**
   * O dia começa em **hoje**, não numa segunda fixa.
   *
   * Marcar um voo e não achar o avião no mapa não é defeito do mapa: era a
   * grade sendo marcada para outro dia da semana. O padrão que não surpreende
   * é o dia em que o jogo está.
   */
  /**
   * Os dias escolhidos, e não um só.
   *
   * Marcar a mesma perna sete vezes é a operação mais comum do jogo — uma
   * ponte aérea é o mesmo voo todo dia —, e ela custava sete voltas pela
   * lista suspensa, pela lista de aeronaves e pelo botão. A escolha passou a
   * ser um conjunto; o resto da tela continua igual.
   */
  const [dias, setDias] = useState<number[]>(() => [dowOf(state)])
  const [hora, setHora] = useState('08:00')
  /** O primeiro dia escolhido manda na lista de aeronaves. Ver `porDia`. */
  const dow = dias[0] ?? dowOf(state)

  const from = sentido === 'ida' ? route.from : route.to
  const to = sentido === 'ida' ? route.to : route.from
  const minutos = lerHora(hora) ?? 8 * 60

  /**
   * Sem `useMemo`, e de propósito.
   *
   * `act` muta o estado no lugar e força o redesenho por um contador — o objeto
   * `state` é sempre o mesmo. Uma memoização com `state` na lista de
   * dependências nunca invalida: a lista continuava oferecendo a cauda que
   * acabou de decolar, e só o teste de navegador pegou isso. A conta varre a
   * frota uma vez por quadro, o que é barato perto de errar a resposta.
   */
  const candidatas = aeronavesPara(state, from, to, dow, minutos)
  // três grupos, e a ordem é a da decisão: quem está aqui, quem viria vazio,
  // quem não pode. O do meio é o que faltava — a escala não proíbe, ela cobra.
  const livres = candidatas.filter((c) => !c.impedimento && !c.ferryDe && !c.ferryPara)
  const comVazio = candidatas.filter((c) => !c.impedimento && (c.ferryDe || c.ferryPara))
  const presas = candidatas.filter((c) => c.impedimento)

  /**
   * Marca em todos os dias escolhidos, um a um, e conta o que deu certo.
   *
   * Um a um porque **cada marcação muda a escala da cauda**: depois de voar
   * domingo Rio–São Paulo, na segunda o avião amanhece em São Paulo e não pode
   * sair do Rio de novo. Isso não é defeito, é a regra da malha — e é por isso
   * que o resultado é contado depois de marcar, e não previsto antes: prever
   * daria uma lista que mente no segundo dia.
   *
   * O aviso diz quantos dias entraram e **por que** um deles ficou de fora,
   * com o motivo do primeiro recusado. Sem o motivo, "3 de 7" manda o jogador
   * adivinhar; com ele, o jogador lê "amanhece em CGH" e vai marcar a volta,
   * que é exatamente a decisão que faltava.
   */
  const marcar = (acId: string) => {
    const recusas: string[] = []
    let feitos = 0
    act((s) => {
      for (const d of [...dias].sort((x, y) => x - y)) {
        const err = marcarVoo(s, acId, from, to, d, minutos)
        if (err) recusas.push(`${DOW_CURTO[d]}: ${err}`)
        else feitos++
      }
      return null
    })
    if (feitos === 0) return toast(recusas[0] ?? 'Nenhum dia pôde ser marcado.', 'error')
    const quando = feitos === dias.length
      ? `${feitos} ${feitos === 1 ? 'dia' : 'dias'}`
      : `${feitos} de ${dias.length} dias — ${recusas[0]}`
    toast(`${from} → ${to} às ${hhmm(minutos)}: ${quando}.`, recusas.length ? 'info' : 'info')
  }

  /**
   * O rótulo do botão diz quantos dias vão junto.
   *
   * A lista de aeronaves é medida no **primeiro** dia escolhido, e continua
   * assim de propósito: medir nos sete exigiria simular as marcações em
   * sequência, e o resultado mudaria a cada linha da lista. O que o botão
   * promete é o que ele tenta; o que ele conseguiu, o aviso conta depois.
   */
  const rotulo = dias.length === 1 ? 'Marcar' : `Marcar ${dias.length} dias`

  const alternar = (d: number) =>
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort((x, y) => x - y)))

  return (
    <Card title="Marcar voo">
      <div className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="row tight" style={{ flex: '0 0 auto' }}>
          <button className={`btn sm ${sentido === 'ida' ? 'primary' : ''}`} onClick={() => setSentido('ida')}>
            {route.from} → {route.to}
          </button>
          <button className={`btn sm ${sentido === 'volta' ? 'primary' : ''}`} onClick={() => setSentido('volta')}>
            {route.to} → {route.from}
          </button>
        </div>
        <label className="field" style={{ flex: '0 0 120px', marginBottom: 0 }}>
          <span>Parte às</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
      </div>

      {/* Os sete dias como botão, e não lista suspensa: com lista, escolher
          quatro dias custa quatro aberturas de menu, e no celular o menu é uma
          tela inteira. Aqui é um toque por dia, e dá para ver o que está
          escolhido sem abrir nada. */}
      <div className="campo-dias" style={{ marginBottom: 10 }}>
        <span>Dias</span>
        <div className="row tight dias-semana" style={{ flexWrap: 'wrap' }}>
          {DOW_CURTO.map((d, i) => (
            <button
              key={i}
              className={`btn sm ${dias.includes(i) ? 'primary' : ''}`}
              aria-pressed={dias.includes(i)}
              onClick={() => alternar(i)}
            >
              {d}
            </button>
          ))}
          <span className="separador-dias" />
          {/* Atalhos, e não dias: por isso a borda tracejada. Sem a diferença
              eles pareciam três dias da semana que nunca acendem. */}
          <button className="btn sm atalho-dias" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Todos</button>
          <button className="btn sm atalho-dias" onClick={() => setDias([1, 2, 3, 4, 5])}>Úteis</button>
          <button className="btn sm atalho-dias" onClick={() => setDias([dowOf(state)])}>Hoje</button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
        {km(distanceBetween(from, to))} · slots livres: {slotsFree(state, from)} em {from},{' '}
        {slotsFree(state, to)} em {to}.
      </p>

      {livres.length === 0 ? (
        <p className="bad" style={{ margin: '0 0 10px' }}>
            Nenhuma aeronave está em {from} {dias.length > 1 ? `em ${DOW_CURTO[dow]}` : 'nesse dia'} às{' '}
          {hhmm(minutos)} com folga para este voo.
        </p>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <h4 className="sub">Disponíveis em {from}</h4>
          {livres.map(({ ac }) => {
            const bloco = blocoDe(state, { id: '', aircraftId: ac.id, from, to, dow, saida: minutos })
            const chega = minutos + bloco + (AIRPORT_BY_IATA[to].fuso - AIRPORT_BY_IATA[from].fuso)
            return (
              <div key={ac.id} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span>
                  <b>{ac.reg}</b> <span className="muted">{acLabel(fichaDe(ac))}</span>{' '}
                  <span className="dim">{sumCabins(ac.seats)} assentos · {pernasDe(state, ac.id).length} voos na semana</span>
                  <br />
                  <span className="muted" style={{ fontSize: 12 }}>
                    chega {hhmm(chega)} em {AIRPORT_BY_IATA[to].city}
                  </span>
                </span>
                <button className="btn sm primary" onClick={() => marcar(ac.id)}>{rotulo}</button>
              </div>
            )
          })}
        </div>
      )}

      {comVazio.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <h4 className="sub">Podem voar, mas custam um voo vazio</h4>
          {comVazio.map(({ ac, ferryDe, ferryPara }) => (
            <div key={ac.id} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <span>
                <b>{ac.reg}</b> <span className="muted">{acLabel(fichaDe(ac))}</span>
                <br />
                <span className="warn" style={{ fontSize: 12 }}>
                  {ferryDe && `viria vazia de ${ferryDe}`}
                  {ferryDe && ferryPara && ' · '}
                  {ferryPara && `seguiria vazia para ${ferryPara}`}
                </span>
              </span>
              <button className="btn sm" onClick={() => marcar(ac.id)}>{rotulo} assim</button>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            O jogo não teleporta avião: ele voa o trecho vazio, pagando combustível e tripulação
            sem vender assento. Às vezes compensa; quase sempre é sinal de que falta uma perna.
          </p>
        </div>
      )}

      {presas.length > 0 && (
        <details>
          <summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>
            {presas.length} {presas.length === 1 ? 'aeronave não pode' : 'aeronaves não podem'} voar isto
          </summary>
          <div style={{ marginTop: 6 }}>
            {presas.map(({ ac, impedimento }) => (
              <div key={ac.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                <span className="muted"><b>{ac.reg}</b> {impedimento}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
        O avião precisa <b>estar</b> no aeroporto de partida. Se ele pousou em outro lugar, a lista
        diz onde — e o voo seguinte pode sair de lá, para qualquer rota que você tenha aberta. É
        assim que a frota circula em vez de ficar presa a um par de aeroportos.
      </p>
    </Card>
  )
}
