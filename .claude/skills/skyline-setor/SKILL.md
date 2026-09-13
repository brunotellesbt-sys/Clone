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
| **motor** | o **barril de entrada + capô do fan**, do fim do lábio até a divisa de painel do reversor | **a nacela inteira** — não há reversor exposto, e a livery cobre tudo |

A divisa do capô **não é fração fixa**. Medido: 0,61 do comprimento da nacela no
737, 0,76 no An-148. Motores diferentes (CFM56, LEAP, PW1000G, D-436) têm capô de
proporção diferente. `peca.py` procura a **linha de painel** na foto e só cai na
fração quando não acha nenhuma.

### O capô não se pede ao SAM: mede-se

Pedir ao SAM que ache o capô erra sempre, e erra do mesmo jeito. Entre o barril
de entrada e o capô do ventilador há uma linha de painel, e para o modelo aquilo
é **borda de objeto**: ele para ali. O barril branco da frente — chapa que a
companhia pinta — ficava de fora de toda tentativa, e nenhum ajuste de semente
trouxe de volta.

A peça é **o que está entre limites medidos**, cada um de uma fonte:

```
frente   junta que fecha o crescente do lábio   conferir.fim_do_labio
trás     divisa de painel do reversor           peca.linha_de_painel
baixo    última chapa antes do fundo branco     conferir.chao_da_foto
contorno de cima                                SAM 2.1
```

Duas armadilhas medidas no b737, ambas de medir máscara contra máscara:

- **O lábio acaba onde o crescente acaba, não no último pixel escuro.** O
  crescente vai de x=518 a x=528; em x=561 há outra coluna escura, que é a junta
  de painel. Cortar nela custa 40 colunas de chapa pintável.
- **O pé não se mede contra a silhueta.** Na coluna x=600 a chapa desce até
  y=652 e o BiRefNet para em y=640: a barriga em sombra contra fundo claro é
  onde todo modelo de recorte hesita. Mede-se na foto.

E 2 px de recuo na junta dianteira, senão a rampa de alpha do ViTMatte cai em
cima do crescente e a pintura invade a boca.

Demais peças: ver `pecas.py`, que é a lista de dados — um lugar só, e o script
não decide nada por conta.

## Como rodar

```bash
export HF_HOME=<scratchpad>/hf            # peso de modelo fora do repositório

# 1. silhueta de todos os sprites (demorado; rode em segundo plano)
#    sem --gravar ela fica só na saída de trabalho e o repositório não muda
python3 scripts/silhueta.py --todos --gravar

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
   achando o limite que falta na foto, não inchando peça.
6. **O juiz mede, não conserta.** Quando reprova, troca-se a semente ou o limite e
   recorta-se de novo. Morfologia em cima de máscara boa produz retalho quadrado
   no meio da chapa e borda em degrau — e foi aprovada por testes que não mediam
   nem furo nem degrau. `buraco` e `degrau` existem por causa disso.

## Limite conhecido

Winglet e estabilizador horizontal **não são separáveis em vista lateral pura** —
ficam dentro da silhueta da fuselagem e não existe fronteira na imagem. Nenhum
modelo resolve. Saída: vetor por cima, ou render em 3/4. Ver `pontas.md` na skill
`skyline-mask-repair`.
