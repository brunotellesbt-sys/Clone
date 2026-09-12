# -*- coding: utf-8 -*-
"""Passo 2: recorta uma peça, pelos dois caminhos, e devolve os dois candidatos.

SAM 2.1 é o titular: semente de caixa e pontos, controlada por aqui.
Grounded SAM 2 é a segunda opinião: semente vinda de texto, sem dizer onde está.

Nenhum dos dois decide. Quem decide é `juiz.py` mais o olho humano na ficha.
"""
import os, sys
import numpy as np
import torch
import cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pecas import RAIZ, peca as ficha_da_peca, por_helice

CK = os.environ.get(
    'SAM2_CK',
    '/tmp/claude-0/-home-user-Clone/5880d8e7-418a-53a9-b563-53ec154e88a0/scratchpad/sam2ckpt/sam2.1_hiera_large.pt')

_sam = None
_gdino = None


def sam():
    global _sam
    if _sam is None:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        _sam = SAM2ImagePredictor(
            build_sam2('configs/sam2.1/sam2.1_hiera_l.yaml', CK, device='cpu'))
    return _sam


def gdino():
    global _gdino
    if _gdino is None:
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        nome = 'IDEA-Research/grounding-dino-base'
        _gdino = (AutoProcessor.from_pretrained(nome),
                  AutoModelForZeroShotObjectDetection.from_pretrained(nome).eval())
    return _gdino


def sprite(caminho):
    return Image.open(caminho).convert('RGB')


def silhueta(aid, trabalho):
    """A silhueta do passo 1, se existir; senão a planemasks do repositório."""
    p = os.path.join(trabalho, '%s__silhueta.png' % aid)
    if not os.path.exists(p):
        p = os.path.join(RAIZ, 'planemasks', '%s.png' % aid)
    if not os.path.exists(p):
        return None
    return np.array(Image.open(p).convert('L')) > 127


def linha_de_painel(img, m, nariz_esq=True):
    """Onde o capô do fan acaba: a divisa de painel mais forte da nacela.

    Fração fixa não serve, e isso foi medido: o capô vai até 0,61 do comprimento
    da nacela no 737 e até 0,76 no An-148 — motores diferentes têm capô de
    proporção diferente. A divisa de verdade é uma linha **vertical** na chapa,
    e ela aparece na foto como um pico de gradiente em x somado ao longo das
    colunas da nacela.

    Devolve a coluna, ou None quando nenhuma divisa se destaca — aí quem chama
    cai na fração, sabendo que é chute.
    """
    ys, xs = np.where(m)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    if x1 - x0 < 40:
        return None
    faixa = cv2.cvtColor(img[y0:y1 + 1, x0:x1 + 1], cv2.COLOR_RGB2GRAY).astype(np.float32)
    dentro = m[y0:y1 + 1, x0:x1 + 1]
    grad = np.abs(cv2.Sobel(faixa, cv2.CV_32F, 1, 0, ksize=3))
    grad[~dentro] = 0
    perfil = grad.sum(axis=0) / np.maximum(1, dentro.sum(axis=0))
    # a divisa procurada fica na metade de trás do capô: entre 35% e 85% do
    # comprimento. Antes disso é o lábio de entrada; depois é o bocal.
    n = len(perfil)
    ini, fim = int(n * 0.35), int(n * 0.88)
    if fim - ini < 8:
        return None
    janela = perfil[ini:fim]
    suave = cv2.GaussianBlur(janela.reshape(-1, 1), (1, 9), 0).ravel()
    pico = int(np.argmax(suave))
    # só aceita divisa que se destaque do resto: senão é textura, não painel
    if suave[pico] < suave.mean() * 1.6:
        return None
    col = ini + pico
    return x0 + col if nariz_esq else x0 + col


def _alvo_motor(aid, img, nac, fracao, nariz_esq):
    """A área pintável do motor.

    Turboélice: a nacela inteira — a livery cobre tudo, não há reversor exposto.
    Turbofan: do lábio até a divisa de painel do reversor.
    """
    if por_helice(aid):
        return None, 'nacela inteira (turboélice)'
    corte = linha_de_painel(img, nac, nariz_esq)
    if corte is not None:
        return corte, 'linha de painel achada na foto'
    ys, xs = np.where(nac)
    x0, x1 = int(xs.min()), int(xs.max())
    corte = int(x0 + (x1 - x0) * fracao) if nariz_esq else int(x1 - (x1 - x0) * fracao)
    return corte, 'sem divisa visível — fração %.2f (chute)' % fracao


def por_sam(aid, caminho, nome_peca, trabalho, nariz_esq=True):
    """Candidato A: SAM 2.1 com caixa e pontos montados aqui."""
    cfg = ficha_da_peca(nome_peca)
    img = np.array(sprite(caminho))
    sil = silhueta(aid, trabalho)
    p = sam()
    p.set_image(img)

    # semente grosseira da peça: a máscara antiga quando existe, senão a caixa
    # da silhueta. Serve só para localizar; a forma sai do modelo.
    antiga = os.path.join(RAIZ, cfg['pasta'], '%s.png' % aid)
    if os.path.exists(antiga):
        grosso = np.array(Image.open(antiga).convert('L')) > 127
    elif sil is not None:
        grosso = sil
    else:
        return None, 'sem semente: nem máscara antiga nem silhueta'

    ys, xs = np.where(grosso)
    cx = np.array([xs.min() - 4, ys.min() - 4, xs.max() + 4, ys.max() + 4], float)
    with torch.inference_mode():
        m, _, _ = p.predict(box=cx[None, :], multimask_output=False)
    inteira = (m[0] > 0.5)
    if sil is not None:
        inteira &= sil
    if not cfg.get('recorta_capo'):
        return inteira, 'peça inteira'

    corte, motivo = _alvo_motor(aid, img, inteira, cfg.get('fracao', 0.58), nariz_esq)
    if corte is None:
        return inteira, motivo
    ys, xs = np.where(inteira)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    caixa = np.array([x0 - 3, y0 - 3, corte, y1 + 3], float)
    meio = np.array([[(x0 + corte) / 2, (y0 + y1) / 2]])
    # negativos no que vem depois da divisa: é o que faz o modelo parar ali em
    # vez de seguir pela nacela toda quando a linha de painel é fraca
    neg = np.array([[x1 - (x1 - corte) * 0.35, (y0 + y1) / 2],
                    [x1 - (x1 - corte) * 0.12, (y0 + y1) / 2]])
    pts = np.vstack([meio, neg])
    rot = np.array([1, 0, 0])
    with torch.inference_mode():
        m, _, _ = p.predict(point_coords=pts, point_labels=rot,
                            box=caixa[None, :], multimask_output=False)
    return (m[0] > 0.5) & inteira, motivo


def por_grounded(aid, caminho, nome_peca, trabalho):
    """Candidato B: caixa vinda de texto, sem dizer onde a peça está.

    Entre as caixas propostas fica a que mais cai dentro da silhueta — é o que
    evita aceitar uma caixa em cima do fundo. Ainda assim falha em turboélice;
    ver SKILL.md.
    """
    cfg = ficha_da_peca(nome_peca)
    pil = sprite(caminho)
    sil = silhueta(aid, trabalho)
    proc, det = gdino()
    ent = proc(images=pil, text=cfg['texto'], return_tensors='pt')
    with torch.inference_mode():
        s = det(**ent)
    res = proc.post_process_grounded_object_detection(
        s, ent.input_ids, threshold=0.12, text_threshold=0.12,
        target_sizes=[pil.size[::-1]])[0]
    if not len(res['boxes']):
        return None, 'o texto não ancorou em nada'
    base = sil if sil is not None else np.ones(np.array(pil).shape[:2], bool)
    melhor, nota = None, -1.0
    for i in range(len(res['boxes'])):
        bx = res['boxes'][i].numpy()
        x0, y0, x1, y1 = [int(round(v)) for v in bx]
        reg = np.zeros(base.shape, bool)
        reg[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = True
        if not reg.any():
            continue
        n = (reg & base).sum() / reg.sum()
        if n > nota:
            nota, melhor = n, bx
    if melhor is None or nota < 0.5:
        return None, 'melhor caixa do texto só %.0f%% dentro do avião' % (100 * max(0, nota))
    p = sam()
    p.set_image(np.array(pil))
    with torch.inference_mode():
        m, _, _ = p.predict(box=melhor[None, :], multimask_output=False)
    out = (m[0] > 0.5)
    if sil is not None:
        out &= sil
    return out, 'caixa do texto %.0f%% dentro do avião' % (100 * nota)
