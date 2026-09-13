# -*- coding: utf-8 -*-
"""Autocrítica: confere o candidato **final** e diz como consertar cada falha.

Existe porque o laço estava errado, não o recorte. Eu gerava, mandava, e o autor
achava o defeito — boca pintada, pé faltando. Os dois são mensuráveis na foto em
milissegundos; não havia razão para eles saírem daqui.

Duas regras que a experiência impôs:

**Conferir o final, nunca o intermediário.** `fechar_no_pe` e a remoção da boca
rodavam antes do ViTMatte, e o ViTMatte encolhe a borda depois — comia o pé de
volta e reabria a boca. Medido no b737: 147 px de pé faltando em 102 colunas e
679 px de lábio dentro, num candidato cujos passos intermediários estavam certos.

**Cada falha traz o conserto.** Achar o defeito e devolver "está errado" não
serve: quem chama precisa saber o que aplicar. Por isso cada teste devolve um
`reparo` — uma função que recebe o alpha e devolve o alpha corrigido.
"""
import numpy as np
import cv2


def _cinza(img):
    return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)


def _faixa_dianteira(m, fracao=0.22, nariz_esq=True):
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
    """A zona proibida do lábio, calculada **uma vez**.

    Recalcular a cada volta foi o que fez os consertos brigarem: fechar o pé nas
    colunas da frente re-adiciona pixel escuro, o teste da boca lê esse pixel
    como lábio novo, tira, e aí o pé reabre. Medido no b737, o laço oscilava —
    boca 45, depois 113, depois 263; pé 146, 145, 293. Fixando a zona, os dois
    consertos passam a agir em regiões disjuntas e o laço converge.
    """
    cinza = _cinza(img)
    dentro = nac
    if not dentro.any():
        return np.zeros_like(nac), (0, 0)
    claro = float(np.median(cinza[dentro]))
    frente = _faixa_dianteira(nac, 0.22, nariz_esq)
    escuro = dentro & frente & (cinza < claro * 0.88)
    if escuro.sum() < 30:
        return np.zeros_like(nac), (0, 0)
    # só o pedaço encostado no bico: mancha escura solta é painel, não boca
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
    labio = cv2.dilate(labio.astype(np.uint8), np.ones((3, 3), np.uint8), 1) > 0
    cols = np.where(labio.any(axis=0))[0]
    faixa = (int(cols.min()), int(cols.max())) if len(cols) else (0, 0)
    return labio & nac, faixa


def testes_motor(img, nac, nariz_esq=True):
    """Os testes do capô do motor, cada um com o conserto dele.

    `nac` é a nacela inteira — a referência de "até onde a peça pode ir".
    """
    cinza = _cinza(img)
    labio, faixa_labio = zona_do_labio(img, nac, nariz_esq)

    def boca_dentro(alpha):
        n = int(((alpha > 0.5) & labio).sum())
        if n <= 40:
            return n, None

        def reparo(a):
            b = a.copy()
            b[labio] = 0.0
            return b
        return n, reparo

    def pe_faltando(alpha):
        m = alpha > 0.5
        if not m.any():
            return 0, None
        cols = np.where(m.any(axis=0))[0]
        falta = 0
        alvo = np.zeros_like(m)
        for x in cols:
            # coluna dentro do lábio não se fecha: é lá que os dois consertos
            # se atropelavam
            if faixa_labio[0] <= x <= faixa_labio[1]:
                continue
            cm = np.where(m[:, x])[0]
            cn = np.where(nac[:, x])[0]
            if not len(cn):
                continue
            if cn.max() > cm.max():
                falta += int(cn.max() - cm.max())
                alvo[cm.max():cn.max() + 1, x] = True
        if falta <= 20:
            return falta, None

        def reparo(a):
            b = a.copy()
            b[alvo] = np.maximum(b[alvo], 1.0)
            b[labio] = 0.0          # nunca reabre a boca
            return b
        return falta, reparo

    def escape_dentro(alpha):
        """Escape e bocal são escuros: muito escuro na traseira é invasão."""
        m = alpha > 0.5
        if not m.any():
            return 0, None
        claro = float(np.median(cinza[m]))
        tras = ~_faixa_dianteira(nac, 0.55, nariz_esq) & m
        n = int((tras & (cinza < claro * 0.80)).sum())
        return n, None   # sem conserto automático: exige recortar de novo

    return [
        ('boca dentro do capô', boca_dentro, 40),
        ('pé do capô faltando', pe_faltando, 20),
        ('escape dentro do capô', escape_dentro, 400),
    ]


def testes_janela(img, alpha_fn=None):
    """Nenhuma peça de pintura encosta na fileira de janela."""
    from juiz import janelas_da_foto
    return []


def rodar(testes, alpha, tentativas=3):
    """Roda os testes, aplica os consertos, repete. Devolve (alpha, relatório).

    O laço existe porque um conserto pode reabrir outro: fechar o pé mexe na
    borda que a remoção da boca tinha deixado limpa. Três voltas bastaram em
    todos os casos medidos; se não bastar, o relatório diz o que ficou aberto e
    quem chama **não** publica.
    """
    rel = []
    for volta in range(tentativas):
        aberto = []
        for nome, fn, limite in testes:
            n, reparo = fn(alpha)
            if n > limite:
                aberto.append((nome, n, reparo))
        if not aberto:
            rel.append('volta %d: tudo dentro do limite' % (volta + 1))
            return alpha, rel, True
        consertou = False
        for nome, n, reparo in aberto:
            if reparo is None:
                rel.append('volta %d: %s = %d — SEM CONSERTO AUTOMÁTICO' % (volta + 1, nome, n))
                continue
            alpha = reparo(alpha)
            consertou = True
            rel.append('volta %d: %s = %d — corrigido' % (volta + 1, nome, n))
        if not consertou:
            break
    # última medida, para o relatório não mentir
    resto = [(nome, fn(alpha)[0], lim) for nome, fn, lim in testes]
    ok = all(n <= lim for _, n, lim in resto)
    for nome, n, lim in resto:
        if n > lim:
            rel.append('AINDA FORA: %s = %d (limite %d)' % (nome, n, lim))
    return alpha, rel, ok
