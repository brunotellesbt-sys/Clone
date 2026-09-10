---
name: skyline-mask-repair
description: Como corrigir desalinhamento e defeito de máscara de setor de aeronave do Skyline Tycoon, em qualquer peça — asa, motor, winglet, trem de pouso, cauda, fuselagem. Cobre correção automática medida (aparar sangramento, soltar pixel disputado, deslocar 1-3px, encaixar a borda no contorno) e recorte manual com SAM2 large quando a máscara está na peça errada. Use quando o pedido for "conserta a máscara", "corrige o desalinhamento", "refaz essa asa", "setoriza direito", "pixel por pixel", ou quando aparecer SAM2, sam2.1_hiera_large, segmentação, recorte por caixa e ponto, wingmasks, enginemasks, gearmasks, tailmasks ou wingletmasks.
---

# Correção de máscara

## Corrigir é medir duas vezes

Todo conserto aqui é medido antes e depois, com a mesma função que a auditoria
usa (`maskcore.medir`). O que não melhora é revertido. É isso que permite rodar
no catálogo inteiro sem revisar 220 máscaras à mão — e é isso que separa
"corrigir" de "mexer".

O critério de aceite está em `maskcore.melhor_que`:

- **sangramento não tem folga**: se a máscara passa a invadir o fundo, o
  conserto é recusado, por melhor que fique a aderência;
- não pode aumentar pixel disputado com o vizinho;
- tem que aproximar a borda do contorno (ou reduzir sangramento).

Antes de escrever, grava `<mask>.png.bak` — e `.gitignore` já ignora esses.

## O laço que funciona

```bash
# 1. medir
python3 .claude/skills/skyline-mask-audit/scripts/diagnose.py --all

# 2. ver o que seria mexido, sem mexer
python3 .claude/skills/skyline-mask-repair/scripts/autofix.py --all --dry-run

# 3. corrigir
python3 .claude/skills/skyline-mask-repair/scripts/autofix.py --all

# 4. conferir no olho, janela fixa, antes e depois
python3 .claude/skills/skyline-mask-audit/scripts/compare.py \
  --aid an148 --sector gearmasks --out /tmp/cmp.png
```

O passo 4 não é opcional. Melhora de métrica pode ser métrica sendo enganada —
já aconteceu nesta pipeline, ver abaixo.

## Os quatro consertos automáticos

Rodam nessa ordem, do mais seguro para o mais delicado, cada um medido:

**`aparar`** — corta o que caiu fora da silhueta. Erro objetivo, conserto
trivial.

**`soltar`** — devolve ao vizinho o pixel que dois setores disputam. A ordem de
prioridade segue o que se vê na foto: trem e motor aparecem na frente da asa,
então a asa cede. Um setor de prioridade alta nunca cede — o conserto sai no
setor de baixo.

**`deslocar`** — aplica o deslocamento inteiro medido, para erro de 1 a 3px.
Só entra se **60% da borda útil melhorar junto** (ver a armadilha abaixo).

**`encaixar`** — puxa a borda para cima do contorno real, ponto a ponto. É o
conserto que resolve desalinhamento que não é translação rígida. Trata a
máscara como curva de nível: mede, em cada ponto da borda, quanto ela precisa
andar na direção da normal para cair no contorno mais forte, e desloca a curva
inteira por esse campo, suavizado. Suavizar importa porque ponto isolado erra e
o conjunto da borda acerta. Onde não há contorno por perto — divisa com o setor
vizinho, corte reto na chapa lisa — o deslocamento é zero e a borda fica onde
está.

## A armadilha que custou caro: métrica enganada

No `an148/gearmasks` o `deslocar` propôs descer 2px. A medida aprovou com
folga: desvio de 0,68px para 0,34px, aderência de 85% para 94%. **E estava
errado.** O `compare.py` mostrou o contorno saindo de cima do pneu e magenta
aparecendo embaixo — a máscara tinha passado a vazar para fora do avião.

Aconteceu porque perto do trem há bordas paralelas (pneu, tampa, calço) e o
deslocamento encaixou numa borda vizinha errada, melhorando a **média**
enquanto piorava a maioria dos pontos.

Duas travas saíram disso, as duas já no código:

1. deslocamento só vale se a maioria da borda útil (60%) melhorar junto;
2. qualquer aumento de sangramento recusa o conserto, sem folga.

A lição que fica: **a métrica escolhe onde mexer, o olho confirma se mexeu
certo.** Uma sem a outra erra.

## Setor derivado: não se remenda, se regenera

Quatro setores saem de geometria e não precisam de SAM2 nenhum:

```bash
python3 .claude/skills/skyline-mask-repair/scripts/derive_sectors.py --all
```

- **fuselagem** = silhueta menos todas as peças. A asa corta a fuselagem em
  frente e trás na vista lateral, então os dois pedaços contam — ficar só com o
  maior perderia metade do corpo.

  **Este é o único setor que o jogo não consome, e de propósito.** A arte já
  pinta a fuselagem como retângulo recortado pela silhueta inteira, com as peças
  por cima; recortá-lo por `fuselagemasks` não mudaria nada de visível e abriria
  um anel de foto crua na divisa de cada peça, porque a derivação subtrai as
  peças **dilatadas em 1px**. Medido nas 55: de 1,4% a 2,2% da silhueta ficaria
  sem tinta, 4.706px no `e175`. O setor serve para medir e para o `derive`, não
  para pintar.
- **cabine de comando** = o preto do nariz. As vidraças são quase pretas
  (luminância 2 no a320); o contorno da porta dianteira, que cai na mesma
  faixa, é bem mais claro. Daí o limiar apertado e o descarte de componente
  fino: janela é chapa, contorno de porta é fio.
- **bordo de ataque, dorso e bordo de fuga** = faixas de 18%/64%/18% da corda
  da própria asa. A envergadura sai de uma PCA dos pixels da asa e a corda é a
  perpendicular; a normalização é **estação por estação**, porque a asa afina
  da raiz para a ponta e uma fração global daria bordo grosso na raiz e fino na
  ponta.

Sobre a orientação da corda, o que a medida mostrou: nestas fotos a asa está
encurtada e o eixo da corda sai quase vertical em todos os modelos (componente
horizontal de 0,06 no atr72 a 0,24 no b748). Ou seja, **o bordo de ataque é a
aresta de cima da asa** e o de fuga a de baixo — que é o que se vê de uma asa
fotografada um pouco por cima.

Por serem derivados, esses quatro ficam de fora do `autofix`: quando o pai
muda, rode o `derive_sectors.py` de novo. Remendar um derivado só faria ele
divergir da peça de que saiu.

## Dois defeitos que só aparecem pintado

Nenhum dos dois o `diagnose.py` acusa: as duas máscaras estão coladas em
contorno de verdade e passam com aderência alta. O que denuncia é abrir o jogo.

### A tira reta no topo do trem

46 das 55 máscaras de trem vinham com uma faixa horizontal de poucos pixels
colada no topo, cobrindo toda a largura da peça — resíduo da caixa do prompt
original. Ela cai na chapa da barriga e do intradorso da asa, e no jogo aparece
como um risco de cor de trem atravessando a fuselagem.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/tirar_barra.py --write
```

Reconhece a tira por três coisas juntas: fina, cobrindo quase toda a extensão
horizontal, e no topo da peça. Tampa de poço e viga de bogie não têm as três.
Não dá para parar na primeira linha que falha o teste: a linha de cima da tira
vem serrilhada e cobre menos que o limiar. Saíram 25.685px.

### O sulco entre vizinhos

`recompute_sector.py` dilata o vizinho 2px antes de subtrair, para as bordas não
se encostarem. O preço é um sulco que não é de ninguém em volta do motor e do
trem — e como a fuselagem é pintada como retângulo recortado pela silhueta
inteira, é a cor dela que aparece ali, contornando o motor por cima da asa.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/costurar.py --write
```

Cada órfão vai para o setor mais perto, com **duas** condições: até 3px e com
dois donos por perto. A segunda é a que faz funcionar — sem ela cada setor
cresce 3px para todo lado, inclusive na divisa aberta com a fuselagem, e a asa
passa a comer barriga: 4.377px no a320 contra os 458 de um sulco de verdade.
Sulco tem vizinho dos dois lados; divisa com a fuselagem, não.

O trem entra como **reserva**: reivindica os órfãos em volta dele mas não
cresce, então a costura nunca pinta borracha.

## Pneu não leva cor

O que a livery pinta no trem é a perna — amortecedor e viga do bogie. Pneu é
borracha preta em qualquer companhia do mundo, e pintado de azul o trem fica de
brinquedo.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/derive_sectors.py --all --what gearstrut
```

O pneu é achado como **disco**: o maior círculo que cabe dentro da máscara,
descontado várias vezes para cobrir bogie de quatro e seis rodas. Duas
alternativas foram medidas e não servem, para não serem tentadas de novo:

- **Limiar de cor pega o cubo**, que é claro, e deixa a banda preta de fora —
  exatamente o contrário do que se quer.
- **Largura por linha não separa**: o flange da tampa do poço é tão largo quanto
  o pneu, e o vale entre os dois não desce o bastante para cortar por fração da
  largura máxima.

`gearmasks` continua sendo a referência de medida e a origem do recorte;
`gearstrutmasks` é o que o jogo pinta.

## Nem toda aeronave tem winglet

Antes de tentar recortar um dispositivo de ponta, veja `pontas.md`: ele lista,
modelo a modelo, quem tem e quem não tem. **Sete não têm nada** — `atr42`,
`atr72`, `b752`, `b753`, `b764`, `b77e` e o `q400` — e para esses a ausência de
máscara é a resposta certa, não uma pendência. Contam como dispositivo o
winglet, o sharklet, a wingtip fence, a ponta raked e a aleta pequena.

## Estado do setor de winglet

Doze estão recortados e conferidos; trinta faltam; sete não têm nada; seis não
foram classificados porque a ponta da asa não é achada de forma confiável neles
(ver `pontas.md`).

O lote automático (`winglet_batch.py`) acerta cerca de 40%, e o que sobra cai
numa tira de fuselagem ou na nacela do motor. O portão pega erro grosseiro —
tamanho, box-fill, sangramento — e vale muito: de dezessete aprovados no
primeiro lote, sete eram box-fill. Mas **quem diz se caiu na peça certa é o
olho**, e por isso só entra o que foi conferido.

Duas medidas que pareciam resolver e não resolvem, para não serem tentadas de
novo:

- **Aderência não decide.** Uma tira de fuselagem marca 86% a 94% igual a um
  winglet, porque fileira de janela e linha de painel são contorno forte.
- **"Cercado de céu" não vale.** Na vista lateral o dispositivo fica na frente
  da fuselagem: o `a319neo` dá 0% de fundo em volta e está certo. O teste
  derrubava cinco dos confirmados.

Derivar por geometria também foi tentado duas vezes — componente solto no
resto da silhueta, e disco em volta da ponta — e não passa de metade.

## Quando o automático não resolve

Os quatro consertos ajustam uma máscara que já está na peça certa. Quando a
máscara está na **peça errada** — o setor da asa pegou a nacela, box-fill pegou
a fuselagem inteira — não há o que alinhar: tem que recortar de novo.

**`sam2_region.py`** faz o recorte com SAM2 large, por caixa e ponto à mão:

```bash
export SAM2_CKPT=sam2ckpt/sam2.1_hiera_large.pt
export SAM2_CFG=configs/sam2.1/sam2.1_hiera_l.yaml

python3 sam2_region.py --aid a320neo \
  --photo public/sprites/aircraft/a320neo__leap1a26.png \
  --mask-dir /tmp/wing_raw --box 605,435,955,585 --point 800,470 --mode replace
```

`--mode union` soma o recorte ao que já existe (ponta cortada); `--mode
replace` refaz do zero.

### A altura da caixa é o que causa box-fill

Caixa alta demais, que alcança a fileira de janela, faz o SAM2 devolver a seção
inteira da fuselagem em vez da peça. No `a388`, só baixar o topo da caixa de
`y=440` para `y=500` levou o resultado de 121.851px de fuselagem para 17.629px
de asa correta — mesma foto, mesmo ponto.

> **O topo da caixa fica abaixo da fileira de janela, colado na borda de ataque
> da peça. Nunca acima.**

Caixa genérica para todos os 55 não funciona: já foi tentada e produziu
box-fill em série. Cada aeronave tem a caixa lida da própria foto.

### Onde pôr o ponto

Sobre a superfície da peça, em contraste médio, **longe de decalque, porta,
placa e janela**. No `a321` o ponto caiu a poucos pixels de uma plaquinha na
asa e o SAM2 segmentou a plaquinha, em quatro tentativas seguidas de caixa
diferente. Resultado pequeno e de formato estranho quase sempre é ponto errado,
não caixa errada — mova o ponto antes de mexer na caixa.

### Quando o SAM2 se recusa

Lasca fina, baixo contraste, decalque por perto: às vezes não há prompt que
faça o SAM2 achar a peça. Aí `poly_patch.py` resolve em um passo, com os
vértices lidos do zoom do overlay:

```bash
python3 poly_patch.py --aid a321 --mask-dir /tmp/wing_raw \
  --points 877,474 953,455 953,469 877,553
```

Polígono de quatro vértices ligando borda grossa (raiz, ~65px) direto na ponta
fina (~10px) descreve uma cunha que passa longe do perfil e engole barriga de
fuselagem — foi o que aconteceu no `b788`. Passando de umas 3 vezes de razão de
espessura, acrescente um par de vértices no meio.

### Recompor o setor

Recorte cru inclui motor e trem, porque eles ficam por cima da asa na foto. O
setor que o jogo pinta é o que sobra:

```bash
python3 recompute_sector.py --aid a320neo --raw /tmp/wing_raw \
  --out public/sprites/wingmasks \
  --minus public/sprites/enginemasks --minus public/sprites/gearmasks
```

Dilatar o vizinho em 2px antes de subtrair evita as bordas se encostarem e sair
cor dupla. Rode sempre depois de mexer no recorte cru; editar direto o arquivo
final quebra essa garantia.

## Lendo coordenada do zoom

As fotos são 1536x1024, então coordenada lida em tamanho natural já é
coordenada da foto. Com recorte e zoom, `overlay.py` imprime o mapeamento de
volta. Escolha caixa e ponto no zoom da **foto limpa** e confira no zoom do
**overlay** — misturar os dois é como se erra o eixo.

## Ambiente

Os consertos automáticos, o diagnóstico e os visuais usam só numpy, scipy e
PIL, e rodam em segundos. Só `sam2_region.py` precisa do checkpoint large, roda
em CPU e leva um a dois minutos por chamada.
