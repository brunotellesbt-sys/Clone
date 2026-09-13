# -*- coding: utf-8 -*-
"""Passo 1: a silhueta do avião, com BiRefNet, em alpha de 8 bits.

Substitui a inundação que produzia máscara de 1 bit. A diferença não é de forma
— IoU 0,975 a 0,983 contra a antiga — é de **borda**: onde havia degrau de um
pixel agora há transição medida, e é isso que tira o serrilhado do contorno em
qualquer zoom.

    python3 silhueta.py --todos            # os 100 sprites
    python3 silhueta.py b737 atr72         # só estes
    python3 silhueta.py --todos --gravar   # grava em public/sprites/planemasks/
"""
import argparse, os, sys
import numpy as np
import torch
import cv2
from PIL import Image
from torchvision import transforms

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pecas import RAIZ, sprites

SAIDA_PADRAO = os.environ.get('SETOR_SAIDA', '/tmp/setor')


def carregar():
    from transformers import AutoModelForImageSegmentation
    # o peso publicado é meia precisão; em CPU roda em float32
    m = AutoModelForImageSegmentation.from_pretrained(
        'ZhengPeng7/BiRefNet', trust_remote_code=True).float().eval()
    tf = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    return m, tf


def uma(modelo, tf, caminho):
    pil = Image.open(caminho).convert('RGB')
    with torch.inference_mode():
        bruto = modelo(tf(pil).unsqueeze(0))[-1].sigmoid()[0, 0].numpy()
    return cv2.resize(bruto, pil.size, interpolation=cv2.INTER_LINEAR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--todos', action='store_true')
    ap.add_argument('--gravar', action='store_true',
                    help='escreve em public/sprites/planemasks/ (senão, só na saída de trabalho)')
    ap.add_argument('--saida', default=SAIDA_PADRAO)
    a = ap.parse_args()

    todos = sprites()
    if not a.todos:
        alvo = set(a.ids)
        todos = [t for t in todos if t[0] in alvo]
        if not todos:
            raise SystemExit('nenhum sprite corresponde a: %s' % ' '.join(a.ids))

    os.makedirs(a.saida, exist_ok=True)
    modelo, tf = carregar()
    for i, (aid, caminho) in enumerate(todos, 1):
        alpha = uma(modelo, tf, caminho)
        img = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype('uint8'))
        img.save(os.path.join(a.saida, '%s__silhueta.png' % aid))
        if a.gravar:
            img.save(os.path.join(RAIZ, 'planemasks', '%s.png' % aid))
        meio = int(((alpha > 0.05) & (alpha < 0.95)).sum())
        print('%3d/%d  %-12s  %7d px cheios  %5d px de borda suave'
              % (i, len(todos), aid, int((alpha > 0.5).sum()), meio), flush=True)


if __name__ == '__main__':
    main()
