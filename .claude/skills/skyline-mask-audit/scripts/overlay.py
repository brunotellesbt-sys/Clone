"""Desenha a borda da máscara em vermelho sobre a foto real.

É a única verificação que vale como veredito. Sem recorte por padrão: a foto
inteira, porque recorte centrado em ponto calculado já enganou várias vezes.

    python3 overlay.py public/sprites/wingmasks/a320.png \
        public/sprites/aircraft/a320__cfm565b4.png /tmp/a320.png
    python3 overlay.py ... --crop 850,400,1150,600 --zoom 3
"""

import argparse

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mask")
    ap.add_argument("photo")
    ap.add_argument("out")
    ap.add_argument("--crop", help="x0,y0,x1,y1 em pixels da foto original")
    ap.add_argument("--zoom", type=int, default=1)
    ap.add_argument("--color", default="255,0,0")
    args = ap.parse_args()

    m = np.array(Image.open(args.mask).convert("L")) > 127
    foto = Image.open(args.photo).convert("RGB")
    if foto.size != (m.shape[1], m.shape[0]):
        foto = foto.resize((m.shape[1], m.shape[0]))
    arr = np.array(foto).copy()

    borda = ndimage.binary_dilation(m, iterations=2) ^ ndimage.binary_erosion(m, iterations=2)
    arr[borda] = [int(c) for c in args.color.split(",")]

    img = Image.fromarray(arr)
    if args.crop:
        x0, y0, x1, y1 = (int(v) for v in args.crop.split(","))
        img = img.crop((x0, y0, x1, y1))
    if args.zoom > 1:
        img = img.resize((img.width * args.zoom, img.height * args.zoom), Image.NEAREST)
    img.save(args.out)

    # O mapeamento de volta é o que evita errar coordenada ao ler o zoom.
    if args.crop:
        x0, y0, _, _ = (int(v) for v in args.crop.split(","))
        print(f"orig_x = {x0} + tela_x/{args.zoom}   orig_y = {y0} + tela_y/{args.zoom}")
    print(args.out)


if __name__ == "__main__":
    main()
