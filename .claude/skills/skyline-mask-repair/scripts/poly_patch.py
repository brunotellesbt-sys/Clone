"""Soma um polígono desenhado à mão à máscara existente.

Último recurso, para o trecho que o SAM2 se recusa a achar: lasca fina de ponta
de asa, baixo contraste, decalque por perto. Os vértices vêm da leitura do zoom
do overlay.

    python3 poly_patch.py --aid a321 --mask-dir /tmp/wing_raw \
      --points 877,474 953,455 953,469 877,553

Ordem dos vértices: borda de ataque da esquerda para a direita, depois borda de
fuga da direita para a esquerda. Guarda cópia em <mask>.bak.
"""

import argparse
import os
import shutil

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

FEATHER = 1.3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aid", required=True)
    ap.add_argument("--mask-dir", required=True)
    ap.add_argument("--points", nargs="+", required=True, help="x,y x,y x,y ...")
    args = ap.parse_args()

    if len(args.points) < 3:
        raise SystemExit("polígono precisa de pelo menos 3 vértices")
    vertices = [tuple(int(v) for v in p.split(",")) for p in args.points]

    destino = os.path.join(args.mask_dir, f"{args.aid}.png")
    anterior_img = Image.open(destino).convert("L")
    anterior = np.array(anterior_img) > 127

    remendo_img = Image.new("L", anterior_img.size, 0)
    ImageDraw.Draw(remendo_img).polygon(vertices, fill=255)
    remendo = np.array(remendo_img) > 127

    cheia = ndimage.binary_fill_holes(anterior | remendo)
    dentro = ndimage.distance_transform_edt(cheia)
    fora = ndimage.distance_transform_edt(~cheia)
    alpha = np.where(
        cheia,
        np.minimum(255, 128 + dentro * (127 / FEATHER)),
        np.maximum(0, 128 - fora * (127 / FEATHER)),
    )

    shutil.copy2(destino, destino + ".bak")
    Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8), mode="L").save(destino)
    print(f"remendo {int(remendo.sum())}px  total {int(cheia.sum())}px")


if __name__ == "__main__":
    main()
