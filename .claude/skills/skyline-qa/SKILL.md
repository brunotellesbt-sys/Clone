---
name: skyline-qa
description: O que rodar no Skyline Tycoon antes de dizer que uma mudança está pronta — tsc, build, simulação de balanceamento, smoke test em navegador headless e capturas de tela. Use ao terminar qualquer alteração no jogo, antes de commitar ou abrir PR, quando a tarefa pedir para testar, verificar, validar ou conferir se algo funciona, quando o build ou o smoke falhar, ou quando for preciso decidir se uma mudança está mesmo terminada. Vale também para investigar erro que só aparece rodando o jogo.
---

# Verificação antes de entregar

## Por que não basta compilar

O jogo tem três modos de falhar, e cada um escapa dos outros dois:

1. **Não compila** — `tsc` pega.
2. **Compila e quebra na tela** — só aparece rodando: um `undefined` num
   `.map()`, um seletor que sumiu, um estado que não existe no save antigo.
3. **Compila, roda, e a economia ficou sem sentido** — nada acusa. O jogo abre
   normalmente e só depois de horas de partida o jogador percebe que nenhuma
   rota fecha conta.

Por isso a verificação tem três camadas. Pular a terceira é o erro mais fácil
de cometer, porque as duas primeiras passam verdes e dão a sensação de pronto.

## A sequência

```bash
npm run build     # tsc -b + vite build. Nao passou daqui, nada mais importa
npm run smoke     # funda companhia, compra aviao, abre rota, roda o tempo
npm run sim -- GRU 1460
```

O `smoke` sobe o `dist/` num servidor local, abre no Chromium headless e
**joga**: funda a companhia, compra um E190, abre uma rota para Recife, aloca o
avião, sobe a frequência, acelera o tempo, passa por pintura, finanças e
ranking, e tira screenshot de cada etapa em `/tmp/shot-*.png`. No fim imprime o
estado lido do `localStorage` e os erros de console.

**Erro de console conta como falha.** O jogo não tem servidor nem telemetria:
um `Cannot read properties of undefined` que ninguém vê no terminal é
exatamente o que o jogador vai encontrar. A lista tem que sair vazia.

Se o `smoke` não achar um botão, olhe os screenshots antes de mexer no seletor
— quase sempre a tela mudou de verdade e o teste está certo em reclamar.

## Neste ambiente

O Chromium já está instalado e o `smoke` aponta para ele
(`executablePath: '/opt/pw-browsers/chromium'`). **Não rode
`playwright install`** — o download é desnecessário e costuma estourar a cota
de disco da sessão.

## Quando cada camada é obrigatória

| Mudou o quê | Build | Smoke | Sim |
|---|---|---|---|
| Texto, rótulo, CSS | sim | — | — |
| Tela ou componente | sim | sim | — |
| `src/game/` (qualquer arquivo) | sim | sim | **sim** |
| Catálogo de aeronaves ou aeroportos | sim | — | sim, mais `npm run cabines` |
| `src/livery/` | sim | sim | — mas confira `npm run nose` |
| Formato de save | sim | sim | sim, e **abra um save antigo** |

Save é o caso que mais dói e o menos testado: quem já joga tem partida no
`localStorage`, e uma migração faltando apaga o progresso de alguém. Ao mudar
`GameState.version` ou `Livery.v`, carregue um save da versão anterior e veja
se ele abre.

## O que relatar

Diga o que rodou e o que saiu, com número. "Build passou, smoke sem erro de
console, sim em GRU com LF 0,81 e lucro/dia de US$ 240 mil no ano 4" é um
relato verificável. "Testei e está funcionando" não diz se a economia
sobreviveu.

Quando algo falhar e você não consertar, diga qual camada falhou e o texto do
erro — nunca entregue silenciosamente com uma camada vermelha. E se pulou uma
camada por algum motivo, diga que pulou e por quê; a tabela acima existe
justamente para que a decisão de pular seja explícita.

## Capturas para o README

`npm run shots` regera as imagens de `docs/`. Vale quando a mudança altera
visivelmente uma tela que aparece no README — as imagens envelhecem sem avisar
e um README com print de uma tela que não existe mais confunde quem chega.
