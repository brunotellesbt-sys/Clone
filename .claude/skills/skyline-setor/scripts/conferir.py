# -*- coding: utf-8 -*-
"""Autocrítica: julga o candidato **final**. Não conserta — reprova.

A versão anterior consertava, e foi erro de arquitetura. Os consertos eram
cirurgia de pixel em cima do resultado do SAM — apagar a zona do lábio, empurrar
a borda até o pé da nacela — e morfologia grosseira produz exatamente o que o
autor viu a olho: retalho quadrado no meio da chapa e borda em degrau. Pior:
os testes aprovavam esse resultado, porque nenhum deles media buraco nem degrau.

Agora o contrato é outro. Aqui só se mede. Quando reprova, quem chama **recorta
de novo com outra semente** — o lábio entra como ponto negativo do SAM, e é o
modelo que decide a forma. Remendo nenhum.

Os cinco testes, e o defeito que cada um existe para pegar:

    boca      lábio de entrada dentro da peça        (visto na tela)
    pé        base do capô faltando                  (visto na tela)
    escape    bocal e cone dentro da peça            (visto na tela)
    buraco    furo no meio da peça                   (produzido pelo remendo)
    degrau    borda serrilhada                       (produzido pelo remendo)
"""
import numpy as np
import cv2


def _cinza(img):
    return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)


def faixa_dianteira(m, fracao=0.22, nariz_esq=True):
    ys, xs = np.where(m)
    if not len(xs):
        return np.zeros_like(m)
    x0, x1 = int(xs.min()), int(xs.max())
    larg = max(1, int((x1 - x0) * fracao))
    fx = np.zeros_like(m)
    if nariz_esq:
        fx[:, x0:x0 + larg] = True
    else:
        fx[:, x1 - larg:x1 + 1] = True
    return fx


def zona_do_labio(img, nac, nariz_esq=True):
    """O crescente do lábio de entrada, para virar **ponto negativo** do SAM.

    Não serve mais para subtrair da máscara: subtrair um bloco abre buraco. Serve
    para dizer ao modelo onde a peça *não* está, e deixar ele traçar a curva.
    """
    cinza = _cinza(img)
    if not nac.any():
        return np.zeros_like(nac)
    claro = float(np.median(cinza[nac]))
    escuro = nac & faixa_dianteira(nac, 0.22, nariz_esq) & (cinza < claro * 0.88)
    if escuro.sum() < 30:
        return np.zeros_like(nac)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(escuro.astype(np.uint8), 8)
    xs = np.where(nac.any(axis=0))[0]
    borda = int(xs.min()) + 3 if nariz_esq else int(xs.max()) - 3
    labio = np.zeros_like(escuro)
    for i in range(1, n):
        c = (lab == i)
        cx = np.where(c.any(axis=0))[0]
        encosta = cx.min() <= borda if nariz_esq else cx.max() >= borda
        if encosta and stats[i, cv2.CC_STAT_AREA] >= 25:
            labio |= c
    return labio & nac


def buraco(alpha):
    """Furo no meio da peça: área que o preenchimento fecha e a máscara não tem.

    Peça de aeronave é maciça em vista lateral. Furo é sempre defeito — e foi o
    que o remendo de lábio produziu, um retalho quadrado no meio da chapa.
    """
    m = (alpha > 0.5).astype(np.uint8)
    if not m.any():
        return 0
    cheio = m.copy()
    h, w = m.shape
    mascara = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(cheio, mascara, (0, 0), 1)
    # o que ficou 0 depois da inundação de fora é furo interno
    return int(((cheio == 0)).sum())


def degrau(alpha):
    """Rugosidade da borda, em px de perímetro além do contorno suavizado.

    Borda de peça de aeronave é lisa. Degrau vem de máscara de 1 bit ou de
    remendo por coluna, e é o que dá o aspecto serrilhado na tela.
    """
    m = (alpha > 0.5).astype(np.uint8)
    if not m.any():
        return 0
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return 0
    c = max(cs, key=cv2.contourArea)
    per = cv2.arcLength(c, True)
    liso = cv2.arcLength(cv2.approxPolyDP(c, 2.0, True), True)
    return int(max(0, per - liso))


def testes_motor(img, nac, nariz_esq=True):
    """Os cinco testes do capô, e o limite de cada um. Só julgam."""
    cinza = _cinza(img)
    labio = zona_do_labio(img, nac, nariz_esq)
    ys, xs = np.where(nac)
    y0, y1 = int(ys.min()), int(ys.max())
    alto = y1 - y0
    sem_pe = np.zeros_like(nac)
    sem_pe[y0:y1 - int(alto * 0.22), :] = True

    def t_boca(a):
        return int(((a > 0.5) & labio).sum())

    def t_pe(a):
        m = a > 0.5
        if not m.any():
            return 0
        falta = 0
        for x in np.where(m.any(axis=0))[0]:
            cm = np.where(m[:, x])[0]
            cn = np.where(nac[:, x])[0]
            if len(cn) and cn.max() > cm.max():
                falta += int(cn.max() - cm.max())
        return falta

    def t_escape(a):
        """Só atrás de 62% e acima do pé: senão a conta lê a sombra da base.

        Medido no b737: 2.061 dos 2.359 px escuros do capô estavam no terço de
        baixo, espalhados de ponta a ponta — lábio inferior em sombra, que é
        pintável. Escape de verdade fica concentrado atrás, na altura do bocal.
        """
        m = a > 0.5
        if not m.any():
            return 0
        claro = float(np.median(cinza[m]))
        tras = ~faixa_dianteira(nac, 0.62, nariz_esq) & m & sem_pe
        return int((tras & (cinza < claro * 0.80)).sum())

    return [
        ('boca dentro do capô', t_boca, 40),
        ('pé do capô faltando', t_pe, 25),
        ('escape dentro do capô', t_escape, 400),
        ('buraco no meio da peça', buraco, 60),
        ('borda em degrau', degrau, 120),
    ]


def julgar(testes, alpha):
    """Devolve (passou, [(nome, valor, limite, ok)])."""
    linhas = []
    for nome, fn, lim in testes:
        v = fn(alpha)
        linhas.append((nome, v, lim, v <= lim))
    return all(L[3] for L in linhas), linhas


def relatar(rot, linhas, recuo='      '):
    for nome, v, lim, ok in linhas:
        print('%s%-24s %6d  (limite %d) %s' % (recuo, nome, v, lim, 'ok' if ok else '<<< REPROVADO'))
