---
name: skyline-mask-repair
description: Como corrigir desalinhamento e defeito de máscara de setor de aeronave do Skyline Tycoon, em qualquer peça — asa, motor, winglet, trem de pouso, cauda, fuselagem —, e também a silhueta do avião inteiro e as peças de cor fixa (pneu, hélice). Cobre correção automática medida (aparar sangramento, soltar pixel disputado, deslocar 1-3px, encaixar a borda no contorno) e recorte manual com SAM2 large quando a máscara está na peça errada. Use quando o pedido for "conserta a máscara", "corrige o desalinhamento", "refaz essa asa", "setoriza direito", "pixel por pixel", quando a pintura aparecer borrada, com mancha escura ou buraco no meio da peça, ou quando aparecer SAM2, sam2.1_hiera_large, segmentação, recorte por caixa e ponto, planemasks, wingmasks, enginemasks, gearmasks, tyremasks, propmasks, tailmasks ou wingletmasks.
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

O encaixe roda em **três escalas**, da grossa para a fina — `sigma` 6, 3 e 1,5
px, o quanto o deslocamento medido num ponto se espalha pelos vizinhos. A grossa
trata a borda como uma curva só e corrige tendência; a fina deixa cada trecho
seguir o seu próprio contorno, e é ela que fecha o último pixel. Cada escala é
medida e revertida em separado, então o que fica é o que mediu melhor.

Rodar as três, e não só a fina, é o que faz funcionar: sozinha, a fina persegue
ruído de contorno e a medida a reprova. No lote das dez pastas foram **97
máscaras** aceitas — trem 93%→97% de aderência, deriva 93%→94%, fuselagem
90%→91%, winglet 86%→88%, e desvios como o do trem do `q400` caindo de 0,46 para
0,28px.

**Depois do encaixe, refaça o fechamento da deriva.** O encaixe otimiza
aderência ao contorno e às vezes assenta a borda 1px para dentro; no bordo de
ataque da deriva isso reabre o fio de cor de fuselagem. `aparar_deriva.py`
devolve, e a ordem completa fica:

```
autofix  →  aparar_deriva  →  derive --what wingbands  →  costurar  →  derive --what fuselage
```

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

## A silhueta é arquivo, não conta feita no navegador

Antes de qualquer setor vem o recorte do avião inteiro: é ele que decide o que
recebe tinta. Durante muito tempo esse recorte era calculado em tempo de
execução, em `measure.ts`, chamando de avião o pixel que estivesse a mais de 60
(soma dos três canais) da cor do fundo. O sprite é um avião **branco em fundo
branco**, então isso não funciona: dorso da fuselagem, meio da nacela e dorso da
asa passam de 245 de luminância e ficam abaixo do limiar.

Medido no b737: **164.743px reconhecidos contra 241.166px de avião — 32% fora**.
Fora da máscara não é "sem pintura", é **buraco**: nada é desenhado ali e o
fundo da página aparece no meio da peça. Era essa a mancha escura no meio do
motor. A rampa de transição de 40 níveis do mesmo teste, cruzando chapa clara,
era o aspecto borrado da fuselagem. Os 100 sprites recuperam de 2% a 54% de
área, mediana 35%.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/silhueta_batch.py \
  --out public/sprites/planemasks
```

Três coisas que o lote resolve e valem lembrar:

- **Limiar de cor não separa avião branco de fundo branco; inundação a partir da
  borda separa.** O fundo é a região que encosta na moldura; o que estiver
  cercado pelo contorno é avião, por mais claro que seja. Com limiar 24 e
  inundação, falta 0,03% do avião; com o limiar 60 de antes, faltavam 27,9%.
- **Uma máscara por sprite, não por modelo.** As variantes de motor são renders
  diferentes — `a320__cfm565b4` e `a320__v2527` diferem em 13,7% dos pixels — e
  a silhueta tem que ser a do arquivo que está na tela.
- **A sombra no chão sai aqui.** Ela é pintável desde sempre e ninguém tinha
  visto: a laje de contato tem borda dura e passa pela regra de nitidez do
  `maskcore`. Duas medidas dão conta — o que não sobrevive a uma abertura
  vertical de 41px na faixa de baixo, e o que forma peça quatro vezes mais larga
  que alta. Conferido peça a peça nos 100: só sai laje, nenhuma roda encolhe.

## Peça que não é de ninguém fica com a cor de quem não é dono

Com a silhueta cobrindo o avião inteiro, "não pintar" deixou de ser uma opção
neutra: quem não é reivindicado por setor nenhum recebe a cor da fuselagem. A
hélice do atr42 ficou **branca**. E mesmo antes, sem tinta própria, o pneu já
saía cinza — a foto é de um avião branco de fábrica e entra na tela por
`multiply` a 30%, ou seja `base × (0,7 + 0,3 × foto)`, que sobre fuselagem clara
nunca desce de ~70% de luminância. **Não pintar jamais produz preto.**

```bash
python3 .claude/skills/skyline-mask-repair/scripts/pecas_cruas.py
```

Grava `tyremasks` e `propmasks`, que a arte pinta com cor fixa (`BORRACHA` e
`HELICE` em `AircraftArt.tsx`) — não são setores de livery, a companhia não
escolhe a cor da borracha. Duas medidas objetivas sustentam o recorte:

- **O pneu é escuro.** `gearmasks` menos `gearstrutmasks` não é só pneu: em 28
  dos 55 ela abocanha também a porta do poço do trem do nariz. A luminância
  separa com folga — 112 peças escuras entre 37 e 124, 28 claras entre 130 e
  198, ninguém no meio. Circularidade não serve: o bogie de seis rodas do a332 é
  tão alongado quanto uma porta.
- **A roda que falta se acha sozinha.** Em 12 modelos o trem do nariz nunca
  entrou em `gearmasks`. Procurar disco escuro na faixa de baixo, fora de asa,
  motor e fuselagem, e ficar só com o **círculo inscrito**, acha todos sem pegar
  a perna junto.

Para a hélice vale a mesma medida do `tirar_helice.py` — escura e rala — com uma
correção de alcance: solta no avião inteiro ela também pega o filete escuro da
junção asa-fuselagem, e o atr42 saía com um risco preto asa afora. Limitada à
vizinhança da nacela e ficando com a maior peça (as pás se encontram no cone),
sai a hélice e mais nada.

## A máscara é por modelo, então a arte também tem que ser

Cada motorização tem um sprite próprio, e a chave `id:motor` do manifesto vinha
na frente da chave do modelo — mas as máscaras de setor são recortadas sobre
**um** sprite, o que a entrada-base aponta. Variante não é "a mesma foto com
outra nacela": medida a silhueta de uma contra a da outra, a interseção sobre a
união fica em **0,80 na mediana e chega a 0,52**. Um a388 com Trent pintava com
a máscara recortada no GP7270 e a deriva saía pela metade, em paralelogramo.

Corrigido invertendo a ordem em `artFor` (`src/livery/art.ts`): entrada do
modelo primeiro, a de motor só para quem não tem a do modelo. Enquanto o recorte
for por modelo, a arte tem que ser a do modelo — e quem quiser voltar a mostrar
a nacela certa por motorização precisa recortar as dez pastas por sprite, não
por aeronave.

## Medir na foto mede errado; medir no recorte mede certo

`measure.ts` deduz do sprite a caixa do avião, a faixa da fuselagem, a caixa da
deriva e onde o emblema cabe — tudo com o mesmo teste de primeiro plano que
falhava na silhueta, e pelo mesmo motivo (chapa clara em fundo branco). A caixa
da deriva saía **menor que a deriva**, e como a cauda é pintada como retângulo
recortado pela máscara, o que ficava de fora aparecia como um fio de cor de
fuselagem no bordo de ataque e uma mordida na ponta.

Duas correções, as duas em `src/livery/`:

- **medir sobre `planemasks`**, não sobre a foto: no recorte o avião é branco
  sólido em fundo preto sólido e o mesmo teste acerta cada pixel;
- **a caixa da deriva sai da máscara da deriva** (`pieceBox`), não de dedução.
  Deduzir acopla as duas medidas: ao melhorar a faixa da fuselagem, a caixa da
  cauda do a388 — convés superior alto — passou a começar depois do bordo de
  ataque.

Com a faixa medida direito, o letreiro passou a caber onde ele mora de verdade:
no dorso, entre o topo da fuselagem e a fileira de janela, que `fusebands.json`
já tinha medido por aeronave.

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

### A franja do motor no intradorso da asa

Terminada a caçada ao cone de escape (abaixo), sobrou o contrário: a máscara de
motor **passa** da nacela. Em quase todos os modelos ela segue para trás e para
fora, cobrindo pilone, carenagem de trilho de flape e um pedaço do intradorso,
com borda esfarrapada. O `diagnose.py` não acusa, e não é falha dele: a franja
acompanha contorno de verdade, o da carenagem de flape, então a aderência fica
alta. O que está errado não é a borda, é a peça.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/aparar_nacela.py --write
```

Separa pela forma: nacela é corpo **gordo** — em vista lateral cabe um disco
grande dentro dela — e a franja é magra. Fica o que sobrevive a uma abertura por
disco de 45% do raio máximo da própria peça, sem número fixo em pixel, porque
hélice de turboélice, nacela de regional e Trent do a388 têm raios muito
diferentes. Saíram 105.000px no total, 7,4% da nacela na mediana.

O efeito na tela é grande: aquela área era pintada de cor de motor, ao lado de
cor de asa e de cor de fuselagem, cada pedaço com borda serrilhada — o retalho
sob a raiz da asa. Devolvida à fuselagem (que é derivada do que sobra), vira uma
cor só.

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

**A ordem importa, e errá-la custa uma auditoria inteira.** A costura faz as
peças crescerem, e a fuselagem é derivada *das* peças — então a sequência é
sempre:

```
mexer nas peças  →  derive --what wingbands  →  costurar  →  derive --what fuselage
```

Derivar a fuselagem antes de costurar deixa ela sobreposta ao que a asa e o
motor acabaram de ganhar: numa rodada assim o `diagnose.py` saltou de 1 para 12
disputas, todas contra `fuselagemasks`, e nenhuma delas era defeito de recorte.

### A traseira da nacela que ficava com a asa

O recorte antigo do motor pegava a boca e deixava o cone de escape para a asa.
Como o jogo pinta a asa por cima, o motor saía com a cor da asa — e no `a320` o
motor tinha 6.444px contra os 24.214px da peça de verdade.

Nenhuma medida de área acusava: turboélice tem nacela pequena de verdade, então
`motor/silhueta` não separa o `q400` (2,5%, certo) do `a320` (2,6%, errado). O
que acusa é **montar a foto com asa em vermelho e motor em verde** e olhar as 55
em folha de contato: o cone sai vermelho em quase todas.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/engine_batch.py --out /tmp/engine
```

A caixa sai do motor antigo esticada **para trás** — para cima alcançaria a
fileira de janela e voltaria a seção inteira da fuselagem. O ponto é a mediana
dos pixels do motor antigo, que por construção está na peça certa.

O portão exige que o recorte novo **contenha** o antigo (80%), cresça, não passe
de 18% da silhueta, não suba até a fileira de janela e não sangre. Conter o
antigo é a trava que importa: sem ela, um recorte que troca de peça passaria só
por ser maior.

Trem e cauda são descontados antes de medir. Eles ficam na frente da nacela na
foto e o SAM2 os traz junto — no `a220100` o recorte engolia a roda inteira, e
sem descontar antes o portão aprovava um motor com pneu dentro.

**O portão aprova o que o olho reprova.** Como no winglet: ele pega erro
grosseiro, quem diz se caiu na peça certa é a folha de contato de
asa-vermelho/motor-verde. Na primeira passada aprovou as 55 e treze estavam
erradas; numa segunda rodada, com caixa ajustada, aprovou as treze e sete ainda
estavam erradas. **Nunca grave um lote de motor sem olhar a folha.**

Cinquenta dos 55 estão recortados e conferidos. Os cinco que faltam, e o que já
foi tentado neles:

| Modelo | O que acontece | Tentado |
|---|---|---|
| `b748` | a nacela pega intradorso de asa nos quatro motores | conservador e sem esticar |
| `b753` | uma tira fina sobe até a fileira de janela | teto baixo e caixa sem esticar |
| `crj900` | reprova por tamanho, e a máscara atual tem fuselagem dentro | conservador e sem esticar |
| `crj700` `b752` | nada: o recorte original já cobre a nacela inteira | refazer piorava — o `crj700` saiu box-fill de 94% da caixa e foi revertido |


Nesses cinco o recorte antigo ficou — e vale lembrar que **máscara antiga não é
sinônimo de errada**: no `crj700`, `b752` e `b753` o recorte original já cobre a
nacela inteira, e a tentativa de refazer é que piorava.

Um caso pedia inversão, não conserto: o `q400` tinha a **asa rotulada como
motor** e `wingmasks` vazia. A banda em cima da fuselagem, que numa asa alta é
tudo o que se vê da asa, estava em `enginemasks`; a nacela de verdade fica atrás
do spinner e não tinha máscara nenhuma. Foi recortada à mão e as duas trocaram
de lugar.

### Para que lado esticar a caixa

Depende de onde o motor está montado, e isso sai da medida: a posição do motor
no comprimento da fuselagem (0 no nariz, 1 na cauda) dá **0,34 a 0,49** em todo
mundo de asa e salta para **0,70 a 0,74** no `arj21` e na família CRJ. Não há
nada no meio, então o corte em 0,60 é seguro e `na_cauda()` decide sozinho.

No motor de asa falta a traseira; no de cauda, a traseira já é fuselagem.
Mas **esticar para a frente no motor de cauda dá box-fill** — a caixa passa a
conter a lateral limpa da fuselagem e o SAM2 devolve o retângulo. O que
funcionou nos de cauda foi `--conservador`, e mesmo assim só no `arj21` e no
`crj1000`.

E o olho também erra: o `crj700` foi aprovado na folha de contato e o
`diagnose.py` derrubou depois, por box-fill de 94% da caixa. **Rode a auditoria
depois de gravar o lote, não só a folha antes** — as duas pegam coisas
diferentes, e nenhuma das duas sozinha basta.

Contar janela dentro da máscara ajuda a triar mas não decide: pega `atr72`
(6 janelas), `an148` (4) e `an158` (3), e passa batido em `arj21` e `atr42`,
que erram sem encostar em janela nenhuma.

## Núcleo do motor também não leva cor

O que a livery pinta numa nacela é a **carenagem**. O bocal de escape, o plug e
o fan são metal exposto — mesma regra do pneu e da pá.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/engine_core_batch.py --out /tmp/core
```

Duas medidas mais baratas foram tentadas antes e **não** generalizam:

- **cor**: o bocal é escuro, mas a sombra da barriga da nacela e a do pilone
  também, e essas são chapa pintável; a temperatura (`R-B`) fica em zero no
  `a333`, no `b788` e no `crj900`;
- **degrau de altura por coluna** — carenagem é platô, bocal é degrau — acerta
  no `b737` e no `a320` e falha em 11 dos 55, porque o pilone entra na máscara
  do motor e quebra o perfil.

Com SAM2 o portão aprovou as 55, e de novo o olho reprovou parte. O que separa
objetivamente é a **altura do núcleo contra a da nacela**: até 0,67 é bocal; daí
para cima o recorte já está espalhando pelo pilone. Medido na fronteira —
`b38m` 0,67 e `b78x` 0,66 são bocal; `e195` 0,68 e `a321` 0,75 são pilone.
Entraram 38; nos outros 17 `enginecowlmasks` é a nacela inteira, igual a antes,
sem regressão.

## Janela de passageiro é setor, e o interruptor apaga a fileira

```bash
python3 .claude/skills/skyline-mask-repair/scripts/janelas.py --write
```

Mesma detecção da divisa da cabine — preto pequeno, compacto e **na fileira**,
com limiar relativo à própria fuselagem. A vidraça do cockpit sai fora, que já
tem setor próprio, e mancha isolada meia fuselagem acima também: a fileira é
estreita em y, e o filtro usa desvio absoluto mediano em volta do centro dela.

Com a máscara, os dois controles que o editor sempre teve passaram a valer:
cor escolhida pinta a vidraça, e **desligar pinta a fileira com a cor da
fuselagem** — que é literalmente como se apaga uma fileira de janela, o que se
vê num cargueiro convertido.

## Pá de hélice também não leva cor

Pelo mesmo motivo do pneu, e com um agravante: a pá fica **na frente** da asa na
foto, então nem asa é. No `atr42` e no `atr72` um terço da máscara de asa era
hélice — 7.288px e 4.772px —, e no `q400` a pá tinha entrado na máscara de motor.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/tirar_helice.py --write
```

O que identifica a pá é ser escura **e rala**: ela cobre menos de 60% da própria
caixa, porque é uma lasca curva atravessando o retângulo na diagonal. Chapa
pintada, por mais escura de sombra que esteja, é cheia. Só o limiar de cor não
serviria — a sombra sob a asa cai na mesma faixa de luminância.

Tirar a hélice é **pré-requisito** para recortar a nacela de turboélice: com a
pá dentro da asa, o recorte do motor não converge. Com ela fora, o `atr42` e o
`atr72` saíram no primeiro lote.

Tirar dos setores é metade do serviço: a outra metade é `propmasks`, que dá cor
própria à pá — ver "Peça que não é de ninguém" acima. Enquanto ela não existiu,
a hélice saiu **branca**, com a cor da fuselagem.

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
`gearstrutmasks` é o que o jogo pinta **de cor de livery**, e `tyremasks` — o
resto dela, ver "Peça que não é de ninguém" acima — é o que o jogo pinta de
preto. Tirar o pneu do setor não basta: sem tinta própria ele sai cinza.

## A deriva precisa fechar até o contorno

Dois defeitos da máscara de deriva que o `diagnose.py` não acusa e que a tela
mostra na hora, porque a deriva costuma ser a peça mais colorida da livery:
falta um fio de 1 a 3px no bordo de ataque e na ponta (a fuselagem aparece por
baixo, contornando a peça), e a raiz é serrilhada, porque ali não existe
contorno nenhum para o recorte seguir.

```bash
python3 .claude/skills/skyline-mask-repair/scripts/aparar_deriva.py --write
```

Uma medida resolve as duas: **acima da raiz, tudo é deriva**. Para cada coluna,
alisa-se a linha de raiz com mediana de 21px e preenche-se dali para cima com o
que for avião. Entraram 35.047px nas 55 e a aderência subiu de 92% para 93%.

## O estabilizador horizontal não tem máscara

Conferido nas 55: `tailmasks` é a **deriva e mais nada**. O estabilizador
horizontal nunca teve setor próprio, então na arte de foto ele sai com a cor da
fuselagem.

`stab_batch.py` recorta com SAM2 a partir da deriva, e **não converge**. Três
tentativas, e cada uma troca um erro por outro:

| tentativa | caixa | o que sai |
|---|---|---|
| 1 | aberta para os dois lados da raiz | estabilizador **mais** a traseira da fuselagem, em 4 de 5 |
| 2 | idem, com ponto negativo no tubo | melhora o `a388` (22.929px → 7.618) e **piora** o `b737` (14.546 → 21.926) |
| 3 | só atrás da deriva | passa nos 6, mas pega **só a metade traseira** e leva o cone junto no `a320` e no `e190` |
| 4 | nenhuma: envelope monótono do cone | não acha nada — ver abaixo |

A quarta não usou SAM2: a ideia era geométrica, achar o que escapa do cone. Com
a deriva descontada, o topo do cone só desce e a base só sobe indo para a cauda,
então o que passasse desse envelope monótono seria estabilizador. **Não passa
nada**: na vista lateral o estabilizador fica *dentro* do envelope, abaixo da
linha do topo do cone na mesma estação. O que a medida encontrou foram os
poucos pixels da ponta, depois que o cone já acabou. Não repetir.

A raiz do problema é da foto, não do recorte: **na vista lateral o
estabilizador é contínuo com o cone de cauda**, sem contorno entre os dois na
raiz. Não há borda para o SAM2 encontrar, e não há borda para a métrica medir.

Em cauda em T (`crj900`) é outro caso: o estabilizador fica em cima da deriva e
já cai dentro de `tailmasks`.

Por isso a livery **não** consome esse setor, e o controle "Estabilizador
horizontal" do editor só tem efeito no desenho vetorial. Melhor assim do que
com metade dos modelos pintando fuselagem junto. Quem for tentar de novo:
o caminho que sobra é geométrico — extrapolar o contorno do cone a partir de
uma estação à frente e chamar de estabilizador o que ficar fora dele.

## Nem toda aeronave tem winglet

Antes de tentar recortar um dispositivo de ponta, veja `pontas.md`: ele lista,
modelo a modelo, quem tem e quem não tem. **Sete não têm nada** — `atr42`,
`atr72`, `b752`, `b753`, `b764`, `b77e` e o `q400` — e para esses a ausência de
máscara é a resposta certa, não uma pendência. Contam como dispositivo o
winglet, o sharklet, a wingtip fence, a ponta raked e a aleta pequena.

## Estado do setor de winglet

Dezesseis estão recortados e conferidos; trinta e dois faltam; sete não têm
nada. A lista modelo a modelo está em `pontas.md`, e a categoria "ponta não
encontrada" deixou de existir: era asa mal recortada, não falha do detector.

O lote automático (`winglet_batch.py`) tem rendimento **baixo**, e a segunda
rodada mediu quanto: de 36 candidatos o portão aprovou 24 e só **4** estavam
certos. O que sobra cai numa tira de fuselagem, na nacela do motor, num
retângulo de céu ou numa tira do bordo de ataque inteiro. O portão pega erro grosseiro —
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
resto da silhueta, e disco em volta da ponta — e não passa de metade. Na
terceira, com as máscaras de asa já encaixadas e a silhueta nova, o disco em
volta da ponta trouxe 10.000 a 14.000px de fuselagem em todos os seis testados.

E o terceiro lote automático fechou a conta: **16 aprovados pelo portão, zero
certos**. O detalhe está em `pontas.md`, mas a lição cabe aqui: na vista lateral
o winglet fica **dentro** da silhueta da fuselagem, encostado nela, sem borda de
fundo entre os dois. Semente tirada da silhueta acha fuselagem, não winglet. A
única evidência da peça é o contorno interno que ela desenha no mapa de borda —
enquanto o recorte não partir dali, esses trinta e dois ficam sem setor, que é
melhor do que com uma tira de fuselagem pintada de cor de winglet.

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
