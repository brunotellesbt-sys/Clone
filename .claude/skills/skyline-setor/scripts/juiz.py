# -*- coding: utf-8 -*-
"""Passo 4: o juiz. Tudo medido na FOTO, nunca contra outra máscara.

Medir máscara contra máscara é circular, e já deixou passar defeito visível:
`windowmasks` e `enginemasks` foram cortadas como partição disjunta, então
"motor ∩ janela" dá zero por construção — inclusive na aeronave em que o motor
cobre meia fileira de janela na tela. O juiz aqui acha a janela **na imagem**.
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pecas import RAIZ


def janelas_da_foto(caminho, sil=None):
    """Janela de passageiro: retângulo escuro sobre chapa clara, quase quadrado.

    Independe de `windowmasks`, que é justamente o que pode estar errado.
    """
    cinza = np.array(Image.open(caminho).convert('L'))
    if sil is None:
        sil = cinza < 250
    escuro = (cinza < 120) & sil
    n, lab, stats, _ = cv2.connectedComponentsWithStats(escuro.astype(np.uint8), 8)
    out = np.zeros_like(escuro)
    achadas = 0
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if not (25 <= area <= 900):
            continue
        if not (0.35 <= w / max(1, h) <= 2.2):
            continue
        out[lab == i] = True
        achadas += 1
    return out, achadas


def escuros(caminho, m):
    """Pixel escuro dentro do recorte.

    Escape, núcleo e bocal são escuros na foto; chapa pintável é clara. Muito
    escuro dentro de uma máscara de capô quer dizer que ela entrou no escape.
    """
    cinza = np.array(Image.open(caminho).convert('L'))
    return int((m & (cinza < 150)).sum())


def borda_suave(alpha):
    return int(((alpha > 0.05) & (alpha < 0.95)).sum())


def avaliar(aid, caminho, candidatos, sil=None):
    """`candidatos`: [(rótulo, alpha 0..1)] -> lista de dicionários medidos."""
    jan, n_jan = janelas_da_foto(caminho, sil)
    linhas = []
    for rot, a in candidatos:
        if a is None:
            linhas.append(dict(rotulo=rot, px=0, janela=0, escuro=0, suave=0, vazio=True))
            continue
        b = a > 0.5
        linhas.append(dict(
            rotulo=rot,
            px=int(b.sum()),
            janela=int((b & jan).sum()),
            escuro=escuros(caminho, b),
            suave=borda_suave(a),
            vazio=not b.any(),
        ))
    return linhas, n_jan


def imprimir(aid, linhas, n_jan):
    print('%s — %d janelas achadas na foto' % (aid, n_jan))
    print('  %-28s %9s %8s %8s %8s' % ('candidato', 'px', 'janela', 'escuro', 'suave'))
    for L in linhas:
        marca = ''
        if L['vazio']:
            marca = '   <<< VAZIO'
        elif L['janela'] > 40:
            marca = '   <<< COBRE JANELA'
        print('  %-28s %9d %8d %8d %8d%s'
              % (L['rotulo'], L['px'], L['janela'], L['escuro'], L['suave'], marca))
