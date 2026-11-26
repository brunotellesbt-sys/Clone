import { useState } from 'react'
import { cabinLength, checkCabin, crewFor, pitchFare, sumSeats, textoDasClasses } from '../game/cabin'
import { apagarCabine, cabinesDoModelo, salvarCabine } from '../game/cabinProfiles'
import { acLabel, AIRCRAFT_BY_ID } from '../game/data/aircraft'
import { CLASS_FARE_MULT } from '../game/demand'
import { money, setCabin } from '../game/engine'
import { seatChangeCost } from '../game/seatModels'
import { CABINS, type Aircraft } from '../game/types'
import { useGame } from '../store/useGame'
import { Bar, Modal } from './components/Bits'
import { SeatMapEditor } from './SeatMapEditor'
import { useCabine } from './useCabine'

/**
 * Montar a cabine de uma aeronave.
 *
 * Três decisões desta tela têm razão de ser, e todas vieram de o jogador bater
 * nelas:
 *
 * - **os controles não passam do que cabe.** Antes iam até `maxSeats` em toda
 *   classe e o jogo só reclamava no botão — dava para arrastar as quatro até o
 *   talo, ler "não cabe" e ter que desfazer tudo no tato. Dizer não depois de
 *   deixar tentar é a pior das duas respostas;
 * - **o passo também trava.** Esticar o passo com as fileiras já postas estoura
 *   a cabine do mesmo jeito. Quem quer mais espaço tira assento antes, que é a
 *   decisão que a tela existe para cobrar;
 * - **a cabine montada se guarda com nome.** Montar quatro classes é demorado,
 *   e repetir isso a cada avião comprado é trabalho jogado fora.
 */
export function CabinModal({ ac, onClose }: { ac: Aircraft; onClose: () => void }) {
  const { state, act, toast } = useGame()
  const t = AIRCRAFT_BY_ID[ac.typeId]
  const { seats, pitch, seatConfig, aplicar, setAssentos, setPasso, carregar } =
    useCabine(t, { seats: ac.seats, pitch: ac.pitch, seatConfig: ac.seatConfig ?? {} })
  const [nome, setNome] = useState('')

  const chk = checkCabin(t, seats, pitch, seatConfig)
  const total = sumSeats(seats)
  const inches = cabinLength(t)
  const salvas = cabinesDoModelo(state, ac.typeId)

  // Quanto a configuração rende, em "assentos econômicos padrão".
  const units = CABINS.reduce((sum, c) => sum + seats[c] * CLASS_FARE_MULT[c] * pitchFare(c, pitch[c]), 0)
  const denseRows = Math.floor((inches - 90) / 28)
  const denseUnits = Math.min(denseRows * t.abreast, t.maxSeats) * pitchFare('y', 28)

  return (
    <Modal wide title={`Cabine do ${acLabel(t)} · ${ac.reg}`} onClose={onClose}>
      <p className="dim" style={{ marginTop: 0 }}>
        A cabine do {t.name} tem <b>{(inches / 39.37).toFixed(1)} m</b> úteis e limite de saídas de{' '}
        <b>{t.maxSeats} passageiros</b>. Cada fileira come o passo que você escolher: passo maior
        rende mais por assento e leva menos gente. É a conta que a companhia faz de verdade.
      {' '}{textoDasClasses(t)}</p>

      {salvas.length > 0 && (
        <>
          <h4 className="sub">Suas configurações para o {t.name}</h4>
          <div className="lista-curta row tight" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {salvas.map((cb) => (
              <span key={cb.id} className="salva">
                <button className="btn sm" title={`${sumSeats(cb.seats)} assentos`}
                  onClick={() => carregar(cb)}>
                  {cb.nome} <span className="muted">{sumSeats(cb.seats)}</span>
                </button>
                <button className="btn sm ghost" title="apagar" aria-label={`Apagar ${cb.nome}`}
                  onClick={() => act((s) => apagarCabine(s, cb.id))}>×</button>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="resumo-cabine">
        <div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span className={chk.overLength ? 'bad' : 'dim'}>
              {(chk.used / 39.37).toFixed(1)} m de {(inches / 39.37).toFixed(1)} m
            </span>
            <span className={chk.overLimit ? 'bad' : 'dim'}>{total} de {t.maxSeats} passageiros</span>
          </div>
          <Bar value={chk.used / inches} tone={chk.overLength ? '#fb7185' : undefined} />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
            <span className="dim" title="Regra geral por assentos instalados: 1 a cada 50 ou fração. A classe não acrescenta comissários automaticamente.">Comissários por configuração</span><b>{crewFor(seats)}</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <span className="dim">Receita com o avião cheio</span>
            <b className={units >= denseUnits ? 'good' : 'bad'}>
              {denseUnits > 0 ? `${units >= denseUnits ? '+' : ''}${((units / denseUnits - 1) * 100).toFixed(0)}%` : '—'}
              <span className="muted" style={{ fontWeight: 400 }}> vs. alta densidade</span>
            </b>
          </div>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          <div className="row tight">
            <input type="text" placeholder="nome da configuração" maxLength={32}
              aria-label="Nome da configuração" value={nome} onChange={(e) => setNome(e.target.value)} />
            <button className="btn sm" disabled={!chk.ok || !nome.trim()}
              onClick={() => {
                const err = act((s) => salvarCabine(s, ac.typeId, nome, seats, pitch, seatConfig))
                if (err) toast(err, 'error')
                else { toast(`"${nome.trim()}" guardada para o ${t.name}.`, 'info'); setNome('') }
              }}>
              Salvar
            </button>
          </div>
          <button
            className="btn primary"
            disabled={!chk.ok || total === 0}
            onClick={() => {
              const err = act((s) => setCabin(s, ac.id, seats, pitch, seatConfig))
              if (err) toast(err, 'error')
              else onClose()
            }}
          >
            Reconfigurar
          </button>
        </div>
      </div>
      <p className="dim">Custo da reforma: <b>{money(seatChangeCost(seats, seatConfig))}</b> · {seats.c + seats.f > 0 ? 4 : 2} dias parado.</p>
      {chk.seatError && <p className="bad">{chk.seatError}</p>}
      <SeatMapEditor type={t} seats={seats} pitch={pitch} config={seatConfig}
        change={(c, p) => aplicar({ seats, pitch: p, config: c })}
        setAssentos={setAssentos} setPasso={setPasso} />
    </Modal>
  )
}
