"""Levanta o pico anual de passageiros por aeroporto das listas da Wikipédia.

Percorre as listas de "busiest airports" por região e por país, lê cada tabela,
acha a coluna de passageiros e guarda o MAIOR valor visto para cada sigla IATA
— o ano de pico, que é o que o jogo quer.
"""
import json, re, sys, time, urllib.request, urllib.parse
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
]


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
NUMERO = re.compile(r"^[\d][\d,. ]*$")
# colunas que NÃO são passageiro
FORA = re.compile(r"cargo|freight|tonne|ton\b|movement|aircraft|rank|change|%|year|code|capacity|seats|metric", re.I)
PAX = re.compile(r"passenger|pax|traffic|total", re.I)


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


def engolir(tabela, fonte):
    if len(tabela) < 2:
        return
    cabecalho = tabela[0]
    # colunas de passageiro: cabeçalho que fala de passageiro e não de carga
    cols_pax = [i for i, c in enumerate(cabecalho) if PAX.search(c) and not FORA.search(c)]
    if not cols_pax:
        # tabela sem cabeçalho útil: aceita qualquer número grande na linha
        cols_pax = None
    for linha in tabela[1:]:
        siglas = []
        for c in linha:
            c = c.strip()
            if IATA.match(c):
                siglas.append(c)
            else:
                m = IATA_ICAO.match(c)
                if m:
                    siglas.append(m.group(1))
        if len(siglas) != 1:
            continue
        iata = siglas[0]
        alvos = linha if cols_pax is None else [linha[i] for i in cols_pax if i < len(linha)]
        valores = [v for v in (numero(c) for c in alvos) if v and 50_000 <= v <= 300_000_000]
        if not valores:
            continue
        v = max(valores)
        if v > pico.get(iata, (0, ""))[0]:
            pico[iata] = (v, fonte)


for titulo in PAGINAS:
    html = buscar(titulo)
    if not html:
        continue
    p = Tabelas()
    p.feed(html)
    antes = len(pico)
    for t in p.tabelas:
        engolir(t, titulo)
    time.sleep(1.5)
    print(f"{titulo}: {len(p.tabelas)} tabelas, {len(pico) - antes} siglas novas (total {len(pico)})",
          file=sys.stderr)

json.dump({k: round(v[0]) for k, v in pico.items()}, open(sys.argv[1], "w"), indent=0, sort_keys=True)
print(f"\n{len(pico)} aeroportos gravados em {sys.argv[1]}", file=sys.stderr)
