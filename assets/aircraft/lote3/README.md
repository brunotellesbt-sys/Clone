# C919, ARJ21, An-148 e A350-900ULR — catálogo de geração

Prompts prontos pra gerar sprite lateral dessas quatro aeronaves, recém
adicionadas ao catálogo com ficha técnica real. Segue o mesmo padrão dos
lotes anteriores (fundo branco sólido, `gpt-image-2`, 3:2, sem referência de
imagem — só prompt).

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

## Não gerado ainda

Sem `MESHY_API_KEY` disponível nesta sessão. Catálogo pronto, é só rodar:

```bash
export MESHY_API_KEY=msy_...
node .claude/skills/meshy-assets/scripts/meshy.mjs balance   # confere saldo antes
node .claude/skills/meshy-assets/scripts/meshy.mjs gen \
  assets/aircraft/lote3/catalogo.json --out public/sprites/aircraft
```

Custo: 4 imagens × 9 créditos (`gpt-image-2`) = 36 créditos de tabela — o
custo real pode variar, confira `consumed_credits` no `manifest.json` gravado
pelo script depois.

## Depois de gerar

1. Olhar as quatro antes de aprovar — sobretudo o C919 contra o A320 lado a
   lado, que é o par mais fácil de confundir.
2. Rodar `npm run build` (regenera `public/aircraft/manifest.json`) e conferir
   que as quatro aparecem com `★` no log do `art.mjs`.
3. Screenshot do Mercado pra cada uma, headless, como nos lotes anteriores —
   é o que pega erro de máscara antes de virar PR.
