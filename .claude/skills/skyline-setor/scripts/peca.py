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


def linha_de_painel(img, m, nariz_esq=True, janela=(0.35, 0.88)):
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
    # `janela` diz em que trecho do comprimento procurar. Padrão (0,35–0,88) é a
    # divisa do reversor: antes disso é o lábio, depois é o bocal. Com
    # (0,04–0,26) acha a outra junta, a que fecha o lábio de entrada.
    # a fração é medida **a partir do bico**, então espelha quando ele está à
    # direita — o perfil é sempre indexado da esquerda
    n = len(perfil)
    if nariz_esq:
        ini, fim = int(n * janela[0]), int(n * janela[1])
    else:
        ini, fim = n - int(n * janela[1]), n - int(n * janela[0])
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


def por_sam(aid, caminho, nome_peca, trabalho, nariz_esq=True, testes=None, so_inteira=False):
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
    if so_inteira or not cfg.get('recorta_capo'):
        return inteira, 'peça inteira'
    return capo_pintavel(aid, img, inteira, cfg, nariz_esq, testes)


def sementes_do_capo(img, nac, corte, labio, nariz_esq=True):
    """As sementes a tentar para o capô, da mais informada para a mais simples.

    Semente, não remendo. O lábio entra como **ponto negativo** — o modelo traça
    a curva dele sozinho, e é isso que evita o retalho quadrado que a subtração
    por bloco produzia. O escape também é negativo, porque a divisa de painel
    sozinha nem sempre segura o recorte.

    Várias tentativas porque nenhuma semente serve para todo motor: o que prende
    o CFM56 solta no D-436. Quem chama roda o juiz em cada uma e fica com a que
    passar.
    """
    ys, xs = np.where(nac)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    ymeio = (y0 + y1) / 2

    # Empurrar a caixa para depois do lábio também não resolve: medido no b737,
    # a boca saía (0 px) mas o pé do capô ia junto, 1.016 px faltando. Lábio e
    # pé são a mesma sombra contínua para o modelo — qualquer coisa que afaste
    # um afasta o outro.
    frente, tras = (x0, corte) if nariz_esq else (corte, x1)
    if labio is not None and labio.any():
        lxs = np.where(labio.any(axis=0))[0]
        if nariz_esq:
            frente = max(frente, int(lxs.max()) + 1)
        else:
            tras = min(tras, int(lxs.min()) - 1)
    # a caixa desce até o fim da nacela: o pé fica em sombra e é o último a
    # entrar; apertar a caixa embaixo é o que o deixava de fora
    caixa = np.array([frente - 1, y0 - 3, tras + 3, y1 + 4], float)

    neg = []
    if labio is not None and labio.any():
        lys, lxs = np.where(labio)
        neg.append([float(lxs.mean()), float(lys.mean())])
    # dois negativos no que vem depois da divisa: bocal e cone
    if nariz_esq:
        neg += [[x1 - (x1 - corte) * 0.30, ymeio], [x1 - (x1 - corte) * 0.10, ymeio]]
    else:
        neg += [[x0 + (corte - x0) * 0.30, ymeio], [x0 + (corte - x0) * 0.10, ymeio]]

    largura = abs(tras - frente)
    centro = [[frente + largura * f, ymeio] for f in (0.35, 0.55, 0.75)] if nariz_esq \
        else [[tras - largura * f, ymeio] for f in (0.35, 0.55, 0.75)]
    # pontos também em cima e embaixo: é o que puxa o pé em sombra para dentro
    alto = y1 - y0
    # até 0,93 da altura: o pé do capô fica em sombra, e ponto que para em 0,82
    # deixa o modelo fechar antes dele
    alturas = (0.18, 0.5, 0.80, 0.93)
    coluna = [[frente + largura * 0.5, y0 + alto * f] for f in alturas] if nariz_esq \
        else [[tras - largura * 0.5, y0 + alto * f] for f in alturas]

    # Semente titular: recortar o capô **inteiro**, do bico à divisa do
    # reversor, e só então separar a boca por uma **linha de painel vertical**
    # no fim do lábio. A divisa dianteira é uma junta de painel igual à de trás,
    # e já se corta naquela — cortar nesta é o mesmo gesto, não remendo: não
    # abre furo nem serrilha (medido: buraco 0, degrau 10).
    # Assim o modelo vê o capô como uma peça só e traz o pé em sombra junto;
    # o lábio sai depois, pela geometria, sem arrastar o pé com ele.
    from conferir import fim_do_labio
    fim = fim_do_labio(labio, nariz_esq)
    labx = None if fim is None else (fim + 1 if nariz_esq else fim - 1)
    cheia = np.array([x0 - 2, y0 - 3, corte + 3, y1 + 4], float) if nariz_esq \
        else np.array([corte - 3, y0 - 3, x1 + 2, y1 + 4], float)
    lg = abs(corte - (x0 if nariz_esq else x1))
    base = x0 if nariz_esq else x1
    grade = [[base + (lg if nariz_esq else -lg) * fx, y0 + alto * fy]
             for fx in (0.25, 0.5, 0.75) for fy in (0.15, 0.5, 0.85, 0.95)]
    escape = neg[1:] if (labio is not None and labio.any()) else neg

    return [
        ('capô inteiro + grade 3x4, boca cortada na junta', cheia, grade, escape, labx),
        ('caixa + 3 no eixo + 3 na altura + negativos', caixa, centro + coluna, neg, None),
        ('caixa + 3 no eixo + negativos', caixa, centro, neg, None),
        ('caixa + 1 ponto + negativos', caixa, centro[1:2], neg, None),
        ('caixa sozinha', caixa, [], [], None),
    ]


def entre_as_juntas(img, nac, corte, labio, nariz_esq=True):
    """O capô como região medida: entre as duas juntas, fechada até o chão.

    Três limites, três fontes, nenhuma circular:

        frente  junta que fecha o lábio de entrada  (fim da massa do lábio)
        trás    divisa de painel do reversor        (`linha_de_painel`)
        baixo   última chapa antes do fundo branco  (`chao_da_foto`)

    O contorno de cima continua vindo do SAM, que é o que ele faz bem. Fechar
    coluna por coluna até um chão medido não é remendo: não abre furo — cada
    coluna vira uma corrida só — e não serrilha, porque o chão é contínuo.
    """
    from conferir import fim_do_labio, chao_da_foto

    fim = fim_do_labio(labio, nariz_esq)
    if fim is None:
        return None, ''
    # dois px de recuo na junta dianteira: o ViTMatte alarga a borda em rampa, e
    # sem recuo a rampa cai em cima do crescente. Custa 2 px de chapa e evita
    # pintura invadindo a boca.
    m = nac.copy()
    if nariz_esq:
        m[:, :fim + 3] = False
        m[:, corte + 1:] = False
    else:
        m[:, corte:] = False
        m[:, :fim - 1] = False
    if not m.any():
        return None, ''

    chao = chao_da_foto(img, nac)
    for x in np.where(m.any(axis=0))[0]:
        if chao[x] < 0:
            continue
        col = np.where(m[:, x])[0]
        m[int(col.min()):chao[x] + 1, x] = True
    return m, 'entre as juntas (%d..%d), pé na foto' % (
        (fim + 1, corte) if nariz_esq else (corte, fim - 1))


def capo_pintavel(aid, img, inteira, cfg, nariz_esq=True, testes=None):
    """De nacela inteira para área pintável, **recortando**, nunca remendando.

    A versão anterior recortava grosso e depois costurava: subtraía a zona do
    lábio, empurrava a borda até o pé. Morfologia em cima de máscara boa produz
    furo quadrado e borda em degrau — foi o que o autor viu na tela, num
    candidato que os testes da época aprovavam.

    Aqui o lábio é ponto negativo e o pé é ponto positivo: a forma sai inteira do
    modelo. Se o juiz reprovar, troca-se a **semente** e recorta-se de novo.
    """
    from conferir import zona_do_labio, julgar

    if por_helice(aid):
        # turboélice: a nacela inteira leva a livery, não há reversor exposto
        return inteira, 'nacela inteira (turboélice)'

    corte, motivo = _alvo_motor(aid, img, inteira, cfg.get('fracao', 0.58), nariz_esq)
    if corte is None:
        return inteira, motivo
    labio = zona_do_labio(img, inteira, nariz_esq)
    p = sam()

    # Titular: **não** pedir ao SAM que ache o capô. Ele para na linha de painel
    # entre o capô de entrada e o do ventilador, porque para o modelo aquilo é
    # borda de objeto — e é justamente o barril branco que fica de fora, o
    # pedaço que a companhia pinta. A peça é o que está entre as duas juntas:
    # a nacela do SAM, cortada nas duas divisas da foto e fechada até o chão
    # que a foto mostra. O SAM diz onde a nacela está; a foto diz onde ela acaba.
    geo, por_que = entre_as_juntas(img, inteira, corte, labio, nariz_esq)
    if geo is not None:
        if testes is None:
            return geo, motivo + '; ' + por_que
        ok, _ = julgar(testes, geo.astype(float))
        if ok:
            return geo, motivo + '; ' + por_que + ' (juiz aprovou)'

    melhor, melhor_rot, melhor_falhas = None, '', 99
    for rot, caixa, pos, neg, junta in sementes_do_capo(img, inteira, corte, labio, nariz_esq):
        pts = np.array(pos + neg, float) if (pos or neg) else None
        rots = np.array([1] * len(pos) + [0] * len(neg)) if (pos or neg) else None
        with torch.inference_mode():
            m, _, _ = p.predict(point_coords=pts, point_labels=rots,
                                box=caixa[None, :], multimask_output=False)
        cand = (m[0] > 0.5) & inteira
        if junta is not None:
            # a junta dianteira, do mesmo jeito que a traseira: linha de painel
            if nariz_esq:
                cand[:, :junta] = False
            else:
                cand[:, junta + 1:] = False
        if not cand.any():
            continue
        if testes is None:
            return cand, motivo + '; semente: ' + rot
        ok, linhas = julgar(testes, cand.astype(float))
        falhas = sum(0 if L[3] else 1 for L in linhas)
        if ok:
            return cand, motivo + '; semente: ' + rot + ' (juiz aprovou)'
        if falhas < melhor_falhas:
            melhor, melhor_rot, melhor_falhas = cand, rot, falhas
    if melhor is None:
        return inteira, motivo + '; nenhuma semente produziu recorte'
    return melhor, motivo + '; semente: %s (%d testes reprovados)' % (melhor_rot, melhor_falhas)


def por_grounded(aid, caminho, nome_peca, trabalho, nariz_esq=True, testes=None):
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
    motivo = 'caixa do texto %.0f%% dentro do avião' % (100 * nota)
    if not cfg.get('recorta_capo'):
        return out, motivo
    # as mesmas regras de pintável do outro caminho: sem isso os dois candidatos
    # da ficha não medem a mesma coisa
    capo, por_que = capo_pintavel(aid, np.array(pil), out, cfg, nariz_esq, testes)
    return capo, motivo + '; ' + por_que
