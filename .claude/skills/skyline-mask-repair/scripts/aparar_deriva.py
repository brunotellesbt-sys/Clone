"""Fecha a deriva até o contorno e alisa a raiz dela.

Dois defeitos da máscara de deriva que o `diagnose.py` não acusa e que a tela
mostra na hora, porque a deriva costuma ser a peça mais colorida da livery:

- **Falta um fio de 1 a 3px no bordo de ataque e na ponta.** O recorte para um
  pouco antes do contorno, e como a fuselagem é pintada por baixo, o que aparece
  é um risco de cor de fuselagem contornando a deriva — o mesmo sintoma do sulco
  entre vizinhos, em outro lugar. São 300 a 1.400px por modelo.
- **A raiz é serrilhada.** Ali não existe contorno nenhum (deriva e cone de
  cauda são a mesma chapa na vista lateral), então o recorte oscila alguns
  pixels para cima e para baixo e a divisa de cor sai mordida.

A correção é a mesma para os dois, e sai da geometria da peça: **acima da raiz
da deriva, tudo é deriva**. Para cada coluna, pega-se o pixel mais baixo da
máscara, alisa-se essa linha de raiz com filtro de mediana (21px — o serrilhado
tem poucos pixels de período, a inclinação da raiz é bem mais longa que isso) e
preenche-se da linha para cima com o que for avião.

O que sobra fora da peça conectada à deriva original é descartado, então
nenhuma antena ou respiro solto no dorso entra junto.

    python3 aparar_deriva.py --dry-run
    python3 aparar_deriva.py --write

Depois de escrever, o resto da cadeia é a de sempre:

    python3 costurar.py --write
    python3 derive_sectors.py --all --what fuselage
"""

import argparse
import os
import sys

import numpy as np
from scipy import ndimage

AUDIT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "skyline-mask-audit", "scripts")
sys.path.insert(0, AUDIT)
import maskcore as mc  # noqa: E402

R = "public/sprites"
JANELA = 21        # px: largura da mediana que alisa a linha de raiz
MIN_ENCOSTO = 0.02  # fração da peça que precisa tocar a deriva original


def fechar(fin, plano):
    """A deriva até o contorno, com a raiz alisada."""
    altura, largura = fin.shape
    raiz = np.full(largura, -1)
    for x in range(largura):
        coluna = np.where(fin[:, x])[0]
        if len(coluna):
            raiz[x] = coluna.max()

    colunas = np.where(raiz >= 0)[0]
    if len(colunas) == 0:
        return fin
    suave = ndimage.median_filter(raiz[colunas].astype(float), size=JANELA, mode="nearest")

    nova = np.zeros_like(fin)
    for x, limite in zip(colunas, suave):
        nova[:int(limite) + 1, x] = plano[:int(limite) + 1, x]

    # Só o que encosta na deriva original: antena e respiro soltos no dorso
    # ficam de fora.
    rotulos, n = ndimage.label(nova)
    fica = np.zeros_like(nova)
    for k in range(1, n + 1):
        peca = rotulos == k
        if (peca & fin).sum() > MIN_ENCOSTO * peca.sum():
            fica |= peca
    return fica


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--only", help="lista de modelos separada por vírgula")
    args = ap.parse_args()

    alvo = set(args.only.split(",")) if args.only else None
    ganho = perda = 0
    for nome in sorted(os.listdir(os.path.join(R, "tailmasks"))):
        if not nome.endswith(".png"):
            continue
        aid = nome[:-4]
        if alvo and aid not in alvo:
            continue
        foto = mc.achar_foto(os.path.join(R, "aircraft"), aid)
        if not foto:
            continue
        plano = mc.carregar_mask(os.path.join(R, "planemasks", os.path.basename(foto)))
        fin = mc.carregar_mask(os.path.join(R, "tailmasks", nome))
        nova = fechar(fin, plano)
        mais = int((nova & ~fin).sum())
        menos = int((fin & ~nova).sum())
        ganho += mais
        perda += menos
        print("%-10s +%5d  -%4d px" % (aid, mais, menos))
        if args.write:
            mc.salvar_mask(nova, os.path.join(R, "tailmasks", nome))
    print("total: +%d  -%d px" % (ganho, perda))


if __name__ == "__main__":
    main()
