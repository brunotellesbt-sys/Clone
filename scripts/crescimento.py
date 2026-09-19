#!/usr/bin/env python3
"""Levanta o crescimento de cada pais e grava em `src/game/data/crescimento.ts`.

O jogo fazia o mundo inteiro crescer na mesma taxa — `1 + dia * 0.00012`, um
numero so para 233 paises. Nessa conta Tokyo e Lagos crescem igual, e o mapa de
2050 e o de 2027 com todo mundo 10% maior. Nao e simulacao de mundo, e um
multiplicador.

## O que entra

Duas series publicas do Banco Mundial, por pais, media dos ultimos anos com
dado:

- `SP.POP.GROW` — crescimento populacional anual, em %;
- `NY.GDP.PCAP.KD.ZG` — crescimento do PIB per capita real, em %.

Transporte aereo nao cresce na taxa do PIB: cresce mais, porque passagem e bem
superior — quem enriquece voa mais do que proporcionalmente. A elasticidade que
ICAO e IATA usam fica entre 1,3 e 2,0, maior nos mercados emergentes. Aqui e
1,4 sobre o PIB per capita, um valor unico e conservador: elasticidade por faixa
de renda daria mais realismo e mais um parametro para alguem manter, e o efeito
grande — pais rico estagnado contra pais pobre crescendo rapido — ja aparece
com um numero so.

    crescimento anual do trafego = populacao + 1,4 x PIB per capita

## O que NAO entra

Projecao propria. Este script le o que aconteceu e o jogo o projeta para a
frente; ninguem aqui esta adivinhando 2050. Isso tem um limite honesto, e o
comentario no `crescimento.ts` o declara: pais que acabou de sair de uma crise
carrega a recuperacao como se fosse tendencia.

Sem argumento, so relata. Com `--gravar`, reescreve o arquivo.
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / 'src/game/data/airports.ts'
DESTINO = RAIZ / 'src/game/data/crescimento.ts'

# Janela de leitura. Comeca em 2015 para pegar mais de uma fase do ciclo e
# terminar com peso do que e recente; anos sem dado simplesmente nao contam.
DE, ATE = 2015, 2024

# Quanto o trafego aereo responde ao PIB per capita. Ver o cabecalho.
ELASTICIDADE = 1.4

# Onde a media anual e comprimida. Um pais nao cresce 9% ao ano por trinta anos,
# e nenhum encolhe 4% ao ano por trinta — os extremos da janela sao episodio
# (guerra, boom de petroleo), nao tendencia, e projetar episodio por decadas e
# o que faz simulacao virar ficcao cientifica.
PISO, TETO = -1.5, 5.5

# Ate onde a compressao nao toca em nada. Ver `comprimir`.
JOELHO = 0.7


def comprimir(x, piso, teto):
    """Segura o valor entre piso e teto sem achatar a ordem.

    Um `min`/`max` e parede: com corte duro em 5,5, China, Bangladesh, Chipre e
    a Republica Dominicana saiam todos com exatamente 5,50 — o teto cumpria o
    objetivo e destruia a ordem entre eles, que e o que o jogo le. Aqui a
    ultima faixa e assintota: ate 70% do caminho a funcao e a identidade, e
    dali em diante ela se aproxima do limite sem nunca encostar. A derivada
    vale 1 nos dois lados do joelho, entao nao ha degrau na emenda.
    """
    import math
    if x > 0:
        joelho = JOELHO * teto
        if x <= joelho:
            return x
        return teto - (teto - joelho) * math.exp(-(x - joelho) / (teto - joelho))
    joelho = JOELHO * piso
    if x >= joelho:
        return x
    return piso - (piso - joelho) * math.exp(-(x - joelho) / (piso - joelho))


def tendencia(v):
    """A media da janela sem o melhor e o pior ano.

    A janela 2015-2024 tem a pandemia dentro, e ela entra duas vezes: o tombo de
    2020 e a retomada de 2021, medida sobre a base ja afundada. Nenhum dos dois
    e tendencia.

    Mediana nao resolve — foi a primeira tentativa e ela erra para o outro lado.
    Com dez anos, a mediana descarta o tombo (que fica na cauda de baixo) e
    mantem um ano de retomada no meio da ordenacao, de modo que a media mundial
    SUBIU de 2,81% para 3,26% em vez de cair. Aparar as duas pontas tira um
    episodio de cada lado, que e exatamente o que se quer remover.
    """
    if not v:
        return 0.0
    s = sorted(v)
    if len(s) >= 5:
        s = s[1:-1]
    return sum(s) / len(s)


def wb(indicador):
    """Uma serie do Banco Mundial, do mundo inteiro, na janela.

    Pede `all` e filtra aqui em vez de listar as siglas do catalogo. Nao e
    preguica: uma sigla que a API nao conhece — e o catalogo tem varias, de
    territorio ultramarino a Kosovo — faz a requisicao inteira voltar 403, e o
    lote todo se perde por causa de uma. Pedir tudo nao tem como dar errado por
    causa de um nome.
    """
    out = {}
    pagina = 1
    while True:
        url = (f'https://api.worldbank.org/v2/country/all/indicator/{indicador}'
               f'?format=json&date={DE}:{ATE}&per_page=1000&page={pagina}')
        # Sem User-Agent a API devolve 403 — o padrao do urllib e bloqueado.
        req = urllib.request.Request(url, headers={'User-Agent': 'skyline-tycoon-data/1.0'})
        with urllib.request.urlopen(req, timeout=180) as r:
            d = json.load(r)
        if len(d) < 2 or not d[1]:
            break
        for reg in d[1]:
            v = reg.get('value')
            if v is None:
                continue
            out.setdefault(reg['country']['id'], []).append(float(v))
        if pagina >= d[0]['pages']:
            break
        pagina += 1
    return out


def catalogo():
    """Os codigos de pais que o jogo usa, e o nome de cada um."""
    texto = CATALOGO.read_text(encoding='utf-8')
    paises = {}
    for linha in texto.split('\n'):
        p = linha.split('|')
        if len(p) >= 12 and re.fullmatch(r'[A-Z]{3}', p[0]):
            paises[p[3]] = p[2]
    return paises


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gravar', action='store_true')
    args = ap.parse_args()

    paises = catalogo()
    codigos = sorted(paises)
    print(f'{len(codigos)} paises no catalogo', file=sys.stderr)

    pop = wb('SP.POP.GROW')
    pib = wb('NY.GDP.PCAP.KD.ZG')
    print(f'{len(pop)} com populacao, {len(pib)} com PIB', file=sys.stderr)

    taxas, faltando = {}, []
    for cc in codigos:
        p = pop.get(cc)
        g = pib.get(cc)
        if not p and not g:
            faltando.append(cc)
            continue
        mp = tendencia(p)
        mg = tendencia(g)
        taxas[cc] = comprimir(mp + ELASTICIDADE * mg, PISO, TETO)

    ordenado = sorted(taxas.items(), key=lambda kv: -kv[1])
    print(f'\n{len(taxas)} paises com taxa; {len(faltando)} sem dado nenhum\n')
    print('  mais rapidos:')
    for cc, v in ordenado[:8]:
        print(f'    {cc} {paises[cc]:<22} {v:+.2f}%/ano')
    print('  mais lentos:')
    for cc, v in ordenado[-8:]:
        print(f'    {cc} {paises[cc]:<22} {v:+.2f}%/ano')
    media = sum(taxas.values()) / len(taxas)
    print(f'\n  media {media:+.2f}%/ano')

    if not args.gravar:
        print('\n(so relato; use --gravar para escrever)')
        return 0

    # duas casas bastam: a diferenca entre 2,31 e 2,314 ao ano some no ruido do
    # proprio modelo, e o arquivo fica legivel
    linhas, linha = [], ''
    for cc, v in sorted(taxas.items()):
        pedaco = f'{cc}:{v:.2f} '
        if len(linha) + len(pedaco) > 76:
            linhas.append(linha.rstrip())
            linha = ''
        linha += pedaco
    linhas.append(linha.rstrip())
    tabela = '\n'.join(linhas)

    fonte = DESTINO.read_text(encoding='utf-8')
    ABRE = 'const RAW = `'
    ini = fonte.find(ABRE)
    fim = fonte.find('`', ini + len(ABRE))
    if ini < 0 or fim < 0:
        print(f'nao achei a tabela em {DESTINO.name}', file=sys.stderr)
        return 1
    DESTINO.write_text(fonte[:ini + len(ABRE)] + '\n' + tabela + '\n' + fonte[fim:],
                       encoding='utf-8')
    print(f'\n{len(taxas)} taxas gravadas em {DESTINO.name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
