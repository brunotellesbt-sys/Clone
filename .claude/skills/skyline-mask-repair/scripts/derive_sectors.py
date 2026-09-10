"""Deriva os setores que não precisam de SAM2.

Três não precisam de segmentação nenhuma, porque saem de geometria:

- **fuselagem**: é o avião menos todos os outros setores. Subtração pura.
- **cabine de comando**: as janelas do cockpit são o único preto perto do nariz.
- **bordo de ataque, dorso e bordo de fuga**: são faixas da própria asa, medidas
  ao longo da corda. Não são recortes novos — são divisões do setor da asa.

    python3 derive_sectors.py --aid a320 --what fuselage,cockpit,wingbands
    python3 derive_sectors.py --all --what fuselage
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

SETORES_PECA = ["wingmasks", "enginemasks", "gearmasks", "tailmasks", "wingletmasks"]
MIN_COMPONENTE = 400
# Fração da corda que conta como bordo. 18% é o que o desenho aeronáutico chama
# de bordo sem virar "meia asa"; o resto é dorso.
FRACAO_BORDO = 0.18


def lado_do_nariz(sil, raiz, aid):
    """+1 se o nariz está à direita na imagem, -1 se à esquerda.

    A deriva é o ponto mais alto do avião e fica sempre na cauda, então o nariz
    é a ponta oposta a ela. Usa a máscara de cauda quando existe; senão, cai no
    topo da silhueta, que dá no mesmo.
    """
    p = os.path.join(raiz, "tailmasks", f"{aid}.png")
    if os.path.exists(p):
        m = mc.carregar_mask(p)
        if m.any():
            _, xs = np.where(m)
            cauda_x = xs.mean()
        else:
            cauda_x = None
    else:
        cauda_x = None
    ys, xs = np.where(sil)
    if cauda_x is None:
        cauda_x = xs[ys < np.percentile(ys, 5)].mean()
    centro = (xs.min() + xs.max()) / 2
    return -1 if cauda_x > centro else +1


def fuselagem(sil, outros):
    """O avião menos as peças. O que sobra é corpo."""
    corpo = sil.copy()
    for m in outros:
        corpo &= ~ndimage.binary_dilation(m, iterations=1)
    rot, n = ndimage.label(corpo)
    if n == 0:
        return corpo
    tam = ndimage.sum(corpo, rot, range(1, n + 1))
    # a asa corta a fuselagem em frente e trás na vista lateral: os dois pedaços
    # são fuselagem, então não dá para ficar só com o maior
    return np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= MIN_COMPONENTE])


def cabine(photo_path, sil, nariz):
    """As janelas do cockpit: o único preto perto do nariz."""
    lum = np.array(Image.open(photo_path).convert("L"))
    ys, xs = np.where(sil)
    x0, x1 = xs.min(), xs.max()
    comprimento = x1 - x0
    faixa = np.zeros_like(sil)
    if nariz > 0:
        faixa[:, int(x1 - 0.12 * comprimento):x1 + 1] = True
    else:
        faixa[:, x0:int(x0 + 0.12 * comprimento) + 1] = True
    # Metade de cima da fuselagem, medida **na própria faixa do nariz**: usar o
    # centro vertical do avião inteiro puxaria o corte para cima, porque a
    # deriva é bem mais alta que a fuselagem, e o cockpit ficaria de fora.
    col = sil & faixa
    if not col.any():
        return np.zeros_like(sil)
    nys, _ = np.where(col)
    meio = (nys.min() + nys.max()) / 2
    faixa[int(meio) + 1:, :] = False

    # As janelas do cockpit são quase pretas (luminância 2 no a320). O contorno
    # da porta dianteira, que cai na mesma faixa, fica bem mais claro — daí o
    # limiar apertado, senão a cabine engole a porta.
    escuro = (lum < 90) & sil & faixa
    if not escuro.any():
        return escuro
    escuro = ndimage.binary_closing(escuro, iterations=3)
    escuro = ndimage.binary_fill_holes(escuro)
    rot, n = ndimage.label(escuro)
    if n == 0:
        return escuro
    tam = ndimage.sum(escuro, rot, range(1, n + 1))
    manter = []
    for i, t in enumerate(tam):
        if t < 60:
            continue
        ys_c, xs_c = np.where(rot == i + 1)
        largura = xs_c.max() - xs_c.min() + 1
        altura = ys_c.max() - ys_c.min() + 1
        # janela é uma chapa, não um fio: risco fino é contorno de porta
        if t / max(largura, altura) >= 3:
            manter.append(i + 1)
    return np.isin(rot, manter)


def faixas_da_asa(asa, nariz, estacoes=60):
    """Divide a asa em bordo de ataque, dorso e bordo de fuga.

    A asa é alongada, então a direção de maior variância é a envergadura e a
    perpendicular é a corda — isso sai de uma PCA dos próprios pixels, sem
    precisar saber nada do modelo. A corda é normalizada **estação por
    estação**, porque a asa afina da raiz para a ponta e uma fração global
    daria bordo grosso na raiz e fino na ponta.

    O bordo de ataque é o lado da corda que aponta para o nariz.
    """
    ys, xs = np.where(asa)
    if len(ys) < 200:
        vazio = np.zeros_like(asa)
        return vazio, vazio, vazio, "vazia"

    pts = np.stack([xs - xs.mean(), ys - ys.mean()])
    _, vecs = np.linalg.eigh(np.cov(pts))
    envergadura = vecs[:, -1]  # maior variância
    corda = vecs[:, 0]

    # Orientar a corda. Na vista lateral destas fotos a asa está encurtada: o
    # eixo da corda sai quase vertical em todos os modelos medidos (componente
    # horizontal de 0,06 no atr72 a 0,24 no b748). Ou seja, o bordo de ataque é
    # a **aresta de cima** da asa e o de fuga a de baixo — é o que se vê de uma
    # asa fotografada um pouco por cima.
    #
    # O ramo do nariz fica como rede de segurança para foto em planta, onde a
    # corda teria componente horizontal grande e quem manda é a direção de voo.
    # Hoje ele não dispara em nenhum dos 55.
    if abs(corda[0]) < 0.35:
        convencao = "perfil"
        if corda[1] > 0:  # y cresce para baixo: negativo é para cima
            corda = -corda
    else:
        convencao = "planta"
        if corda[0] * nariz < 0:
            corda = -corda

    s = pts[0] * envergadura[0] + pts[1] * envergadura[1]
    c = pts[0] * corda[0] + pts[1] * corda[1]

    amplitude = max(float(s.max() - s.min()), 1e-9)
    bins = np.clip(((s - s.min()) / amplitude * (estacoes - 1)).astype(int), 0, estacoes - 1)
    cmin = np.full(estacoes, np.inf)
    cmax = np.full(estacoes, -np.inf)
    np.minimum.at(cmin, bins, c)
    np.maximum.at(cmax, bins, c)
    largura = np.maximum(cmax - cmin, 1e-9)
    # normalizado: 0 no bordo de fuga, 1 no bordo de ataque
    t = (c - cmin[bins]) / largura[bins]

    saida = []
    for sel in (t >= 1 - FRACAO_BORDO, (t > FRACAO_BORDO) & (t < 1 - FRACAO_BORDO), t <= FRACAO_BORDO):
        m = np.zeros_like(asa)
        m[ys[sel], xs[sel]] = True
        saida.append(ndimage.binary_closing(m, iterations=1))
    return (*saida, convencao)  # ataque, dorso, fuga, convenção usada


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--aid")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--what", default="fuselage,cockpit,wingbands")
    args = ap.parse_args()

    quero = set(args.what.split(","))
    aids = ([f[:-4] for f in sorted(os.listdir(os.path.join(args.root, "wingmasks"))) if f.endswith(".png")]
            if args.all else [args.aid])

    for aid in aids:
        foto = mc.achar_foto(args.photos, aid)
        if not foto:
            continue
        sil = mc.silhueta(foto)
        nariz = lado_do_nariz(sil, args.root, aid)

        pecas = []
        for s in SETORES_PECA:
            p = os.path.join(args.root, s, f"{aid}.png")
            if os.path.exists(p):
                pecas.append(mc.carregar_mask(p))

        saidas = {}
        extra = ""
        if "fuselage" in quero:
            saidas["fuselagemasks"] = fuselagem(sil, pecas)
        if "cockpit" in quero:
            saidas["cockpitmasks"] = cabine(foto, sil, nariz)
        if "wingbands" in quero:
            pa = os.path.join(args.root, "wingmasks", f"{aid}.png")
            if os.path.exists(pa):
                a, d, f, convencao = faixas_da_asa(mc.carregar_mask(pa), nariz)
                extra = f" corda-{convencao}"
                saidas["leadingedgemasks"] = a
                saidas["wingtopmasks"] = d
                saidas["trailingedgemasks"] = f

        for pasta, m in saidas.items():
            destino = os.path.join(args.root, pasta)
            os.makedirs(destino, exist_ok=True)
            mc.salvar_mask(m, os.path.join(destino, f"{aid}.png"))
        print(f"{aid:10s} nariz {'direita' if nariz > 0 else 'esquerda'}{extra}  " +
              "  ".join(f"{k.replace('masks','')} {int(v.sum())}px" for k, v in saidas.items()))


if __name__ == "__main__":
    main()
