import { useMemo, useState } from 'react'
import { AIRPORTS, type Airport } from '../../game/data/airports'
import { metros } from '../../game/engine'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Busca de aeroporto por sigla, cidade, país ou nome oficial.
 *
 * Existe porque a lista suspensa não serve mais: com 3.085 destinos, um
 * `<select>` é rolagem infinita, e limitá-lo aos grandes — o que o jogo fazia —
 * escondia Santos Dumont e qualquer regional de quem quisesse basear ali.
 *
 * A ordem é por acerto e não alfabética: sigla exata primeiro, depois cidade
 * que começa com o termo, depois o resto; em empate, bacia maior na frente.
 */
export function procurarAeroportos(termo: string, limite = 8, fora?: (a: Airport) => boolean): Airport[] {
  const q = normal(termo.trim())
  if (q.length < 2) return []
  const achados: { a: Airport; peso: number }[] = []
  for (const a of AIRPORTS) {
    if (fora?.(a)) continue
    let peso = -1
    if (a.iata.toLowerCase() === q) peso = 0
    else if (normal(a.city).startsWith(q)) peso = 1
    else if (normal(a.official).includes(q)) peso = 2
    else if (normal(a.city).includes(q) || normal(a.country).includes(q)) peso = 3
    if (peso < 0) continue
    achados.push({ a, peso })
    if (achados.length > 400) break
  }
  return achados.sort((x, y) => x.peso - y.peso || y.a.pop - x.a.pop).slice(0, limite).map((x) => x.a)
}

interface Props {
  placeholder?: string
  onPick: (iata: string) => void
  /** Aeroportos a esconder — os que já são base, por exemplo. */
  fora?: (a: Airport) => boolean
  /** Linha extra no resultado, do lado direito: preço, distância, o que servir. */
  extra?: (a: Airport) => string
  /** Mostrado quando não há busca: atalhos clicáveis. */
  atalhos?: React.ReactNode
}

export function BuscaAeroporto({ placeholder, onPick, fora, extra, atalhos }: Props) {
  const [busca, setBusca] = useState('')
  const achados = useMemo(() => procurarAeroportos(busca, 8, fora), [busca, fora])
  return (
    <>
      <input
        type="search"
        value={busca}
        placeholder={placeholder ?? 'sigla, cidade ou país'}
        onChange={(e) => setBusca(e.target.value)}
      />
      {achados.length > 0 ? (
        <div className="achados">
          {achados.map((a) => (
            <button key={a.iata} className="achado" onClick={() => { onPick(a.iata); setBusca('') }}>
              <b>{a.iata}</b>
              <span>{a.city}, {a.country}</span>
              <small>{extra ? extra(a) : `${a.pop.toFixed(1)} mi · ${metros(a.runway)}`}</small>
            </button>
          ))}
        </div>
      ) : (
        atalhos
      )}
    </>
  )
}
