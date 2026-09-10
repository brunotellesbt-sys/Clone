"""Refaz o recorte da nacela com SAM2, com teste de aceite objetivo.

O recorte antigo pegava a boca do motor e deixava a **traseira da nacela** para
a asa: na montagem de asa-vermelho/motor-verde das 55, o cone de escape sai
vermelho em quase todas, e no `a320` o verde não chega nem à metade da peça.
Como o jogo pinta a asa por cima, o motor sai com a cor da asa — que é o
"misturando asa com motor" relatado.

O portão é o que torna isto rodável em lote. Um recorte novo só entra se:

- **contém o antigo**: 80% do que já era motor continua motor. Recorte que
  troca de peça é recusado, por maior que seja;
- **cresce**: se não acrescenta nada, não há motivo para trocar;
- **não estoura**: acima de 18% da silhueta já é fuselagem junto;
- **fica embaixo**: nacela não sobe até a fileira de janela;
- **não sangra**: nada de novo fora do avião.

    python3 engine_batch.py --out /tmp/engine
    python3 engine_batch.py --out /tmp/engine --only a320,a332
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

MIN_CONTEM = 0.80
MAX_SILHUETA = 0.18
MAX_FORA = 40


def caixa_da_nacela(motor, sil, nariz):
    """Caixa em volta do motor antigo, esticada para trás.

    O que falta é sempre a traseira: o cone de escape sai atrás da boca. Esticar
    para trás é o que dá ao SAM2 a peça inteira; esticar para cima alcançaria a
    fileira de janela e devolveria a seção de fuselagem, que é o erro clássico
    aqui (ver a nota de box-fill na SKILL).
    """
    ys, xs = np.where(motor)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    comp = x1 - x0 + 1
    if nariz > 0:  # nariz à direita: a traseira é para a esquerda
        x0 = max(0, x0 - int(0.55 * comp))
    else:
        x1 = min(sil.shape[1] - 1, x1 + int(0.55 * comp))
    alt = y1 - y0 + 1
    return (int(x0), int(max(0, y0 - 0.10 * alt)),
            int(x1), int(min(sil.shape[0] - 1, y1 + 0.18 * alt)))


def avaliar(novo, velho, sil, teto):
    if not novo.any():
        return "vazio"
    contem = (novo & velho).sum() / velho.sum()
    if contem < MIN_CONTEM:
        return f"perde o motor antigo (fica com {contem:.0%})"
    if novo.sum() <= velho.sum():
        return "não cresce"
    if novo.sum() / sil.sum() > MAX_SILHUETA:
        return f"grande demais ({novo.sum() / sil.sum():.0%} da silhueta)"
    ys, _ = np.where(novo)
    if ys.min() < teto:
        return "sobe até a fileira de janela"
    if (novo & ~ndimage.binary_dilation(sil, iterations=2)).sum() > MAX_FORA:
        return "sangra para fora do avião"
    return None


def teto_da_janela(sil, motor):
    """Onde a nacela não pode passar.

    A fileira de janela fica na metade de cima da fuselagem; a nacela, embaixo
    da asa. O teto sai do topo do motor antigo com uma folga generosa — o que
    se quer barrar é o salto para a seção inteira da fuselagem, não um pedaço
    de carenagem alguns pixels acima.
    """
    ys, _ = np.where(motor)
    alt = ys.max() - ys.min() + 1
    return int(ys.min() - 0.55 * alt)


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

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from derive_sectors import lado_do_nariz

    preditor = SAM2ImagePredictor(build_sam2(CFG, CKPT, device="cpu"))
    os.makedirs(args.out, exist_ok=True)

    aids = sorted(f[:-4] for f in os.listdir(os.path.join(args.root, "enginemasks")) if f.endswith(".png"))
    if args.only:
        alvo = set(args.only.split(","))
        aids = [a for a in aids if a in alvo]

    passou = reprovou = 0
    for i, aid in enumerate(aids, 1):
        velho = mc.carregar_mask(os.path.join(args.root, "enginemasks", f"{aid}.png"))
        if not velho.any():
            print(f"[{i}/{len(aids)}] {aid:10s} sem motor", flush=True)
            continue
        foto = mc.achar_foto(args.photos, aid)
        sil = mc.silhueta(foto)
        nariz = lado_do_nariz(sil, args.root, aid)
        caixa = caixa_da_nacela(velho, sil, nariz)
        teto = teto_da_janela(sil, velho)

        ys, xs = np.where(velho)
        pt = (int(np.median(xs)), int(np.median(ys)))
        if not velho[pt[1], pt[0]]:  # mediana pode cair num vão entre nacelas
            pt = (int(xs[len(xs) // 2]), int(ys[len(ys) // 2]))

        arr = np.array(Image.open(foto).convert("RGB"))
        preditor.set_image(arr)
        masks, scores, _ = preditor.predict(
            point_coords=np.array([pt]), point_labels=np.array([1]),
            box=np.array(caixa, dtype=float), multimask_output=True,
        )

        # O trem e a cauda ficam na frente da nacela na foto e o SAM2 os traz
        # junto — no a220100 o recorte engolia a roda inteira. Descontar antes
        # de medir, senão o portão aprova um motor com pneu dentro.
        vizinho = np.zeros_like(sil)
        for s_ in ("gearmasks", "tailmasks"):
            p_ = os.path.join(args.root, s_, f"{aid}.png")
            if os.path.exists(p_):
                vizinho |= ndimage.binary_dilation(mc.carregar_mask(p_), iterations=1)

        recorte = np.zeros_like(sil)
        recorte[caixa[1]:caixa[3] + 1, caixa[0]:caixa[2] + 1] = True
        aprovados, motivos = [], []
        for k in range(masks.shape[0]):
            m = (masks[k].astype(bool) & recorte & sil & ~vizinho) | velho
            m = ndimage.binary_fill_holes(m) & ~vizinho
            rot, n_ = ndimage.label(m)
            if n_ > 1:  # descontar o trem pode soltar lascas
                tam = ndimage.sum(m, rot, range(1, n_ + 1))
                m = np.isin(rot, [j + 1 for j, t in enumerate(tam) if t >= 200])
            motivo = avaliar(m, velho, sil, teto)
            if motivo:
                motivos.append(motivo)
            else:
                aprovados.append((int(m.sum()), m))

        if not aprovados:
            reprovou += 1
            print(f"[{i}/{len(aids)}] {aid:10s} REPROVA  {' / '.join(motivos)}", flush=True)
        else:
            # entre os que passam, o maior: é o que mais recupera de traseira
            aprovados.sort(key=lambda t: -t[0])
            n, m = aprovados[0]
            passou += 1
            mc.salvar_mask(m, os.path.join(args.out, f"{aid}.png"))
            print(f"[{i}/{len(aids)}] {aid:10s} ok  {int(velho.sum()):6d} -> {n:6d}px", flush=True)

    print(f"\n{passou} passaram, {reprovou} reprovaram")


if __name__ == "__main__":
    main()
