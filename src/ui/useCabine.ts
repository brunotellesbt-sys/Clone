import { useState } from 'react'
import type { AircraftType } from '../game/data/aircraft'
import {
  ajustarClasse, normalizarCabine, passoMaximo, PITCH_RANGE,
} from '../game/cabin'
import { type Cabins, type SeatConfig } from '../game/types'
import { SEAT_BY_ID } from '../game/seatModels'

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
  const [base] = useState(() => normalizarCabine(t, inicial.seats, inicial.pitch, inicial.seatConfig))
  const [seats, setSeats] = useState<Cabins>(base.seats)
  const [pitch, setPitch] = useState<Cabins>(base.pitch)
  const [seatConfig, setSeatConfig] = useState<SeatConfig>(base.seatConfig)

  /**
   * Toda mudança passa por aqui, e por isso a trava não tem por onde vazar.
   *
   * Mexer numa classe muda o teto das outras três — subir a executiva reduz o
   * que a econômica comporta —, então depois de cada mexida as demais são
   * aparadas ao novo teto. Sem isso daria para encher a econômica, encher a
   * executiva por cima e acabar estourado sem nenhum controle ter passado do
   * próprio limite.
   */
  const aplicar = (next: { seats: Cabins; pitch: Cabins; config?: SeatConfig }) => {
    const normalized = normalizarCabine(t, next.seats, next.pitch, next.config ?? seatConfig)
    setSeats(normalized.seats)
    setPitch(normalized.pitch)
    setSeatConfig(normalized.seatConfig)
  }

  return {
    seats,
    pitch,
    seatConfig,
    aplicar,
    setAssentos: (c: keyof Cabins, v: number) =>
      aplicar({ seats: ajustarClasse(t, seats, pitch, c, v, seatConfig), pitch }),
    setPasso: (c: keyof Cabins, v: number) => {
      const teto = passoMaximo(t, seats, pitch, c, seatConfig)
      const min = SEAT_BY_ID[seatConfig[c]?.style ?? '']?.minPitch ?? PITCH_RANGE[c][0]
      aplicar({ seats, pitch: { ...pitch, [c]: Math.max(min, Math.min(teto, Math.round(v))) } })
    },
    /** Carrega um padrão ou uma cabine guardada por inteiro. */
    carregar: (b: { seats: Cabins; pitch: Cabins; seatConfig?: SeatConfig }) => {
      aplicar({ seats: b.seats, pitch: b.pitch, config: b.seatConfig ?? {} })
    },
  }
}
