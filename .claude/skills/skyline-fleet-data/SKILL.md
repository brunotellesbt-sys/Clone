---
name: skyline-fleet-data
description: Como adicionar ou corrigir aeronaves, motorizações e aeroportos no catálogo do Skyline Tycoon (src/game/data/) com ficha técnica de verdade. Use quando o pedido for incluir um modelo novo (A350, 737 MAX 10, E175-E2, Comac C919), acrescentar uma variante, corrigir alcance, envergadura, consumo, número de assentos, pista mínima ou ano de entrada, adicionar motorização, ou incluir aeroporto com IATA, pista e coordenadas. Vale para qualquer coisa descrita como catálogo, frota disponível, mercado de aeronaves, ficha técnica, specs ou "faltou tal avião no jogo".
---

# Catálogo de aeronaves, motores e aeroportos

## O que este catálogo promete ao jogador

O jogo se apresenta como tendo **variantes de verdade, não famílias
genéricas**: A319neo, A320neo, A321neo, A321LR e A321XLR são cinco aviões
diferentes, com asa, peso, alcance e motor diferentes — e no jogo também. Quem
joga simulador de companhia aérea sabe que um A321XLR abre rota que um A321neo
não abre, e percebe na hora quando o jogo trata os dois como o mesmo avião.

Essa promessa é a razão de existir do catálogo. Toda entrada nova ou é fiel
nesse nível ou enfraquece o jogo inteiro.

## Dado real e dado de jogo

Nem todo campo tem a mesma natureza, e confundir os dois é o erro mais comum:

**Vem da ficha do fabricante, e é verificável:** `range`, `speed`, `maxSeats`,
`abreast`, `runway`, `since`, e tudo em `shape` (comprimento, diâmetro de
fuselagem, altura, envergadura, diâmetro do fan).

**É número de jogo, arredondado e balanceado:** `burn`, `price`, `maint`,
`comfort`, `turn`. Estes existem para o jogo funcionar, não para despacho.
Ajustar `burn` para equilibrar uma rota é legítimo; ajustar `range` para o
mesmo fim é adulterar o dado e quebrar a promessa acima.

Quando faltar dado real, é melhor não incluir o modelo do que chutar. Um avião
a menos ninguém nota; um A330-900 com 4.000 nm de alcance, o jogador nota.

## Onde buscar

Ficha do fabricante primeiro: airbus.com, boeing.com, embraer.com,
atr-aircraft.com, mhirj.com, dehavilland.com. Quando o fabricante só publica
gráfico de carga-alcance — caso de 737 NG, 757, 767 e 747-8 — vale o valor das
Technical Characteristics arquivadas da Boeing, que é o que o resto do catálogo
já usa. Manter a mesma fonte entre modelos importa mais do que achar o número
mais exato para um deles: alcance de fontes diferentes não é comparável, e o
jogo compara o tempo todo.

Registre a fonte no comentário quando o número for discutível.

## Contrato dos campos

`AircraftType` em `src/game/data/aircraft.ts`:

| Campo | Cuidado |
|---|---|
| `id` | minúsculo e curto (`a321xlr`, `b78x`). É chave de save e de arte — **nunca renomear** um id já publicado sem migração |
| `family` | `turboprop \| regional \| narrowbody \| widebody`. Entra na conta de comprimento útil de cabine |
| `maxSeats` | limite de saídas de emergência, não densidade típica. É teto duro: nenhuma configuração fura |
| `abreast` | assentos por fileira na econômica. Deriva todas as outras classes em `cabin.ts` |
| `range` | alcance prático com carga típica, em **milhas náuticas** |
| `runway` | pista mínima em **pés** |
| `crew` | referência de 1 comissário por 50 assentos |
| `comfort` | 0,85–1,16. Entra no logit de market share, então é botão de balanceamento |
| `since` | ano de entrada no catálogo. O jogo começa num ano e libera modelo conforme a data avança |
| `engines` | ids de `engines.ts`; **o primeiro é o de série** |
| `fan` | diâmetro do fan em metros — define o tamanho da nacela no desenho |
| `shape` | dimensões reais; é daqui que a silhueta é gerada |

`Engine` em `engines.ts` guarda **multiplicadores relativos**, não absolutos:
`burn`, `maint`, `price`, `range`, `runway` multiplicam a ficha do modelo em
`withEngine` (`spec.ts`). Um motor com `burn: 0.97` gasta 3% menos que a
referência daquele avião. Duas consequências: um valor que pareça inofensivo
(`range: 1.08`) muda o alcance de todos os modelos que oferecem aquele motor; e
`since` do motor manda no `since` efetivo (`Math.max` dos dois).

As diferenças entre motorizações devem seguir o que se sabe da operação — o GTF
mais silencioso e um pouco mais econômico, mas com histórico de oficina cheia;
o LEAP gastando um pouquinho mais e incomodando menos; empuxo maior comprando
pista curta e alcance e cobrando em combustível e revisão. Motor que só melhora
tudo não é escolha, é upgrade, e mata a decisão de compra.

Aeroportos em `airports.ts` precisam de IATA, nome oficial, país, coordenadas
reais (o mapa e a distância dependem delas), comprimento de pista, `tier` de
porte, `slots`, e os fatores de mercado `pop`, `gdp`, `tour`. Coordenada errada
não dá erro — só produz uma rota com distância absurda que ninguém entende.

## Depois de mexer, confira

Nesta ordem, porque cada passo revela um tipo diferente de erro:

```bash
npm run cabines                  # a cabine fecha? o limite de saídas é respeitado?
npm run nose -- <id>             # a silhueta saiu com cara do avião certo?
npm run sim -- GRU 1460          # o modelo novo desequilibrou a economia?
```

Um modelo novo bom aparece no `sim` sendo escolhido em algumas rotas — não em
todas. Se a estratégia burra do `sim` passa a comprar só ele, os números de jogo
(`burn`, `price`, `maint`) estão generosos demais; se ele nunca aparece, está
caro demais para o que entrega.

Checklist antes de dar por pronto:

- [ ] Todo campo de `shape` preenchido com dimensão real do fabricante.
- [ ] `range` da mesma família de fonte que o resto do catálogo.
- [ ] `since` coerente com o motor (`Math.max` não vai te surpreender depois).
- [ ] Ao menos uma motorização listada, a de série em primeiro.
- [ ] `maxSeats` é o certificado, não o típico.
- [ ] `npm run cabines` sem estouro de comprimento de cabine.
- [ ] `npm run nose -- <id>` com silhueta reconhecível.
- [ ] `npm run sim` sem virar o balanceamento de cabeça para baixo.

## Marcas

Designação de aeronave e código de aeroporto são fatos técnicos e entram sem
problema. O que não entra: pintura, logo ou nome de companhia aérea real, em
qualquer campo ou asset. As companhias do jogo são fictícias — inclusive as
concorrentes, cujos nomes saem de `data/names.ts`.
