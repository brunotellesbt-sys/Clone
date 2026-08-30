import type { ReactNode } from 'react'

export function Card({ title, right, children, className = '' }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          {title && <h3 style={{ margin: 0 }}>{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <b className={tone}>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: tone }} />
    </div>
  )
}

export function Spark({ values, w = 160, h = 34, color = '#38bdf8' }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return <svg className="spark" width={w} height={h} />
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
  const zeroY = h - ((0 - min) / span) * (h - 4) - 2
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {min < 0 && <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#2b3a5c" strokeWidth="1" strokeDasharray="3 3" />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={wide ? { width: 'min(1040px, 100%)' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button className="btn sm" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="list-empty">{children}</div>
}
