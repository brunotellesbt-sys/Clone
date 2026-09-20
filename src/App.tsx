import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advanceDay, gameDate, money, netWorth, pct, period } from './game/engine'
import { MS_POR_DIA_NA_TELA } from './ui/relogio'
import {
  clearSave,
  exportSave,
  getActiveSlot,
  getSlotSummary,
  importSave,
  loadGame,
  saveGame,
  setActiveSlot,
  SLOTS,
  type SlotSummary,
} from './game/save'
import type { GameState } from './game/types'
import { GameContext, useGame } from './store/useGame'
import { Dashboard } from './ui/Dashboard'
import { FinanceView } from './ui/FinanceView'
import { FleetView } from './ui/FleetView'
import { LiveryEditor } from './ui/LiveryEditor'
import { MarketView } from './ui/MarketView'
import { NewGame } from './ui/NewGame'
import { RankingView } from './ui/RankingView'
import { RoutesView } from './ui/RoutesView'
import { Modal } from './ui/components/Bits'

const TABS = [
  { id: 'painel', label: 'Painel' },
  { id: 'rotas', label: 'Rotas' },
  { id: 'frota', label: 'Frota' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'financas', label: 'Finanças' },
  { id: 'pintura', label: 'Pintura' },
  { id: 'ranking', label: 'Ranking' },
]

const SPEEDS = [
  { v: 0, label: '❚❚' },
  { v: 1, label: '1×' },
  { v: 4, label: '4×' },
  { v: 12, label: '12×' },
  { v: 40, label: '40×' },
]

export function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [activeSlot, setActiveSlotState] = useState<number>(() => getActiveSlot())
  const [, force] = useState(0)
  const [tab, setTab] = useState('painel')
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])
  const [menu, setMenu] = useState(false)

  const stateRef = useRef<GameState | null>(null)
  stateRef.current = state

  const activeSlotRef = useRef<number>(activeSlot)
  activeSlotRef.current = activeSlot

  const toast = useCallback((msg: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const act = useCallback((fn: (s: GameState) => string | null | void) => {
    const s = stateRef.current
    if (!s) return null
    const err = fn(s) ?? null
    // Auto save a cada ação do usuário no jogo
    saveGame(s, activeSlotRef.current)
    force((v) => v + 1)
    return err
  }, [])

  // laço do jogo
  useEffect(() => {
    if (!state || state.paused || state.speed === 0) return
    const interval = Math.max(16, MS_POR_DIA_NA_TELA / state.speed)
    const id = setInterval(() => {
      const s = stateRef.current
      if (!s || s.paused || s.speed === 0) return
      advanceDay(s)
      if (s.day % 30 === 0) saveGame(s, activeSlotRef.current)
      force((v) => v + 1)
    }, interval)
    return () => clearInterval(id)
  }, [state, state?.paused, state?.speed])

  // atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|SELECT|TEXTAREA/)) return
      if (e.code === 'Space') { e.preventDefault(); act((s) => { s.paused = !s.paused }) }
      if (e.key >= '1' && e.key <= '4') act((s) => { s.speed = SPEEDS[+e.key].v; s.paused = false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act])

  const handleStartGame = useCallback((s: GameState, slot: number) => {
    setActiveSlotState(slot)
    setActiveSlot(slot)
    setState(s)
    saveGame(s, slot)
  }, [])

  const switchSlot = useCallback((slot: number) => {
    const loaded = loadGame(slot)
    if (loaded) {
      setActiveSlotState(slot)
      setActiveSlot(slot)
      setState(loaded)
    } else {
      toast(`Nenhum save encontrado no Slot ${slot}.`, 'error')
    }
  }, [toast])

  const ctx = useMemo(
    () => ({
      state: state as GameState,
      activeSlot,
      act,
      replace: (s: GameState, slot = activeSlot) => {
        setActiveSlotState(slot)
        setActiveSlot(slot)
        setState(s)
        saveGame(s, slot)
      },
      reset: (slot = activeSlot) => {
        clearSave(slot)
        if (slot === activeSlot) {
          setState(null)
        }
      },
      switchSlot,
      toast,
    }),
    [state, activeSlot, act, switchSlot, toast],
  )

  if (!state) {
    return (
      <div className="app">
        <main>
          <StartScreen onStart={handleStartGame} toast={toast} />
        </main>
        <Toasts items={toasts} />
      </div>
    )
  }

  const date = gameDate(state)
  const p7 = period(state, 7)

  return (
    <GameContext.Provider value={ctx}>
      {/* o chrome pega a cor da deriva: a tela fica sendo da companhia do jogador */}
      <div className="app" style={{ '--marca': state.airline.livery.tail } as React.CSSProperties}>
        <header className="topbar">
          <div className="brand">
            <span className="tag">✈</span>
            <div>
              {state.airline.name} <small>{state.airline.code} · Slot {activeSlot}</small>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
                {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                {' · dia '}{state.day}
              </div>
            </div>
          </div>

          <div className="stat"><b className={state.airline.cash < 0 ? 'bad' : ''}>{money(state.airline.cash)}</b><span>Caixa</span></div>
          <div className="stat"><b>{money(netWorth(state))}</b><span>Patrimônio</span></div>
          <div className="stat"><b className={p7.profit >= 0 ? 'good' : 'bad'}>{money(p7.profit / Math.max(1, p7.days))}</b><span>Lucro/dia</span></div>
          <div className="stat"><b>{state.airline.fleet.length}</b><span>Frota</span></div>
          <div className="stat"><b>{pct(state.airline.reputation)}</b><span>Reputação</span></div>

          <div className="speed">
            {SPEEDS.map((s) => (
              <button
                key={s.v}
                className={(s.v === 0 ? state.paused : !state.paused && state.speed === s.v) ? 'on' : ''}
                onClick={() => act((g) => { if (s.v === 0) g.paused = true; else { g.paused = false; g.speed = s.v } })}
                title={s.v === 0 ? 'Pausar (espaço)' : `${s.v}× mais rápido`}
              >
                {s.label}
              </button>
            ))}
            <button onClick={() => setMenu(true)} title="Jogo">☰</button>
          </div>
        </header>

        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'rotas' && state.airline.routes.length > 0 && (
                <span className="muted" style={{ marginLeft: 6 }}>{state.airline.routes.length}</span>
              )}
            </button>
          ))}
        </nav>

        <main>
          <div className="wrap">
            {tab === 'painel' && <Dashboard go={setTab} />}
            {tab === 'rotas' && <RoutesView />}
            {tab === 'frota' && <FleetView />}
            {tab === 'mercado' && <MarketView />}
            {tab === 'financas' && <FinanceView />}
            {tab === 'pintura' && <LiveryEditor />}
            {tab === 'ranking' && <RankingView />}
          </div>
        </main>

        {menu && <GameMenu onClose={() => setMenu(false)} onMainScreen={() => { setMenu(false); setState(null) }} />}
        <Toasts items={toasts} />
      </div>
    </GameContext.Provider>
  )
}

function GameMenu({ onClose, onMainScreen }: { onClose: () => void; onMainScreen: () => void }) {
  const { state, activeSlot, replace, toast, switchSlot } = useGame()
  const [code, setCode] = useState('')
  const [targetImportSlot, setTargetImportSlot] = useState(activeSlot)

  if (!state) return null

  const summaries = SLOTS.map((s) => ({ slot: s, summary: getSlotSummary(s) }))

  return (
    <Modal title="Jogo" onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-2)' }}>
          Jogo em andamento no <b>Slot {activeSlot}</b> ({state.airline.name}). Auto-save ativado em cada ação.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn primary"
            onClick={() => {
              saveGame(state, activeSlot)
              toast(`Partida salva no Slot ${activeSlot}.`)
            }}
          >
            Salvar agora
          </button>
          <button className="btn" onClick={onMainScreen}>
            Menu de Slots
          </button>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      <h4 style={{ margin: '0 0 10px' }}>Alternar de Slot</h4>
      <div className="grid" style={{ gap: 10, marginBottom: 16 }}>
        {summaries.map(({ slot, summary }) => {
          const isCurrent = slot === activeSlot
          return (
            <div
              key={slot}
              className="card"
              style={{
                padding: '10px 14px',
                borderColor: isCurrent ? 'var(--marca, #3b82f6)' : 'var(--line)',
                background: isCurrent ? 'rgba(59, 130, 246, 0.05)' : undefined,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Slot {slot}</strong> {isCurrent && <span className="chip sm primary">Atual</span>}
                  {summary ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                      <b>{summary.airlineName}</b> ({summary.code}) · Base: {summary.hub} · Dia {summary.day}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Slot Vazio</div>
                  )}
                </div>

                {!isCurrent && summary && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      switchSlot(slot)
                      onClose()
                    }}
                  >
                    Carregar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      <label className="field">
        <span>Exportar partida atual (Slot {activeSlot})</span>
        <textarea
          readOnly
          rows={3}
          value={exportSave(state)}
          style={{
            width: '100%',
            background: '#0b1424',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 8,
            color: 'var(--ink-2)',
            fontSize: 11,
          }}
        />
      </label>

      <div className="card" style={{ padding: 12, marginTop: 10 }}>
        <h4 style={{ margin: '0 0 8px' }}>Importar partida</h4>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Importar para:</span>
            <select
              value={targetImportSlot}
              onChange={(e) => setTargetImportSlot(+e.target.value)}
              style={{ padding: '4px 8px' }}
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  Slot {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field" style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={code}
            placeholder="cole aqui o texto exportado"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button
          className="btn sm"
          onClick={() => {
            const s = importSave(code)
            if (s) {
              replace(s, targetImportSlot)
              toast(`Partida importada com sucesso para o Slot ${targetImportSlot}!`)
              onClose()
            } else {
              toast('Texto de importação inválido.', 'error')
            }
          }}
        >
          Importar para Slot {targetImportSlot}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
        Atalhos: <b>espaço</b> pausa, <b>1–4</b> mudam a velocidade. O jogo salva sozinho a cada ação feita.
      </p>
    </Modal>
  )
}

function StartScreen({
  onStart,
  toast,
}: {
  onStart: (s: GameState, slot: number) => void
  toast: (m: string, k?: 'info' | 'error') => void
}) {
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<(SlotSummary | null)[]>(() =>
    SLOTS.map((s) => getSlotSummary(s)),
  )

  const reloadSummaries = useCallback(() => {
    setSummaries(SLOTS.map((s) => getSlotSummary(s)))
  }, [])

  if (creatingSlot !== null) {
    return (
      <NewGame
        targetSlot={creatingSlot}
        onStart={(s, slot) => onStart(s, slot)}
        onCancel={() => setCreatingSlot(null)}
      />
    )
  }

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center' }}>
      <span className="eyebrow">Simulador de companhia aérea</span>
      <h1 className="titulo" style={{ fontSize: 44, marginBottom: 8 }}>
        Skyline Tycoon
      </h1>
      <p className="dim" style={{ maxWidth: 540, margin: '0 auto 32px' }}>
        Monte a malha, escolha os aviões, brigue por passageiro e pinte tudo do seu jeito.
        Escolha um dos 3 slots para jogar.
      </p>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SLOTS.map((slot) => {
          const summary = summaries[slot - 1]
          return (
            <div
              key={slot}
              className="card"
              style={{
                textAlign: 'left',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="eyebrow" style={{ margin: 0 }}>
                    Slot {slot}
                  </span>
                  {summary && <span className="chip sm">{summary.code}</span>}
                </div>

                {summary ? (
                  <>
                    <h3 style={{ margin: '2px 0 4px', fontSize: 20 }}>{summary.airlineName}</h3>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                      Base: <b>{summary.hub}</b> · Dia <b>{summary.day}</b> · Caixa: <b>{money(summary.cash)}</b>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      Frota: {summary.fleetCount} {summary.fleetCount === 1 ? 'avião' : 'aviões'} · Rotas: {summary.routesCount}
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 style={{ margin: '2px 0 4px', fontSize: 18, color: 'var(--ink-3)' }}>Slot Vazio</h3>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhuma partida salva neste slot</span>
                  </div>
                )}
              </div>

              <div className="row" style={{ gap: 8 }}>
                {summary ? (
                  <>
                    <button
                      className="btn primary"
                      onClick={() => {
                        const loaded = loadGame(slot)
                        if (loaded) onStart(loaded, slot)
                        else toast('Save corrompido.', 'error')
                      }}
                    >
                      Continuar
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        if (confirm(`Sobrescrever o save do Slot ${slot} com uma nova companhia?`)) {
                          setCreatingSlot(slot)
                        }
                      }}
                    >
                      Novo Jogo
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja apagar o save do Slot ${slot}?`)) {
                          clearSave(slot)
                          reloadSummaries()
                          toast(`Slot ${slot} apagado.`)
                        }
                      }}
                    >
                      Apagar
                    </button>
                  </>
                ) : (
                  <button className="btn primary" onClick={() => setCreatingSlot(slot)}>
                    Criar Companhia
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
