# -*- coding: utf-8 -*-
"""Passo 3: acabamento com ViTMatte — borda dura vira alpha suave.

Só isso. O ViTMatte **não corrige forma**: medido no ATR 72, recebeu uma máscara
que cobria meia fileira de janela e devolveu 528 px ainda sobre janela, agora com
borda macia. Por isso o anel de dúvida aqui é estreito: a forma já está decidida,
o que está em jogo é a transição.
"""
import os, sys
import numpy as np
import torch
import cv2
from PIL import Image

_vit = None


def vit():
    global _vit
    if _vit is None:
        from transformers import VitMatteImageProcessor, VitMatteForImageMatting
        nome = 'hustvl/vitmatte-small-composition-1k'
        _vit = (VitMatteImageProcessor.from_pretrained(nome),
                VitMatteForImageMatting.from_pretrained(nome).eval())
    return _vit


def acabar(img_rgb, mascara, folga=1):
    """`mascara` booleana -> alpha 0..1 com borda medida.

    `folga` controla a largura do anel de dúvida em iterações de dilatação.
    Largo demais o modelo inventa contorno; estreito demais não sobra o que
    refinar. 1 é o que serve para peça já bem recortada.
    """
    m = mascara.astype(np.uint8)
    if not m.any():
        return np.zeros(m.shape, np.float32)
    # 3x3, não 5x5: com 5x5 a erosão come 2 px de cada lado, e peça fina some
    # inteira do "certamente dentro" do trimap — o ViTMatte então a trata como
    # dúvida e a apaga. Medido no A220: a aba de baixo do capô tem 5 px de
    # altura, existia no recorte com 24 px e voltava do acabamento com 0.
    k = np.ones((3, 3), np.uint8)
    # O anel de dúvida fica **só do lado de fora**. Erodir para dentro tira do
    # trimap as partes finas da peça, e o que não é "certamente dentro" o
    # ViTMatte apaga: medido no A220, a aba de baixo do capô tem 5 px de altura,
    # existia no recorte com 24 px e voltava do acabamento com 0. A forma já foi
    # decidida e medida pelo juiz; aqui só se resolve a transição.
    dentro = m
    fora = cv2.dilate(m, k, iterations=folga + 1)
    tri = np.zeros(m.shape, np.uint8)
    tri[fora > 0] = 128
    tri[dentro > 0] = 255
    proc, modelo = vit()
    ent = proc(images=img_rgb, trimaps=tri, return_tensors='pt')
    with torch.inference_mode():
        a = modelo(**ent).alphas[0, 0].numpy()
    a = cv2.resize(a, (m.shape[1], m.shape[0]), interpolation=cv2.INTER_LINEAR)
    # o ViTMatte não pode ampliar a peça: fora do anel de dúvida, manda a forma
    a[fora == 0] = 0.0

    # E onde a peça é fina ele não opina. Proibi-lo de erodir o trimap não
    # bastou: medido no A220, a tira de carenagem em cima do escape vai de
    # x=645 a x=667 no recorte, e depois do acabamento sobravam 1 ou 2 px por
    # coluna, com colunas inteiras zeradas. Numa tira de 1 a 5 px não há
    # transição para medir — o que existe é a peça —, então ali vale o recorte.
    fino = (cv2.distanceTransform(m, cv2.DIST_L2, 3) <= 2.5) & (m > 0)
    a = np.maximum(a, fino.astype(np.float32))
    return np.clip(a, 0, 1)
