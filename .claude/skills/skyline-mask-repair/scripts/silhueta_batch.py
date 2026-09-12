"""Recorta a silhueta do avião inteiro, uma por sprite, para o jogo pintar.

Por que isto existe: até aqui o recorte da pintura era feito **no navegador**,
em `measure.ts`, comparando cada pixel com a cor do fundo e chamando de avião
tudo que estivesse a mais de 60 (soma dos três canais) do branco. Só que o
sprite é um avião **branco em fundo branco**: a chapa iluminada do dorso da
fuselagem, o meio da nacela e o dorso da asa passam de 245 de luminância e não
alcançam esse limiar. Medido no b737: 164.743px reconhecidos contra 241.166px
de avião de verdade — **32% do avião ficava fora da máscara**, sem receber
tinta e deixando o fundo da página aparecer. É a "mancha preta no meio do
motor", e a faixa desfocada na fuselagem é a rampa de transição do mesmo
teste, de 40 níveis, atravessando chapa clara.

Limiar de cor não é o caminho para essa medida; inundação a partir da borda é.
O fundo é uma região conectada que encosta na moldura da imagem — o que estiver
cercado pelo contorno do avião é avião, por mais branco que seja. É o que
`maskcore.silhueta()` já faz para todas as máscaras de setor, com o corte de
sombra no chão por nitidez de borda. Medido nos 89 sprites com essa regra:
0,03% de avião faltando, contra 27,9% da inundação no limiar antigo.

Gerar a máscara aqui, e não no navegador, mantém a regra do projeto — máscara
é arquivo conferido, não chute em tempo de execução — e garante que a pintura
caia exatamente sobre a mesma silhueta de que saíram os setores.

    python3 silhueta_batch.py --out /tmp/plane
    python3 silhueta_batch.py --out public/sprites/planemasks --only b737,a320
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

FOTOS = ["public/sprites/aircraft", "public/sprites/freighters"]
RAIZ = "public/sprites"

BANDA_CHAO = 0.08  # fração de baixo da caixa onde só existe trem de pouso
ALTURA_REAL = 41   # px: estrutura de avião nessa faixa é alta; sombra é laje
CHATURA = 4.0      # largura/altura a partir da qual a peça é laje, não peça
LAJE_MIN = 60      # px de largura: abaixo disso ainda pode ser pneu


def protegido(aid):
    """União das máscaras de setor do modelo, com folga.

    É a prova objetiva de que aquele pixel é avião: alguma peça já o reivindica.
    Serve de escudo na limpeza do chão — sem ele a laje de sombra sai junto com
    a base do pneu, que encosta nela.
    """
    escudo = None
    for pasta in sorted(os.listdir(RAIZ)):
        caminho = os.path.join(RAIZ, pasta, aid + ".png")
        if not pasta.endswith("masks") or not os.path.exists(caminho):
            continue
        m = mc.carregar_mask(caminho)
        escudo = m if escudo is None else (escudo | m)
    if escudo is None:
        return None
    return ndimage.binary_dilation(escudo, iterations=6)


def faixa_do_chao(corpo):
    """A faixa de baixo da caixa do avião, onde só existe trem de pouso."""
    ys = np.where(corpo.any(axis=1))[0]
    if len(ys) == 0:
        return None
    y0, y1 = ys.min(), ys.max()
    banda = np.zeros_like(corpo)
    banda[int(y1 - BANDA_CHAO * (y1 - y0)):, :] = True
    return banda


def sem_sombra(corpo, aid):
    """Tira a sombra projetada no chão, que é pintável hoje e não devia ser.

    A sombra de contato destes sprites tem borda dura — a regra de nitidez do
    `maskcore` não a pega — mas ela é sempre uma **laje**: larga, baixa e rasa.
    Estrutura de avião naquela altura é pneu e perna, alta na vertical. Duas
    medidas dão conta, e as duas são necessárias:

    - o que não sobrevive a uma abertura vertical de 41px na faixa de baixo, e
      que nenhum setor reivindica, é chão (pega a laje solta sob o trem do
      nariz);
    - o que, na mesma faixa, forma uma peça **mais larga que alta** — quatro
      vezes ou mais — é chão (pega a laje que encosta no pneu e por isso passa
      pela primeira, e a barra fina que o a388 projeta por meia imagem).

    A segunda medida foi conferida peça a peça nas 100: só sai laje, nenhuma
    roda encolhe.
    """
    banda = faixa_do_chao(corpo)
    if banda is None:
        return corpo

    alto = ndimage.binary_opening(corpo, structure=np.ones((ALTURA_REAL, 1)))
    escudo = protegido(aid)
    sombra = banda & ~alto
    if escudo is not None:
        sombra &= ~escudo
    corpo = corpo & ~sombra

    banda = faixa_do_chao(corpo)
    rotulos, _ = ndimage.label(corpo & banda)
    for k, caixa in enumerate(ndimage.find_objects(rotulos), 1):
        altura = caixa[0].stop - caixa[0].start
        largura = caixa[1].stop - caixa[1].start
        if largura >= LAJE_MIN and largura >= CHATURA * altura:
            corpo = corpo & ~(rotulos == k)
    return corpo


def silhueta_cheia(caminho, aid):
    """Silhueta de `maskcore`, fechada, crescida 1px e sem a sombra no chão.

    O 1px a mais é de propósito: a borda do sprite é antisserrilhada, então o
    último pixel do avião já vem misturado com o fundo e a medida o descarta.
    Sem a folga, sobra um fio de fundo entre a pintura e o contorno — visível
    como halo escuro em tela clara.
    """
    corpo = mc.silhueta(caminho)
    corpo = ndimage.binary_dilation(corpo, iterations=1)
    corpo = ndimage.binary_fill_holes(corpo)
    return sem_sombra(corpo, aid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="lista de sprites (sem .png), separada por vírgula")
    args = ap.parse_args()

    alvo = set(args.only.split(",")) if args.only else None
    os.makedirs(args.out, exist_ok=True)

    for pasta in FOTOS:
        if not os.path.isdir(pasta):
            continue
        for nome in sorted(os.listdir(pasta)):
            if not nome.endswith(".png"):
                continue
            base = nome[:-4]
            if alvo and base not in alvo:
                continue
            caminho = os.path.join(pasta, nome)
            corpo = silhueta_cheia(caminho, base.split("__")[0])
            destino = os.path.join(args.out, nome)
            mc.salvar_mask(corpo, destino)
            arr = np.array(Image.open(caminho).convert("RGB")).astype(np.int32)
            h, w, _ = arr.shape
            fundo = np.mean([arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]], axis=0)
            velho = (np.abs(arr - fundo).sum(axis=2) >= 60)  # a regra do measure.ts
            ganho = (corpo.sum() - (velho & corpo).sum()) / max(1, corpo.sum())
            print("%-30s %7d px  recuperado %5.1f%%" % (base, int(corpo.sum()), 100 * ganho))


if __name__ == "__main__":
    main()
