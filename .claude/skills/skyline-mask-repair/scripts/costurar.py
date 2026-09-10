"""Fecha o sulco sem dono entre setores vizinhos.

`recompute_sector.py` dilata o vizinho 2px antes de subtrair, para as bordas não
se encostarem e sair cor dupla. O preço é um sulco de 1 a 2px em volta do motor
e do trem que **não é de ninguém** — e como a fuselagem é pintada como retângulo
recortado pela silhueta inteira, é a cor de fuselagem que aparece ali. No jogo
isso se vê como um risco de cor de fuselagem contornando o motor por cima da
asa. Foi assim que o problema apareceu.

Costurar é dar cada pixel órfão ao setor mais perto, com duas condições: até 3px
de distância e **com dois donos por perto**. A segunda é o que faz a coisa
funcionar. Sem ela cada setor cresce 3px para todo lado, inclusive na divisa
aberta com a fuselagem, e a asa passa a comer barriga — medido, 4.377px no a320
contra os poucos centos de um sulco de verdade. Sulco de recorte tem vizinho dos
dois lados; divisa com a fuselagem, não.

O pneu não entra na disputa mas conta como dono: `gearmasks` inteiro reivindica
os órfãos em volta dele, então a costura nunca pinta borracha.

    python3 costurar.py --dry-run
    python3 costurar.py --write
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

# Quem pode crescer para dentro do sulco.
CRESCEM = ["wingmasks", "enginemasks", "tailmasks", "wingletmasks"]
# Quem só reivindica, sem crescer: o trem inteiro, para a roda ficar de fora.
RESERVAM = ["gearmasks", "cockpitmasks"]
ALCANCE = 3


def costurar(sil, donos, reservas):
    """Dá cada órfão ao dono mais perto, até ALCANCE pixels."""
    ocupado = np.zeros_like(sil)
    for m in list(donos.values()) + reservas:
        ocupado |= m
    orfao = sil & ~ocupado
    if not orfao.any():
        return {}, 0

    nomes = list(donos)
    # distância de cada pixel a cada dono: o mais perto leva
    dists = np.stack([ndimage.distance_transform_edt(~donos[n]) for n in nomes])
    perto = dists.min(axis=0)
    vencedor = dists.argmin(axis=0)

    # órfão colado numa reserva fica com ela: sulco entre o trem e a asa é do
    # trem, e a asa não deve avançar por cima da roda
    reserva = np.zeros_like(sil)
    for m in reservas:
        reserva |= m
    d_reserva = ndimage.distance_transform_edt(~reserva) if reserva.any() else np.full(sil.shape, np.inf)

    # Dois donos por perto: é o que separa sulco de divisa aberta. Reserva conta
    # como dono, senão o sulco entre a asa e o trem não fecharia.
    vizinhos = (dists <= ALCANCE).sum(axis=0) + (d_reserva <= ALCANCE).astype(int)

    alvo = orfao & (perto <= ALCANCE) & (perto <= d_reserva) & (vizinhos >= 2)
    saida, total = {}, 0
    for i, n in enumerate(nomes):
        ganho = alvo & (vencedor == i)
        if ganho.any():
            saida[n] = donos[n] | ganho
            total += int(ganho.sum())
    return saida, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "wingmasks")) if f.endswith(".png"))
    total = 0
    for aid in aids:
        foto = mc.achar_foto(args.photos, aid)
        if not foto:
            continue
        sil = mc.silhueta(foto)

        donos = {}
        for s in CRESCEM:
            p = os.path.join(args.root, s, f"{aid}.png")
            if os.path.exists(p):
                m = mc.carregar_mask(p)
                if m.any():
                    donos[s] = m
        reservas = []
        for s in RESERVAM:
            p = os.path.join(args.root, s, f"{aid}.png")
            if os.path.exists(p):
                reservas.append(mc.carregar_mask(p))
        if not donos:
            continue

        novos, n = costurar(sil, donos, reservas)
        if not n:
            continue
        total += n
        print(f"  {aid:10s} +{n}px  " + " ".join(
            f"{k.replace('masks', '')}+{int((novos[k] & ~donos[k]).sum())}" for k in novos))
        if args.write:
            for s, m in novos.items():
                mc.salvar_mask(m, os.path.join(args.root, s, f"{aid}.png"))
    print(f"{total}px costurados")


if __name__ == "__main__":
    main()
