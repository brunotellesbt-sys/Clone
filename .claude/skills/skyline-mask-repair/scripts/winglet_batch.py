"""Recorta o dispositivo de ponta de asa com SAM2, com teste de aceite objetivo.

Winglet, sharklet, wingtip fence, ponta raked, aleta pequena — tudo que fica
além da quebra da asa e hoje está sendo pintado como fuselagem.

O que torna isto viável em lote é o **portão**: cada recorte é medido contra a
foto e só passa quem cabe no que um dispositivo de ponta pode ser. O que não
passa fica de fora e vai para conferência à mão, em vez de entrar torto.

Derivar por geometria foi tentado duas vezes e não dá: o dispositivo encosta na
asa e, no disco em volta da ponta, sai grudado na fuselagem.

    python3 winglet_batch.py --out /tmp/winglet --pontas /tmp/tips/pontas.txt
    python3 winglet_batch.py --out /tmp/winglet --only a320neo,b38m
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

CKPT = os.environ.get("SAM2_CKPT", "sam2ckpt/sam2.1_hiera_large.pt")
CFG = os.environ.get("SAM2_CFG", "configs/sam2.1/sam2.1_hiera_l.yaml")

# O que um dispositivo de ponta pode ser, medido nos que saíram certos: de
# 261px (ponta raked do a359) a 3.983px (sharklet do a220100). Fora disso é
# outra coisa — quase sempre um pedaço de fuselagem que o SAM2 agarrou junto.
#
# O teto começou em 14.000px e passavam sete erros. Todos eram box-fill: o SAM2
# devolvendo a caixa inteira, que aparece como retângulo preenchendo quase todo
# o próprio contorno. Daí o teto apertado e o teste de retangularidade.
MIN_PX, MAX_PX = 150, 6000
MAX_FORA = 40
MAX_SOBRE_ASA = 400
MIN_ADER = 0.55
MAX_PREENCHE = 0.85  # fração da caixa delimitadora: acima disso é box-fill


def avaliar(m, sil, forte, asa, tx, ty):
    """Mede um candidato e diz por que ele não serve, ou None se serve."""
    med = mc.medir(m, sil, forte, {"wingmasks": asa})
    if not (MIN_PX <= med["px"] <= MAX_PX):
        return med, f"tamanho {med['px']}px"
    ys, xs = np.where(m)
    caixa = (xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)
    if med["px"] / caixa > MAX_PREENCHE:
        return med, f"box-fill ({med['px'] / caixa:.0%} da caixa)"
    if med["fora"] > MAX_FORA:
        return med, f"sangra {med['fora']}px"
    if med["sobrepoe"].get("wingmasks", 0) > MAX_SOBRE_ASA:
        return med, f"invade a asa {med['sobrepoe']['wingmasks']}px"
    if med["ader"] < MIN_ADER:
        return med, f"aderência {med['ader']:.0%}"
    if ys.mean() > ty + 20:  # o dispositivo sobe a partir da ponta
        return med, "abaixo da ponta"

    # Uma coisa que **não** funciona, para não ser tentada de novo: exigir que o
    # recorte esteja cercado de fundo, na ideia de que winglet sobe para o céu.
    # Na vista lateral o dispositivo fica na frente da fuselagem — o a319neo dá
    # 0% de fundo em volta e está certo. O teste derrubava cinco dos confirmados.
    #
    # Aderência também não decide: uma tira de fuselagem marca 86% a 94% igual,
    # porque fileira de janela e linha de painel são contorno forte. O portão
    # daqui pega erro grosseiro; dizer se caiu na peça certa é olho.
    return med, None


def ponta_da_asa(asa):
    """Onde fica a ponta da asa.

    Na vista lateral destas fotos a asa sobe da raiz para a ponta, então a ponta
    é o extremo mais alto do eixo de envergadura. Comparar a corda dos dois
    extremos não serve: a raiz já vem recortada pelo motor e sai estreita.
    """
    ys, xs = np.where(asa)
    pts = np.stack([xs - xs.mean(), ys - ys.mean()])
    _, vecs = np.linalg.eigh(np.cov(pts))
    env = vecs[:, -1]
    s = pts[0] * env[0] + pts[1] * env[1]
    lo, hi = s < np.percentile(s, 8), s > np.percentile(s, 92)
    sel = hi if ys[hi].mean() < ys[lo].mean() else lo
    return int(xs[sel].mean()), int(ys[sel].mean())


def semente(sil, asa, tx, ty, alcance=70, meia_largura=22):
    """Um pixel que está no dispositivo, para o SAM2 partir dele.

    O dispositivo nasce **na ponta da asa** e sobe. Então o ponto sai de uma
    coluna estreita em volta da ponta, subindo dentro da silhueta.

    Pegar o terço de cima de uma caixa larga não serve: acima da ponta quase
    sempre há fuselagem, o ponto cai nela e o SAM2 recorta uma tira de
    fuselagem. Foi o que estragou metade do primeiro lote.
    """
    faixa = np.zeros_like(sil)
    y0 = max(0, ty - alcance)
    faixa[y0:ty + 6, max(0, tx - meia_largura):tx + meia_largura] = True
    resto = sil & ~ndimage.binary_dilation(asa, iterations=2) & faixa
    if not resto.any():
        return None

    # só o pedaço que encosta na ponta: fuselagem solta acima não entra
    rot, n = ndimage.label(resto)
    perto = ndimage.binary_dilation(asa, iterations=10)
    vivos = [i for i in range(1, n + 1) if ((rot == i) & perto).any() and (rot == i).sum() >= 40]
    if not vivos:
        return None
    alvo = max(vivos, key=lambda i: (rot == i).sum())
    ys, xs = np.where(rot == alvo)
    meio = (ys.min() + ys.max()) // 2
    perto_do_meio = np.abs(ys - meio) <= 3
    if not perto_do_meio.any():
        return int(np.median(xs)), int(np.median(ys))
    return int(np.median(xs[perto_do_meio])), int(meio)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="public/sprites")
    ap.add_argument("--photos", default="public/sprites/aircraft")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only")
    args = ap.parse_args()

    import torch  # noqa: F401
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    preditor = SAM2ImagePredictor(build_sam2(CFG, CKPT, device="cpu"))
    os.makedirs(args.out, exist_ok=True)

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "wingmasks")) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    passou = reprovou = 0
    for i, aid in enumerate(aids, 1):
        asa = mc.carregar_mask(os.path.join(args.root, "wingmasks", f"{aid}.png"))
        if not asa.any():
            print(f"[{i}/{len(aids)}] {aid:10s} sem asa")
            continue
        foto = mc.achar_foto(args.photos, aid)
        sil, forte = mc.silhueta(foto), mc.borda_forte(foto)
        tx, ty = ponta_da_asa(asa)
        h, w = asa.shape
        # caixa justa em volta da ponta: larga demais alcança a fuselagem e o
        # SAM2 devolve uma tira dela em vez do dispositivo
        caixa = (max(0, tx - 55), max(0, ty - 78), min(w, tx + 55), min(h, ty + 18))
        pt = semente(sil, asa, tx, ty)
        if pt is None:
            print(f"[{i}/{len(aids)}] {aid:10s} sem dispositivo na ponta")
            continue

        arr = np.array(Image.open(foto).convert("RGB"))
        preditor.set_image(arr)
        masks, scores, _ = preditor.predict(
            point_coords=np.array([pt]), point_labels=np.array([1]),
            box=np.array(caixa, dtype=float), multimask_output=True,
        )
        # O SAM2 devolve três recortes em granularidades diferentes. Ficar com o
        # de maior score pega o mais "confiante", que é justamente o maior — e o
        # maior aqui costuma ser a caixa inteira. Vale testar os três e ficar com
        # o melhor que passa no portão.
        recorte = np.zeros_like(masks[0], dtype=bool)
        recorte[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
        aprovados, motivos = [], []
        for k in range(masks.shape[0]):
            m = masks[k].astype(bool) & recorte & sil & ~asa
            rot, n = ndimage.label(m)
            if n == 0:
                motivos.append("vazio")
                continue
            if n > 1:
                tam = ndimage.sum(m, rot, range(1, n + 1))
                m = rot == (int(np.argmax(tam)) + 1)
            m = ndimage.binary_fill_holes(m)
            med, motivo = avaliar(m, sil, forte, asa, tx, ty)
            if motivo:
                motivos.append(f"{motivo}")
            else:
                aprovados.append((med["ader"], k, m, med))

        if not aprovados:
            reprovou += 1
            print(f"[{i}/{len(aids)}] {aid:10s} REPROVA  {' / '.join(motivos)}")
        else:
            aprovados.sort(key=lambda t: -t[0])
            _, k, m, med = aprovados[0]
            passou += 1
            mc.salvar_mask(m, os.path.join(args.out, f"{aid}.png"))
            print(f"[{i}/{len(aids)}] {aid:10s} ok  {med['px']:5d}px  ader {med['ader']:.0%}  "
                  f"fora {med['fora']}  score {scores[k]:.2f}")

    print(f"\n{passou} passaram, {reprovou} reprovaram")


if __name__ == "__main__":
    main()
