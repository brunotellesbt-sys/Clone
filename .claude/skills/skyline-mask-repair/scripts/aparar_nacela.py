"""Apara a máscara de motor até a nacela, tirando o que ela abocanhou da asa.

`enginemasks` não é a nacela: em quase todos os modelos ela sai da nacela e
segue para trás e para fora, cobrindo pilone, carenagem de trilho de flape e um
pedaço do intradorso da asa, com borda esfarrapada. Enquanto a silhueta do jogo
tinha buraco isso passava despercebido; com o avião inteiro recebendo tinta, a
região virou o defeito mais visível da tela — um retalho de cor de motor,
cor de asa e cor de fuselagem sob a raiz da asa, cada pedaço com borda serrilhada.

O `diagnose.py` não acusa, e não é falha dele: a borda esfarrapada **acompanha**
contorno de verdade (o da carenagem de flape), então a aderência fica alta. O
que está errado não é a borda, é a peça.

A medida que separa é a forma. Nacela é um corpo **gordo**: em vista lateral,
um elipsoide onde cabe um disco grande. O que ela agarrou a mais é sempre
**magro** — franja de poucos pixels de espessura acompanhando a chapa da asa.
Então o que sobrevive a uma abertura por disco de 45% do raio máximo da própria
peça é nacela, e o resto não é. Sem número fixo em pixel: motor de turboélice,
de regional e o Trent do a388 têm raios muito diferentes, e a fração se ajusta
sozinha.

O que sai da máscara não vira asa: vira nada, e a fuselagem é derivada do que
sobra (`derive_sectors.py --what fuselage`), então aquela área passa a ser
pintada de uma cor só, a do ventre, em vez do retalho.

    python3 aparar_nacela.py --dry-run
    python3 aparar_nacela.py --write

Depois de escrever, o resto da cadeia é a de sempre:

    python3 costurar.py --write
    python3 derive_sectors.py --all --what fuselage
"""

import argparse
import os
import sys

import numpy as np
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

R = "public/sprites"
FRACAO = 0.45      # do raio máximo da peça: abaixo disso é franja, não nacela
MIN_PECA = 300     # px: componente menor que isto é resíduo, passa direto


def disco(raio):
    yy, xx = np.ogrid[-raio:raio + 1, -raio:raio + 1]
    return (yy * yy + xx * xx) <= raio * raio


def nacela(m):
    """Só a parte gorda de cada componente da máscara."""
    saida = np.zeros_like(m)
    rotulos, n = ndimage.label(m)
    for k in range(1, n + 1):
        peca = rotulos == k
        if peca.sum() < MIN_PECA:
            saida |= peca
            continue
        dist = ndimage.distance_transform_edt(peca)
        raio = int(max(2, FRACAO * dist.max()))
        nucleo = dist >= FRACAO * dist.max()
        saida |= ndimage.binary_dilation(nucleo, structure=disco(raio)) & peca
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--only", help="lista de modelos separada por vírgula")
    args = ap.parse_args()

    alvo = set(args.only.split(",")) if args.only else None
    total = 0
    for nome in sorted(os.listdir(os.path.join(R, "enginemasks"))):
        if not nome.endswith(".png"):
            continue
        aid = nome[:-4]
        if alvo and aid not in alvo:
            continue
        motor = mc.carregar_mask(os.path.join(R, "enginemasks", nome))
        aparado = nacela(motor)
        corte = int(motor.sum() - aparado.sum())
        total += corte
        print("%-10s %6d px  (%4.1f%% da nacela)" % (aid, corte, 100 * corte / max(1, motor.sum())))
        if not args.write:
            continue
        mc.salvar_mask(aparado, os.path.join(R, "enginemasks", nome))
        # A carenagem é subconjunto declarado da nacela: apara junto, pela
        # interseção, para não sobrar carenagem fora do motor.
        carenagem = os.path.join(R, "enginecowlmasks", nome)
        if os.path.exists(carenagem):
            mc.salvar_mask(mc.carregar_mask(carenagem) & aparado, carenagem)
    print("total: %d px" % total)


if __name__ == "__main__":
    main()
