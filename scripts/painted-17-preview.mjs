import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { browserPath } from './browser.mjs'

const base = process.env.QA_URL ?? 'http://127.0.0.1:5173'
const output = 'docs/images/pintura-simulada-17.png'
const browser = await chromium.launch({ executablePath: browserPath })
try {
  const page = await browser.newPage({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`)
  })
  await page.goto(`${base}/scripts/painted-17-preview.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelectorAll('[data-painted-model] svg').length === 17)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-painted-model] image')].every(image => {
    const href = image.getAttribute('href')
    return !!href && (!href.startsWith('data:') || href.length > 100)
  }))
  assert.deepEqual(errors, [])
  mkdirSync('docs/images', { recursive: true })
  await page.locator('main').screenshot({ path: output })
  console.log(`17 pinturas renderizadas: ${output}`)
} finally {
  await browser.close()
}
