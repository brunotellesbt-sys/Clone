"""Tira a hélice das máscaras dos turboélices.

No `atr42` e no `atr72` um terço da máscara de asa é quase preto: são as pás da
hélice, que o recorte pegou junto porque passam por cima da asa na foto. No
`q400` o mesmo acontece na máscara de motor.

Pá de hélice não leva cor de livery, pela mesma razão do pneu — é preta em
qualquer companhia, e pintada de azul o avião fica de brinquedo. Fora que a pá
fica **na frente** da asa, não é asa.

O que identifica a pá: escura e **rala**. Uma pá cobre menos da metade da sua
própria caixa, porque é uma lasca curva atravessando o retângulo na diagonal.
Chapa pintada, por mais escura que esteja de sombra, é cheia.

    python3 tirar_helice.py
    python3 tirar_helice.py --write
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

# aeronave -> setores onde a hélice entrou
TURBOELICE = {
    "atr42": ["wingmasks"],
    "atr72": ["wingmasks"],
    "q400": ["enginemasks"],
}
ESCURO = 90
MIN_PX = 60
MAX_SOLIDEZ = 0.6


def tirar(m, lum):
    escuro = (lum < ESCURO) & m
    rot, n = ndimage.label(escuro)
    fora = np.zeros_like(m)
    for i in range(1, n + 1):
        c = rot == i
        t = int(c.sum())
        if t < MIN_PX:
            continue
        ys, xs = np.where(c)
        caixa = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)
        if t / caixa < MAX_SOLIDEZ:
            fora |= c
    # dilatar antes de subtrair: a borda da pá é serrilhada e sobra um fio
    return m & ~ndimage.binary_dilation(fora, iterations=1), int(fora.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    for aid, setores in TURBOELICE.items():
        lum = np.array(Image.open(mc.achar_foto(args.photos, aid)).convert("L"))
        for s in setores:
            p = os.path.join(args.root, s, f"{aid}.png")
            m = mc.carregar_mask(p)
            if not m.any():
                continue
            novo, n = tirar(m, lum)
            print(f"  {aid:7s} {s:12s} {int(m.sum()):6d} -> {int(novo.sum()):6d}  (-{n}px de pá)")
            if args.write:
                mc.salvar_mask(novo, p)


if __name__ == "__main__":
    main()
