# 39 aeronaves — jato acima de 70 lugares + Dash 8 Q400

Lote grande: toda a frota restante que ainda estava no vetor paramétrico,
filtrada por jato com mais de 70 lugares (a pedido do autor), mais o Dash 8
Q400 (turboélice, mantido de propósito apesar do filtro).

## Como o catálogo foi montado

Diferente dos lotes anteriores — prompt escrito à mão, um por um —, esse
catálogo foi **gerado por script** a partir da própria ficha verificada do
jogo (`src/game/data/aircraft.ts` e `engines.ts`): comprimento, envergadura,
diâmetro de fuselagem, altura, tipo de asa, tipo de cauda, onde o motor
monta, e o `winglet` que o jogo já usa no desenho vetorial. Um prompt por
combinação aeronave+motor, por template, não por 69 parágrafos digitados.

A razão: 69 parágrafos escritos à mão têm risco real de inconsistência entre
um e outro — um detalhe esquecido aqui, uma unidade errada ali. Gerar a
partir do dado que já está verificado no código elimina essa classe de erro
inteira. Por cima do template, um pequeno dicionário de notas por geração de
motor, só onde há marcador visual conhecido e confiável:

- **737 NG vs MAX** — nacela lisa e circular do CFM56-7B contra a nacela do
  LEAP-1B, achatada embaixo e com borda serrilhada (chevron); winglet
  "blended" de curva única contra o "split scimitar" do MAX, com uma segunda
  lâmina menor pra baixo.
- **E-Jet E1 vs E2** — motor visivelmente maior e mais redondo no E2
  (PW1900G/1500G, GTF de fan grande) contra o motor menor do E1
  (CF34/CFM56).
- **787** — nacela com borda serrilhada (chevron) nos dois motores de
  fábrica (GEnx e Trent 1000).

## Dois erros que o próprio script pegou antes de gastar crédito

1. **Dash 8 Q400** — o gerador tratava todo motor como turbofan
  ("intake circular"), mas o Q400 é turboélice. Corrigido ramificando o
  template por `shape.prop`: hélice de seis pás (Dowty R408, mesma
  contagem do ATR72 já no jogo), sem nacela de jato.
2. **A321neo / A321LR / A321XLR** — os três têm a mesma célula e o mesmo
  diâmetro de fan nos dois motores de cada um, no próprio modelo de dados do
  jogo — visualmente idênticos. Gerar os três separados queimaria crédito
  três vezes pela mesma imagem. LR e XLR **reaproveitam o sprite do neo**
  (copiado depois da geração, não gerado de novo).

## Números

- 65 gerações (39 aeronaves, 17 delas com mais de um motor de fábrica) × 9
  créditos = 585 créditos.
- 4 arquivos copiados do A321neo para A321LR/XLR, sem custo.
- **Zero falha** — o retry reforçado do `meshy.mjs` (3 tentativas por item)
  não precisou entrar em ação nenhuma vez neste lote.

## Verificado por amostragem

Não dá pra conferir pixel a pixel as 65 — amostrei os pares de maior risco
de confusão visual antes de aprovar o lote inteiro:

- **737 NG vs MAX** — chevron e split winglet saíram nítidos, distinguíveis.
- **E175 (E1) vs E190-E2** — diferença de tamanho de nacela clara.
- **Dash 8 Q400** — hélice de seis pás, sem vestígio de motor a jato.
- **A321LR** (sprite copiado) — pintura aplicada normalmente, sem artefato
  da cópia.
- 787-9, 777-300ER, A330-900neo, CRJ1000 — renderização e ficha conferidas
  no Mercado, sem erro de console.

## Como reproduzir

```bash
python3 /caminho/para/gen_catalog.py   # extrai de aircraft.ts/engines.ts
python3 /caminho/para/build_catalog.py # monta o catalogo.json por template
export MESHY_API_KEY=msy_...
node .claude/skills/meshy-assets/scripts/meshy.mjs gen \
  assets/aircraft/lote4/catalogo.json --out public/sprites/aircraft --concurrency 8
python3 /caminho/para/apply_copy_map.py  # a21lr/a21xlr a partir do a321neo
```

Os dois scripts Python (`gen_catalog.py`, `build_catalog.py`,
`apply_copy_map.py`) foram gerados nesta sessão de trabalho, no scratchpad —
não fazem parte do repositório porque são ferramenta de uma vez, não
pipeline recorrente. `catalogo.json` é o artefato que importa e que fica
versionado.
