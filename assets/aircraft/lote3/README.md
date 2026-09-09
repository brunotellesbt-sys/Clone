# C919, ARJ21, An-148, A350-900ULR e ATR 72-600 — sprite gerado

Cinco aeronaves, geradas de verdade via `gpt-image-2`, fundo branco sólido,
3:2, sem imagem de referência — só prompt. `catalogo.json` traz os prompts,
`manifest.json` (em `public/sprites/aircraft/`) o id da task e o custo real de
cada uma.

## Por que esses marcadores no prompt

Cada aeronave puxa de um guia de identificação, não de achismo — o mesmo
método que fez o A319 acertar "uma saída sobre a asa, não duas":

- **C919** — quatro janelas de cockpit (o A320 tem seis), para-brisa sem
  entalhe e com borda inferior em V nas laterais, nariz mais arredondado que
  o A320, janelas de cabine retangulares (não ovais), winglet curvo pra cima
  em vez de sharklet reto. É o avião mais fácil de confundir com A320 do
  lote — esses detalhes são o que separa um do outro.
- **ARJ21** — fuselagem e nariz herdados do MD-80/DC-9 (a ferramentaria de
  produção licenciada do MD-80 foi reaproveitada), T-tail, **motor na
  traseira da fuselagem**, não na asa — a asa não carrega motor nenhum.
- **An-148** — asa alta, T-tail, motor sob a asa alta (fica bem longe do
  chão), trem principal recolhe em carenagem lateral da barriga porque a asa
  alta não tem onde esconder o trem.
- **A350-900ULR** — mesma célula do A350-900 que já está no jogo (`a359`):
  nariz caído característico da Airbus, winglet curvo (blended, não
  sharklet), e a marca registrada do Trent XWB — cone de exaustão serrilhado
  (chevron), visível na nacela.
- **ATR 72-600** — asa alta, T-tail, hélice de seis pás (não quatro), trem
  principal recolhe numa carenagem em gota na barriga, não na nacele do
  motor.

## Resultado: quatro em cima, um imperfeito

Conferido pixel a pixel, com zoom no nariz de cada um antes de aprovar
(é o que pegou o problema abaixo):

- **ARJ21, An-148, A350-900ULR, ATR 72-600** — saíram fiéis de primeira.
  Motor na traseira do ARJ21 visível, carenagem do trem do An-148 e do ATR
  certas, cone serrilhado do Trent XWB nítido, hélice do ATR contável.
- **C919** — a primeira geração saiu com cockpit genérico de duas
  vidraças, indistinguível de um A320 qualquer. Regerado com prompt reforçado
  (ênfase repetida no número de janelas, contraste explícito "menor que o
  cockpit de seis vidraças do A320"): melhorou para três vidraças
  claramente diferentes do A320, mas ainda não bateu as quatro exatas nem o
  formato em V que a pesquisa apontou. **Ficou registrado como aproximação,
  não como fidelidade total** — silhueta geral, motor, winglet e proporção
  batem; só o detalhe mais fino do cockpit não fechou depois de uma
  segunda tentativa.

## Custo

45 créditos no lote (5 × 9), mais 9 da regeração do C919 = 54 créditos totais
consumidos nesta rodada.

## Como regerar (o C919, se quiser tentar de novo)

```bash
export MESHY_API_KEY=msy_...
node .claude/skills/meshy-assets/scripts/meshy.mjs gen \
  assets/aircraft/lote3/catalogo.json --out public/sprites/aircraft --force
```

`--force` refaz as cinco. Pra regerar só uma, isole o item num catálogo à
parte (veja o histórico de commit deste lote pro exemplo usado no C919).
