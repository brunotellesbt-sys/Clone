import { useEffect, useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import type { Paint2D } from '../game/types'

/** Correspondência explícita: cargueiros e famílias ausentes conservam a arte atual. */
export const SOURCE_2D: Record<string, string> = {
  atr42: 'atr42', atr72: 'atr72', q400: 'bombardierq400',
  crj700: 'bombardiercrj700', crj900: 'bombardiercrj900', crj1000: 'bombardier_crj1000',
  e170: 'embraere170', e175: 'embraere175', e190: 'embraere190', e195: 'embraere195',
  e190e2: 'e190e2', e195e2: 'e195e2', a220100: 'cs100template', a220300: 'cs300template',
  a319: 'airbusa319', a320: 'airbusa320', a321: 'airbusa321',
  a319neo: 'airbusa319', a320neo: 'airbusa320', a321neo: 'airbusa321', a21lr: 'airbusa321', a21xlr: 'airbusa321',
  b73g: 'boeing737700', b737: 'boeing737800', b739: 'boeing737900',
  b37m: 'boeing737max7', b38m: 'boeing737max8', b39m: 'boeing737max9', b310m: 'boeing737max10',
  b752: 'boeing757200', b753: 'boeing757300', b763: 'boeing767300', b764: 'boeing767400er',
  a332: 'airbusa330200', a333: 'airbusa330300', a338: 'airbusa330800neo', a339: 'airbusa330900neo',
  b788: 'boeing7878', b789: 'boeing7879', b78x: 'boeing78710',
  a359: 'airbusa350900', a35ulr: 'airbusa350900', a35k: 'airbusa3501000',
  b77e: 'boeing777200', b77w: 'boeing777300', b779: 'boeing7779', b748: 'boeing7478i', a388: 'airbusa380800',
  arj21: 'comacarj21', c919: 'comacc919',
}

export type Box = [number, number, number, number]
export interface Layer2D {
  id: string; name: string; order: number; variant: string; option: boolean
  pattern: boolean; sector: 'tail' | 'fuselage'; file: string; small: string; size: [number, number]; box: Box | null
}
export interface Model2D {
  id: string; name: string; size: [number, number]; bodyBox: Box; tailBox: Box; layers: Layer2D[]
}
export interface LibraryItem { id: string; file: string; category: string; size: [number, number] }
export const asset2d = (file: string) => `${import.meta.env.BASE_URL}aircraft2d/${file}`
const cache = new Map<string, Promise<unknown>>()
export function load2d<T>(file: string): Promise<T> {
  if (!cache.has(file)) cache.set(file, fetch(asset2d(file)).then(r => {
    if (!r.ok) throw new Error(`Recurso 2D indisponível: ${file}`)
    return r.json()
  }).catch(e => { cache.delete(file); throw e }))
  return cache.get(file) as Promise<T>
}
export function use2d<T>(file?: string) {
  const [result, setResult] = useState<{ file?: string; data?: T; error?: string }>({})
  useEffect(() => {
    let live = true
    if (file) load2d<T>(file).then(data => { if (live) setResult({ file, data }) })
      .catch(e => { if (live) setResult({ file, error: String(e.message) }) })
    return () => { live = false }
  }, [file])
  return result.file === file ? result : {}
}
export const useModel2d = (typeId: string) => use2d<Model2D>(SOURCE_2D[typeId] ? `models/${SOURCE_2D[typeId]}.json` : undefined)

export function engineFamily(id: string) {
  if (/^(cfm|leap)/.test(id)) return 'cfm'
  if (/^pw/.test(id)) return 'pw'
  if (/^(trent|rb)/.test(id)) return 'rr'
  if (/^v25/.test(id)) return 'iae'
  if (/^gp/.test(id)) return 'ea'
  if (/^(ge|genx|cf)/.test(id)) return 'ge'
  return ''
}
const neo = (id: string) => /a3(19|20|21)neo|a21(lr|xlr)/.test(id)

export function wingOptions(model: Model2D, typeId: string): string[] {
  if (/^airbusa3(19|20|21)$/.test(model.id)) return neo(typeId) ? ['sharklet'] : ['wingtip_fence', 'sharklet']
  if (/^boeing737[789]00$/.test(model.id)) return ['none', 'winglet', 'scimitar']
  if (/^boeing(757|767300)/.test(model.id)) return ['none', 'winglet']
  if (model.id === 'embraere175') return ['standard', 'enhanced']
  return []
}

export function selectedLayers(model: Model2D, type: AircraftType, engineId: string, config: Paint2D = {}) {
  const family = engineFamily(engineId)
  const options = wingOptions(model, type.id)
  const wing = options.includes(config.winglet ?? '') ? config.winglet! :
    options.includes('winglet') ? 'winglet' : options[0]
  const variant = neo(type.id) ? 'neo' : type.id === 'b739' || type.id === 'b77w' ? 'er' : ''
  const candidates = model.layers.filter(l => {
    if (l.pattern) return !!config.layers?.[l.id]
    if (l.variant && l.variant !== 'shared' && l.variant !== variant) return false
    if (variant === 'neo' && l.option && !l.variant && !/fuselage|elevator/.test(l.name)) return false
    // O 777-300ER tem asa e GE90 próprios; não recebe motores da versão sem ER.
    if (variant === 'er' && model.id === 'boeing777300' && l.option && !l.variant) return false
    if (/racoon_mask|eyebrow/.test(l.name)) return !!config.eyeMask
    if (wing) {
      if (options.includes('wingtip_fence') && /wingtip_fence|sharklet/.test(l.name) && !l.name.includes(wing)) return false
      if (options.includes('scimitar')) {
        if (/scimitar/.test(l.name)) return wing === 'scimitar'
        if (/winglet/.test(l.name)) return wing === 'winglet'
        if (/wing_none/.test(l.name)) return wing === 'none'
      } else if (options.includes('none') && /winglet|wing_none/.test(l.name)) {
        if (wing === 'none' && /winglet/.test(l.name)) return false
        if (wing === 'winglet' && /wing_none/.test(l.name)) return false
      }
      if (options.includes('enhanced') && /standard|enhanced/.test(l.name) && !l.name.includes(wing)) return false
    }
    // wing_w do ARJ21 é acabamento do winglet; a camada wing contém asa e nacela.
    return true
  })
  const families = [...new Set(candidates.flatMap(l => l.name.match(/_(cfm|iae|pw|ge|rr|ea|pj|ae)$/)?.[1] ?? []))]
  const available = families.includes(family)
  const visualFamily = available ? family : families[0]
  return {
    layers: candidates.filter(l => {
      const tag = l.name.match(/_(cfm|iae|pw|ge|rr|ea|pj|ae)$/)?.[1]
      return !tag || tag === visualFamily
    }), wing, family: visualFamily,
    warning: !available && families.length ? `O ZIP não possui a nacela ${family.toUpperCase() || engineId} para este modelo; a prévia usa ${visualFamily.toUpperCase()}. A motorização da simulação é preservada.` : undefined,
  }
}

/** Só caminhos do acervo local entram no save; URLs externas não são aceitas. */
export const isAsset2d = (file: unknown): file is string => typeof file === 'string' && /^assets\/[a-f0-9]{24}\.(webp|png|jpg|jpeg|otf|ttf|svg)$/.test(file)
export const label2d = (name: string) => name.replace(/^assets_/, '').replace(/_/g, ' ').replace(/\.(webp|png|jpg|otf|ttf)$/, '')
