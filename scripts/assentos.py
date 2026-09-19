#!/usr/bin/env python3
"""Levanta a capacidade publicada de cada aeronave e confere contra o catalogo.

`maxSeats` virou o numero mais importante do catalogo quando a cabine passou a
ser derivada dele (ver `cabinLength` em `src/game/cabin.ts`): ele deixou de ser
detalhe de ficha e passou a definir quanto espaco o aviao tem. Um valor copiado
da variante errada vira um aviao com a cabine de outro — foi o que aconteceu com
o A340-600, que carregava os 440 do -300 sendo 11,7 m mais comprido.

Aquele erro apareceu por acidente. Este script existe para os outros 67 nao
dependerem de acidente.

## O que ele le

As tabelas de especificacao da Wikipedia em ingles, por familia de aeroneve. Sao
duas grandezas diferentes e o script separa as duas, porque confundi-las e o
erro classico:

- **capacidade tipica** — o que o fabricante publica como configuracao de duas
  classes. E o numero que aparece em "Passenger capacity" ou "2-class seats";
- **limite de saidas** — o maximo certificado, em classe unica no passo minimo.
  Aparece como "maximum", "exit limit" ou "1-class".

O catalogo guarda o **limite de saidas** em `maxSeats`, e e contra ele que a
comparacao e feita. Onde a Wikipedia so publica a capacidade tipica, o script
diz isso em vez de fingir que comparou: tipica e sempre menor que o limite, e
tratar uma como a outra encolheria a frota inteira.

## O que ele NAO faz

Nao grava nada. Um numero de ficha tecnica entra no catalogo com revisao
humana e um comentario dizendo de onde veio — e nao por uma raspagem que pode
ter pego a linha errada de uma tabela. O script relata; a correcao e feita a
mao, com a fonte no comentario.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / 'src/game/data/aircraft.ts'

# Id do jogo -> artigo da Wikipedia e como a variante se chama na tabela.
#
# O mapeamento e a mao de proposito: e o unico jeito de dizer que `b739` e a
# coluna "737-900ER" e nao "737-900", e errar isso e pior do que nao ter dado.
# Onde a coluna nao existe, o valor fica em branco e o script reclama.
ARTIGOS = {
    'Airbus A320 family': {
        'a318': 'A318', 'a319': 'A319', 'a320': 'A320', 'a321': 'A321',
    },
    'Airbus A320neo family': {
        'a319neo': 'A319neo', 'a320neo': 'A320neo', 'a321neo': 'A321neo',
        'a21lr': 'A321LR', 'a21xlr': 'A321XLR',
    },
    'Boeing 737 Next Generation': {
        'b736': '737-600', 'b73g': '737-700', 'b737': '737-800', 'b739': '737-900ER',
    },
    'Boeing 737 MAX': {
        'b38m': '737 MAX 8', 'b39m': '737 MAX 9', 'b3xm': '737 MAX 10', 'b37m': '737 MAX 7',
    },
    'Airbus A220': {'a220100': 'A220-100', 'a220300': 'A220-300'},
    'Embraer E-Jet family': {
        'e170': 'E170', 'e175': 'E175', 'e190': 'E190', 'e195': 'E195',
    },
    'Embraer E-Jet E2 family': {
        'e190e2': 'E190-E2', 'e195e2': 'E195-E2',
    },
    'Airbus A330': {'a332': 'A330-200', 'a333': 'A330-300'},
    'Airbus A330neo': {'a339': 'A330-900', 'a338': 'A330-800'},
    'Airbus A350': {'a359': 'A350-900', 'a35k': 'A350-1000', 'a35ulr': 'A350-900ULR'},
    'Airbus A340': {'a343': 'A340-300', 'a346': 'A340-600'},
    'Airbus A380': {'a388': 'A380-800'},
    'Boeing 787 Dreamliner': {'b788': '787-8', 'b789': '787-9', 'b78x': '787-10'},
    'Boeing 777': {'b77e': '777-200ER', 'b77w': '777-300ER', 'b77l': '777-200LR'},
    'Boeing 777X': {'b779': '777-9', 'b778': '777-8'},
    'Boeing 767': {'b763': '767-300ER', 'b764': '767-400ER'},
    'Boeing 747-8': {'b748': '747-8I'},
    'Boeing 747-400': {'b744': '747-400'},
    'Bombardier CRJ700 series': {'crj700': 'CRJ700', 'crj900': 'CRJ900', 'crj1000': 'CRJ1000'},
    'Bombardier CRJ100/200': {'crj200': 'CRJ200'},
    'Embraer ERJ family': {'erj135': 'ERJ 135', 'erj140': 'ERJ 140', 'erj145': 'ERJ 145'},
    'ATR 72': {'atr72': 'ATR 72-600'},
    'ATR 42': {'atr42': 'ATR 42-600'},
    'De Havilland Canada Dash 8': {'q200': 'Series 200', 'q300': 'Series 300', 'q400': 'Series 400'},
    'Comac C919': {'c919': 'C919'},
    'Comac ARJ21': {'arj21': 'ARJ21-700'},
    'Sukhoi Superjet 100': {'ssj100': 'SSJ100'},
    'Boeing 717': {'b712': '717-200'},
    'Tupolev Tu-204': {'tu204': 'Tu-204-100'},
}

# Divergencias ja conferidas a mao, com o porque de o catalogo ficar como esta.
#
# Nao e para silenciar achado: e para o relatorio parar de gritar o que ja foi
# decidido, e manter o motivo junto. Tirar uma linha daqui faz o conflito
# voltar a aparecer, que e o comportamento certo se alguem mexer no numero.
CONFERIDOS = {
    'a320neo': 'Airbus publica 194 na ficha do A320neo; a Wikipedia traz 195 @ 27in. '
               'Um assento de diferenca entre duas fontes credíveis, e a regra do '
               'repositorio manda preferir a ficha do fabricante.',
}

# Rotulos de linha, separados pelo que significam. Ver o cabecalho.
#
# `TIPICA` **nao** aceita "Passenger capacity", e a exclusao e o ponto. Essa
# linha quer dizer coisas diferentes em artigos diferentes: na tabela do 737 NG
# ela traz 130/148/184/215, que sao numeros de classe unica — o 737-800 voa 184
# assim e 162 em duas classes. Tratando-a como duas classes, a comparacao
# acusava o jogo de estar 19% baixo no 737-700 quando o que estava errado era
# comparar grandezas diferentes.
#
# Fica so o que se identifica sozinho: "2-class", "two-class", ou "Typical
# seating" — que nas tabelas da Boeing e da Embraer vem com a repartição
# explicita ("8 business + 145 economy") e por isso nao deixa duvida.
LIMITE = re.compile(r'(?i)(max(imum)?[\s-]*(passenger|seat|capacity)|exit limit|'
                    r'1[\s-]*class|single[\s-]*class|one[\s-]*class|high[\s-]*density)')
TIPICA = re.compile(r'(?i)(2[\s-]*class|two[\s-]*class|typical seating)')


# Onde as paginas baixadas ficam. Fora do repositorio: sao copia de fonte
# externa, nao dado do jogo.
CACHE = Path(os.environ.get('TMPDIR', '/tmp')) / 'skyline-wiki'


def wiki(titulo):
    """A pagina, do cache ou da rede.

    O cache nao e otimizacao: a API corta com 429 quando o levantamento varre
    trinta artigos seguidos, e sem cache cada rodada perde artigos diferentes —
    o relatorio mudava de uma execucao para outra sem nada ter mudado. Apague
    a pasta para forcar releitura.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    arq = CACHE / (re.sub(r'[^A-Za-z0-9]+', '_', titulo) + '.wiki')
    if arq.exists() and arq.stat().st_size > 2000:
        return arq.read_text(encoding='utf-8')
    url = 'https://en.wikipedia.org/w/rest.php/v1/page/' + urllib.parse.quote(titulo.replace(' ', '_'))
    req = urllib.request.Request(url, headers={'User-Agent': 'skyline-tycoon-data/1.0'})
    for tentativa in range(5):
        try:
            txt = json.load(urllib.request.urlopen(req, timeout=90)).get('source', '')
            if txt:
                arq.write_text(txt, encoding='utf-8')
            return txt
        except Exception as e:
            print(f'  {titulo}: {e}; espera', file=sys.stderr)
            time.sleep(12 * (tentativa + 1))
    return ''


def limpar(c):
    """Uma celula de tabela reduzida ao que da para ler."""
    c = re.sub(r'<ref.*?(/>|</ref>)', ' ', c, flags=re.S)
    c = re.sub(r'\{\{efn.*?\}\}', ' ', c, flags=re.S)
    c = re.sub(r'\{\{cvt\|([^|}]*)[^}]*\}\}', r'\1', c)
    c = re.sub(r'\{\{abbr\|[^|}]*\|([^}]*)\}\}', r'\1', c)
    c = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', c)
    c = re.sub(r'\[\[([^\]]*)\]\]', r'\1', c)
    c = c.replace('&nbsp;', ' ')
    c = re.sub(r'<[^>]+>', ' ', c)
    return re.sub(r'\s+', ' ', c).strip()


def celulas(bruto):
    """As celulas de uma linha, e se ela e linha de cabecalho.

    Wikitext separa celula por quebra de linha (`\n!` ou `\n|`) e tambem na
    mesma linha (`!!` e `||`), e as duas formas aparecem na mesma tabela. A
    primeira celula de um bloco costuma ser atributo de estilo, nao dado.
    """
    out, so_cabecalho = [], True
    for pedaco in re.split(r'\n\s*(?=[!|])', bruto):
        pedaco = pedaco.strip()
        if not pedaco:
            continue
        marca = pedaco[0]
        corpo = pedaco[1:] if marca in '!|' else pedaco
        sep = '!!' if marca == '!' else '||'
        for c in corpo.split(sep):
            # `colspan="3" | valor` vale por tres colunas. Descartar a linha
            # inteira por ela ser "estreita" perde metade das tabelas: a do
            # A330 tem a linha "Max seating" com um colspan no meio, e era
            # justamente essa a linha procurada. Expandir mantem o alinhamento,
            # que e o que importa — o risco nunca foi a largura, foi ler a
            # coluna do vizinho.
            vezes = 1
            mc = re.search(r'colspan\s*=\s*"?(\d+)', c)
            if mc:
                vezes = min(12, int(mc.group(1)))
            # `style="..." | valor` — o que interessa e o depois da barra
            if re.match(r'^\s*[a-z-]+\s*=', c) and '|' in c:
                c = c.split('|', 1)[1]
            # Celula vazia entra como vazia, e nao some.
            #
            # O cabecalho da tabela do A330 comeca com um `!` sozinho, so para
            # deixar em branco o canto sobre os rotulos. Descartando o vazio,
            # o cabecalho ficava com tres celulas e as linhas com quatro, e a
            # tabela inteira era jogada fora por "nao alinhar" — sendo que
            # alinhava perfeitamente. O que se descarta e o vazio do **fim**,
            # que nao desloca nada.
            out.extend([limpar(c)] * vezes)
            if marca != '!':
                so_cabecalho = False
    while out and not out[-1]:
        out.pop()
    return out, so_cabecalho


def tabelas(texto):
    """Cada tabela como (linha de variantes, linhas de dado).

    A linha de variantes e a **primeira linha so de cabecalho com duas ou mais
    celulas**. Detectar por "nao tem numero" nao funciona, e foi o defeito da
    primeira versao: variante de aviao e quase sempre um numero — 737-600,
    A350-1000, CRJ900 —, entao a heuristica descartava exatamente as tabelas
    que interessam e o levantamento inteiro voltava vazio.
    """
    out = []
    # Tentei limpar `<ref>` aqui, antes de fatiar, para resolver a tabela do
    # A330 — cuja referencia de oito linhas vira oito celulas falsas. Piorou:
    # `<ref name="x" />` e `<ref name="x">...</ref>` convivem no mesmo artigo,
    # e a expressao nao-gulosa engole do primeiro ate o fechamento do segundo,
    # levando tabelas inteiras junto. A cobertura caiu de 15 modelos para 10.
    # Fica registrado para nao ser tentado de novo sem um parser de verdade.
    for bloco in re.findall(r'\{\|(.*?)\n\|\}', texto, re.S):
        variantes, dados = None, []
        for bruto in bloco.split('|-'):
            cs, cab = celulas(bruto)
            if not any(cs):
                continue
            if variantes is None and cab and sum(1 for c in cs if c) >= 2:
                variantes = cs
            elif variantes is not None:
                dados.append(cs)
        if variantes and dados:
            out.append((variantes, dados))
    return out


def numeros(celula):
    """Os numeros de assento de uma celula, ignorando passo e area.

    Devolve **todos**, e quem le guarda a faixa. Nao da para escolher um: a
    celula do limite de saidas costuma trazer duas configuracoes de porta do
    mesmo aviao — o A340-300 publica "375 /440" —, e as duas sao certificadas.
    Escolher o primeiro e escolher o maior erram para lados opostos, e eu
    cometi os dois: com o maior, o 737 MAX 8 saia com os 210 do MAX 200; com o
    primeiro, o A340-300 saia com 375 sendo que 440 tambem e dele.
    """
    celula = re.sub(r'\d+\s*(in|cm|m|ft|kg|lb|nmi|km)\b', ' ', celula)
    # `195 @ 27` — o 27 e o passo, nao assento. E `16J + 190Y` — o 16 e a
    # executiva, e o que se quer e o total. Tudo que vem depois de um `@` ou
    # de uma letra de classe colada sai fora.
    celula = re.sub(r'@\s*\d+', ' ', celula)
    celula = re.sub(r'\d+\s*(business|economy|first|premium)[a-z ]*class', ' ', celula, flags=re.I)
    celula = re.sub(r'\b\d+\s*[JYFWC]\b', ' ', celula)
    return [int(n) for n in re.findall(r'\b(\d{2,3})\b', celula) if 15 <= int(n) <= 900]


def catalogo():
    texto = CATALOGO.read_text(encoding='utf-8')
    out = {}
    for m in re.finditer(r"[AC]\('([a-z0-9]+)', '([^']+)', '([^']+)', '(\w+)', (\d+),", texto):
        out[m.group(1)] = {'name': m.group(2), 'maxSeats': int(m.group(5))}
    return out


def main():
    cat = catalogo()
    print(f'{len(cat)} modelos no catalogo\n', file=sys.stderr)
    achados = {}
    for titulo, variantes in ARTIGOS.items():
        txt = wiki(titulo)
        if not txt:
            print(f'! {titulo}: sem conteudo', file=sys.stderr)
            continue
        for cab, dados in tabelas(txt):
            for gid, rotulo in variantes.items():
                col = next((i for i, c in enumerate(cab) if c.lower() == rotulo.lower()), None)
                if col is None:
                    col = next((i for i, c in enumerate(cab)
                                if rotulo.lower().replace(' ', '') in c.lower().replace(' ', '')), None)
                if col is None:
                    continue
                for linha in dados:
                    # Linha estreita nao alinha com o cabecalho, e ler a coluna
                    # `col` nela le o valor do vizinho. E a mesma armadilha que
                    # o `movimento.py` ja carrega documentada: na tabela do 777
                    # a linha "Exit limit" tem tres celulas para quatro colunas,
                    # e o 777-300ER saia com os 440 do 777-200 em vez dos 550
                    # dele. Alinhamento duvidoso vale menos que dado nenhum.
                    if len(linha) != len(cab):
                        continue
                    if col >= len(linha):
                        continue
                    kind = 'limite' if LIMITE.search(linha[0]) else 'tipica' if TIPICA.search(linha[0]) else None
                    if not kind:
                        continue
                    ns = numeros(linha[col])
                    if not ns:
                        continue
                    d = achados.setdefault(gid, {})
                    d.setdefault(kind, (min(ns), max(ns)))
                    d.setdefault(kind + '_fonte', f'{titulo} · {linha[0][:40]}')
        time.sleep(1.2)

    print(f'\n{len(achados)} modelos com algum dado publicado\n')
    faixa = lambda v: '—' if v is None else (str(v[0]) if v[0] == v[1] else f'{v[0]}–{v[1]}')
    print(f"{'id':<9} {'modelo':<20} {'jogo':>5} {'limite':>9} {'típica':>9}  fonte")
    conflito, sem = [], []
    for gid in sorted(cat):
        c = cat[gid]
        if c['maxSeats'] <= 0:
            continue
        a = achados.get(gid, {})
        lim = a.get('limite')
        marca = ''
        # Acusa **conflito**, nao diferenca. O publicado costuma ser uma faixa,
        # e um valor dentro dela nao esta errado — esta numa configuracao de
        # porta diferente. Fora dela, sim: nao existe certificado para aquilo.
        if lim is not None and not (lim[0] <= c['maxSeats'] <= lim[1]):
            if gid in CONFERIDOS:
                marca = '  (conferido)'
            else:
                marca = '  <-- CONFLITO'
                conflito.append((gid, c['name'], c['maxSeats'], lim, a.get('limite_fonte', '')))
        if lim is None:
            sem.append(gid)
        print(f"{gid:<9} {c['name']:<20} {c['maxSeats']:>5} "
              f"{faixa(lim):>9} {faixa(a.get('tipica')):>9}"
              f"  {a.get('limite_fonte', a.get('tipica_fonte', ''))[:42]}{marca}")

    print(f'\n{len(conflito)} em conflito com o publicado:')
    for gid, nome, jogo, lim, fonte in conflito:
        print(f'  {gid:<9} {nome:<20} catalogo {jogo} fora de {faixa(lim)}   ({fonte})')
    print(f'\n{len(sem)} sem limite publicado achado: {" ".join(sem)}')
    print('\nNada foi gravado: um numero de ficha entra no catalogo com revisao e fonte no comentario.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
