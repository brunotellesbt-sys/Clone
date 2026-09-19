import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const browserPath = process.env.BROWSER_PATH ?? [
  '/opt/pw-browsers/chromium',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const directory = process.env.QA_DIR ?? '.qa'
mkdirSync(directory, { recursive: true })
export const artifact = name => join(directory, name)

/**
 * O endereço do jogo com o relógio acelerado.
 *
 * O jogo passou a andar na escala pedida — uma hora de jogo em dois minutos e
 * meio de relógio, o dia em uma hora a 1× —, e nenhum roteiro de verificação
 * pode esperar noventa segundos por um dia de jogo a 40×. `?relogio=N` divide
 * o tempo de um dia por N, e existe só para isto: mudar a escala do jogo para
 * caber no teste seria o teste mandando no jogo.
 */
export const comRelogio = (url, fator = 4000) =>
  `${url}${url.includes('?') ? '&' : '?'}relogio=${fator}`
