import assert from 'node:assert/strict'
import { fundarCompanhia } from '../src/game/ai'

const sorteioCerto = () => 0
assert.equal(fundarCompanhia([], 14.99 * 365, sorteioCerto, [], {}), null)

const fundadas: Record<string, number[]> = {}
assert.ok(fundarCompanhia([], 15 * 365, sorteioCerto, [], fundadas))
assert.equal(Object.values(fundadas).flat().length, 1)
assert.equal(fundarCompanhia([], 29.99 * 365, sorteioCerto, [], fundadas), null)

assert.ok(fundarCompanhia([], 30 * 365, sorteioCerto, [], fundadas))
assert.equal(Object.values(fundadas).flat().length, 2)
assert.equal(fundarCompanhia([], 100 * 365, sorteioCerto, [], fundadas), null)

console.log('Fundação de IA: primeira após 15 anos, segunda após mais 15, limite mundial de duas.')
