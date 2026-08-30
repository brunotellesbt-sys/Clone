/** Gerador determinístico (mulberry32) — mesma semente, mesmo mundo. */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Rng = ReturnType<typeof makeRng>

export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]
export const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)
export const chance = (rng: Rng, p: number) => rng() < p

/** Hash estável de string -> número, para variação por rota sem guardar estado. */
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}
