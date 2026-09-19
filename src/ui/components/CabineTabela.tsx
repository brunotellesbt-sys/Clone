import type { AircraftType } from '../../game/data/aircraft'
import {
  abreastOf, classesDe, limiteDaClasse, passoMaximo, PITCH_RANGE, pitchFare, pitchName, rowLayout,
  rowsOf,
} from '../../game/cabin'
import { CLASS_FARE_MULT } from '../../game/demand'
import { CABIN_LABEL, type Cabins, type SeatConfig } from '../../game/types'

/**
 * Os controles de cabine — assentos e passo por classe.
 *
 * Mora aqui porque duas telas montam cabine: a reconfiguração da cauda que já
 * voa e a encomenda de fábrica, na hora de comprar. E porque **a tabela tem
 * forma**: o celular desmonta essas sete colunas em cartão por classe com
 * regras de `nth-child`, então uma segunda tabela com as mesmas classes em
 * outra ordem sairia com os rótulos trocados — "fileira 0" no número de
 * assentos e "fileiras 83″" no passo. Foi exatamente o que aconteceu.
 */
export function CabineTabela({ t, seats, pitch, seatConfig, setAssentos, setPasso }: {
  t: AircraftType
  seats: Cabins
  pitch: Cabins
  seatConfig?: SeatConfig
  setAssentos: (c: keyof Cabins, v: number) => void
  setPasso: (c: keyof Cabins, v: number) => void
}) {
  return (
    <div className="scroll cabine-tabela">
      <table className="cabine">
        <thead>
          <tr>
            <th>Classe</th><th className="r">Fileira</th><th>Assentos</th>
            <th>Passo</th><th className="r">Fileiras</th>
            <th className="r">Ocupa</th><th className="r">Tarifa</th>
          </tr>
        </thead>
        <tbody>
          {/* Classe que a família não comporta não tem controle: um turboélice
              não ganha executiva por arrastar uma barra. Ver `classesDe`. */}
          {classesDe(t).map((c) => {
            const [min] = PITCH_RANGE[c]
            const rows = seats[c] > 0 ? rowsOf(t, seats, c, seatConfig) : 0
            /**
             * O teto mostrado é o **alcançável**, não o livre agora: nas
             * classes da frente ele conta com a econômica cedendo espaço, que
             * é o que o controle faz. Mostrar "cabem 0" numa executiva que o
             * próprio controle consegue pôr seria mentira da tela.
             */
            const tetoAssentos = c === 'y'
              ? limiteDaClasse(t, seats, pitch, c, seatConfig)
              : limiteDaClasse(t, { ...seats, y: 0 }, pitch, c, seatConfig)
            const tetoPasso = passoMaximo(t, seats, pitch, c, seatConfig)
            return (
              <tr key={c}>
                <td><b>{CABIN_LABEL[c]}</b><br /><small className="muted">{pitchName(c, pitch[c])}</small></td>
                <td className="r muted">{rowLayout(t, c, seatConfig)}</td>
                <td>
                  <div className="campo">
                    <input
                      type="range" min={0} max={Math.max(tetoAssentos, seats[c])}
                      step={abreastOf(t, c, seatConfig)}
                      value={seats[c]} onChange={(e) => setAssentos(c, +e.target.value)}
                    />
                    <input aria-label={`Assentos na ${CABIN_LABEL[c]}`} type="number"
                      min={0} max={tetoAssentos} step={1} value={seats[c]}
                      onChange={(e) => setAssentos(c, +e.target.value)} />
                  </div>
                  {/* O teto fica à vista: controle que para sem dizer por que
                      parou parece travado, e não limitado. */}
                  <small className="muted">cabem {tetoAssentos}</small>
                </td>
                <td>
                  <div className="campo">
                    <input type="range" min={min} max={Math.max(tetoPasso, pitch[c])}
                      value={pitch[c]} onChange={(e) => setPasso(c, +e.target.value)} />
                    <b>{pitch[c]}″</b>
                  </div>
                  <small className="muted">até {tetoPasso}″</small>
                </td>
                <td className="r">{rows || '—'}</td>
                <td className="r">{rows ? `${((rows * pitch[c]) / 39.37).toFixed(1)} m` : '—'}</td>
                <td className="r">{(CLASS_FARE_MULT[c] * pitchFare(c, pitch[c])).toFixed(2)}×</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
