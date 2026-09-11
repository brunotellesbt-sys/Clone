"""Mede as duas divisas que cortam a fuselagem em dorso, cabine e barriga.

Grava `public/sprites/fusebands.json` com as duas linhas por aeronave, em
fração da altura da imagem. **De propósito não gera PNG.** A arte pinta a
fuselagem como retângulo recortado pela silhueta inteira, com as peças por
cima; faixa recortada por `fuselagemasks` abriria o mesmo anel de foto crua de
1 a 2% da silhueta que já foi medido e rejeitado. Faixa reta sobre a silhueta
não tem esse problema, e é como a barriga e o cheat já funcionam.


É como uma livery de verdade é composta: a chapa acima da fileira de janela
(dorso/crown), a faixa da cabine onde ficam as janelas e o letreiro, e a
barriga, abaixo da linha do motor. Pintadas separadamente, saem dali sozinhas a
faixa de cintura, o dorso branco com barriga cinza e quase todo esquema clássico.

As duas divisas saem de medida, não de fração chutada:

- **em cima**, o topo da fileira de janela. As janelas são o único preto pequeno
  e compacto espalhado ao longo da fuselagem; a mesma ideia do `cockpitmasks`,
  só que sem restringir ao nariz;
- **embaixo**, o centro vertical da nacela — é o que "abaixo do motor" quer
  dizer numa vista lateral, e é onde a linha de barriga cai na maioria das
  liveries reais.

Sem motor utilizável (motor na cauda, turboélice de asa alta) a divisa de baixo
cai para 62% da altura da fuselagem, que é a mesma fração que o editor já usa
como padrão do controle "onde a barriga começa".

    python3 faixas_fuselagem.py
    python3 faixas_fuselagem.py --write
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

FRACAO_BARRIGA = 0.62


def fileira_de_janela(fus, lum):
    """Topo e base da fileira de janela, ou None quando não há janela visível.

    O limiar é **relativo à própria fuselagem**, não fixo. Com 90 fixo, 19 dos
    55 não achavam janela nenhuma: nos sprites mais claros (a família A320, o
    a333, os 787) a janela fica em torno de 110-130 e passava batido.
    """
    dentro = lum[fus]
    if dentro.size == 0:
        return None
    limiar = max(60.0, float(np.median(dentro)) - 55.0)
    escuro = (lum < limiar) & fus
    rot, n = ndimage.label(escuro)
    if n == 0:
        return None
    tam = ndimage.sum(escuro, rot, range(1, n + 1))
    topos, bases = [], []
    for i, t in enumerate(tam):
        if not (25 <= t <= 700):
            continue
        ys, xs = np.where(rot == i + 1)
        h = ys.max() - ys.min() + 1
        w = xs.max() - xs.min() + 1
        # janela é uma chapa pequena e cheia; risco de painel é fio comprido
        if not (0.4 <= w / h <= 2.5) or t / (h * w) <= 0.5:
            continue
        topos.append(ys.min())
        bases.append(ys.max())
    if len(topos) < 4:
        return None
    # percentil, não mínimo: uma janela solta fora da fileira não move a divisa
    return float(np.percentile(topos, 15)), float(np.percentile(bases, 85))


def linha_do_motor(root, aid, fus):
    """Onde a barriga começa: o centro vertical da nacela."""
    p = os.path.join(root, "enginemasks", f"{aid}.png")
    fy = np.where(fus.any(axis=1))[0]
    y0, y1 = fy.min(), fy.max()
    if os.path.exists(p):
        m = mc.carregar_mask(p)
        if m.any():
            ys = np.where(m.any(axis=1))[0]
            cy = (ys.min() + ys.max()) / 2
            # só vale se cair dentro da fuselagem: motor de cauda e turboélice
            # de asa alta ficam fora e não servem de referência
            if y0 < cy < y1:
                return cy
    return y0 + FRACAO_BARRIGA * (y1 - y0)


def faixas(fus, lum, root, aid):
    fy = np.where(fus.any(axis=1))[0]
    y0, y1 = fy.min(), fy.max()
    janela = fileira_de_janela(fus, lum)
    topo = janela[0] if janela else y0 + 0.30 * (y1 - y0)
    barriga = linha_do_motor(root, aid, fus)
    # o motor pode cair acima da janela em alguns enquadramentos; a ordem das
    # faixas não pode inverter
    barriga = max(barriga, topo + 0.15 * (y1 - y0))

    dorso = fus.copy()
    dorso[int(topo):] = False
    baixo = fus.copy()
    baixo[:int(barriga)] = False
    meio = fus & ~dorso & ~baixo
    return dorso, meio, baixo, (topo, barriga, bool(janela))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    import json
    bandas = {}
    sem_janela = []
    for f in sorted(os.listdir(os.path.join(args.root, "fuselagemasks"))):
        if not f.endswith(".png"):
            continue
        aid = f[:-4]
        fus = mc.carregar_mask(os.path.join(args.root, "fuselagemasks", f))
        if not fus.any():
            continue
        lum = np.array(Image.open(mc.achar_foto(args.photos, aid)).convert("L"))
        d, m, b, (topo, barriga, achou) = faixas(fus, lum, args.root, aid)
        if not achou:
            sem_janela.append(aid)
        h = fus.shape[0]
        bandas[aid] = {"crown": round(topo / h, 5), "belly": round(barriga / h, 5),
                       **({} if achou else {"janela": False})}
        print(f"  {aid:10s} dorso {int(d.sum()):6d}  cabine {int(m.sum()):6d}  barriga {int(b.sum()):6d}"
              f"   janela y={topo:.0f} motor y={barriga:.0f}{'' if achou else '  (sem janela)'}")

    if args.write:
        destino = os.path.join(args.root, "fusebands.json")
        with open(destino, "w") as fh:
            json.dump(bandas, fh, indent=1, sort_keys=True)
        print(f"\n{destino}: {len(bandas)} aeronaves")
    if sem_janela:
        print(f"sem fileira de janela detectada ({len(sem_janela)}): {' '.join(sem_janela)}")


if __name__ == "__main__":
    main()
