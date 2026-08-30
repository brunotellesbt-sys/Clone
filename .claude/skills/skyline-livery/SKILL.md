---
name: skyline-livery
description: Como desenhar a silhueta vetorial das aeronaves e o sistema de pintura do Skyline Tycoon (src/livery/ — silhouette.ts, LiveryPlane.tsx, AircraftArt.tsx, measure.ts, presets.ts). Use quando a tarefa envolver o desenho do avião, contorno saindo errado, asa atravessando a fuselagem, cabine de comando, nacela, winglet, deriva, faixa da fuselagem, letreiro, editor de pintura, presets de livery, arte vinda da Wikimedia Commons, manifest.json ou o recorte/enquadramento das imagens. Vale para qualquer relato do tipo "o avião ficou estranho", "a pintura vazou", "a faixa está no lugar errado" ou "o nariz está apontando para o lado contrário".
---

# Silhueta e pintura

## Duas fontes de desenho

Cada modelo é desenhado por um de dois caminhos, e é preciso saber qual antes
de investigar qualquer defeito:

1. **Perfil lateral livre da Wikimedia Commons**, quando existe. Carregado por
   link direto, nunca guardado no repositório. Hoje isso cobre **dois modelos**:
   ATR 72 e A380, ambos de Olivier Cleynen em CC0, fixados em
   `aircraft-art.json`.
2. **Desenho vetorial próprio** (`silhouette.ts`), para todo o resto — gerado a
   partir das dimensões reais do modelo.

A varredura automática da Commons vem **desligada de propósito**. Uma busca por
"perfil lateral de avião comercial em licença livre" devolve quase só foto (com
a pintura de uma companhia real), gráfico sobre a aeronave, ícone de vista
superior ou render em 3/4 — nada serve de base de pintura. Se for reativar
(`npm run art -- --auto`), confira arquivo por arquivo antes de publicar.

## A regra que resolve o contorno

O defeito clássico de avião desenhado por partes é o traço aparecendo por
dentro: a asa cruzando a fuselagem, a raiz da deriva riscando o cone de cauda.
A solução aqui é uma regra só:

> **Toda peça que sai do corpo tem a raiz enterrada dentro dele, e o corpo é
> pintado por cima.**

A deriva, o estabilizador e o filete dorsal nascem dentro do cone de cauda; a
raiz da asa some na carenagem. Onde a asa precisa passar à frente da fuselagem
— como numa foto de perfil — o preenchimento passa, mas o traço é apagado por
máscara. O resultado é um contorno externo só, como num desenho técnico.

Ao acrescentar uma peça nova (uma segunda janela de emergência, um sensor, uma
antena), siga a mesma regra: estenda a raiz para dentro do corpo em vez de
encostar a peça na borda. Encostar dá emenda visível em algum modelo — talvez
não no que você testou, mas em algum dos 47.

## Cabine de comando

Montada como num avião de verdade: a **linha do dorso é amostrada** e o
envidraçamento pousa nela, então o para-brisa fica colado ao teto em qualquer
modelo, sem ajuste manual por avião. São três vidros — para-brisa muito deitado
para trás, corrediça no meio, janelinha traseira fechando em cunha — com
montantes, reflexo e limpadores.

A estação e a proporção saem das medidas reais de cada família: no 737 o
para-brisa começa a 3 m do bico e a última janela acaba a 6,3 m; no 747 a cabine
sobe com o nariz até o convés superior; no A380 fica entre os dois conveses.

`cockpit.xEnd` marca onde o envidraçamento termina — **a cabine de passageiros
e a porta 1 só começam a partir dali**. Mexer nas estações sem respeitar isso
produz janela de passageiro dentro do cockpit.

## Conferindo o desenho

Olho no render, sempre. Descrição de geometria em prosa engana:

```bash
npm run nose -- b737 a321neo b789 atr72    # gera /tmp/nose.png
FULL=1 npm run nose -- b748 a388           # o avião inteiro
```

Ao mexer em `silhouette.ts`, confira pelo menos um modelo de cada arquétipo,
porque a geometria é paramétrica e o que conserta um quebra outro:

- narrowbody de asa baixa e motor na asa (`b737`, `a320neo`)
- widebody grande (`b789`, `b77w`)
- regional de cauda em T e motor na traseira (`e190`, `crj900`)
- turboélice de asa alta (`atr72`, `dh8d`)
- convés duplo / hump (`a388`, `b748`)

## Pintura por peça

A pintura é montada peça por peça, não como faixas atravessando o avião: cada
parte tem a sua própria cor — fuselagem e barriga (com altura ajustável do
encontro), radome, faixa (com desenho, duas cores, altura e espessura), deriva
e seu desenho, estabilizador, asa, winglet, nacela, aro do bocal, trem de
pouso, letreiro (cor, tipografia, tamanho, posição), matrícula, janelas e
contorno de porta.

Isso é o que separa uma livery montável de um filtro de cor. Ao acrescentar um
estilo novo de faixa ou de deriva, o teste é: ele continua fazendo sentido num
ATR 72 e num A380? Estilo que só fica bom em narrowbody vira defeito visível
em metade da frota.

`Livery` é versionada (`v: 2`) e `LiveryV1` existe só para migrar saves
antigos. Campo novo precisa de valor padrão na migração, senão o save de quem
já joga abre com a pintura quebrada.

## Arte da Commons e medição

O jogo **mede a imagem no navegador** (`measure.ts`): rasteriza uma vez, acha o
recorte do avião pelo canal alfa e deduz a faixa da fuselagem, o retângulo da
deriva e onde cabe o letreiro. Corrige o enquadramento e **espelha o desenho se
o nariz vier apontado para o outro lado**. Por isso imagem nova normalmente não
precisa de ajuste manual.

Quando precisar, o bloco em `aircraft-art.json` aceita `regions` em fração de
0 a 1: `box` corta cota e legenda do desenho técnico, `fuselage` diz onde vai a
faixa, `tail` delimita a deriva, `titles` posiciona o letreiro. O ATR 72 traz um
exemplo pronto.

Ao fixar arte nova, o bloco precisa de `url`, `w`, `h`, `author`, `license` e
`source`. Só entram **domínio público ou Creative Commons** — e fotografia de
avião pintado não serve, porque carrega a marca de uma companhia real. O
crédito exigido pela licença sai em `public/aircraft/CREDITS.md` e embaixo do
avião no editor; se o crédito não aparecer, a licença está sendo descumprida.

Nenhuma imagem de terceiros é guardada neste repositório. `scripts/art.mjs`
roda no `prebuild` e grava só as URLs em `public/aircraft/manifest.json` — e o
`prebuild` tolera falha de rede de propósito, caindo para os desenhos
vetoriais, para que o build do GitHub Actions não quebre quando a Commons
estiver fora.
