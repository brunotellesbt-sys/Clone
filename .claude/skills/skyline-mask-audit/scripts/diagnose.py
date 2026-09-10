"""Mede o alinhamento de um setor (ou de todos) contra a foto, em pixel.

Serve para qualquer setor — asa, motor, winglet, trem, cauda, fuselagem —
porque a referência é sempre a própria foto: silhueta e contornos.

    python3 diagnose.py --sector wingmasks
    python3 diagnose.py --all
    python3 diagnose.py --sector enginemasks --only a320,b737 --json /tmp/d.json
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import maskcore as mc  # noqa: E402

SETORES = ["wingmasks", "enginemasks", "gearmasks", "tailmasks", "wingletmasks"]

# Sangrar para fora do avião e disputar pixel com o vizinho são erros objetivos.
# Deslocamento só conta com ganho de aderência real, senão é ruído do gradiente.
MAX_FORA = 30
MAX_SOBREPOE = 50
GANHO_MIN = 0.25  # px de aproximação média da borda útil: abaixo disso é ruído


MIN_COMPONENTE = 300


def setores_existentes(raiz):
    return [s for s in SETORES if os.path.isdir(os.path.join(raiz, s))]


def defeitos_de_forma(mask):
    """Defeitos grosseiros de recorte, que o alinhamento fino não enxerga.

    Uma máscara pode estar perfeitamente colada nos contornos e mesmo assim ser
    a peça errada: box-fill cola na caixa inteira, e fio de sombra cola numa
    linha de sombreado da fuselagem.
    """
    import numpy as np
    from scipy import ndimage

    achados = []
    ys, xs = np.where(mask)
    area_caixa = (xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)
    preenche = mask.sum() / area_caixa
    if preenche > 0.88 and area_caixa > 8000:
        achados.append(f"box-fill (preenche {preenche:.0%} da caixa)")

    rot, n = ndimage.label(mask)
    tam = ndimage.sum(mask, rot, range(1, n + 1))
    principal = rot == (int(np.argmax(tam)) + 1)
    pys, pxs = np.where(principal)
    largura = pxs.max() - pxs.min() + 1
    if largura > 300 and principal.sum() / largura < 6:
        achados.append(f"fio fino (espessura média {principal.sum() / largura:.1f}px)")
    return achados


def diagnosticar(raiz, setor, aids, fotos, cache):
    vizinhos_dirs = [s for s in setores_existentes(raiz) if s != setor]
    saida = []
    for aid in aids:
        caminho = os.path.join(raiz, setor, f"{aid}.png")
        if not os.path.exists(caminho):
            continue
        foto = mc.achar_foto(fotos, aid)
        if not foto:
            continue
        if foto not in cache:
            cache[foto] = (mc.silhueta(foto), mc.borda_forte(foto))
        sil, forte = cache[foto]

        mask = mc.carregar_mask(caminho)
        vizinhos = {}
        for v in vizinhos_dirs:
            p = os.path.join(raiz, v, f"{aid}.png")
            if os.path.exists(p):
                vizinhos[v] = mc.carregar_mask(p)

        m = mc.medir(mask, sil, forte, vizinhos)
        m["aid"] = aid
        m["setor"] = setor

        problemas = []
        if m["px"] == 0:
            problemas.append("vazia")
        else:
            problemas.extend(defeitos_de_forma(mask))
            if m["fora"] > MAX_FORA:
                problemas.append(f"sangra {m['fora']}px para fora do avião")
            if (m["dx"], m["dy"]) != (0, 0) and m["ganho"] >= GANHO_MIN:
                problemas.append(
                    f"deslocada dx={m['dx']:+d} dy={m['dy']:+d} (borda cola {m['ganho']:.2f}px melhor)"
                )
            for v, n in m["sobrepoe"].items():
                if n > MAX_SOBREPOE:
                    problemas.append(f"disputa {n}px com {v}")
        m["problemas"] = problemas
        saida.append(m)
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--sector")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only", help="aids separados por vírgula")
    ap.add_argument("--json", help="grava o relatório completo")
    args = ap.parse_args()

    alvos = setores_existentes(args.root) if args.all else [args.sector]
    if not alvos or alvos == [None]:
        raise SystemExit("use --sector <nome> ou --all")

    cache = {}
    tudo = []
    for setor in alvos:
        aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, setor)) if f.endswith(".png"))
        if args.only:
            alvo = set(args.only.split(","))
            aids = [a for a in aids if a in alvo]
        linhas = diagnosticar(args.root, setor, aids, args.photos, cache)
        tudo.extend(linhas)

        com = [l for l in linhas if l["problemas"]]
        ader = [l["ader"] for l in linhas if l["px"]]
        media = sum(ader) / len(ader) if ader else 0
        print(f"\n=== {setor}: {len(linhas)} máscaras · {len(com)} com problema · aderência média {media:.0%}")
        for l in sorted(linhas, key=lambda r: (-len(r["problemas"]), r["ader"])):
            if not l["problemas"]:
                continue
            print(f"  {l['aid']:10s} ader {l['ader']:4.0%} desvio {l['desvio']:.2f}px  {'; '.join(l['problemas'])}")

        limpos = sorted(l["aid"] for l in linhas if not l["problemas"])
        if limpos:
            piores = sorted((l for l in linhas if not l["problemas"]), key=lambda r: r["ader"])[:5]
            print(f"  sem problema ({len(limpos)}); menor aderência: " +
                  ", ".join(f"{p['aid']} {p['ader']:.0%}" for p in piores))

    if args.json:
        with open(args.json, "w") as f:
            json.dump(tudo, f, indent=1)
        print(f"\n{args.json}")

    return 1 if any(l["problemas"] for l in tudo) else 0


if __name__ == "__main__":
    sys.exit(main())
