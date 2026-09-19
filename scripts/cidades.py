#!/usr/bin/env python3
"""Confere — e corrige — a cidade de cada aeroporto contra a OurAirports.

O campo `city` do catálogo é o que o jogador lê no mapa, na busca de base e na
abertura de rota. Ele nasceu de um cruzamento que às vezes pegou a cidade
grande da região em vez do município do aeroporto: SOD, que fica em Sorocaba,
estava como Campinas, e SJK, de São José dos Campos, estava como São Paulo.

Separar erro de rótulo legítimo não dá para fazer só por nome, e é por isso que
este script existe em vez de uma lista corrigida à mão:

- **Exônimo em português é certo.** Londres, Pequim, Toquio e Cidade do México
  não são erro — o jogo é em português. O teste que os reconhece não é o nome,
  é o **lugar**: se o aeroporto está no mesmo município do maior aeroporto que
  carrega aquele rótulo, os dois nomeiam a mesma cidade.
- **Rótulo de metrópole é certo até certa distância.** Newark é Nova York para
  quem compra passagem, e Congonhas é São Paulo. O corte é 50 km do aeroporto
  principal daquele rótulo: acima disso não é mais subúrbio, é outra cidade.
- **Homônimo não é erro.** Portland do Maine e Portland do Oregon dividem o
  nome e ficam a 4.000 km. O aeroporto cujo rótulo já é o próprio município
  dele nunca é tocado.

Sem argumento, só relata. Com `--gravar`, reescreve `src/game/data/airports.ts`.
O catálogo é ASCII sem acento, e a conversão respeita isso.
"""
import argparse
import csv
import io
import math
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

FONTE = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
CATALOGO = Path(__file__).resolve().parent.parent / 'src/game/data/airports.ts'
MOVIMENTO = Path(__file__).resolve().parent.parent / 'src/game/data/movimento.ts'

# Acima disto o aeroporto não é mais subúrbio do rótulo que carrega, é outra
# cidade. Cinquenta quilômetros cobrem Newark (30 km de JFK) e Congonhas, e
# deixam de fora Sorocaba (64 km de Campinas) e São José dos Campos (66 km).
LIMITE_KM = 50


def sem_acento(s: str) -> str:
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()


def chave(s: str) -> str:
    """Nome comparável: sem acento, sem parêntese, sem pontuação."""
    s = sem_acento(s or '').lower()
    s = re.sub(r'\(.*?\)', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def km(a, b) -> float:
    r = 6371.0
    dlat = math.radians(b['lat'] - a['lat'])
    dlon = math.radians(b['lon'] - a['lon'])
    h = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(a['lat'])) * math.cos(math.radians(b['lat'])) * math.sin(dlon / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def limpar(municipio: str) -> str:
    """O município como o catálogo o escreve: ASCII, sem sufixo de região."""
    nome = re.sub(r'\s*\(.*?\)\s*', ' ', municipio).strip()
    # "Nottingham, Leicestershire" e "Pendik, Istanbul" — o primeiro é a cidade
    nome = nome.split(',')[0].strip()
    # "Montpellier/Méditerranée" e "Sarasota/Bradenton" — idem
    nome = nome.split('/')[0].strip()
    nome = sem_acento(nome)
    # A fonte capitaliza tudo ("Sao Jose Dos Campos"); em português a partícula
    # é minúscula, e é assim que o resto do catálogo escreve.
    particulas = {'Dos', 'Das', 'De', 'Do', 'Da', 'E', 'Del', 'La', 'Los', 'Y'}
    palavras = nome.split()
    return ' '.join(w.lower() if i and w in particulas else w for i, w in enumerate(palavras))


def carregar_catalogo():
    texto = CATALOGO.read_text(encoding='utf-8')
    bruto = texto.split('const RAW = `', 1)[1].split('`', 1)[0]
    linhas = []
    for linha in bruto.strip().split('\n'):
        p = linha.split('|')
        if len(p) < 12:
            continue
        linhas.append({
            'iata': p[0], 'city': p[1], 'cc': p[3],
            'lat': float(p[4]), 'lon': float(p[5]), 'tier': int(p[10]),
            'campos': p,
        })
    return texto, linhas


def carregar_movimento():
    """Passageiros por ano de cada aeroporto, em milhares.

    Serve para desempatar a âncora de um rótulo: entre dois aeroportos do mesmo
    degrau, quem define de que cidade o rótulo fala é o que move mais gente.
    Sem isto o desempate saía por ordem alfabética, e Narita passava a ser a
    âncora de "Toquio" à frente de Haneda — que fica em Tóquio.
    """
    try:
        texto = MOVIMENTO.read_text(encoding='utf-8')
    except OSError:
        return {}
    return {m.group(1): float(m.group(2))
            for m in re.finditer(r'(\w{3}):\s*([\d.]+)', texto)}


def carregar_fonte():
    with urllib.request.urlopen(FONTE, timeout=120) as r:
        dados = r.read().decode('utf-8')
    fonte = {}
    for reg in csv.DictReader(io.StringIO(dados)):
        i = reg['iata_code'].strip()
        if i:
            fonte[i] = reg
    return fonte


def auditar(linhas, fonte, movimento):
    """Devolve as correções: (iata, cidade atual, cidade certa, km, motivo)."""
    por_rotulo = {}
    for a in linhas:
        if a['iata'] in fonte:
            por_rotulo.setdefault((chave(a['city']), a['cc']), []).append(a)

    correcoes = []
    for lista in por_rotulo.values():
        # A âncora é o maior aeroporto que carrega o rótulo: é ele que define
        # de que lugar o rótulo está falando.
        ancora = max(lista, key=lambda a: (a['tier'], movimento.get(a['iata'], 0), a['iata']))
        mun_ancora = chave(fonte[ancora['iata']]['municipality'])
        for a in lista:
            if a is ancora:
                continue
            mun = fonte[a['iata']]['municipality'].strip()
            if not mun:
                continue
            k = chave(mun)
            rot = chave(a['city'])
            # homônimo: o rótulo já é o município deste aeroporto
            if k == rot or k.startswith(rot) or rot.startswith(k):
                continue
            # mesma cidade da âncora, escrita em outra língua (Pequim/Beijing)
            if mun_ancora and (k == mun_ancora or mun_ancora in k or k in mun_ancora):
                continue
            d = km(a, ancora)
            if d <= LIMITE_KM:
                continue
            certa = limpar(mun)
            if not certa or chave(certa) == rot:
                continue
            correcoes.append((a['iata'], a['city'], certa, d, f"{ancora['iata']} fica a {d:.0f} km"))
    correcoes.sort(key=lambda c: c[0])
    return correcoes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gravar', action='store_true', help='reescreve o catálogo')
    args = ap.parse_args()

    texto, linhas = carregar_catalogo()
    fonte = carregar_fonte()
    correcoes = auditar(linhas, fonte, carregar_movimento())

    print(f'{len(linhas)} aeroportos no catálogo, {len(fonte)} com IATA na fonte')
    print(f'{len(correcoes)} com cidade de outro lugar a mais de {LIMITE_KM} km\n')
    for iata, antes, depois, d, porque in correcoes:
        print(f'  {iata}  {antes:<22} → {depois:<26} ({porque})')

    if not args.gravar:
        print('\n(só relato; use --gravar para corrigir)')
        return 0

    trocas = {c[0]: c[2] for c in correcoes}
    novo = []
    for linha in texto.split('\n'):
        p = linha.split('|')
        if len(p) >= 12 and p[0] in trocas:
            p[1] = trocas[p[0]]
            linha = '|'.join(p)
        novo.append(linha)
    CATALOGO.write_text('\n'.join(novo), encoding='utf-8')
    print(f'\n{len(trocas)} cidades corrigidas em {CATALOGO.name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
