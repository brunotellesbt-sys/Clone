#!/usr/bin/env node
/**
 * Gera arte de aeronave pela API da Meshy e baixa o resultado antes de expirar.
 *
 *   export MESHY_API_KEY=msy_...
 *   node meshy.mjs balance
 *   node meshy.mjs gen catalogo.json --out public/aircraft/sprites [--force] [--concurrency 3]
 *   node meshy.mjs status <task-id>
 *
 * As URLs da Meshy expiram em poucos dias, entao o download acontece junto da
 * geracao: nao existe "baixo depois". O manifest gravado ao lado dos PNGs
 * guarda id da task, creditos consumidos e prompt, para auditar ou repetir.
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'https://api.meshy.ai/openapi'
const KEY = process.env.MESHY_API_KEY

/** Custo de tabela por imagem. O cobrado pode ser maior com referencias. */
const CREDITS = { 'nano-banana': 3, 'nano-banana-2': 6, 'nano-banana-pro': 9, 'gpt-image-2': 9 }

if (!KEY) {
  console.error('MESHY_API_KEY nao definida. Exporte a chave antes de rodar.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  if (!res.ok) {
    const msg = body?.message ?? text.slice(0, 200)
    throw new Error(`${res.status} ${path}: ${msg}`)
  }
  return body
}

const exists = (p) => access(p).then(() => true, () => false)

async function balance() {
  const { balance } = await api('/v1/balance')
  return balance
}

/** Espera a task terminar. A Meshy enfileira, entao o inicio pode demorar. */
async function waitFor(id, label) {
  const started = Date.now()
  let last = -1
  for (;;) {
    const task = await api(`/v1/text-to-image/${id}`)
    if (task.progress !== last) {
      last = task.progress
      process.stdout.write(`\r  ${label}: ${task.status} ${task.progress ?? 0}%   `)
    }
    if (task.status === 'SUCCEEDED') {
      process.stdout.write('\r' + ' '.repeat(60) + '\r')
      return task
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      process.stdout.write('\n')
      throw new Error(`${label}: ${task.status} — ${task.task_error?.message ?? 'sem detalhe'}`)
    }
    if (Date.now() - started > 15 * 60_000) throw new Error(`${label}: passou de 15 min`)
    await sleep(4000)
  }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}: a URL pode ter expirado`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

async function generate(catalogPath, outDir, { force, concurrency }) {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const defaults = catalog.defaults ?? {}
  const model = defaults.ai_model ?? 'gpt-image-2'
  await mkdir(outDir, { recursive: true })

  const pending = []
  for (const item of catalog.items) {
    const dest = join(outDir, `${item.id}.png`)
    if (!force && (await exists(dest))) {
      console.log(`  ${item.id}: ja existe, pulando (use --force para refazer)`)
      continue
    }
    pending.push({ item, dest })
  }
  if (!pending.length) return console.log('nada a gerar.')

  // Checar saldo antes vale a pena: metade de um lote gerado e a outra metade
  // recusada por saldo deixa a frota inconsistente, que e o pior estado.
  const saldo = await balance()
  const estimado = pending.length * (CREDITS[model] ?? 9)
  console.log(`saldo ${saldo} credito(s) | ${pending.length} imagem(ns) | estimativa ${estimado}`)
  if (estimado > saldo) {
    console.error('saldo insuficiente para o lote inteiro. Reduza o catalogo ou recarregue.')
    process.exit(1)
  }

  const manifest = []
  let cursor = 0
  let gastos = 0

  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= pending.length) return
      const { item, dest } = pending[i]
      const prompt = `${defaults.prompt_prefix ?? ''}${item.prompt}${defaults.prompt_suffix ?? ''}`
      try {
        const { result: id } = await api('/v1/text-to-image', {
          method: 'POST',
          body: JSON.stringify({
            ai_model: item.ai_model ?? model,
            prompt,
            aspect_ratio: item.aspect_ratio ?? defaults.aspect_ratio ?? '1:1',
            remove_background: item.remove_background ?? defaults.remove_background ?? false,
            ...(item.generate_multi_view ?? defaults.generate_multi_view
              ? { generate_multi_view: true }
              : {}),
          }),
        })
        const task = await waitFor(id, item.id)
        const url = task.image_urls?.[0]
        if (!url) throw new Error('task terminou sem image_urls')
        await download(url, dest)
        gastos += task.consumed_credits ?? 0
        manifest.push({
          id: item.id,
          task: task.id,
          model: task.ai_model,
          credits: task.consumed_credits,
          prompt,
          generated_at: new Date().toISOString(),
        })
        console.log(`  ${item.id}: ok (${task.consumed_credits} creditos) -> ${dest}`)
      } catch (err) {
        console.error(`  ${item.id}: ${err.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))

  if (manifest.length) {
    const path = join(outDir, 'manifest.json')
    const anterior = (await exists(path)) ? JSON.parse(await readFile(path, 'utf8')) : []
    const porId = new Map(anterior.map((e) => [e.id, e]))
    for (const e of manifest) porId.set(e.id, e)
    await writeFile(path, JSON.stringify([...porId.values()], null, 2) + '\n')
  }
  console.log(`\n${manifest.length}/${pending.length} gerada(s), ${gastos} credito(s) gastos.`)
}

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? fallback : rest[i + 1]
}

try {
  if (cmd === 'balance') {
    console.log(`${await balance()} credito(s)`)
  } else if (cmd === 'status') {
    console.log(JSON.stringify(await api(`/v1/text-to-image/${rest[0]}`), null, 2))
  } else if (cmd === 'gen') {
    if (!rest[0]) throw new Error('informe o catalogo: meshy.mjs gen catalogo.json')
    await generate(rest[0], flag('out', 'public/aircraft/sprites'), {
      force: rest.includes('--force'),
      concurrency: Number(flag('concurrency', 3)),
    })
  } else {
    console.log('uso: meshy.mjs balance | status <id> | gen <catalogo.json> [--out dir] [--force] [--concurrency n]')
    process.exit(1)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
