async function dataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível carregar uma camada da imagem.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
export function downloadFile(name: string, data: Blob) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.download = name; a.href = url; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** SVG usado como imagem não carrega recursos externos: incorpora camadas e fontes. */
export async function aircraftPng(svg: SVGSVGElement): Promise<Blob> {
  await document.fonts.ready
  const clone = svg.cloneNode(true) as SVGSVGElement
  const files = new Map<string, Promise<string>>()
  const embed = (url: string) => {
    if (!files.has(url)) files.set(url, dataUrl(url))
    return files.get(url)!
  }
  await Promise.all([...clone.querySelectorAll('image')].map(async img => {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href')
    if (!href || href.startsWith('data:')) return
    img.setAttribute('href', await embed(href))
    img.removeAttribute('xlink:href')
  }))
  for (const style of clone.querySelectorAll('style')) {
    let css = style.textContent ?? ''
    for (const match of css.matchAll(/url\("([^"]+)"\)/g)) css = css.replace(match[0], `url("${await embed(match[1])}")`)
    style.textContent = css
  }
  const view = svg.viewBox.baseVal
  clone.setAttribute('width', '2400'); clone.setAttribute('height', String(Math.round(2400 * view.height / view.width)))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = src })
    const canvas = document.createElement('canvas')
    canvas.width = 2400; canvas.height = Math.round(2400 * view.height / view.width)
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG indisponível.')), 'image/png'))
  } finally { URL.revokeObjectURL(src) }
}
