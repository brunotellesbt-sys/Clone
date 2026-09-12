# -*- coding: utf-8 -*-
"""Uma aeronave, uma peça: os dois caminhos, o acabamento, a medida e a ficha.

    python3 setor.py b737 motor
    python3 setor.py b737 motor --aprovar sam+vit    # copia para public/sprites/

O que sai:
    <saida>/<id>__<peca>__sam.png        SAM 2.1
    <saida>/<id>__<peca>__sam_vit.png    + ViTMatte
    <saida>/<id>__<peca>__gnd.png        Grounded SAM 2
    <saida>/<id>__<peca>__gnd_vit.png    + ViTMatte
    <saida>/ficha_<id>_<peca>.png        a imagem que vai para o humano

Nada é copiado para o repositório sem `--aprovar`. É a regra que existe porque
lote sem revisão já produziu 16 winglets aprovados pelo portão e 0 corretos.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from pecas import RAIZ, sprites, peca as ficha_da_peca
import peca as recorte
import acabar as acabamento
import juiz

SAIDA_PADRAO = os.environ.get('SETOR_SAIDA', '/tmp/setor')
METODOS = {'sam': '__sam.png', 'sam+vit': '__sam_vit.png',
           'gnd': '__gnd.png', 'gnd+vit': '__gnd_vit.png'}


def caminho_sprite(aid):
    for a, c in sprites():
        if a == aid:
            return c
    raise SystemExit('sprite desconhecido: %s' % aid)


def fonte(t=21):
    p = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    return ImageFont.truetype(p, t) if os.path.exists(p) else ImageFont.load_default()


def guardar(alpha, caminho):
    Image.fromarray((np.clip(alpha, 0, 1) * 255).astype('uint8')).save(caminho)


def montar_ficha(aid, caminho, itens, destino, zoom_de=None):
    """Painéis no mesmo zoom, um por candidato, para comparar maçã com maçã."""
    foto = Image.open(caminho).convert('RGB')
    if zoom_de is not None and zoom_de.any():
        ys, xs = np.where(zoom_de)
        folga = 90
        cx = (max(0, int(xs.min()) - folga), max(0, int(ys.min()) - folga),
              min(foto.size[0], int(xs.max()) + folga), min(foto.size[1], int(ys.max()) + folga))
    else:
        cx = (0, 0, foto.size[0], foto.size[1])
    larg, alt = cx[2] - cx[0], cx[3] - cx[1]
    esc = min(3.0, 900 / max(1, larg))
    pw, ph = int(larg * esc), int(alt * esc)
    paineis = []
    for rot, a, cor in itens:
        if a is None:
            img = np.array(foto)
            rot = rot + '  — VAZIO'
        else:
            m = np.clip(a, 0, 1)[..., None]
            img = (np.array(foto) * (1 - m * 0.62) + np.array(cor) * m * 0.62).astype('uint8')
        pil = Image.fromarray(img.astype('uint8')).crop(cx).resize((pw, ph), Image.LANCZOS)
        d = ImageDraw.Draw(pil)
        d.rectangle([0, 0, pw - 1, 30], fill=(15, 20, 32))
        d.text((8, 4), rot, fill=(240, 245, 255), font=fonte())
        paineis.append(pil)
    cols = 2
    linhas = (len(paineis) + cols - 1) // cols
    folha = Image.new('RGB', (cols * (pw + 8) + 8, linhas * (ph + 8) + 8), (10, 14, 24))
    for i, p in enumerate(paineis):
        folha.paste(p, (8 + (i % cols) * (pw + 8), 8 + (i // cols) * (ph + 8)))
    folha.save(destino)
    return folha.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('id')
    ap.add_argument('peca')
    ap.add_argument('--saida', default=SAIDA_PADRAO)
    ap.add_argument('--aprovar', choices=sorted(METODOS),
                    help='copia o candidato escolhido para public/sprites/')
    a = ap.parse_args()

    cfg = ficha_da_peca(a.peca)
    caminho = caminho_sprite(a.id)
    os.makedirs(a.saida, exist_ok=True)
    base = os.path.join(a.saida, '%s__%s' % (a.id, a.peca))

    if a.aprovar:
        origem = base + METODOS[a.aprovar]
        if not os.path.exists(origem):
            raise SystemExit('não existe candidato %s para %s/%s' % (a.aprovar, a.id, a.peca))
        destino = os.path.join(RAIZ, cfg['pasta'], '%s.png' % a.id)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        Image.open(origem).convert('L').save(destino)
        print('aprovado: %s -> %s' % (a.aprovar, destino))
        return

    if cfg.get('impossivel_em_perfil'):
        print('AVISO: %s não é separável em vista lateral pura — ver SKILL.md' % a.peca)

    rgb = np.array(Image.open(caminho).convert('RGB'))
    sil = recorte.silhueta(a.id, a.saida)

    m_sam, por_que_sam = recorte.por_sam(a.id, caminho, a.peca, a.saida)
    m_gnd, por_que_gnd = recorte.por_grounded(a.id, caminho, a.peca, a.saida)
    print('  SAM 2.1        : %s' % por_que_sam)
    print('  Grounded SAM 2 : %s' % por_que_gnd)

    a_sam = m_sam.astype(float) if m_sam is not None else None
    a_gnd = m_gnd.astype(float) if m_gnd is not None else None
    v_sam = acabamento.acabar(rgb, m_sam) if m_sam is not None and m_sam.any() else None
    v_gnd = acabamento.acabar(rgb, m_gnd) if m_gnd is not None and m_gnd.any() else None

    for alpha, sufixo in ((a_sam, '__sam.png'), (v_sam, '__sam_vit.png'),
                          (a_gnd, '__gnd.png'), (v_gnd, '__gnd_vit.png')):
        if alpha is not None:
            guardar(alpha, base + sufixo)

    antiga_p = os.path.join(RAIZ, cfg['pasta'], '%s.png' % a.id)
    antiga = None
    if os.path.exists(antiga_p):
        antiga = (np.array(Image.open(antiga_p).convert('L')) > 127).astype(float)

    cands = [('máscara de hoje', antiga), ('SAM 2.1', a_sam), ('SAM 2.1 + ViTMatte', v_sam),
             ('Grounded SAM 2', a_gnd), ('Grounded + ViTMatte', v_gnd)]
    linhas, n_jan = juiz.avaliar(a.id, caminho, cands, sil)
    juiz.imprimir(a.id, linhas, n_jan)

    itens = [('foto crua', None, None)]
    for (rot, alpha), cor in zip(cands, [(255, 80, 80), (0, 200, 255), (60, 255, 140),
                                         (255, 200, 0), (255, 130, 255)]):
        itens.append((rot, alpha, cor))
    zoom = None
    for _, alpha in cands:
        if alpha is not None and (alpha > 0.5).any():
            zoom = alpha > 0.5
            break
    destino = os.path.join(a.saida, 'ficha_%s_%s.png' % (a.id, a.peca))
    print('ficha:', destino, montar_ficha(a.id, caminho, itens, destino, zoom))


if __name__ == '__main__':
    main()
