"""Tira a tira reta que sobrou da caixa do prompt no topo do trem de pouso.

Em 46 das 55 o recorte do trem vem com uma faixa horizontal de poucos pixels
colada no topo, cobrindo toda a largura da peça. Ela não é trem: cai na chapa
da barriga e do intradorso da asa, e é o que aparece no jogo como um risco de
cor de trem atravessando a fuselagem.

A tira é reconhecível por três coisas juntas: é fina, cobre quase toda a
extensão horizontal da peça e está no topo dela. Peça de verdade — tampa de
poço, viga de bogie — não tem as três.
"""
import os, sys, numpy as np
from scipy import ndimage
sys.path.insert(0, '.claude/skills/skyline-mask-audit/scripts')
import maskcore as mc

R = 'public/sprites'
COBRE, ALTO = 0.75, 12

def tirar(m):
    fora = np.zeros_like(m)
    rot, n = ndimage.label(m)
    for i in range(1, n + 1):
        c = rot == i
        if c.sum() < 300: continue
        xs = np.where(c.any(axis=0))[0]; ext = xs.max() - xs.min() + 1
        ys = np.where(c.any(axis=1))[0]
        if ext < 40: continue
        # linhas cheias dentro da janela do topo. Não dá para parar na primeira
        # que falha: a linha de cima da tira vem serrilhada e cobre menos.
        janela = [y for y in ys if y - ys.min() < ALTO]
        cheias = [y for y in janela if c[y].sum() / ext >= COBRE]
        if not cheias:
            continue
        for y in ys:
            if y <= max(cheias):
                fora[y] = c[y]
    return m & ~fora, int(fora.sum())

if __name__ == '__main__':
    grava = '--write' in sys.argv
    total = 0
    for f in sorted(os.listdir(f'{R}/gearmasks')):
        p = f'{R}/gearmasks/{f}'
        m = mc.carregar_mask(p)
        if not m.any(): continue
        novo, n = tirar(m)
        if n:
            total += n
            print(f'  {f[:-4]:10s} -{n}px')
            if grava: mc.salvar_mask(novo, p)
    print(f'{total}px de tira')
