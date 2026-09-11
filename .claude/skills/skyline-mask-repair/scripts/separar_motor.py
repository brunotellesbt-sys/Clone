"""Separa a carenagem pintável do núcleo metálico do motor.

O que a livery pinta numa nacela é a **carenagem**: a chapa lisa do fan cowl e
do thrust reverser. O bocal de escape, o plug e o fan não levam tinta de
companhia nenhuma — são metal exposto, e pintados de azul o motor fica de
brinquedo, do mesmo jeito que o pneu e a pá de hélice.

O corte é **geométrico, não de cor**. Duas medidas foram tentadas antes e não
generalizam, para não serem repetidas:

- **luminância**: o bocal é escuro, mas a sombra da barriga da nacela e a do
  pilone também são, e essas são chapa pintável. Pegava 17% a 34% da máscara,
  quase tudo no lugar errado;
- **temperatura de cor**: o bocal do b737 puxa para o bronze, mas isso é dele.
  Medido nas fotos, `R-B` fica em 0 no `a333`, no `b788` e no `crj900` — o
  teste acha 0% do núcleo nesses três.

O que separa de verdade é a **silhueta**: a carenagem é um platô alto e o bocal
um degrau que cai para menos da metade da altura, na ponta de trás. No `b737` o
platô tem 95px e o bocal 45px, com a transição em oito colunas.

    python3 separar_motor.py
    python3 separar_motor.py --write
"""

import argparse
import os
import sys

import numpy as np
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

FRACAO_DEGRAU = 0.58   # abaixo disto da altura do platô já é bocal
MIN_SEGUIDAS = 6       # colunas seguidas abaixo do degrau, para não cair em ruído
MIN_NUCLEO = 250


def perfil_do_corpo(motor):
    """Altura por coluna do corpo principal da nacela."""
    rot, n = ndimage.label(motor)
    if n == 0:
        return None, None
    tam = ndimage.sum(motor, rot, range(1, n + 1))
    corpo = rot == (int(np.argmax(tam)) + 1)
    return corpo, corpo.sum(axis=0)


def nucleo(motor, nariz):
    """O bocal: o degrau na ponta oposta ao nariz.

    O plug e o bocal ficam atrás; no turboélice, a hélice e o spinner ficam na
    frente, mas esses já saem antes, no `tirar_helice.py`.
    """
    corpo, alt = perfil_do_corpo(motor)
    if corpo is None:
        return np.zeros_like(motor)
    xs = np.where(alt > 0)[0]
    if len(xs) < 40:
        return np.zeros_like(motor)
    plato = float(np.percentile(alt[xs], 90))
    if plato < 20:
        return np.zeros_like(motor)
    limite = FRACAO_DEGRAU * plato

    # varre do pico em direção à cauda; a cauda é o lado oposto ao nariz
    pico = int(xs[np.argmax(alt[xs])])
    passo = -1 if nariz > 0 else 1
    corte = None
    seguidas = 0
    x = pico
    while xs.min() <= x + passo <= xs.max():
        x += passo
        if alt[x] < limite:
            seguidas += 1
            if seguidas >= MIN_SEGUIDAS:
                corte = x - passo * (MIN_SEGUIDAS - 1)
                break
        else:
            seguidas = 0
    if corte is None:
        return np.zeros_like(motor)

    faixa = np.zeros_like(motor)
    if passo < 0:
        faixa[:, :corte + 1] = True
    else:
        faixa[:, corte:] = True
    nu = motor & faixa
    if nu.sum() < MIN_NUCLEO:
        return np.zeros_like(motor)
    return nu


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from derive_sectors import lado_do_nariz

    destino = os.path.join(args.root, "enginecowlmasks")
    if args.write:
        os.makedirs(destino, exist_ok=True)

    vazios = []
    for f in sorted(os.listdir(os.path.join(args.root, "enginemasks"))):
        if not f.endswith(".png"):
            continue
        aid = f[:-4]
        motor = mc.carregar_mask(os.path.join(args.root, "enginemasks", f))
        if not motor.any():
            continue
        sil = mc.silhueta(mc.achar_foto(args.photos, aid))
        nu = nucleo(motor, lado_do_nariz(sil, args.root, aid))
        pele = motor & ~nu
        if not nu.any():
            vazios.append(aid)
        print(f"  {aid:10s} carenagem {int(pele.sum()):6d}  núcleo {int(nu.sum()):6d} ({nu.sum() / motor.sum():4.0%})")
        if args.write:
            mc.salvar_mask(pele, os.path.join(destino, f))
    if vazios:
        print(f"\nsem núcleo achado ({len(vazios)}): {' '.join(vazios)}")


if __name__ == "__main__":
    main()
