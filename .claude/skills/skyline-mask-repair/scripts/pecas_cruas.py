"""Separa as peças que nunca levam tinta de companhia: pneu e pá de hélice.

O pneu já existia como **diferença**: o trem (`gearmasks`) menos a perna
(`gearstrutmasks`). O jogo simplesmente não o pintava, deixando a foto aparecer
ali, e isso não funciona. A foto é um avião branco de fábrica, e ainda por cima
entra na tela por `multiply` a 30%: o resultado de não pintar é
`base × (0,7 + 0,3 × foto)`, que sobre fuselagem clara nunca desce de ~70% de
luminância. **Não pintar jamais produz preto; preto tem que ser pintado.** Daí
o recorte virar arquivo e ganhar cor fixa na arte.

Não é setor de livery — a companhia não escolhe a cor da borracha — e por isso
`tyremasks` não entra em `SETORES` do audit: é o complemento de um setor que
ela escolhe, gravado como arquivo para o jogo não ter que subtrair máscara em
tempo de execução.

A pá de hélice tem o mesmo problema e agora ficou pior: `tirar_helice.py` a
expulsou dos setores de asa e motor — certo, pá não é chapa pintável — mas a
silhueta nova cobre o avião inteiro, então a pá passou a receber a cor da
fuselagem e o atr42 ganhou uma hélice branca. Peça que não é de ninguém precisa
ser de alguém: sai aqui, com a mesma medida de lá (escura e rala).

**O núcleo metálico do motor não sai por aqui**, e a tentação de derivá-lo do
mesmo jeito (nacela menos carenagem) foi medida e descartada: no b737 essa
diferença dá 2.620px que não são bocal nenhum — são intradorso de asa e
carenagem de trilho de flape que a máscara da nacela abocanhou a mais, enquanto
a carenagem cobre o bocal e o plug inteiros. Pintar essa diferença de metal
poria uma mancha cinza na asa e continuaria pintando o bocal. Separar bocal de
carenagem continua sendo trabalho de recorte (`engine_core_batch.py`), não de
subtração.

    python3 pecas_cruas.py
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

R = "public/sprites"
MIN_PX = 200  # menos que isso é resto de borda, não peça
LIMIAR_BORRACHA = 128  # luminância média acima disso não é pneu

# Roda que ficou de fora de `gearmasks` (o trem do nariz, em 8 dos 55).
FAIXA_TREM = 0.28   # fração de baixo da caixa do avião onde procurar
ESCURO_RODA = 150   # luminância que ainda pode ser borracha
RAIO_MIN = 7        # px: menor círculo inscrito que ainda é roda

# Pá de hélice: a mesma medida do tirar_helice.py — escura e rala.
TURBOELICE = ["atr42", "atr72", "q400"]
ESCURO_PA = 90
MAX_SOLIDEZ = 0.6
MIN_PA = 60


def diferenca(pai, filho):
    """O que sobra do pai quando se tira o filho, sem a franja da divisa.

    As duas máscaras têm borda suavizada, então a subtração crua deixa um
    contorno de 1 a 2px acompanhando o filho. A abertura tira essa franja e
    mantém a peça.
    """
    resto = pai & ~ndimage.binary_dilation(filho, iterations=2)
    return ndimage.binary_opening(resto, iterations=2)


def so_borracha(resto, foto):
    """Das peças que sobraram, fica só o que é escuro: pneu.

    `gearmasks` não é só perna e roda — em 28 dos 55 modelos ela abocanha
    também a **porta do poço do trem do nariz**, uma chapa clara logo acima da
    roda. Enquanto ninguém pintava o complemento, isso não aparecia; pintado de
    preto, vira um bloco preto no lugar errado.

    A medida que separa é a luminância na foto, e ela separa com folga: as 112
    peças escuras ficam entre 37 e 124, as 28 claras entre 130 e 198, sem
    ninguém no meio. Circularidade não serve — o bogie de seis rodas do a332 é
    tão alongado quanto uma porta.
    """
    lum = np.array(Image.open(foto).convert("L")).astype(float)
    rotulos, n = ndimage.label(resto)
    fica = np.zeros_like(resto)
    for k in range(1, n + 1):
        peca = rotulos == k
        if peca.sum() < 80 or lum[peca].mean() >= LIMIAR_BORRACHA:
            continue
        fica |= peca
    return fica if fica.sum() >= MIN_PX else None


def carregar(pasta, aid):
    caminho = os.path.join(R, pasta, aid + ".png")
    return mc.carregar_mask(caminho) if os.path.exists(caminho) else None


def rodas_soltas(aid, foto, pneu):
    """Roda que `gearmasks` não pegou — o trem do nariz, em 8 dos 55 modelos.

    Sem isto, "roda preta" valeria para o trem principal e não para o do nariz,
    que continuaria cinza de foto. A busca é estreita de propósito: faixa de
    baixo da caixa, escuro, fora de asa, motor e fuselagem (é onde moram as
    sombras redondas de intradorso, que são o único falso positivo que apareceu),
    e o que fica só entra como o **círculo inscrito** da peça — a perna que vem
    junto no mesmo borrão escuro continua sendo da livery, não da borracha.
    """
    lum = np.array(Image.open(foto).convert("L")).astype(float)
    plano = carregar("planemasks", os.path.basename(foto)[:-4])
    if plano is None:
        return np.zeros_like(pneu)
    veta = np.zeros_like(plano)
    for pasta in ("enginemasks", "wingmasks", "fuselagemasks"):
        m = carregar(pasta, aid)
        if m is not None:
            veta |= m

    ys = np.where(plano.any(axis=1))[0]
    y0, y1 = ys.min(), ys.max()
    baixo = np.zeros_like(plano)
    baixo[int(y1 - FAIXA_TREM * (y1 - y0)):, :] = True

    escuro = plano & baixo & (lum < ESCURO_RODA)
    escuro &= ~ndimage.binary_dilation(veta, iterations=3)
    escuro &= ~ndimage.binary_dilation(pneu, iterations=3)
    escuro = ndimage.binary_closing(escuro, iterations=2)

    rotulos, n = ndimage.label(escuro)
    achadas = np.zeros_like(escuro)
    for k in range(1, n + 1):
        peca = ndimage.binary_fill_holes(rotulos == k)
        if peca.sum() < MIN_PX:
            continue
        dist = ndimage.distance_transform_edt(peca)
        iy, ix = np.unravel_index(np.argmax(dist), dist.shape)
        raio = float(dist[iy, ix])
        if raio < RAIO_MIN:
            continue
        yy, xx = np.ogrid[:peca.shape[0], :peca.shape[1]]
        roda = peca & (((yy - iy) ** 2 + (xx - ix) ** 2) <= (1.3 * raio) ** 2)
        if roda.sum() < 250 or lum[roda].mean() >= LIMIAR_BORRACHA:
            continue
        achadas |= roda
    return achadas


def pas(aid, foto):
    """As pás e o cone da hélice, dentro da silhueta.

    Mesma medida do `tirar_helice.py`, que as expulsou dos setores: a pá é
    **escura e rala** — cobre menos de 60% da própria caixa, porque é uma lasca
    curva na diagonal. Chapa em sombra é escura mas cheia.

    A diferença é o alcance. Lá a regra rodava **dentro** de uma máscara de
    setor, que já a limitava; solta no avião inteiro ela também pega a sombra
    rala do intradorso e o filete escuro do bordo de fuga, e o atr42 saía com um
    risco preto asa afora. Por isso aqui a busca fica na vizinhança da nacela,
    que é onde hélice pode estar.
    """
    lum = np.array(Image.open(foto).convert("L")).astype(float)
    plano = carregar("planemasks", os.path.basename(foto)[:-4])
    motor = carregar("enginemasks", aid)
    if plano is None or motor is None:
        return None
    ys, xs = np.where(motor)
    folga = int(0.6 * (ys.max() - ys.min() + 1))
    perto = np.zeros_like(plano)
    perto[max(0, ys.min() - folga):ys.max() + folga, max(0, xs.min() - folga):xs.max() + folga] = True
    escuro = plano & perto & (lum < ESCURO_PA)
    rotulos, n = ndimage.label(escuro)
    lamina = np.zeros_like(escuro)
    for k, caixa in enumerate(ndimage.find_objects(rotulos), 1):
        peca = rotulos == k
        area = int(peca.sum())
        if area < MIN_PA:
            continue
        tamanho = (caixa[0].stop - caixa[0].start) * (caixa[1].stop - caixa[1].start)
        if area / tamanho < MAX_SOLIDEZ:
            lamina |= peca

    # Só a maior peça: as pás se encontram no cone, então a hélice inteira é uma
    # peça só (4.600 a 6.600px nos três). O que sobra são o filete escuro da
    # junção asa-fuselagem, que é rala e escura como uma pá mas fica dentro da
    # vizinhança da nacela, e um par de janelas — nenhum passa de 1.800px.
    rotulos, n = ndimage.label(ndimage.binary_closing(lamina, iterations=2))
    if n == 0:
        return None
    tamanhos = ndimage.sum(lamina, rotulos, range(1, n + 1))
    maior = rotulos == (int(np.argmax(tamanhos)) + 1)
    return maior if maior.sum() >= MIN_PX else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=R)
    args = ap.parse_args()

    destino = os.path.join(args.out, "tyremasks")
    os.makedirs(destino, exist_ok=True)
    feitos = vazios = 0
    for nome in sorted(os.listdir(os.path.join(R, "gearmasks"))):
        if not nome.endswith(".png"):
            continue
        perna = os.path.join(R, "gearstrutmasks", nome)
        if not os.path.exists(perna):
            continue
        aid = nome[:-4]
        foto = mc.achar_foto(os.path.join(R, "aircraft"), aid)
        pneu = diferenca(mc.carregar_mask(os.path.join(R, "gearmasks", nome)), mc.carregar_mask(perna))
        pneu = so_borracha(pneu, foto) if foto else None
        if pneu is None:
            print("%-10s sem pneu separável" % aid)
            vazios += 1
            continue
        solta = rodas_soltas(aid, foto, pneu)
        if solta.any():
            print("%-10s + %d px de roda que gearmasks não tinha" % (aid, int(solta.sum())))
            pneu = pneu | solta
        mc.salvar_mask(pneu, os.path.join(destino, nome))
        feitos += 1
    print("tyremasks: %d gravados, %d sem peça separável" % (feitos, vazios))

    destino = os.path.join(args.out, "propmasks")
    os.makedirs(destino, exist_ok=True)
    for aid in TURBOELICE:
        foto = mc.achar_foto(os.path.join(R, "aircraft"), aid)
        lamina = pas(aid, foto) if foto else None
        if lamina is None:
            print("%-10s sem pá separável" % aid)
            continue
        mc.salvar_mask(lamina, os.path.join(destino, aid + ".png"))
        print("%-10s hélice com %d px" % (aid, int(lamina.sum())))


if __name__ == "__main__":
    main()
