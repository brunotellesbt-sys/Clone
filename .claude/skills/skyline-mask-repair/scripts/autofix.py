"""Corrige desalinhamento de setor e só aceita o que melhora a medida.

Quatro consertos, do mais seguro para o mais delicado:

  aparar   tira o que caiu fora do avião
  soltar   devolve ao vizinho o pixel que dois setores disputam
  deslocar aplica o deslocamento inteiro medido (erro de 1 a 3px)
  encaixar puxa a borda para cima do contorno real, ponto a ponto

Cada um é medido antes e depois. O que não melhora é revertido — por isso dá
para rodar no catálogo inteiro sem medo. Grava .bak antes de escrever.

    python3 autofix.py --sector wingmasks --dry-run
    python3 autofix.py --sector gearmasks --only an148,b73g
    python3 autofix.py --all
"""

import argparse
import os
import shutil
import sys

import numpy as np
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

# Quem fica por cima quando dois setores disputam o mesmo pixel. Segue o que se
# vê na foto: trem e motor aparecem na frente da asa, então a asa é que cede.
PRIORIDADE = ["gearmasks", "enginemasks", "wingletmasks", "tailmasks", "wingmasks"]


def aparar(mask, sil, **_):
    return mask & ndimage.binary_dilation(sil, iterations=2)


def soltar(mask, setor, vizinhos, **_):
    """Cede o pixel disputado a quem tem prioridade maior."""
    fora = mask.copy()
    meu = PRIORIDADE.index(setor) if setor in PRIORIDADE else len(PRIORIDADE)
    for nome, v in vizinhos.items():
        if v is None:
            continue
        dele = PRIORIDADE.index(nome) if nome in PRIORIDADE else len(PRIORIDADE)
        if dele < meu:
            fora &= ~v
    return fora


def deslocar(mask, forte, **_):
    dx, dy, antes, depois = mc.melhor_deslocamento(mask, forte)
    if (dx, dy) == (0, 0) or antes - depois < 0.25:
        return mask
    return mc.desloca(mask, dx, dy)


def encaixar(mask, forte, alcance=4.0, sigma=6.0, **_):
    """Puxa a borda da máscara para cima do contorno real.

    Trata a máscara como curva de nível: mede, em cada ponto da borda, quanto
    ela precisa andar na direção da normal para cair no contorno mais forte, e
    desloca a curva inteira por esse campo, suavizado. Suavizar importa porque
    ponto isolado erra; o conjunto da borda acerta.

    Onde não há contorno por perto — divisa com o setor vizinho, corte reto na
    chapa lisa — o deslocamento é zero e a borda fica onde está.
    """
    fora_d = ndimage.distance_transform_edt(~mask)
    dentro_d = ndimage.distance_transform_edt(mask)
    assinada = fora_d - dentro_d  # positivo fora, negativo dentro, 0 na borda

    # normal aponta para fora: é o gradiente da distância assinada
    ny, nx = np.gradient(ndimage.gaussian_filter(assinada, 1.0))
    norma = np.hypot(nx, ny)
    norma[norma == 0] = 1

    c = mc.contorno(mask)
    ys, xs = np.where(c)
    if len(ys) < 30:
        return mask

    forca = ndimage.gaussian_filter(forte.astype(np.float64), 0.8)
    passos = np.arange(-alcance, alcance + 0.01, 0.5)
    amostras = []
    for t in passos:
        yy = ys + t * (ny[ys, xs] / norma[ys, xs])
        xx = xs + t * (nx[ys, xs] / norma[ys, xs])
        amostras.append(ndimage.map_coordinates(forca, [yy, xx], order=1, mode="nearest"))
    amostras = np.array(amostras)  # (passos, pontos)

    melhor = amostras.argmax(axis=0)
    valor = amostras.max(axis=0)
    desloc = passos[melhor]
    desloc[valor < mc.LIMIAR_BORDA] = 0.0  # sem contorno por perto: não mexe

    # convolução normalizada: espalha o deslocamento medido pela borda afora
    campo = np.zeros(mask.shape, dtype=np.float64)
    peso = np.zeros(mask.shape, dtype=np.float64)
    campo[ys, xs] = desloc
    peso[ys, xs] = 1.0
    campo = ndimage.gaussian_filter(campo, sigma)
    peso = ndimage.gaussian_filter(peso, sigma)
    campo = np.where(peso > 1e-6, campo / np.maximum(peso, 1e-6), 0.0)

    novo = assinada < campo
    novo = ndimage.binary_fill_holes(novo)
    rot, n = ndimage.label(novo)
    if n > 1:  # o encaixe não pode inventar peça solta
        tam = ndimage.sum(novo, rot, range(1, n + 1))
        novo = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 300])
    return novo


CONSERTOS = [("aparar", aparar), ("soltar", soltar), ("deslocar", deslocar), ("encaixar", encaixar)]


def corrigir(raiz, setor, aid, fotos, cache, dry_run=False):
    caminho = os.path.join(raiz, setor, f"{aid}.png")
    foto = mc.achar_foto(fotos, aid)
    if not foto or not os.path.exists(caminho):
        return None
    if foto not in cache:
        cache[foto] = (mc.silhueta(foto), mc.borda_forte(foto))
    sil, forte = cache[foto]

    vizinhos = {}
    for v in os.listdir(raiz):
        p = os.path.join(raiz, v, f"{aid}.png")
        if v.endswith("masks") and v != setor and os.path.exists(p):
            vizinhos[v] = mc.carregar_mask(p)

    mask = mc.carregar_mask(caminho)
    if not mask.any():
        return None
    antes = mc.medir(mask, sil, forte, vizinhos)
    atual, m_atual = mask, antes
    aplicados = []

    for nome, fn in CONSERTOS:
        cand = fn(mask=atual, sil=sil, forte=forte, setor=setor, vizinhos=vizinhos)
        if cand is atual or cand.sum() == 0 or np.array_equal(cand, atual):
            continue
        m_cand = mc.medir(cand, sil, forte, vizinhos)
        if mc.melhor_que(m_cand, m_atual):
            atual, m_atual = cand, m_cand
            aplicados.append(nome)

    if not aplicados:
        return None
    if not dry_run:
        shutil.copy2(caminho, caminho + ".bak")
        mc.salvar_mask(atual, caminho)
    return {"aid": aid, "setor": setor, "aplicados": aplicados, "antes": antes, "depois": m_atual}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--sector")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    setores = [s for s in PRIORIDADE if os.path.isdir(os.path.join(args.root, s))]
    alvos = setores if args.all else [args.sector]
    if not alvos or alvos == [None]:
        raise SystemExit("use --sector <nome> ou --all")

    cache = {}
    total = 0
    for setor in alvos:
        aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, setor)) if f.endswith(".png"))
        if args.only:
            alvo = set(args.only.split(","))
            aids = [a for a in aids if a in alvo]
        print(f"\n=== {setor}")
        for aid in aids:
            r = corrigir(args.root, setor, aid, args.photos, cache, args.dry_run)
            if not r:
                continue
            total += 1
            a, d = r["antes"], r["depois"]
            print(
                f"  {aid:10s} {'+'.join(r['aplicados']):28s} "
                f"desvio {a['desvio']:.2f}→{d['desvio']:.2f}px  "
                f"ader {a['ader']:.0%}→{d['ader']:.0%}  "
                f"fora {a['fora']}→{d['fora']}  "
                f"disputa {sum(a['sobrepoe'].values())}→{sum(d['sobrepoe'].values())}"
            )
    print(f"\n{total} máscara(s) {'seriam corrigidas' if args.dry_run else 'corrigidas'}")


if __name__ == "__main__":
    main()
