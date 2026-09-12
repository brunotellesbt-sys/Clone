# Dispositivo de ponta de asa, modelo a modelo

Levantado olhando a ponta de cada uma das 55 aeronaves na foto. Serve para não
se gastar esforço tentando recortar winglet onde não existe nenhum, e para não
se confundir máscara ausente com máscara faltando.

**Ausência de máscara de winglet é a resposta certa** para os modelos da
primeira lista, do mesmo jeito que a asa vazia do `q400` é a resposta certa.

## Não têm nada na ponta — não deve existir máscara

Ponta lisa, afilada, sem winglet, sem fence, sem aleta.

`atr42` `atr72` `b752` `b753` `b764` `b77e`

E `q400`, que nem asa própria tem: naquele ângulo ela fica inteiramente atrás
da nacela.

## Têm dispositivo e já estão recortados

`a21lr` `a21xlr` `a220300` `a319neo` `a320neo` `a321neo` `a339` `b737` `b763`
`b788` `crj700` `crj900` `e190e2` `e195` `il96` `tu204`

Todos conferidos no olho. Os quatro últimos a entrar — `b763`, `crj700`,
`crj900` e `il96` — saíram do segundo lote automático, e vale registrar o que
isso custou: o portão aprovou **24 de 36** e só **4** estavam certos. Os outros
vinte pegaram fuselagem, nacela, céu ou uma tira do bordo de ataque inteiro.

Três que enganam de longe e não resistem ao zoom: no `b37m` o recorte pega o
winglet **mais** um retângulo de fundo ao lado; no `b739` e no `b73g` é uma
tira ao longo da aresta de cima da asa, não a ponta. Conferir winglet em folha
de contato pequena não basta — tem que abrir cada um.

## Têm dispositivo e faltam recortar

Winglet, sharklet, wingtip fence, ponta raked ou aleta pequena — todos contam,
conforme combinado: só fica de fora quem não tem nada.

`a220100` `a319` `a320` `a321` `a332` `a333` `a338` `a359` `a35k` `a35ulr`
`a388` `b37m` `b39m` `b739` `b73g` `b748` `b779` `b77w` `b789` `b78x` `c919`
`crj1000` `e170` `e175` `e190` `e195e2` `sj100`

### Terceiro lote: 16 aprovados pelo portão, **zero** certos

Rodado de novo com as máscaras de asa já corrigidas e encaixadas — a hipótese
era a de sempre, "ponta mal achada é asa mal recortada". Não era. Dos 27
pendentes: 7 não acharam semente, 4 o portão reprovou, **16 passaram e nenhum é
winglet**. Conferido um a um em zoom: onze são retângulo ou borrão de fuselagem
acima da ponta, três são tira ao longo da aresta de cima da asa, um é a cunha do
intradorso do `b779` e um é um ponto solto.

O motivo é estrutural e vale escrever: **na vista lateral o winglet está dentro
da silhueta da fuselagem**, encostado nela, sem borda de fundo entre os dois. A
semente do `winglet_batch.py` procura "silhueta acima da ponta que não é asa" —
e isso é a fuselagem, quase sempre. O portão não tem como salvar: ele mede
tamanho, box-fill, sangramento e aderência, e uma tira de fuselagem passa em
todos.

O que sobra, para quem for tentar de novo: a única evidência do winglet é o
**contorno interno** que ele desenha por cima da fuselagem no mapa de borda.
Semente tirada da silhueta nunca vai achá-lo; o caminho é crescer região a
partir da ponta contida pelas bordas, ou dar ao SAM2 pontos ao longo de um raio
curto subindo da ponta e escolher o recorte cuja borda case com o mapa de borda
sem tocar a fileira de janela. Enquanto isso não existir, estes trinta e dois
continuam sem setor — e sem setor é melhor do que com tira de fuselagem pintada
de cor de winglet.

## A ponta voltou a ser achada depois que a asa foi consertada

`an148` `an158` `arj21` `b310m` `b38m` `il96` estavam nesta lista como "ponta
não encontrada": `ponta_da_asa` caía perto do motor porque as carenagens de
flape puxavam o eixo da PCA. Isso **deixou de acontecer** quando o motor saiu
de dentro da máscara de asa (PR #17 e #18): com a asa limpa, `an148`, `an158` e
`il96` acham a ponta a 4% do extremo, e `arj21` e `b38m` a 14% — o mesmo do
`a320`, que sempre funcionou. Só o `b310m` segue ruim, a 25%.

A lição é geral: **ponta mal achada costuma ser asa mal recortada.** Antes de
inventar outro jeito de achar a ponta, olhe a máscara de asa.
