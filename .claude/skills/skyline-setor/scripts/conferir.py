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


def chao_da_foto(img, nac, alcance=40):
    """Onde a chapa acaba **na foto**, coluna a coluna — o pé de verdade.

    Nem a silhueta do BiRefNet serve de referência aqui: medido no b737, na
    coluna x=600 a chapa desce até y=652 e a silhueta para em y=640. A barriga
    da nacela está em sombra, e sombra contra fundo claro é justamente onde o
    modelo de recorte hesita. Medir o pé contra ela é circular, do mesmo jeito
    que medir janela contra `windowmasks` era.

    Fundo do sprite é branco: desce da base da nacela enquanto o pixel não for
    fundo, no máximo `alcance` px, para não emendar no trem de pouso.
    """
    cinza = _cinza(img)
    h, w = cinza.shape
    chao = np.full(w, -1, np.int32)
    for x in np.where(nac.any(axis=0))[0]:
        y = int(np.where(nac[:, x])[0].max())
        lim = min(h - 1, y + alcance)
        while y + 1 <= lim and cinza[y + 1, x] < 240:
            y += 1
        chao[x] = y
    return chao


def fim_do_labio(labio, nariz_esq=True):
    """Onde o lábio **de fato** acaba, não onde o último pixel escuro dele cai.

    `zona_do_labio` pega o crescente de chrome mais um rastro fino de sombra que
    corre pela barriga da nacela por dezenas de colunas. Cortar no último pixel
    desse rastro joga fora chapa branca que a companhia pinta: medido no b737,
    o corte ia para x=571 quando a massa do lábio acaba em x=528 — 40 colunas de
    capô a menos.

    O lábio é **um crescente encostado no bico**, então vale a primeira corrida
    grossa a partir dele, e ela acaba na primeira coluna fina. Pegar a última
    coluna grossa da imagem inteira não serve: no b737 o crescente vai de 518 a
    528, e em 561 há outra coluna grossa que é a junta de painel — a linha que
    fecha o barril de entrada, chapa pintável, não boca.
    """
    if labio is None or not labio.any():
        return None
    c = labio.sum(axis=0)
    lim = max(1, c.max() * 0.25)
    cols = np.where(c > 0)[0]
    x = int(cols.min()) if nariz_esq else int(cols.max())
    passo = 1 if nariz_esq else -1
    while 0 <= x + passo < len(c) and c[x + passo] >= lim:
        x += passo
    return x


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
    # só o crescente conta como boca; o rastro de sombra na barriga é chapa
    fim = fim_do_labio(labio, nariz_esq)
    if fim is not None:
        rastro = np.zeros_like(labio)
        if nariz_esq:
            rastro[:, fim + 1:] = True
        else:
            rastro[:, :fim] = True
        labio = labio & ~rastro
    chao = chao_da_foto(img, nac)
    ys, xs = np.where(nac)
    y0, y1 = int(ys.min()), int(ys.max())
    alto = y1 - y0
    sem_pe = np.zeros_like(nac)
    sem_pe[y0:y1 - int(alto * 0.22), :] = True

    def t_boca(a):
        return int(((a > 0.5) & labio).sum())

    def t_pe(a):
        """Quanto da base da nacela ficou de fora, coluna a coluna.

        Três px por coluna não contam, e as oito colunas de cada ponta não contam.
        Depois do ViTMatte a borda é alpha, e o pixel onde ela cruza 0,5 anda
        até três para dentro; nas colunas onde a peça termina numa junta de
        painel, a nacela ainda desce mais porque é redonda e o corte é reto.
        Medido no b737: a mesma peça dá 12 px binária e 329 px depois do
        acabamento — 3 px por coluna em toda a extensão, mais 45 e 36 nas duas
        pontas, sem que um milímetro de chapa tenha sumido. O chanfro da ponta
        decai ao longo de umas oito colunas — corte reto encontrando nacela
        redonda é forma, não buraco. Falta de pé de verdade é dezenas de px em
        colunas do meio, e essa continua inteira.
        """
        m = a > 0.5
        if not m.any():
            return 0
        cols = np.where(m.any(axis=0))[0]
        falta = 0
        for x in cols[8:-8] if len(cols) > 16 else cols:
            cm = np.where(m[:, x])[0]
            if chao[x] >= 0:
                d = int(chao[x] - cm.max())
                if d > 3:
                    falta += d
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


def situacao(linhas):
    """Não "passou/não passou": **quanto** falta, e em quê.

    Veredito binário não deixa melhorar. Neste lote os cinco testes aprovaram
    seis recortes que o olho reprovou — e um "APROVADO" encerra a busca, ao
    passo que um "passou raspando em dois testes" diz onde mexer. Pior ainda é o
    aprovado folgado: quando toda a margem é larga, o provável é que o defeito
    esteja onde nenhum teste olha, não que a peça esteja boa.

    Devolve (rótulo, folga, apertados):
        folga      a menor margem relativa entre os testes, de -inf a 1
                   1,0 = nenhum defeito medido; 0 = em cima do limite
        apertados  os testes com folga abaixo de 0,35, do pior para o melhor
    """
    if not linhas:
        return 'sem juiz', 0.0, []
    folgas = [(nome, (lim - v) / float(lim)) for nome, v, lim, _ in linhas]
    pior = min(f for _, f in folgas)
    apertados = sorted([(n, f) for n, f in folgas if f < 0.35], key=lambda t: t[1])
    if pior < -1.0:
        rot = 'LONGE'
    elif pior < 0:
        rot = 'QUASE'
    elif pior < 0.35:
        rot = 'PASSOU RASPANDO'
    else:
        rot = 'APROVADO'
    return rot, pior, apertados


def relatar(rot, linhas, recuo='      '):
    for nome, v, lim, ok in linhas:
        folga = (lim - v) / float(lim)
        print('%s%-24s %6d  (limite %4d) folga %+6.2f %s'
              % (recuo, nome, v, lim, folga, 'ok' if ok else '<<< REPROVADO'))
    situ, pior, apertados = situacao(linhas)
    if apertados:
        print('%s-> %s (folga %+.2f); apertado em: %s' % (
            recuo, situ, pior, ', '.join('%s %+.2f' % (n, f) for n, f in apertados)))
    else:
        print('%s-> %s (folga %+.2f)' % (recuo, situ, pior))
