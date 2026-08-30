import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advanceDay, gameDate, money, netWorth, pct, period } from './game/engine'
import { clearSave, exportSave, hasSave, importSave, loadGame, saveGame } from './game/save'
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
    force((v) => v + 1)
    return err
  }, [])

  // laço do jogo
  useEffect(() => {
    if (!state || state.paused || state.speed === 0) return
    const interval = Math.max(45, 900 / state.speed)
    const id = setInterval(() => {
      const s = stateRef.current
      if (!s) return
      advanceDay(s)
      if (s.day % 30 === 0) saveGame(s)
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
      reset: () => { clearSave(); setState(null) },
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
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span style={{ fontSize: 18 }}>✈</span>
            <div>
              {state.airline.name} <small>{state.airline.code}</small>
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

        {menu && <GameMenu onClose={() => setMenu(false)} />}
        <Toasts items={toasts} />
      </div>
    </GameContext.Provider>
  )
}

function GameMenu({ onClose }: { onClose: () => void }) {
  const { state, replace, reset, toast } = useGame()
  const [code, setCode] = useState('')
  if (!state) return null
  return (
    <Modal title="Jogo" onClose={onClose}>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={() => { saveGame(state); toast('Partida salva no navegador.') }}>Salvar</button>
        <button className="btn" onClick={() => { const s = loadGame(); if (s) { replace(s); onClose() } else toast('Nenhum save encontrado.', 'error') }}>Carregar</button>
        <button className="btn danger" onClick={() => { if (confirm('Apagar a partida e começar de novo?')) { reset(); onClose() } }}>Nova partida</button>
      </div>
      <label className="field">
        <span>Exportar (copie e guarde este texto)</span>
        <textarea readOnly rows={3} value={exportSave(state)} style={{ width: '100%', background: '#0b1424', border: '1px solid var(--line)', borderRadius: 8, padding: 8, color: 'var(--ink-2)', fontSize: 11 }} />
      </label>
      <label className="field">
        <span>Importar</span>
        <input type="text" value={code} placeholder="cole aqui o texto exportado" onChange={(e) => setCode(e.target.value)} />
      </label>
      <button className="btn" onClick={() => { const s = importSave(code); if (s) { replace(s); onClose() } else toast('Texto inválido.', 'error') }}>
        Importar partida
      </button>
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Atalhos: <b>espaço</b> pausa, <b>1–4</b> mudam a velocidade. O jogo salva sozinho a cada 30 dias.
      </p>
    </Modal>
  )
}

function StartScreen({ onStart, toast }: { onStart: (s: GameState) => void; toast: (m: string, k?: 'info' | 'error') => void }) {
  const [creating, setCreating] = useState(!hasSave())
  if (creating) return <NewGame onStart={onStart} onCancel={hasSave() ? () => setCreating(false) : undefined} />
  return (
    <div className="wrap" style={{ paddingTop: 60, textAlign: 'center' }}>
      <h1 style={{ fontSize: 34, letterSpacing: '-0.03em' }}>Skyline Tycoon</h1>
      <p className="dim" style={{ maxWidth: 520, margin: '10px auto 26px' }}>
        Monte a malha, escolha os aviões, brigue por passageiro no preço e na frequência — e pinte tudo do seu jeito.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={() => { const s = loadGame(); if (s) onStart(s); else toast('Save corrompido.', 'error') }}>
          Continuar partida
        </button>
        <button className="btn" onClick={() => setCreating(true)}>Nova companhia</button>
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
