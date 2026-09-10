"""Compõe o setor final subtraindo os setores vizinhos.

O recorte cru da asa inclui motor e trem, porque eles ficam por cima dela na
foto. O setor que o jogo pinta é o que sobra:

    asa = asa_crua − dilata(motor, 2) − dilata(trem, 2)

Dilatar em 2px evita a borda de um setor encostar na do outro e sair cor dupla.
Componente abaixo de 300px é resíduo de subtração e cai fora.

    python3 recompute_sector.py --aid a320neo --raw /tmp/wing_raw \
      --out public/sprites/wingmasks \
      --minus public/sprites/enginemasks --minus public/sprites/gearmasks
"""

import argparse
import os

import numpy as np
from PIL import Image
from scipy import ndimage

FEATHER = 1.3
MIN_COMPONENT = 300


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aid", required=True)
    ap.add_argument("--raw", required=True, help="pasta do recorte cru")
    ap.add_argument("--out", required=True, help="pasta do setor final")
    ap.add_argument("--minus", action="append", default=[], help="pasta de setor a subtrair")
    args = ap.parse_args()

    setor = np.array(Image.open(os.path.join(args.raw, f"{args.aid}.png")).convert("L")) > 127
    for pasta in args.minus:
        caminho = os.path.join(pasta, f"{args.aid}.png")
        if not os.path.exists(caminho):
            continue
        vizinho = np.array(Image.open(caminho).convert("L")) > 127
        setor &= ~ndimage.binary_dilation(vizinho, iterations=2)

    cheia = ndimage.binary_fill_holes(setor)
    rotulado, n = ndimage.label(cheia)
    if n > 1:
        tamanhos = ndimage.sum(cheia, rotulado, range(1, n + 1))
        manter = np.zeros_like(cheia)
        for i in range(1, n + 1):
            if tamanhos[i - 1] >= MIN_COMPONENT:
                manter |= rotulado == i
        cheia = manter

    dentro = ndimage.distance_transform_edt(cheia)
    fora = ndimage.distance_transform_edt(~cheia)
    alpha = np.where(
        cheia,
        np.minimum(255, 128 + dentro * (127 / FEATHER)),
        np.maximum(0, 128 - fora * (127 / FEATHER)),
    )

    os.makedirs(args.out, exist_ok=True)
    Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8), mode="L").save(
        os.path.join(args.out, f"{args.aid}.png")
    )
    print(f"{args.aid} {int(cheia.sum())}px")


if __name__ == "__main__":
    main()
