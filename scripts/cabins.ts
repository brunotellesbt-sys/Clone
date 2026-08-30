/** Confere as configurações de cabine de todos os modelos: `npm run cabines`. */
import { AIRCRAFT } from '../src/game/data/aircraft'
import { LAYOUTS, cabinLength, checkCabin, sumSeats } from '../src/game/cabin'

for (const t of AIRCRAFT) {
  const rows = LAYOUTS.map((l) => {
    const b = l.build(t)
    const c = checkCabin(t, b.seats, b.pitch)
    return `${sumSeats(b.seats)}${c.ok ? '' : '!'}`.padStart(4)
  })
  console.log(
    t.name.padEnd(24),
    'lim' + String(t.maxSeats).padStart(4),
    (cabinLength(t) / 39.37).toFixed(1).padStart(5) + 'm',
    '|', rows.join(' '),
  )
}
console.log('\n         ' + ' '.repeat(24) + LAYOUTS.map((l) => l.id.slice(0, 4).padStart(4)).join(' '))
