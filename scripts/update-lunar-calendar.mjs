// Atualização explícita; o jogo e os testes nunca consultam a rede.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

const years = Array.from({ length: 75 }, (_, i) => 2026 + i)
const rows = new Map()
async function readYear(year) {
  const url = `https://www.hko.gov.hk/en/gts/time/calendar/text/files/T${year}e.txt`
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      assert(response.ok, `${url}: HTTP ${response.status}`)
      const text = await response.text()
      const dates = new Map()
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^(\d{4})\/(\d+)\/(\d+)\s+([158])(?:st|th) Lunar Month\s+/)
        if (!match) continue
        assert.equal(Number(match[1]), year)
        const lunarMonth = Number(match[4])
        // O TXT repete o número no mês intercalar (ex.: maio lunar de 2028).
        // A primeira ocorrência é o mês regular; o mês intercalar vem depois.
        if (dates.has(lunarMonth)) continue
        const offset = lunarMonth === 1 ? 0 : lunarMonth === 5 ? 4 : 14
        const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3]) + offset))
        dates.set(lunarMonth, (date.getUTCMonth() + 1) * 100 + date.getUTCDate())
      }
      assert.equal(dates.size, 3, `formato HKO inesperado: ${year}`)
      rows.set(year, [dates.get(1), dates.get(5), dates.get(8)])
      return
    } catch (error) { lastError = error }
  }
  throw lastError
}
// Três pedidos no máximo, sem sobrecarregar o serviço público.
const queue = [...years]
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) await readYear(queue.shift())
}))
assert.equal(rows.size, years.length)
assert.equal(rows.get(2027)[0], 206)
assert.equal(rows.get(2028)[0], 126)
const header = `/** Observatório de Hong Kong, consultado em ${new Date().toISOString().slice(0, 10)}.
 * https://www.hko.gov.hk/en/gts/time/conversion.htm
 * Fonte por ano: https://www.hko.gov.hk/en/gts/time/calendar/text/files/T{ano}e.txt
 * Colunas MMDD: ano-novo (1/1 lunar), barcos-dragão (5/5), meio do outono (8/15).
 * Regenerar: node scripts/update-lunar-calendar.mjs
 */\n`
writeFileSync('src/game/data/lunarFestivalDates.ts', header + 'export const LUNAR_FESTIVAL_DATES: Record<number, [number, number, number]> = {\n' +
  years.map(year => `  ${year}: [${rows.get(year).join(', ')}],`).join('\n') + '\n}\n')
console.log(`OK: ${rows.size} anos de datas lunares oficiais; arquivo escrito após validar todas as respostas.`)
