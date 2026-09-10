"""Diagnóstico numérico das máscaras de setor.

Não decide nada sozinho: ordena as aeronaves por suspeita para você olhar as
piores primeiro no overlay. O veredito é sempre visual.

    python3 audit_masks.py --masks public/sprites/wingmasks \
        --photos public/sprites/aircraft --against public/sprites/enginemasks \
        --against public/sprites/gearmasks
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

MIN_COMPONENT = 300  # mesmo corte usado na composição do setor


def carregar(path):
    return np.array(Image.open(path).convert("L")) > 127


def achar_foto(dir_fotos, aid):
    # os arquivos vêm como <aid>.png ou <aid>__<motorizacao>.png
    for nome in sorted(os.listdir(dir_fotos)):
        base = nome.rsplit(".", 1)[0]
        if base == aid or base.startswith(aid + "__"):
            return os.path.join(dir_fotos, nome)
    return None


def caixa_do_aviao(photo_path):
    """Extensão horizontal do avião na foto, pela distância até a cor de fundo."""
    arr = np.array(Image.open(photo_path).convert("RGB")).astype(np.int32)
    h, w, _ = arr.shape
    cantos = [arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]]
    bg = np.mean(cantos, axis=0)
    dist = np.abs(arr - bg).sum(axis=2)
    corpo = dist > 30
    if not corpo.any():
        return None
    xs = np.where(corpo.any(axis=0))[0]
    return int(xs.min()), int(xs.max())


def analisar(mask, photo_path, concorrentes, raw=False):
    ocupados = int(mask.sum())
    if ocupados == 0:
        return {"px": 0, "achados": ["vazia"], "suspeita": 100}

    achados = []
    suspeita = 0

    ys, xs = np.where(mask)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    area_caixa = (x1 - x0 + 1) * (y1 - y0 + 1)
    preenchimento = ocupados / area_caixa

    # Box-fill: SAM2 devolveu a caixa inteira em vez da peça. A máscara vira um
    # retângulo quase perfeito, quase sempre com score baixo na geração.
    if preenchimento > 0.88 and area_caixa > 8000:
        achados.append(f"box-fill (preenche {preenchimento:.0%} da caixa)")
        suspeita += 50

    rotulado, n = ndimage.label(mask)
    grandes = 0
    if n:
        tamanhos = ndimage.sum(mask, rotulado, range(1, n + 1))
        grandes = int((tamanhos >= MIN_COMPONENT).sum())
        # Só faz sentido no recorte cru: no setor já composto, o motor corta a
        # asa em pedaço interno e externo, e fragmentar é o esperado.
        if raw and grandes > 3:
            achados.append(f"fragmentada ({grandes} pedaços)")
            suspeita += 25

        # Fio de sombra: tira longa e fina grudada no borrão principal, quase
        # sempre seguindo uma linha de sombra da fuselagem.
        principal = rotulado == (int(np.argmax(tamanhos)) + 1)
        pys, pxs = np.where(principal)
        largura = pxs.max() - pxs.min() + 1
        altura = pys.max() - pys.min() + 1
        espessura = principal.sum() / max(largura, 1)
        if largura > 300 and espessura < 6:
            achados.append(f"fio fino (espessura média {espessura:.1f}px)")
            suspeita += 20

    # Capturou a peça errada: quase tudo em cima de outro setor já conhecido.
    for nome, outra in concorrentes.items():
        if outra is None:
            continue
        sobre = int((mask & outra).sum())
        fracao = sobre / ocupados
        if fracao > 0.80:
            achados.append(f"{fracao:.0%} sobre {nome}")
            suspeita += 40

    # Quanto do comprimento do avião a máscara cobre. NÃO é achado: asa quase
    # toda escondida atrás do motor cobre pouco e está certa. Serve só para
    # ordenar a fila de conferência visual — ponta cortada não tem assinatura
    # numérica confiável.
    faixa = caixa_do_aviao(photo_path) if photo_path else None
    cobertura = None
    if faixa:
        px0, px1 = faixa
        cobertura = (x1 - x0) / max(px1 - px0, 1)

    return {
        "px": ocupados,
        "achados": achados,
        "suspeita": suspeita,
        "bbox": (x0, y0, x1, y1),
        "preenchimento": preenchimento,
        "cobertura": cobertura,
        "pedacos": grandes,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--masks", required=True, help="pasta das máscaras do setor")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument(
        "--against",
        action="append",
        default=[],
        help="pasta de outro setor, para detectar máscara em cima da peça errada",
    )
    ap.add_argument("--only", help="lista de aids separada por vírgula")
    ap.add_argument(
        "--raw",
        action="store_true",
        help="máscaras são recorte cru, antes de subtrair os vizinhos: liga a checagem de fragmentação",
    )
    args = ap.parse_args()

    aids = sorted(f.rsplit(".", 1)[0] for f in os.listdir(args.masks) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    linhas = []
    for aid in aids:
        mask = carregar(os.path.join(args.masks, f"{aid}.png"))
        concorrentes = {}
        for pasta in args.against:
            p = os.path.join(pasta, f"{aid}.png")
            concorrentes[os.path.basename(pasta.rstrip("/"))] = (
                carregar(p) if os.path.exists(p) else None
            )
        foto = achar_foto(args.photos, aid) if os.path.isdir(args.photos) else None
        r = analisar(mask, foto, concorrentes, raw=args.raw)
        linhas.append((r["suspeita"], aid, r))

    linhas.sort(key=lambda t: (-t[0], t[1]))
    suspeitas = [l for l in linhas if l[0] > 0]

    print(f"{len(aids)} máscaras · {len(suspeitas)} com achado\n")
    for suspeita, aid, r in linhas:
        if suspeita == 0:
            continue
        print(f"{aid:10s} {r['px']:7d}px  {'; '.join(r['achados'])}")
    if not suspeitas:
        print("(nenhum)")

    # Fila de conferência visual, da menor cobertura para a maior. Não é lista
    # de defeito: é a ordem em que vale a pena abrir o overlay.
    com_cobertura = [(r["cobertura"], aid, r) for _, aid, r in linhas if r.get("cobertura")]
    com_cobertura.sort()
    print("\nfila de conferência visual (cobertura do comprimento, menor primeiro):")
    for cob, aid, r in com_cobertura[:15]:
        print(f"  {aid:10s} {cob:5.0%}  {r['px']:7d}px  {r['pedacos']} pedaço(s)")

    print("\nNenhum achado numérico não quer dizer correta — o veredito é o overlay.")
    return 1 if suspeitas else 0


if __name__ == "__main__":
    sys.exit(main())
