import { FLAGS, type Flag } from './flags'

/**
 * Desenha a bandeira do país da primeira matrícula, ao lado do prefixo.
 *
 * O desenho é o do `flags.ts` — simplificado no tamanho em que a bandeira é
 * vista. O contorno fino não é enfeite: a bandeira vai sobre fuselagem clara, e
 * sem ele o campo branco de metade delas desaparece.
 */
export function Bandeira({ cc, x, y, h }: { cc: string; x: number; y: number; h: number }) {
  const f: Flag | undefined = FLAGS[cc]
  if (!f) return null
  const w = h * 1.5
  const partes: React.ReactNode[] = []

  if (f.campo) partes.push(<rect key="campo" x={x} y={y} width={w} height={h} fill={f.campo} />)

  if (f.faixas) {
    let acc = 0
    f.faixas.forEach((faixa, i) => {
      const lado = f.vertical ? w : h
      const tam = lado * faixa.parte
      partes.push(
        <rect
          key={`f${i}`}
          x={f.vertical ? x + acc : x}
          y={f.vertical ? y : y + acc}
          width={f.vertical ? tam : w}
          height={f.vertical ? h : tam}
          fill={faixa.cor}
        />,
      )
      acc += tam
    })
  }

  if (f.cantao) {
    partes.push(
      <rect key="cantao" x={x} y={y} width={w * f.cantao.w} height={h * f.cantao.h} fill={f.cantao.cor} />,
    )
  }

  if (f.cruz) {
    const e = h * f.cruz.e
    const cx = x + w * (0.5 + (f.cruz.off ?? 0))
    partes.push(
      <rect key="cv" x={cx - e / 2} y={y} width={e} height={h} fill={f.cruz.cor} />,
      <rect key="ch" x={x} y={y + h / 2 - e / 2} width={w} height={e} fill={f.cruz.cor} />,
    )
  }

  if (f.losango) {
    const lw = w * f.losango.w
    const lh = h * 0.42
    const cx = x + w / 2
    const cy = y + h / 2
    partes.push(
      <path
        key="losango"
        d={`M ${cx} ${cy - lh} L ${cx + lw} ${cy} L ${cx} ${cy + lh} L ${cx - lw} ${cy} Z`}
        fill={f.losango.cor}
      />,
    )
  }

  if (f.disco) {
    partes.push(<circle key="disco" cx={x + w / 2} cy={y + h / 2} r={h * f.disco.r} fill={f.disco.cor} />)
  }

  if (f.estrela) {
    partes.push(<path key="estrela" d={estrela(x + w / 2, y + h / 2, h * f.estrela.r)} fill={f.estrela.cor} />)
  }

  return (
    <g>
      {partes}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(10,16,28,.45)" strokeWidth={Math.max(0.4, h * 0.04)} />
    </g>
  )
}

/** Estrela de cinco pontas, ponta para cima. */
function estrela(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 ? r * 0.42 : r
    const ang = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + raio * Math.cos(ang)).toFixed(2)} ${(cy + raio * Math.sin(ang)).toFixed(2)}`)
  }
  return `M ${pts.join(' L ')} Z`
}
