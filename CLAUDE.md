# Skyline Tycoon

Simulador de companhia aérea que roda inteiro no navegador — sem servidor, sem
conta, sem backend. O jogador funda a empresa, compra aeronaves, abre rotas,
define frequência e tarifa, disputa passageiro com companhias controladas por
IA e pinta a frota. Build estático publicado no GitHub Pages.

> **Estado do repositório.** A árvore foi zerada de propósito: aqui existia um
> fork do `pokemon-roulette` (Angular), sem relação com este projeto. O código
> do jogo entra depois; por enquanto o repositório carrega as skills e este
> arquivo. Não recrie nada do projeto antigo.

## Stack

React 19 + Vite 7 + TypeScript 5.9. `d3-geo` e `topojson-client` para o mapa.
Playwright em `devDependencies`, só para os scripts de verificação. Node 20+.

Sem framework de estado, sem biblioteca de UI, sem CSS-in-JS: contexto do React
em `src/store/` e um `styles.css` só. Antes de adicionar dependência, considere
que o jogo inteiro cabe num build estático — cada pacote novo custa tamanho de
bundle e uma decisão que alguém vai ter que manter.

## Fronteira que sustenta o projeto

```
src/game/     simulação pura — nenhum import de React, nunca
src/livery/   silhueta vetorial e pintura
src/ui/       telas em React
src/store/    contexto do jogo
scripts/      ferramentas de terminal (balanceamento, smoke, arte)
```

`src/game/` não importa React porque é isso que permite rodar anos de
simulação no terminal em segundos (`npm run sim`) e checar balanceamento sem
abrir navegador. Um `useState` que vaze para lá mata essa capacidade — é a
regra mais importante do repositório.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | `tsc -b` + build estático em `dist/` |
| `npm run sim -- GRU 2920` | joga sozinho 8 anos a partir de um hub e imprime a evolução financeira |
| `npm run nose -- b737 a321neo` | render da silhueta para conferir o desenho (`FULL=1` para o avião inteiro) |
| `npm run cabines` | confere as configurações de cabine |
| `npm run smoke` | abre o jogo num navegador headless e joga sozinho |
| `npm run shots` | fotos das telas para o README |

## Idioma e voz

Todo o texto do jogo, os comentários do código e as mensagens de commit são em
**português do Brasil**. Identificadores em inglês (`fuelPrice`, `loadFactor`),
prosa em português.

A voz do projeto é técnica e sem marketing: diz o que a coisa faz e o que ela
não faz. Compare — "modelo gravitacional de demanda: população, poder de
compra, atratividade turística e distância" em vez de "sistema avançado de
simulação econômica". Quando algo é aproximação de jogo e não número real,
o texto admite: `COST_TUNING` existe porque os custos reais deixariam quase
toda rota no zero a zero, e o comentário no código diz exatamente isso.

Os comentários explicam **por que**, não o quê. O código já diz o quê.

## Marcas e licenças

Designações de aeronave (A320neo, 737-800, E195-E2) e códigos de aeroporto são
fatos técnicos e podem ser usados. Companhias aéreas do jogo — a do jogador e
as concorrentes — são fictícias. Nenhum logo, pintura ou nome de companhia real
entra no jogo, e nenhuma imagem de terceiro é guardada no repositório: a arte
da Wikimedia Commons é carregada por link e creditada em
`public/aircraft/CREDITS.md`.

## Skills deste repositório

Estão em `.claude/skills/`. Cada uma cobre uma área onde errar é caro:

- **skyline-sim** — demanda, custos, divisão de mercado, tick diário, IA.
- **skyline-fleet-data** — catálogo de aeronaves, motorizações e aeroportos.
- **skyline-livery** — silhueta vetorial, pintura e arte das aeronaves.
- **meshy-assets** — geração de sprites e liveries pela API da Meshy.
- **skyline-qa** — o que rodar antes de dizer que terminou.
