/**
 * A escala vertical da grade semanal: quantos pixels vale um minuto.
 *
 * Mora fora do componente porque é **aritmética**, e aritmética se mede no
 * terminal. Ela já errou feio na tela e ninguém tinha como provar: doze voos
 * por dia, de 85 em 85 minutos, numa janela de dezenove horas espremida em
 * 360px davam 27px entre uma partida e a seguinte — menos do que o bloco de
 * voo precisa para mostrar hora e rota. Os blocos se cobriam e o último do dia
 * ainda saía cortado pela borda.
 *
 * A regra é uma frase: a grade tem a altura pedida, **ou** a altura que faz o
 * menor intervalo do dia caber num bloco inteiro — o que for maior. Num dia de
 * dois voos nada muda; num dia cheio ela cresce e a página rola para baixo,
 * que é o único sentido em que o celular rola.
 *
 * O teto existe para o caso patológico: duas partidas separadas por um minuto
 * pediriam uma grade de milhares de pixels, e aí o remédio é pior.
 */
export const ALTURA_MAXIMA = 2400

export function escalaDaGrade(
  janela: number,
  menorIntervalo: number,
  blocoMin: number,
  alturaBase: number,
): { porMinuto: number; altura: number } {
  const porMinuto = Math.min(
    ALTURA_MAXIMA / janela,
    Math.max(alturaBase / janela, blocoMin / Math.max(1, menorIntervalo)),
  )
  return { porMinuto, altura: Math.round(janela * porMinuto) }
}

/**
 * O menor intervalo entre duas partidas do mesmo dia.
 *
 * É ele que dita a escala: se num dia saem voos de 85 em 85 minutos, 85
 * minutos precisam valer pelo menos a altura de um bloco, ou o de cima cobre o
 * de baixo. Dias diferentes não se atrapalham — cada um tem a sua coluna —,
 * então o que vale é o menor intervalo de qualquer um deles.
 */
export function menorIntervaloDoDia(blocos: { dow: number; de: number }[], janela: number): number {
  let menor = janela
  for (let dow = 0; dow < 7; dow++) {
    const saidas = blocos.filter((b) => b.dow === dow).map((b) => b.de).sort((a, b) => a - b)
    for (let i = 1; i < saidas.length; i++) {
      if (saidas[i] > saidas[i - 1]) menor = Math.min(menor, saidas[i] - saidas[i - 1])
    }
  }
  return menor
}
