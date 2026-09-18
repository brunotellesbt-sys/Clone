"""Levanta o pico anual de passageiros por aeroporto das listas da Wikipédia.

Percorre as listas de "busiest airports" por região e por país, lê cada tabela,
acha a coluna de passageiros e guarda o MAIOR valor visto para cada sigla IATA
— o ano de pico, que é o que o jogo quer.
"""
import json, re, sys, time, unicodedata, urllib.request, urllib.parse
from html.parser import HTMLParser

PAGINAS = [
    "List of busiest airports by passenger traffic",
    "List of the busiest airports in Europe",
    "List of the busiest airports in the United States",
    "List of busiest airports in India",
    "List of the busiest airports in China",
    "List of the busiest airports in Asia",
    "List of the busiest airports in Africa",
    "List of the busiest airports in North America",
    "List of the busiest airports in South America",
    "List of the busiest airports in Oceania",
    "List of the busiest airports in the Caribbean",
    "List of the busiest airports in the Middle East",
    "List of busiest airports in the United Kingdom",
    "List of the busiest airports in Spain",
    "List of the busiest airports in France",
    "List of the busiest airports in Italy",
    "List of the busiest airports in Germany",
    "List of the busiest airports in Canada",
    "List of the busiest airports in Mexico",
    "List of the busiest airports in Australia",
    "List of the busiest airports in Brazil",
    "List of the busiest airports in Japan",
    "List of the busiest airports in Indonesia",
    "List of the busiest airports in Turkey",
    "List of the busiest airports in Russia",
    "List of the busiest airports in the Nordic countries",
    "List of the busiest airports in Greece",
    "List of the busiest airports in Malaysia",
    "List of the busiest airports in the Republic of Ireland",
    "List of the busiest airports in Poland",
    "List of the busiest airports in Portugal",
    "List of the busiest airports in Vietnam",
    "List of the busiest airports in Thailand",
    "List of the busiest airports in South Korea",
    "List of the busiest airports in the Philippines",
    "List of the busiest airports in Colombia",
    "List of the busiest airports in Argentina",
    "List of the busiest airports in Chile",
    "List of the busiest airports in Peru",
    "List of the busiest airports in New Zealand",
    "List of the busiest airports in South Africa",
    "List of the busiest airports in Switzerland",
    "List of the busiest airports in Austria",
    "List of the busiest airports in the Netherlands",
    "List of the busiest airports in Norway",
    "List of the busiest airports in Ukraine",
    "List of the busiest airports in Saudi Arabia",
    "List of the busiest airports in Egypt",
    "List of the busiest airports in Morocco",
    "List of the busiest airports in Nigeria",
    # segunda leva: paises onde o levantamento anterior deixou mais buracos
    "List of the busiest airports in Italy",
    "List of the busiest airports in Greece",
    "List of the busiest airports in Switzerland",
    "List of the busiest airports in Austria",
    "List of the busiest airports in Panama",
    "List of the busiest airports in Iraq",
    "List of airports in Brazil",
    "List of airports in Canada",
    "List of airports in Australia",
    "List of the busiest airports in Kazakhstan",
    "List of the busiest airports in Iran",
    "List of the busiest airports in Algeria",
    "List of the busiest airports in Pakistan",
    "List of the busiest airports in Bangladesh",
    "List of the busiest airports in Venezuela",
    "List of the busiest airports in Ecuador",
    "List of the busiest airports in Bolivia",
    "List of the busiest airports in Uruguay",
    "List of the busiest airports in Paraguay",
    "List of the busiest airports in Costa Rica",
    "List of the busiest airports in Cuba",
    "List of the busiest airports in the Dominican Republic",
    "List of the busiest airports in Guatemala",
    "List of the busiest airports in Israel",
    "List of the busiest airports in Jordan",
    "List of the busiest airports in Lebanon",
    "List of the busiest airports in Qatar",
    "List of the busiest airports in Kuwait",
    "List of the busiest airports in Oman",
    "List of the busiest airports in Kenya",
    "List of the busiest airports in Ethiopia",
    "List of the busiest airports in Ghana",
    "List of the busiest airports in Tanzania",
    "List of the busiest airports in Tunisia",
    "List of the busiest airports in Belgium",
    "List of the busiest airports in the Czech Republic",
    "List of the busiest airports in Hungary",
    "List of the busiest airports in Romania",
    "List of the busiest airports in Bulgaria",
    "List of the busiest airports in Croatia",
    "List of the busiest airports in Serbia",
    "List of the busiest airports in Finland",
    "List of the busiest airports in Estonia",
    "List of the busiest airports in Latvia",
    "List of the busiest airports in Lithuania",
    "List of the busiest airports in Belarus",
    "List of the busiest airports in Uzbekistan",
    "List of the busiest airports in Azerbaijan",
    "List of the busiest airports in Georgia (country)",
    "List of the busiest airports in Armenia",
    "List of the busiest airports in Sri Lanka",
    "List of the busiest airports in Nepal",
    "List of the busiest airports in Cambodia",
    "List of the busiest airports in Myanmar",
    "List of the busiest airports in Taiwan",
    "List of the busiest airports in Papua New Guinea",
    "List of the busiest airports in Fiji",
    "List of the busiest airports in the Bahamas",
    "List of the busiest airports in Jamaica",
    "List of the busiest airports in Trinidad and Tobago",
]


def normal(t):
    """Nome de aeroporto reduzido ao que identifica: sem acento, sem pontuacao,
    sem as palavras que todo aeroporto tem."""
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    t = re.sub(r"\[[^\]]*\]", " ", t)
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(
        r"\b(airport|international|intl|airfield|aerodrome|aeroport|aeropuerto|"
        r"aeroporto|flughafen|luchthaven|lufthavn|havalimani|the|of)\b", " ", t)
    return " ".join(t.split())


def mapa_de_nomes():
    """Nome normalizado -> sigla IATA, da OurAirports.

    Metade das listas por regiao — a da Europa e a do Canada, entre elas — nao
    traz sigla nenhuma: o aeroporto aparece so pelo nome. Sem casar por nome,
    Malpensa, Atenas, Viena, Zurique, Vancouver, Manchester, Praga, Budapeste e
    Bruxelas ficavam de fora de tabelas que tinham o numero deles.
    """
    url = "https://davidmegginson.github.io/ourairports-data/airports.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "skyline-tycoon-data/1.0"})
    texto = urllib.request.urlopen(req, timeout=180).read().decode("utf-8", "replace")
    linhas = texto.splitlines()
    campos = lambda l: [c.strip('"').replace('""', '"')
                        for c in re.findall(r'("(?:[^"]|"")*"|[^,]*)(?:,|$)', l)][:-1]
    cab = campos(linhas[0])
    iI, iN, iM = cab.index("iata_code"), cab.index("name"), cab.index("municipality")
    contagem, mapa = {}, {}
    for l in linhas[1:]:
        f = campos(l)
        if len(f) <= max(iI, iN, iM) or not f[iI]:
            continue
        for bruto in (f[iN], f"{f[iM]} {f[iN]}"):
            k = normal(bruto)
            if len(k) < 4:
                continue
            contagem[k] = contagem.get(k, set()) | {f[iI]}
            mapa[k] = f[iI]
    # nome ambiguo nao serve: dois aeroportos com o mesmo nome reduzido
    return {k: v for k, v in mapa.items() if len(contagem[k]) == 1}


class Tabelas(HTMLParser):
    """Extrai tabelas como listas de listas de texto."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tabelas, self.pilha = [], []
        self.linha, self.celula, self.nivel = None, None, 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.pilha.append([])
        elif tag == "tr" and self.pilha:
            self.linha = []
        elif tag in ("td", "th") and self.linha is not None:
            self.celula = []

    def handle_endtag(self, tag):
        if tag == "table" and self.pilha:
            self.tabelas.append(self.pilha.pop())
        elif tag == "tr" and self.linha is not None:
            if self.pilha:
                self.pilha[-1].append(self.linha)
            self.linha = None
        elif tag in ("td", "th") and self.celula is not None:
            if self.linha is not None:
                self.linha.append(" ".join("".join(self.celula).split()))
            self.celula = None

    def handle_data(self, d):
        if self.celula is not None:
            self.celula.append(d)


def buscar(titulo):
    url = "https://en.wikipedia.org/api/rest_v1/page/html/" + urllib.parse.quote(titulo.replace(" ", "_"))
    req = urllib.request.Request(url, headers={"User-Agent": "skyline-tycoon-data/1.0"})
    for tentativa in range(5):
        try:
            return urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  - {titulo}: nao existe", file=sys.stderr)
                return ""
            time.sleep(4 * (tentativa + 1))
        except Exception:
            time.sleep(4 * (tentativa + 1))
    print(f"  ! {titulo}: desistiu", file=sys.stderr)
    return ""


IATA = re.compile(r"^[A-Z]{3}$")
# "ATL/KATL", "ATL / KATL", "GRU (SBGR)" — a sigla costuma vir colada ao ICAO
IATA_ICAO = re.compile(r"^([A-Z]{3})\s*[/(]\s*[A-Z]{4}\)?$")
# "Milan–Malpensa Airport (MXP)" — metade das listas por pais escreve assim, e
# exigir a celula inteira igual a sigla deixava Malpensa, Atenas, Viena, Zurique
# e o Panama de fora de uma tabela que tinha o numero deles
IATA_PAREN = re.compile(r"\(([A-Z]{3})\)")
NUMERO = re.compile(r"^[\d][\d,. ]*$")
# colunas que NÃO são passageiro
FORA = re.compile(r"cargo|freight|tonne|ton\b|movement|aircraft|rank|change|%|year|code|capacity|seats|metric", re.I)
PAX = re.compile(r"passenger|pax|traffic|total|enplanement", re.I)
# "Enplanements" e "boardings" contam so quem EMBARCA.
EMBARQUE = re.compile(r"enplanement|boarding", re.I)

# Paginas que publicam embarque em vez de passageiro total, e o fator que
# converte. A lista americana usa o dado de enplanement da FAA e o cabecalho
# dela e so o ano, entao nao da para descobrir pela coluna: e fato da pagina.
#
# Todo embarque tem um desembarque correspondente, dai o dobro. Confere onde as
# duas medidas existem: Atlanta 2024 teve 52,5 milhoes de embarques e 108,1
# milhoes de passageiros — razao 2,06. Sem esta conta, Filadelfia, Baltimore,
# San Diego, Tampa e Portland saiam com metade do movimento real, porque sao os
# que ficam de fora da lista mundial e so tinham a fonte americana.
FATOR_PAGINA = {
    "List of the busiest airports in the United States": 2.0,
}


def numero(s):
    s = s.replace(" ", " ").strip()
    s = re.sub(r"\[[^\]]*\]", "", s)
    if not NUMERO.match(s):
        return None
    limpo = s.replace(",", "").replace(" ", "")
    # "12.345.678" (ponto de milhar) vira 12345678; "12.3" fica 12.3
    if limpo.count(".") > 1 or (limpo.count(".") == 1 and len(limpo.split(".")[-1]) == 3):
        limpo = limpo.replace(".", "")
    try:
        return float(limpo)
    except ValueError:
        return None


pico = {}
POR_NOME = {}


def engolir(tabela, fonte, fator=1.0):
    if len(tabela) < 2:
        return
    cabecalho = tabela[0]
    # colunas de passageiro: cabeçalho que fala de passageiro e não de carga
    cols_pax = [i for i, c in enumerate(cabecalho) if PAX.search(c) and not FORA.search(c)]
    dobrar = {i for i in cols_pax if EMBARQUE.search(cabecalho[i])}
    # Cabeçalho com colspan não alinha com as linhas de dado: a lista da Europa
    # põe "Passengers" cobrindo duas subcolunas de ano, e o índice da coluna
    # passa a apontar para o lugar errado — Montreal saía com 8 milhões em vez
    # de 22. Quando a largura não bate, o mapeamento não vale e é mais seguro
    # varrer a linha inteira: número de passageiro é grande e não se confunde
    # com percentual nem com ano.
    larguras = [len(l) for l in tabela[1:] if len(l) > 1]
    tipica = max(set(larguras), key=larguras.count) if larguras else 0
    if tipica and len(cabecalho) != tipica:
        cols_pax, dobrar = None, set()
    if not cols_pax:
        # tabela sem cabeçalho útil: aceita qualquer número grande na linha
        cols_pax, dobrar = None, set()
    for linha in tabela[1:]:
        siglas = []
        for c in linha:
            c = c.strip()
            if IATA.match(c):
                siglas.append(c)
                continue
            m = IATA_ICAO.match(c)
            if m:
                siglas.append(m.group(1))
                continue
            for m in IATA_PAREN.finditer(c):
                siglas.append(m.group(1))
        if not siglas:
            # sem sigla na linha: tenta casar cada celula pelo nome do aeroporto
            for c in linha:
                k = normal(c)
                if len(k) >= 4 and k in POR_NOME:
                    siglas.append(POR_NOME[k])
        siglas = list(dict.fromkeys(siglas))
        if len(siglas) != 1:
            continue
        iata = siglas[0]
        if cols_pax is None:
            alvos = [(c, False) for c in linha]
        else:
            alvos = [(linha[i], i in dobrar) for i in cols_pax if i < len(linha)]
        valores = []
        for texto, ehEmbarque in alvos:
            v = numero(texto)
            if not v:
                continue
            v *= fator
            if ehEmbarque:
                v *= 2
            if 50_000 <= v <= 300_000_000:
                valores.append(v)
        if not valores:
            continue
        v = max(valores)
        if v > pico.get(iata, (0, ""))[0]:
            pico[iata] = (v, fonte)


def do_wikidata():
    """Movimento anual direto do Wikidata, pela propriedade P3872.

    Vale mais que todas as listas somadas: sao 2.365 aeroportos numa consulta
    so, com o dado estruturado em vez de raspado de tabela. Heathrow 83,9
    milhoes, Frankfurt 70,6, Atlanta 110,5 — confere com o publicado.

    O servico de consulta as vezes esta sob limite duro de uma requisicao por
    minuto; por isso as tentativas espacadas. Se nao vier, o levantamento segue
    so com as listas, que e o que ele fazia antes.
    """
    q = ("SELECT ?iata ?pax WHERE { ?item wdt:P238 ?iata . "
         "?item p:P3872 ?st . ?st ps:P3872 ?pax . }")
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={
        "User-Agent": "skyline-tycoon-data/1.0", "Accept": "application/sparql-results+json"})
    for tentativa in range(6):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=240))
            break
        except Exception as e:
            print(f"  wikidata: {e}; espera", file=sys.stderr)
            time.sleep(70)
    else:
        return {}
    out = {}
    for r in d["results"]["bindings"]:
        iata = r["iata"]["value"].strip().upper()
        if len(iata) != 3 or not iata.isalpha():
            continue
        try:
            v = float(r["pax"]["value"])
        except ValueError:
            continue
        if 50_000 <= v <= 300_000_000 and v > out.get(iata, 0):
            out[iata] = v
    return out


for iata, v in do_wikidata().items():
    if v > pico.get(iata, (0, ""))[0]:
        pico[iata] = (v, "Wikidata P3872")
print(f"{len(pico)} siglas depois do Wikidata", file=sys.stderr)

try:
    POR_NOME = mapa_de_nomes()
    print(f"{len(POR_NOME)} nomes de aeroporto para casar", file=sys.stderr)
except Exception as e:
    print(f"! sem a tabela de nomes ({e}); so as siglas serao lidas", file=sys.stderr)

for titulo in PAGINAS:
    html = buscar(titulo)
    if not html:
        continue
    p = Tabelas()
    p.feed(html)
    antes = len(pico)
    for t in p.tabelas:
        engolir(t, titulo, FATOR_PAGINA.get(titulo, 1.0))
    time.sleep(1.5)
    print(f"{titulo}: {len(p.tabelas)} tabelas, {len(pico) - antes} siglas novas (total {len(pico)})",
          file=sys.stderr)

dados = {k: round(v[0]) for k, v in pico.items()}

# Escreve direto no movimento.ts em vez de cuspir um JSON para colar. Colar a
# mao era o elo frouxo: dava para rodar, esquecer de colar, e ficar com a tabela
# velha achando que tinha atualizado — primo do defeito do `K` desatualizado.
# `--json arquivo` volta ao comportamento antigo.
if "--json" in sys.argv:
    alvo = sys.argv[sys.argv.index("--json") + 1]
    json.dump(dados, open(alvo, "w"), indent=0, sort_keys=True)
    print(f"\n{len(dados)} aeroportos em {alvo}", file=sys.stderr)
    raise SystemExit

DESTINO = "src/game/data/movimento.ts"
fonte = open(DESTINO, encoding="utf-8").read()
ABRE = "export const MOVIMENTO_ANUAL: Record<string, number> = Object.fromEntries(\n  `"
ini = fonte.find(ABRE)
fim = fonte.find("`\n    .split(/\\s+/)", ini)
if ini < 0 or fim < 0:
    print(f"nao achei a tabela em {DESTINO}; use --json e cole a mao", file=sys.stderr)
    raise SystemExit(1)

# so as siglas que o jogo conhece, em milhares, quebradas em 76 colunas
siglas = set(re.findall(r"^([A-Z]{3})\|", fonte_aeroportos := open(
    "src/game/data/airports.ts", encoding="utf-8").read(), re.M))
linhas, linha = [], ""
for k in sorted(dados):
    if k not in siglas:
        continue
    pedaco = f"{k}:{round(dados[k] / 1000)} "
    if len(linha) + len(pedaco) > 76:
        linhas.append(linha.rstrip())
        linha = ""
    linha += pedaco
linhas.append(linha.rstrip())
open(DESTINO, "w", encoding="utf-8").write(
    fonte[: ini + len(ABRE)] + "\n".join(linhas) + fonte[fim:])
print(f"\n{sum(1 for k in dados if k in siglas)} aeroportos gravados em {DESTINO}",
      file=sys.stderr)
print("  reajuste a estimativa e rode `npm run fluxo` em seguida", file=sys.stderr)
