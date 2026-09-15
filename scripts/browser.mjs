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
