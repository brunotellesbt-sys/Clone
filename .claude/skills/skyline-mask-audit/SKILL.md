---
name: skyline-mask-audit
description: Como medir, em pixel, se as máscaras de setor das aeronaves do Skyline Tycoon (public/sprites/wingmasks, enginemasks, gearmasks, tailmasks, wingletmasks) estão alinhadas com a foto — em qualquer peça: asa, motor, winglet, trem de pouso, cauda, fuselagem. Use quando a tarefa for revisar, auditar, validar ou "conferir se ficou bom" qualquer setorização ou recorte de aeronave, quando o relato for de máscara desalinhada, borda fora do lugar, asa cortada antes da ponta, pintura vazando para a fuselagem, setor pegando o motor em vez da asa, ou quando alguém disser que a segmentação "está feia", "não está 100%", "tem desalinhamento" ou "tem coisa errada aí". Vale antes de commitar qualquer lote de máscara novo.
---

# Auditoria de setorização

## A foto é a régua

Julgar máscara no olho, sozinho, não escala e não pega erro pequeno: 2px numa
imagem de 1536x1024 é invisível, e foi assim que um lote inteiro passou por
"revisado" com a asa cortada em quase todos os modelos.

O que resolve é que **a foto carrega duas referências objetivas**, e as duas
saem dela sem nenhum julgamento:

- a **silhueta** — o que é avião e o que é fundo;
- o **mapa de borda** — onde estão os contornos reais das peças.

Com isso, desalinhamento vira número em pixel. E aí o número diz **onde**
olhar, e a imagem mostra **o quê**. Uma coisa não substitui a outra: a métrica
sozinha se deixa enganar, o olho sozinho não vê 2px.

## Extrair a silhueta num avião branco em fundo branco

O fundo é sólido, então distância de cor até a média dos quatro cantos separa
avião de fundo. Duas armadilhas, as duas já resolvidas em `maskcore.silhueta`:

1. **O limiar tem que ser baixo.** O avião é branco em fundo branco; o que
   marca a chapa é o sombreado, não a cor. No a320 a ponta da asa fica a 108
   de distância e a barriga a 377 — mas há trechos bem mais fracos.
2. **A sombra no chão engana o limiar.** Ela chega a 245, mais escura que a
   ponta da asa. Limiar nenhum separa as duas. O que separa é a **nitidez**:
   borda de avião marca gradiente de 0,16 a 0,93; borda de sombra fica em 0,05.
   Então, coluna a coluna, o avião acaba na última borda nítida — o que estiver
   abaixo disso é chão.

Depois disso a silhueta cola no avião: nariz, deriva, ponta da asa, pneu.

## As medidas

`diagnose.py` calcula tudo e serve para qualquer setor:

```bash
python3 .claude/skills/skyline-mask-audit/scripts/diagnose.py --all
python3 .claude/skills/skyline-mask-audit/scripts/diagnose.py --sector tailmasks --json /tmp/d.json
```

| medida | o que é | quando é defeito |
|---|---|---|
| `fora` | pixels da máscara no fundo | acima de 30px |
| `desvio` | distância média da borda útil até o contorno real | acima de ~1px, comparado com os pares |
| `aderência` | fração da borda útil colada no contorno | quanto menor, pior |
| `deslocada` | deslocamento inteiro que encaixa melhor | ganho ≥ 0,25px |
| `disputa` | pixel reivindicado por dois setores | acima de 50px |
| box-fill, fio fino | defeito grosseiro de recorte | sempre |

### Borda útil: o conceito que evita inventar defeito

Nem toda borda de setor deveria coincidir com contorno. Onde o trem encosta na
fuselagem, ou onde a asa foi cortada contra o motor, o limite é um **corte reto
atravessando chapa lisa** — não existe contorno ali e nunca vai existir. Cobrar
aderência desses trechos é fabricar defeito.

Por isso as medidas de alinhamento só olham a **borda útil**: a parte da borda
que está a até 4px de algum contorno, ou seja, que está mesmo perseguindo
alguma coisa. Confirmado no an148: a borda de cima do trem corre 8,6px longe de
qualquer contorno, aparece vermelha no laudo, e está certa — é a divisa com a
fuselagem.

### Duas correções que a medida já sofreu

Vale saber, porque são o tipo de viés que volta:

- **Folga de 2px na silhueta.** A borda real é anti-serrilhada. No pneu tocando
  o chão a silhueta corta no último contorno nítido e os 1-2px de transição
  ficavam de fora — todo trem do catálogo aparecia sangrando ~100px. Era viés
  da medida, não defeito da máscara.
- **Maioria, não média, no deslocamento.** Perto do trem há bordas paralelas
  (pneu, tampa, calço). Minimizar a distância média deixava um deslocamento
  errado encaixar numa borda vizinha, melhorando a média enquanto piorava a
  maioria dos pontos. No an148 isso tirava o contorno de cima do pneu. Agora um
  deslocamento só vale se 60% da borda útil melhorar junto.

## O laudo visual, guiado pela métrica

```bash
python3 .claude/skills/skyline-mask-audit/scripts/visual.py \
  --aid an148 --sector gearmasks --out /tmp/laudo.png --zoom 7
```

Uma folha só, com a foto esmaecida para a cor saltar:

- **borda colorida pelo desvio** — verde cola (≤1,5px), amarelo escorrega,
  vermelho está solto (>3,5px). É o que torna visível o erro de 2px;
- **magenta**: máscara fora do avião;
- **ciano**: pixel disputado por dois setores;
- **zoom guiado**: os piores pontos, recortados **pela própria métrica** e
  ampliados em NEAREST.

O zoom ser escolhido pelo número é o ponto todo: o olho vai direto onde a
medida acusou, em vez de vasculhar a imagem.

## Comparar antes e depois

O laudo escolhe os piores pontos sozinho, e eles mudam depois da correção — o
que serve para achar defeito, mas não para comparar. Para julgar um conserto, a
janela tem que ser fixa nos dois lados:

```bash
python3 .claude/skills/skyline-mask-audit/scripts/compare.py \
  --aid an148 --sector gearmasks --out /tmp/cmp.png
```

Sem `--antes`, ele usa o `.bak` que o autofix deixou.

## Ferramentas menores

- `overlay.py` — borda vermelha na foto, com `--crop` e `--zoom`. Imprime o
  mapeamento de volta (`orig_x = x0 + tela_x/zoom`), que é como se lê
  coordenada sem errar o eixo.
- `sheet.py` — prancha de contato, 4 aviões inteiros, para varrer lote.

## Vazio pode ser o resultado certo

A asa do `q400` fica vazia e está correta: naquele ângulo ela aparece quase de
perfil, inteiramente sobreposta pela nacela, e 98% do que o SAM2 acha ali já
pertence ao motor (4.366 de 4.457px). Antes de chamar vazio de defeito, compare
com o setor vizinho — se a sobreposição explica o vazio, o vazio é a resposta.

## Onde o setor tem que parar

- A **asa** termina na quebra do winglet. Aleta pequena, wingtip fence e ponta
  raked são setor de winglet, não de asa.
- **Setores não se sobrepõem.** Quem fica por cima segue a foto: trem e motor
  aparecem na frente da asa, então a asa cede. `diagnose` mede isso em
  `disputa`.
- Asa alta (ATR, Q400, An-148/158) fica **acima** da faixa da fuselagem.

## Depois de medir

Achado confirmado vai para a skill **skyline-mask-repair**, que corrige e só
aceita o conserto que melhora estas mesmas medidas.
