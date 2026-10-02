import { HubsView } from './ui/HubsView'
import { invalidateAirportUsage } from './game/airportInfrastructure'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invalidateHubActivity } from './game/hubDevelopment'
import { advanceDay, gameDate, money, netWorth, pct, period } from './game/engine'
import { MS_POR_DIA_NA_TELA } from './ui/relogio'
import {
  AVAILABLE_SLOTS,
  clearSave,
  exportSaveFile,
  getActiveSlot,
  getSlotInfo,
  hasSave,
  importSaveFile,
  loadGame,
  saveGame,
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
import { LiveryEditor } from './ui/LiveryEditor'
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
  { id: 'conexoes', label: 'Conexões' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'frota', label: 'Frota' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'financas', label: 'Finanças' },
  { id: 'pintura', label: 'Pintura' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'companhias', label: 'Companhias' },
]

const SPEEDS = [
  { v: 0, label: '❚❚' },
  { v: 1, label: '1×' },
  { v: 25, label: '25×' },
  { v: 50, label: '50×' },
  { v: 100, label: '100×' },
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
    invalidateHubActivity(s); invalidateAirportUsage(s)
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
            {tab === 'conexoes' && <ConnectionsView />}
            {tab === 'calendario' && <CalendarView />}
            {tab === 'frota' && <FleetView />}
            {tab === 'mercado' && <MarketView />}
            {tab === 'financas' && <FinanceView />}
            {tab === 'pintura' && <LiveryEditor />}
            {tab === 'ranking' && <RankingView />}
            {tab === 'hubs' && <HubsView />}
            {tab === 'companhias' && <CompetitorsView />}
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
    } else if (type === 'import' && pendingFile) {
      pendingFile.game.paused = true
      if (saveGame(pendingFile.game, activeSlot)) {
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
          <button className="btn" onClick={() => {
            try {
              const filename = `the-airline-simulator-${state.airline.code.replace(/[^a-z0-9-]/gi, '') || 'save'}-slot-${activeSlot}-${new Date().toISOString().slice(0, 10)}.json`
              downloadFile(filename, new Blob([exportSaveFile(state)], { type: 'application/json;charset=utf-8' }))
            } catch { toast('Não foi possível gerar o arquivo da partida.', 'error') }
          }}>Baixar save em JSON</button>
          <small className="muted">Arquivo legível com a partida completa para guardar ou compartilhar para correção.</small>
        </div>

        <label className="field">
          <span>Importar partida de arquivo</span>
          <input type="file" accept=".json,.txt,application/json,text/plain" aria-label="Selecionar arquivo de save" onChange={async e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            setPendingFile(null)
            if (!file) return
            if (file.size > 50 * 1024 * 1024) return toast('Arquivo maior que 50 MB.', 'error')
            try {
              const game = importSaveFile(await file.text())
              if (!game) return toast('Arquivo de save inválido ou incompatível.', 'error')
              setPendingFile({ name: file.name, game })
            } catch { toast('Não foi possível ler o arquivo de save.', 'error') }
          }} />
          <small className="muted">Aceita o novo JSON e códigos antigos guardados em arquivo .txt.</small>
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
