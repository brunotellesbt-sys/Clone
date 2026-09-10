"""Recorta uma peça da foto com SAM2 large, a partir de caixa e ponto à mão.

Dois modos:
  --mode replace  refaz a máscara inteira (setor no lugar errado, box-fill)
  --mode union    soma o recorte à máscara existente (ponta cortada)

    python3 sam2_region.py --aid a320neo \
      --photo public/sprites/aircraft/a320neo__leap1a26.png \
      --mask-dir /tmp/wing_raw --box 605,435,955,585 --point 800,470 \
      --mode replace

A caixa é dica, não fronteira: o SAM2 responde fora dela, então o resultado é
recortado na caixa explicitamente. Guarda cópia do arquivo anterior em
<mask>.bak antes de escrever.
"""

import argparse
import os
import shutil

import numpy as np
import torch  # noqa: F401  (o build_sam2 depende dele carregado)
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from scipy import ndimage

CKPT = os.environ.get("SAM2_CKPT", "sam2ckpt/sam2.1_hiera_large.pt")
CFG = os.environ.get("SAM2_CFG", "configs/sam2.1/sam2.1_hiera_l.yaml")
FEATHER = 1.3  # mesma suavização de borda usada em todas as máscaras do projeto


def suavizar(binaria):
    dentro = ndimage.distance_transform_edt(binaria)
    fora = ndimage.distance_transform_edt(~binaria)
    alpha = np.where(
        binaria,
        np.minimum(255, 128 + dentro * (127 / FEATHER)),
        np.maximum(0, 128 - fora * (127 / FEATHER)),
    )
    return np.clip(alpha, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aid", required=True)
    ap.add_argument("--photo", required=True)
    ap.add_argument("--mask-dir", required=True)
    ap.add_argument("--box", required=True, help="x0,y0,x1,y1")
    ap.add_argument("--point", required=True, help="x,y sobre a superfície da peça")
    ap.add_argument("--mode", choices=["replace", "union"], default="replace")
    args = ap.parse_args()

    bx0, by0, bx1, by1 = (float(v) for v in args.box.split(","))
    px, py = (float(v) for v in args.point.split(","))
    destino = os.path.join(args.mask_dir, f"{args.aid}.png")

    arr = np.array(Image.open(args.photo).convert("RGB"))
    preditor = SAM2ImagePredictor(build_sam2(CFG, CKPT, device="cpu"))
    preditor.set_image(arr)
    masks, scores, _ = preditor.predict(
        point_coords=np.array([[px, py]]),
        point_labels=np.array([1]),
        box=np.array([bx0, by0, bx1, by1]),
        multimask_output=True,
    )
    i = int(np.argmax(scores))
    melhor = masks[i].astype(bool)
    score = float(scores[i])

    corte = np.zeros_like(melhor)
    corte[int(by0) : int(by1) + 1, int(bx0) : int(bx1) + 1] = True
    melhor &= corte

    rotulado, n = ndimage.label(melhor)
    if n > 1:
        tamanhos = ndimage.sum(melhor, rotulado, range(1, n + 1))
        melhor = rotulado == (int(np.argmax(tamanhos)) + 1)

    novo = int(melhor.sum())
    if args.mode == "union":
        anterior = np.array(Image.open(destino).convert("L")) > 127
        melhor = anterior | melhor

    cheia = ndimage.binary_fill_holes(melhor)

    if os.path.exists(destino):
        shutil.copy2(destino, destino + ".bak")
    os.makedirs(args.mask_dir, exist_ok=True)
    Image.fromarray(suavizar(cheia), mode="L").save(destino)

    caixa_area = (int(bx1) - int(bx0) + 1) * (int(by1) - int(by0) + 1)
    print(f"score {score:.3f}  recorte {novo}px ({novo / caixa_area:.0%} da caixa)  total {int(cheia.sum())}px")
    if score < 0.75:
        print("  score baixo: confira no overlay, costuma ser box-fill ou peça errada")
    if novo / caixa_area > 0.88:
        print("  box-fill provável: baixe a altura da caixa para fora da fileira de janela")


if __name__ == "__main__":
    main()
