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


def engolir(tabela, fonte, fator=1.0):
    if len(tabela) < 2:
        return
    cabecalho = tabela[0]
    # colunas de passageiro: cabeçalho que fala de passageiro e não de carga
    cols_pax = [i for i, c in enumerate(cabecalho) if PAX.search(c) and not FORA.search(c)]
    dobrar = {i for i in cols_pax if EMBARQUE.search(cabecalho[i])}
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

json.dump({k: round(v[0]) for k, v in pico.items()}, open(sys.argv[1], "w"), indent=0, sort_keys=True)
print(f"\n{len(pico)} aeroportos gravados em {sys.argv[1]}", file=sys.stderr)
