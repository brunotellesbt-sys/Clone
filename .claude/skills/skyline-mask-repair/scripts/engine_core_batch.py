"""Recorta o núcleo metálico do motor com SAM2 — bocal, plug e fan.

O que a livery pinta numa nacela é a **carenagem**. O bocal de escape e o plug
são metal exposto e não levam cor de companhia, do mesmo jeito que o pneu e a
pá de hélice.

Antes de chegar aqui, duas medidas mais baratas foram tentadas e falharam. Não
repetir:

- **cor** não separa. O bocal é escuro, mas a sombra da barriga da nacela e a do
  pilone também, e essas são chapa pintável; e a temperatura de cor (`R-B`) fica
  em zero no `a333`, no `b788` e no `crj900`;
- **degrau de altura por coluna** — a carenagem é um platô e o bocal um degrau —
  funciona no `b737` e no `a320`, mas o pilone entra na máscara do motor e
  quebra o perfil: 11 dos 55 não achavam degrau nenhum e outros tantos
  exageravam para dentro da asa.

O que sobra é recortar a peça, e para isso a ferramenta é o SAM2.

    python3 engine_core_batch.py --out /tmp/core
    python3 engine_core_batch.py --out /tmp/core --only b737,a320
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

MIN_FRACAO, MAX_FRACAO = 0.03, 0.45   # do tamanho da nacela
MIN_PX = 300


def traseira(motor, nariz, fracao=0.45):
    """Caixa da ponta de trás da nacela, onde fica o bocal."""
    ys, xs = np.where(motor)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    comp = x1 - x0 + 1
    if nariz > 0:  # nariz à direita: a traseira é para a esquerda
        x1 = int(x0 + fracao * comp)
    else:
        x0 = int(x1 - fracao * comp)
    return int(x0), int(y0), int(x1), int(y1)


def semente(motor, lum, caixa):
    """O pixel mais escuro da traseira: o bocal é sempre a parte escura dali."""
    faixa = np.zeros_like(motor)
    faixa[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
    alvo = motor & faixa
    if not alvo.any():
        return None
    v = np.where(alvo, lum, 1e9)
    # mediana dos 200 mais escuros, para não cair num pixel solto de ruído
    idx = np.argsort(v, axis=None)[:200]
    ys, xs = np.unravel_index(idx, v.shape)
    return int(np.median(xs)), int(np.median(ys))


def avaliar(nu, motor, caixa):
    if not nu.any():
        return "vazio"
    if nu.sum() < MIN_PX:
        return f"pequeno demais ({int(nu.sum())}px)"
    fr = nu.sum() / motor.sum()
    if not (MIN_FRACAO <= fr <= MAX_FRACAO):
        return f"{fr:.0%} da nacela"
    # tem que encostar na ponta de trás, senão é uma mancha no meio da chapa
    xs = np.where(nu.any(axis=0))[0]
    if min(abs(xs.min() - caixa[0]), abs(xs.max() - caixa[2])) > 12:
        return "não encosta na ponta"
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

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "enginemasks")) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    passou = reprovou = 0
    for i, aid in enumerate(aids, 1):
        motor = mc.carregar_mask(os.path.join(args.root, "enginemasks", f"{aid}.png"))
        if not motor.any():
            continue
        foto = mc.achar_foto(args.photos, aid)
        sil = mc.silhueta(foto)
        lum = np.array(Image.open(foto).convert("L")).astype(float)
        nariz = lado_do_nariz(sil, args.root, aid)
        caixa = traseira(motor, nariz)
        pt = semente(motor, lum, caixa)
        if pt is None:
            print(f"[{i}/{len(aids)}] {aid:10s} sem traseira", flush=True)
            continue

        arr = np.array(Image.open(foto).convert("RGB"))
        preditor.set_image(arr)
        masks, _, _ = preditor.predict(
            point_coords=np.array([pt]), point_labels=np.array([1]),
            box=np.array(caixa, dtype=float), multimask_output=True,
        )

        aprovados, motivos = [], []
        for k in range(masks.shape[0]):
            # o núcleo é sempre parte da nacela: recortar pela própria máscara
            # do motor evita que ele escape para a asa ou para o trem
            nu = masks[k].astype(bool) & motor
            rot, n = ndimage.label(nu)
            if n > 1:
                tam = ndimage.sum(nu, rot, range(1, n + 1))
                nu = rot == (int(np.argmax(tam)) + 1)
            nu = ndimage.binary_fill_holes(nu)
            motivo = avaliar(nu, motor, caixa)
            if motivo:
                motivos.append(motivo)
            else:
                aprovados.append((int(nu.sum()), nu))

        if not aprovados:
            reprovou += 1
            print(f"[{i}/{len(aids)}] {aid:10s} REPROVA  {' / '.join(motivos)}", flush=True)
        else:
            # o menor que passa: o bocal, não o bocal mais meia carenagem
            aprovados.sort(key=lambda t: t[0])
            n, nu = aprovados[0]
            passou += 1
            mc.salvar_mask(nu, os.path.join(args.out, f"{aid}.png"))
            print(f"[{i}/{len(aids)}] {aid:10s} ok  núcleo {n:6d}px ({n / motor.sum():4.0%})", flush=True)

    print(f"\n{passou} passaram, {reprovou} reprovaram")


if __name__ == "__main__":
    main()
