---
name: skyline-mask-audit
description: Como conferir, pixel por pixel, se as máscaras de setor das aeronaves do Skyline Tycoon (public/sprites/wingmasks, enginemasks, gearmasks, tailmasks, wingletmasks) estão no lugar certo e cobrindo a peça inteira. Use quando a tarefa for revisar, auditar, validar ou "conferir se ficou bom" qualquer setorização ou recorte de aeronave, quando o relato for de máscara desalinhada, asa cortada antes da ponta, pintura vazando para a fuselagem, setor pegando o motor em vez da asa, ou quando alguém disser que a segmentação "está feia", "não está 100%" ou "tem coisa errada aí". Vale antes de commitar qualquer lote de máscara novo.
---

# Auditoria de setorização

## O veredito é sempre o overlay na foto inteira

A única verificação que decide é a borda da máscara desenhada sobre a foto
real, **avião inteiro, sem recorte**:

```bash
python3 .claude/skills/skyline-mask-audit/scripts/overlay.py \
  public/sprites/wingmasks/a320.png \
  public/sprites/aircraft/a320__cfm565b4.png /tmp/a320.png
```

Isso não é preciosismo. Recorte centrado num ponto calculado — "a ponta da
asa", "a raiz" — engana, e engana nos dois sentidos:

- **Falso positivo.** No `a333` e no `arj21` o recorte mostrava a asa cinza
  seguindo além do contorno vermelho; na foto inteira as duas estavam certas.
  O que parecia asa era sombreado da curva da fuselagem.
- **Falso negativo.** Um lote inteiro de recortes centrados na junção
  asa/motor foi dado como revisado, e a ponta da asa — fora do recorte —
  estava cortada em quase todos os 55 modelos.

Contagem de pixel também não decide. Uma máscara com 25.000px pode ser a
fuselagem inteira e uma com 1.900px pode ser a asa correta de um avião cuja
asa aparece quase toda escondida atrás do motor.

## A ordem que funciona

1. **`audit_masks.py`** — ordena por suspeita. Barato, sem SAM2, roda nos 55
   em segundos. Serve para escolher por onde começar, não para aprovar.
2. **`sheet.py`** — prancha de 4 aviões inteiros, para varrer o lote.
3. **`overlay.py`** com `--crop` e `--zoom` — só depois que a prancha apontou
   algo, para ver o pixel e ler coordenada.

```bash
python3 .claude/skills/skyline-mask-audit/scripts/audit_masks.py \
  --masks public/sprites/wingmasks \
  --against public/sprites/enginemasks --against public/sprites/gearmasks
```

O script separa **achado** de **fila**. Achado é defeito com assinatura
confiável. A fila só ordena por quanto do comprimento do avião a máscara cobre,
da menor para a maior, para você escolher por onde abrir o overlay — cobertura
baixa **não** é defeito: asa quase toda escondida atrás do motor cobre 8% do
avião e está certa (`e190`, `il96`, `b763` são assim).

Uma versão anterior deste script tratava cobertura baixa como achado e apontou
11 falsos positivos em 13 — todos máscaras já conferidas e corretas. Por isso a
separação existe: sinal barulhento faz a próxima pessoa desconfiar do que está
bom e perder o que está ruim.

**Nenhum achado numérico não é aprovação.** O caso mais comum de todos — ponta
cortada — não tem assinatura numérica confiável: a máscara continua conexa,
bem-formada e com área plausível. Ela só termina cedo. Isso só o olho vê.

## Os cinco defeitos, e como cada um se parece

**1. Máscara na peça errada.** O setor pegou a nacela do motor, a carenagem do
trem ou a barriga, e a asa ficou intacta. Foi o defeito mais grave e mais
frequente: 14 dos 55 modelos. No overlay, o contorno abraça o motor e a
superfície da asa acima dele está limpa.
Assinatura numérica: sobreposição acima de 80% com `enginemasks` ou
`gearmasks`. É a única classe que o script pega com confiança.

**2. Ponta cortada.** A máscara para no meio do painel, antes da ponta real.
Foi o defeito mais comum — cerca de 30 modelos. Sem assinatura numérica.
Cuidado com o falso alarme: a asa deve parar **na quebra do winglet**, porque
o winglet é setor próprio. Uma máscara que termina ali está certa, não curta.

**3. Box-fill.** O SAM2 devolveu a caixa inteira: fuselagem, fileira de
janela e tudo. A máscara vira um retângulo quase perfeito.
Assinatura: preenche mais de 88% da própria caixa delimitadora, área grande,
e o score da geração costuma vir abaixo de 0,75.

**4. Fio de sombra.** Uma tira longa e fina sai da máscara e segue uma linha de
sombreado da fuselagem por centenas de pixels. Como nasce grudada no borrão
principal, o filtro de componente mínimo não remove.
Assinatura: componente principal com mais de 300px de largura e espessura
média abaixo de 6px.

**5. Fragmentada.** Vários pedaços soltos e serrilhados em vez de uma peça.
Assinatura: mais de 3 componentes acima de 300px — mas **só no recorte cru**
(`--raw`). No setor já composto, fragmentar é o esperado: o motor corta a asa
em pedaço interno e externo. Cobrar isso do arquivo final dá falso positivo.

## Vazio pode ser o resultado certo

O `q400` fica com a asa vazia e está correto. Naquele ângulo a asa aparece
quase de perfil, inteiramente sobreposta pela nacela: não existe superfície de
asa própria para pintar, e 99% do que o SAM2 acha ali já pertence ao motor
(4.366 de 4.457px de sobreposição). Forçar captura só produziria máscara
duplicada de motor.

Antes de chamar uma máscara vazia de defeito, compare com a máscara do motor:
se a sobreposição explica o vazio, o vazio é a resposta.

## Onde o setor deve parar

A fronteira entre setores vizinhos é o que o jogador vê quando pinta:

- A **asa** termina na quebra do winglet — nunca sobe pela curva do winglet.
  Em modelo sem winglet de verdade (wingtip fence, ponta raked, aleta pequena
  tipo A319/E-Jet), o setor da asa também para na base da aleta: essa aleta é
  do setor de winglet.
- **Asa, motor e trem** não se sobrepõem: o setor da asa é composto subtraindo
  motor e trem dilatados em 2px. Sobreposição residual vira cor dupla.
- Modelo de asa alta (ATR, Q400, An-148/158) tem a asa **acima** da faixa da
  fuselagem, não abaixo. Auditoria que só olha abaixo da linha da janela passa
  batido por eles.

## Depois de auditar

Achado confirmado no overlay vai para a skill **skyline-mask-repair**, que
tem as ferramentas de correção e a ordem de escalada. Auditar e corrigir são
passos separados de propósito: a correção mexe no arquivo, e mexer sem ter o
defeito confirmado visualmente foi o que gerou metade do retrabalho.
