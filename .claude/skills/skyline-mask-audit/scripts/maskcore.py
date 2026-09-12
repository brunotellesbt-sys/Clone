"""Núcleo de medida das máscaras de setor.

A ideia que sustenta tudo aqui: a foto é a verdade. Fundo sólido e borda nítida
dão duas referências objetivas, sem julgamento:

- a **silhueta** do avião (o que é avião e o que é fundo);
- o **mapa de borda** (onde estão os contornos reais das peças).

Com essas duas, desalinhamento vira número em pixel em vez de opinião.
Serve para qualquer setor: asa, motor, winglet, trem, cauda, fuselagem.
"""

import os

import numpy as np
from PIL import Image
from scipy import ndimage

# Todos os setores, e quem é subconjunto de quem. Bordo de ataque, dorso e
# bordo de fuga são divisões da asa; a cabine fica dentro da fuselagem. Esses
# pares se sobrepõem de propósito e não podem contar como disputa.
SETORES = [
    "fuselagemasks", "wingmasks", "enginemasks", "gearmasks", "tailmasks",
    "wingletmasks", "cockpitmasks",
    "leadingedgemasks", "wingtopmasks", "trailingedgemasks",
]
SUBSETOR_DE = {
    "leadingedgemasks": "wingmasks",
    "wingtopmasks": "wingmasks",
    "trailingedgemasks": "wingmasks",
    "cockpitmasks": "fuselagemasks",
    "windowmasks": "fuselagemasks",
    # A carenagem é a nacela menos o núcleo metálico, e a perna do trem é o
    # trem menos o pneu: em ambos os casos o "pai" é a peça inteira, que fica
    # como referência de medida, e o filho é o que o jogo pinta.
    "enginecowlmasks": "enginemasks",
    "gearstrutmasks": "gearmasks",
    # O pneu é o outro pedaço do trem: `gearmasks` menos a perna. Não é setor de
    # livery (cor fixa na arte, ver pecas_cruas.py), mas é subconjunto declarado
    # para não virar disputa quando alguém medir a pasta.
    "tyremasks": "gearmasks",
}
# Setores gerados por geometria a partir de outro. Não se remendam: quando o
# pai muda, se regeneram com derive_sectors.py.
DERIVADOS = set(SUBSETOR_DE) | {"fuselagemasks"}
# Faixas da asa. Três dos quatro lados de uma faixa são corte artificial (as
# duas divisas de banda e a raiz), então sobra quase nada de borda útil:
# aderência e deslocamento ali medem ruído, e faixa fina é fina por definição.
FAIXAS = {"leadingedgemasks", "wingtopmasks", "trailingedgemasks"}


# Pastas que não são setor rival de ninguém, e por isso não entram em disputa:
# `planemasks` é a silhueta do avião inteiro, superconjunto de todos os setores,
# e `propmasks` é a hélice, que foi **retirada** de asa e motor de propósito.
# Sem esta lista, quem varre `public/sprites/*masks/` conta sobreposição com a
# silhueta como defeito — 38.221px no b737, o setor inteiro.
FORA_DA_DISPUTA = {"planemasks", "propmasks"}


def disputam(a, b):
    """Dois setores disputam pixel, ou um contém o outro de propósito?"""
    if a in FORA_DA_DISPUTA or b in FORA_DA_DISPUTA:
        return False
    return SUBSETOR_DE.get(a) != b and SUBSETOR_DE.get(b) != a


LIMIAR_FUNDO = 24  # distância de cor até o fundo para valer como avião
LIMIAR_BORDA = 0.10  # gradiente normalizado que conta como contorno real
TOLERANCIA = 1.5  # px: quanto a borda da máscara pode ficar longe do contorno


def carregar_mask(path):
    return np.array(Image.open(path).convert("L")) > 127


def salvar_mask(mask, path, feather=1.3):
    """Grava com a mesma suavização de borda de todas as máscaras do projeto."""
    dentro = ndimage.distance_transform_edt(mask)
    fora = ndimage.distance_transform_edt(~mask)
    alpha = np.where(
        mask,
        np.minimum(255, 128 + dentro * (127 / feather)),
        np.maximum(0, 128 - fora * (127 / feather)),
    )
    Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8), mode="L").save(path)


def achar_foto(dir_fotos, aid):
    for nome in sorted(os.listdir(dir_fotos)):
        base = nome.rsplit(".", 1)[0]
        if base == aid or base.startswith(aid + "__"):
            return os.path.join(dir_fotos, nome)
    return None


LIMIAR_NITIDO = 0.12  # gradiente que só borda de avião alcança


def silhueta(photo_path, limiar=LIMIAR_FUNDO):
    """O que é avião na foto — sem a sombra no chão.

    O fundo é sólido e os cantos são fundo puro, então a distância de cor até a
    média dos cantos separa avião de fundo. O avião é branco em fundo branco: o
    que salva é o sombreado, nunca a cor da chapa. Por isso o limiar é baixo.

    Limiar de cor sozinho não serve, porque a sombra no chão chega a ficar mais
    escura que a ponta da asa (245 contra 108 de distância no a320). O que
    separa é a nitidez: borda de avião marca gradiente de 0,16 a 0,93, borda de
    sombra fica em 0,05. Então, coluna a coluna, o avião acaba na última borda
    nítida — o que estiver abaixo disso é chão.
    """
    arr = np.array(Image.open(photo_path).convert("RGB")).astype(np.int32)
    h, w, _ = arr.shape
    cantos = [arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]]
    fundo = np.mean(cantos, axis=0)
    dist = np.abs(arr - fundo).sum(axis=2)
    corpo = dist > limiar

    nitido = (mapa_de_borda(photo_path) > LIMIAR_NITIDO) & corpo
    linhas = np.arange(h)[:, None]
    tem_nitido = nitido.any(axis=0)
    ultima = np.where(nitido, linhas, -1).max(axis=0)  # por coluna
    abaixo = linhas > (ultima + 2)
    corpo &= ~(abaixo & tem_nitido[None, :])

    corpo = ndimage.binary_closing(corpo, iterations=2)
    corpo = ndimage.binary_fill_holes(corpo)
    rot, n = ndimage.label(corpo)
    if n > 1:
        tam = ndimage.sum(corpo, rot, range(1, n + 1))
        corpo = rot == (int(np.argmax(tam)) + 1)
    return corpo


def mapa_de_borda(photo_path):
    """Força do contorno em cada pixel, de 0 a 1.

    Inclui a borda contra o fundo e as bordas internas — junção de nacela, raiz
    da asa, quebra do winglet. É contra isso que se mede alinhamento.
    """
    cinza = np.array(Image.open(photo_path).convert("L")).astype(np.float64)
    gx = ndimage.sobel(cinza, axis=1)
    gy = ndimage.sobel(cinza, axis=0)
    g = np.hypot(gx, gy)
    return g / (g.max() or 1.0)


def contorno(mask):
    """Pixels de borda da máscara (a casca de dentro, 1px)."""
    return mask & ~ndimage.binary_erosion(mask)


RAIO_UTIL = 4.0  # px: até onde a borda ainda está "rastreando" um contorno


def borda_util(mask, dist):
    """A parte da borda que persegue um contorno real da foto.

    Nem toda borda de setor deveria coincidir com contorno: onde o trem encosta
    na fuselagem, ou onde a asa foi cortada contra o motor, o limite é um corte
    reto atravessando chapa lisa — não existe contorno ali e nunca vai existir.
    Cobrar aderência desses trechos é inventar defeito.

    Confirmado no an148: a borda de cima do trem corre 8,6px longe de qualquer
    contorno, em vermelho no laudo, e está certa — é a divisa com a fuselagem.
    """
    return contorno(mask) & (dist <= RAIO_UTIL)


def aderencia(mask, borda_forte, tolerancia=TOLERANCIA):
    """Fração da borda útil que cai em cima do contorno real."""
    dist = ndimage.distance_transform_edt(~borda_forte)
    u = borda_util(mask, dist)
    if not u.any():
        return 0.0, 0
    return float((dist[u] <= tolerancia).mean()), int(u.sum())


def melhor_deslocamento(mask, borda_forte, raio=6):
    """Deslocamento inteiro que melhor encaixa a máscara nos contornos.

    Mede só na borda útil e minimiza a **distância média** até o contorno, não a
    fração dentro da tolerância: distância média é contínua e enxerga melhora de
    fração de pixel, que é o desalinhamento fino que se quer pegar.

    Devolve (dx, dy, desvio_antes, desvio_depois), em pixel.
    """
    dist = ndimage.distance_transform_edt(~borda_forte)
    u = borda_util(mask, dist)
    ys, xs = np.where(u)
    if len(ys) < 30:  # borda útil curta demais: não dá para estimar deslocamento
        return 0, 0, 0.0, 0.0
    h, w = mask.shape

    def desvio(dy, dx):
        yy = np.clip(ys + dy, 0, h - 1)
        xx = np.clip(xs + dx, 0, w - 1)
        return float(dist[yy, xx].mean())

    def distancias(dy, dx):
        yy = np.clip(ys + dy, 0, h - 1)
        xx = np.clip(xs + dx, 0, w - 1)
        return dist[yy, xx]

    d0 = distancias(0, 0)
    base = float(d0.mean())
    melhor = (0, 0, base)
    for dy in range(-raio, raio + 1):
        for dx in range(-raio, raio + 1):
            if (dy, dx) == (0, 0):
                continue
            d = distancias(dy, dx)
            # A média sozinha se deixa enganar: perto do trem de pouso há bordas
            # paralelas (pneu, tampa, calço) e um deslocamento pode encaixar
            # numa borda vizinha errada, melhorando a média enquanto piora a
            # maioria dos pontos. Confirmado no an148, onde deslocar 2px para
            # baixo tirou o contorno de cima do pneu. Por isso o deslocamento só
            # vale se a maior parte da borda útil melhorar junto.
            if float((d < d0).mean()) < 0.60:
                continue
            m = float(d.mean())
            if m < melhor[2]:
                melhor = (dy, dx, m)
    return melhor[1], melhor[0], base, melhor[2]


def fora_da_silhueta(mask, sil, folga=2):
    """Pixels da máscara que caem no fundo. Erro objetivo, sem discussão.

    A folga de 2px existe porque a borda real é anti-serrilhada: no pneu tocando
    o chão, a silhueta corta no último contorno nítido e os 1-2px de transição
    ficariam de fora. Sem a folga, todo trem de pouso do catálogo aparecia
    sangrando ~100px, o que era viés da medida, não defeito da máscara.
    Sangramento de verdade — máscara indo para o fundo — é de dezenas de px e
    continua sendo pego.
    """
    return int((mask & ~ndimage.binary_dilation(sil, iterations=folga)).sum())


def desloca(mask, dx, dy):
    return ndimage.shift(mask.astype(np.uint8), (dy, dx), order=0, mode="constant").astype(bool)


def borda_forte(photo_path, limiar=LIMIAR_BORDA):
    return mapa_de_borda(photo_path) > limiar


def mapa_desvio(mask, forte):
    """Distância de cada pixel da borda da máscara até o contorno real mais perto.

    É o que vira mapa de calor: é assim que erro de 2px, invisível numa imagem
    de 1536x1024, fica berrante.
    """
    dist = ndimage.distance_transform_edt(~forte)
    c = contorno(mask)
    desvio = np.zeros(mask.shape, dtype=np.float32)
    desvio[c] = dist[c]
    return desvio, c


def medir(mask, sil, forte, vizinhos=None, raio=6):
    """Medida completa de um setor. Auditoria e correção usam esta mesma função.

    É o que torna a correção automática segura: um conserto só entra se estes
    números melhorarem.
    """
    vizinhos = vizinhos or {}
    px = int(mask.sum())
    if px == 0:
        return {"px": 0, "fora": 0, "ader": 0.0, "desvio": 0.0, "dx": 0, "dy": 0,
                "ganho": 0.0, "solta": 0.0, "sobrepoe": {}}

    dist = ndimage.distance_transform_edt(~forte)
    c = contorno(mask)
    u = borda_util(mask, dist)
    ader = float((dist[u] <= TOLERANCIA).mean()) if u.any() else 0.0
    dx, dy, antes, depois = melhor_deslocamento(mask, forte, raio=raio)

    return {
        "px": px,
        "fora": fora_da_silhueta(mask, sil),
        "ader": ader,
        "desvio": float(dist[u].mean()) if u.any() else 0.0,
        "dx": dx,
        "dy": dy,
        # ganho em pixel: quanto a borda útil se aproxima do contorno com o
        # deslocamento. Positivo é melhora.
        "ganho": antes - depois,
        # quanto da borda não persegue contorno nenhum. Informativo: setor muito
        # subtraído tem bastante corte reto e isso não é defeito.
        "solta": float(1 - u.sum() / max(int(c.sum()), 1)),
        "sobrepoe": {n: int((mask & v).sum()) for n, v in vizinhos.items() if v is not None},
    }


def melhor_que(novo, velho):
    """Um conserto vale se não sangra mais, não disputa mais e cola melhor.

    É esta função que deixa a correção automática segura: nada entra sem
    melhorar a medida, e o que piora é revertido.
    """
    # Sangramento não tem folga: a silhueta é o limite físico do avião, e o
    # conserto que empurra a máscara para fora dele está errado por construção,
    # por melhor que fique a aderência. Foi assim que o an148 passou batido.
    if novo["fora"] > velho["fora"]:
        return False
    if sum(novo["sobrepoe"].values()) > sum(velho["sobrepoe"].values()) + 5:
        return False
    if novo["desvio"] > velho["desvio"] + 0.02:
        return False
    return (
        novo["desvio"] < velho["desvio"] - 0.05
        or novo["ader"] > velho["ader"] + 0.005
        or novo["fora"] < velho["fora"] - 5
    )
