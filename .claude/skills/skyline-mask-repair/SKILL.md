---
name: skyline-mask-repair
description: Como corrigir máscara de setor de aeronave do Skyline Tycoon com SAM2 large — asa cortada antes da ponta, setor que pegou o motor em vez da asa, box-fill pegando a fuselagem inteira, fio de sombra, winglet entrando no setor errado. Use quando houver defeito de setorização já confirmado no overlay e for preciso refazer ou remendar o recorte, quando o pedido for "conserta a máscara", "refaz essa asa", "setoriza direito", "pixel por pixel", ou quando aparecer SAM2, sam2.1_hiera_large, segmentação, recorte por caixa e ponto, wingmasks, enginemasks, gearmasks, tailmasks ou wingletmasks.
---

# Correção de máscara com SAM2

## Antes de mexer, o defeito tem que estar confirmado no overlay

Corrigir é destrutivo. A skill **skyline-mask-audit** diz o que está errado e
por quê; esta aqui só executa. Metade do retrabalho desta pipeline veio de
corrigir máscara que já estava certa, porque o recorte de conferência enganava.

Todo script aqui grava `<mask>.png.bak` antes de escrever. Use.

## A escalada, do mais barato para o mais caro

**1. Ponta cortada → `sam2_region.py --mode union`.** Uma chamada pequena só na
região que falta, somada ao que já existe. Preserva a raiz e a área do motor
que já estavam boas. É o caminho certo para o defeito mais comum.

**2. Setor no lugar errado ou box-fill → `sam2_region.py --mode replace`.**
Refaz do zero com caixa e ponto escolhidos à mão.

**3. O SAM2 se recusa → `poly_patch.py`.** Lasca fina, baixo contraste,
decalque por perto: às vezes não há prompt que faça o SAM2 achar a peça. Aí o
polígono à mão resolve em um passo o que quatro tentativas de prompt não
resolveram.

Depois de qualquer um dos três, recomponha o setor e confira:

```bash
python3 .claude/skills/skyline-mask-repair/scripts/recompute_sector.py \
  --aid a320neo --raw /tmp/wing_raw --out public/sprites/wingmasks \
  --minus public/sprites/enginemasks --minus public/sprites/gearmasks

python3 .claude/skills/skyline-mask-audit/scripts/overlay.py \
  public/sprites/wingmasks/a320neo.png \
  public/sprites/aircraft/a320neo__leap1a26.png /tmp/conf.png
```

## A altura da caixa é o que causa box-fill

Esta é a lição mais cara da pipeline. Caixa alta demais, que alcança a fileira
de janela, faz o SAM2 devolver a seção inteira da fuselagem em vez da peça. No
`a388`, só baixar o topo da caixa de `y=440` para `y=500` levou o resultado de
121.851px de fuselagem para 17.629px de asa correta — mesma foto, mesmo ponto.

> **Regra: o topo da caixa fica abaixo da fileira de janela, colado na borda de
> ataque da peça. Nunca acima.**

O mesmo vale de baixo: caixa que desce até o chão engole trem e sombra.

Tentar consertar isso com uma caixa genérica para todos os 55 não funciona —
foi tentado (`by0` uniforme mais alto) e produziu box-fill em série. Cada
aeronave tem a caixa lida da própria foto.

## Onde pôr o ponto

O ponto é o que desempata quando a caixa tem mais de uma peça dentro. Ele
precisa cair **sobre a superfície cinza da peça, em contraste médio**:

- **Longe de decalque, porta, placa e janela.** No `a321` o ponto caiu a poucos
  pixels de uma plaquinha na asa e o SAM2 segmentou a plaquinha, em quatro
  tentativas seguidas de caixa diferente. Só o polígono à mão resolveu.
- **Longe de sombra quase preta e de reflexo quase branco.** Nos dois extremos
  o SAM2 fixa num detalhe pequeno em vez da chapa.
- **No meio do painel**, não na borda: borda é onde a peça encosta na vizinha.

Quando o resultado sair pequeno demais e com formato estranho, quase sempre é
ponto errado, não caixa errada. Mova o ponto antes de mexer na caixa.

## Lendo coordenada do zoom

As fotos são todas 1536x1024, então coordenada lida de uma visualização em
tamanho natural já é coordenada da foto. Com recorte e zoom, o `overlay.py`
imprime o mapeamento de volta:

```
orig_x = x0 + tela_x/zoom    orig_y = y0 + tela_y/zoom
```

Vale gerar o zoom **da foto limpa** para escolher caixa e ponto, e o zoom **do
overlay** para conferir o resultado. Misturar os dois é como se erra o eixo.

## Polígono com proporção extrema precisa de vértice no meio

Um polígono de quatro vértices ligando a borda grossa (raiz, ~65px) direto à
ponta fina (~10px) descreve uma cunha que passa longe do perfil real e engole
barriga de fuselagem — foi o que aconteceu no `b788`. Quando a razão de
espessura entre as duas pontas passa de umas 3 vezes, acrescente um par de
vértices no meio, lido do zoom:

```bash
python3 poly_patch.py --aid b788 --mask-dir /tmp/wing_raw \
  --points 944,505 1050,417 1147,403 1147,413 1050,433 944,570
```

## Onde o setor tem que parar

- A **asa** para na quebra do winglet. Aleta pequena, wingtip fence e ponta
  raked também são setor de winglet, não de asa.
- **Asa, motor e trem** não se sobrepõem — quem garante isso é o
  `recompute_sector.py`, subtraindo os vizinhos dilatados em 2px. Rode-o sempre
  depois de mexer no recorte cru; editar direto o arquivo final quebra essa
  garantia.
- Asa alta (ATR, Q400, An-148/158) fica **acima** da faixa da fuselagem.

## Setor que sobra vazio pode estar certo

Se depois da subtração o setor zerar, compare com o vizinho antes de insistir.
No `q400` a asa some porque, naquele ângulo, ela está inteiramente atrás da
nacela: 4.366 dos 4.457px batiam com a máscara do motor. Vazio ali é a resposta
correta — forçar captura só duplicaria o motor.

## Ambiente

`sam2_region.py` precisa do checkpoint large. Caminhos por variável de
ambiente, com o padrão do scratchpad desta pipeline:

```bash
export SAM2_CKPT=sam2ckpt/sam2.1_hiera_large.pt
export SAM2_CFG=configs/sam2.1/sam2.1_hiera_l.yaml
```

Roda em CPU, na casa de um a dois minutos por chamada. Não vale a pena montar
lote grande sem revisão: nesta pipeline os lotes automáticos de 55 produziram
mais defeito do que acerto, e cada um precisou de conferência individual do
mesmo jeito. `audit_masks.py`, `overlay.py` e `poly_patch.py` não usam SAM2 e
rodam em segundos.
