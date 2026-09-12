---
name: skyline-setor
description: O gerador oficial das máscaras de setor do Skyline Tycoon — silhueta com BiRefNet, peça com SAM 2.1 ou Grounded SAM 2, acabamento com ViTMatte, e um juiz que mede na FOTO, não em outra máscara. Use sempre que for cortar, refazer ou conferir qualquer setor de pintura de aeronave (motor, capô, asa, deriva, trem, hélice, fuselagem, janela, winglet), quando aparecer BiRefNet, ViTMatte, SAM 2.1, Grounded SAM 2, planemasks, enginemasks ou qualquer pasta *masks, e quando o pedido for "setoriza", "recorta a peça", "refaz a máscara", "pixel por pixel" ou "a pintura está vazando".
---

# Gerador de setor — Skyline Tycoon

Este é **o** caminho para produzir máscara de setor. Não há outro. Se uma máscara
não saiu daqui, ela não foi medida e não deve entrar no jogo.

## Por que existe

As máscaras antigas foram cortadas com semente ruim e conferidas contra **outras
máscaras**. Isso é circular: `windowmasks` e `enginemasks` foram cortadas como
partição disjunta, então "motor ∩ janela" dá zero por construção — inclusive na
aeronave em que o motor cobre meia fileira de janela na tela. Foi assim que
defeito visível passou por portão "zerado".

**Toda conferência aqui sai da foto.** A janela é achada na imagem (retângulo
escuro sobre chapa clara); o escape é achado pela luminância; a borda é medida em
pixel de transição. Pode errar — mas erra do lado de fora do sistema julgado.

## O fluxo, em quatro passos

```
1. silhueta.py    BiRefNet       ->  planemasks/<sprite>.png   (alpha suave, 8 bits)
2. peca.py        SAM 2.1        ->  candidato A
                  Grounded SAM 2 ->  candidato B
3. acabar.py      ViTMatte       ->  A' e B' com borda suave
4. juiz.py        medido na foto ->  tabela; o humano escolhe olhando a ficha
```

Cada passo é um script isolado, roda em CPU e não custa nada. Peso de modelo fica
em `$HF_HOME` (fora do repositório); a silhueta e as peças aprovadas entram em
`public/sprites/`.

### Papel de cada modelo — não troque

| modelo | serve para | **não** serve para |
|---|---|---|
| **BiRefNet** | silhueta do avião inteiro, com alpha suave | recortar peça |
| **SAM 2.1 Hiera-L** | recortar peça a partir de caixa e pontos | achar a peça sozinho |
| **Grounded SAM 2** | segunda opinião, semente vinda de texto | titular — falha em turboélice |
| **ViTMatte** | acabamento: borda dura vira alpha suave | corrigir forma errada |

O ViTMatte **propaga o erro que recebe**: medido no ATR 72, refinou uma máscara
que cobria janela e devolveu 528 px ainda sobre janela. Refinador, nunca
recortador.

O Grounded SAM 2 acertou os dois jatos testados e **falhou nas duas rodadas no
turboélice** (pegou a hélice em vez da nacela; depois devolveu 15 px). Não é
azar: o texto não ancora nessa arte. Por isso ele é segunda opinião e o juiz
decide, não o modelo.

## O que é pintável em cada peça

A máscara não é "a peça"; é **onde a companhia pinta num avião de verdade**.
Errar isso foi o defeito mais caro até hoje — a máscara pegava a nacela inteira,
incluindo reversor e cone de escape, que saem de fábrica em metal e nunca
recebem a pintura da companhia.

| peça | turbofan | turboélice |
|---|---|---|
| **motor** | só o **bico de entrada + capô do fan**, até a divisa de painel do reversor | **a nacela inteira** — não há reversor exposto, e a livery cobre tudo |

A divisa do capô **não é fração fixa**. Medido: 0,61 do comprimento da nacela no
737, 0,76 no An-148. Motores diferentes (CFM56, LEAP, PW1000G, D-436) têm capô de
proporção diferente. `peca.py` procura a **linha de painel** na foto e só cai na
fração quando não acha nenhuma.

Demais peças: ver `pecas.py`, que é a lista de dados — um lugar só, e o script
não decide nada por conta.

## Como rodar

```bash
export HF_HOME=<scratchpad>/hf            # peso de modelo fora do repositório

# 1. silhueta de todos os sprites (demorado; rode em segundo plano)
python3 scripts/silhueta.py --todos

# 2+3+4. uma peça de uma aeronave, pelos dois caminhos, com ficha e medida
python3 scripts/setor.py b737 motor
```

`setor.py` imprime a tabela do juiz e grava `ficha_<id>_<peca>.png` — é essa
imagem que vai para o humano decidir. **Nada entra em `public/sprites/` sem esse
aval**: `setor.py --aprovar <metodo>` é o que copia.

## Regras que não se negociam

1. **Conferência sai da foto.** Comparar máscara com máscara não conta como medida.
2. **Uma peça por vez, com ficha, e aprovação humana.** Lote sem revisão já
   produziu 16 winglets aprovados pelo portão e 0 corretos ao zoom.
3. **Alpha de 8 bits, nunca 1 bit.** Máscara binária na resolução do sprite dá
   escadinha, e nenhum modelo conserta isso — é representação, não segmentação.
4. **O que o modelo entrega é candidato.** O juiz mede, o humano escolhe.
5. **Nunca alargar a máscara para "cobrir sobra".** Sobra entre setores se resolve
   fechando a partição (`fechar.py`), não inchando peça.

## Limite conhecido

Winglet e estabilizador horizontal **não são separáveis em vista lateral pura** —
ficam dentro da silhueta da fuselagem e não existe fronteira na imagem. Nenhum
modelo resolve. Saída: vetor por cima, ou render em 3/4. Ver `pontas.md` na skill
`skyline-mask-repair`.
