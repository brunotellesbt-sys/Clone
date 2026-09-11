"""Recorta a fileira de janelas de passageiro.

O editor sempre teve "Janelas" e "Cor das janelas", e na arte de foto os dois
não faziam nada: a janela vinha da foto e pronto. Com máscara, os dois passam a
valer — cor escolhida pinta a vidraça, e desligar pinta a janela com a cor da
fuselagem, que é como se apaga uma fileira de janela de verdade (é o que se vê
num cargueiro convertido).

A detecção é a mesma de `faixas_fuselagem.py`, e a divisa da faixa da cabine
sai dela: janela é o preto **pequeno e compacto** espalhado ao longo da
fuselagem. Limiar relativo à própria fuselagem, não fixo — com valor fixo os
sprites mais claros não acham janela nenhuma.

Fica de fora o que é preto e não é janela: porta (alta e estreita), risco de
painel (fio comprido) e a vidraça do cockpit, que já tem setor próprio.

    python3 janelas.py
    python3 janelas.py --write
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

MIN_PX, MAX_PX = 25, 700
MIN_JANELAS = 4


def janelas(fus, lum, cockpit=None):
    dentro = lum[fus]
    if dentro.size == 0:
        return np.zeros_like(fus), 0
    limiar = max(60.0, float(np.median(dentro)) - 55.0)
    escuro = (lum < limiar) & fus
    if cockpit is not None:
        escuro &= ~ndimage.binary_dilation(cockpit, iterations=2)

    rot, n = ndimage.label(escuro)
    if n == 0:
        return np.zeros_like(fus), 0
    tam = ndimage.sum(escuro, rot, range(1, n + 1))
    cand = []
    for i, t in enumerate(tam):
        if not (MIN_PX <= t <= MAX_PX):
            continue
        ys, xs = np.where(rot == i + 1)
        h = ys.max() - ys.min() + 1
        w = xs.max() - xs.min() + 1
        if not (0.4 <= w / h <= 2.5) or t / (h * w) <= 0.5:
            continue
        cand.append((i + 1, (ys.min() + ys.max()) / 2))
    if len(cand) < MIN_JANELAS:
        return np.zeros_like(fus), 0

    # Só o que está **na fileira**: mancha isolada meia fuselagem acima é
    # ventilação ou sombra, não janela. A fileira é estreita em y.
    alturas = np.array([c[1] for c in cand])
    centro = float(np.median(alturas))
    faixa = max(6.0, 1.5 * float(np.median(np.abs(alturas - centro))) + 4)
    manter = [c[0] for c in cand if abs(c[1] - centro) <= faixa]
    if len(manter) < MIN_JANELAS:
        return np.zeros_like(fus), 0
    return np.isin(rot, manter), len(manter)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    destino = os.path.join(args.root, "windowmasks")
    if args.write:
        os.makedirs(destino, exist_ok=True)

    vazios = []
    for f in sorted(os.listdir(os.path.join(args.root, "fuselagemasks"))):
        if not f.endswith(".png"):
            continue
        aid = f[:-4]
        fus = mc.carregar_mask(os.path.join(args.root, "fuselagemasks", f))
        if not fus.any():
            continue
        lum = np.array(Image.open(mc.achar_foto(args.photos, aid)).convert("L"))
        p = os.path.join(args.root, "cockpitmasks", f)
        cab = mc.carregar_mask(p) if os.path.exists(p) else None
        m, n = janelas(fus, lum, cab)
        if not n:
            vazios.append(aid)
        print(f"  {aid:10s} {n:3d} janelas  {int(m.sum()):6d}px")
        if args.write and n:
            mc.salvar_mask(m, os.path.join(destino, f))
    if vazios:
        print(f"\nsem fileira detectada ({len(vazios)}): {' '.join(vazios)}")


if __name__ == "__main__":
    main()
