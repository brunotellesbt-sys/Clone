/**
 * Resolve a arte das aeronaves na Wikimedia Commons — sem baixar nada para o repositório.
 *
 * Roda no `prebuild` (inclusive dentro do GitHub Actions). Para cada modelo:
 *   1. procura desenhos de perfil / silhuetas nas categorias do Commons;
 *   2. confere que a licença é livre (domínio público ou Creative Commons);
 *   3. grava a URL direta em public/aircraft/manifest.json e o crédito em CREDITS.md.
 *
 * O site publicado aponta para os servidores da Wikimedia. Nenhuma imagem de
 * terceiros é redistribuída aqui, e o crédito exigido pela licença vai junto.
 * Modelo sem resultado continua com o desenho vetorial próprio do jogo.
 *
 *   npm run art             resolve e grava o manifesto
 *   npm run art -- --dry    só mostra o que encontraria
 *   npm run art -- --force  ignora o cache e consulta tudo de novo
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'public', 'aircraft')
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'skyline-tycoon/1.0 (jogo de simulação; busca de imagens livres na Commons)'

const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')
// A varredura automática fica desligada: na Commons ela só traz foto com
// livery real, gráfico sobre a aeronave ou vista em 3/4. Ligue com --auto.
const auto = process.argv.includes('--auto')

const cfg = JSON.parse(readFileSync(join(ROOT, 'aircraft-art.json'), 'utf8'))
const models = cfg.aeronaves

/** Licenças que podem ser usadas num site público, com o crédito devido. */
const FREE = /^(cc0|cc[ -]by([ -]sa)?([ -][\d.]+)?|public domain|pd[- ]|no restrictions|attribution)/i

/** Nome que já anuncia um perfil lateral. */
const GOOD_NAME = /(side.?view|sideview|side.?profile|left.?profile|port.?profile)/i
/** Nome que anuncia desenho técnico — vale se a proporção for deitada. */
const DRAWING_NAME = /(line.?draw|drawing|silhouette|profile|outline|schematic|blueprint|diagram|vector)/i
/** Nome que indica foto, marca de companhia ou vista que não serve. */
const BAD_NAME = /(airlines?|airways|aviation|livery|photo|img_|dsc_|\d{8}|takeoff|landing|cockpit|interior|seat|cutaway|radome|antenna|3.?view|three.?view|4.?view|top.?view|front.?view|plan.?view|rear.?view|map|chart|logo|family|comparison|compari|size.?chart|versus|evolution|variants|lineup|collage|montage|poster|payload|range|orders|operator|grounding|autopilot|panel|instrument|timeline|production|deliver|accident|incident|statistic|graph|effect|simplified|seat|cabin|cargo|freight|emblem|badge|patch|tail.?number|registration)/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${params.list ?? params.generator ?? 'api'}`)
  return res.json()
}

async function filesInCategory(category, limit = 200) {
  try {
    const j = await api({
      action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`,
      cmtype: 'file', cmlimit: String(limit),
    })
    return (j.query?.categorymembers ?? []).map((m) => m.title)
  } catch {
    return []
  }
}

async function searchFiles(query, limit = 40) {
  try {
    const j = await api({
      action: 'query', list: 'search', srsearch: `${query} filetype:drawing|bitmap`,
      srnamespace: '6', srlimit: String(limit),
    })
    return (j.query?.search ?? []).map((m) => m.title)
  } catch {
    return []
  }
}

async function imageInfo(titles) {
  if (titles.length === 0) return []
  const out = []
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40)
    try {
      const j = await api({
        action: 'query', titles: batch.join('|'), prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        iiextmetadatafilter: 'LicenseShortName|Artist|AttributionRequired|LicenseUrl',
      })
      for (const page of Object.values(j.query?.pages ?? {})) {
        const ii = page.imageinfo?.[0]
        if (!ii) continue
        const md = ii.extmetadata ?? {}
        out.push({
          title: page.title,
          url: ii.url,
          descriptionurl: ii.descriptionurl,
          mime: ii.mime,
          width: ii.width,
          height: ii.height,
          license: (md.LicenseShortName?.value ?? '').replace(/<[^>]+>/g, '').trim(),
          licenseUrl: (md.LicenseUrl?.value ?? '').trim(),
          artist: (md.Artist?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
        })
      }
    } catch {
      /* lote falhou: segue para o próximo */
    }
    await sleep(120)
  }
  return out
}

/** Pontua um candidato: perfil lateral, licença livre, formato vetorial e proporção deitada. */
function score(info, model, inDrawingCat = false) {
  if (!FREE.test(info.license)) return -1
  // Só desenho: fotografia é sempre JPEG e sempre traz a pintura de uma companhia real.
  if (info.mime !== 'image/svg+xml' && info.mime !== 'image/png') return -1
  if (!info.width || !info.height || info.width < 120) return -1

  const name = info.title.replace(/^File:/, '')
  if (BAD_NAME.test(name)) return -1
  const ratio = info.width / info.height
  // Perfil lateral declarado no nome, ou desenho técnico com formato deitado
  // (a silhueta de vista superior vem quadrada e cai fora aqui).
  const sideByName = GOOD_NAME.test(name)
  const sideByShape = (DRAWING_NAME.test(name) || inDrawingCat) && ratio >= 1.8
  if (!sideByName && !sideByShape) return -1

  // O nome tem que trazer a designação do modelo como palavra inteira,
  // senão "a350" casa com "1a35090u" e vem um bombardeiro da Segunda Guerra.
  const termos = model.termos ?? []
  const hit = termos.findIndex((t) => new RegExp(`(^|[^a-z0-9])(${t})([^a-z0-9]|$)`, 'i').test(name))
  if (hit < 0) return -1
  // E o fabricante também: sem isso, "Route nationale française 767" vira um Boeing.
  if (model.marca && !new RegExp(model.marca, 'i').test(name)) return -1

  let s = 40
  if (inDrawingCat) s += 8
  s += Math.max(0, 24 - hit * 8) // o primeiro termo é a variante exata
  if (info.mime === 'image/svg+xml') s += 24
  else s += 10
  if (ratio < 1.6) return -1
  if (ratio > 2 && ratio < 7) s += 18
  else s += 6
  if (sideByName) s += 20
  if (/^(cc0|public domain|pd)/i.test(info.license)) s += 8
  return s
}

const cachePath = join(OUT, '.commons-cache.json')
const cache = !force && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}

/**
 * Monta um único acervo de candidatos e depois casa cada modelo contra ele.
 * Sai muito mais barato em chamadas de API do que procurar por avião.
 */
const CATEGORIAS_GLOBAIS = [
  'Aircraft silhouettes',
  'Silhouette drawings of aircraft',
  'SVG aircraft silhouettes',
  'Side views of aircraft',
  'Line profile drawings of aircraft',
  'Line drawings of Airbus aircraft',
  'Line drawings of Boeing aircraft',
  'Line drawings of Embraer aircraft',
  'Line drawings of Bombardier aircraft',
]
const BUSCAS_GLOBAIS = [
  'intitle:silhouette airliner',
  'intitle:silhouette Boeing',
  'intitle:silhouette Airbus',
  'intitle:silhouette Embraer',
  'intitle:sideview aircraft',
  'intitle:"side view" airliner drawing',
]

const pool = new Set()
const fromSilhouetteCat = new Set()

if (!auto) {
  console.log('Usando só os arquivos fixados em aircraft-art.json (--auto liga a varredura).')
}
if (auto) console.log('Montando o acervo de candidatos na Commons...')
for (const cat of auto ? CATEGORIAS_GLOBAIS : []) {
  const found = await filesInCategory(cat, 500)
  for (const t of found) {
    pool.add(t)
    if (/silhouette|side view|profile|line drawing|drawings/i.test(cat)) fromSilhouetteCat.add(t)
  }
  await sleep(120)
}
for (const q of auto ? BUSCAS_GLOBAIS : []) {
  for (const t of await searchFiles(q, 200)) pool.add(t)
  await sleep(120)
}
for (const model of auto ? Object.values(models) : []) {
  for (const cat of model.categorias ?? []) {
    for (const t of await filesInCategory(cat, 300)) {
      pool.add(t)
      if (/drawing|silhouette|profile|technical/i.test(cat)) fromSilhouetteCat.add(t)
    }
    await sleep(100)
  }
  for (const termo of (model.termos ?? []).slice(0, 2)) {
    const limpo = termo.replace(/[.?\\]/g, ' ').trim()
    for (const q of [
      `${limpo} filemime:image/svg+xml`,
      `intitle:"${limpo}" drawing`,
      `intitle:"${limpo}" silhouette`,
    ]) {
      for (const t of await searchFiles(q, 60)) {
        pool.add(t)
        fromSilhouetteCat.add(t)
      }
      await sleep(100)
    }
  }
}
if (auto) console.log(`  ${pool.size} arquivos candidatos. Consultando licenças...`)

const infos = pool.size ? await imageInfo([...pool]) : []
if (auto) console.log(`  ${infos.length} com metadados.\n`)

const manifest = {}
const credits = []
const misses = []

for (const [id, model] of Object.entries(models)) {
  if (model.url) {
    manifest[id] = {
      file: model.url, w: model.w ?? 1000, h: model.h ?? 300,
      ...(model.regions ? { regions: model.regions } : {}),
      credit: { author: model.author ?? '', license: model.license ?? '', source: model.source ?? model.url },
    }
    credits.push(`- **${id}** — ${model.author || 'autor não informado'} · ${model.license || 'licença não informada'} · <${model.source || model.url}>`)
    console.log(`  = ${id}: fixado manualmente`)
    continue
  }

  const ranked = infos
    .map((i) => ({ i, s: score(i, model, fromSilhouetteCat.has(i.title)) }))
    .filter((x) => x.s > 40)
    .sort((a, b) => b.s - a.s)

  if (ranked.length === 0) {
    misses.push(id)
    console.log(`  ✗ ${id}: sem perfil lateral de licença livre no acervo`)
    continue
  }

  const best = ranked[0].i
  const entry = {
    file: best.url.split('?')[0],
    w: best.width,
    h: best.height,
    ...(model.regions ? { regions: model.regions } : {}),
    credit: {
      author: best.artist || 'ver página do arquivo',
      license: best.license,
      source: best.descriptionurl,
    },
  }
  manifest[id] = entry
  cache[id] = entry
  credits.push(`- **${id}** — ${entry.credit.author} · ${entry.credit.license} · <${entry.credit.source}>`)
  console.log(`  ✓ ${id}: ${best.title.replace(/^File:/, '')} (${best.width}×${best.height}, ${best.license}, nota ${ranked[0].s})`)
}

// Sprites próprios (gerados por IA, sem imagem de referência de terceiros) em
// public/sprites/aircraft/<id>.png ou <id>__<motor>.png quando a nacela muda
// por motorização. Não passam pela Commons e não levam crédito de licença —
// são originais. Sobrepõem qualquer resultado da Commons para o mesmo id (a
// arte feita para o jogo vence a genérica) e saem da lista de "sem imagem
// livre" se tivessem caído lá.
const localSprites = []
const spritesDir = join(ROOT, 'public', 'sprites', 'aircraft')
if (existsSync(spritesDir)) {
  for (const file of readdirSync(spritesDir)) {
    if (!file.endsWith('.png')) continue
    const stem = file.slice(0, -4)
    const [id, engineId] = stem.split('__')
    const bytes = readFileSync(join(spritesDir, file))
    const w = bytes.readUInt32BE(16)
    const h = bytes.readUInt32BE(20)
    const entry = { file: `sprites/aircraft/${file}`, w, h }
    const key = engineId ? `${id}:${engineId}` : id
    manifest[key] = entry
    // Chave-base (`id` puro) como reserva, para quem consultar sem motor.
    if (engineId && !manifest[id]) manifest[id] = entry
    const i = misses.indexOf(id)
    if (i >= 0) misses.splice(i, 1)
    if (!localSprites.includes(id)) localSprites.push(id)
    console.log(`  ★ ${key}: sprite próprio (${w}×${h})`)
  }
}

if (dry) {
  console.log(`\n[--dry] nada gravado. ${Object.keys(manifest).length} modelos resolvidos, ${misses.length} sem imagem.`)
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
writeFileSync(cachePath, JSON.stringify(cache, null, 2))
writeFileSync(
  join(OUT, 'CREDITS.md'),
  [
    '# Créditos das imagens de aeronaves',
    '',
    'As silhuetas das aeronaves são carregadas dos servidores da Wikimedia Commons',
    'e mantêm a licença original de cada autor. Nenhuma delas é redistribuída por',
    'este repositório.',
    '',
    'As pinturas, cores, logotipos e nomes de companhias que aparecem no jogo são',
    'fictícios e não têm relação com os autores destas imagens nem com os',
    'fabricantes das aeronaves.',
    '',
    ...(credits.length ? credits : ['_Nenhuma imagem resolvida; o jogo está usando os desenhos vetoriais próprios._']),
    '',
    ...(localSprites.length
      ? [
          '## Sprites próprios',
          '',
          'Gerados por IA a partir de prompt, sem imagem de referência de terceiros —',
          'não precisam de crédito de licença. Ficam em `public/sprites/aircraft/` e',
          '**são versionados no repositório**, diferente da arte da Commons.',
          '',
          `${localSprites.join(', ')}.`,
          '',
        ]
      : []),
    ...(misses.length ? ['', `Sem imagem livre encontrada (usam o vetor do jogo): ${misses.join(', ')}.`] : []),
    '',
  ].join('\n'),
)

console.log(
  `\nmanifest.json e CREDITS.md gravados: ${Object.keys(manifest).length} modelos com imagem` +
    ` (${localSprites.length} sprite próprio), ${misses.length} no vetor.`,
)
