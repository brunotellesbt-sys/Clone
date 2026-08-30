---
name: skyline-sim
description: Como mexer na simulação do Skyline Tycoon — demanda, custos de voo, divisão de mercado, tarifas, tick diário, empréstimos e companhias concorrentes — sem quebrar o balanceamento. Use sempre que a tarefa tocar em src/game/ (demand.ts, economy.ts, engine.ts, ai.ts, cabin.ts), ou quando o pedido for sobre rota dar ou não lucro, load factor, market share, elasticidade, preço de combustível, dificuldade, "o jogo está fácil demais", "está impossível ganhar dinheiro", ajustar números, adicionar um custo novo, mudar como a IA reage. Vale também para qualquer coisa descrita como economia, balanceamento ou dificuldade do jogo, mesmo sem citar arquivo.
---

# Simulação do Skyline Tycoon

## Por que este cuidado todo

A economia do jogo é uma cadeia de multiplicações. Um número mexido no meio
dela não erra sozinho: ele reaparece somado ao longo de 2.920 dias de partida,
em 70 rotas, contra 12 concorrentes. Uma mudança que parece inofensiva —
subir 10% um custo — pode transformar um jogo apertado num jogo onde nenhuma
rota fecha, e isso só aparece no ano 4.

Por isso a regra central: **nenhum número da simulação muda sem rodar
`npm run sim` antes e depois e comparar.** Não é burocracia; é o único jeito de
ver o efeito, porque ele não é visível lendo o diff.

## A cadeia, em ordem

Vale entender o caminho de um passageiro antes de mexer em qualquer ponta:

1. **`demand.ts` — quanta gente quer voar.** Modelo gravitacional: massa
   populacional das duas pontas (`sqrt(popA*popB)`), poder de compra, turismo,
   decaimento por distância, bônus doméstico, sazonalidade por hemisfério,
   ruído fixo por par e dia da semana. Sai `MarketDemand` com `pax` por classe
   e uma `refFare` de referência. Nada aqui sabe que você existe — é o mercado.

2. **`economy.ts` / `allocateMarket` — quem leva esses passageiros.** Modelo
   logit por classe: `freq^freqExp * fareMult^priceExp * quality`. A econômica
   é muito mais sensível a preço (`-2.1`) que a executiva (`-1.0`); frequência
   pesa mais nas classes da frente. Quem enche o avião derrama demanda, e 55%
   do que sobra é reoferecido a quem ainda tem assento.

3. **`economy.ts` / `flightCost` — quanto custa levar.** Combustível (com
   penalidade por etapa longa carregando o próprio combustível), tripulação
   (reforçada acima de 7h), manutenção que encarece com a idade, taxas por
   porte de aeroporto, handling, comissariado por classe.

4. **`engine.ts` / `advanceDay` — o dia acontece.** Junta tudo, aplica
   `SELLABLE`, tira `DISTRIBUTION_RATE` da receita, paga custo fixo, envelhece
   a frota, roda a IA, grava no `ledger`.

## Os números que governam tudo

Antes de inventar uma constante nova, veja se um destes já é a alavanca certa:

| Constante | Onde | O que faz de verdade |
|---|---|---|
| `K = 1750` | `demand.ts` | escala global da demanda. Mexer aqui move **todas** as rotas juntas — é o botão certo quando o jogo inteiro está fácil ou difícil, e o errado quando o problema é só um segmento |
| `decay` (`dist/700`, expoente `1.35`) | `demand.ts` | decide se longo curso vale a pena. Achatar favorece widebody; endurecer transforma o jogo num jogo de regional |
| `priceElasticity` (`^-0.9`) | `demand.ts` | quanto o mercado encolhe quando todo mundo cobra caro |
| `priceExp` / `freqExp` | `economy.ts` | como o mercado se reparte. É aqui que se decide se guerra de preço ou guerra de frequência ganha |
| `COST_TUNING = 0.82` | `economy.ts` | desconto declarado sobre o custo real, porque a conta real deixa quase toda rota no zero a zero |
| `SELLABLE = 0.9` | `economy.ts` | teto de load factor na prática |
| `DISTRIBUTION_RATE = 0.085` | `economy.ts` | comissão sobre a receita |
| `marketPrice` (`price * 0.45`) | `economy.ts` | ninguém paga preço de tabela; governa o ritmo de expansão da frota |
| `START_CASH`, `HQ_DAILY_BASE` | `engine.ts` | quão apertado é o começo |

Preferir ajustar uma destas a espalhar fatores novos pelo código: quem vier
depois precisa achar a alavanca, e cinco multiplicadores anônimos escondem
onde ela está.

## O laço de trabalho

```bash
npm run sim -- GRU 2920 > /tmp/antes.txt    # baseline, antes de tocar em nada
# ... mudança ...
npm run sim -- GRU 2920 > /tmp/depois.txt
diff /tmp/antes.txt /tmp/depois.txt
```

Um hub só engana. A mesma mudança se comporta diferente conforme o mercado ao
redor, então confira pelo menos três perfis antes de concluir:

```bash
for hub in GRU JFK SIN; do npm run sim -- $hub 1460; done
```

- **GRU** — mercado doméstico grande, muita etapa média.
- **JFK** — concorrência pesada e longo curso.
- **SIN** — quase tudo internacional, poucos pares curtos.

O `sim` imprime, a cada 180 dias: caixa, patrimônio, tamanho da frota, rotas,
lucro por dia, load factor, reputação e preço do combustível. É a régua.

## Como fica um jogo saudável

Não são metas rígidas — são a faixa em que o jogo se comporta como jogo. Fora
dela, alguma coisa está errada mesmo que o código esteja certo:

- **Load factor** estabiliza entre **0,72 e 0,86**. Acima de 0,9 a demanda está
  frouxa e não existe decisão a tomar; abaixo de 0,6 nenhuma rota fecha conta.
- **Margem** da rota exemplo entre **8% e 22%**. Margem de 40% quer dizer que o
  jogador não precisa escolher nada.
- **Crescimento** do patrimônio positivo mas não explosivo: multiplicar o
  capital inicial por mais de ~40× em 8 anos é sinal de economia quebrada.
- **Falir é possível** jogando mal, e o `sim` usa uma estratégia burra de
  propósito: se a estratégia burra fica bilionária, o jogo não tem desafio.
- **Concorrentes relevantes**: no ranking de 30 dias, o jogador não deve estar
  10× à frente do primeiro rival no ano 2.

Quando o resultado sair fora da faixa, diga o número no relato — "LF subiu de
0,79 para 0,93 em GRU" vale mais que "ficou mais fácil".

## Invariantes que não se negociam

- **`src/game/` não importa React.** É o que permite rodar a simulação no
  terminal. Se precisar de estado de UI, ele mora em `src/store/` ou na tela.
- **Determinismo.** O acaso vem de `rng.ts` semeado e de `hashStr` sobre a
  chave do par O&D. Nada de `Math.random()` no caminho da simulação: o mesmo
  seed tem que reproduzir a mesma partida, senão o `sim` não serve de régua e
  o save vira mentira.
- **O tick é a fonte da verdade.** A UI lê o que `advanceDay` gravou; ela não
  recalcula economia para exibir. Duas contas do mesmo número divergem.
- **Save versionado.** `GameState.version` e `Livery.v` existem para migrar.
  Mudou o formato de algo persistido, escreva a migração em `save.ts` na mesma
  mudança — save quebrado é bug que o jogador não consegue contornar.
- **`estimateRoute` precisa continuar honesto.** É a previsão que a UI mostra
  antes de abrir rota. Se ela usar regra diferente do tick, o jogador aprende
  a desconfiar da própria tela.

## Mexendo na IA (`ai.ts`)

As concorrentes não simulam frota avião a avião — carregam `routes` agregadas
com assentos, frequência, tarifa e qualidade, e reagem via `aggression`. Isso é
proposital: 12 companhias com simulação completa custaria o tempo do tick.

Ao mudar a reação delas, o alvo é que o jogador **sinta** a resposta em poucos
dias (corte de preço, frequência a mais numa rota que ele acabou de tomar) sem
que elas entrem em espiral de preço até zero. Se o `sim` mostrar receita dos
rivais despencando de forma monotônica, a realimentação ficou instável.

## Armadilhas conhecidas

- Ajustar demanda para consertar um problema de custo. Se o sintoma é margem,
  o remédio está em `flightCost`, não em `K` — mexer em `K` conserta a margem e
  quebra o load factor junto.
- Somar um custo novo por fora do `COST_TUNING`: ele passa a escapar do único
  botão que calibra o conjunto.
- Esquecer que `withEngine` é memoizado (`spec.ts`). Campo novo que dependa de
  motorização precisa entrar lá, senão fica com o valor do modelo cru.
- Mudar `maxDailyFrequency` sem olhar `routeCapacityLimit`: as duas juntas
  decidem quantos assentos existem, e desencontradas produzem rota que aceita
  frequência que o avião não cumpre.
