# -*- coding: utf-8 -*-
"""Várias aeronaves de uma vez, uma folha só, o nome ao lado de cada uma.

    python3 lote.py motor a319__cfm565b6 a320__cfm565b4 ...
    python3 lote.py motor --de 0 --quantos 8

Gera exatamente os mesmos arquivos que `setor.py`, com os mesmos nomes, para
que a aprovação continue passando por lá — `setor.py <id> motor --aprovar
sam+vit`. O lote é só apresentação: **a decisão continua sendo uma por uma**.

Sai uma folha com um painel por aeronave, cada um com o nome e o veredito da
autocrítica. Painel que reprovou vai marcado; ele não deve ser aprovado sem
que alguém olhe por quê.
"""
import argparse, os, sys, traceback
import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from pecas import sprites, peca as ficha_da_peca
import peca as recorte
import acabar as acabamento
import conferir
from setor import fonte, guardar

SAIDA_PADRAO = os.environ.get('SETOR_SAIDA', '/tmp/setor')


def uma(aid, caminho, nome_peca, saida):
    """Devolve (alpha final, veredito, linhas do juiz) e grava os candidatos."""
    cfg = ficha_da_peca(nome_peca)
    rgb = np.array(Image.open(caminho).convert('RGB'))
    testes = None
    if cfg.get('recorta_capo'):
        nac, _ = recorte.por_sam(aid, caminho, nome_peca, saida, so_inteira=True)
        if nac is not None and nac.any():
            testes = conferir.testes_motor(rgb, nac)
    m, por_que = recorte.por_sam(aid, caminho, nome_peca, saida, testes=testes)
    if m is None or not m.any():
        return None, 'VAZIO', [], por_que
    v = acabamento.acabar(rgb, m)
    base = os.path.join(saida, '%s__%s' % (aid, nome_peca))
    guardar(m.astype(float), base + '__sam.png')
    guardar(v, base + '__sam_vit.png')
    if testes is None:
        return v, 'sem juiz', [], por_que
    ok, linhas = conferir.julgar(testes, v)
    return v, 'APROVADO' if ok else 'REPROVADO', linhas, por_que


def painel(caminho, alpha, titulo, veredito, larg=560):
    """Recorte em volta da peça, no zoom que cabe, com o nome em cima."""
    foto = Image.open(caminho).convert('RGB')
    arr = np.array(foto)
    if alpha is not None and (alpha > 0.5).any():
        ys, xs = np.where(alpha > 0.5)
        folga = 45
        cx = (max(0, int(xs.min()) - folga), max(0, int(ys.min()) - folga),
              min(foto.size[0], int(xs.max()) + folga), min(foto.size[1], int(ys.max()) + folga))
        m = np.clip(alpha, 0, 1)[..., None]
        arr = (arr * (1 - m * 0.62) + np.array([60, 255, 140]) * m * 0.62)
    else:
        cx = (0, 0, foto.size[0], foto.size[1])
    pil = Image.fromarray(arr.astype('uint8')).crop(cx)
    alt = max(1, int(pil.size[1] * larg / max(1, pil.size[0])))
    pil = pil.resize((larg, alt), Image.LANCZOS)
    faixa = 34
    fora = Image.new('RGB', (larg, alt + faixa), (10, 14, 24))
    fora.paste(pil, (0, faixa))
    d = ImageDraw.Draw(fora)
    cor = (255, 120, 120) if veredito != 'APROVADO' else (140, 255, 180)
    d.text((8, 6), titulo, fill=(240, 245, 255), font=fonte(22))
    d.text((larg - 8 - d.textlength(veredito, font=fonte(18)), 9), veredito,
           fill=cor, font=fonte(18))
    return fora


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('peca')
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--de', type=int, default=0)
    ap.add_argument('--quantos', type=int, default=0)
    ap.add_argument('--saida', default=SAIDA_PADRAO)
    ap.add_argument('--folha', default=None)
    a = ap.parse_args()

    todos = sprites()
    if a.ids:
        alvo = set(a.ids)
        todos = [t for t in todos if t[0] in alvo]
    elif a.quantos:
        todos = todos[a.de:a.de + a.quantos]
    if not todos:
        raise SystemExit('nenhum sprite corresponde')

    os.makedirs(a.saida, exist_ok=True)
    paineis = []
    for i, (aid, caminho) in enumerate(todos, 1):
        try:
            alpha, veredito, linhas, por_que = uma(aid, caminho, a.peca, a.saida)
        except Exception:
            traceback.print_exc()
            alpha, veredito, linhas, por_que = None, 'ERRO', [], ''
        px = 0 if alpha is None else int((alpha > 0.5).sum())
        print('%2d/%d  %-22s %-10s %7d px  %s' % (i, len(todos), aid, veredito, px, por_que),
              flush=True)
        conferir.relatar('', linhas)
        paineis.append(painel(caminho, alpha, aid, veredito))

    cols = 2 if len(paineis) > 1 else 1
    lin = (len(paineis) + cols - 1) // cols
    pw = max(p.size[0] for p in paineis)
    ph = max(p.size[1] for p in paineis)
    folha = Image.new('RGB', (cols * (pw + 8) + 8, lin * (ph + 8) + 8), (10, 14, 24))
    for i, p in enumerate(paineis):
        folha.paste(p, (8 + (i % cols) * (pw + 8), 8 + (i // cols) * (ph + 8)))
    destino = a.folha or os.path.join(a.saida, 'lote_%s.png' % a.peca)
    folha.save(destino)
    print('folha:', destino, folha.size)


if __name__ == '__main__':
    main()
