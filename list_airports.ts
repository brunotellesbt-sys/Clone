import { AIRPORTS } from './src/game/data/airports'
import { AIRCRAFT } from './src/game/data/aircraft'

const a321neo = AIRCRAFT.find(a => a.id === 'a321neo')!
const b39m = AIRCRAFT.find(a => a.id === 'b39m')!

// We will check which BR airports became possible for a321neo
// Originally, factor was 1.0 (so 7200 base required). Now factor is 0.74 (5328 base required).
// Let's check BR airports that have runway between 5328 and 7200 (adjusted for elevation).

const newlyPossible: {iata: string, city: string}[] = []

const BR_AIRPORTS = AIRPORTS.filter(a => a.cc === 'BR')
for (const a of BR_AIRPORTS) {
    const requiredBefore = a321neo.runway * (1 + a.elev / 1000 * 0.1)
    const requiredNow = a321neo.runwayMin * (1 + a.elev / 1000 * 0.1)

    if (a.runway < requiredBefore && a.runway >= requiredNow) {
        newlyPossible.push({iata: a.iata, city: a.city})
    }
}

console.log(`With the new FATOR_CAMPO_CURTO_PESADO, these Brazilian airports now accept the A321neo/B737-900:`)
newlyPossible.forEach(p => console.log(`- ${p.city} (${p.iata})`))
