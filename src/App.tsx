import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advanceDay, gameDate, money, netWorth, pct, period } from './game/engine'
import { MS_POR_DIA_NA_TELA } from './ui/relogio'
import {
  AVAILABLE_SLOTS,
  clearSave,
  exportSave,
  getActiveSlot,
  getSlotInfo,
  importSave,
  loadGame,
  saveGame,
} from './game/save'
import type { SlotSummary } from './game/save'
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
  const [, force] = useState(0)
  const [tab, setTab] = useState('painel')
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])
  const [menu, setMenu] = useState(false)
  const stateRef = useRef<GameState | null>(null)
  stateRef.current = state

  const toast = useCallback((msg: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const act = useCallback((fn: (s: GameState) => string | null | void) => {
    const s = stateRef.current
    if (!s) return null
    const err = fn(s) ?? null
    if (!err) {
      saveGame(s, getActiveSlot())
    }
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
      if (s.day % 30 === 0) saveGame(s, getActiveSlot())
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

  const ctx = useMemo(
    () => ({
      state: state as GameState,
      act,
      replace: (s: GameState) => setState(s),
      reset: () => { clearSave(getActiveSlot()); setState(null) },
      toast,
    }),
    [state, act, toast],
  )

  if (!state) {
    return (
      <div className="app">
        <main>
          <StartScreen onStart={setState} toast={toast} />
        </main>
        <Toasts items={toasts} />
      </div>
    )
  }

  const date = gameDate(state)
  const p7 = period(state, 7)

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
}: {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 20px', lineHeight: 1.5 }}>
        {message}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onCancel}>
          {cancelText}
        </button>
        <button className={`btn ${kind}`} onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

function GameMenu({ onClose }: { onClose: () => void }) {
  const { state, replace, reset, toast } = useGame()
  const [code, setCode] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<{
    type: 'save' | 'load' | 'delete' | 'new'
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

  const handleConfirmAction = () => {
    if (!pendingConfirm) return
    const { type, slot } = pendingConfirm

    if (type === 'save' && slot) {
      saveGame(state, slot)
      toast(`Partida salva no Slot ${slot}.`)
      refreshSlots()
    } else if (type === 'load' && slot) {
      const loaded = loadGame(slot)
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
    } else if (type === 'new') {
      reset()
      onClose()
    }

    setPendingConfirm(null)
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

      <label className="field">
        <span>Exportar partida atual</span>
        <textarea
          readOnly
          rows={2}
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

      <label className="field">
        <span>Importar partida</span>
        <input
          type="text"
          value={code}
          placeholder="Cole aqui o texto exportado"
          onChange={(e) => setCode(e.target.value)}
        />
      </label>

      <button
        className="btn"
        onClick={() => {
          const s = importSave(code)
          if (s) {
            replace(s)
            saveGame(s, activeSlot)
            toast('Partida importada com sucesso.')
            onClose()
          } else toast('Texto inválido.', 'error')
        }}
      >
        Importar partida
      </button>

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
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null)
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
    return (
      <NewGame
        initialSlot={creatingSlot}
        onStart={(s) => onStart(s)}
        onCancel={() => setCreatingSlot(null)}
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
                        onClick={() => {
                          const s = loadGame(slotNum)
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
