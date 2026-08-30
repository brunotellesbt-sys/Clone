import { useEffect, useId, useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Livery } from '../game/types'
import { artFor, DEFAULT_REGIONS, loadArtManifest, type ArtEntry } from './art'
import { LiveryPlane } from './LiveryPlane'
import { measure, measured, type Measured } from './measure'
import { FONT_STACK } from './silhouette'

interface Props {
  type: AircraftType
  livery: Livery
  titles?: string
  registration?: string
  className?: string
}

/**
 * Havendo silhueta livre para o modelo, a pintura da companhia é aplicada
 * dentro dela, peça por peça. Sem silhueta — ou se a imagem não carregar —
 * cai no desenho vetorial do próprio jogo.
 */
export function AircraftArt(props: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    loadArtManifest().then(() => setReady(true))
  }, [])
  const entry = ready ? artFor(props.type.id) : undefined
  if (!entry) return <LiveryPlane {...props} />
  return <MaskedArt {...props} entry={entry} />
}

const hrefOf = (entry: ArtEntry) =>
  /^https?:\/\//.test(entry.file) ? entry.file : `${import.meta.env.BASE_URL}${entry.file.replace(/^\//, '')}`

function MaskedArt({ type, livery, titles, registration, className, entry }: Props & { entry: ArtEntry }) {
  const uid = useId().replace(/:/g, '')
  const href = hrefOf(entry)
  const [box, setBox] = useState<Measured | null | undefined>(() => measured(href))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    measure(href).then((m) => alive && setBox(m))
    return () => {
      alive = false
    }
  }, [href])

  if (failed) {
    return <LiveryPlane type={type} livery={livery} titles={titles} registration={registration} className={className} />
  }

  const { w, h } = entry
  const base = box ?? DEFAULT_REGIONS
  const region = { ...DEFAULT_REGIONS, ...base, ...(entry.regions ?? {}) }
  const [fy0, fy1] = region.fuselage
  const [tx0, ty0, tx1, ty1] = region.tail

  // Zonas da fuselagem em pixels da imagem.
  const bandTop = h * fy0
  const bandBot = h * fy1
  const bandH = Math.max(1, bandBot - bandTop)
  const tailW = w * (tx1 - tx0)

  const bb = entry.regions?.box ?? box?.box ?? [0, 0, 1, 1]
  const planeX0 = bb[0] * w
  const planeW = (bb[2] - bb[0]) * w

  const pad = 0.03
  const view = [
    Math.max(0, bb[0] - pad) * w,
    Math.max(0, bb[1] - pad) * h,
    Math.min(1, bb[2] - bb[0] + pad * 2) * w,
    Math.min(1, bb[3] - bb[1] + pad * 2) * h,
  ]

  const flip = box?.noseLeft === false
  const flipTransform = `translate(${view[0] * 2 + view[2]} 0) scale(-1 1)`

  const bellyY = bandTop + bandH * livery.bellyAt
  const cheatMid = bandTop + bandH * livery.cheatAt
  const cheatH = Math.max(1, bandH * livery.cheatWidth)
  const noseColor = livery.noseStyle === 'body' ? null : livery.noseStyle === 'dark' ? '#1e293b' : livery.nose

  const titleSize = Math.max(8, bandH * livery.titleSize)
  // As âncoras contam a partir do NARIZ, que no arquivo original pode estar
  // à direita — por isso a posição é medida no sentido do avião, não da imagem.
  const along = 0.08 + livery.titleAt * 0.55
  const titleXImg = flip ? planeX0 + planeW * (1 - along) : planeX0 + planeW * along
  const regXImg = flip ? w * tx1 + w * 0.01 : w * tx0 - w * 0.01
  // Espelhar o grupo inverteria as letras; então cada texto é contra-espelhado
  // em torno da própria âncora, e a posição sai exata dos dois lados.
  const unflip = (x: number) => (flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined)

  return (
    <svg viewBox={view.join(' ')} className={className} role="img" aria-label={`${type.maker} ${type.name}`}>
      <defs>
        <mask id={`m-${uid}`} style={{ maskType: 'alpha' }}>
          {/* A silhueta vira o recorte: tudo que for pintado fica dentro do avião. */}
          <image href={href} x="0" y="0" width={w} height={h} crossOrigin="anonymous" onError={() => setFailed(true)} />
        </mask>
        <linearGradient id={`tg-${uid}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.tail} />
          <stop offset="100%" stopColor={livery.tailAccent} />
        </linearGradient>
        <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={livery.cheat} />
          <stop offset="100%" stopColor={livery.cheat2} />
        </linearGradient>
      </defs>

      <g transform={flip ? flipTransform : undefined}>
        <g mask={`url(#m-${uid})`}>
          {/* fuselagem inteira */}
          <rect x="0" y="0" width={w} height={h} fill={livery.fuselage} />

          {/* tudo abaixo da fuselagem é asa, motor e trem */}
          <rect x="0" y={bandBot} width={w} height={h} fill={livery.wing} />

          {/* barriga, dentro da faixa da fuselagem */}
          <rect x="0" y={bellyY} width={w} height={bandBot - bellyY} fill={livery.belly} />

          {/* faixa */}
          {livery.cheatStyle !== 'none' && (
            <Cheat
              livery={livery} w={w} x0={planeX0} planeW={planeW}
              bandTop={bandTop} bandBot={bandBot} mid={cheatMid} height={cheatH} gradId={`cg-${uid}`}
            />
          )}

          {/* radome */}
          {noseColor && <rect x={planeX0 - 2} y={bandTop - 2} width={planeW * 0.06} height={bandH + 4} fill={noseColor} />}

          {/* deriva */}
          <rect
            x={w * tx0} y={h * ty0} width={tailW} height={h * (ty1 - ty0)}
            fill={livery.tailStyle === 'gradient' ? `url(#tg-${uid})` : livery.tail}
          />
          {livery.tailStyle === 'stripes' &&
            [0, 1, 2].map((i) => (
              <rect
                key={i} x={w * tx0 + tailW * (0.18 + i * 0.24)} y={h * ty0}
                width={tailW * 0.12} height={h * (ty1 - ty0)} fill={livery.tailAccent}
              />
            ))}
          {livery.tailStyle === 'split' && (
            <path
              d={
                `M ${w * tx0} ${h * ty0 + (h * (ty1 - ty0)) * 0.55} L ${w * tx1} ${h * ty0 + (h * (ty1 - ty0)) * 0.28} ` +
                `L ${w * tx1} ${h * ty1} L ${w * tx0} ${h * ty1} Z`
              }
              fill={livery.tailAccent}
            />
          )}
          {livery.tailStyle === 'swoosh' && (
            <path
              d={
                `M ${w * tx0} ${h * ty1} ` +
                `C ${w * tx0 + tailW * 0.5} ${h * ty0 + (h * (ty1 - ty0)) * 0.7}, ` +
                `${w * tx0 + tailW * 0.66} ${h * ty0 + (h * (ty1 - ty0)) * 0.25}, ` +
                `${w * tx0 + tailW * 0.7} ${h * ty0} L ${w * tx1} ${h * ty0} ` +
                `C ${w * tx0 + tailW * 0.95} ${h * ty0 + (h * (ty1 - ty0)) * 0.55}, ` +
                `${w * tx0 + tailW * 0.7} ${h * ty0 + (h * (ty1 - ty0)) * 0.9}, ` +
                `${w * tx0 + tailW * 0.5} ${h * ty1} Z`
              }
              fill={livery.tailAccent}
            />
          )}
          {livery.tailStyle === 'chevron' && (
            <path
              d={
                `M ${w * tx0 + tailW * 0.1} ${h * ty1} L ${w * tx0 + tailW * 0.54} ${h * ty0} ` +
                `L ${w * tx0 + tailW * 0.8} ${h * ty0} L ${w * tx0 + tailW * 0.4} ${h * ty1} Z`
              }
              fill={livery.tailAccent}
            />
          )}
        </g>

        {/* o desenho original por cima devolve painéis, portas e sombreado */}
        <image
          href={href} x="0" y="0" width={w} height={h} crossOrigin="anonymous"
          style={{ mixBlendMode: 'multiply' }} opacity="0.3"
        />
      </g>

      <g transform={flip ? flipTransform : undefined}>
        {titles && (
          <g transform={unflip(titleXImg)}>
            <text
              x={titleXImg} y={bandTop + bandH * 0.3} fill={livery.titles}
              fontFamily={FONT_STACK[livery.titleFont]} fontSize={titleSize}
              fontWeight={livery.titleFont === 'wide' ? 900 : 700}
              letterSpacing={livery.titleFont === 'wide' ? '0.04em' : '0'}
              dominantBaseline="middle"
            >
              {titles}
            </text>
          </g>
        )}
        {livery.showReg && registration && (
          <g transform={unflip(regXImg)}>
            <text
              x={regXImg} y={bandBot - bandH * 0.12} fill={livery.regColor}
              fontFamily={FONT_STACK.mono} fontSize={Math.max(6, bandH * 0.16)} textAnchor="end"
            >
              {registration}
            </text>
          </g>
        )}
      </g>
    </svg>
  )
}

function Cheat({
  livery, w, x0, planeW, bandTop, bandBot, mid, height, gradId,
}: {
  livery: Livery
  w: number
  x0: number
  planeW: number
  bandTop: number
  bandBot: number
  mid: number
  height: number
  gradId: string
}) {
  const fill = livery.cheatStyle === 'fade' ? `url(#${gradId})` : livery.cheat
  switch (livery.cheatStyle) {
    case 'straight':
    case 'fade':
      return <rect x="0" y={mid - height / 2} width={w} height={height} fill={fill} />
    case 'wide':
      return <rect x="0" y={mid - height / 2} width={w} height={bandBot - (mid - height / 2)} fill={fill} />
    case 'double':
      return (
        <>
          <rect x="0" y={mid - height} width={w} height={height * 0.62} fill={livery.cheat} />
          <rect x="0" y={mid + height * 0.25} width={w} height={height * 0.44} fill={livery.cheat2} />
        </>
      )
    case 'wave':
      return (
        <path
          d={
            `M ${x0 - planeW * 0.1} ${mid + height * 1.4} ` +
            `C ${x0 + planeW * 0.35} ${mid + height * 1.5}, ${x0 + planeW * 0.6} ${mid - height * 1.6}, ${x0 + planeW * 1.1} ${mid - height * 2.1} ` +
            `L ${x0 + planeW * 1.1} ${mid - height * 0.9} ` +
            `C ${x0 + planeW * 0.6} ${mid - height * 0.4}, ${x0 + planeW * 0.35} ${mid + height * 2.6}, ${x0 - planeW * 0.1} ${mid + height * 2.5} Z`
          }
          fill={fill}
        />
      )
    case 'split':
      return (
        <path
          d={
            `M 0 ${bandBot} L ${w} ${bandBot} L ${w} ${mid - height} ` +
            `L ${x0 + planeW * 0.22} ${mid + height * 1.6} L 0 ${bandTop + (bandBot - bandTop) * 0.95} Z`
          }
          fill={fill}
        />
      )
    default:
      return null
  }
}
