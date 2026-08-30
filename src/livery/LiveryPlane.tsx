import { useId, useMemo } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Livery } from '../game/types'
import { FONT_STACK, geometry, VIEW_H, VIEW_W, type Geometry } from './silhouette'

interface Props {
  type: AircraftType
  livery: Livery
  titles?: string
  registration?: string
  className?: string
  showShadow?: boolean
}

const OUTLINE = 'rgba(6,12,24,.45)'

/**
 * Desenho vetorial pintado peça por peça: nariz, fuselagem, barriga, faixa,
 * deriva, estabilizador, asa, winglet, motores, trem e texto — cada um com a
 * sua própria cor, e não uma tarja atravessando o avião inteiro.
 */
export function LiveryPlane({ type, livery, titles, registration, className, showShadow = true }: Props) {
  const uid = useId().replace(/:/g, '')
  const g = useMemo(() => geometry(type), [type])
  const s = type.shape

  const fuseClip = `fc-${uid}`
  const finClip = `fnc-${uid}`
  const tailGrad = `tg-${uid}`
  const cheatGrad = `cg-${uid}`
  const shine = `sh-${uid}`
  const glass = `gl-${uid}`
  const ckClip = `ck-${uid}`
  const wingShade = `ws-${uid}`
  const wingClip = `wc-${uid}`
  const engShade = `es-${uid}`
  const bodyMask = `bm-${uid}`

  const top = g.cy - g.D / 2
  const bellyY = top + g.D * livery.bellyAt
  const cheatMid = top + g.D * livery.cheatAt
  const cheatH = Math.max(1, g.D * livery.cheatWidth)
  const noseColor = livery.noseStyle === 'body' ? null : livery.noseStyle === 'dark' ? '#1e293b' : livery.nose

  const titleSize = Math.max(8, g.D * livery.titleSize)
  const titleX = g.noseEnd + (g.tailStart - g.noseEnd) * livery.titleAt

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={className} role="img" aria-label={`${type.maker} ${type.name}`}>
      <defs>
        <clipPath id={fuseClip}><path d={g.fuselage} /></clipPath>
        <clipPath id={finClip}><path d={g.fin} /></clipPath>
        <clipPath id={ckClip}><path d={g.cockpit.frame} /></clipPath>
        {/* vidro: céu refletido em cima, escuro embaixo — em cada painel, o seu */}
        <linearGradient id={glass} x1="0.18" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#aec0da" />
          <stop offset="38%" stopColor="#5f7294" />
          <stop offset="76%" stopColor="#212e47" />
          <stop offset="100%" stopColor="#0d1424" />
        </linearGradient>
        <linearGradient id={tailGrad} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.tail} />
          <stop offset="100%" stopColor={livery.tailAccent} />
        </linearGradient>
        <linearGradient id={cheatGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.cheat} />
          <stop offset="100%" stopColor={livery.cheat2} />
        </linearGradient>
        {/* a asa precisa de sombreado: sem ele some contra a fuselagem clara */}
        <linearGradient id={wingShade} x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="28%" stopColor="#0b1220" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0b1220" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={wingClip}><path d={g.wing} /></clipPath>
        {/*
          Máscara do corpo. A asa passa À FRENTE da fuselagem, como numa foto de
          perfil, mas o TRAÇO dela é apagado onde cruza o corpo. É isso que
          impede o contorno de atravessar a barriga inteira.
        */}
        <mask id={bodyMask}>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#fff" />
          <path d={g.fuselage} fill="#000" />
        </mask>
        {/* a nacela é uma peça torneada: precisa de brilho em cima e sombra embaixo */}
        <linearGradient id={engShade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="34%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="66%" stopColor="#0b1220" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0b1220" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {showShadow && (
        <ellipse cx={VIEW_W / 2} cy={g.ground + g.D * 0.09} rx={g.L * 0.44} ry={Math.max(3, g.D * 0.09)} fill="#000" opacity="0.14" />
      )}

      {/*
        Ordem de pintura — é o que resolve o contorno atravessando tudo.
        Tudo que sai do corpo é pintado ANTES dele, com a raiz enterrada; a
        fuselagem e a carenagem vêm por cima e tapam o que não deve aparecer.
        Sobra um contorno externo só, como num desenho técnico.
      */}

      {/* 1. trem de pouso — a perna nasce dentro da asa e da fuselagem */}
      {g.gear.map((p, i) => (
        <g key={`g${i}`}>
          <path d={p.strut} fill={livery.gear} stroke={OUTLINE} strokeWidth="0.9" strokeLinejoin="round" />
          {p.wheels.map((wl, j) => (
            <g key={j}>
              <circle cx={wl.cx} cy={wl.cy} r={wl.r} fill="#232b3a" />
              <circle cx={wl.cx} cy={wl.cy} r={wl.r * 0.4} fill="#4b5568" />
            </g>
          ))}
        </g>
      ))}

      {/* 2. pilone e canoas de flape, escondidos pela asa que vem em seguida */}
      {g.nacelles.map((e, i) => (
        <path key={`py${i}`} d={e.pylon} fill={livery.wing} stroke={OUTLINE} strokeWidth="0.8" strokeLinejoin="round" />
      ))}
      {g.flapTracks.map((d, i) => (
        <path key={`ft${i}`} d={d} fill={livery.wing} stroke={OUTLINE} strokeWidth="0.8" strokeLinejoin="round" />
      ))}

      {/* 4. empenagem: filete dorsal, deriva e estabilizador */}
      {g.dorsal && <path d={g.dorsal} fill={livery.tail} stroke={OUTLINE} strokeWidth="1" strokeLinejoin="round" />}
      <path
        d={g.fin} fill={livery.tailStyle === 'gradient' ? `url(#${tailGrad})` : livery.tail}
        stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round"
      />
      <g clipPath={`url(#${finClip})`}>
        <TailDecor g={g} livery={livery} />
      </g>
      <path d={g.fin} fill="none" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={g.stab} fill={livery.stab} stroke={OUTLINE} strokeWidth="1.1" strokeLinejoin="round" />

      {/* 6. o corpo, por cima de tudo o que nasce dele */}
      <path d={g.fuselage} fill={livery.fuselage} />
      <g clipPath={`url(#${fuseClip})`}>
        <rect x={g.x0 - 4} y={bellyY} width={g.L + 8} height={g.D} fill={livery.belly} />
        <Cheatline g={g} livery={livery} top={top} mid={cheatMid} height={cheatH} gradId={cheatGrad} />
        {noseColor && (
          <path
            d={`M ${g.x0 - 4} ${top - 4} L ${g.x0 + g.L * 0.05} ${top - 4} L ${g.x0 + g.L * 0.035} ${g.ground} L ${g.x0 - 4} ${g.ground} Z`}
            fill={noseColor}
          />
        )}
        <rect x={g.x0 - 4} y={g.top - g.D} width={g.L + 8} height={g.D * 3} fill={`url(#${shine})`} />
        <path d={g.cockpit.seam} fill="none" stroke="rgba(8,14,26,.2)" strokeWidth={Math.max(0.5, g.D * 0.011)} />
        {g.apu && <path d={g.apu} fill="rgba(31,41,58,.8)" />}
      </g>
      <path d={g.fuselage} fill="none" stroke={OUTLINE} strokeWidth="1.3" strokeLinejoin="round" />

      {/* 7. asa: passa à frente do corpo, com o traço apagado onde cruza */}
      <path d={g.wing} fill={livery.wing} />
      <g clipPath={`url(#${wingClip})`}>
        <rect x={g.x0 - 20} y={g.top - g.D} width={g.L + 60} height={g.D * 4} fill={`url(#${wingShade})`} />
      </g>
      <g mask={`url(#${bodyMask})`}>
        <path d={g.wing} fill="none" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
      </g>

      {/* 8. carenagem asa-fuselagem: mistura a raiz da asa no corpo */}
      {g.fairing && (
        <>
          <path d={g.fairing} fill={livery.belly} />
          <g mask={`url(#${bodyMask})`}>
            <path d={g.fairing} fill="none" stroke={OUTLINE} strokeWidth="1" strokeLinejoin="round" />
          </g>
        </>
      )}

      {/* 9. winglet, na ponta da asa */}
      {g.winglet && <path d={g.winglet} fill={livery.winglet} stroke={OUTLINE} strokeWidth="1" strokeLinejoin="round" />}

      {/* 10. nacelas: penduradas à frente da asa */}
      {g.nacelles.map((e, i) => (
        <g key={`e${i}`}>
          <path d={e.cowl} fill={livery.engine} stroke={OUTLINE} strokeWidth="1" strokeLinejoin="round" />
          <clipPath id={`ec${uid}${i}`}><path d={e.cowl} /></clipPath>
          <g clipPath={`url(#ec${uid}${i})`}>
            <rect x={e.fx - e.fr * 4} y={e.fy - e.fr * 2} width={e.fr * 12} height={e.fr * 4} fill={`url(#${engShade})`} />
          </g>
          <path d={e.plug} fill={livery.engineCowl} stroke={OUTLINE} strokeWidth="0.8" strokeLinejoin="round" />
          {/* a admissão é escura: vê-se o fan lá dentro */}
          <ellipse cx={e.fx} cy={e.fy} rx={Math.max(1.2, e.fr * 0.22)} ry={e.fr} fill="rgba(11,17,30,.72)" />
          <path d={e.lip} fill={livery.engineCowl} stroke={OUTLINE} strokeWidth="0.8" strokeLinejoin="round" />
        </g>
      ))}
      {g.props.map((p, i) => (
        <g key={`pr${i}`}>
          <ellipse
            cx={p.cx} cy={p.cy} rx={Math.max(1.4, p.r * 0.045)} ry={p.r}
            fill="rgba(203,218,240,.2)" stroke="rgba(226,238,255,.42)" strokeWidth="0.7"
          />
          <ellipse cx={p.cx} cy={p.cy} rx={Math.max(1.8, p.r * 0.09)} ry={p.r * 0.16} fill={livery.engineCowl} stroke={OUTLINE} strokeWidth="0.7" />
        </g>
      ))}

      {/* detalhes da fuselagem */}
      {livery.windows && (
        <>
          {g.windows.map((w, i) => (
            <rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} rx={w.w * 0.4} fill={livery.windowColor} opacity="0.72" />
          ))}
          {g.upperWindows.map((w, i) => (
            <rect key={`u${i}`} x={w.x} y={w.y} width={w.w} height={w.h} rx={w.w * 0.4} fill={livery.windowColor} opacity="0.72" />
          ))}
        </>
      )}
      {livery.doors &&
        g.doors.map((d, i) => (
          <rect
            key={`d${i}`} x={d.x} y={d.y} width={d.w} height={d.h} rx={d.w * 0.3}
            fill="rgba(8,14,26,.04)" stroke="rgba(8,14,26,.3)" strokeWidth="0.7"
          />
        ))}
      {/* cabine de comando: moldura escura, vidros recuados, reflexo e limpadores */}
      <g>
        <path d={g.cockpit.frame} fill="#1c2434" stroke="rgba(6,12,24,.55)" strokeWidth="0.7" strokeLinejoin="round" />
        {g.cockpit.panes.map((d, i) => (
          <path key={`ck${i}`} d={d} fill={`url(#${glass})`} />
        ))}
        <g clipPath={`url(#${ckClip})`}>
          <path d={g.cockpit.glare} fill="#eaf2ff" opacity="0.16" />
        </g>
        <path
          d={g.cockpit.wipers} fill="none" stroke="rgba(10,16,28,.62)"
          strokeWidth={Math.max(0.5, g.D * 0.012)} strokeLinecap="round"
        />
      </g>

      {titles && (
        <text
          x={titleX} y={top + g.D * 0.23} fill={livery.titles}
          fontFamily={FONT_STACK[livery.titleFont]} fontSize={titleSize}
          fontWeight={livery.titleFont === 'wide' ? 900 : 700}
          letterSpacing={livery.titleFont === 'wide' ? '0.04em' : '0'}
          dominantBaseline="middle"
        >
          {titles}
        </text>
      )}
      {livery.showReg && registration && (
        <text
          x={g.tailStart - g.L * 0.02} y={g.cy + g.D * 0.34} fill={livery.regColor}
          fontFamily={FONT_STACK.mono} fontSize={Math.max(6, g.D * 0.14)} textAnchor="end"
        >
          {registration}
        </text>
      )}
      <title>{`${type.maker} ${type.name} — ${s.length} m, envergadura ${s.span} m`}</title>
    </svg>
  )
}

function Cheatline({
  g, livery, top, mid, height, gradId,
}: { g: Geometry; livery: Livery; top: number; mid: number; height: number; gradId: string }) {
  const { x0, xEnd, D, L } = g
  const w = xEnd - x0
  const fill = livery.cheatStyle === 'fade' ? `url(#${gradId})` : livery.cheat
  switch (livery.cheatStyle) {
    case 'none':
      return null
    case 'straight':
    case 'fade':
      return <rect x={x0} y={mid - height / 2} width={L} height={height} fill={fill} />
    case 'wide':
      return <rect x={x0} y={mid - height / 2} width={L} height={D} fill={fill} />
    case 'double':
      return (
        <>
          <rect x={x0} y={mid - height} width={L} height={height * 0.62} fill={livery.cheat} />
          <rect x={x0} y={mid + height * 0.25} width={L} height={height * 0.44} fill={livery.cheat2} />
        </>
      )
    case 'wave':
      return (
        <path
          d={
            `M ${x0} ${mid + height * 1.4} ` +
            `C ${x0 + w * 0.35} ${mid + height * 1.5}, ${x0 + w * 0.6} ${mid - height * 1.6}, ${xEnd} ${mid - height * 2.1} ` +
            `L ${xEnd} ${mid - height * 0.9} ` +
            `C ${x0 + w * 0.6} ${mid - height * 0.4}, ${x0 + w * 0.35} ${mid + height * 2.6}, ${x0} ${mid + height * 2.5} Z`
          }
          fill={fill}
        />
      )
    case 'split':
      return (
        <path
          d={`M ${x0} ${top + D} L ${xEnd} ${top + D} L ${xEnd} ${mid - height} L ${x0 + L * 0.22} ${mid + height * 1.6} Z`}
          fill={fill}
        />
      )
    default:
      return null
  }
}

function TailDecor({ g, livery }: { g: Geometry; livery: Livery }) {
  const b = g.finBase
  switch (livery.tailStyle) {
    case 'stripes':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={
                `M ${b.x + b.w * (0.2 + i * 0.2)} ${b.y + b.h * 0.1} L ${b.x + b.w * (0.32 + i * 0.2)} ${b.y + b.h * 0.1} ` +
                `L ${b.x + b.w * (0.16 + i * 0.2)} ${b.y + b.h} L ${b.x + b.w * (0.04 + i * 0.2)} ${b.y + b.h} Z`
              }
              fill={livery.tailAccent}
            />
          ))}
        </>
      )
    case 'swoosh':
      return (
        <path
          d={
            `M ${b.x + b.w * 0.02} ${b.y + b.h} ` +
            `C ${b.x + b.w * 0.45} ${b.y + b.h * 0.7}, ${b.x + b.w * 0.62} ${b.y + b.h * 0.3}, ${b.x + b.w * 0.64} ${b.y} ` +
            `L ${b.x + b.w} ${b.y + b.h * 0.04} ` +
            `C ${b.x + b.w * 0.95} ${b.y + b.h * 0.5}, ${b.x + b.w * 0.7} ${b.y + b.h * 0.86}, ${b.x + b.w * 0.48} ${b.y + b.h} Z`
          }
          fill={livery.tailAccent}
        />
      )
    case 'chevron':
      return (
        <>
          <path
            d={`M ${b.x + b.w * 0.1} ${b.y + b.h} L ${b.x + b.w * 0.54} ${b.y + b.h * 0.06} L ${b.x + b.w * 0.8} ${b.y + b.h * 0.06} L ${b.x + b.w * 0.4} ${b.y + b.h} Z`}
            fill={livery.tailAccent}
          />
          <path
            d={`M ${b.x + b.w * 0.44} ${b.y + b.h} L ${b.x + b.w * 0.86} ${b.y + b.h * 0.06} L ${b.x + b.w} ${b.y + b.h * 0.1} L ${b.x + b.w * 0.7} ${b.y + b.h} Z`}
            fill={livery.tailAccent}
            opacity="0.55"
          />
        </>
      )
    case 'split':
      return (
        <path
          d={`M ${b.x} ${b.y + b.h * 0.58} L ${b.x + b.w} ${b.y + b.h * 0.3} L ${b.x + b.w} ${b.y + b.h} L ${b.x} ${b.y + b.h} Z`}
          fill={livery.tailAccent}
        />
      )
    default:
      return null
  }
}

/** Ícone compacto (vista de topo) usado no mapa e nas listas. */
export function PlaneMark({ color = '#38bdf8', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2c.7 0 1.2.9 1.2 2v5.2l7.6 4.3v1.9l-7.6-2.3v4.3l2.3 1.7v1.4L12 19.6l-3.5.9v-1.4l2.3-1.7v-4.3L3.2 15.4v-1.9l7.6-4.3V4c0-1.1.5-2 1.2-2z"
        fill={color}
      />
    </svg>
  )
}
