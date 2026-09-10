"""Prancha de contato: várias aeronaves com a borda da máscara, numa imagem só.

Serve para triagem em lote — 4 por prancha, avião inteiro, sem recorte. Quem
achar defeito aqui confirma depois no overlay individual com zoom.

    python3 sheet.py --masks public/sprites/wingmasks a320 a321 a332 a333
"""

import argparse
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def achar_foto(dir_fotos, aid):
    for nome in sorted(os.listdir(dir_fotos)):
        base = nome.rsplit(".", 1)[0]
        if base == aid or base.startswith(aid + "__"):
            return os.path.join(dir_fotos, nome)
    raise SystemExit(f"sem foto para {aid} em {dir_fotos}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("aids", nargs="+")
    ap.add_argument("--masks", required=True)
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--out", default="/tmp/prancha.png")
    ap.add_argument("--cols", type=int, default=2)
    args = ap.parse_args()

    lado_x, lado_y, faixa = 760, 500, 20
    linhas = (len(args.aids) + args.cols - 1) // args.cols
    folha = Image.new("RGB", (args.cols * lado_x, linhas * (lado_y + faixa)), (30, 30, 30))
    d = ImageDraw.Draw(folha)

    for i, aid in enumerate(args.aids):
        m = np.array(Image.open(os.path.join(args.masks, f"{aid}.png")).convert("L")) > 127
        arr = np.array(Image.open(achar_foto(args.photos, aid)).convert("RGB")).copy()
        borda = ndimage.binary_dilation(m, iterations=2) ^ ndimage.binary_erosion(m, iterations=2)
        arr[borda] = [255, 0, 0]
        lin, col = divmod(i, args.cols)
        folha.paste(Image.fromarray(arr).resize((lado_x, lado_y)), (col * lado_x, lin * (lado_y + faixa) + faixa))
        d.text((col * lado_x + 5, lin * (lado_y + faixa) + 4), aid, fill=(255, 255, 0))

    folha.save(args.out)
    print(args.out)


if __name__ == "__main__":
    main()
