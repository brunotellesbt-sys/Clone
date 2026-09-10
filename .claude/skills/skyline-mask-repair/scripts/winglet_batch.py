"""Recorta o dispositivo de ponta de asa com SAM2, com teste de aceite objetivo.

Winglet, sharklet, wingtip fence, ponta raked, aleta pequena — tudo que fica
além da quebra da asa e hoje está sendo pintado como fuselagem.

O que torna isto viável em lote é o **portão**: cada recorte é medido contra a
foto e só passa quem cabe no que um dispositivo de ponta pode ser. O que não
passa fica de fora e vai para conferência à mão, em vez de entrar torto.

Derivar por geometria foi tentado duas vezes e não dá: o dispositivo encosta na
asa e, no disco em volta da ponta, sai grudado na fuselagem.

    python3 winglet_batch.py --out /tmp/winglet --pontas /tmp/tips/pontas.txt
    python3 winglet_batch.py --out /tmp/winglet --only a320neo,b38m
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

# O que um dispositivo de ponta pode ser, medido. Fora disso é outra coisa —
# quase sempre um pedaço de fuselagem que o SAM2 agarrou junto.
MIN_PX, MAX_PX = 150, 14000
MAX_FORA = 40
MAX_SOBRE_ASA = 400
MIN_ADER = 0.55


def ponta_da_asa(asa):
    """Onde fica a ponta da asa.

    Na vista lateral destas fotos a asa sobe da raiz para a ponta, então a ponta
    é o extremo mais alto do eixo de envergadura. Comparar a corda dos dois
    extremos não serve: a raiz já vem recortada pelo motor e sai estreita.
    """
    ys, xs = np.where(asa)
    pts = np.stack([xs - xs.mean(), ys - ys.mean()])
    _, vecs = np.linalg.eigh(np.cov(pts))
    env = vecs[:, -1]
    s = pts[0] * env[0] + pts[1] * env[1]
    lo, hi = s < np.percentile(s, 8), s > np.percentile(s, 92)
    sel = hi if ys[hi].mean() < ys[lo].mean() else lo
    return int(xs[sel].mean()), int(ys[sel].mean())


def semente(sil, asa, caixa):
    """Um pixel que está no dispositivo, para o SAM2 partir dele.

    O que sobra da silhueta acima da ponta, tirada a asa, é o dispositivo. Não
    precisa estar inteiro nem separado do resto — basta um ponto certo.
    """
    bx0, by0, bx1, by1 = caixa
    jan = np.zeros_like(sil)
    jan[by0:by1, bx0:bx1] = True
    resto = sil & ~ndimage.binary_dilation(asa, iterations=2) & jan
    if not resto.any():
        return None
    ys, xs = np.where(resto)
    # terço superior: o dispositivo sobe, e o que está colado na asa é asa
    corte = np.percentile(ys, 35)
    alto = ys <= corte
    return int(np.median(xs[alto])), int(np.median(ys[alto]))


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

    preditor = SAM2ImagePredictor(build_sam2(CFG, CKPT, device="cpu"))
    os.makedirs(args.out, exist_ok=True)

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "wingmasks")) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    passou = reprovou = 0
    for i, aid in enumerate(aids, 1):
        asa = mc.carregar_mask(os.path.join(args.root, "wingmasks", f"{aid}.png"))
        if not asa.any():
            print(f"[{i}/{len(aids)}] {aid:10s} sem asa")
            continue
        foto = mc.achar_foto(args.photos, aid)
        sil, forte = mc.silhueta(foto), mc.borda_forte(foto)
        tx, ty = ponta_da_asa(asa)
        h, w = asa.shape
        caixa = (max(0, tx - 85), max(0, ty - 105), min(w, tx + 85), min(h, ty + 35))
        pt = semente(sil, asa, caixa)
        if pt is None:
            print(f"[{i}/{len(aids)}] {aid:10s} sem dispositivo na ponta")
            continue

        arr = np.array(Image.open(foto).convert("RGB"))
        preditor.set_image(arr)
        masks, scores, _ = preditor.predict(
            point_coords=np.array([pt]), point_labels=np.array([1]),
            box=np.array(caixa, dtype=float), multimask_output=True,
        )
        k = int(np.argmax(scores))
        m = masks[k].astype(bool)
        recorte = np.zeros_like(m)
        recorte[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
        m &= recorte & sil & ~asa
        rot, n = ndimage.label(m)
        if n > 1:
            tam = ndimage.sum(m, rot, range(1, n + 1))
            m = rot == (int(np.argmax(tam)) + 1)
        m = ndimage.binary_fill_holes(m)

        med = mc.medir(m, sil, forte, {"wingmasks": asa})
        motivo = None
        if not (MIN_PX <= med["px"] <= MAX_PX):
            motivo = f"tamanho {med['px']}px"
        elif med["fora"] > MAX_FORA:
            motivo = f"sangra {med['fora']}px"
        elif med["sobrepoe"].get("wingmasks", 0) > MAX_SOBRE_ASA:
            motivo = f"invade a asa {med['sobrepoe']['wingmasks']}px"
        elif med["ader"] < MIN_ADER:
            motivo = f"aderência {med['ader']:.0%}"

        if motivo:
            reprovou += 1
            print(f"[{i}/{len(aids)}] {aid:10s} REPROVA  {motivo}  (score {scores[k]:.2f})")
        else:
            passou += 1
            mc.salvar_mask(m, os.path.join(args.out, f"{aid}.png"))
            print(f"[{i}/{len(aids)}] {aid:10s} ok  {med['px']:5d}px  ader {med['ader']:.0%}  "
                  f"fora {med['fora']}  score {scores[k]:.2f}")

    print(f"\n{passou} passaram, {reprovou} reprovaram")


if __name__ == "__main__":
    main()
