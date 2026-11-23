import { HubsView } from './ui/HubsView'
import { invalidateAirportUsage } from './game/airportInfrastructure'
import { Activity, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { invalidateHubActivity } from './game/hubDevelopment'
import { gameDate, money, netWorth, pct, period } from './game/engine'
import {DaySimulation} from './game/daySimulation'
import { MS_POR_DIA_NA_TELA } from './ui/relogio'
import {
  AVAILABLE_SLOTS,
  clearSave,
  exportCompressedSave,
  getActiveSlot,
  getSlotInfo,
  hasSave,
  readSaveFile,
  loadSaveGame,
  persistSaveGame,
  flushLocalSave,
  queueSaveGame,
} from './game/save'
import type { SlotSummary } from './game/save'
import type { GameState } from './game/types'
import { GameContext, useGame } from './store/useGame'
import { Dashboard } from './ui/Dashboard'
import { CompetitorsView } from './ui/CompetitorsView'
import { ConnectionsView } from './ui/ConnectionsView'
import { CalendarView } from './ui/CalendarView'
import { FinanceView } from './ui/FinanceView'
import { FleetView } from './ui/FleetView'
import { MaintenanceView } from './ui/MaintenanceView'
import { MarketView } from './ui/MarketView'
import { NewGame } from './ui/NewGame'
import { RankingView } from './ui/RankingView'
import { RoutesView } from './ui/RoutesView'
import { Modal } from './ui/components/Bits'
import { downloadFile } from './livery/export'

const TABS = [
  { id: 'painel', label: 'Painel' },
  { id: 'rotas', label: 'Rotas' },
  { id: 'hubs', label: 'Hubs' },
  { id: 'bases', label: 'Bases grandes' },
  { id: 'conexoes', label: 'Conexões' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'frota', label: 'Frota' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'financas', label: 'Finanças' },
  { id: 'pintura', label: 'Manutenção' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'companhias', label: 'Companhias' },
]

const SPEEDS = [
  { v: 0, label: '❚❚' },
  { v: 1, label: '1×' },
  { v: 75, label: '75×' },
  { v: 300, label: '300×' },
  { v: 600, label: '600×' },
]

export function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [, force] = useState(0)
  const [tab, setTab] = useState('painel')
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['painel']))
  const [planningAircraftId, setPlanningAircraftId] = useState<string | null>(null)
  const [gameSession, setGameSession] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const tabPositions = useRef(new Map<string, { top?: number; focus?: HTMLElement }>())
  const changeTab = (next: string) => {
    if (next === tab) return
    tabPositions.current.set(tab, { ...tabPositions.current.get(tab), top: mainRef.current?.scrollTop })
    setVisitedTabs(tabs => tabs.has(next) ? tabs : new Set([...tabs, next]))
    setTab(next)
  }
  useLayoutEffect(() => {
    const position = tabPositions.current.get(tab)
    if (mainRef.current) mainRef.current.scrollTop = position?.top ?? 0
    if (position?.focus?.isConnected) position.focus.focus({ preventScroll: true })
  }, [tab, gameSession])
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])
  const [menu, setMenu] = useState(false)
  const stateRef = useRef<GameState | null>(null)
  const mutationRevision=useRef(0)
  const replace = useCallback((next: GameState | null) => {
    mutationRevision.current++
    stateRef.current = next
    setState(next)
    setPlanningAircraftId(null)
    setVisitedTabs(new Set(['painel']))
    tabPositions.current.clear()
    setTab('painel')
    setGameSession(session => session + 1)
  }, [])

  const toast = useCallback((msg: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const act = useCallback((fn: (s: GameState) => string | null | void) => {
    const s = stateRef.current
    if (!s) return null
    mutationRevision.current++
    const err = fn(s) ?? null
    invalidateHubActivity(s); invalidateAirportUsage(s)
    if (!err) {
      queueSaveGame(s, getActiveSlot())
    }
    setState(s)
    force((v) => v + 1)
    return err
  }, [])

  // Pausa/velocidade não mudam oferta de voos nem capacidade aeroportuária.
  const playback=useCallback((speed:number,paused:boolean)=>{
    const s=stateRef.current;if(!s)return
    mutationRevision.current++;s.speed=speed;s.paused=paused
    queueSaveGame(s,getActiveSlot());setState(s);force(v=>v+1)
  },[])

  // laço do jogo
  useEffect(() => {
    if (!state || state.paused || state.speed === 0) return
    const interval = Math.max(16, MS_POR_DIA_NA_TELA / state.speed)
    let id:ReturnType<typeof setTimeout>
    let disposed=false
    const simulation=new DaySimulation()
    const tick=async() => {
      const s = stateRef.current
      if (disposed || !s || s.paused || s.speed === 0) return
      const started=performance.now()
      const revision=mutationRevision.current
      try {
        const next=await simulation.advance(s, revision)
        if(disposed)return
        // Um clique pode alterar a companhia enquanto o worker calcula. Nesse
        // caso descarta a cópia antiga, preservando integralmente a ação.
        if(revision===mutationRevision.current){
          stateRef.current = next
          startTransition(() => setState(next))
          if(next.day%30===0)queueSaveGame(next,getActiveSlot())
        }
      }catch(error){
        if(disposed)return
        if(revision===mutationRevision.current){
          s.paused = true
          setState(s)
          force(v => v + 1)
          toast(`A simulação foi pausada: ${error instanceof Error?error.message:String(error)}`,'error')
          return
        }
      }
      // Reserva tempo para desenho e entrada mesmo quando um dia custa mais que
      // o intervalo solicitado. Não acumula ticks atrasados em 600×.
      id=setTimeout(tick,Math.max(32,interval-(performance.now()-started)))
    }
    id=setTimeout(tick,interval)
    return () => {disposed=true;clearTimeout(id);simulation.dispose()}
  }, [!!state, state?.paused, state?.speed, gameSession, toast])

  useEffect(()=>{
    const flush=()=>{const s=stateRef.current;if(s)flushLocalSave(s,getActiveSlot())}
    const error=()=>toast('Não foi possível salvar automaticamente. Exporte seu save pelo menu.','error')
    window.addEventListener('pagehide',flush);window.addEventListener('game-save-error',error)
    return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('game-save-error',error)}
  },[toast])

  // atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|SELECT|TEXTAREA/)) return
      const s=stateRef.current;if(!s)return
      if (e.code === 'Space') { e.preventDefault(); playback(s.speed,!s.paused) }
      if (e.key >= '1' && e.key <= '4') playback(SPEEDS[+e.key].v,false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playback])

  const ctx = useMemo(
    () => ({
      state: state as GameState,
      act,
      planningAircraftId,
      setPlanningAircraftId,
      replace,
      reset: () => { clearSave(getActiveSlot()); replace(null) },
      toast,
    }),
    [state, act, toast, replace, planningAircraftId],
  )

  if (!state) {
    return (
      <div className="app">
        <main>
          <StartScreen onStart={replace} toast={toast} />
        </main>
        <Toasts items={toasts} />
      </div>
    )
  }

  const date = gameDate(state)
  const p1 = period(state, 1)

  return (
    <GameContext.Provider value={ctx}>
      <div className="app" style={{ '--marca': state.airline.livery.tail } as React.CSSProperties}>
        <header className="topbar">
          <div className="brand">
            <span className="tag">✈</span>
            <div>
              {state.airline.name} <small>{state.airline.code}</small>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
                {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                {' · dia '}{state.day}
                {' · Slot '}{getActiveSlot()}
              </div>
            </div>
          </div>

          <div className="stat"><b className={state.airline.cash < 0 ? 'bad' : ''}>{money(state.airline.cash)}</b><span>Caixa</span></div>
          <div className="stat"><b>{money(netWorth(state))}</b><span>Patrimônio</span></div>
          {/* O resultado do último dia fechado, sem média: o número reage já no
              dia seguinte a uma mudança de preço ou de rota. Oscila com o dia da
              semana, e a tela Finanças tem os períodos maiores. */}
          <div className="stat" title="Resultado do último dia fechado.">
            <b className={p1.profit >= 0 ? 'good' : 'bad'}>{money(p1.profit)}</b><span>Lucro/dia</span>
          </div>
          <div className="stat"><b>{state.airline.fleet.length}</b><span>Frota</span></div>
          <div className="stat"><b>{pct(state.airline.reputation)}</b><span>Reputação</span></div>

          <div className="speed">
            {SPEEDS.map((s) => (
              <button
                key={s.v}
                className={(s.v === 0 ? state.paused : !state.paused && state.speed === s.v) ? 'on' : ''}
                onClick={() => playback(s.v===0?state.speed:s.v,s.v===0)}
                title={s.v === 0 ? 'Pausar (espaço)' : `${s.v}× mais rápido`}
              >
                {s.label}
              </button>
            ))}
            <button onClick={() => setMenu(true)} title="Jogo">☰</button>
          </div>
        </header>

        <nav className="nav game-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => changeTab(t.id)}>
              {t.label}
              {t.id === 'rotas' && state.airline.routes.length > 0 && (
                <span className="muted" style={{ marginLeft: 6 }}>{state.airline.routes.length}</span>
              )}
            </button>
          ))}
        </nav>

        <main ref={mainRef}>
          <div className="wrap" key={gameSession}>
            {TABS.filter(t => visitedTabs.has(t.id)).map(t => (
              <Activity key={t.id} mode={tab === t.id ? 'visible' : 'hidden'}>
                <section className="tab-panel" aria-hidden={tab !== t.id} onFocusCapture={event => {
                  tabPositions.current.set(t.id, { ...tabPositions.current.get(t.id), focus: event.target })
                }}>
                  {t.id === 'painel' && <Dashboard go={changeTab} />}
                  {t.id === 'rotas' && <RoutesView />}
                  {t.id === 'conexoes' && <ConnectionsView />}
                  {t.id === 'calendario' && <CalendarView />}
                  {t.id === 'frota' && <FleetView />}
                  {t.id === 'mercado' && <MarketView />}
                  {t.id === 'financas' && <FinanceView />}
                  {t.id === 'pintura' && <MaintenanceView />}
                  {t.id === 'ranking' && <RankingView />}
                  {t.id === 'hubs' && <HubsView />}
                  {t.id === 'bases' && <HubsView bases />}
                  {t.id === 'companhias' && <CompetitorsView />}
                </section>
              </Activity>
            ))}
          </div>
        </main>

        {menu && <GameMenu onClose={() => setMenu(false)} />}
        <Toasts items={toasts} />
      </div>
    </GameContext.Provider>
  )
}

function ConfirmModal({
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  kind = 'primary',
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 20px', lineHeight: 1.5 }}>
        {message}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={onCancel}>
          {cancelText}
        </button>
        <button className={`btn ${kind}`} disabled={busy} onClick={onConfirm}>
          {busy ? 'Aguarde…' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

function GameMenu({ onClose }: { onClose: () => void }) {
  const { state, replace, reset, toast } = useGame()
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const importRequest = useRef(0)
  const [pendingFile, setPendingFile] = useState<{ name: string; game: GameState } | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{
    type: 'save' | 'load' | 'delete' | 'new' | 'import'
    slot?: number
    title: string
    message: string
    kind?: 'primary' | 'danger'
  } | null>(null)

  const activeSlot = getActiveSlot()
  const [slotsInfo, setSlotsInfo] = useState<(SlotSummary | null)[]>(() =>
    AVAILABLE_SLOTS.map((s) => getSlotInfo(s)),
  )

  const refreshSlots = useCallback(() => {
    setSlotsInfo(AVAILABLE_SLOTS.map((s) => getSlotInfo(s)))
  }, [])

  if (!state) return null

  const handleConfirmAction = async () => {
    if (!pendingConfirm || saving) return
    setSaving(true)
    const { type, slot } = pendingConfirm

    if (type === 'save' && slot) {
      if (await persistSaveGame(state, slot)) {
        toast(`Partida salva no Slot ${slot}.`)
        refreshSlots()
      } else toast('Não foi possível salvar neste slot.', 'error')
    } else if (type === 'load' && slot) {
      const loaded = await loadSaveGame(slot)
      if (loaded) {
        replace(loaded)
        toast(`Slot ${slot} carregado com sucesso.`)
        onClose()
      } else {
        toast('Erro ao carregar o save.', 'error')
      }
    } else if (type === 'delete' && slot) {
      clearSave(slot)
      toast(`Save do Slot ${slot} excluído.`)
      refreshSlots()
    } else if (type === 'import' && pendingFile) {
      pendingFile.game.paused = true
      if (await persistSaveGame(pendingFile.game, activeSlot)) {
        replace(pendingFile.game)
        toast(`Partida importada no Slot ${activeSlot}.`)
        onClose()
      } else {
        toast('Não foi possível salvar a partida importada. Verifique o espaço do navegador.', 'error')
      }
    } else if (type === 'new') {
      reset()
      onClose()
    }

    setPendingConfirm(null)
    setSaving(false)
  }

  return (
    <Modal title="Gerenciador de Saves" onClose={onClose}>
      <div className="grid" style={{ gap: 12, marginBottom: 18 }}>
        {AVAILABLE_SLOTS.map((slotNum) => {
          const info = slotsInfo[slotNum - 1]
          const isActive = slotNum === activeSlot

          return (
            <div
              key={slotNum}
              className="card tight"
              style={{
                borderColor: isActive ? 'var(--amber)' : 'var(--line)',
                background: isActive ? 'rgba(255, 181, 71, 0.05)' : undefined,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="row tight">
                  <b>Slot {slotNum}</b>
                  {isActive && <span className="chip sm">Slot Atual</span>}
                </div>
                {info && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    Dia {info.day} · Base {info.hub}
                  </span>
                )}
              </div>

              {info ? (
                <div style={{ fontSize: 12, marginBottom: 10, color: 'var(--ink-2)' }}>
                  <b>{info.name}</b> ({info.code}) — Caixa: {money(info.cash)}
                </div>
              ) : (
                <div style={{ fontSize: 12, marginBottom: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  Slot Vazio
                </div>
              )}

              <div className="row tight">
                <button
                  className="btn sm primary"
                  onClick={() =>
                    setPendingConfirm({
                      type: 'save',
                      slot: slotNum,
                      title: `Salvar no Slot ${slotNum}`,
                      message: info
                        ? `A partida atual irá sobrescrever o save do Slot ${slotNum} (${info.name}). Deseja continuar?`
                        : `Deseja salvar a partida atual no Slot ${slotNum}?`,
                    })
                  }
                >
                  Salvar
                </button>

                {info && (
                  <>
                    <button
                      className="btn sm"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'load',
                          slot: slotNum,
                          title: `Carregar Slot ${slotNum}`,
                          message: `Deseja carregar a partida do Slot ${slotNum} (${info.name})? Todo o progresso não salvo na partida atual será perdido.`,
                        })
                      }
                    >
                      Carregar
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'delete',
                          slot: slotNum,
                          title: `Excluir Save do Slot ${slotNum}`,
                          message: `Tem certeza que deseja excluir permanentemente o save do Slot ${slotNum} (${info.name})? Esta ação não pode ser desfeita.`,
                          kind: 'danger',
                        })
                      }
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button
          className="btn danger"
          onClick={() =>
            setPendingConfirm({
              type: 'new',
              title: 'Iniciar Nova Partida',
              message: 'Deseja sair da partida atual para criar um novo jogo? Verifique se você salvou o seu progresso.',
              kind: 'danger',
            })
          }
        >
          Nova partida
        </button>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div className="field">
          <span>Exportar partida atual</span>
          <button className="btn" disabled={exporting} onClick={async () => {
            setExporting(true)
            try {
              const filename = `the-airline-simulator-${state.airline.code.replace(/[^a-z0-9-]/gi, '') || 'save'}-slot-${activeSlot}-${new Date().toISOString().slice(0, 10)}.json.gz`
              downloadFile(filename, await exportCompressedSave(state))
            } catch (error) {
              toast(error instanceof Error ? error.message : 'Não foi possível gerar o arquivo da partida.', 'error')
            } finally { setExporting(false) }
          }}>{exporting ? 'Compactando partida…' : 'Baixar save compactado'}</button>
          <small className="muted">Partida completa em JSON compactado (.json.gz), com limite de 50 MB.</small>
        </div>

        <label className="field">
          <span>Importar partida de arquivo</span>
          <input type="file" accept=".gz,.json,.txt,application/gzip,application/json,text/plain" aria-label="Selecionar arquivo de save" onChange={async e => {
            const request = ++importRequest.current
            const file = e.target.files?.[0]
            e.target.value = ''
            setPendingFile(null)
            if (!file) return
            try {
              const game = await readSaveFile(file)
              if (request !== importRequest.current) return
              if (!game) return toast('Arquivo de save inválido ou incompatível.', 'error')
              setPendingFile({ name: file.name, game })
            } catch {
              if (request === importRequest.current) toast('Não foi possível ler o arquivo de save.', 'error')
            }
          }} />
          <small className="muted">Aceita .json.gz, JSON e backups antigos em .txt.</small>
        </label>
        {pendingFile && <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {pendingFile.name} · {pendingFile.game.airline.name} · dia {pendingFile.game.day}
        </p>}
        <button className="btn" disabled={!pendingFile} onClick={() => {
          if (!pendingFile) return
          setPendingConfirm({ type: 'import', title: `Importar no Slot ${activeSlot}`,
            message: `O arquivo ${pendingFile.name} substituirá o save do Slot ${activeSlot}. Deseja continuar?` })
        }}>Importar partida</button>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Atalhos: <b>espaço</b> pausa, <b>1–4</b> mudam a velocidade. Cada slot salva automaticamente a cada ação e a cada 30 dias.
      </p>

      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          kind={pendingConfirm.kind}
          onConfirm={handleConfirmAction}
          busy={saving}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </Modal>
  )
}

function StartScreen({
  onStart,
  toast,
}: {
  onStart: (s: GameState) => void
  toast: (m: string, k?: 'info' | 'error') => void
}) {
  const [creatingSlot, setCreatingSlot] = useState<number | null>(() =>
    !hasSave(1) && !hasSave(2) && !hasSave(3) ? 1 : null,
  )
  const [pendingConfirm, setPendingConfirm] = useState<{
    slot: number
    title: string
    message: string
  } | null>(null)

  const [slotsInfo, setSlotsInfo] = useState<(SlotSummary | null)[]>(() =>
    AVAILABLE_SLOTS.map((s) => getSlotInfo(s)),
  )

  const refreshSlots = useCallback(() => {
    setSlotsInfo(AVAILABLE_SLOTS.map((s) => getSlotInfo(s)))
  }, [])

  if (creatingSlot !== null) {
    const hasAnySave = hasSave(1) || hasSave(2) || hasSave(3)
    return (
      <NewGame
        initialSlot={creatingSlot}
        onStart={(s) => onStart(s)}
        onCancel={hasAnySave ? () => setCreatingSlot(null) : undefined}
      />
    )
  }

  const handleConfirmDelete = () => {
    if (!pendingConfirm) return
    clearSave(pendingConfirm.slot)
    toast(`Save do Slot ${pendingConfirm.slot} excluído.`)
    refreshSlots()
    setPendingConfirm(null)
  }

  return (
    <div className="wrap start" style={{ paddingTop: 40, textAlign: 'center' }}>
      <span className="eyebrow">Simulador de companhia aérea</span>
      <h1 className="titulo" style={{ fontSize: 44 }}>Skyline Tycoon</h1>
      <p className="dim" style={{ maxWidth: 520, margin: '12px auto 28px' }}>
        Monte a malha, escolha os aviões, brigue por passageiro no preço e na frequência — e pinte tudo do seu jeito.
      </p>

      <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'left' }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 12 }}>
          Escolha um Save ou crie um novo jogo:
        </h3>

        <div className="grid" style={{ gap: 12 }}>
          {AVAILABLE_SLOTS.map((slotNum) => {
            const info = slotsInfo[slotNum - 1]

            return (
              <div key={slotNum} className="card tight">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <b>Slot {slotNum}</b>
                  {info && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Dia {info.day} · Base {info.hub}
                    </span>
                  )}
                </div>

                {info ? (
                  <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--ink-2)' }}>
                    <b>{info.name}</b> ({info.code}) — Caixa: {money(info.cash)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    Slot Vazio
                  </div>
                )}

                <div className="row tight">
                  {info ? (
                    <>
                      <button
                        className="btn primary sm"
                        onClick={async () => {
                          const s = await loadSaveGame(slotNum)
                          if (s) onStart(s)
                          else toast('Save corrompido.', 'error')
                        }}
                      >
                        Continuar
                      </button>
                      <button
                        className="btn sm danger"
                        onClick={() =>
                          setPendingConfirm({
                            slot: slotNum,
                            title: `Excluir Save do Slot ${slotNum}`,
                            message: `Tem certeza que deseja excluir o save do Slot ${slotNum} (${info.name})? Esta ação não pode ser desfeita.`,
                          })
                        }
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn primary sm"
                      onClick={() => setCreatingSlot(slotNum)}
                    >
                      Criar novo jogo
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          kind="danger"
          confirmText="Excluir"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}

function Toasts({ items }: { items: { id: number; msg: string; kind: string }[] }) {
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.msg}</div>
      ))}
    </div>
  )
}
