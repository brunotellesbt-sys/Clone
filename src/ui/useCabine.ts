import { useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import {
  ajustarClasse, clampPitch, limiteDaClasse, passoMaximo, PITCH_RANGE,
} from '../game/cabin'
import { CABINS, type Cabins, type SeatConfig } from '../game/types'

export interface CabineMontada {
  seats: Cabins
  pitch: Cabins
  seatConfig: SeatConfig
}

/**
 * A cabine sendo montada, com a trava de capacidade embutida.
 *
 * Mora aqui, e não dentro da tela da frota, porque agora são **duas** telas
 * montando cabine: a reconfiguração de uma cauda que já voa e a encomenda de
 * fábrica, na hora de comprar. Duas cópias da mesma trava seriam duas travas,
 * e a segunda ia envelhecer sozinha.
 */
export function useCabine(t: AircraftType, inicial: CabineMontada) {
  const [seats, setSeats] = useState<Cabins>({ ...inicial.seats })
  const [pitch, setPitch] = useState<Cabins>(clampPitch(inicial.pitch))
  const [seatConfig, setSeatConfig] = useState<SeatConfig>(inicial.seatConfig)

  /**
   * Toda mudança passa por aqui, e por isso a trava não tem por onde vazar.
   *
   * Mexer numa classe muda o teto das outras três — subir a executiva reduz o
   * que a econômica comporta —, então depois de cada mexida as demais são
   * aparadas ao novo teto. Sem isso daria para encher a econômica, encher a
   * executiva por cima e acabar estourado sem nenhum controle ter passado do
   * próprio limite.
   */
  const aplicar = (next: { seats: Cabins; pitch: Cabins; config?: SeatConfig }, mexida?: keyof Cabins) => {
    const cfg = next.config ?? seatConfig
    const s2 = { ...next.seats }
    const p2 = { ...next.pitch }
    for (const c of CABINS) {
      if (c === mexida) continue
      s2[c] = Math.min(s2[c], limiteDaClasse(t, s2, p2, c, cfg))
      p2[c] = Math.min(p2[c], passoMaximo(t, s2, p2, c, cfg))
    }
    setSeats(s2)
    setPitch(p2)
    if (next.config) setSeatConfig(next.config)
  }

  return {
    seats,
    pitch,
    seatConfig,
    aplicar,
    setAssentos: (c: keyof Cabins, v: number) =>
      aplicar({ seats: ajustarClasse(t, seats, pitch, c, v, seatConfig), pitch }, c),
    setPasso: (c: keyof Cabins, v: number) => {
      const teto = passoMaximo(t, seats, pitch, c, seatConfig)
      aplicar({ seats, pitch: { ...pitch, [c]: Math.max(PITCH_RANGE[c][0], Math.min(teto, Math.round(v))) } }, c)
    },
    /** Carrega um padrão ou uma cabine guardada por inteiro. */
    carregar: (b: { seats: Cabins; pitch: Cabins; seatConfig?: SeatConfig }) => {
      setSeatConfig(b.seatConfig ?? {})
      setSeats({ ...b.seats })
      setPitch(clampPitch(b.pitch))
    },
  }
}
