import { asset2d } from './aircraft2d'

/** Sprites de mapa extraídos do APK fornecido pelo autor. */
const SPRITES: Record<string, [string, string]> = {
  a320: ['assets/9510f5d37826a7bfc829ce28.png', 'assets/e655a10ac9e00bae8a33a900.png'],
  a330: ['assets/d6f49a0cc6c44064f7782a3d.png', 'assets/7c6f4dad1739d3ea24575857.png'],
  a340: ['assets/fd43da9ddeb92a49d3ce1cf5.png', 'assets/28b6c2ced5c44e31587ce586.png'],
  a350: ['assets/f2607d8759d653f75c176623.png', 'assets/a05b64011bf0d428f39373df.png'],
  a380: ['assets/026e8fac7ce3fd751fb948bb.png', 'assets/ef80f4b1c9dd9dd4701fd660.png'],
  atr: ['assets/b405a8607ec6fe1b51973f87.png', 'assets/c85247bf05bb081d17486b0e.png'],
  b733: ['assets/2e45d586d9f4816309f6cda0.png', 'assets/e90f93f9afba2f7b131fb8b9.png'],
  b738: ['assets/6a503f6ad7c5953514529c1c.png', 'assets/376b953aabaa455bc7c0f0cb.png'],
  b744: ['assets/7ffd6b5cd51e80ac6fe7c24d.png', 'assets/0e66ad2bd754d277ed1db748.png'],
  b752: ['assets/9b023af1255212b4e020b67e.png', 'assets/b3f989d04f376ae5deeaada9.png'],
  b763: ['assets/b7b6863518317e9420f5a64e.png', 'assets/49e46c86b5aa2262708d3b54.png'],
  b772: ['assets/bdcbf82dc4c7a440c55016e3.png', 'assets/5a5f774242612b448af303cb.png'],
  b789: ['assets/072293feb9f3c21854e3128c.png', 'assets/4625512e1ceee48e91b59c23.png'],
}

export function spriteMapa(typeId: string, selected: boolean): string | null {
  const family = /^a3(18|19|20|21)|^a21(lr|xlr)/.test(typeId) ? 'a320' :
    /^a33/.test(typeId) ? 'a330' : /^a34/.test(typeId) ? 'a340' :
    /^a35/.test(typeId) ? 'a350' : /^a38/.test(typeId) ? 'a380' :
    /^(atr|q[234]00)/.test(typeId) ? 'atr' : /^(a220|b712|crj|erj|e1|ssj|sj|arj|an1[45])/.test(typeId) ? 'b733' :
    /^(b73|b3)/.test(typeId) ? 'b738' :
    /^b74/.test(typeId) ? 'b744' : /^b75/.test(typeId) ? 'b752' :
    /^b76/.test(typeId) ? 'b763' : /^b77/.test(typeId) ? 'b772' :
    /^b78/.test(typeId) ? 'b789' : null
  const files = family && SPRITES[family]
  return files ? asset2d(files[selected ? 1 : 0]) : null
}
