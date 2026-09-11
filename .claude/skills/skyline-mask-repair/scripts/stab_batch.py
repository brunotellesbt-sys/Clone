"""Recorta o estabilizador horizontal com SAM2.

`tailmasks` é a **deriva e mais nada** — conferido nas 55. O estabilizador
horizontal não tinha máscara nenhuma, então na arte de foto ele saía com a cor
da fuselagem: a empenagem inteira pintada de um jeito que nenhuma companhia usa.

A caixa sai da própria deriva: o estabilizador nasce na raiz dela e se abre para
os dois lados, sempre **abaixo**. Ele fica entre a base da deriva e a base da
fuselagem, e é isso que a caixa descreve.

    python3 stab_batch.py --out /tmp/stab
    python3 stab_batch.py --out /tmp/stab --only b737,a320
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

CKPT = os.environ.get("SAM2_CKPT", "sam2ckpt/sam2.1_hiera_large.pt")
CFG = os.environ.get("SAM2_CFG", "configs/sam2.1/sam2.1_hiera_l.yaml")

MIN_PX = 800
MAX_FRACAO_SIL = 0.09
MAX_FORA = 60


def caixa_do_estabilizador(deriva, sil, nariz):
    """Abaixo da raiz da deriva, aberta para os dois lados."""
    ys, xs = np.where(deriva)
    raiz = ys.max()
    largura = xs.max() - xs.min() + 1
    sy = np.where(sil.any(axis=1))[0]
    base = sy.max()

    # para a frente do avião o estabilizador avança pouco; para trás ele vai
    # até a ponta da cauda
    if nariz > 0:  # nariz à direita: a cauda é para a esquerda
        x0 = max(0, xs.min() - int(0.55 * largura))
        x1 = min(sil.shape[1] - 1, xs.max() + int(0.25 * largura))
    else:
        x0 = max(0, xs.min() - int(0.25 * largura))
        x1 = min(sil.shape[1] - 1, xs.max() + int(0.55 * largura))
    y0 = int(raiz - 0.06 * (base - raiz))
    y1 = int(min(base, raiz + 0.75 * (base - raiz)))
    return x0, max(0, y0), x1, y1


def semente(sil, deriva, caixa, outros):
    """Um ponto no estabilizador: dentro da caixa, fora da deriva e do resto."""
    faixa = np.zeros_like(sil)
    faixa[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
    livre = sil & faixa & ~ndimage.binary_dilation(deriva, iterations=2) & ~outros
    rot, n = ndimage.label(livre)
    if n == 0:
        return None
    tam = ndimage.sum(livre, rot, range(1, n + 1))
    alvo = rot == (int(np.argmax(tam)) + 1)
    if alvo.sum() < 200:
        return None
    ys, xs = np.where(alvo)
    return int(np.median(xs)), int(np.median(ys))


def avaliar(m, sil, deriva):
    if not m.any():
        return "vazio"
    if m.sum() < MIN_PX:
        return f"pequeno demais ({int(m.sum())}px)"
    if m.sum() / sil.sum() > MAX_FRACAO_SIL:
        return f"{m.sum() / sil.sum():.0%} da silhueta"
    if (m & deriva).sum() / m.sum() > 0.25:
        return "é a deriva"
    if (m & ~ndimage.binary_dilation(sil, iterations=2)).sum() > MAX_FORA:
        return "sangra para fora do avião"
    # estabilizador é deitado: mais largo que alto, sempre
    ys, xs = np.where(m)
    if (xs.max() - xs.min() + 1) < 1.6 * (ys.max() - ys.min() + 1):
        return "não é deitado"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only")
    args = ap.parse_args()

    import torch  # noqa: F401
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from derive_sectors import lado_do_nariz

    preditor = SAM2ImagePredictor(build_sam2(CFG, CKPT, device="cpu"))
    os.makedirs(args.out, exist_ok=True)

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "tailmasks")) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    passou = reprovou = 0
    for i, aid in enumerate(aids, 1):
        deriva = mc.carregar_mask(os.path.join(args.root, "tailmasks", f"{aid}.png"))
        if not deriva.any():
            continue
        foto = mc.achar_foto(args.photos, aid)
        sil = mc.silhueta(foto)
        nariz = lado_do_nariz(sil, args.root, aid)
        caixa = caixa_do_estabilizador(deriva, sil, nariz)

        # o estabilizador não pode invadir peça que já tem dono
        outros = np.zeros_like(sil)
        for s_ in ("wingmasks", "enginemasks", "gearmasks", "wingletmasks"):
            p_ = os.path.join(args.root, s_, f"{aid}.png")
            if os.path.exists(p_):
                outros |= mc.carregar_mask(p_)

        pt = semente(sil, deriva, caixa, outros)
        # Ponto negativo no tubo da fuselagem, logo acima do estabilizador. Sem
        # ele o SAM2 devolve estabilizador **mais** a traseira da fuselagem, que
        # é contínua com ele na foto: conferido no b737, no e190 e no a388.
        dys, dxs = np.where(deriva)
        neg = (int(np.median(dxs)), int(dys.max() - 0.10 * (dys.max() - dys.min())))
        if pt is None:
            print(f"[{i}/{len(aids)}] {aid:10s} sem estabilizador visível", flush=True)
            continue

        arr = np.array(Image.open(foto).convert("RGB"))
        preditor.set_image(arr)
        masks, _, _ = preditor.predict(
            point_coords=np.array([pt, neg]), point_labels=np.array([1, 0]),
            box=np.array(caixa, dtype=float), multimask_output=True,
        )

        recorte = np.zeros_like(sil)
        recorte[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
        aprovados, motivos = [], []
        for k in range(masks.shape[0]):
            m = masks[k].astype(bool) & recorte & sil & ~ndimage.binary_dilation(outros, iterations=1)
            m &= ~ndimage.binary_dilation(deriva, iterations=1)
            rot, n = ndimage.label(m)
            if n == 0:
                motivos.append("vazio")
                continue
            if n > 1:
                tam = ndimage.sum(m, rot, range(1, n + 1))
                m = rot == (int(np.argmax(tam)) + 1)
            m = ndimage.binary_fill_holes(m)
            motivo = avaliar(m, sil, deriva)
            if motivo:
                motivos.append(motivo)
            else:
                aprovados.append((int(m.sum()), m))

        if not aprovados:
            reprovou += 1
            print(f"[{i}/{len(aids)}] {aid:10s} REPROVA  {' / '.join(motivos)}", flush=True)
        else:
            aprovados.sort(key=lambda t: -t[0])
            n, m = aprovados[0]
            passou += 1
            mc.salvar_mask(m, os.path.join(args.out, f"{aid}.png"))
            print(f"[{i}/{len(aids)}] {aid:10s} ok  {n:6d}px", flush=True)

    print(f"\n{passou} passaram, {reprovou} reprovaram")


if __name__ == "__main__":
    main()
