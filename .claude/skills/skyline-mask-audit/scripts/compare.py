"""Antes e depois na mesma região, para julgar um conserto.

O laudo do visual.py escolhe os piores pontos sozinho, e eles mudam depois da
correção — o que serve para achar defeito, mas não para comparar. Aqui o
recorte é fixo nos dois lados: a mesma janela, a mesma escala, o mesmo
critério de cor. É assim que se vê se o conserto colou ou só empurrou o erro.

    python3 compare.py --aid an148 --sector gearmasks \
      --antes public/sprites/gearmasks/an148.png.bak --out /tmp/cmp.png
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import maskcore as mc  # noqa: E402
import visual  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aid", required=True)
    ap.add_argument("--sector", required=True)
    ap.add_argument("--antes", help="máscara anterior (padrão: o .bak do autofix)")
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--out", required=True)
    ap.add_argument("--zoom", type=int, default=4)
    ap.add_argument("--margem", type=int, default=25)
    args = ap.parse_args()

    depois_p = os.path.join(args.root, args.sector, f"{args.aid}.png")
    antes_p = args.antes or depois_p + ".bak"
    if not os.path.exists(antes_p):
        raise SystemExit(f"sem máscara anterior em {antes_p}")

    foto = mc.achar_foto(args.photos, args.aid)
    sil, forte = mc.silhueta(foto), mc.borda_forte(foto)
    vizinhos = {}
    for v in os.listdir(args.root):
        p = os.path.join(args.root, v, f"{args.aid}.png")
        if v.endswith("masks") and v != args.sector and os.path.exists(p):
            vizinhos[v] = mc.carregar_mask(p)

    ma, md = mc.carregar_mask(antes_p), mc.carregar_mask(depois_p)

    # janela fixa: a união das duas máscaras, para nada entrar ou sair de quadro
    ys, xs = np.where(ma | md)
    x0, x1 = max(0, xs.min() - args.margem), min(ma.shape[1], xs.max() + args.margem)
    y0, y1 = max(0, ys.min() - args.margem), min(ma.shape[0], ys.max() + args.margem)

    paineis = []
    for rot, m in (("ANTES", ma), ("DEPOIS", md)):
        arr, _, _ = visual.pintar(foto, m, sil, forte, vizinhos)
        img = Image.fromarray(arr).crop((x0, y0, x1, y1))
        img = img.resize((img.width * args.zoom, img.height * args.zoom), Image.NEAREST)
        med = mc.medir(m, sil, forte, vizinhos)
        paineis.append((rot, img, med))

    larg = max(p[1].width for p in paineis)
    alt = max(p[1].height for p in paineis)
    folha = Image.new("RGB", (larg, (alt + 34) * 2), (245, 245, 245))
    d = ImageDraw.Draw(folha)
    for i, (rot, img, med) in enumerate(paineis):
        topo = i * (alt + 34)
        d.text((8, topo + 8),
               f"{rot} · {args.aid}/{args.sector} · {med['px']}px · desvio {med['desvio']:.2f}px · "
               f"aderência {med['ader']:.0%} · fora {med['fora']}px · "
               f"disputa {sum(med['sobrepoe'].values())}px",
               fill=(20, 20, 20))
        folha.paste(img, (0, topo + 30))
    folha.save(args.out)
    print(args.out)
    for rot, _, med in paineis:
        print(f"{rot:7s} desvio {med['desvio']:.2f}px  ader {med['ader']:.0%}  fora {med['fora']}px")


if __name__ == "__main__":
    main()
