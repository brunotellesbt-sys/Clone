import {
  clearSave,
  getActiveSlot,
  getSlotSummary,
  hasSave,
  loadGame,
  migrateSaveSlots,
  saveGame,
  setActiveSlot,
} from '../save'
import { newGame } from '../engine'
import { LIVERY_PRESETS } from '../../livery/presets'

// Emulação simples de localStorage em ambiente Node para os testes
class LocalStorageMock {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
  }
}

const mockLocalStorage = new LocalStorageMock()
;(globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = mockLocalStorage

function runSaveTests() {
  console.log('--- Executando testes do módulo save.ts ---')
  mockLocalStorage.clear()

  // Teste 1: Migração de save legado para o Slot 1
  const dummyState = newGame({
    name: 'Linhas Antigas',
    code: 'LA',
    hub: 'GRU',
    livery: LIVERY_PRESETS[0].livery,
  })

  mockLocalStorage.setItem('skyline-tycoon:save', JSON.stringify(dummyState))
  console.log('1. Save legado gravado em skyline-tycoon:save')

  migrateSaveSlots()

  if (!hasSave(1)) throw new Error('Falha: Save legado não foi migrado para o Slot 1!')
  if (hasSave(2) || hasSave(3)) throw new Error('Falha: Slots 2 e 3 deveriam estar vazios após migração!')
  if (mockLocalStorage.getItem('skyline-tycoon:save')) throw new Error('Falha: Chave legada deveria ter sido removida!')

  const loadedSlot1 = loadGame(1)
  if (loadedSlot1?.airline.name !== 'Linhas Antigas') {
    throw new Error('Falha: Dados corrompidos na migração para Slot 1')
  }
  console.log('✔ Sucesso: Save legado migrado com sucesso para Slot 1!')

  // Teste 2: Gravação e leitura independente nos Slots 1, 2 e 3
  mockLocalStorage.clear()

  const gameSlot1 = newGame({ name: 'Companhia Um', code: 'C1', hub: 'GRU', livery: LIVERY_PRESETS[0].livery })
  const gameSlot2 = newGame({ name: 'Companhia Dois', code: 'C2', hub: 'GIG', livery: LIVERY_PRESETS[1].livery })
  const gameSlot3 = newGame({ name: 'Companhia Três', code: 'C3', hub: 'BSB', livery: LIVERY_PRESETS[2].livery })

  saveGame(gameSlot1, 1)
  saveGame(gameSlot2, 2)
  saveGame(gameSlot3, 3)

  if (!hasSave(1) || !hasSave(2) || !hasSave(3)) {
    throw new Error('Falha: Nem todos os slots foram salvos corretamente!')
  }

  const loaded1 = loadGame(1)
  const loaded2 = loadGame(2)
  const loaded3 = loadGame(3)

  if (loaded1?.airline.name !== 'Companhia Um') throw new Error('Falha no Slot 1')
  if (loaded2?.airline.name !== 'Companhia Dois') throw new Error('Falha no Slot 2')
  if (loaded3?.airline.name !== 'Companhia Três') throw new Error('Falha no Slot 3')

  console.log('✔ Sucesso: Slots 1, 2 e 3 salvos e carregados de forma independente!')

  // Teste 3: Resumos dos slots (getSlotSummary)
  const sum1 = getSlotSummary(1)
  const sum2 = getSlotSummary(2)
  const sum3 = getSlotSummary(3)

  if (sum1?.airlineName !== 'Companhia Um' || sum1.code !== 'C1' || sum1.hub !== 'GRU') throw new Error('Resumo do Slot 1 incorreto')
  if (sum2?.airlineName !== 'Companhia Dois' || sum2.code !== 'C2' || sum2.hub !== 'GIG') throw new Error('Resumo do Slot 2 incorreto')
  if (sum3?.airlineName !== 'Companhia Três' || sum3.code !== 'C3' || sum3.hub !== 'BSB') throw new Error('Resumo do Slot 3 incorreto')

  console.log('✔ Sucesso: Resumos dos slots validados com sucesso!')

  // Teste 4: Limpeza de Slot (clearSave)
  clearSave(2)

  if (hasSave(2)) throw new Error('Falha: Slot 2 deveria ter sido apagado!')
  if (!hasSave(1) || !hasSave(3)) throw new Error('Falha: Exclusão do Slot 2 afetou Slot 1 ou Slot 3!')
  if (getSlotSummary(2) !== null) throw new Error('Falha: Resumo do Slot 2 apagado deveria ser null')

  console.log('✔ Sucesso: Exclusão isolada de slot validada!')

  // Teste 5: Slot ativo
  setActiveSlot(3)
  if (getActiveSlot() !== 3) throw new Error('Falha ao definir slot ativo')

  console.log('✔ Sucesso: Gestão de slot ativo validada!')

  console.log('--- TODOS OS TESTES PASSARAM COM SUCESSO! ---')
}

runSaveTests()
