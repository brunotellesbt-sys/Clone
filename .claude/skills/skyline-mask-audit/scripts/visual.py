"""Laudo visual guiado pela métrica.

O número diz onde olhar; a imagem mostra o quê. As duas coisas na mesma folha:

- **mapa de calor**: cada pixel da borda da máscara colorido pela distância até
  o contorno real. Verde cola, amarelo escorrega, vermelho está solto. É o que
  torna visível um erro de 2px numa imagem de 1536x1024.
- **sangramento** em magenta: máscara fora do avião.
- **disputa** em ciano: pixel reivindicado por dois setores.
- **zoom guiado**: os piores pontos, recortados pela própria métrica e
  ampliados em NEAREST, para conferir pixel a pixel.

    python3 visual.py --aid a320 --sector wingmasks --out /tmp/laudo_a320.png
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import maskcore as mc  # noqa: E402

VERDE, AMARELO, VERMELHO = (40, 220, 90), (250, 210, 40), (240, 45, 45)
MAGENTA, CIANO = (255, 0, 200), (0, 220, 255)


def cor_do_desvio(d):
    if d <= 1.5:
        return VERDE
    if d <= 3.5:
        return AMARELO
    return VERMELHO


def pintar(photo_path, mask, sil, forte, vizinhos):
    """Foto esmaecida com a borda colorida por desvio, sangramento e disputa."""
    base = np.array(Image.open(photo_path).convert("RGB")).astype(np.float64)
    arr = (base * 0.45 + 255 * 0.55).astype(np.uint8)  # esmaece para a cor saltar

    desvio, c = mc.mapa_desvio(mask, forte)
    ys, xs = np.where(c)
    for y, x in zip(ys, xs):
        arr[y, x] = cor_do_desvio(desvio[y, x])

    fora = mask & ~sil
    if fora.any():
        arr[fora] = MAGENTA
    for v in vizinhos.values():
        if v is None:
            continue
        d = mask & v
        if d.any():
            arr[d] = CIANO
    return arr, desvio, c


def piores_pontos(desvio, c, n=3, raio=90):
    """Onde a borda mais se solta do contorno, sem repetir a mesma região."""
    d = desvio.copy()
    pontos = []
    for _ in range(n):
        if d.max() <= 1.5:
            break
        y, x = np.unravel_index(int(np.argmax(d)), d.shape)
        pontos.append((int(x), int(y), float(d[y, x])))
        y0, y1 = max(0, y - raio), min(d.shape[0], y + raio)
        x0, x1 = max(0, x - raio), min(d.shape[1], x + raio)
        d[y0:y1, x0:x1] = 0
    return pontos


def montar(arr, pontos, titulo, out, zoom=5, lado=150):
    """Folha única: avião inteiro em cima, zoom guiado embaixo."""
    inteiro = Image.fromarray(arr)
    larg = inteiro.width
    topo = inteiro.resize((larg, int(inteiro.height * larg / inteiro.width)))

    tiles = []
    for (x, y, d) in pontos:
        x0, y0 = max(0, x - lado // 2), max(0, y - lado // 2)
        t = inteiro.crop((x0, y0, x0 + lado, y0 + lado)).resize(
            (lado * zoom, lado * zoom), Image.NEAREST
        )
        dr = ImageDraw.Draw(t)
        dr.text((6, 6), f"({x},{y}) desvio {d:.1f}px", fill=(0, 0, 0))
        tiles.append(t)

    alt_tile = lado * zoom if tiles else 0
    folha = Image.new("RGB", (larg, topo.height + alt_tile + 34), (245, 245, 245))
    d = ImageDraw.Draw(folha)
    d.text((8, 8), titulo, fill=(20, 20, 20))
    folha.paste(topo, (0, 26))
    for i, t in enumerate(tiles):
        folha.paste(t, (i * (lado * zoom + 6), topo.height + 30))
    folha.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aid", required=True)
    ap.add_argument("--sector", required=True)
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--out", required=True)
    ap.add_argument("--zoom", type=int, default=5)
    args = ap.parse_args()

    foto = mc.achar_foto(args.photos, args.aid)
    sil, forte = mc.silhueta(foto), mc.borda_forte(foto)
    mask = mc.carregar_mask(os.path.join(args.root, args.sector, f"{args.aid}.png"))

    vizinhos = {}
    for v in os.listdir(args.root):
        p = os.path.join(args.root, v, f"{args.aid}.png")
        if v.endswith("masks") and v != args.sector and os.path.exists(p):
            vizinhos[v] = mc.carregar_mask(p)

    arr, desvio, c = pintar(foto, mask, sil, forte, vizinhos)
    m = mc.medir(mask, sil, forte, vizinhos)
    titulo = (
        f"{args.aid} · {args.sector} · {m['px']}px · aderência {m['ader']:.0%} · "
        f"fora {m['fora']}px · desloc ({m['dx']:+d},{m['dy']:+d}) ganho {m['ganho']:+.0%}"
    )
    print(montar(arr, piores_pontos(desvio, c), titulo, args.out, zoom=args.zoom))
    print(titulo)


if __name__ == "__main__":
    main()
