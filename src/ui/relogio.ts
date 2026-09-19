import { MS_POR_DIA } from '../game/engine'

/**
 * Quanto tempo real custa um dia de jogo, aqui na tela.
 *
 * O número da simulação é `MS_POR_DIA` — uma hora de jogo em dois minutos e
 * meio, o dia em uma hora a 1×. Este módulo existe para uma coisa só: deixar o
 * **relógio do mapa** e a **batida do dia** lerem a mesma escala. Eles já
 * ficaram desencontrados uma vez, com o mapa rodando um dia em trinta e quatro
 * segundos enquanto a simulação andava em outro passo, e o avião desenhado
 * nunca estava onde a simulação dizia.
 *
 * `?relogio=N` divide essa escala por N. Existe só para os roteiros de
 * verificação: nenhum deles pode esperar noventa segundos por um dia de jogo,
 * e mudar a escala do jogo para o teste caber seria o teste mandando no jogo.
 * Fora de um roteiro ninguém digita isso, e quem digitar só acelera o próprio
 * relógio — o parâmetro não entra no save nem muda regra nenhuma.
 */
const ACELERA = (() => {
  if (typeof window === 'undefined') return 1
  const n = Number(new URLSearchParams(window.location.search).get('relogio'))
  return Number.isFinite(n) && n > 0 ? n : 1
})()

export const MS_POR_DIA_NA_TELA = MS_POR_DIA / ACELERA
