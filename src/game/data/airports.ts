// Aeroportos.
//
// Entra aqui todo aeroporto com serviço aéreo regular, sigla IATA de três letras
// e pista firme de pelo menos 4.400 ft — a pista que o ATR 72 pede no catálogo
// do próprio jogo. O critério é esse e não "aeroporto grande" porque o que
// interessa é onde a frota do jogo **pode pousar**: a menor aeronave de linha
// dela define o piso, e a lista fica com 3.086 destinos em 231 países.
//
// Fato e índice de jogo estão misturados de propósito, e a diferença importa:
//
//   iata, cidade, país, lat, lon, pista   fato
//   pop, gdp, tour, tier                  índice de jogo
//
// O fato vem de dados públicos (ver `CREDITS.md`): OurAirports para sigla,
// coordenada, classe e pista; GeoNames para a população das cidades.
//
// O índice é derivado ou escrito à mão:
//
//   pop    população (milhões) das cidades num raio de 70 km — a bacia de
//          captação, não a cidade. Cidade do outro lado da fronteira conta 15%:
//          existe quem atravesse para voar mais barato, mas não é a bacia do
//          aeroporto — sem esse peso Johor Bahru herdava Singapura inteira.
//   gdp    poder de compra, 0.2–1.6. Índice do país, ou o valor à mão de quem
//          já estava curado.
//   tour   atratividade turística, 0.5–2.2. Mesma regra.
//   tier   1 regional, 5 mega-hub. Sai da bacia ponderada pelo poder de compra,
//          com a pista como piso e a classe do aeroporto como teto. Num grupo de
//          aeroportos da mesma metrópole (70 km, mesmo país) o principal fica com
//          o degrau cheio e os outros descem um por posição — é a relação que a
//          lista à mão já tinha entre GRU (5), CGH (3) e VCP (3).
//
// Os 382 aeroportos que estavam curados à mão mantêm pop, gdp, tour e tier: são
// ajuste de balanceamento, e o dado público não sabe nada sobre isso. Deles só a
// coordenada e a pista foram corrigidas pelo fato.
import { AIRPORT_NAMES } from './airportNames'
import { estimarMovimento, fatorFluxo, MOVIMENTO_ANUAL, movimentoDiario } from './movimento'

export interface Airport {
  iata: string
  city: string
  country: string
  cc: string
  lat: number
  lon: number
  pop: number
  gdp: number
  tour: number
  runway: number
  /**
   * Elevação do aeroporto, em pés. Ar rarefeito cobra pista: a regra é 10% a
   * mais de decolagem a cada 1.000 ft.
   *
   * Sem isso, La Paz (13.355 ft) e Quito (7.841 ft) eram tratados como nível do
   * mar, e Ponta Grossa — 1.430 m de pista a 2.588 ft — aceitava 737-800.
   *
   * Vem da OurAirports. Quatorze aeroportos ficaram em zero por o campo estar
   * vazio na fonte — treze chineses e um indiano —, e zero ali não é "nível do
   * mar", é "não sei": Lincang está a 6.102 ft e Ulanqab a 4.619 ft, e o portão
   * de pista os tratava como praia. Foram fechados pela **altitude do terreno**
   * na coordenada que o próprio jogo guarda, medida na SRTM. O método foi
   * conferido onde havia as duas fontes: Huangshan 132 m contra 134 m da ficha,
   * Tongren 709 contra 705, Jiujiang 41 contra 50.
   */
  elev: number
  tier: 1 | 2 | 3 | 4 | 5
  /** Continente do país, da tabela da OurAirports. É a região de um `reg`. */
  cont: Continente
  /**
   * Passageiros por dia que o aeroporto move, nos dois sentidos, no ano de
   * maior movimento da história dele. Ver `movimento.ts`: é dado onde existe e
   * estimativa onde não existe.
   *
   * É este número, e não a população da cidade, que dimensiona o mercado — é o
   * que separa Guarulhos de Congonhas e de Viracopos.
   */
  paxDia: number
  /** Fator de equilíbrio do fluxo; ver `movimento.ts`. */
  fluxo: number
  /**
   * O movimento é medido ou estimado?
   *
   * 2.101 aeroportos têm número publicado; os outros 984 caem numa regressão
   * cujo erro típico é um fator de 2,5. A tela diz qual é o caso em vez de
   * apresentar os dois com a mesma cara — número estimado com aparência de
   * medido é pior que número estimado assumido.
   */
  medido: boolean
  /** Minutos de diferença para o UTC, do tzdata. Sem horário de verão. */
  fuso: number
  /**
   * Até onde o aeroporto recebe voo. Ver `ESCOPO` abaixo: `dom` só doméstico,
   * `reg` doméstico e internacional do mesmo continente, `int` qualquer um.
   */
  escopo: Escopo
  slots: number
  /** Rótulo curto: "Cidade (IATA)". */
  name: string
  /**
   * Nome oficial do aeroporto. Só existe para os 180 que estão curados à mão;
   * nos outros ele repete o rótulo curto, e `temNomeOficial` diz qual é o caso
   * — mostrar "Recife (REC)" como se fosse nome oficial é ruído, não dado.
   */
  official: string
  /**
   * Maior aeronave que o aeroporto recebe de fato, em assentos certificados.
   * Ausente onde quem manda é a pista, que é a esmagadora maioria.
   *
   * Ver `TETO_ASSENTOS`.
   */
  tetoAssentos?: number
}

/**
 * Aeroportos onde a operação é menor do que a pista comportaria.
 *
 * A regra do jogo é a pista, e ela acerta quase sempre. Pampulha é o caso em
 * que ela erra sozinha: 8.333 ft a 2.589 ft de elevação passam A321neo pela
 * conta de decolagem, e A321neo nunca operou ali. O que limita Pampulha não é
 * o asfalto, é a vizinhança — aeroporto dentro da cidade, e a transferência
 * do movimento para Confins em 2005 foi decidida por isso, não por pista.
 *
 * O número é o **maior que voou de verdade**, em assentos certificados: no ano
 * de pico de Pampulha, 2004, o maior de linha era o 737-300, com 149. Ele não
 * está no catálogo do jogo — o catálogo começa depois dele —, mas o sucessor
 * direto está, com o mesmo limite de 149: o 737-700. É ele que passa a ser o
 * teto, e o A319, com 156, é o primeiro que fica de fora.
 *
 * Lista de um. Só entra aqui aeroporto em que dê para dizer qual avião voou e
 * qual não voou; palpite sobre "aeroporto pequeno" continua sendo a pista.
 */
export const TETO_ASSENTOS: Record<string, number> = {
  PAV: 78, JDF: 78, ITB: 78, OPP: 78,
  TBT: 146, TJL: 146, OAL: 146, VAL: 146,
  PET: 172, PIN: 172, BVH: 172,
  PLU: 194, SDU: 194, CGH: 194, LEC: 194, JOI: 194, JPR: 194, MVF: 194, JTC: 194,
  PMG: 194, ATM: 194, ARU: 194, AUX: 194, BYO: 194, CLV: 194, XAP: 194, FEN: 194,
  IMP: 194, MAB: 194, MOC: 194, CKS: 194, PPB: 194, STM: 194, TFF: 194, TUR: 194,
  NVT: 194, UNA: 194,
}

const RAW = `
HND|Toquio|Japao|JP|35.55|139.79|37.40|1.40|1.50|11024|5|35
NRT|Narita|Japao|JP|35.77|140.39|37.40|1.30|1.80|13123|5|141
CGK|Jacarta|Indonesia|ID|-6.13|106.66|33.40|0.60|1.00|12008|5|34
DEL|Nova Delhi|India|IN|28.56|77.10|32.90|0.55|1.20|14534|5|777
PVG|Xangai|China|CN|31.14|121.81|29.20|1.05|1.30|13123|5|13
ICN|Seul|Coreia do Sul|KR|37.47|126.45|25.60|1.25|1.50|13123|5|23
GRU|Sao Paulo|Brasil|BR|-23.43|-46.47|22.40|0.78|1.00|12139|5|2461
MEX|Cidade do Mexico|Mexico|MX|19.44|-99.07|22.00|0.72|1.40|12966|5|7316
PEK|Pequim|China|CN|40.08|116.60|22.00|0.95|1.40|12467|5|116
BOM|Mumbai|India|IN|19.09|72.87|21.70|0.62|1.10|11511|5|39
JFK|Nova York|EUA|US|40.64|-73.78|20.10|1.45|2.00|14511|5|13
CAN|Guangzhou|China|CN|23.39|113.30|18.70|0.95|0.90|12467|5|50
BKK|Banguecoque|Tailandia|TH|13.68|100.75|17.40|0.70|2.10|13123|5|5
IST|Istambul|Turquia|TR|41.27|28.73|16.00|0.80|1.80|13451|5|325
LHR|Londres|Reino Unido|GB|51.47|-0.46|14.30|1.45|2.00|12799|5|83
LAX|Los Angeles|EUA|US|33.94|-118.41|13.20|1.40|1.90|12894|5|125
CDG|Paris|Franca|FR|49.01|2.55|13.00|1.35|2.10|13829|5|392
ORD|Chicago|EUA|US|41.98|-87.90|9.50|1.30|1.20|13000|5|680
DFW|Dallas|EUA|US|32.90|-97.04|7.90|1.30|0.90|13401|5|607
HKG|Hong Kong|Hong Kong|HK|22.31|113.91|7.50|1.35|1.70|12467|5|28
MAD|Madri|Espanha|ES|40.49|-3.57|6.80|1.10|1.60|14271|5|1998
YYZ|Toronto|Canada|CA|43.68|-79.63|6.40|1.25|1.20|11120|5|569
ATL|Atlanta|EUA|US|33.64|-84.43|6.30|1.25|0.90|12390|5|1026
MIA|Miami|EUA|US|25.80|-80.29|6.20|1.20|2.00|13016|5|8
SIN|Singapura|Singapura|SG|1.35|103.99|6.00|1.50|1.70|13123|5|22
FRA|Frankfurt|Alemanha|DE|50.03|8.56|5.80|1.40|1.10|13123|5|364
SYD|Sydney|Australia|AU|-33.95|151.18|5.40|1.40|1.90|12999|5|21
FCO|Roma|Italia|IT|41.80|12.25|4.30|1.10|2.10|12801|5|13
DXB|Dubai|Emirados|AE|25.25|55.37|3.60|1.35|2.20|14590|5|62
MUC|Munique|Alemanha|DE|48.35|11.79|3.00|1.40|1.40|13123|5|1487
AMS|Amsterda|Holanda|NL|52.31|4.76|2.90|1.40|1.80|12467|5|-11
DOH|Doha|Catar|QA|25.27|51.61|2.40|1.45|1.30|15912|5|13
NLU|Cidade do Mexico|Mexico|MX|19.74|-99.02|32.14|0.72|1.40|14764|4|7369
SHA|Xangai|China|CN|31.20|121.33|29.20|1.00|0.90|11154|4|10
NMI|Mumbai|India|IN|18.98|73.07|25.79|0.62|1.10|12139|4|184
GMP|Seul|Coreia do Sul|KR|37.56|126.79|25.60|1.20|1.00|11811|4|59
MNL|Manila|Filipinas|PH|14.51|121.02|24.90|0.55|1.20|12261|4|75
WUX|Wuxi|China|CN|31.50|120.43|23.66|0.80|1.00|10499|4|24
PKX|Pequim|China|CN|39.50|116.41|22.00|0.90|1.00|12467|4|98
CTU|Chengdu|China|CN|30.56|103.95|21.40|0.80|1.00|11811|4|1625
CAI|Cairo|Egito|EG|30.11|31.40|21.30|0.50|1.70|13124|4|322
DXN|Gautam Buddha Nagar|India|IN|28.18|77.61|20.83|0.55|1.20|12975|4|644
EWR|Nova York|EUA|US|40.69|-74.17|20.10|1.40|1.50|11000|4|18
KIX|Osaka|Japao|JP|34.43|135.24|19.10|1.25|1.50|13123|4|26
SZX|Shenzhen|China|CN|22.64|113.80|17.60|1.05|0.80|12467|4|13
SVO|Moscou|Russia|RU|55.98|37.41|17.30|0.75|0.90|12139|4|622
CKG|Chongqing|China|CN|29.71|106.65|16.90|0.72|0.90|12467|4|1365
FIH|Kinshasa|Congo (Kinshasa)|CD|-4.39|15.44|16.83|0.22|0.50|13123|4|1027
EZE|Buenos Aires|Argentina|AR|-34.82|-58.54|15.40|0.70|1.50|10827|4|67
ONT|Ontario|EUA|US|34.06|-117.60|15.18|1.40|1.90|12197|4|944
LGW|Londres|Reino Unido|GB|51.15|-0.19|14.30|1.30|1.60|10883|4|202
BLR|Bangalore|India|IN|13.20|77.71|13.60|0.65|0.80|13123|4|3000
GIG|Rio de Janeiro|Brasil|BR|-22.81|-43.25|13.50|0.72|1.90|13123|4|28
BOG|Bogota|Colombia|CO|4.70|-74.15|11.30|0.68|1.10|12467|4|8361
HFE|Hefei|China|CN|31.99|116.98|11.19|0.80|1.00|11155|4|207
INC|Yinchuan|China|CN|38.32|106.39|10.70|0.80|1.00|11811|4|3743
LIM|Lima|Peru|PE|-12.02|-77.11|10.70|0.65|1.50|11506|4|113
JNB|Joanesburgo|Africa do Sul|ZA|-26.14|28.25|10.50|0.65|1.10|14495|4|5558
BGW|Baghdad|Iraque|IQ|33.26|44.23|10.48|0.38|0.50|13124|4|114
SWA|Jieyang|China|CN|23.55|116.50|10.41|0.80|1.00|10499|4|29
CGO|Zhengzhou|China|CN|34.53|113.85|9.46|0.80|1.00|11155|4|495
SGN|Ho Chi Minh|Vietna|VN|10.82|106.65|9.30|0.60|1.40|12468|4|33
TNA|Jinan|China|CN|36.86|117.22|8.83|0.80|1.00|11812|4|76
HAN|Hanoi|Vietna|VN|21.22|105.81|8.50|0.58|1.30|12466|4|39
KUL|Kuala Lumpur|Malasia|MY|2.75|101.71|8.40|0.80|1.40|13530|4|69
JHB|Johor Bahru|Malasia|MY|1.64|103.67|8.08|0.72|1.50|12467|4|135
RUH|Riade|Arabia Saudita|SA|24.96|46.70|8.00|1.10|0.70|13796|4|2049
YNT|Yantai|China|CN|37.66|120.98|7.57|0.80|1.00|11155|4|154
ZUH|Zhuhai|China|CN|22.01|113.38|7.53|0.80|1.00|13517|4|23
SJW|Shijiazhuang|China|CN|38.28|114.70|7.23|0.80|1.00|11155|4|233
IAH|Houston|EUA|US|29.98|-95.34|7.10|1.30|0.80|12001|4|97
SCL|Santiago|Chile|CL|-33.39|-70.79|7.10|0.90|1.30|12303|4|1555
TPE|Taipe|Taiwan|TW|25.08|121.23|7.00|1.15|1.30|12008|4|106
IAD|Washington|EUA|US|38.94|-77.46|6.40|1.45|1.30|11500|4|312
BCN|Barcelona|Espanha|ES|41.30|2.08|5.60|1.10|2.00|11000|4|12
ADD|Adis Abeba|Etiopia|ET|8.98|38.80|5.20|0.35|0.80|12467|4|7630
MEL|Melbourne|Australia|AU|-37.67|144.84|5.20|1.35|1.40|11998|4|434
MXP|Milao|Italia|IT|45.63|8.73|5.10|1.25|1.40|12861|4|768
BOS|Boston|EUA|US|42.36|-71.01|4.90|1.45|1.20|10083|4|20
BSB|Brasilia|Brasil|BR|-15.87|-47.92|4.80|0.95|0.80|10827|4|3497
BER|Berlim|Alemanha|DE|52.36|13.50|4.70|1.20|1.40|13123|4|157
JED|Jeda|Arabia Saudita|SA|21.68|39.16|4.70|1.00|1.50|13123|4|48
SFO|Sao Francisco|EUA|US|37.62|-122.37|4.70|1.60|1.60|11870|4|13
TLV|Tel Aviv|Israel|IL|32.01|34.89|4.20|1.30|1.30|13327|4|135
SEA|Seattle|EUA|US|47.45|-122.31|4.00|1.45|1.20|11901|4|433
ATH|Atenas|Grecia|GR|37.94|23.94|3.80|0.90|2.10|13123|4|308
DEN|Denver|EUA|US|39.86|-104.67|3.00|1.25|1.20|16000|4|5431
LIS|Lisboa|Portugal|PT|38.78|-9.14|2.90|0.95|1.90|12500|4|374
CLT|Charlotte|EUA|US|35.21|-80.94|2.70|1.20|0.80|10000|4|748
MCO|Orlando|EUA|US|28.43|-81.31|2.70|1.05|2.20|12005|4|96
BNE|Brisbane|Australia|AU|-27.38|153.12|2.60|1.30|1.40|11680|4|13
YVR|Vancouver|Canada|CA|49.19|-123.18|2.60|1.30|1.50|11500|4|14
LAS|Las Vegas|EUA|US|36.08|-115.15|2.30|1.10|2.20|14835|4|2181
CPH|Copenhague|Dinamarca|DK|55.62|12.66|2.10|1.40|1.30|11811|4|17
VIE|Viena|Austria|AT|48.11|16.57|2.00|1.25|1.50|11811|4|600
PTY|Cidade do Panama|Panama|PA|9.07|-79.38|1.90|0.80|1.20|10006|4|135
AKL|Auckland|Nova Zelandia|NZ|-37.01|174.79|1.70|1.25|1.70|11926|4|23
AUH|Abu Dhabi|Emirados|AE|24.44|54.65|1.60|1.40|1.40|13471|4|88
DUB|Dublin|Irlanda|IE|53.43|-6.26|1.40|1.30|1.40|10203|4|242
ZRH|Zurique|Suica|CH|47.46|8.55|1.40|1.60|1.40|12139|4|1417
CUN|Cancun|Mexico|MX|21.04|-86.87|0.90|0.65|2.20|11483|4|22
TLC|Toluca|Mexico|MX|19.34|-99.57|31.88|0.72|1.40|13780|3|8466
TFU|Chengdu|China|CN|30.31|104.44|22.95|0.80|1.00|13123|3|1440
DAC|Daca|Bangladesh|BD|23.84|90.40|22.50|0.35|0.50|11500|3|30
CGH|Sao Paulo|Brasil|BR|-23.63|-46.65|22.40|0.85|0.80|6365|3|2631
HLP|Jacarta|Indonesia|ID|-6.27|106.89|21.99|0.60|1.00|9843|3|84
SPX|Cairo|Egito|EG|30.11|30.90|20.88|0.50|1.70|11975|3|510
HLA|Joanesburgo|Africa do Sul|ZA|-25.94|27.93|20.58|0.65|1.10|9996|3|4517
LGA|Nova York|EUA|US|40.78|-73.87|20.10|1.40|1.20|7002|3|21
ITM|Osaka|Japao|JP|34.78|135.44|19.10|1.30|1.00|9840|3|50
CZX|Changzhou|China|CN|31.92|119.78|18.16|0.80|1.00|11155|3|33
DMK|Banguecoque|Tailandia|TH|13.91|100.61|17.40|0.60|1.50|12139|3|9
SAW|Istambul|Turquia|TR|40.90|29.31|16.00|0.70|1.20|11614|3|312
WEF|Weifang|China|CN|36.65|119.12|15.77|0.80|1.00|8530|3|125
TSA|Taipe|Taiwan|TW|25.07|121.55|15.61|1.15|1.30|8547|3|18
LOS|Lagos|Nigeria|NG|6.58|3.32|15.40|0.45|0.60|12794|3|135
CCU|Calcuta|India|IN|22.65|88.45|15.30|0.45|0.80|11919|3|16
LGB|Los Angeles|EUA|US|33.82|-118.15|15.05|1.40|1.90|10000|3|60
SZB|Kuala Lumpur|Malasia|MY|3.13|101.55|14.85|0.80|1.40|12401|3|90
TSN|Tianjin|China|CN|39.12|117.35|13.90|0.80|0.70|11811|3|10
ORY|Paris|Franca|FR|48.73|2.36|13.00|1.25|1.40|11975|3|291
XIY|Xian|China|CN|34.44|108.76|13.00|0.75|1.20|12467|3|1572
DME|Moscou Domodedovo|Russia|RU|55.41|37.91|12.60|0.72|0.80|11483|3|588
WUH|Wuhan|China|CN|30.77|114.21|12.30|0.78|0.80|11811|3|113
IBR|Omitama|Japao|JP|36.18|140.41|12.26|1.30|1.80|8858|3|105
HGH|Hangzhou|China|CN|30.24|120.43|11.90|0.82|1.20|11811|3|23
MAA|Chennai|India|IN|12.99|80.17|11.50|0.55|0.80|12001|3|52
DUS|Dusseldorf|Alemanha|DE|51.29|6.77|11.30|1.10|0.80|9842|3|147
CSX|Changsha|China|CN|28.19|113.22|10.50|0.75|0.80|12467|3|217
HYD|Hyderabad|India|IN|17.23|78.43|10.50|0.60|0.80|13976|3|2024
SUB|Surabaia|Indonesia|ID|-7.38|112.79|9.80|0.50|0.70|9843|3|9
STN|Londres Stansted|Reino Unido|GB|51.88|0.23|9.50|1.05|1.10|10003|3|348
NGO|Nagoia|Japao|JP|34.86|136.80|9.40|1.20|0.90|11483|3|15
NKG|Nanquim|China|CN|31.74|118.87|9.30|0.82|1.00|11811|3|49
TAO|Qingdao|China|CN|36.36|120.09|9.00|0.82|1.10|11811|3|30
DWC|Dubai|Emirados|AE|24.90|55.16|8.80|1.35|2.20|14764|3|114
KMG|Kunming|China|CN|25.11|102.94|8.50|0.70|1.20|14764|3|6903
AMD|Amedabade|India|IN|23.08|72.63|8.40|0.50|0.70|11499|3|189
AVV|Melbourne|Australia|AU|-38.04|144.47|8.30|1.35|1.40|10000|3|35
YTY|Yangzhou|China|CN|32.56|119.72|7.99|0.80|1.00|10499|3|7
YIW|Yiwu/Jinhua|China|CN|29.34|120.03|7.87|0.80|1.00|9843|3|262
NTG|Nantong|China|CN|32.07|120.98|7.78|0.80|1.00|11155|3|16
GYY|Gary|EUA|US|41.62|-87.41|7.72|1.30|1.20|8859|3|591
LYP|Faisalabad|Paquistao|PK|31.36|73.00|7.42|0.40|0.60|9324|3|591
XUZ|Xuzhou|China|CN|34.06|117.56|7.42|0.80|1.00|11548|3|108
TYN|Taiyuan|China|CN|37.75|112.63|6.77|0.80|1.00|11811|3|2575
ZNZ|Zanzibar|Tanzania|TZ|-6.22|39.22|6.59|0.32|1.45|9915|3|54
DSS|Dakar|Senegal|SN|14.67|-17.07|6.54|0.35|1.00|11483|3|290
NGB|Ningbo|China|CN|29.83|121.46|6.50|0.80|1.00|10499|3|13
JNG|Jining|China|CN|35.65|116.74|6.35|0.80|1.00|9186|3|171
STV|Surat|India|IN|21.12|72.74|6.31|0.52|0.90|9530|3|16
DAL|Dallas|EUA|US|32.84|-96.85|6.27|1.30|0.90|8800|3|487
FLL|Fort Lauderdale|Estados Unidos|US|26.07|-80.15|6.20|1.05|1.60|9000|3|9
PHL|Filadelfia|EUA|US|39.87|-75.24|6.20|1.20|1.00|12000|3|36
CJB|Coimbatore|India|IN|11.03|77.04|6.13|0.52|0.90|8480|3|1324
NNG|Nanning|China|CN|22.60|108.18|6.11|0.80|1.00|10499|3|421
CGQ|Changchun|China|CN|44.00|125.68|6.10|0.80|1.00|10500|3|706
SKT|Sialkot|Paquistao|PK|32.54|74.36|6.07|0.40|0.60|11811|3|837
BWI|Baltimore|EUA|US|39.18|-76.67|6.03|1.45|1.30|10503|3|146
CNF|Belo Horizonte|Brasil|BR|-19.64|-43.97|6.00|0.75|0.80|11811|3|2721
PLU|Belo Horizonte|Brasil|BR|-19.85|-43.95|6.00|0.75|0.80|8333|2|2589
PEW|Peshawar|Paquistao|PK|33.99|71.51|5.95|0.40|0.60|9000|3|1158
BFY|Bengbu|China|CN|33.17|117.06|5.85|0.80|1.00|8530|3|75
SJC|Sao Francisco|EUA|US|37.36|-121.93|5.82|1.60|1.60|11000|3|62
HBE|Alexandria|Egito|EG|30.93|29.70|5.80|0.45|2.00|11156|3|171
FNJ|Pyongyang|Coreia do Norte|KP|39.22|125.67|5.71|0.25|0.50|11490|3|117
FUK|Fukuoka|Japao|JP|33.59|130.45|5.60|1.20|1.20|9186|3|32
LED|Sao Petersburgo|Russia|RU|59.80|30.26|5.60|0.70|1.20|12402|3|78
CJJ|Cheongju|Coreia do Sul|KR|36.72|127.50|5.33|1.12|1.30|9000|3|191
GDL|Guadalajara|Mexico|MX|20.52|-103.31|5.30|0.70|1.00|13123|3|5016
MTY|Monterrey|Mexico|MX|25.78|-100.11|5.30|0.78|0.70|9843|3|1278
NBO|Nairobi|Quenia|KE|-1.32|36.93|5.30|0.45|1.50|13507|3|5330
PBC|Puebla|Mexico|MX|19.16|-98.37|5.29|0.69|1.30|11811|3|7361
SJK|Sao Jose dos Campos|Brasil|BR|-23.23|-45.86|5.27|0.78|1.00|8780|3|2120
XMN|Xiamen|China|CN|24.54|118.13|5.20|0.85|1.20|11155|3|59
CGP|Chattogram|Bangladesh|BD|22.25|91.81|5.12|0.35|0.50|9646|3|12
YEI|Yenisehir|Turquia|TR|40.26|29.56|5.10|0.65|1.30|9818|3|764
RMQ|Taichung|Taiwan|TW|24.26|120.62|5.09|1.07|1.15|12000|3|663
PHX|Phoenix|EUA|US|33.44|-112.01|5.00|1.15|1.10|11489|3|1135
KAN|Kano|Nigeria|NG|12.05|8.52|4.99|0.47|0.55|10831|3|1562
YHM|Hamilton|Canada|CA|43.17|-79.93|4.94|1.25|1.20|10006|3|780
BAV|Baotou|China|CN|40.56|110.00|4.93|0.80|1.00|9186|3|3321
KRT|Khartoum|Sudao|SD|15.59|32.55|4.84|0.24|0.50|9751|3|1265
HIA|Huai'an|China|CN|33.79|119.13|4.82|0.80|1.00|9186|3|28
VCA|Can Tho|Vietna|VN|10.08|105.71|4.81|0.58|1.40|9843|3|9
CPT|Cidade do Cabo|Africa do Sul|ZA|-33.97|18.60|4.80|0.70|2.00|10502|3|151
BKO|Bamako|Mali|ML|12.53|-7.95|4.78|0.24|0.60|10498|3|1247
KBL|Kabul|Afeganistao|AF|34.57|69.21|4.71|0.22|0.50|11483|3|5877
LHW|Lanzhou|China|CN|36.52|103.62|4.65|0.80|1.00|13123|3|6388
HPH|Haiphong|Vietna|VN|20.82|106.72|4.60|0.58|1.40|10007|3|6
SRG|Semarang|Indonesia|ID|-6.97|110.37|4.57|0.50|0.90|8399|3|10
KWE|Guiyang|China|CN|26.54|106.80|4.51|0.80|1.00|13123|3|3736
BZV|Brazzaville|Congo (Brazzaville)|CG|-4.25|15.25|4.46|0.32|0.60|10827|3|1048
CKY|Conakry|Guine|GN|9.58|-13.61|4.41|0.24|0.50|10826|3|72
CMN|Casablanca|Marrocos|MA|33.37|-7.59|4.40|0.60|1.30|12205|3|656
DTW|Detroit|EUA|US|42.21|-83.35|4.40|1.05|0.70|12003|3|645
POA|Porto Alegre|Brasil|BR|-29.99|-51.17|4.40|0.80|0.90|10499|3|11
RBA|Rabat|Marrocos|MA|34.05|-6.75|4.40|0.54|1.65|11483|3|276
CCJ|Calicut|India|IN|11.14|75.96|4.39|0.52|0.90|9383|3|342
VLN|Valencia|Venezuela|VE|10.15|-67.93|4.33|0.45|0.70|9842|3|1411
YUL|Montreal|Canada|CA|45.47|-73.74|4.30|1.15|1.20|11000|3|118
FOC|Fuzhou|China|CN|25.93|119.67|4.29|0.80|1.00|11811|3|46
HWR|Halwara|India|IN|30.75|75.63|4.28|0.52|0.90|10007|3|790
PHC|Port Harcourt|Nigeria|NG|5.02|6.95|4.22|0.47|0.55|9843|3|87
FOR|Fortaleza|Brasil|BR|-3.78|-38.53|4.10|0.60|1.50|9039|3|83
REC|Recife|Brasil|BR|-8.13|-34.92|4.10|0.65|1.60|9865|3|33
HAK|Haikou|China|CN|19.93|110.46|4.09|0.80|1.00|11811|3|75
HIJ|Hiroshima|Japao|JP|34.44|132.92|4.07|1.23|1.50|9842|3|1088
BTH|Batam|Indonesia|ID|1.12|104.12|4.05|0.50|0.90|13218|3|126
SLW|Saltillo|Mexico|MX|25.54|-100.93|4.04|0.69|1.30|9506|3|4778
ATQ|Amritsar|India|IN|31.71|74.80|3.92|0.52|0.90|12000|3|756
WNZ|Wenzhou|China|CN|27.91|120.85|3.92|0.80|1.00|10499|3|13
SSA|Salvador|Brasil|BR|-12.91|-38.32|3.90|0.62|1.70|9859|3|64
CWB|Curitiba|Brasil|BR|-25.53|-49.18|3.70|0.82|0.80|7277|3|2988
MSP|Minneapolis|EUA|US|44.88|-93.22|3.70|1.25|0.80|11006|3|841
VGA|Vijayawada|India|IN|16.53|80.80|3.57|0.52|0.90|11023|3|82
IXC|Chandigarh|India|IN|30.67|76.79|3.56|0.52|0.90|12467|3|1012
SDQ|Santo Domingo|Republica Dominicana|DO|18.43|-69.67|3.50|0.48|1.40|11000|3|59
BDQ|Vadodara|India|IN|22.34|73.23|3.49|0.52|0.90|8100|3|129
HET|Hohhot|China|CN|40.85|111.82|3.45|0.80|1.00|11811|3|3556
AKR|Akure|Nigeria|NG|7.25|5.30|3.43|0.47|0.55|9195|3|1100
PUS|Busan|Coreia do Sul|KR|35.18|128.94|3.40|1.05|1.10|10499|3|6
NAG|Nagpur|India|IN|21.09|79.05|3.37|0.52|0.90|10500|3|1033
TRN|Caselle Torinese|Italia|IT|45.20|7.65|3.37|1.00|1.40|10827|3|989
LYI|Linyi|China|CN|35.05|118.41|3.33|0.80|1.00|10498|3|177
SDJ|Natori|Japao|JP|38.14|140.92|3.31|1.23|1.50|9842|3|15
AGR|Agra|India|IN|27.16|77.96|3.30|0.52|0.90|9000|3|551
SAN|San Diego|EUA|US|32.73|-117.19|3.30|1.30|1.40|9401|3|17
VCP|Campinas|Brasil|BR|-23.01|-47.13|3.30|0.80|0.70|10630|3|2170
BFI|Seattle|EUA|US|47.53|-122.30|3.29|1.45|1.20|10007|3|21
TPA|Tampa|Estados Unidos|US|27.98|-82.53|3.20|1.02|1.30|11002|3|26
DAT|Datong|China|CN|40.06|113.48|3.18|0.80|1.00|9843|3|3442
EHU|Ezhou|China|CN|30.34|115.04|3.13|0.80|1.00|11811|3|86
ABB|Asaba|Nigeria|NG|6.20|6.67|3.10|0.47|0.55|11155|3|305
HAM|Hamburgo|Alemanha|DE|53.63|9.99|3.10|1.12|1.00|12028|3|53
PVD|Providence/Warwick|EUA|US|41.73|-71.43|3.10|1.10|1.10|8700|3|55
WAW|Varsovia|Polonia|PL|52.17|20.97|3.10|0.90|1.00|12106|3|362
XNN|Haidong|China|CN|36.53|102.04|2.98|0.80|1.00|12467|3|7119
BJC|Denver|EUA|US|39.91|-105.12|2.94|1.25|1.20|9000|3|5673
BHX|Birmingham|Reino Unido|GB|52.45|-1.75|2.90|0.95|0.80|10013|3|327
COV|Tarsus|Turquia|TR|36.89|35.07|2.90|0.65|1.30|11482|3|35
YCU|Yuncheng|China|CN|35.12|111.03|2.90|0.80|1.00|10499|3|1242
HIN|Sacheon|Coreia do Sul|KR|35.09|128.07|2.83|1.12|1.30|9000|3|25
BJX|Silao|Mexico|MX|20.99|-101.48|2.80|0.69|1.30|11483|3|5956
MAN|Manchester|Reino Unido|GB|53.35|-2.28|2.80|1.05|1.00|10007|3|257
DSN|Ordos|China|CN|39.49|109.86|2.73|0.80|1.00|10499|3|4557
MWX|Muan|Coreia do Sul|KR|34.99|126.38|2.71|1.12|1.30|9186|3|35
PRG|Praga|Chequia|CZ|50.10|14.26|2.70|0.95|1.70|12189|3|1247
STR|Stuttgart|Alemanha|DE|48.69|9.22|2.70|1.15|0.80|10974|3|1276
DOY|Dongying|China|CN|37.50|118.79|2.62|0.80|1.00|9186|3|15
CTS|Sapporo|Japao|JP|42.77|141.69|2.60|1.15|1.70|9843|3|82
XFN|Xiangyang|China|CN|32.15|112.29|2.58|0.80|1.00|8530|3|234
TEQ|Corlu|Turquia|TR|41.14|27.92|2.53|0.70|1.20|9844|3|574
BUD|Budapeste|Hungria|HU|47.43|19.26|2.50|0.85|1.60|12162|3|495
PDX|Portland|Estados Unidos|US|45.59|-122.60|2.50|1.10|1.00|11000|3|31
KHN|Nanchang|China|CN|28.86|115.90|2.46|0.80|1.00|11155|3|143
HAJ|Hannover|Alemanha|DE|52.46|9.69|2.45|1.15|1.00|12434|3|183
KOJ|Kagoshima|Japao|JP|31.80|130.72|2.45|1.23|1.50|9840|3|906
ARN|Estocolmo|Suecia|SE|59.65|17.93|2.40|1.35|1.20|10830|3|137
SJU|San Juan|Porto Rico|PR|18.44|-66.00|2.40|0.85|1.90|10002|3|9
SMF|Sacramento|EUA|US|38.70|-121.59|2.37|1.10|1.10|8605|3|27
CQW|Wulong|China|CN|29.47|107.69|2.31|0.80|1.00|9186|3|1747
AUS|Austin|Estados Unidos|US|30.20|-97.66|2.30|1.15|1.10|12250|3|542
LYS|Lyon|Franca|FR|45.73|5.09|2.30|1.05|1.00|13124|3|821
LGG|Grace-Hollogne|Belgica|BE|50.64|5.44|2.26|1.30|1.10|12106|3|659
PER|Perth|Australia|AU|-31.94|115.97|2.20|1.35|1.00|11299|3|67
SJO|San Jose|Costa Rica|CR|9.99|-84.21|2.20|0.62|1.90|9882|3|3021
TIJ|Tijuana|Mexico|MX|32.54|-116.97|2.20|0.68|0.90|9711|3|489
FKS|Sukagawa|Japao|JP|37.23|140.43|2.19|1.23|1.50|8202|3|1221
KMQ|Kanazawa|Japao|JP|36.39|136.41|2.14|1.23|1.50|8876|3|36
BRU|Bruxelas|Belgica|BE|50.90|4.48|2.10|1.30|1.10|11936|3|175
DJT|West Palm Beach|EUA|US|26.68|-80.10|2.07|1.20|2.00|10001|3|19
WJU|Wonju|Coreia do Sul|KR|37.44|127.96|2.07|1.12|1.30|9000|3|329
BDL|Hartford|EUA|US|41.94|-72.69|2.01|1.10|1.10|9510|3|173
BNA|Nashville|Estados Unidos|US|36.12|-86.68|2.00|1.05|1.30|11030|3|599
KUV|Gunsan|Coreia do Sul|KR|35.90|126.62|1.94|1.12|1.30|9000|3|29
SCK|Stockton|EUA|US|37.89|-121.24|1.93|1.10|1.10|10245|3|33
KIJ|Niigata|Japao|JP|37.95|139.11|1.90|1.23|1.50|8200|3|29
OPO|Porto|Portugal|PT|41.25|-8.68|1.70|0.90|1.50|11417|3|228
DMM|Dammam|Arabia Saudita|SA|26.47|49.80|1.60|0.95|0.70|13124|3|72
MCT|Mascate|Oma|OM|23.60|58.29|1.60|0.95|1.30|13386|3|48
YYC|Calgary|Canada|CA|51.12|-114.01|1.60|1.30|1.00|14000|3|3557
DIA|Doha|Catar|QA|25.26|51.57|1.57|1.45|1.30|15000|3|35
PSM|Portsmouth|EUA|US|43.08|-70.82|1.56|1.45|1.20|11321|3|100
HEL|Helsinque|Finlandia|FI|60.32|24.96|1.50|1.30|1.10|11483|3|179
MED|Medina|Arabia Saudita|SA|24.55|39.71|1.50|0.85|2.00|14222|3|2151
OSL|Oslo|Noruega|NO|60.19|11.10|1.50|1.50|1.20|11811|3|681
AYT|Antalya|Turquia|TR|36.90|30.80|1.30|0.62|2.20|11155|3|177
SLC|Salt Lake City|Estados Unidos|US|40.79|-111.98|1.30|1.08|1.00|12002|3|4227
DAD|Da Nang|Vietna|VN|16.04|108.20|1.20|0.48|1.80|11483|3|33
DPS|Bali|Indonesia|ID|-8.75|115.17|1.00|0.60|2.20|9790|3|14
GVA|Genebra|Suica|CH|46.24|6.11|1.00|1.60|1.50|12795|3|1411
HNL|Honolulu|Estados Unidos|US|21.32|-157.93|1.00|1.05|2.20|12360|3|13
LPA|Las Palmas|Espanha|ES|27.93|-15.39|0.90|0.82|1.90|10171|3|78
TFS|Tenerife Sul|Espanha|ES|28.04|-16.57|0.90|0.82|2.00|10499|3|209
VCE|Veneza|Italia|IT|45.51|12.35|0.90|1.00|2.20|10827|3|7
CJU|Jeju|Coreia do Sul|KR|33.51|126.49|0.70|0.95|2.10|10433|3|118
PMI|Palma|Espanha|ES|39.55|2.74|0.60|1.00|2.20|10728|3|27
KEF|Reiquiavique|Islandia|IS|63.99|-22.61|0.20|1.15|2.10|10056|3|171
PUJ|Punta Cana|Republica Dominicana|DO|18.57|-68.36|0.10|0.50|2.20|10171|3|47
HDO|Nova Delhi|India|IN|28.71|77.36|28.11|0.55|1.20|9000|2|700
ZIA|Moscou|Russia|RU|55.55|38.15|22.33|0.75|0.90|15092|2|377
LTN|Londres|Reino Unido|GB|51.87|-0.37|21.20|1.30|1.60|7093|2|526
CCE|Cairo|Egito|EG|30.06|31.84|20.91|0.50|1.70|11980|2|761
KHI|Carachi|Paquistao|PK|24.91|67.16|17.20|0.40|0.50|11155|2|100
AEP|Buenos Aires|Argentina|AR|-34.56|-58.42|15.40|0.75|1.10|7710|2|18
SDU|Rio de Janeiro|Brasil|BR|-22.91|-43.16|13.50|0.85|1.40|4341|2|11
LHE|Lahore|Paquistao|PK|31.52|74.40|13.00|0.35|0.80|11024|2|712
XSP|Singapura|Singapura|SG|1.42|103.87|12.67|1.50|1.70|6023|2|36
NKM|Nagoia|Japao|JP|35.26|136.92|11.00|1.20|0.90|8990|2|52
HRB|Harbin|China|CN|45.62|126.25|10.00|0.68|0.80|11811|2|457
IKA|Teera|Ira|IR|35.42|51.15|9.50|0.45|0.80|13772|2|3305
MDW|Chicago|EUA|US|41.79|-87.75|9.17|1.30|1.20|6522|2|620
SHE|Shenyang|China|CN|41.64|123.48|9.10|0.72|0.70|10499|2|198
MEB|Melbourne|Australia|AU|-37.73|144.90|8.79|1.35|1.40|6302|2|282
RTM|Amsterda|Holanda|NL|51.96|4.44|8.49|1.40|1.80|7218|2|-15
BVA|Beauvais|Franca|FR|49.45|2.11|8.36|1.35|2.10|7972|2|359
LAD|Luanda|Angola|AO|-8.86|13.23|8.30|0.38|0.60|12190|2|243
LIN|Milao Linate|Italia|IT|45.45|9.28|8.20|1.15|0.90|8012|2|353
EMA|Nottingham|Reino Unido|GB|52.83|-1.33|7.82|0.95|0.80|9495|2|306
YCM|Niagara-on-the-Lake|Canada|CA|43.19|-79.17|7.72|1.25|1.20|5000|2|321
JJN|Quanzhou|China|CN|24.80|118.59|7.67|0.85|1.20|8530|2|39
LPL|Manchester|Reino Unido|GB|53.33|-2.85|7.63|1.05|1.00|7497|2|80
WIL|Nairobi|Quenia|KE|-1.32|36.81|7.40|0.45|1.50|5052|2|5536
DLC|Dalian|China|CN|38.97|121.54|7.20|0.80|0.90|10827|2|107
IBA|Ibadan|Nigeria|NG|7.36|3.98|7.13|0.47|0.55|7875|2|725
PNQ|Pune|India|IN|18.58|73.92|7.00|0.55|0.70|10000|2|1942
LBA|Leeds, West Yorkshire|Reino Unido|GB|53.87|-1.66|6.82|1.05|1.10|7381|2|681
OAK|Sao Francisco|EUA|US|37.72|-122.22|6.63|1.60|1.60|10520|2|9
LBC|Lubeck|Alemanha|DE|53.81|10.72|6.60|1.12|1.00|6896|2|53
YMX|Montreal|Canada|CA|45.68|-74.04|6.12|1.15|1.20|12000|2|270
DCA|Washington|EUA|US|38.85|-77.04|5.91|1.45|1.30|7169|2|15
ESB|Ancara|Turquia|TR|40.13|33.00|5.70|0.65|0.80|12303|2|3125
SBD|San Bernardino|EUA|US|34.10|-117.24|5.65|1.40|1.90|10000|2|1159
ABJ|Abidjan|Costa do Marfim|CI|5.26|-3.93|5.60|0.35|0.80|9843|2|21
CMB|Colombo|Sri Lanka|LK|7.18|79.88|5.60|0.45|1.70|10991|2|30
FTW|Dallas|EUA|US|32.82|-97.36|5.59|1.30|0.90|7502|2|710
BDO|Bandung|Indonesia|ID|-6.90|107.58|5.52|0.50|0.90|7381|2|2436
CCS|Caracas|Venezuela|VE|10.60|-66.99|5.20|0.45|0.70|11483|2|234
ACC|Acra|Gana|GH|5.61|-0.17|5.10|0.45|0.80|11165|2|205
SOD|Sorocaba|Brasil|BR|-23.48|-47.49|5.08|0.80|0.70|5348|2|2083
YXX|Abbotsford|Canada|CA|49.03|-122.36|4.90|1.30|1.50|9600|2|195
AZA|Phoenix|EUA|US|33.31|-111.65|4.85|1.15|1.10|10401|2|1382
OPF|Miami|EUA|US|25.91|-80.28|4.71|1.20|2.00|8002|2|8
TAE|Daegu|Coreia do Sul|KR|35.89|128.66|4.71|1.05|1.10|9039|2|116
KNO|Medan|Indonesia|ID|3.64|98.87|4.70|0.48|0.90|12303|2|23
JBQ|Santo Domingo|Republica Dominicana|DO|18.57|-69.99|4.55|0.48|1.40|5412|2|98
CRL|Bruxelas|Belgica|BE|50.46|4.46|4.54|1.30|1.10|10023|2|614
AMM|Ama|Jordania|JO|31.72|35.99|4.50|0.70|1.20|12008|2|2395
URC|Urumqi|China|CN|43.91|87.48|4.50|0.65|1.00|11811|2|2125
PAT|Patna|India|IN|25.59|85.09|4.49|0.52|0.90|6410|2|170
WMI|Varsovia|Polonia|PL|52.45|20.65|4.38|0.90|1.00|8202|2|341
YKF|Breslau|Canada|CA|43.46|-80.38|4.29|1.25|1.20|7003|2|1054
CLD|San Diego|EUA|US|33.13|-117.28|4.16|1.30|1.40|4897|2|331
TVS|Tangshan|China|CN|39.72|118.00|4.11|0.80|1.00|8858|2|50
JAI|Jaipur|India|IN|26.82|75.81|4.10|0.45|1.50|9177|2|1263
MDE|Medellin|Colombia|CO|6.16|-75.42|4.10|0.65|1.30|11286|2|6955
HOU|Houston|EUA|US|29.65|-95.28|4.05|1.30|0.80|7602|2|46
PAP|Port-au-Prince|Haiti|HT|18.58|-72.29|3.82|0.22|0.60|9974|2|122
ABV|Abuja|Nigeria|NG|9.01|7.26|3.80|0.50|0.50|11842|2|1123
CIA|Roma|Italia|IT|41.80|12.60|3.80|1.10|2.10|7226|2|427
MYJ|Matsuyama|Japao|JP|33.83|132.70|3.80|1.23|1.50|8200|2|25
KMJ|Kumamoto|Japao|JP|32.84|130.85|3.72|1.20|1.20|9840|2|642
DUR|Durban|Africa do Sul|ZA|-29.61|31.12|3.70|0.60|1.20|12139|2|295
LKO|Lucknow|India|IN|26.76|80.89|3.70|0.42|0.90|8996|2|410
IXM|Madurai|India|IN|9.83|78.09|3.67|0.52|0.90|5990|2|459
AIP|Adampur|India|IN|31.43|75.76|3.65|0.52|0.90|9039|2|775
CGN|Colonia|Alemanha|DE|50.87|7.14|3.60|1.08|0.80|12516|2|302
EBB|Entebbe|Uganda|UG|0.04|32.44|3.60|0.30|1.10|12000|2|3782
HDD|Hyderabad|Paquistao|PK|25.32|68.37|3.58|0.40|0.60|6998|2|130
OKJ|Okayama|Japao|JP|34.76|133.85|3.58|1.25|1.50|9843|2|806
RKT|Ras Al Khaimah|Emirados|AE|25.61|55.94|3.56|1.35|2.20|12336|2|102
HUI|Hue|Vietna|VN|16.40|107.70|3.55|0.48|1.80|8775|2|48
ISB|Islamabade|Paquistao|PK|33.55|72.83|3.50|0.45|0.60|12001|2|1761
CBO|Datu Odin Sinsuat|Filipinas|PH|7.16|124.21|3.42|0.47|1.05|6234|2|189
ALG|Argel|Argelia|DZ|36.69|3.21|3.40|0.60|0.70|11483|2|82
MLG|Malang|Indonesia|ID|-7.93|112.71|3.38|0.50|0.70|8202|2|1726
VAL|Valenca|Brasil|BR|-13.30|-38.99|3.35|0.68|0.85|5906|2|21
OIM|Izu Oshima|Japao|JP|34.78|139.36|3.29|1.23|1.50|5905|2|130
CUF|Levaldigi|Italia|IT|44.55|7.62|3.26|1.00|1.40|6903|2|1267
KWJ|Gwangju|Coreia do Sul|KR|35.12|126.81|3.25|1.12|1.30|9300|2|39
BMA|Estocolmo|Suecia|SE|59.35|17.94|3.12|1.35|1.20|5472|2|47
DKR|Dacar|Senegal|SN|14.67|-17.07|3.10|0.35|1.00|11483|2|85
GYE|Guayaquil|Equador|EC|-2.16|-79.88|3.10|0.52|0.90|9154|2|19
KWI|Kuwait|Kuwait|KW|29.22|47.97|3.10|1.10|0.60|15026|2|206
MUX|Multan|Paquistao|PK|30.20|71.42|3.10|0.40|0.60|12353|2|403
NAP|Napoles|Italia|IT|40.89|14.29|3.10|0.78|1.60|8622|2|294
FSZ|Makinohara / Shimada|Japao|JP|34.80|138.19|3.08|1.23|1.50|7218|2|433
KMS|Kumasi|Gana|GH|6.71|-1.59|3.08|0.45|0.80|7612|2|942
AXF|Bayanhot|China|CN|38.75|105.58|3.02|0.80|1.00|7874|2|4560
ADB|Izmir|Turquia|TR|38.29|27.16|3.00|0.62|1.30|10630|2|412
CEB|Cebu|Filipinas|PH|10.31|123.98|3.00|0.50|1.70|10860|2|31
GUA|Cidade da Guatemala|Guatemala|GT|14.58|-90.53|3.00|0.45|1.00|9800|2|4952
KBP|Kiev|Ucrania|UA|50.34|30.89|3.00|0.52|0.90|10827|2|427
IFN|Isfahan|Ira|IR|32.76|51.88|2.99|0.45|0.80|14425|2|5059
CAT|Lisboa|Portugal|PT|38.72|-9.36|2.98|0.95|1.90|4593|2|325
GAJ|Higashine|Japao|JP|38.41|140.37|2.98|1.23|1.50|6560|2|353
MAR|Maracaibo|Venezuela|VE|10.56|-71.73|2.94|0.45|0.70|9843|2|239
ALP|Aleppo|Siria|SY|36.18|37.23|2.93|0.25|0.50|9547|2|1276
OKD|Sapporo|Japao|JP|43.12|141.38|2.93|1.15|1.70|4920|2|25
PSD|Port Said|Egito|EG|31.28|32.24|2.93|0.45|2.00|7707|2|10
QOW|Owerri|Nigeria|NG|5.43|7.21|2.93|0.47|0.55|8858|2|373
CLO|Cali|Colombia|CO|3.54|-76.38|2.90|0.55|0.90|9842|2|3162
TAS|Tashkent|Uzbequistao|UZ|41.26|69.28|2.90|0.50|0.80|13123|2|1417
MGQ|Mogadishu|Somalia|SO|2.01|45.30|2.88|0.20|0.50|10446|2|29
KIS|Kisumu|Quenia|KE|-0.09|34.73|2.87|0.45|1.50|10823|2|3734
KAD|Kaduna|Nigeria|NG|10.70|7.32|2.85|0.47|0.55|9843|2|2073
OUA|Ouagadougou|Burquina Faso|BF|12.35|-1.51|2.84|0.26|0.60|9843|2|1037
CWL|Cardiff|Reino Unido|GB|51.40|-3.34|2.82|1.05|1.10|7723|2|220
KTI|Phnom Penh|Camboja|KH|11.36|104.92|2.82|0.35|1.40|13123|2|20
NVT|Navegantes|Brasil|BR|-26.88|-48.65|2.81|0.68|0.85|5906|2|18
STL|St. Louis|Estados Unidos|US|38.75|-90.37|2.80|1.02|0.70|11020|2|618
TUN|Tunis|Tunisia|TN|36.85|10.23|2.80|0.55|1.30|10499|2|22
UIO|Quito|Equador|EC|-0.13|-78.35|2.80|0.62|1.20|13445|2|7841
PAE|Everett|EUA|US|47.91|-122.28|2.79|1.45|1.20|9010|2|606
MHT|Manchester|EUA|US|42.93|-71.44|2.73|1.45|1.20|9250|2|266
NMA|Namangan|Uzbequistao|UZ|40.98|71.56|2.73|0.50|0.80|10698|2|1555
KCM|Kahramanmaras|Turquia|TR|37.54|36.95|2.71|0.65|1.30|7546|2|1723
GYN|Goiania|Brasil|BR|-16.63|-49.22|2.70|0.72|0.60|7500|2|2450
KHH|Kaohsiung|Taiwan|TW|22.58|120.35|2.70|1.00|1.00|10335|2|31
MHD|Mashhad|Ira|IR|36.23|59.64|2.70|0.45|0.80|12877|2|3263
UPG|Macassar|Indonesia|ID|-5.08|119.55|2.70|0.48|0.90|10171|2|47
CNN|Kannur|India|IN|11.92|75.54|2.67|0.52|0.90|10007|2|330
EDL|Eldoret|Quenia|KE|0.40|35.24|2.62|0.45|1.50|11480|2|6941
TCR|Vagaikulam|India|IN|8.72|78.03|2.62|0.52|0.90|4434|2|129
MAO|Manaus|Brasil|BR|-3.04|-60.05|2.60|0.58|1.10|8858|2|264
SAT|San Antonio|Estados Unidos|US|29.53|-98.47|2.60|0.98|1.00|8505|2|809
MKZ|Malacca|Malasia|MY|2.27|102.25|2.59|0.72|1.50|7005|2|35
RPR|Raipur|India|IN|21.18|81.74|2.59|0.52|0.90|6414|2|1041
BEK|Bareilly|India|IN|28.42|79.45|2.58|0.52|0.90|9000|2|580
GZT|Gaziantep|Turquia|TR|36.95|37.48|2.55|0.65|1.30|9842|2|2315
FEZ|Saiss|Marrocos|MA|33.93|-4.98|2.52|0.54|1.65|10499|2|1900
ILR|Ilorin/Ogbomosho|Nigeria|NG|8.44|4.49|2.51|0.47|0.55|10169|2|1126
MJI|Tripoli|Libia|LY|32.89|13.29|2.51|0.40|0.50|11155|2|36
BEL|Belem|Brasil|BR|-1.38|-48.48|2.50|0.55|1.00|9186|2|54
BSR|Basra|Iraque|IQ|30.55|47.66|2.50|0.38|0.50|13124|2|11
DVO|Davao|Filipinas|PH|7.13|125.65|2.50|0.42|0.90|9842|2|96
QRO|Queretaro|Mexico|MX|20.62|-100.19|2.50|0.69|1.30|11483|2|6296
DAM|Damascus|Siria|SY|33.41|36.52|2.49|0.25|0.50|11811|2|2020
AXM|Armenia|Colombia|CO|4.45|-75.77|2.48|0.55|1.10|7045|2|3990
BHO|Bhopal|India|IN|23.29|77.34|2.45|0.52|0.90|9022|2|1711
RKE|Copenhague|Dinamarca|DK|55.59|12.13|2.45|1.40|1.30|5709|2|146
TLN|Hyeres, Var|Franca|FR|43.10|6.15|2.45|1.12|1.35|6955|2|7
EBL|Arbil|Iraque|IQ|36.24|43.95|2.41|0.38|0.50|15748|2|1341
BEY|Beirute|Libano|LB|33.82|35.49|2.40|0.45|1.20|12467|2|87
PIT|Pittsburgh|Estados Unidos|US|40.49|-80.23|2.40|0.98|0.80|11500|2|1203
FBM|Lubumbashi|Congo (Kinshasa)|CD|-11.59|27.53|2.39|0.22|0.50|10623|2|4295
KLH|Kolhapur|India|IN|16.66|74.29|2.39|0.52|0.90|6332|2|1996
DQA|Daqing|China|CN|46.75|125.14|2.37|0.80|1.00|8530|2|496
LFW|Lome|Togo|TG|6.17|1.25|2.36|0.26|0.60|9847|2|72
RJH|Rajshahi|Bangladesh|BD|24.44|88.62|2.36|0.35|0.50|6000|2|64
YYJ|Victoria|Canada|CA|48.65|-123.43|2.36|1.30|1.50|7000|2|63
BRM|Barquisimeto|Venezuela|VE|10.04|-69.36|2.35|0.45|0.70|9350|2|2042
RDP|Durgapur|India|IN|23.62|87.24|2.35|0.52|0.90|9186|2|300
PIE|Tampa|Estados Unidos|US|27.91|-82.69|2.32|1.02|1.30|9730|2|11
SKZ|Sukkur|Paquistao|PK|27.72|68.79|2.32|0.40|0.60|9000|2|196
IPH|Ipoh|Malasia|MY|4.57|101.09|2.31|0.72|1.50|5900|2|130
TOY|Toyama|Japao|JP|36.65|137.19|2.31|1.23|1.50|6562|2|95
COK|Kochi|India|IN|10.15|76.40|2.30|0.48|1.60|11155|2|30
GYD|Baku|Azerbaijao|AZ|40.47|50.05|2.30|0.70|1.00|13123|2|10
OTP|Bucareste|Romenia|RO|44.57|26.10|2.30|0.75|0.90|11484|2|314
JSR|Jashore|Bangladesh|BD|23.18|89.16|2.28|0.35|0.50|8000|2|20
XAI|Xinyang|China|CN|32.54|114.08|2.27|0.80|1.00|8858|2|312
VNS|Varanasi|India|IN|25.45|82.86|2.26|0.52|0.90|9006|2|266
GNB|Lyon|Franca|FR|45.36|5.33|2.24|1.05|1.00|10007|2|1302
MJM|Mbuji Mayi|Congo (Kinshasa)|CD|-6.12|23.57|2.23|0.22|0.50|6558|2|2221
YNZ|Yancheng|China|CN|33.43|120.21|2.21|0.80|1.00|9186|2|10
ALA|Almaty|Cazaquistao|KZ|43.35|77.04|2.20|0.65|0.80|14764|2|2234
BAQ|Barranquilla|Colombia|CO|10.89|-74.78|2.20|0.55|0.80|9842|2|98
CVG|Cincinnati|Estados Unidos|US|39.05|-84.67|2.20|1.00|0.70|12001|2|896
MCI|Kansas City|Estados Unidos|US|39.30|-94.71|2.20|1.02|0.70|10801|2|1026
CXJ|Caxias Do Sul|Brasil|BR|-29.20|-51.19|2.19|0.68|0.85|5479|2|2472
AOR|Alor Satar|Malasia|MY|6.19|100.40|2.17|0.72|1.50|9005|2|15
SAH|Sanaa|Iemen|YE|15.48|44.22|2.17|0.20|0.50|10669|2|7216
HSR|Rajkot|India|IN|22.38|71.04|2.16|0.52|0.90|9974|2|647
ILO|Cabatuan|Filipinas|PH|10.83|122.49|2.16|0.47|1.05|8202|2|27
PNY|Puducherry|India|IN|11.97|79.81|2.16|0.52|0.90|4921|2|134
BNI|Benin|Nigeria|NG|6.32|5.60|2.15|0.47|0.55|7870|2|258
GWL|Gwalior|India|IN|26.29|78.23|2.15|0.52|0.90|9000|2|617
KUF|Samara|Russia|RU|53.50|50.16|2.14|0.71|1.05|9846|2|477
VKG|Rach Gia|Vietna|VN|9.96|105.13|2.14|0.58|1.40|4921|2|7
IWJ|Masuda|Japao|JP|34.68|131.79|2.13|1.23|1.50|6562|2|184
PDK|Atlanta|EUA|US|33.88|-84.30|2.11|1.25|0.90|6001|2|1003
BBI|Bhubaneswar|India|IN|20.25|85.81|2.10|0.52|0.90|9003|2|138
CLE|Cleveland|Estados Unidos|US|41.41|-81.85|2.10|0.95|0.70|9953|2|791
HAV|Havana|Cuba|CU|22.99|-82.41|2.10|0.40|1.70|13123|2|210
IND|Indianapolis|Estados Unidos|US|39.72|-86.29|2.10|1.00|0.70|11200|2|797
ISK|Nashik|India|IN|20.12|73.91|2.10|0.52|0.90|9843|2|1900
JMU|Jiamusi|China|CN|46.84|130.46|2.10|0.80|1.00|8202|2|262
BHV|Bahawalpur|Paquistao|PK|29.35|71.72|2.09|0.40|0.60|9345|2|392
MSQ|Minsk|Belarus|BY|53.89|28.04|2.08|0.55|0.70|12139|2|670
SHS|Jingzhou|China|CN|30.29|112.45|2.08|0.80|1.00|8530|2|95
COO|Cotonou|Benim|BJ|6.36|2.38|2.07|0.28|0.60|7906|2|19
SVX|Yekaterinburg|Russia|RU|56.74|60.80|2.07|0.71|1.05|9925|2|764
TRZ|Tiruchirappalli|India|IN|10.76|78.72|2.06|0.52|0.90|6115|2|288
STI|Santiago|Republica Dominicana|DO|19.40|-70.60|2.04|0.49|1.80|8595|2|565
YIA|Yogyakarta|Indonesia|ID|-7.91|110.06|2.04|0.50|0.90|10663|2|24
NCL|Newcastle upon Tyne, Tyne|Reino Unido|GB|55.04|-1.69|2.01|1.05|1.10|7644|2|266
CRK|Clark|Filipinas|PH|15.19|120.56|2.00|0.45|0.90|10499|2|484
VIX|Vitoria|Brasil|BR|-20.26|-40.28|2.00|0.78|0.80|6752|2|34
CGY|Laguindingan|Filipinas|PH|8.61|124.46|1.99|0.47|1.05|6890|2|190
DHX|Kediri|Indonesia|ID|-7.75|111.95|1.98|0.50|0.90|10827|2|380
BLD|Las Vegas|EUA|US|35.95|-114.86|1.97|1.10|2.20|5103|2|2201
FUG|Yingzhou, Fuyang|China|CN|32.88|115.73|1.97|0.80|1.00|7874|2|104
DIY|Diyarbakir|Turquia|TR|37.89|40.20|1.96|0.65|1.30|11644|2|2251
LYA|Luoyang|China|CN|34.74|112.39|1.96|0.80|1.00|8202|2|840
ENU|Enegu|Nigeria|NG|6.47|7.56|1.94|0.47|0.55|7879|2|466
SXR|Srinagar|India|IN|33.99|74.77|1.94|0.52|0.90|12090|2|5429
GRO|Girona|Espanha|ES|41.90|2.76|1.93|0.85|1.90|7874|2|468
TNG|Tangier|Marrocos|MA|35.73|-5.92|1.93|0.54|1.65|11483|2|62
SWF|Newburgh|EUA|US|41.50|-74.11|1.92|1.40|1.50|11817|2|491
YIH|Yichang|China|CN|30.55|111.48|1.92|0.80|1.00|10499|2|673
MMJ|Matsumoto|Japao|JP|36.17|137.92|1.91|1.23|1.50|6560|2|2182
RMU|Corvera|Espanha|ES|37.80|-1.12|1.91|0.85|1.90|9842|2|644
IXU|Aurangabad|India|IN|19.86|75.40|1.90|0.52|0.90|9314|2|1911
LPB|La Paz|Bolivia|BO|-16.51|-68.19|1.90|0.42|1.30|13123|2|13355
MRS|Marselha|Franca|FR|43.44|5.21|1.90|0.98|1.30|11483|2|74
MVD|Montevideu|Uruguai|UY|-34.84|-56.03|1.90|0.85|1.10|10499|2|105
MDL|Mandalay|Mianmar|MM|21.70|95.98|1.89|0.30|0.70|14003|2|300
HBX|Hubballi|India|IN|15.36|75.08|1.88|0.52|0.90|5479|2|2171
KWL|Guilin|China|CN|25.22|110.04|1.87|0.80|1.00|10499|2|570
OVB|Novosibirsk|Russia|RU|55.02|82.62|1.87|0.71|1.05|11818|2|365
GOJ|Nizhny Novgorod|Russia|RU|56.23|43.79|1.86|0.71|1.05|9843|2|256
MBA|Mombasa|Quenia|KE|-4.03|39.59|1.86|0.45|1.50|10991|2|200
PSA|Pisa|Italia|IT|43.68|10.39|1.86|1.00|1.40|9820|2|6
NJF|Najaf|Iraque|IQ|31.99|44.41|1.84|0.38|0.50|9842|2|103
PLM|Palembang|Indonesia|ID|-2.90|104.70|1.84|0.50|0.90|8202|2|49
BOH|Bournemouth|Reino Unido|GB|50.78|-1.84|1.83|1.05|1.10|7454|2|38
NLA|Ndola|Zambia|ZM|-12.97|28.52|1.83|0.32|0.80|11483|2|4308
RJA|Madhurapudi|India|IN|17.11|81.81|1.82|0.52|0.90|10384|2|151
ORN|Es-Senia|Argelia|DZ|35.62|-0.62|1.81|0.60|0.70|11811|2|295
TBZ|Tabriz|Ira|IR|38.13|46.24|1.81|0.45|0.80|11825|2|4459
GES|General Santos|Filipinas|PH|6.06|125.10|1.80|0.47|1.05|10587|2|505
GLA|Glasgow|Reino Unido|GB|55.87|-4.43|1.80|0.92|0.90|8730|2|26
ORF|Norfolk|EUA|US|36.90|-76.20|1.80|1.10|1.10|9001|2|26
PEN|Penang|Malasia|MY|5.30|100.28|1.80|0.72|1.50|10997|2|11
SAL|San Salvador|El Salvador|SV|13.44|-89.06|1.80|0.45|0.90|10500|2|101
SHJ|Sharjah|Emirados Arabes Unidos|AE|25.33|55.52|1.80|0.95|0.90|13320|2|111
SPD|Saidpur|Bangladesh|BD|25.76|88.91|1.78|0.35|0.50|6000|2|125
LXR|Luxor|Egito|EG|25.67|32.71|1.77|0.45|2.00|9843|2|276
PVU|Provo|Estados Unidos|US|40.22|-111.72|1.77|1.08|1.00|8603|2|4497
BZL|Barisal|Bangladesh|BD|22.80|90.30|1.76|0.35|0.50|5995|2|23
RLK|Bayannur|China|CN|40.93|107.74|1.76|0.80|1.00|8530|2|3400
WNS|Nawabashah|Paquistao|PK|26.22|68.39|1.76|0.40|0.60|8999|2|95
DED|Dehradun|India|IN|30.19|78.18|1.75|0.52|0.90|7000|2|1831
LEJ|Schkeuditz|Alemanha|DE|51.42|12.23|1.75|1.15|1.00|11811|2|465
MXZ|Meizhou|China|CN|24.26|116.10|1.75|0.80|1.00|7874|2|312
TAI|Taiz|Iemen|YE|13.69|44.14|1.75|0.20|0.50|10040|2|4838
NBE|Enfidha|Tunisia|TN|36.08|10.44|1.74|0.55|1.30|10827|2|21
UET|Quetta|Paquistao|PK|30.25|66.94|1.73|0.40|0.60|12001|2|5267
BRE|Bremen|Alemanha|DE|53.05|8.79|1.72|1.15|1.00|8642|2|14
ROB|Monrovia|Liberia|LR|6.23|-10.36|1.71|0.22|0.50|11000|2|31
AGA|Agadir|Marrocos|MA|30.32|-9.41|1.70|0.54|1.65|10499|2|250
BEG|Belgrado|Servia|RS|44.82|20.31|1.70|0.65|1.00|11483|2|335
BLA|Barcelona|Venezuela|VE|10.11|-64.69|1.70|0.45|0.70|9842|2|30
SFB|Orlando|EUA|US|28.77|-81.23|1.70|1.05|2.20|11002|2|55
TRV|Trivandrum|India|IN|8.48|76.92|1.70|0.45|1.30|11148|2|15
VII|Vinh|Vietna|VN|18.74|105.67|1.70|0.58|1.40|7875|2|23
BAR|Qionghai|China|CN|19.14|110.45|1.68|0.80|1.00|10499|2|30
FKB|Rheinmunster|Alemanha|DE|48.78|8.08|1.68|1.15|1.00|9787|2|408
ATZ|Asyut|Egito|EG|27.05|31.01|1.67|0.45|2.00|9905|2|748
IXR|Ranchi|India|IN|23.31|85.32|1.64|0.52|0.90|8855|2|2148
CJS|Ciudad Juarez|Mexico|MX|31.64|-106.43|1.63|0.69|1.30|8858|2|3904
HUY|Grimsby, Lincolnshire|Reino Unido|GB|53.58|-0.35|1.63|1.05|1.10|7218|2|121
PRN|Prishtina|Kosovo|XK|42.57|21.04|1.63|0.48|0.80|9974|2|1789
CAU|Caruaru|Brasil|BR|-8.28|-36.01|1.62|0.68|0.85|5906|2|1891
OST|Oostende|Belgica|BE|51.20|2.87|1.62|1.30|1.10|10499|2|13
COR|Cordoba|Argentina|AR|-31.31|-64.21|1.60|0.62|0.90|10499|2|1604
FKI|Kisangani|Congo (Kinshasa)|CD|0.48|25.34|1.60|0.22|0.50|11483|2|1417
LIL|Lesquin|Franca|FR|50.57|3.10|1.60|1.12|1.35|9268|2|157
MKE|Milwaukee|Estados Unidos|US|42.95|-87.90|1.60|0.98|0.70|9990|2|723
NAT|Natal|Brasil|BR|-5.77|-35.37|1.60|0.58|1.60|9843|2|273
SYZ|Shiraz|Ira|IR|29.54|52.59|1.60|0.45|0.80|14345|2|4927
VLC|Valencia|Espanha|ES|39.49|-0.48|1.60|0.85|1.40|8858|2|240
BRI|Bari|Italia|IT|41.14|16.76|1.59|1.00|1.40|9843|2|193
MYQ|Mysore|India|IN|12.23|76.65|1.59|0.52|0.90|5709|2|2349
USA|Charlotte|EUA|US|35.39|-80.71|1.59|1.20|0.80|7402|2|705
ASR|Kayseri|Turquia|TR|38.77|35.50|1.58|0.65|1.30|9841|2|3463
LTK|Latakia|Siria|SY|35.40|35.95|1.56|0.25|0.50|9175|2|157
LXA|Shannan|China|CN|29.30|90.91|1.56|0.80|1.00|13123|2|11713
DRS|Dresden|Alemanha|DE|51.13|13.77|1.55|1.15|1.00|9350|2|755
JBB|Jember|Indonesia|ID|-8.24|113.69|1.55|0.50|0.90|5594|2|281
GAY|Gaya|India|IN|24.74|84.95|1.53|0.52|0.90|7500|2|380
TNJ|Tanjung Pinang-Bintan|Indonesia|ID|0.92|104.53|1.53|0.50|0.90|7380|2|52
KYA|Konya|Turquia|TR|37.98|32.56|1.52|0.65|1.30|10990|2|3392
RER|Retalhuleu|Guatemala|GT|14.52|-91.70|1.51|0.45|1.00|5065|2|656
BAH|Manama|Bahrein|BH|26.27|50.64|1.50|1.15|0.90|12979|2|6
ONX|Colon|Panama|PA|9.36|-79.87|1.50|0.80|1.20|8858|2|25
PAC|Cidade do Panama|Panama|PA|8.97|-79.56|1.50|0.80|1.20|5906|2|31
RDU|Raleigh|Estados Unidos|US|35.88|-78.79|1.50|1.10|0.80|10000|2|435
SOF|Sofia|Bulgaria|BG|42.70|23.42|1.50|0.70|1.00|11811|2|1742
SVQ|Sevilha|Espanha|ES|37.42|-5.89|1.50|0.80|1.50|11030|2|112
CZL|Constantine|Argelia|DZ|36.28|6.62|1.49|0.60|0.70|9843|2|2265
NSI|Yaounde|Camaroes|CM|3.72|11.55|1.48|0.30|0.60|11155|2|2278
BGF|Bangui|Republica Centro-Africana|CF|4.40|18.52|1.47|0.20|0.50|8530|2|1208
GAU|Guwahati|India|IN|26.11|91.59|1.46|0.52|0.90|9000|2|162
JDH|Jodhpur|India|IN|26.25|73.05|1.46|0.52|0.90|9005|2|717
NDC|Nanded|India|IN|19.18|77.32|1.46|0.52|0.90|7546|2|1250
RAO|Ribeirao Preto|Brasil|BR|-21.13|-47.77|1.46|0.68|0.85|6890|2|1805
TIR|Tirupati|India|IN|13.63|79.54|1.46|0.52|0.90|12500|2|350
AVR|Amravati|India|IN|20.81|77.72|1.44|0.52|0.90|6070|2|1125
JOI|Joinville|Brasil|BR|-26.22|-48.80|1.44|0.68|0.85|5381|2|15
KZN|Kazan|Russia|RU|55.61|49.28|1.44|0.71|1.05|12303|2|411
TKG|Bandar Lampung|Indonesia|ID|-5.25|105.18|1.44|0.50|0.90|9088|2|282
CBB|Cochabamba|Bolivia|BO|-17.42|-66.18|1.43|0.46|1.05|12460|2|8360
CMH|Columbus|EUA|US|40.00|-82.89|1.43|1.10|1.10|10114|2|815
JIU|Jiujiang|China|CN|29.48|115.80|1.43|0.80|1.00|9186|2|135
JXA|Jixi|China|CN|45.29|131.19|1.43|0.80|1.00|7546|2|760
MWZ|Mwanza|Tanzania|TZ|-2.45|32.94|1.43|0.32|1.45|10212|2|3763
NDJ|N'Djamena|Chade|TD|12.13|15.03|1.43|0.20|0.50|9186|2|968
RSU|Yeosu|Coreia do Sul|KR|34.84|127.62|1.43|1.12|1.30|6890|2|53
AQG|Anqing|China|CN|30.58|117.05|1.42|0.80|1.00|9186|2|46
CBT|Catumbela|Angola|AO|-12.48|13.49|1.42|0.38|0.60|12139|2|23
AWA|Hawassa|Etiopia|ET|7.10|38.40|1.41|0.35|0.80|9843|2|5450
KCZ|Nankoku|Japao|JP|33.55|133.67|1.41|1.23|1.50|8203|2|42
NIM|Niamey|Niger|NE|13.48|2.18|1.41|0.20|0.50|9843|2|732
SKP|Ilinden|Macedonia do Norte|MK|41.96|21.62|1.41|0.55|0.90|9678|2|781
VOG|Volgograd|Russia|RU|48.78|44.34|1.41|0.71|1.05|9186|2|482
ADL|Adelaide|Australia|AU|-34.95|138.53|1.40|1.25|0.90|10171|2|20
OKA|Okinawa|Japao|JP|26.19|127.64|1.40|1.00|1.90|9840|2|12
TLS|Toulouse|Franca|FR|43.63|1.36|1.40|1.02|0.90|11483|2|499
YEG|Edmonton|Canada|CA|53.31|-113.58|1.40|1.02|0.70|11000|2|2373
YOW|Ottawa|Canada|CA|45.32|-75.67|1.40|1.05|0.90|10000|2|374
GOP|Gorakhpur|India|IN|26.74|83.45|1.39|0.52|0.90|9000|2|259
KRR|Krasnodar|Russia|RU|45.03|39.17|1.39|0.71|1.05|9835|2|118
BHY|Beihai|China|CN|21.54|109.29|1.37|0.80|1.00|10499|2|75
HNA|Hanamaki|Japao|JP|39.43|141.13|1.37|1.23|1.50|8202|2|297
PLZ|Gqeberha|Africa do Sul|ZA|-33.99|25.62|1.37|0.65|1.20|7087|2|226
IBE|Ibague|Colombia|CO|4.42|-75.13|1.36|0.55|1.10|5905|2|2999
IXD|Allahabad|India|IN|25.44|81.73|1.36|0.52|0.90|8110|2|322
TSF|Veneza|Italia|IT|45.65|12.19|1.36|1.00|2.20|7941|2|59
DBR|Darbhanga|India|IN|26.19|85.92|1.35|0.52|0.90|9000|2|156
JLG|Jalgaon|India|IN|20.96|75.63|1.35|0.52|0.90|5577|2|818
LCJ|Lodz|Polonia|PL|51.72|19.40|1.35|0.81|1.10|8202|2|604
NKC|Nouakchott|Mauritania|MR|18.31|-15.97|1.35|0.30|0.60|11155|2|9
CEK|Chelyabinsk|Russia|RU|55.30|61.50|1.34|0.71|1.05|10499|2|769
QRW|Okpe|Nigeria|NG|5.60|5.82|1.33|0.47|0.55|6868|2|242
HSS|Hisar|India|IN|29.19|75.74|1.31|0.52|0.90|10236|2|700
MXL|Mexicali|Mexico|MX|32.63|-115.24|1.31|0.69|1.30|8530|2|74
NDG|Qiqihar|China|CN|47.23|123.91|1.31|0.80|1.00|11811|2|477
YLX|Yulin|China|CN|22.43|110.12|1.31|0.80|1.00|8530|2|328
FLN|Florianopolis|Brasil|BR|-27.67|-48.55|1.30|0.85|1.80|7874|2|16
KGL|Kigali|Ruanda|RW|-1.97|30.14|1.30|0.32|1.00|11483|2|4859
MCZ|Maceio|Brasil|BR|-9.51|-35.79|1.30|0.55|1.60|8537|2|387
MEM|Memphis|Estados Unidos|US|35.04|-89.98|1.30|0.92|0.80|11120|2|341
MID|Merida|Mexico|MX|20.93|-89.65|1.30|0.60|1.20|10499|2|38
NQZ|Astana|Cazaquistao|KZ|51.03|71.47|1.30|0.68|0.70|11484|2|1165
XRY|Jerez de la Frontera|Espanha|ES|36.74|-6.06|1.30|0.85|1.90|7546|2|93
YQB|Quebec|Canada|CA|46.79|-71.39|1.30|1.10|0.95|9000|2|244
BGA|Bucaramanga|Colombia|CO|7.13|-73.18|1.29|0.55|1.10|7381|2|3897
JIB|Djibouti City|Djibuti|DJ|11.55|43.16|1.29|0.38|0.70|10335|2|49
KGA|Kananga|Congo (Kinshasa)|CD|-5.90|22.47|1.29|0.22|0.50|7218|2|2139
KSF|Calden|Alemanha|DE|51.42|9.39|1.29|1.15|1.00|8202|2|820
PDG|Padang|Indonesia|ID|-0.79|100.28|1.29|0.50|0.90|9843|2|18
CFB|Cabo Frio|Brasil|BR|-22.92|-42.07|1.28|0.68|0.85|8366|2|22
CIT|Shymkent|Cazaquistao|KZ|42.37|69.48|1.28|0.67|0.75|9186|2|1385
FMM|Memmingen|Alemanha|DE|47.99|10.24|1.28|1.15|1.00|8629|2|2077
MGF|Maringa|Brasil|BR|-23.48|-52.02|1.28|0.68|0.85|7783|2|1801
NUE|Nuremberg|Alemanha|DE|49.50|11.08|1.28|1.15|1.00|8858|2|1046
ROS|Rosario|Argentina|AR|-32.90|-60.78|1.28|0.60|1.50|9842|2|85
AAP|Samarinda|Indonesia|ID|-0.37|117.25|1.27|0.50|0.90|7382|2|82
BPE|Qinhuangdao|China|CN|39.67|119.06|1.27|0.80|1.00|8530|2|46
JAX|Jacksonville|EUA|US|30.49|-81.69|1.27|1.10|1.10|10000|2|30
KJA|Krasnoyarsk|Russia|RU|56.18|92.49|1.27|0.71|1.05|12139|2|942
HTY|Antakya|Turquia|TR|36.36|36.29|1.26|0.65|1.30|6830|2|269
PSP|Palm Springs|EUA|US|33.83|-116.51|1.26|1.10|1.10|10000|2|477
JLR|Jabalpur|India|IN|23.18|80.05|1.25|0.52|0.90|6522|2|1624
KIK|Kirkuk|Iraque|IQ|35.47|44.35|1.25|0.38|0.50|9809|2|1061
RYK|Rahim Yar Khan|Paquistao|PK|28.38|70.28|1.25|0.40|0.60|9842|2|271
SQD|Shangrao|China|CN|28.38|117.96|1.25|0.80|1.00|7874|2|340
AOE|Eskisehir|Turquia|TR|39.81|30.52|1.24|0.65|1.30|8261|2|2588
PIU|Piura|Peru|PE|-5.21|-80.62|1.24|0.52|1.50|8202|2|120
TRC|Torreon|Mexico|MX|25.56|-103.40|1.24|0.69|1.30|9039|2|3688
HOG|Holguin|Cuba|CU|20.79|-76.32|1.23|0.40|1.70|10624|2|361
KNH|Shang-I|Taiwan|TW|24.43|118.36|1.23|1.07|1.15|9843|2|93
PKU|Pekanbaru|Indonesia|ID|0.46|101.44|1.22|0.50|0.90|7360|2|102
THD|Thanh Hoa|Vietna|VN|19.90|105.47|1.22|0.58|1.40|10499|2|59
BJL|Banjul|Gambia|GM|13.34|-16.65|1.21|0.26|1.30|11811|2|95
CIH|Changzhi|China|CN|36.25|113.13|1.21|0.80|1.00|8530|2|3018
GBI|Kalaburagi|India|IN|17.31|76.97|1.21|0.52|0.90|10417|2|1571
HMB|Suhaj|Egito|EG|26.34|31.74|1.21|0.45|2.00|9843|2|322
IXK|Keshod|India|IN|21.32|70.27|1.21|0.52|0.90|4500|2|167
JOS|Jos|Nigeria|NG|9.64|8.87|1.21|0.47|0.55|9845|2|4232
OSR|Mosnov|Chequia|CZ|49.70|18.11|1.21|0.95|1.70|11484|2|844
TRU|Trujillo|Peru|PE|-8.08|-79.11|1.21|0.52|1.50|9920|2|106
BXU|Butuan|Filipinas|PH|8.95|125.48|1.20|0.47|1.05|6877|2|141
CNX|Chiang Mai|Tailandia|TH|18.77|98.96|1.20|0.52|1.90|11155|2|1036
JGA|Jamnagar|India|IN|22.47|70.01|1.20|0.52|0.90|8242|2|69
JPA|Joao Pessoa|Brasil|BR|-7.15|-34.95|1.20|0.62|1.20|8251|2|217
KIN|Kingston|Jamaica|JM|17.94|-76.79|1.20|0.45|1.20|8900|2|10
KMI|Miyazaki|Japao|JP|31.88|131.45|1.20|1.23|1.50|8200|2|20
MDZ|Mendoza|Argentina|AR|-32.83|-68.79|1.20|0.60|1.30|9301|2|2310
TBS|Tiblisi|Georgia|GE|41.67|44.95|1.20|0.55|1.30|9843|2|1624
UFA|Ufa|Russia|RU|54.56|55.87|1.20|0.71|1.05|12339|2|449
DLU|Dali|China|CN|25.65|100.32|1.19|0.80|1.00|8202|2|7050
ELQ|Qassim|Arabia Saudita|SA|26.30|43.77|1.19|0.97|1.10|9843|2|2126
HTN|Hotan|China|CN|37.04|79.86|1.19|0.80|1.00|10499|2|4672
MBI|Mbeya|Tanzania|TZ|-8.92|33.27|1.19|0.32|1.45|10925|2|4412
MLM|Morelia|Mexico|MX|19.85|-101.03|1.19|0.69|1.30|11155|2|6033
NTQ|Wajima|Japao|JP|37.29|136.96|1.19|1.23|1.50|6562|2|718
AQA|Araraquara|Brasil|BR|-21.81|-48.13|1.18|0.68|0.85|5907|2|2334
CXR|Nha Trang/nha Trang|Vietna|VN|12.00|109.22|1.18|0.58|1.40|10000|2|40
GNY|Sanliurfa|Turquia|TR|37.45|38.90|1.18|0.65|1.30|13123|2|2708
IXE|Mangaluru|India|IN|12.95|74.89|1.18|0.52|0.90|8035|2|337
RAS|Rasht|Ira|IR|37.32|49.62|1.18|0.45|0.80|9571|2|-40
SYX|Sanya|China|CN|18.30|109.41|1.18|0.80|1.00|11155|2|92
ZAM|Zamboanga|Filipinas|PH|6.92|122.06|1.18|0.47|1.05|8560|2|33
AKA|Ankang|China|CN|32.76|108.87|1.17|0.80|1.00|8530|2|1209
DEA|Dera Ghazi Khan|Paquistao|PK|29.96|70.49|1.17|0.40|0.60|6499|2|492
IXB|Siliguri|India|IN|26.68|88.33|1.17|0.52|0.90|9035|2|412
OKC|Oklahoma City|EUA|US|35.39|-97.60|1.17|1.10|1.10|9802|2|1295
OMS|Omsk|Russia|RU|54.96|73.31|1.17|0.71|1.05|8202|2|311
SYQ|San Jose|Costa Rica|CR|9.96|-84.14|1.17|0.62|1.90|5138|2|3287
TKD|Sekondi-Takoradi|Gana|GH|4.90|-1.77|1.17|0.45|0.80|5745|2|21
VOZ|Voronezh|Russia|RU|51.81|39.23|1.17|0.71|1.05|7546|2|514
ZHY|Zhongwei|China|CN|37.57|105.15|1.17|0.80|1.00|9186|2|4088
ASB|Ashgabat|Turcomenistao|TM|37.99|58.36|1.15|0.45|0.60|12467|2|692
CBQ|Calabar|Nigeria|NG|4.98|8.35|1.15|0.47|0.55|8040|2|210
CUC|Cucuta|Colombia|CO|7.93|-72.51|1.15|0.55|1.10|7700|2|1096
BFJ|Bijie|China|CN|27.27|105.47|1.14|0.80|1.00|8530|2|4751
LLW|Lumbadzi|Malaui|MW|-13.79|33.78|1.14|0.20|0.80|11614|2|4035
KQH|Ajmer|India|IN|26.59|74.81|1.13|0.52|0.90|7060|2|1457
LTU|Latur|India|IN|18.41|76.46|1.13|0.52|0.90|7546|2|2136
MIU|Maiduguri|Nigeria|NG|11.85|13.08|1.13|0.47|0.55|9846|2|1099
ADE|Aden|Iemen|YE|12.83|45.03|1.12|0.20|0.50|10171|2|7
BDJ|Banjarbaru|Indonesia|ID|-3.44|114.76|1.12|0.50|0.90|8202|2|66
DDG|Dandong|China|CN|40.03|124.29|1.12|0.80|1.00|8530|2|30
MWL|Mineral Wells|EUA|US|32.78|-98.06|1.12|1.30|0.90|5996|2|974
SCN|Saarbrucken|Alemanha|DE|49.21|7.11|1.12|1.15|1.00|6562|2|1058
SHM|Shirahama|Japao|JP|33.66|135.36|1.12|1.23|1.50|6560|2|298
SJJ|Sarajevo|Bosnia e Herzegovina|BA|43.82|18.33|1.12|0.60|1.00|8666|2|1708
AGU|Aguascalientes|Mexico|MX|21.70|-102.32|1.11|0.69|1.30|9843|2|6112
GSV|Saratov|Russia|RU|51.71|46.17|1.11|0.71|1.05|9843|2|103
SNU|Santa Clara|Cuba|CU|22.49|-79.94|1.11|0.40|1.70|9898|2|338
WEH|Weihai|China|CN|37.19|122.23|1.11|0.80|1.00|8530|2|145
BGY|Bergamo|Italia|IT|45.67|9.71|1.10|1.00|0.90|9429|2|782
CGB|Cuiaba|Brasil|BR|-15.65|-56.12|1.10|0.70|0.70|7546|2|617
CPV|Campina Grande|Brasil|BR|-7.27|-35.90|1.10|0.68|0.85|5135|2|1646
CTA|Catania|Italia|IT|37.47|15.07|1.10|0.75|1.40|7989|2|39
CTG|Cartagena|Colombia|CO|10.44|-75.51|1.10|0.55|1.90|8530|2|4
DRP|Legazpi|Filipinas|PH|13.11|123.68|1.10|0.47|1.05|8202|2|319
ELP|El Paso|EUA|US|31.81|-106.38|1.10|1.10|1.10|12020|2|3959
EVN|Erevan|Armenia|AM|40.15|44.40|1.10|0.50|1.10|12631|2|2838
GDN|Gdansk|Polonia|PL|54.38|18.47|1.10|0.80|1.20|9186|2|489
HHN|Frankfurt am Main|Alemanha|DE|49.95|7.26|1.10|1.15|1.00|12467|2|1649
SKG|Tessalonica|Grecia|GR|40.52|22.97|1.10|0.78|1.40|11286|2|22
THE|Teresina|Brasil|BR|-5.06|-42.82|1.10|0.58|0.60|7218|2|219
ZAG|Zagreb|Croacia|HR|45.74|16.07|1.10|0.78|1.00|10669|2|353
PEE|Perm|Russia|RU|57.91|56.02|1.09|0.71|1.05|10520|2|404
PZO|Guyana City|Venezuela|VE|8.29|-62.76|1.09|0.45|0.70|6726|2|472
KBR|Kota Baharu|Malasia|MY|6.17|102.29|1.08|0.72|1.50|7874|2|16
NOV|Huambo|Angola|AO|-12.81|15.76|1.08|0.38|0.60|8727|2|5587
NYT|Naypyitaw|Mianmar|MM|19.62|96.20|1.08|0.30|0.70|12000|2|302
STD|Santo Domingo|Venezuela|VE|7.57|-72.04|1.08|0.45|0.70|9990|2|1083
BJM|Bujumbura|Burundi|BI|-3.32|29.32|1.07|0.20|0.50|11811|2|2582
IXJ|Jammu|India|IN|32.69|74.84|1.07|0.52|0.90|6700|2|996
RMO|Chisinau|Moldavia|MD|46.93|28.93|1.07|0.42|0.80|11778|2|399
SCU|Santiago|Cuba|CU|19.97|-75.84|1.07|0.40|1.70|13130|2|249
ZQZ|Zhangjiakou|China|CN|40.74|114.93|1.07|0.80|1.00|8202|2|2347
AWZ|Ahvaz|Ira|IR|31.34|48.76|1.06|0.45|0.80|11149|2|66
BLZ|Blantyre|Malaui|MW|-15.68|34.97|1.06|0.20|0.80|7628|2|2555
IAR|Tunoshna|Russia|RU|57.56|40.16|1.06|0.71|1.05|9870|2|287
IXG|Belgaum|India|IN|15.86|74.62|1.06|0.52|0.90|7546|2|2487
NOZ|Novokuznetsk|Russia|RU|53.81|86.88|1.06|0.71|1.05|8789|2|1024
PNR|Pointe Noire|Congo (Brazzaville)|CG|-4.82|11.89|1.06|0.32|0.60|8530|2|55
SKO|Sokoto|Nigeria|NG|12.92|5.21|1.06|0.47|0.55|9844|2|1010
BSZ|Bishkek|Quirguistao|KG|43.06|74.48|1.05|0.32|0.90|13780|2|2058
FAT|Fresno|EUA|US|36.78|-119.72|1.05|1.10|1.10|9539|2|336
LBV|Libreville|Gabao|GA|0.46|9.41|1.05|0.45|0.70|9844|2|39
SLP|San Luis Potosi|Mexico|MX|22.26|-100.94|1.05|0.69|1.30|9867|2|6035
CSY|Cheboksary|Russia|RU|56.09|47.35|1.04|0.71|1.05|8241|2|558
HSN|Zhoushan|China|CN|29.93|122.36|1.04|0.80|1.00|8202|2|6
ISU|Sulaymaniyah|Iraque|IQ|35.56|45.32|1.04|0.38|0.50|11481|2|2494
IZA|Juiz de Fora|Brasil|BR|-21.51|-43.17|1.04|0.68|0.85|8284|2|1348
PHH|Pokhara|Nepal|NP|28.18|84.01|1.04|0.35|1.90|8202|2|2595
AAE|Annaba|Argelia|DZ|36.83|7.81|1.03|0.60|0.70|9843|2|16
BRQ|Brno|Chequia|CZ|49.15|16.69|1.03|0.95|1.70|8694|2|778
CCP|Concepcion|Chile|CL|-36.77|-73.06|1.03|0.70|1.30|8530|2|26
LFQ|Linfen|China|CN|36.13|111.64|1.03|0.80|1.00|8530|2|1483
CDP|Kadapa|India|IN|14.51|78.77|1.02|0.52|0.90|6562|2|430
ELS|East London|Africa do Sul|ZA|-33.04|27.83|1.02|0.65|1.20|6362|2|435
LUM|Dehong|China|CN|24.40|98.53|1.02|0.80|1.00|7218|2|2890
SLE|Salem|EUA|US|44.91|-123.00|1.02|1.10|1.10|5811|2|214
SRY|Sari|Ira|IR|36.64|53.19|1.02|0.45|0.80|8688|2|35
TAC|Tacloban City|Filipinas|PH|11.23|125.03|1.02|0.47|1.05|7014|2|10
TGZ|Tuxtla Gutierrez|Mexico|MX|16.56|-93.03|1.02|0.69|1.30|8202|2|1499
CAH|Ca Mau City|Vietna|VN|9.18|105.18|1.01|0.58|1.40|4921|2|6
EXT|Exeter, Devon|Reino Unido|GB|50.73|-3.41|1.01|1.05|1.10|6811|2|102
AGP|Malaga|Espanha|ES|36.67|-4.50|1.00|0.95|2.00|10500|2|53
AJU|Aracaju|Brasil|BR|-10.98|-37.07|1.00|0.60|1.10|7218|2|23
AOJ|Aomori|Japao|JP|40.73|140.69|1.00|1.23|1.50|9846|2|664
BIO|Bilbao|Espanha|ES|43.30|-2.91|1.00|0.92|1.10|8530|2|138
BLQ|Bolonha|Italia|IT|44.54|11.29|1.00|1.05|1.10|9196|2|123
CXP|Cilacap|Indonesia|ID|-7.65|109.03|1.00|0.50|0.90|4593|2|69
GOT|Gotemburgo|Suecia|SE|57.66|12.28|1.00|1.10|0.80|10823|2|506
KRK|Cracovia|Polonia|PL|50.08|19.78|1.00|0.82|1.60|8366|2|791
NCE|Nice|Franca|FR|43.66|7.22|1.00|1.20|2.00|9721|2|12
PMO|Palermo|Italia|IT|38.18|13.09|1.00|0.72|1.40|10912|2|65
RAK|Marraquexe|Marrocos|MA|31.60|-8.04|1.00|0.48|2.00|10170|2|1545
UIH|Quy Nohn|Vietna|VN|13.96|109.04|1.00|0.58|1.40|10010|2|80
VIG|El Vigia|Venezuela|VE|8.62|-71.67|1.00|0.45|0.70|10645|2|250
BYK|Bouake|Costa do Marfim|CI|7.74|-5.07|0.99|0.35|0.80|10827|2|1230
HRL|Harlingen|EUA|US|26.23|-97.65|0.99|1.10|1.10|9400|2|36
JJG|Jaguaruna|Brasil|BR|-28.68|-49.06|0.99|0.68|0.85|8199|2|120
PMV|Isla Margarita|Venezuela|VE|10.91|-63.97|0.99|0.45|0.70|10433|2|74
BZG|Bydgoszcz|Polonia|PL|53.10|17.98|0.98|0.81|1.10|8202|2|235
JTC|Bauru|Brasil|BR|-22.16|-49.07|0.98|0.68|0.85|6594|2|1962
SDF|Louisville|EUA|US|38.17|-85.74|0.98|1.10|1.10|11887|2|501
WUZ|Tangbu|China|CN|23.40|111.09|0.98|0.80|1.00|8202|2|357
BJA|Bejaia|Argelia|DZ|36.71|5.07|0.97|0.60|0.70|7874|2|20
CUU|Chihuahua|Mexico|MX|28.70|-105.96|0.97|0.69|1.30|8530|2|4462
KJB|Orvakal|India|IN|15.72|78.17|0.97|0.52|0.90|6562|2|920
MSY|New Orleans|EUA|US|29.99|-90.26|0.97|1.10|1.10|10104|2|4
POZ|Poznan|Polonia|PL|52.42|16.82|0.97|0.81|1.10|8215|2|308
ERF|Erfurt|Alemanha|DE|50.98|10.96|0.96|1.15|1.00|8530|2|1036
GRQ|Groningen|Holanda|NL|53.12|6.58|0.96|1.25|1.25|8202|2|17
MNU|Mawlamyine|Mianmar|MM|16.44|97.66|0.96|0.30|0.70|5260|2|52
SZH|Shuozhou|China|CN|39.27|112.69|0.96|0.80|1.00|8530|2|3428
ZAZ|Zaragoza|Espanha|ES|41.67|-1.04|0.96|0.85|1.90|12198|2|863
BFN|Bloemfontein|Africa do Sul|ZA|-29.09|26.30|0.95|0.65|1.20|8396|2|4457
BOY|Bobo Dioulasso|Burquina Faso|BF|11.16|-4.33|0.95|0.26|0.60|10826|2|1511
CAP|Cap Haitien|Haiti|HT|19.73|-72.20|0.95|0.22|0.60|8701|2|10
IJK|Izhevsk|Russia|RU|56.83|53.46|0.95|0.71|1.05|8202|2|531
UPN|Uruapan|Mexico|MX|19.40|-102.04|0.95|0.69|1.30|7874|2|5258
VVO|Artyom|Russia|RU|43.40|132.15|0.95|0.71|1.05|11483|2|59
GOA|Genova|Italia|IT|44.41|8.84|0.94|1.00|1.40|9564|2|13
JDO|Juazeiro do Norte|Brasil|BR|-7.22|-39.27|0.94|0.68|0.85|6365|2|1342
MTR|Monteria|Colombia|CO|8.82|-75.83|0.94|0.55|1.10|7539|2|41
REU|Reus|Espanha|ES|41.15|1.17|0.94|0.85|1.90|8054|2|233
YXU|London|Canada|CA|43.03|-81.15|0.94|1.10|0.95|8800|2|912
GRX|Granada|Espanha|ES|37.19|-3.78|0.93|0.85|1.90|9514|2|1860
IKT|Irkutsk|Russia|RU|52.27|104.40|0.93|0.71|1.05|11696|2|1675
KSH|Kermanshah|Ira|IR|34.35|47.16|0.93|0.45|0.80|11213|2|4307
ABD|Abadan|Ira|IR|30.37|48.23|0.92|0.45|0.80|10169|2|10
BFS|Belfast|Reino Unido|GB|54.66|-6.22|0.92|1.05|1.10|9121|2|268
CZU|Corozal|Colombia|CO|9.33|-75.29|0.92|0.55|1.10|4930|2|528
FNA|Freetown|Serra Leoa|SL|8.62|-13.20|0.92|0.22|0.60|10498|2|84
PAB|Bilaspur|India|IN|21.99|82.11|0.92|0.52|0.90|5035|2|899
SCQ|Santiago de Compostela|Espanha|ES|42.90|-8.42|0.92|0.85|1.90|10499|2|1213
UBN|Ulaanbaatar|Mongolia|MN|47.65|106.82|0.92|0.42|1.10|11811|2|4482
CIX|Chiclayo|Peru|PE|-6.79|-79.83|0.91|0.52|1.50|8266|2|97
IXA|Agartala|India|IN|23.89|91.24|0.91|0.52|0.90|7500|2|46
OSS|Osh|Quirguistao|KG|40.61|72.79|0.91|0.32|0.90|10538|2|2927
ABQ|Albuquerque|Estados Unidos|US|35.04|-106.61|0.90|0.92|0.90|13793|2|5355
BEN|Benina|Libia|LY|32.10|20.27|0.90|0.40|0.50|11732|2|433
CGR|Campo Grande|Brasil|BR|-20.47|-54.67|0.90|0.72|0.60|8530|2|1833
EDI|Edimburgo|Reino Unido|GB|55.95|-3.37|0.90|1.10|1.50|8392|2|135
HDM|Hamadan|Ira|IR|34.87|48.56|0.90|0.45|0.80|10611|2|5755
NBC|Nizhnekamsk|Russia|RU|55.56|52.09|0.90|0.71|1.05|8209|2|643
SJP|Sao Jose do Rio Preto|Brasil|BR|-20.82|-49.41|0.90|0.68|0.85|5381|2|1784
TIA|Tirana|Albania|AL|41.41|19.72|0.90|0.55|1.30|9843|2|126
WRO|Wroclaw|Polonia|PL|51.10|16.88|0.90|0.80|0.90|8212|2|404
BHU|Bhavnagar|India|IN|21.75|72.19|0.89|0.52|0.90|6300|2|44
BLI|Bellingham|EUA|US|48.79|-122.54|0.89|1.10|1.10|6700|2|170
CUL|Culiacan|Mexico|MX|24.77|-107.48|0.89|0.69|1.30|7365|2|108
DXJ|Xiangxi|China|CN|28.50|109.52|0.89|0.80|1.00|8530|2|2169
PZI|Panzhihua|China|CN|26.54|101.80|0.89|0.80|1.00|9186|2|1620
SKD|Samarkand|Uzbequistao|UZ|39.70|66.98|0.89|0.50|0.80|10187|2|2224
BNS|Barinas|Venezuela|VE|8.62|-70.21|0.88|0.45|0.70|6560|2|615
MDG|Mudanjiang|China|CN|44.53|129.57|0.88|0.80|1.00|8530|2|883
OUD|Ahl Angad|Marrocos|MA|34.79|-1.93|0.88|0.54|1.65|9843|2|1535
RGO|Hoemun-ri|Coreia do Norte|KP|41.43|129.65|0.88|0.25|0.50|8202|2|12
VGO|Vigo|Espanha|ES|42.23|-8.63|0.88|0.85|1.90|7874|2|856
DYU|Dushanbe|Tajiquistao|TJ|38.54|68.82|0.87|0.28|0.80|10170|2|2575
LBD|Khujand|Tajiquistao|TJ|40.22|69.69|0.87|0.28|0.80|10433|2|1450
YLK|Barrie|Canada|CA|44.49|-79.55|0.87|1.10|0.95|6001|2|972
AAN|Al Ain|Emirados|AE|24.26|55.61|0.86|1.35|1.40|13123|2|869
MMX|Malmo|Suecia|SE|55.54|13.38|0.86|1.23|1.00|9186|2|236
TUS|Tucson|EUA|US|32.12|-110.94|0.86|1.10|1.10|10996|2|2643
ACY|Atlantic City|EUA|US|39.46|-74.58|0.85|1.10|1.10|10001|2|75
ASW|Aswan|Egito|EG|23.96|32.82|0.85|0.45|2.00|11161|2|650
DAY|Dayton|EUA|US|39.90|-84.22|0.85|1.10|1.10|10901|2|1009
GSO|Greensboro|EUA|US|36.10|-79.94|0.85|1.10|1.10|10001|2|925
IWA|Ivanovo|Russia|RU|56.94|40.94|0.85|0.71|1.05|8202|2|410
TLM|Zenata|Argelia|DZ|35.01|-1.46|0.85|0.60|0.70|8530|2|814
BPN|Balikpapan|Indonesia|ID|-1.27|116.89|0.84|0.50|0.90|8202|2|12
HMO|Hermosillo|Mexico|MX|29.09|-111.05|0.84|0.69|1.30|7546|2|627
KUA|Kuantan|Malasia|MY|3.78|103.21|0.84|0.72|1.50|9200|2|58
YGJ|Yonago|Japao|JP|35.49|133.24|0.84|1.23|1.50|8202|2|20
REX|Reynosa|Mexico|MX|26.01|-98.23|0.83|0.69|1.30|6243|2|139
YQG|Windsor|Canada|CA|42.28|-82.96|0.83|1.10|0.95|9000|2|622
APL|Nampula|Mocambique|MZ|-15.11|39.28|0.82|0.30|0.80|6562|2|1444
ENH|Enshi|China|CN|30.32|109.49|0.82|0.80|1.00|6890|2|1605
ERZ|Erzurum|Turquia|TR|39.96|41.17|0.82|0.65|1.30|12500|2|5763
IXP|Pathankot|India|IN|32.23|75.63|0.82|0.52|0.90|8970|2|1017
KHG|Kashgar|China|CN|39.54|76.02|0.82|0.80|1.00|10499|2|4529
TFN|Tenerife Sul|Espanha|ES|28.48|-16.34|0.82|0.82|2.00|10404|2|2076
LEX|Lexington|EUA|US|38.04|-84.61|0.81|1.10|1.10|7004|2|979
MLX|Malatya|Turquia|TR|38.44|38.09|0.81|0.65|1.30|10990|2|2828
NTE|Nantes|Franca|FR|47.15|-1.61|0.81|1.12|1.35|9514|2|90
SFN|Santa Fe|Argentina|AR|-31.71|-60.81|0.81|0.60|1.50|7628|2|55
TOF|Tomsk|Russia|RU|56.38|85.21|0.81|0.71|1.05|8202|2|597
UCB|Ulanqab|China|CN|41.13|113.11|0.81|0.80|1.00|10499|2|4619
ALC|Alicante|Espanha|ES|38.28|-0.56|0.80|0.82|1.80|9842|2|142
BSL|Basileia|Suica|CH|47.60|7.52|0.80|1.20|0.90|12795|2|885
EIN|Eindhoven|Holanda|NL|51.45|5.37|0.80|1.10|0.70|9843|2|74
MCX|Makhachkala|Russia|RU|42.82|47.65|0.80|0.71|1.05|8662|2|12
MRV|Mineralnyye Vody|Russia|RU|44.23|43.08|0.80|0.71|1.05|12795|2|1054
OXB|Bissau|Guine-Bissau|GW|11.89|-15.65|0.80|0.22|0.60|10499|2|129
YWG|Winnipeg|Canada|CA|49.91|-97.24|0.80|0.95|0.60|11000|2|783
BEW|Beira|Mocambique|MZ|-19.80|34.91|0.79|0.30|0.80|7874|2|33
CAB|Cabinda|Angola|AO|-5.60|12.19|0.79|0.38|0.60|8202|2|66
KEJ|Kemerovo|Russia|RU|55.27|86.11|0.79|0.71|1.05|10499|2|863
KGF|Karaganda|Cazaquistao|KZ|49.67|73.33|0.79|0.67|0.75|10831|2|1765
PNZ|Petrolina|Brasil|BR|-9.36|-40.57|0.79|0.68|0.85|9055|2|1263
RMI|Rimini|Italia|IT|44.02|12.61|0.79|1.00|1.40|9828|2|40
VSA|Villahermosa|Mexico|MX|17.99|-92.82|0.79|0.69|1.30|7218|2|46
YOL|Yola|Nigeria|NG|9.26|12.43|0.79|0.47|0.55|9840|2|599
BAL|Batman|Turquia|TR|37.93|41.12|0.78|0.65|1.30|10000|2|1822
BUF|Buffalo|EUA|US|42.94|-78.73|0.78|1.10|1.10|8829|2|728
MDC|Manado|Indonesia|ID|1.55|124.93|0.78|0.50|0.90|8693|2|264
MUN|Maturin|Venezuela|VE|9.75|-63.15|0.78|0.45|0.70|6890|2|224
TJM|Tyumen|Russia|RU|57.18|65.33|0.78|0.71|1.05|9852|2|378
ULY|Cherdakly|Russia|RU|54.40|48.80|0.78|0.71|1.05|16404|2|252
VDO|Van Don|Vietna|VN|21.12|107.42|0.78|0.58|1.40|11811|2|24
YNJ|Yanji|China|CN|42.88|129.45|0.78|0.80|1.00|8530|2|624
BDS|Brindisi|Italia|IT|40.66|17.95|0.77|1.00|1.40|10000|2|47
DAB|Daytona Beach|EUA|US|29.18|-81.06|0.77|1.05|2.20|10500|2|34
DOD|Dodoma|Tanzania|TZ|-6.17|35.76|0.77|0.32|1.45|6700|2|3673
GMO|Gombe|Nigeria|NG|10.30|10.90|0.77|0.47|0.55|10827|2|1590
KHD|Khorramabad|Ira|IR|33.44|48.28|0.77|0.45|0.80|10498|2|3782
LNL|Longnan|China|CN|33.79|105.79|0.77|0.80|1.00|9186|2|3707
LRM|La Romana|Republica Dominicana|DO|18.45|-68.91|0.77|0.50|2.20|9678|2|213
MDI|Makurdi|Nigeria|NG|7.70|8.61|0.77|0.47|0.55|9830|2|371
RZE|Jasionka|Polonia|PL|50.11|22.02|0.77|0.81|1.10|10498|2|693
AYJ|Faizabad|India|IN|26.75|82.16|0.76|0.52|0.90|7381|2|335
BIR|Biratnagar|Nepal|NP|26.48|87.26|0.76|0.35|1.90|4937|2|236
BOD|Bordeaux|Franca|FR|44.83|-0.72|0.76|1.12|1.35|10171|2|162
BRN|Bern|Suica|CH|46.91|7.50|0.76|1.60|1.40|5676|2|1671
NDR|Al Aaroui|Marrocos|MA|34.99|-3.03|0.76|0.54|1.65|9842|2|574
RFD|Chicago/Rockford|EUA|US|42.20|-89.10|0.76|1.10|1.10|10002|2|742
TIF|Taif|Arabia Saudita|SA|21.48|40.54|0.76|0.97|1.10|12254|2|4848
TUC|San Miguel de Tucuman|Argentina|AR|-26.84|-65.10|0.76|0.60|1.50|11483|2|1493
VLV|Valera|Venezuela|VE|9.34|-70.58|0.76|0.45|0.70|6791|2|2060
BAX|Barnaul|Russia|RU|53.36|83.54|0.75|0.71|1.05|9350|2|837
DLI|Da Lat|Vietna|VN|11.75|108.37|0.75|0.58|1.40|10663|2|3156
JRG|Sambalpur|India|IN|21.91|84.05|0.75|0.52|0.90|7844|2|751
MZH|Amasya|Turquia|TR|40.83|35.52|0.75|0.65|1.30|9600|2|1758
SDR|Santander|Espanha|ES|43.43|-3.82|0.75|0.85|1.90|7612|2|16
STW|Stavropol|Russia|RU|45.11|42.11|0.75|0.71|1.05|8530|2|1486
TAM|Ciudad Madero|Mexico|MX|22.29|-97.87|0.75|0.69|1.30|8366|2|80
CFK|Chlef|Argelia|DZ|36.22|1.34|0.74|0.60|0.70|8793|2|463
COS|Colorado Springs|EUA|US|38.81|-104.70|0.74|1.10|1.10|13500|2|6187
JGN|Jiayuguan|China|CN|39.86|98.34|0.74|0.80|1.00|9843|2|5112
REW|Rewa|India|IN|24.50|81.22|0.74|0.52|0.90|4593|2|1000
TXN|Huangshan|China|CN|29.73|118.26|0.74|0.80|1.00|8530|2|433
CUE|Cuenca|Equador|EC|-2.89|-78.98|0.73|0.57|1.05|6234|2|8306
DJB|Jambi|Indonesia|ID|-1.64|103.65|0.73|0.50|0.90|8537|2|82
FCN|Wurster Nordseekuste|Alemanha|DE|53.77|8.66|0.73|1.15|1.00|8002|2|74
LUG|Agno|Suica|CH|46.00|8.91|0.73|1.60|1.40|4642|2|915
MZR|Mazar-i-Sharif|Afeganistao|AF|36.70|67.21|0.73|0.22|0.50|9843|2|1284
RES|Resistencia|Argentina|AR|-27.45|-59.06|0.73|0.60|1.50|9088|2|173
SZF|Samsun|Turquia|TR|41.25|36.57|0.73|0.65|1.30|9843|2|18
TUL|Tulsa|EUA|US|36.20|-95.89|0.73|1.10|1.10|10000|2|677
GRK|Fort Cavazos|EUA|US|31.07|-97.83|0.72|1.10|1.10|9997|2|1015
KKS|Kashan|Ira|IR|33.90|51.58|0.72|0.45|0.80|8845|2|3465
SFA|Sfax|Tunisia|TN|34.72|10.69|0.72|0.55|1.30|9843|2|85
BEM|Oulad Yaich|Marrocos|MA|32.40|-6.32|0.71|0.54|1.65|8169|2|1694
MAM|Matamoros|Mexico|MX|25.77|-97.53|0.71|0.69|1.30|7546|2|25
MEC|Manta|Equador|EC|-0.95|-80.68|0.71|0.57|1.05|9383|2|48
OVD|Ranon|Espanha|ES|43.56|-6.03|0.71|0.85|1.90|7218|2|416
PDV|Plovdiv|Bulgaria|BG|42.07|24.85|0.71|0.70|1.00|8202|2|597
DIR|Dire Dawa|Etiopia|ET|9.62|41.86|0.70|0.35|0.80|8791|2|3827
MFM|Macau|Macau|MO|22.15|113.59|0.70|1.15|2.00|10544|2|20
MTT|Cosoleacaque|Mexico|MX|18.10|-94.58|0.70|0.69|1.30|6890|2|36
OOL|Gold Coast|Australia|AU|-28.17|153.51|0.70|1.05|1.80|8176|2|21
RIX|Riga|Letonia|LV|56.92|23.97|0.70|0.85|1.10|10499|2|36
AEB|Baise|China|CN|23.72|106.96|0.69|0.80|1.00|8202|2|490
BCU|Bauchi|Nigeria|NG|10.48|9.74|0.69|0.47|0.55|11154|2|1965
BMV|Buon Ma Thuot|Vietna|VN|12.67|108.12|0.69|0.58|1.40|9843|2|1729
KVO|Kraljevo|Servia|RS|43.82|20.59|0.69|0.65|1.00|7431|2|686
LUZ|Lublin|Polonia|PL|51.24|22.71|0.69|0.81|1.10|8268|2|633
MDQ|Mar del Plata|Argentina|AR|-37.93|-57.57|0.69|0.60|1.50|7218|2|72
PET|Pelotas|Brasil|BR|-31.72|-52.33|0.69|0.68|0.85|6496|2|59
PNK|Pontianak|Indonesia|ID|-0.15|109.40|0.69|0.50|0.90|7380|2|10
RSW|Fort Myers|EUA|US|26.53|-81.75|0.69|1.10|1.10|12000|2|30
STS|Santa Rosa|EUA|US|38.51|-122.81|0.69|1.10|1.10|6000|2|128
SZZ|Szczecin|Polonia|PL|53.58|14.90|0.69|0.81|1.10|8202|2|154
TUG|Tuguegarao City|Filipinas|PH|17.64|121.73|0.69|0.47|1.05|6455|2|70
YPQ|Peterborough|Canada|CA|44.23|-78.36|0.69|1.10|0.95|7005|2|628
DKA|Katsina|Nigeria|NG|13.01|7.66|0.68|0.47|0.55|11352|2|1660
DOL|Deauville|Franca|FR|49.37|0.15|0.68|1.12|1.35|8366|2|479
EZS|Elazig|Turquia|TR|38.60|39.28|0.68|0.65|1.30|9843|2|2927
HLD|Hailar|China|CN|49.21|119.82|0.68|0.80|1.00|8530|2|2169
VRA|Matanzas|Cuba|CU|23.03|-81.44|0.68|0.40|1.70|11490|2|210
BUQ|Bulawayo|Zimbabue|ZW|-20.02|28.62|0.67|0.30|0.90|8491|2|4359
LJG|Lijiang|China|CN|26.68|100.24|0.67|0.80|1.00|9843|2|7359
LTX|Latacunga|Equador|EC|-0.91|-78.62|0.67|0.57|1.05|12117|2|9205
OMA|Omaha|EUA|US|41.30|-95.89|0.67|1.10|1.10|9502|2|984
OMH|Urmia|Ira|IR|37.67|45.07|0.67|0.45|0.80|10658|2|4343
TUU|Tabuk|Arabia Saudita|SA|28.37|36.62|0.67|0.97|1.10|10991|2|2551
TZX|Trabzon|Turquia|TR|41.00|39.79|0.67|0.65|1.30|8661|2|104
UDR|Udaipur|India|IN|24.62|73.90|0.67|0.52|0.90|7484|2|1684
VAN|Van|Turquia|TR|38.47|43.33|0.67|0.65|1.30|9022|2|5480
ACA|Acapulco|Mexico|MX|16.76|-99.75|0.66|0.69|1.30|10832|2|16
ARH|Archangelsk|Russia|RU|64.60|40.72|0.66|0.71|1.05|8202|2|62
AZD|Yazd|Ira|IR|31.90|54.28|0.66|0.45|0.80|13446|2|4054
CAC|Cascavel|Brasil|BR|-25.00|-53.50|0.66|0.68|0.85|5810|2|2481
GRV|Grozny|Russia|RU|43.39|45.70|0.66|0.71|1.05|8202|2|548
IPN|Ipatinga|Brasil|BR|-19.47|-42.49|0.66|0.68|0.85|6575|2|786
KVX|Kirov|Russia|RU|58.50|49.35|0.66|0.71|1.05|7230|2|479
PGZ|Ponta Grossa|Brasil|BR|-25.18|-50.14|0.66|0.68|0.85|4692|2|2588
TEN|Tongren|China|CN|27.88|109.31|0.66|0.80|1.00|9022|2|2326
TTJ|Tottori|Japao|JP|35.53|134.17|0.66|1.23|1.50|6562|2|65
BHJ|Bhuj|India|IN|23.29|69.67|0.65|0.52|0.90|8205|2|268
CAW|Campos dos Goytacazes|Brasil|BR|-21.70|-41.30|0.65|0.68|0.85|5066|2|59
MEA|Macae|Brasil|BR|-22.34|-41.77|0.53|0.68|0.75|4626|2|10
MCY|Maroochydore|Australia|AU|-26.59|153.08|0.65|1.20|1.40|9186|2|15
SLA|Salta|Argentina|AR|-24.86|-65.49|0.65|0.60|1.50|9842|2|4088
VCL|Tam Nghia|Vietna|VN|15.40|108.71|0.65|0.58|1.40|10007|2|10
VUP|Valledupar|Colombia|CO|10.44|-73.25|0.65|0.55|1.10|6890|2|483
GBE|Gaborone|Botsuana|BW|-24.56|25.92|0.64|0.52|1.30|13123|2|3299
HOF|Hofuf|Arabia Saudita|SA|25.29|49.49|0.64|0.97|1.10|10039|2|588
JAU|Jauja|Peru|PE|-11.78|-75.47|0.64|0.52|1.50|9220|2|11034
CMW|Camaguey|Cuba|CU|21.42|-77.85|0.63|0.40|1.70|9842|2|413
CYZ|Cauayan City|Filipinas|PH|16.93|121.75|0.63|0.47|1.05|6890|2|200
FOG|Foggia|Italia|IT|41.43|15.53|0.63|1.00|1.40|5692|2|265
JGS|Ji'an|China|CN|26.86|114.74|0.63|0.80|1.00|8530|2|281
LBE|Latrobe|EUA|US|40.28|-79.40|0.63|1.10|1.10|8222|2|1199
MCE|Merced|EUA|US|37.28|-120.51|0.63|1.10|1.10|5914|2|155
NWI|Norwich, Norfolk|Reino Unido|GB|52.68|1.28|0.63|1.05|1.10|6043|2|118
OGU|Ordu|Turquia|TR|40.97|38.09|0.63|0.65|1.30|9848|2|11
SXB|Strasbourg|Franca|FR|48.54|7.63|0.63|1.12|1.35|7874|2|505
AHB|Abha|Arabia Saudita|SA|18.24|42.66|0.62|0.97|1.10|10991|2|6858
AKU|Aksu|China|CN|41.26|80.29|0.62|0.80|1.00|7874|2|3816
ETZ|Goin|Franca|FR|48.98|6.25|0.62|1.12|1.35|8202|2|870
GRZ|Feldkirchen bei Graz|Austria|AT|46.99|15.44|0.62|1.25|1.50|9842|2|1115
JIJ|Jijiga|Etiopia|ET|9.33|42.91|0.62|0.35|0.80|8202|2|5954
KCH|Kuching|Malasia|MY|1.49|110.35|0.62|0.72|1.50|12402|2|89
KER|Kerman|Ira|IR|30.27|56.95|0.62|0.45|0.80|12635|2|5741
KHV|Khabarovsk|Russia|RU|48.53|135.19|0.62|0.71|1.05|13124|2|244
KUN|Kaunas|Lituania|LT|54.96|24.09|0.62|0.85|1.00|10663|2|256
LOP|Mataram|Indonesia|ID|-8.76|116.28|0.62|0.50|0.90|10826|2|319
LZN|Matsu|Taiwan|TW|26.16|119.96|0.62|1.07|1.15|5180|2|232
MQM|Mardin|Turquia|TR|37.22|40.63|0.62|0.65|1.30|8204|2|1729
NAV|Nevsehir|Turquia|TR|38.77|34.53|0.62|0.65|1.30|9842|2|3100
NTL|Williamtown|Australia|AU|-32.80|151.84|0.62|1.20|1.40|10033|2|31
PEZ|Penza|Russia|RU|53.11|45.02|0.62|0.71|1.05|9155|2|614
PQC|Phu Quoc Island|Vietna|VN|10.17|103.99|0.62|0.58|1.40|9843|2|37
REG|Reggio Calabria|Italia|IT|38.07|15.65|0.62|1.00|1.40|6549|2|96
RIY|Mukalla|Iemen|YE|14.66|49.38|0.62|0.20|0.50|9843|2|54
XAP|Chapeco|Brasil|BR|-27.13|-52.66|0.62|0.68|0.85|6758|2|2154
GRR|Grand Rapids|EUA|US|42.88|-85.52|0.61|1.10|1.10|10001|2|794
HAS|Hail|Arabia Saudita|SA|27.44|41.69|0.61|0.97|1.10|12204|2|3331
IAS|Iasi|Romenia|RO|47.18|27.62|0.61|0.73|0.90|7874|2|411
TMP|Tampere / Pirkkala|Finlandia|FI|61.41|23.60|0.61|1.30|1.10|8858|2|390
BKI|Kota Kinabalu|Malasia|MY|5.93|116.05|0.60|0.68|1.60|12402|2|10
GOI|Goa|India|IN|15.38|73.83|0.60|0.52|2.00|11345|2|150
HKT|Phuket|Tailandia|TH|8.11|98.32|0.60|0.65|2.20|10171|2|82
POS|Port of Spain|Trinidad e Tobago|TT|10.60|-61.34|0.60|0.80|0.90|10500|2|58
RUN|Saint-Denis|Reuniao|RE|-20.89|55.52|0.60|0.85|1.50|10499|2|66
TLL|Tallinn|Estonia|EE|59.41|24.83|0.60|0.90|1.20|11417|2|131
VNO|Vilnius|Lituania|LT|54.63|25.29|0.60|0.85|1.00|8251|2|648
YXE|Saskatoon|Canada|CA|52.17|-106.70|0.60|1.10|0.95|8300|2|1653
ZCO|Temuco|Chile|CL|-38.93|-72.65|0.60|0.70|1.30|8005|2|333
GME|Gomel|Belarus|BY|52.53|31.02|0.59|0.55|0.70|8428|2|472
GZP|Gazipasa|Turquia|TR|36.30|32.30|0.59|0.65|1.30|7710|2|92
HEA|Guzara|Afeganistao|AF|34.21|62.23|0.59|0.22|0.50|9888|2|3206
IGD|Igdir|Turquia|TR|39.98|43.88|0.59|0.65|1.30|9843|2|3101
IPI|Ipiales|Colombia|CO|0.86|-77.67|0.59|0.55|1.10|8202|2|9765
PSR|Pescara|Italia|IT|42.43|14.18|0.59|1.00|1.40|7933|2|48
TRF|Sandefjord|Noruega|NO|59.19|10.26|0.59|1.20|1.20|9216|2|286
KLV|Karlovy Vary|Chequia|CZ|50.20|12.91|0.58|0.95|1.70|7054|2|1989
MRY|Monterey|EUA|US|36.59|-121.84|0.58|1.10|1.10|7175|2|257
ODE|Odense|Dinamarca|DK|55.48|10.33|0.58|1.40|1.30|6053|2|56
REN|Orenburg|Russia|RU|51.79|55.46|0.58|0.71|1.05|8212|2|387
UTP|Rayong|Tailandia|TH|12.68|101.00|0.58|0.60|2.00|11500|2|42
ACH|St. Gallen|Suica|CH|47.49|9.56|0.57|1.60|1.40|4774|2|1306
BHM|Birmingham|EUA|US|33.56|-86.75|0.57|1.10|1.10|12007|2|650
CLQ|Colima|Mexico|MX|19.28|-103.58|0.57|0.69|1.30|7546|2|2467
IMF|Imphal|India|IN|24.76|93.90|0.57|0.52|0.90|9009|2|2540
NKT|Sirnak|Turquia|TR|37.36|42.06|0.57|0.65|1.30|9843|2|2038
PFB|Passo Fundo|Brasil|BR|-28.24|-52.33|0.57|0.68|0.85|5512|2|2380
RDO|Radom|Polonia|PL|51.39|21.21|0.57|0.81|1.10|8202|2|610
AKJ|Higashikagura|Japao|JP|43.67|142.45|0.56|1.23|1.50|8200|2|721
ALB|Albany|EUA|US|42.75|-73.80|0.56|1.10|1.10|8500|2|285
BZI|Balikesir|Turquia|TR|39.62|27.93|0.56|0.65|1.30|9810|2|340
HGA|Hargeisa|Somalia|SO|9.51|44.08|0.56|0.20|0.50|12139|2|4471
ODB|Cordoba|Espanha|ES|37.84|-4.85|0.56|0.85|1.90|7352|2|297
PZU|Port Sudan|Sudao|SD|19.43|37.23|0.56|0.24|0.50|8202|2|135
XIL|Xilinhot|China|CN|43.92|115.96|0.56|0.80|1.00|9186|2|3333
ASF|Astrakhan|Russia|RU|46.28|48.01|0.55|0.71|1.05|10499|2|-65
CDT|Castellon de la Plana|Espanha|ES|40.21|0.07|0.55|0.85|1.90|8858|2|1182
DJE|Mellita|Tunisia|TN|33.87|10.78|0.55|0.55|1.30|10171|2|19
DSM|Des Moines|EUA|US|41.53|-93.66|0.55|1.10|1.10|9004|2|958
IOS|Ilheus|Brasil|BR|-14.82|-39.03|0.55|0.68|0.85|5174|2|15
KGD|Kaliningrad|Russia|RU|54.89|20.60|0.55|0.71|1.05|10991|2|42
NQN|Neuquen|Argentina|AR|-38.95|-68.16|0.55|0.60|1.50|8432|2|895
TAG|Panglao|Filipinas|PH|9.57|123.77|0.55|0.47|1.05|8202|2|42
VDC|Vitoria da Conquista|Brasil|BR|-14.91|-40.91|0.55|0.68|0.85|6890|2|2940
ZAH|Zahedan|Ira|IR|29.48|60.91|0.55|0.45|0.80|14042|2|4564
BFL|Bakersfield|EUA|US|35.43|-119.06|0.54|1.10|1.10|10849|2|510
BJV|Bodrum|Turquia|TR|37.25|27.66|0.54|0.65|1.30|9843|2|21
BOI|Boise|EUA|US|43.56|-116.22|0.54|1.10|1.10|10000|2|2871
DGO|Durango|Mexico|MX|24.13|-104.53|0.54|0.69|1.30|9514|2|6104
GHV|Brasov|Romenia|RO|45.71|25.52|0.54|0.73|0.90|9252|2|1740
HKD|Hakodate|Japao|JP|41.77|140.82|0.54|1.23|1.50|9842|2|151
JDZ|Jingdezhen|China|CN|29.34|117.18|0.54|0.80|1.00|7874|2|112
LIT|Little Rock|EUA|US|34.73|-92.22|0.54|1.10|1.10|8273|2|262
TGG|Kuala Terengganu|Malasia|MY|5.38|103.10|0.54|0.72|1.50|11417|2|21
UGC|Urgench|Uzbequistao|UZ|41.58|60.64|0.54|0.50|0.80|11065|2|320
EAM|Najran|Arabia Saudita|SA|17.61|44.42|0.53|0.97|1.10|10007|2|3982
GJL|Tahir|Argelia|DZ|36.79|5.87|0.53|0.60|0.70|7874|2|36
GNJ|Ganja|Azerbaijao|AZ|40.74|46.32|0.53|0.70|1.00|10827|2|1083
MOC|Montes Claros|Brasil|BR|-16.71|-43.82|0.53|0.68|0.85|6890|2|2191
RIC|Richmond|EUA|US|37.51|-77.32|0.53|1.10|1.10|9003|2|167
SBZ|Sibiu|Romenia|RO|45.79|24.09|0.53|0.73|0.90|8629|2|1496
TJK|Tokat|Turquia|TR|40.32|36.39|0.53|0.65|1.30|8858|2|1859
UUA|Bugulma|Russia|RU|54.64|52.80|0.53|0.71|1.05|6561|2|991
AOI|Falconara Marittima|Italia|IT|43.62|13.36|0.52|1.00|1.40|9718|2|49
BCM|Bacau|Romenia|RO|46.52|26.91|0.52|0.73|0.90|8203|2|607
DJJ|Sentani|Indonesia|ID|-2.58|140.52|0.52|0.50|0.90|9842|2|289
GDZ|Gelendzhik|Russia|RU|44.58|38.01|0.52|0.71|1.05|10171|2|98
KDH|Kandahar|Afeganistao|AF|31.51|65.85|0.52|0.22|0.50|10532|2|3337
SBA|Santa Barbara|EUA|US|34.43|-119.84|0.52|1.10|1.10|6037|2|13
UTH|Udon Thani|Tailandia|TH|17.39|102.79|0.52|0.60|2.00|10000|2|579
VER|Veracruz|Mexico|MX|19.14|-96.19|0.52|0.69|1.30|7874|2|90
ZCL|Zacatecas|Mexico|MX|22.89|-102.69|0.52|0.69|1.30|9843|2|7141
AAR|Aarhus|Dinamarca|DK|56.30|10.62|0.51|1.40|1.30|9111|2|82
CEN|Ciudad Obregon|Mexico|MX|27.39|-109.83|0.51|0.69|1.30|7546|2|243
CND|Constanta|Romenia|RO|44.36|28.49|0.51|0.73|0.90|11483|2|353
INI|Nis|Servia|RS|43.34|21.86|0.51|0.65|1.00|8202|2|648
IQT|Iquitos|Peru|PE|-3.78|-73.31|0.51|0.52|1.50|8202|2|306
PSC|Pasco|EUA|US|46.26|-119.12|0.51|1.10|1.10|7707|2|410
RLG|Laage|Alemanha|DE|53.92|12.28|0.51|1.15|1.00|8202|2|138
RNO|Reno|EUA|US|39.50|-119.77|0.51|1.10|1.10|11001|2|4415
UBA|Uberaba|Brasil|BR|-19.77|-47.96|0.51|0.68|0.85|5771|2|2655
AER|Sochi|Russia|RU|43.45|39.96|0.50|0.68|1.60|9498|2|89
AKX|Aktobe|Cazaquistao|KZ|50.25|57.20|0.50|0.67|0.75|10505|2|738
CBR|Camberra|Australia|AU|-35.31|149.20|0.50|1.15|0.80|10771|2|1886
CUZ|Cusco|Peru|PE|-13.54|-71.94|0.50|0.52|2.20|11146|2|10860
DEB|Debrecen|Hungria|HU|47.49|21.62|0.50|0.85|1.60|8196|2|359
FAO|Faro|Portugal|PT|37.02|-7.97|0.50|0.78|2.00|8169|2|24
MLA|Malta|Malta|MT|35.85|14.49|0.50|0.90|1.90|10991|2|300
NQY|Newquay|Reino Unido|GB|50.44|-5.00|0.50|1.05|1.10|9003|2|390
PEG|Perugia|Italia|IT|43.10|12.51|0.50|1.00|1.40|7215|2|697
TML|Tamale|Gana|GH|9.55|-0.87|0.50|0.45|0.80|7999|2|553
YHZ|Halifax|Canada|CA|44.88|-63.51|0.50|0.95|0.90|10500|2|477
YNY|Gonghang-ro|Coreia do Sul|KR|38.06|128.67|0.50|1.12|1.30|8202|2|241
MQP|Mbombela|Africa do Sul|ZA|-25.38|31.11|0.49|0.65|1.20|10171|2|2829
TSR|Timisoara|Romenia|RO|45.81|21.34|0.49|0.73|0.90|11483|2|348
BLL|Billund|Dinamarca|DK|55.74|9.16|0.48|1.40|1.30|10172|2|247
ICT|Wichita|EUA|US|37.65|-97.43|0.48|1.10|1.10|10302|2|1333
KSC|Kosice|Eslovaquia|SK|48.66|21.24|0.48|0.88|0.90|10171|2|755
MQF|Magnitogorsk|Russia|RU|53.39|58.76|0.48|0.71|1.05|10663|2|1430
MSN|Madison|EUA|US|43.14|-89.34|0.48|1.10|1.10|9006|2|887
MSU|Maseru|Lesoto|LS|-29.46|27.55|0.48|0.30|0.70|10498|2|5348
PIA|Peoria|EUA|US|40.66|-89.69|0.48|1.10|1.10|10104|2|660
WUA|Wuhai|China|CN|39.79|106.80|0.48|0.80|1.00|8530|2|3650
XIC|Liangshan|China|CN|27.99|102.18|0.48|0.80|1.00|11811|2|5112
CHA|Chattanooga|EUA|US|35.04|-85.20|0.47|1.10|1.10|7400|2|683
LEI|Almeria|Espanha|ES|36.84|-2.37|0.47|0.85|1.90|10499|2|70
PTG|Polokwane|Africa do Sul|ZA|-23.85|29.46|0.47|0.65|1.20|8400|2|4076
TOL|Toledo|EUA|US|41.59|-83.81|0.47|1.10|1.10|10600|2|683
GIZ|Jizan|Arabia Saudita|SA|16.90|42.59|0.46|0.97|1.10|10006|2|20
MLB|Melbourne|EUA|US|28.10|-80.64|0.46|1.10|1.10|10181|2|33
PNS|Pensacola|EUA|US|30.47|-87.19|0.46|1.10|1.10|7004|2|121
RBR|Rio Branco|Brasil|BR|-9.87|-67.89|0.46|0.68|0.85|7080|2|633
VST|Stockholm / Vasteras|Suecia|SE|59.59|16.63|0.46|1.23|1.00|8468|2|21
ZYL|Sylhet|Bangladesh|BD|24.96|91.86|0.46|0.35|0.50|9478|2|50
BHK|Bukhara|Uzbequistao|UZ|39.78|64.48|0.45|0.50|0.80|9843|2|751
JUB|Juba|Sudao do Sul|SS|4.87|31.60|0.45|0.20|0.50|10171|2|1513
NCU|Nukus|Uzbequistao|UZ|42.49|59.62|0.45|0.50|0.80|9865|2|246
PBM|Paramaribo|Suriname|SR|5.45|-55.19|0.45|0.45|0.80|11417|2|59
SGC|Surgut|Russia|RU|61.34|73.41|0.45|0.71|1.05|9154|2|200
TRS|Ronchi dei|Italia|IT|45.83|13.47|0.45|1.00|1.40|9843|2|39
GRJ|George|Africa do Sul|ZA|-34.01|22.38|0.44|0.65|1.20|6562|2|648
HDY|Hat Yai|Tailandia|TH|6.93|100.39|0.44|0.60|2.00|10007|2|90
JUL|Juliaca|Peru|PE|-15.47|-70.16|0.44|0.52|1.50|13780|2|12552
BQT|Brest|Belarus|BY|52.11|23.90|0.43|0.55|0.70|8596|2|468
CHS|Charleston|EUA|US|32.90|-80.04|0.43|1.10|1.10|9001|2|46
GEG|Spokane|EUA|US|47.62|-117.53|0.43|1.10|1.10|11002|2|2376
MZT|Mazatlan|Mexico|MX|23.16|-106.26|0.43|0.69|1.30|8868|2|38
PED|Pardubice|Chequia|CZ|50.02|15.74|0.43|0.95|1.70|8203|2|741
AGT|Ciudad del Este|Paraguai|PY|-25.46|-54.84|0.42|0.55|0.70|11154|2|846
DLE|Dole|Franca|FR|47.04|5.43|0.42|1.12|1.35|7318|2|645
VAR|Varna|Bulgaria|BG|43.23|27.83|0.42|0.70|1.00|8258|2|230
XCR|Chalons en Champagne|Franca|FR|48.77|4.21|0.42|1.12|1.35|12664|2|587
CRA|Craiova|Romenia|RO|44.32|23.89|0.41|0.73|0.90|8203|2|626
GRB|Green Bay|EUA|US|44.48|-88.13|0.41|1.10|1.10|8700|2|695
ANC|Anchorage|Estados Unidos|US|61.18|-149.99|0.40|1.05|1.40|12400|2|152
BGO|Bergen|Noruega|NO|60.29|5.22|0.40|1.20|1.50|9810|2|170
CHC|Christchurch|Nova Zelandia|NZ|-43.49|172.53|0.40|1.20|1.60|10787|2|123
LCA|Larnaca|Chipre|CY|34.88|33.62|0.40|0.85|1.90|9823|2|8
PVR|Puerto Vallarta|Mexico|MX|20.68|-105.25|0.40|0.65|2.00|10171|2|23
TAZ|Dasoguz|Turcomenistao|TM|41.76|59.84|0.40|0.45|0.60|12467|2|272
TET|Tete|Mocambique|MZ|-16.10|33.64|0.40|0.30|0.80|8225|2|525
WLG|Wellington|Nova Zelandia|NZ|-41.33|174.81|0.40|1.05|1.00|6352|2|41
DOV|Dover|EUA|US|39.13|-75.47|0.39|1.20|1.00|12903|2|24
GIB|Gibraltar|Gibraltar|GI|36.15|-5.35|0.39|1.10|1.50|6000|2|12
GSM|Qeshm|Ira|IR|26.75|55.90|0.39|0.45|0.80|13864|2|45
MOB|Mobile|EUA|US|30.69|-88.24|0.39|1.10|1.10|8502|2|219
PCL|Pucallpa|Peru|PE|-8.38|-74.57|0.39|0.52|1.50|9186|2|513
TKU|Turku|Finlandia|FI|60.51|22.26|0.39|1.30|1.10|8202|2|161
TUF|Tours, Indre-et-Loire|Franca|FR|47.43|0.73|0.39|1.12|1.35|7887|2|357
BND|Bandar Abbas|Ira|IR|27.22|56.38|0.38|0.45|0.80|12008|2|22
BPS|Porto Seguro|Brasil|BR|-16.44|-39.08|0.38|0.68|0.85|6562|2|169
CRP|Corpus Christi|EUA|US|27.77|-97.50|0.38|1.10|1.10|7510|2|44
HSV|Huntsville|EUA|US|34.64|-86.77|0.38|1.10|1.10|12600|2|629
HTS|Huntington|EUA|US|38.37|-82.56|0.38|1.10|1.10|7017|2|828
OAX|Oaxaca|Mexico|MX|17.00|-96.73|0.38|0.69|1.30|8038|2|4989
OHS|Suhar|Oma|OM|24.39|56.63|0.38|0.95|1.30|13173|2|20
TGD|Podgorica|Montenegro|ME|42.36|19.25|0.38|0.62|1.70|8202|2|141
DMB|Taraz|Cazaquistao|KZ|42.85|71.30|0.37|0.67|0.75|9514|2|2184
KZO|Kyzylorda|Cazaquistao|KZ|44.71|65.59|0.37|0.67|0.75|8858|2|433
MMK|Murmansk|Russia|RU|68.78|32.75|0.37|0.71|1.05|8202|2|266
PWQ|Pavlodar|Cazaquistao|KZ|52.19|77.07|0.37|0.67|0.75|8202|2|410
ROC|Rochester|EUA|US|43.12|-77.67|0.37|1.10|1.10|8001|2|559
SKX|Saransk|Russia|RU|54.13|45.21|0.37|0.71|1.05|9186|2|676
AQI|Qaisumah|Arabia Saudita|SA|28.34|46.13|0.36|0.97|1.10|10007|2|1174
CAG|Cagliari|Italia|IT|39.25|9.05|0.36|1.00|1.40|9196|2|13
IQQ|Iquique|Chile|CL|-20.54|-70.18|0.36|0.70|1.30|10991|2|155
KLO|Kalibo|Filipinas|PH|11.68|122.38|0.36|0.47|1.05|7175|2|14
NJC|Nizhnevartovsk|Russia|RU|60.95|76.48|0.36|0.71|1.05|10499|2|177
PEV|Pecs|Hungria|HU|45.99|18.24|0.36|0.85|1.60|4922|2|651
PWM|Portland|EUA|US|43.65|-70.31|0.36|1.10|1.10|7200|2|76
SCV|Suceava|Romenia|RO|47.69|26.35|0.36|0.73|0.90|8070|2|1375
UUD|Ulan Ude|Russia|RU|51.81|107.44|0.36|0.71|1.05|11155|2|1690
AAC|El Arish|Egito|EG|31.06|33.83|0.35|0.45|2.00|9905|2|118
ABA|Abakan|Russia|RU|53.74|91.39|0.35|0.71|1.05|10663|2|831
AMQ|Ambon|Indonesia|ID|-3.71|128.09|0.35|0.50|0.90|8202|2|33
EDO|Edremit|Turquia|TR|39.55|27.01|0.35|0.65|1.30|9842|2|50
HTA|Chita|Russia|RU|52.02|113.31|0.35|0.71|1.05|9430|2|2272
OHD|Ohrid|Macedonia do Norte|MK|41.18|20.74|0.35|0.55|0.90|8366|2|2313
SUF|Lamezia Terme|Italia|IT|38.91|16.25|0.35|1.00|1.40|9898|2|39
TMM|Toamasina|Madagascar|MG|-18.11|49.39|0.35|0.25|1.20|7218|2|22
BSK|Biskra|Argelia|DZ|34.79|5.74|0.34|0.60|0.70|9469|2|289
GOM|Goma|Congo (Kinshasa)|CD|-1.67|29.24|0.34|0.22|0.50|9695|2|5089
JAF|Jaffna|Sri Lanka|LK|9.79|80.07|0.34|0.45|1.70|4593|2|33
LAO|Laoag City|Filipinas|PH|18.18|120.53|0.34|0.47|1.05|9120|2|25
SAV|Savannah|EUA|US|32.13|-81.20|0.34|1.10|1.10|9351|2|50
TZL|Dubrave Gornje|Bosnia e Herzegovina|BA|44.46|18.72|0.34|0.60|1.00|8152|2|784
YLW|Kelowna|Canada|CA|49.96|-119.38|0.34|1.10|0.95|8900|2|1421
BTJ|Banda Aceh|Indonesia|ID|5.53|95.42|0.33|0.50|0.90|9843|2|65
BWA|Siddharthanagar|Nepal|NP|27.50|83.41|0.33|0.35|1.90|9843|2|358
KSN|Kostanay|Cazaquistao|KZ|53.21|63.55|0.33|0.67|0.75|9229|2|595
LNZ|Linz|Austria|AT|48.24|14.19|0.33|1.25|1.50|9843|2|980
NYO|Nykoping|Suecia|SE|58.79|16.91|0.33|1.23|1.00|9442|2|140
SVG|Stavanger|Noruega|NO|58.88|5.64|0.33|1.20|1.20|9369|2|29
SYR|Syracuse|EUA|US|43.11|-76.11|0.33|1.10|1.10|9013|2|421
URA|Uralsk|Cazaquistao|KZ|51.15|51.54|0.33|0.67|0.75|9183|2|125
TJU|Kulob|Tajiquistao|TJ|37.99|69.81|0.32|0.28|0.80|9843|2|2293
UKK|Ust-Kamenogorsk|Cazaquistao|KZ|50.04|82.50|0.32|0.67|0.75|8234|2|939
GUW|Atyrau|Cazaquistao|KZ|47.12|51.82|0.31|0.67|0.75|9842|2|-72
BGI|Bridgetown|Barbados|BB|13.07|-59.49|0.30|0.72|1.90|11000|2|169
FNC|Funchal|Portugal|PT|32.70|-16.77|0.30|0.78|1.90|9110|2|192
IGU|Foz do Iguacu|Brasil|BR|-25.59|-54.49|0.30|0.60|2.20|8875|2|786
MJN|Mahajanga|Madagascar|MG|-15.67|46.35|0.30|0.25|1.20|7218|2|87
NAS|Nassau|Bahamas|BS|25.04|-77.47|0.30|0.75|2.10|11353|2|16
SJD|Los Cabos|Mexico|MX|23.15|-109.72|0.30|0.70|2.10|9843|2|374
SPU|Split|Croacia|HR|43.54|16.30|0.30|0.75|2.10|8366|2|79
BNX|Mahovljani|Bosnia e Herzegovina|BA|44.94|17.30|0.29|0.60|1.00|8202|2|400
LAQ|Al Albraq|Libia|LY|32.79|21.95|0.29|0.40|0.50|11824|2|2157
PLX|Semey|Cazaquistao|KZ|50.35|80.23|0.29|0.67|0.75|10159|2|761
TYS|Knoxville/Maryville|EUA|US|35.81|-83.99|0.29|1.10|1.10|10000|2|981
GEO|Georgetown|Guiana|GY|6.50|-58.25|0.28|0.48|0.80|11023|2|95
HSA|Turkistan|Cazaquistao|KZ|43.31|68.55|0.28|0.67|0.75|10827|2|951
POM|Port Moresby|Papua-Nova Guine|PG|-9.44|147.22|0.28|0.34|0.90|9022|2|146
UUS|Yuzhno-Sakhalinsk|Russia|RU|46.89|142.72|0.28|0.71|1.05|11155|2|59
KLU|Klagenfurt am Worthersee|Austria|AT|46.64|14.34|0.27|1.25|1.50|8924|2|1472
KQT|Bokhtar|Tajiquistao|TJ|37.87|68.86|0.27|0.28|0.80|7497|2|1473
LWN|Gyumri|Armenia|AM|40.75|43.86|0.27|0.50|1.10|10564|2|5000
BES|Brest|Franca|FR|48.45|-4.42|0.26|1.12|1.35|10171|2|325
BUS|Batumi|Georgia|GE|41.61|41.60|0.26|0.55|1.30|8202|2|105
INN|Innsbruck|Austria|AT|47.26|11.34|0.26|1.25|1.50|6562|2|1907
KDU|Skardu|Paquistao|PK|35.34|75.54|0.26|0.40|0.60|11995|2|7316
KUT|Kopitnari|Georgia|GE|42.18|42.49|0.26|0.55|1.30|8202|2|223
OUL|Oulu / Oulunsalo|Finlandia|FI|64.93|25.35|0.26|1.30|1.10|8205|2|47
BOJ|Burgas|Bulgaria|BG|42.57|27.52|0.25|0.70|1.00|10499|2|135
CFE|Clermont-Ferrand|Franca|FR|45.79|3.17|0.25|1.12|1.35|9885|2|1090
CRZ|Turkmenabat|Turcomenistao|TM|38.93|63.56|0.25|0.45|0.60|12467|2|649
CZM|Cozumel|Mexico|MX|20.51|-86.93|0.25|0.65|2.20|8858|2|15
DLM|Dalaman|Turquia|TR|36.71|28.79|0.25|0.65|1.30|9842|2|20
FDF|Fort-de-France|Martinica|MQ|14.59|-61.00|0.25|0.88|1.80|9843|2|16
JHG|Jinghong|China|CN|21.97|100.76|0.25|0.80|1.00|7874|2|1815
LUX|Luxembourg|Luxemburgo|LU|49.63|6.21|0.25|1.55|1.00|13123|2|1234
NSK|Norilsk|Russia|RU|69.31|87.33|0.25|0.71|1.05|11254|2|574
OMR|Oradea|Romenia|RO|47.03|21.90|0.25|0.73|0.90|8267|2|465
PKC|Petropavlovsk-Kamchatsky|Russia|RU|53.17|158.45|0.25|0.71|1.05|11155|2|131
PLQ|Palanga|Lituania|LT|55.97|21.09|0.25|0.85|1.00|7480|2|33
PPS|Puerto Princesa|Filipinas|PH|9.74|118.76|0.25|0.47|1.05|8530|2|71
PTP|Pointe-a-Pitre|Guadalupe|GP|16.27|-61.53|0.25|0.85|1.80|11499|2|36
DIL|Dili|Timor-Leste|TL|-8.55|125.52|0.24|0.30|0.80|6065|2|154
YKS|Yakutsk|Russia|RU|62.09|129.77|0.24|0.71|1.05|11155|2|325
ABZ|Aberdeen|Reino Unido|GB|57.20|-2.20|0.23|1.05|1.10|6407|2|215
BWN|Bandar Seri Begawan|Brunei|BN|4.94|114.93|0.23|1.00|0.90|12000|2|73
EUN|El Aaiun|Saara Ocidental|EH|27.14|-13.22|0.23|0.30|0.60|8861|2|207
FUE|El Matorral|Espanha|ES|28.45|-13.86|0.23|0.85|1.90|11220|2|85
PFO|Paphos|Chipre|CY|34.72|32.49|0.23|0.85|1.90|8858|2|41
ESM|Tachina|Equador|EC|0.98|-79.63|0.22|0.57|1.05|7874|2|32
ORU|Oruro|Bolivia|BO|-17.96|-67.08|0.22|0.46|1.05|8075|2|12152
RTB|Coxen Hole|Honduras|HN|16.32|-86.52|0.22|0.36|0.70|7349|2|39
SNN|Shannon|Irlanda|IE|52.70|-8.92|0.22|1.15|1.15|10495|2|46
SRE|Sucre|Bolivia|BO|-19.25|-65.15|0.22|0.46|1.05|11811|2|10184
AAL|Aalborg|Dinamarca|DK|57.09|9.85|0.21|1.40|1.30|8707|2|10
KOV|Kokshetau|Cazaquistao|KZ|53.33|69.59|0.21|0.67|0.75|8325|2|900
SZG|Salzburg|Austria|AT|47.79|13.00|0.21|1.25|1.50|9022|2|1411
CNS|Cairns|Australia|AU|-16.88|145.75|0.20|0.98|1.90|10489|2|10
CUR|Willemstad|Curacao|CW|12.19|-68.96|0.20|0.70|1.80|11188|2|29
GUM|Guam|Guam|GU|13.48|144.80|0.20|0.95|1.60|12015|2|298
HER|Heraklion|Grecia|GR|35.34|25.18|0.20|0.75|2.20|8904|2|115
HRG|Hurghada|Egito|EG|27.18|33.80|0.20|0.45|2.00|13171|2|32
HUN|Hualien City|Taiwan|TW|24.02|121.62|0.20|1.07|1.15|9022|2|52
IBZ|Ibiza|Espanha|ES|38.87|1.37|0.20|0.85|2.20|9186|2|24
JCL|Ceske Budejovice|Chequia|CZ|48.95|14.43|0.20|0.95|1.70|8202|2|1417
MLE|Male|Maldivas|MV|4.19|73.53|0.20|0.75|2.20|11155|2|6
MRU|Maurcio|Mauricio|MU|-20.43|57.68|0.20|0.75|2.20|11056|2|186
MUH|Marsa Matruh|Egito|EG|31.32|27.22|0.20|0.45|2.00|9843|2|75
NAN|Nadi|Fiji|FJ|-17.76|177.44|0.20|0.60|2.20|10739|2|59
OGG|Kahului|Estados Unidos|US|20.90|-156.43|0.20|1.00|2.10|6998|2|54
PPK|Petropavl|Cazaquistao|KZ|54.78|69.19|0.20|0.67|0.75|8190|2|453
XBJ|Birjand|Ira|IR|32.90|59.28|0.20|0.45|0.80|9521|2|4952
YNB|Yanbu|Arabia Saudita|SA|24.14|38.06|0.20|0.97|1.10|10532|2|26
DNH|Dunhuang|China|CN|40.16|94.81|0.19|0.80|1.00|9186|2|3789
HIR|Honiara|Ilhas Salomao|SB|-9.43|160.05|0.19|0.30|1.20|7218|2|28
KVA|Kavala|Grecia|GR|40.91|24.62|0.19|0.77|2.10|9844|2|18
SHO|Mpaka|Essuatini|SZ|-26.36|31.72|0.19|0.38|0.90|11811|2|1092
SUV|Nausori|Fiji|FJ|-18.04|178.56|0.19|0.60|2.20|7047|2|17
VAA|Vaasa|Finlandia|FI|63.05|21.76|0.19|1.30|1.10|8727|2|19
LVI|Livingstone|Zambia|ZM|-17.82|25.82|0.18|0.32|0.80|9843|2|3302
SAI|Siem Reap|Camboja|KH|13.37|104.22|0.18|0.35|1.40|11827|2|191
SCO|Aktau|Cazaquistao|KZ|43.86|51.09|0.18|0.67|0.75|10013|2|73
SSG|Malabo|Guine Equatorial|GQ|3.76|8.71|0.18|0.40|0.50|9647|2|76
YYT|St. John's|Canada|CA|47.62|-52.75|0.18|1.10|0.95|8502|2|461
BSG|Bata|Guine Equatorial|GQ|1.91|9.81|0.17|0.40|0.50|10860|2|13
DZN|Zhezkazgan|Cazaquistao|KZ|47.71|67.74|0.17|0.67|0.75|8530|2|1250
KRS|Kristiansand|Noruega|NO|58.20|8.09|0.17|1.20|1.20|6677|2|57
KUO|Kuopio / Siilinjarvi|Finlandia|FI|63.01|27.80|0.17|1.30|1.10|9186|2|323
LGK|Langkawi|Malasia|MY|6.33|99.73|0.17|0.72|1.50|12500|2|29
NOS|Nosy Be|Madagascar|MG|-13.31|48.31|0.17|0.25|1.20|7185|2|36
PBH|Paro|Butao|BT|27.40|89.42|0.17|0.38|1.60|7431|2|7364
CEI|Chiang Rai|Tailandia|TH|19.95|99.88|0.16|0.60|2.00|9843|2|1280
POG|Port Gentil|Gabao|GA|-0.71|8.75|0.16|0.45|0.70|6234|2|13
PUY|Pula|Croacia|HR|44.89|13.92|0.16|0.75|2.10|9678|2|274
RAI|Praia|Cabo Verde|CV|14.94|-23.48|0.16|0.45|1.90|6890|2|230
SLL|Salalah|Oma|OM|17.04|54.09|0.16|0.95|1.30|13123|2|73
SNC|Salinas/La Libertad|Equador|EC|-2.21|-80.99|0.16|0.57|1.05|8629|2|18
NDB|Nouadhibou|Mauritania|MR|20.93|-17.03|0.15|0.30|0.60|7961|2|24
CRD|Comodoro Rivadavia|Argentina|AR|-45.79|-67.46|0.14|0.60|1.50|9219|2|189
DZA|Dzaoudzi|Maiote|YT|-12.81|45.28|0.14|0.70|1.30|6330|2|23
GOU|Garoua|Camaroes|CM|9.33|13.37|0.14|0.30|0.60|11032|2|794
KIM|Kimberley|Africa do Sul|ZA|-28.81|24.76|0.14|0.65|1.20|9843|2|3950
WTB|Toowoomba|Australia|AU|-27.56|151.79|0.14|1.20|1.40|9416|2|1509
AJF|Al-Jawf|Arabia Saudita|SA|29.78|40.10|0.13|0.97|1.10|12011|2|2261
CAY|Matoury|Guiana Francesa|GF|4.82|-52.36|0.13|0.85|1.00|10486|2|26
ENO|Encarnacion|Paraguai|PY|-27.23|-55.84|0.13|0.55|0.70|7218|2|659
FRW|Francistown|Botsuana|BW|-21.16|27.47|0.13|0.52|1.30|9843|2|3283
NAJ|Nakhchivan|Azerbaijao|AZ|39.19|45.46|0.13|0.70|1.00|10826|2|2863
OCS|Corisco Island|Guine Equatorial|GQ|0.91|9.33|0.13|0.40|0.50|10220|2|55
UME|Umea|Suecia|SE|63.79|20.28|0.13|1.23|1.00|7551|2|24
WVB|Walvis Bay|Namibia|NA|-22.98|14.65|0.13|0.45|1.30|11483|2|299
LLA|Lulea|Suecia|SE|65.54|22.12|0.12|1.23|1.00|10990|2|65
MZG|Huxi|Taiwan|TW|23.57|119.63|0.12|1.07|1.15|9843|2|103
OMO|Mostar|Bosnia e Herzegovina|BA|43.28|17.85|0.12|0.60|1.00|7874|2|156
PUQ|Punta Arenas|Chile|CL|-53.00|-70.85|0.12|0.70|1.30|9154|2|139
RKZ|Xigaze|China|CN|29.35|89.30|0.12|0.80|1.00|16404|2|12408
TOM|Timbuktu|Mali|ML|16.73|-3.01|0.12|0.24|0.60|6923|2|863
AQJ|Aqaba|Jordania|JO|29.61|35.02|0.11|0.70|1.20|9855|2|175
BZE|Belize City|Belize|BZ|17.54|-88.30|0.11|0.50|1.80|9678|2|15
IXZ|Port Blair|India|IN|11.64|92.73|0.11|0.52|0.90|10795|2|13
LPP|Lappeenranta|Finlandia|FI|61.04|28.14|0.11|1.30|1.10|8202|2|349
OZZ|Ouarzazate|Marrocos|MA|30.94|-6.91|0.11|0.54|1.65|9842|2|3782
VIL|Dakhla|Saara Ocidental|EH|23.72|-15.93|0.11|0.30|0.60|9842|2|36
AUA|Oranjestad|Aruba|AW|12.50|-70.01|0.10|0.75|2.00|9000|2|60
DBV|Dubrovnik|Croacia|HR|42.56|18.27|0.10|0.75|2.20|10597|2|527
KBV|Krabi|Tailandia|TH|8.10|98.99|0.10|0.50|2.00|9842|2|82
MBJ|Montego Bay|Jamaica|JM|18.50|-77.91|0.10|0.48|2.10|10039|2|4
OLB|Olbia|Italia|IT|40.90|9.52|0.10|1.00|1.40|9006|2|37
PKZ|Pakse|Laos|LA|15.13|105.78|0.10|0.32|1.10|7874|2|351
PPT|Papeete|Polinesia Francesa|PF|-17.55|-149.61|0.10|0.85|2.10|11360|2|5
RGL|Rio Gallegos|Argentina|AR|-51.61|-69.31|0.10|0.60|1.50|9022|2|61
RHO|Rodes|Grecia|GR|36.41|28.09|0.10|0.72|2.10|10846|2|17
SEZ|Mahe|Seicheles|SC|-4.67|55.52|0.10|0.85|2.10|9800|2|10
SSH|Sharm el-Sheikh|Egito|EG|27.98|34.39|0.10|0.45|2.10|10108|2|191
SXM|Philipsburg|Sint Maarten|SX|18.04|-63.11|0.10|0.72|2.00|7546|2|13
ZAD|Zadar|Croacia|HR|44.10|15.35|0.10|0.75|2.10|8202|2|289
BXY|Baikonur|Cazaquistao|KZ|45.62|63.21|0.09|0.67|0.75|10500|2|317
CHQ|Souda|Grecia|GR|35.53|24.15|0.09|0.77|2.10|10982|2|490
MUB|Maun|Botsuana|BW|-19.97|23.43|0.09|0.52|1.30|6562|2|3093
MYR|Myrtle Beach|EUA|US|33.68|-78.93|0.09|1.10|1.10|9503|2|25
ZIH|Ixtapa|Mexico|MX|17.60|-101.46|0.09|0.69|1.30|8222|2|26
AES|Alesund|Noruega|NO|62.56|6.11|0.08|1.20|1.20|7592|2|69
LAE|Lae|Papua-Nova Guine|PG|-6.57|146.73|0.08|0.34|0.90|8000|2|239
TMR|Tamanrasset|Argelia|DZ|22.81|5.45|0.08|0.60|0.70|11811|2|4518
TUK|Turbat|Paquistao|PK|25.98|63.03|0.08|0.40|0.60|9022|2|498
BSA|Bosaso|Somalia|SO|11.28|49.14|0.07|0.20|0.50|7874|2|3
DSY|Ta Noun|Camboja|KH|10.91|103.23|0.07|0.35|1.40|10498|2|60
FPO|Freeport|Bahamas|BS|26.56|-78.70|0.07|0.75|2.10|11019|2|7
GWD|Gurandani|Paquistao|PK|25.30|62.50|0.07|0.40|0.60|12000|2|61
HAH|Moroni|Comores|KM|-11.53|43.27|0.07|0.24|1.00|9514|2|93
RVN|Rovaniemi|Finlandia|FI|66.56|25.83|0.07|1.30|1.10|9849|2|642
VXE|Sao Pedro|Cabo Verde|CV|16.83|-25.06|0.07|0.45|1.90|6561|2|66
ADZ|San Andres|Colombia|CO|12.58|-81.71|0.06|0.55|1.10|7808|2|19
LPQ|Luang Phabang|Laos|LA|19.90|102.17|0.06|0.32|1.10|8202|2|955
MAH|Mahon|Espanha|ES|39.86|4.22|0.06|0.85|1.90|8366|2|302
TOS|Tromso|Noruega|NO|69.68|18.92|0.06|1.20|1.20|8041|2|31
VFA|Victoria Falls|Zimbabue|ZW|-18.10|25.84|0.06|0.30|0.90|13123|2|3490
ANU|Osbourn|Antigua e Barbuda|AG|17.14|-61.79|0.05|0.80|2.00|9003|2|62
CFU|Kerkyra|Grecia|GR|39.60|19.91|0.05|0.77|2.10|7792|2|6
MAJ|Majuro Atoll|Ilhas Marshall|MH|7.07|171.27|0.05|0.48|1.10|7897|2|6
SVD|Kingstown|Sao Vicente e Granadinas|VC|13.16|-61.15|0.05|0.62|1.80|9000|2|136
TMS|Sao Tome|Sao Tome e Principe|ST|0.38|6.71|0.05|0.30|1.40|7283|2|33
USM|Na Thon|Tailandia|TH|9.55|100.06|0.05|0.60|2.00|6759|2|64
UVF|Vieux Fort|Santa Lucia|LC|13.73|-60.95|0.05|0.65|1.90|9003|2|14
AEY|Akureyri|Islandia|IS|65.66|-18.07|0.04|1.15|2.10|8858|2|6
APW|Apia|Samoa|WS|-13.83|-172.01|0.04|0.40|1.50|9843|2|58
BBK|Kasane|Botsuana|BW|-17.83|25.17|0.04|0.52|1.30|6562|2|3289
BDA|Hamilton|Bermudas|BM|32.36|-64.68|0.04|1.30|1.80|9705|2|12
BIA|Bastia|Franca|FR|42.55|9.48|0.04|1.12|1.35|8266|2|26
BME|Broome|Australia|AU|-17.95|122.23|0.04|1.20|1.40|7769|2|56
BON|Kralendijk|Caribe Neerlandes|BQ|12.13|-68.27|0.04|0.85|1.90|9449|2|20
BOO|Bodo|Noruega|NO|67.27|14.37|0.04|1.20|1.20|9167|2|42
CCK|West Island|Ilhas Cocos|CC|-12.19|96.83|0.04|0.80|1.20|7999|2|10
CXI|Kiritimati|Quiribati|KI|1.99|-157.35|0.04|0.35|1.10|6900|2|5
DBB|El Alamein|Egito|EG|30.92|28.46|0.04|0.45|2.00|11479|2|154
DJG|Djanet|Argelia|DZ|24.29|9.46|0.04|0.60|0.70|9843|2|3176
DQM|Duqm|Oma|OM|19.50|57.63|0.04|0.95|1.30|13123|2|364
EIS|Beef Island|Ilhas Virgens Britanicas|VG|18.45|-64.54|0.04|0.95|2.00|4642|2|15
EVE|Evenes|Noruega|NO|68.49|16.68|0.04|1.20|1.20|9236|2|84
FAE|Vagar|Ilhas Feroe|FO|62.06|-7.28|0.04|1.15|1.50|5905|2|280
GAN|Gan|Maldivas|MV|-0.69|73.15|0.04|0.75|2.20|12000|2|6
GCM|George Town|Ilhas Cayman|KY|19.29|-81.36|0.04|1.25|2.00|7867|2|8
GND|Saint George's|Granada|GD|12.00|-61.79|0.04|0.62|1.80|9003|2|41
GOH|Nuuk|Groenlandia|GL|64.19|-51.68|0.04|1.00|1.60|7217|2|283
GXF|Seiyun|Iemen|YE|15.97|48.79|0.04|0.20|0.50|9843|2|2097
HAQ|Haa Dhaalu Atoll|Maldivas|MV|6.74|73.17|0.04|0.75|2.20|8087|2|4
HUX|Huatulco|Mexico|MX|15.78|-96.26|0.04|0.69|1.30|8858|2|464
IKU|Tamchy|Quirguistao|KG|42.59|76.70|0.04|0.32|0.90|12467|2|5425
IOM|Castletown|Ilha de Man|IM|54.08|-4.62|0.04|1.20|1.20|6923|2|52
IPC|Isla De Pascua|Chile|CL|-27.17|-109.42|0.04|0.70|1.30|10827|2|227
IVL|Ivalo|Finlandia|FI|68.61|27.41|0.04|1.30|1.10|8199|2|481
JTR|Santorini Island|Grecia|GR|36.40|25.48|0.04|0.77|2.10|7208|2|127
KGS|Kos Island|Grecia|GR|36.79|27.09|0.04|0.77|2.10|7841|2|412
KIH|Kish Island|Ira|IR|26.53|53.98|0.04|0.45|0.80|12004|2|101
KOA|Kailua-Kona|EUA|US|19.74|-156.05|0.04|1.10|1.10|11000|2|47
KRN|Kiruna|Suecia|SE|67.82|20.34|0.04|1.23|1.00|8209|2|1508
KSA|Okat|Micronesia|FM|5.36|162.96|0.04|0.50|1.20|5750|2|11
KTT|Kittila|Finlandia|FI|67.70|24.85|0.04|1.30|1.10|8202|2|644
LIH|Lihue, Kauai|EUA|US|21.97|-159.34|0.04|1.10|1.10|6500|2|153
LTO|Loreto|Mexico|MX|25.99|-111.35|0.04|0.69|1.30|7218|2|34
MFU|Mfuwe|Zambia|ZM|-13.26|31.94|0.04|0.32|0.80|7349|2|1853
NOC|Charlestown|Irlanda|IE|53.91|-8.82|0.04|1.15|1.15|7546|2|665
NUM|Sharma|Arabia Saudita|SA|27.92|35.29|0.04|0.97|1.10|12326|2|29
OEC|Oecussi-Ambeno|Timor-Leste|TL|-9.20|124.34|0.04|0.30|0.80|7218|2|320
PDL|Ponta Delgada|Portugal|PT|37.74|-25.70|0.04|0.84|1.90|8192|2|259
PHE|Port Hedland|Australia|AU|-20.38|118.63|0.04|1.20|1.40|8202|2|33
PLS|Providenciales|Ilhas Turcas e Caicos|TC|21.77|-72.27|0.04|0.90|2.10|9199|2|15
PPG|Pago Pago|Samoa Americana|AS|-14.33|-170.71|0.04|0.70|1.20|10000|2|32
RAR|Avarua|Ilhas Cook|CK|-21.20|-159.81|0.04|0.75|2.00|7638|2|19
RMF|Marsa Alam|Egito|EG|25.56|34.59|0.04|0.45|2.00|11253|2|213
ROP|Rota Island|Marianas do Norte|MP|14.17|145.24|0.04|0.75|1.70|6000|2|607
ROR|Babelthuap Island|Palau|PW|7.37|134.54|0.04|0.70|2.00|7200|2|176
RSI|Hanak|Arabia Saudita|SA|25.63|37.09|0.04|0.97|1.10|12139|2|140
SCR|Malung-Salen|Suecia|SE|61.17|12.83|0.04|1.23|1.00|8202|2|1608
SID|Espargos|Cabo Verde|CV|16.74|-22.95|0.04|0.45|1.90|10760|2|177
SKB|Basseterre|Sao Cristovao e Neves|KN|17.31|-62.72|0.04|0.78|1.90|7602|2|170
STT|Charlotte Amalie|Ilhas Virgens Americanas|VI|18.34|-64.98|0.04|0.90|2.00|7000|2|23
TAB|Scarborough|Trinidad e Tobago|TT|11.15|-60.83|0.04|0.80|0.90|9002|2|38
TBU|Nuku'alofa|Tonga|TO|-21.24|-175.15|0.04|0.45|1.50|8795|2|126
TKK|Weno Island|Micronesia|FM|7.46|151.84|0.04|0.50|1.20|6006|2|11
TQO|Tulum|Mexico|MX|20.17|-87.66|0.04|0.69|1.30|12139|2|66
TRW|South Tarawa|Quiribati|KI|1.38|173.15|0.04|0.35|1.10|6598|2|9
ULH|Al-Ula|Arabia Saudita|SA|26.48|38.12|0.04|0.97|1.10|10007|2|2050
UYU|Quijarro|Bolivia|BO|-20.44|-66.86|0.04|0.46|1.05|13123|2|11136
VAV|Vava'u Island|Tonga|TO|-18.59|-173.96|0.04|0.45|1.50|5593|2|236
VBY|Visby|Suecia|SE|57.66|18.35|0.04|1.23|1.00|6562|2|164
VLI|Port Vila|Vanuatu|VU|-17.70|168.32|0.04|0.38|1.60|8530|2|70
WLS|Wallis Island|Wallis e Futuna|WF|-13.24|-176.20|0.04|0.75|1.20|6890|2|79
YAP|Yap Island|Micronesia|FM|9.50|138.08|0.04|0.50|1.20|6000|2|91
ZSA|San Salvador|Bahamas|BS|24.06|-74.52|0.04|0.75|2.10|8000|2|24
TEB|Nova York|EUA|US|40.85|-74.06|29.35|1.40|1.50|6997|1|9
HPN|Nova York|EUA|US|41.07|-73.71|29.16|1.40|1.50|6549|1|439
VKO|Moscou|Russia|RU|55.59|37.26|22.06|0.75|0.90|11483|1|685
LCY|Londres|Reino Unido|GB|51.51|0.06|21.23|1.30|1.60|4948|1|19
UKB|Osaka|Japao|JP|34.63|135.22|19.26|1.25|1.50|8202|1|22
SEN|Southend-on-Sea|Reino Unido|GB|51.57|0.69|18.33|1.30|1.60|6089|1|49
SNA|Santa Ana|EUA|US|33.68|-117.87|15.48|1.40|1.90|5700|1|56
HHR|Los Angeles|EUA|US|33.92|-118.33|14.95|1.40|1.90|4884|1|66
BUR|Los Angeles|EUA|US|34.20|-118.36|14.47|1.40|1.90|6886|1|778
THR|Teera|Ira|IR|35.69|51.31|13.83|0.45|0.80|13258|1|3962
NBJ|Luanda|Angola|AO|-9.05|13.50|12.99|0.38|0.60|13123|1|550
PYK|Teera|Ira|IR|35.78|50.83|12.81|0.45|0.80|12005|1|4170
ISP|Islip|EUA|US|40.80|-73.10|10.36|1.40|1.50|7006|1|99
DTM|Dortmund|Alemanha|DE|51.52|7.61|10.06|1.08|0.80|6562|1|425
HSG|Saga|Japao|JP|33.15|130.30|7.53|1.20|1.20|6562|1|6
DAR|Dar es Salaam|Tanzania|TZ|-6.87|39.21|7.40|0.35|1.10|9843|1|182
USN|Ulsan|Coreia do Sul|KR|35.59|129.35|6.74|1.05|1.10|6561|1|45
YHU|Montreal|Canada|CA|45.52|-73.42|6.38|1.15|1.20|7840|1|90
TTN|Ewing Township|EUA|US|40.28|-74.81|6.35|1.20|1.00|6006|1|213
ANR|Bruxelas|Belgica|BE|51.19|4.46|6.19|1.30|1.10|4954|1|39
NRN|Weeze|Alemanha|DE|51.60|6.14|6.00|1.08|0.80|8005|1|106
CCR|Sao Francisco|EUA|US|37.99|-122.06|5.88|1.60|1.60|5001|1|26
BED|Boston|EUA|US|42.47|-71.29|5.76|1.45|1.20|7011|1|133
TNN|Kaohsiung|Taiwan|TW|22.95|120.21|5.76|1.00|1.00|10007|1|63
KKJ|Kitakyushu|Japao|JP|33.85|131.04|5.60|1.20|1.20|8202|1|21
RGN|Yangon|Mianmar|MM|16.91|96.13|5.40|0.30|0.70|11200|1|109
ORH|Worcester|EUA|US|42.27|-71.88|5.33|1.45|1.20|7001|1|1009
SOC|Surakarta|Indonesia|ID|-7.52|110.76|5.26|0.50|0.90|8530|1|421
PZB|Pietermaritzburg|Africa do Sul|ZA|-29.65|30.40|4.83|0.60|1.20|5043|1|2423
SFS|Olongapo|Filipinas|PH|14.79|120.27|4.69|0.45|0.90|9003|1|64
ADJ|Ama|Jordania|JO|31.97|35.99|4.62|0.70|1.20|10745|1|2555
KNU|Kanpur|India|IN|26.40|80.41|4.27|0.42|0.90|9000|1|410
BBU|Bucareste|Romenia|RO|44.50|26.10|4.20|0.75|0.90|10499|1|297
QSR|Salerno|Italia|IT|40.62|14.91|4.07|0.78|1.60|6437|1|123
TAK|Takamatsu|Japao|JP|34.21|134.02|3.97|1.25|1.50|8200|1|607
ILG|Filadelfia|EUA|US|39.68|-75.61|3.87|1.20|1.00|7275|1|80
FMO|Greven|Alemanha|DE|52.13|7.69|3.81|1.08|0.80|7119|1|160
EOH|Medellin|Colombia|CO|6.22|-75.59|3.74|0.65|1.30|8202|1|4949
CYI|Shuishang|Taiwan|TW|23.46|120.39|3.71|1.00|1.00|10007|1|85
PHG|Port Harcourt|Nigeria|NG|4.85|7.02|3.67|0.47|0.55|6923|1|57
IWK|Iwakuni|Japao|JP|34.15|132.25|3.51|1.23|1.50|8000|1|7
TVT|Tashkent|Uzbequistao|UZ|41.31|69.40|3.47|0.50|0.80|10630|1|1574
DLA|Duala|Camaroes|CM|4.01|9.72|3.40|0.30|0.60|9350|1|33
KTW|Katowice|Polonia|PL|50.48|19.08|3.39|0.82|1.60|10499|1|995
HVN|New Haven|EUA|US|41.26|-72.89|3.33|1.40|1.50|5600|1|12
PAD|Buren|Alemanha|DE|51.61|8.62|3.32|1.15|1.00|7152|1|699
UBJ|Ube|Japao|JP|33.93|131.28|3.29|1.20|1.20|8200|1|23
JOG|Yogyakarta|Indonesia|ID|-7.79|110.43|3.21|0.50|0.90|7215|1|379
TNR|Antananarivo|Madagascar|MG|-18.80|47.48|3.20|0.25|1.20|10171|1|4198
TIW|Seattle|EUA|US|47.27|-122.58|3.05|1.45|1.20|5002|1|294
SOU|Southampton|Reino Unido|GB|50.95|-1.36|2.97|1.05|1.10|6191|1|44
BZX|Bazhong|China|CN|31.74|106.64|2.96|0.80|1.00|8530|1|1804
BRS|Bristol|Reino Unido|GB|51.38|-2.72|2.94|1.05|1.10|6598|1|622
AZN|Andijan|Uzbequistao|UZ|40.73|72.29|2.92|0.50|0.80|9770|1|1515
LUN|Lusaka|Zambia|ZM|-15.33|28.45|2.90|0.32|0.80|12998|1|3779
BCD|Bacolod City|Filipinas|PH|10.78|123.02|2.81|0.47|1.05|6562|1|82
TKS|Tokushima|Japao|JP|34.13|134.61|2.73|1.25|1.50|6560|1|26
KTM|Katmandu|Nepal|NP|27.70|85.36|2.70|0.35|1.90|10991|1|4390
ASU|Assuncao|Paraguai|PY|-25.24|-57.52|2.50|0.55|0.70|10997|1|292
NGS|Nagasaki|Japao|JP|32.92|129.91|2.50|1.20|1.20|9840|1|15
RML|Colombo|Sri Lanka|LK|6.82|79.89|2.50|0.45|1.70|6013|1|22
SMR|Santa Marta|Colombia|CO|11.12|-74.23|2.49|0.55|0.80|5577|1|22
YCD|Nanaimo|Canada|CA|49.05|-123.87|2.48|1.30|1.50|6602|1|92
KPO|Pohang|Coreia do Sul|KR|35.99|129.42|2.37|1.05|1.10|7000|1|70
YND|Ottawa|Canada|CA|45.52|-75.56|2.32|1.05|0.90|6000|1|211
PNH|Phnom Penh|Camboja|KH|11.55|104.84|2.30|0.35|1.40|9843|1|40
PEI|Pereira|Colombia|CO|4.81|-75.74|2.29|0.55|1.10|6627|1|4416
MZL|Manizales|Colombia|CO|5.03|-75.46|2.27|0.55|1.10|4835|1|6871
EWB|New Bedford|EUA|US|41.68|-70.96|2.26|1.10|1.10|5400|1|80
MME|Darlington, Durham|Reino Unido|GB|54.51|-1.43|2.26|1.05|1.10|7516|1|120
ILS|San Salvador|El Salvador|SV|13.70|-89.12|2.10|0.45|0.90|7349|1|2027
LAL|Lakeland|Estados Unidos|US|27.99|-82.02|2.08|1.02|1.30|8500|1|142
AAZ|Quezaltenango|Guatemala|GT|14.87|-91.50|1.98|0.45|1.00|6900|1|7779
SRZ|Santa Cruz|Bolivia|BO|-17.81|-63.17|1.98|0.50|0.80|9098|1|1371
OCJ|Boscobel|Jamaica|JM|18.40|-76.97|1.95|0.45|1.20|4769|1|90
CAK|Akron|Estados Unidos|US|40.92|-81.44|1.91|0.95|0.70|8204|1|1228
JUH|Chizhou|China|CN|30.74|117.69|1.91|0.80|1.00|7874|1|60
OIT|Oita|Japao|JP|33.48|131.74|1.91|1.20|1.20|9840|1|19
VVI|Santa Cruz|Bolivia|BO|-17.64|-63.14|1.90|0.50|0.80|11483|1|1224
POP|Puerto Plata|Republica Dominicana|DO|19.76|-70.57|1.87|0.49|1.80|10108|1|15
TTU|Tetouan|Marrocos|MA|35.59|-5.32|1.85|0.54|1.65|10784|1|10
OZC|Ozamiz|Filipinas|PH|8.18|123.84|1.84|0.47|1.05|5720|1|75
MPM|Maputo|Mocambique|MZ|-25.92|32.57|1.80|0.30|0.80|12008|1|145
PHF|Newport News|EUA|US|37.13|-76.49|1.78|1.10|1.10|8003|1|42
FEG|Fergana|Uzbequistao|UZ|40.36|71.75|1.76|0.50|0.80|9383|1|1980
SRQ|Sarasota|Estados Unidos|US|27.39|-82.55|1.71|1.02|1.30|9500|1|30
PIK|Glasgow|Reino Unido|GB|55.50|-4.58|1.67|0.92|0.90|9800|1|65
MLW|Monrovia|Liberia|LR|6.29|-10.76|1.66|0.22|0.50|6000|1|25
MST|Maastricht|Holanda|NL|50.91|5.77|1.64|1.10|0.70|9022|1|375
VIT|Bilbao|Espanha|ES|42.88|-2.72|1.62|0.92|1.10|11483|1|1682
DSO|Sondong-ni|Coreia do Norte|KP|39.75|127.47|1.60|0.25|0.50|8210|1|12
HRE|Harare|Zimbabue|ZW|-17.93|31.09|1.60|0.30|0.90|15502|1|4887
PGH|Pantnagar|India|IN|29.03|79.47|1.60|0.52|0.90|4500|1|769
SLZ|Sao Luis|Brasil|BR|-2.59|-44.24|1.60|0.52|0.90|7828|1|178
FLR|Firenze|Italia|IT|43.81|11.20|1.52|1.00|1.40|5118|1|142
BLB|Cidade do Panama|Panama|PA|8.91|-79.60|1.50|0.80|1.20|8500|1|52
OGD|Salt Lake City|Estados Unidos|US|41.20|-112.01|1.44|1.08|1.00|8107|1|4473
LCK|Columbus|EUA|US|39.81|-82.93|1.40|1.10|1.10|12103|1|744
MGA|Managua|Nicaragua|NI|12.14|-86.17|1.40|0.35|0.80|8012|1|194
TGU|Tegucigalpa|Honduras|HN|14.06|-87.22|1.40|0.35|0.70|6112|1|3294
QSF|Setif|Argelia|DZ|36.18|5.33|1.39|0.60|0.70|9498|1|3360
CJN|Cijulang|Indonesia|ID|-7.72|108.49|1.38|0.50|0.90|4549|1|16
PSE|Ponce|Porto Rico|PR|18.01|-66.56|1.37|0.85|1.90|6904|1|29
SHL|Shillong|India|IN|25.70|91.98|1.36|0.52|0.90|6000|1|2910
SIG|San Juan|Porto Rico|PR|18.46|-66.10|1.36|0.85|1.90|5317|1|10
MIR|Monastir|Tunisia|TN|35.76|10.75|1.35|0.55|1.30|9678|1|9
UST|St Augustine|EUA|US|29.96|-81.34|1.32|1.10|1.10|8001|1|10
CUM|Cumana|Venezuela|VE|10.45|-64.13|1.29|0.45|0.70|10171|1|14
KCY|Krasnoyarsk|Russia|RU|56.18|92.55|1.27|0.71|1.05|5905|1|833
IGT|Sunzha|Russia|RU|43.32|45.01|1.25|0.71|1.05|9842|1|1165
VBS|Montichiari|Italia|IT|45.43|10.33|1.25|1.25|1.40|9810|1|355
XPL|Palmerola|Honduras|HN|14.38|-87.62|1.23|0.35|0.70|8064|1|2061
NRR|San Juan|Porto Rico|PR|18.25|-65.64|1.20|0.85|1.90|11000|1|38
CIY|Comiso|Italia|IT|37.00|14.61|1.18|0.75|1.40|8070|1|756
SVZ|San Antonio del Tachira|Venezuela|VE|7.84|-72.44|1.18|0.45|0.70|6135|1|1312
VRN|Caselle|Italia|IT|45.39|10.89|1.17|1.25|1.40|10064|1|239
BLV|Belleville|Estados Unidos|US|38.55|-89.84|1.15|1.02|0.70|10000|1|459
PMF|Parma|Italia|IT|44.83|10.30|1.15|1.25|1.40|6962|1|161
DND|Dundee|Reino Unido|GB|56.45|-3.03|1.14|0.92|0.90|4593|1|17
FRL|Forli|Italia|IT|44.19|12.07|1.11|1.00|1.40|7907|1|97
OLM|Olympia|EUA|US|46.97|-122.90|1.11|1.45|1.20|5500|1|209
AQP|Arequipa|Peru|PE|-16.34|-71.57|1.10|0.50|1.00|9777|1|8405
BYM|Bayamo|Cuba|CU|20.40|-76.62|1.09|0.40|1.70|6887|1|203
FNI|Nimes|Franca|FR|43.76|4.42|1.03|0.98|1.30|8005|1|309
WNP|Naga|Filipinas|PH|13.58|123.27|1.03|0.47|1.05|4599|1|142
BLJ|Batna|Argelia|DZ|35.75|6.31|1.02|0.60|0.70|9843|1|2697
ONJ|Kitaakita|Japao|JP|40.19|140.37|1.00|1.23|1.50|6562|1|292
SAP|San Pedro Sula|Honduras|HN|15.45|-87.92|1.00|0.38|0.70|9203|1|91
AVN|Avignon|Franca|FR|43.91|4.90|0.99|0.98|1.30|6168|1|124
FNT|Flint|EUA|US|42.97|-83.74|0.99|1.10|1.10|7852|1|782
JUJ|San Salvador de Jujuy|Argentina|AR|-24.39|-65.10|0.99|0.60|1.50|9698|1|3019
ADF|Adiyaman|Turquia|TR|37.73|38.47|0.97|0.65|1.30|8153|1|2216
TND|Trinidad|Cuba|CU|21.79|-80.00|0.95|0.40|1.70|5909|1|125
MSJ|Misawa|Japao|JP|40.70|141.37|0.94|1.23|1.50|10000|1|119
AXT|Akita|Japao|JP|39.62|140.22|0.93|1.23|1.50|8200|1|313
OGZ|Beslan|Russia|RU|43.21|44.61|0.92|0.71|1.05|9843|1|1673
CFG|Cienfuegos|Cuba|CU|22.15|-80.41|0.90|0.40|1.70|7874|1|102
VTE|Vientiane|Laos|LA|17.99|102.57|0.90|0.32|1.10|9843|1|564
JDF|Juiz de Fora|Brasil|BR|-21.79|-43.39|0.89|0.68|0.85|5036|1|2989
LUK|Cincinnati|Estados Unidos|US|39.10|-84.42|0.88|1.00|0.70|6101|1|483
BHD|Belfast|Reino Unido|GB|54.62|-5.87|0.87|1.05|1.10|6001|1|15
EAS|Hondarribia|Espanha|ES|43.36|-1.79|0.83|0.92|1.10|5755|1|16
IAG|Niagara Falls|EUA|US|43.11|-78.95|0.83|1.10|1.10|9826|1|589
ARK|Kilimanjaro|Tanzania|TZ|-3.37|36.63|0.82|0.30|1.80|5377|1|4550
IZO|Izumo|Japao|JP|35.41|132.89|0.81|1.23|1.50|6562|1|15
RJL|Logrono|Espanha|ES|42.46|-2.32|0.81|0.92|1.10|7218|1|1161
FDH|Friedrichshafen|Alemanha|DE|47.67|9.51|0.80|1.15|1.00|7729|1|1367
TLU|Santiago de Tolu|Colombia|CO|9.51|-75.59|0.80|0.55|1.10|4429|1|16
ZSE|Saint-Denis|Reuniao|RE|-21.32|55.42|0.80|0.85|1.50|7000|1|59
ABE|Allentown|EUA|US|40.65|-75.44|0.79|1.20|1.00|7599|1|393
KWZ|Kolwezi|Congo (Kinshasa)|CD|-10.77|25.51|0.79|0.22|0.50|5741|1|5007
PRA|Parana|Argentina|AR|-31.79|-60.48|0.79|0.60|1.50|6890|1|242
SZA|Soyo|Angola|AO|-6.14|12.37|0.79|0.38|0.60|5905|1|15
DNZ|Denizli|Turquia|TR|37.79|29.70|0.76|0.65|1.30|9842|1|2795
ECN|Larnaca|Chipre|CY|35.15|33.51|0.75|0.85|1.90|9039|1|404
PNA|Pamplona|Espanha|ES|42.77|-1.65|0.75|0.92|1.10|7241|1|1504
CNQ|Corrientes|Argentina|AR|-27.45|-58.76|0.73|0.60|1.50|6890|1|202
GOX|Goa|India|IN|15.74|73.86|0.73|0.52|2.00|11483|1|552
KAC|Qamishli|Siria|SY|37.02|41.19|0.73|0.25|0.50|11860|1|1480
MPL|Montpellier|Franca|FR|43.58|3.96|0.73|0.98|1.30|8530|1|17
TOW|Toledo|Brasil|BR|-24.69|-53.70|0.73|0.68|0.85|5479|1|1843
MFE|McAllen|EUA|US|26.18|-98.24|0.72|1.10|1.10|7120|1|107
BTS|Bratislava|Eslovaquia|SK|48.17|17.21|0.70|0.88|0.90|10466|1|436
SPY|San-Pedro|Costa do Marfim|CI|4.75|-6.66|0.70|0.35|0.80|6234|1|26
UDI|Uberlandia|Brasil|BR|-18.88|-48.23|0.70|0.82|0.60|6398|1|3094
KME|Kamembe|Ruanda|RW|-2.46|28.91|0.69|0.32|1.00|4921|1|5192
PUB|Pueblo|EUA|US|38.29|-104.50|0.69|1.10|1.10|10498|1|4726
DCM|Castres|Franca|FR|43.56|2.29|0.68|1.12|1.35|5988|1|788
IXY|Kandla|India|IN|23.11|70.10|0.68|0.52|0.90|4997|1|96
CMF|Chambery|Franca|FR|45.64|5.88|0.67|1.05|1.00|6628|1|779
GDQ|Azezo|Etiopia|ET|12.52|37.43|0.67|0.35|0.80|9072|1|6449
LCE|La Ceiba|Honduras|HN|15.74|-86.85|0.67|0.36|0.70|9875|1|39
LCG|Culleredo|Espanha|ES|43.30|-8.38|0.67|0.85|1.90|7178|1|326
PGD|Punta Gorda|EUA|US|26.92|-81.99|0.67|1.10|1.10|7193|1|26
PKR|Pokhara|Nepal|NP|28.20|83.98|0.67|0.35|1.90|4720|1|2712
ULV|Ulyanovsk|Russia|RU|54.27|48.23|0.64|0.71|1.05|12533|1|449
DEF|Dezful|Ira|IR|32.43|48.40|0.62|0.45|0.80|12641|1|474
MEG|Malanje|Angola|AO|-9.53|16.31|0.62|0.38|0.60|7283|1|3868
CZE|Coro|Venezuela|VE|11.41|-69.68|0.61|0.45|0.70|6761|1|52
HEH|Heho|Mianmar|MM|20.75|96.79|0.61|0.30|0.70|8500|1|3858
BJR|Bahir Dar|Etiopia|ET|11.61|37.32|0.60|0.35|0.80|9842|1|5978
LDB|Londrina|Brasil|BR|-23.33|-51.13|0.60|0.80|0.60|6890|1|1867
MQX|Mekele|Etiopia|ET|13.47|39.53|0.60|0.35|0.80|11811|1|7396
MVR|Maroua|Camaroes|CM|10.45|14.26|0.60|0.30|0.60|6890|1|1390
NYI|Sunyani|Gana|GH|7.36|-2.33|0.60|0.45|0.80|4594|1|1014
PVH|Porto Velho|Brasil|BR|-8.71|-63.90|0.60|0.60|0.60|7874|1|295
SDD|Lubango|Angola|AO|-14.92|13.58|0.60|0.38|0.60|10335|1|5778
SYO|Shonai|Japao|JP|38.81|139.79|0.60|1.23|1.50|6560|1|86
VTU|Las Tunas|Cuba|CU|20.99|-76.94|0.60|0.40|1.70|5971|1|328
KKW|Kikwit|Congo (Kinshasa)|CD|-5.04|18.79|0.59|0.22|0.50|5151|1|1572
LNS|Lancaster|EUA|US|40.12|-76.30|0.59|1.10|1.10|6933|1|403
ASM|Asmara|Eritreia|ER|15.29|38.91|0.58|0.20|0.50|9842|1|7661
MZO|Manzanillo|Cuba|CU|20.29|-77.09|0.58|0.40|1.70|7875|1|112
PBD|Porbandar|India|IN|21.65|69.66|0.58|0.52|0.90|4500|1|23
LSP|Paraguana|Venezuela|VE|11.78|-70.15|0.57|0.45|0.70|9186|1|75
PAG|Pagadian|Filipinas|PH|7.83|123.46|0.57|0.47|1.05|6574|1|5
PPN|Popayan|Colombia|CO|2.45|-76.61|0.57|0.55|1.10|6266|1|5687
UYL|Nyala|Sudao|SD|12.05|24.96|0.57|0.24|0.50|9880|1|2106
VSV|Shravasti|India|IN|27.50|82.03|0.57|0.52|0.90|5019|1|366
AHU|Al Hoceima|Marrocos|MA|35.18|-3.84|0.56|0.54|1.65|10511|1|95
MRA|Misrata|Libia|LY|32.33|15.06|0.56|0.40|0.50|11155|1|60
VRB|Vero Beach|EUA|US|27.66|-80.42|0.56|1.10|1.10|7314|1|24
ADU|Ardabil|Ira|IR|38.33|48.42|0.55|0.45|0.80|10823|1|4315
DIB|Dibrugarh|India|IN|27.48|95.02|0.55|0.52|0.90|6000|1|362
HGO|Korhogo|Costa do Marfim|CI|9.39|-5.56|0.55|0.35|0.80|6890|1|1214
SOM|El Tigre|Venezuela|VE|8.95|-64.15|0.55|0.45|0.70|6299|1|861
HJR|Khajuraho|India|IN|24.82|79.92|0.54|0.52|0.90|7460|1|728
MDK|Mbandaka|Congo (Kinshasa)|CD|0.02|18.29|0.53|0.22|0.50|7223|1|1040
PSO|Chachagui|Colombia|CO|1.40|-77.29|0.53|0.55|1.10|7585|1|5951
MKG|Muskegon|EUA|US|43.17|-86.24|0.52|1.10|1.10|6500|1|629
TGM|Recea|Romenia|RO|46.47|24.41|0.52|0.72|0.90|6562|1|963
UAQ|San Juan|Argentina|AR|-31.57|-68.42|0.52|0.60|1.50|8071|1|1958
VPY|Chimoio|Mocambique|MZ|-19.15|33.43|0.52|0.30|0.80|7874|1|2287
BZR|Beziers|Franca|FR|43.32|3.35|0.51|0.98|1.30|5971|1|56
SDG|Sanandaj|Ira|IR|35.25|47.01|0.51|0.45|0.80|8660|1|4522
TBB|Tuy Hoa|Vietna|VN|13.05|109.33|0.51|0.58|1.40|9520|1|20
BWX|Rogojampi, Banyuwangi|Indonesia|ID|-8.31|114.34|0.50|0.50|0.90|4593|1|112
CLJ|Cluj|Romenia|RO|46.79|23.69|0.50|0.72|0.90|6693|1|1039
ETR|Santa Rosa|Equador|EC|-3.44|-80.00|0.50|0.57|1.05|8625|1|20
LJU|Liubliana|Eslovenia|SI|46.22|14.46|0.50|0.95|1.10|10827|1|1273
MCP|Macapa|Brasil|BR|0.05|-51.07|0.50|0.55|0.60|6890|1|56
MVQ|Mogilev|Belarus|BY|53.95|30.10|0.50|0.55|0.70|8422|1|637
MVY|Martha's Vineyard|EUA|US|41.39|-70.61|0.50|1.10|1.10|5504|1|67
ONQ|Zonguldak|Turquia|TR|41.51|32.09|0.50|0.65|1.30|6991|1|44
UNA|Una|Brasil|BR|-15.35|-39.00|0.50|0.68|0.85|6234|1|23
BUX|Bunia|Congo (Kinshasa)|CD|1.57|30.22|0.49|0.22|0.50|8202|1|4045
DGT|Dumaguete City|Filipinas|PH|9.33|123.30|0.49|0.47|1.05|6220|1|15
NAL|Nalchik|Russia|RU|43.51|43.64|0.49|0.71|1.05|7218|1|1461
PPB|Presidente Prudente|Brasil|BR|-22.18|-51.42|0.49|0.68|0.85|6923|1|1477
TKF|Truckee|EUA|US|39.32|-120.14|0.49|1.10|1.10|7001|1|5900
JRH|Jorhat|India|IN|26.73|94.18|0.48|0.52|0.90|9000|1|311
KZR|Altintas|Turquia|TR|39.11|30.13|0.48|0.65|1.30|9843|1|3327
MII|Marilia|Brasil|BR|-22.20|-49.93|0.48|0.68|0.85|4921|1|2134
MYY|Miri|Malasia|MY|4.32|113.99|0.48|0.72|1.50|9006|1|59
TAP|Tapachula|Mexico|MX|14.79|-92.37|0.48|0.69|1.30|6562|1|97
ARU|Aracatuba|Brasil|BR|-21.14|-50.42|0.47|0.68|0.85|6955|1|1358
GXG|Negage|Angola|AO|-7.75|15.29|0.47|0.38|0.60|7874|1|4105
KOE|Kupang|Indonesia|ID|-10.17|123.67|0.47|0.50|0.90|8202|1|335
NLD|Nuevo Laredo|Mexico|MX|27.44|-99.57|0.47|0.69|1.30|6562|1|484
NYU|Nyaung U|Mianmar|MM|21.18|94.93|0.47|0.30|0.70|8500|1|312
VDH|Dong Hoi|Vietna|VN|17.52|106.59|0.47|0.58|1.40|7874|1|59
MRX|Mahshahr|Ira|IR|30.56|49.15|0.46|0.45|0.80|8874|1|8
NVA|Neiva|Colombia|CO|2.95|-75.29|0.46|0.55|1.10|5880|1|1464
PDT|Pendleton|EUA|US|45.70|-118.84|0.46|1.10|1.10|6301|1|1497
STM|Santarem|Brasil|BR|-2.42|-54.79|0.46|0.68|0.85|7874|1|198
ARW|Arad|Romenia|RO|46.18|21.26|0.45|0.73|0.90|6562|1|352
BMI|Bloomington/Normal|EUA|US|40.48|-88.92|0.45|1.10|1.10|8000|1|871
BRO|Brownsville|EUA|US|25.91|-97.43|0.45|1.10|1.10|7399|1|22
EBD|El-Obeid|Sudao|SD|13.15|30.23|0.45|0.24|0.50|9843|1|1927
GBB|Gabala|Azerbaijao|AZ|40.81|47.73|0.45|0.70|1.00|11811|1|935
HEK|Heihe|China|CN|50.17|127.31|0.45|0.80|1.00|8202|1|1047
KEP|Nepalgunj|Nepal|NP|28.10|81.67|0.45|0.35|1.90|4935|1|540
TWU|Tawau|Malasia|MY|4.31|118.12|0.45|0.72|1.50|8800|1|57
WOS|Wonsan|Coreia do Norte|KP|39.17|127.49|0.45|0.25|0.50|11482|1|7
BKS|Bengkulu|Indonesia|ID|-3.86|102.34|0.44|0.50|0.90|7345|1|50
CFR|Caen|Franca|FR|49.18|-0.45|0.44|1.12|1.35|6233|1|256
DIU|Diu|India|IN|20.71|70.92|0.44|0.52|0.90|5980|1|31
DMU|Dimapur|India|IN|25.88|93.77|0.44|0.52|0.90|7513|1|487
DUE|Chitato|Angola|AO|-7.40|20.82|0.44|0.38|0.60|6468|1|2451
KSL|Kassala|Sudao|SD|15.39|36.33|0.44|0.24|0.50|8202|1|1671
MVF|Mossoro|Brasil|BR|-5.20|-37.36|0.44|0.68|0.85|6562|1|76
PAZ|Poza Rica|Mexico|MX|20.60|-97.46|0.44|0.69|1.30|5906|1|497
SDK|Sandakan|Malasia|MY|5.90|118.06|0.44|0.72|1.50|8202|1|46
SZY|Szymany|Polonia|PL|53.48|20.94|0.44|0.81|1.10|8202|1|463
FJR|Fujairah|Emirados|AE|25.11|56.33|0.43|1.35|2.20|10007|1|152
IMP|Imperatriz|Brasil|BR|-5.53|-47.46|0.43|0.68|0.85|5899|1|430
SGD|Sonderborg|Dinamarca|DK|54.96|9.79|0.43|1.40|1.30|5895|1|24
SLD|Sliac|Eslovaquia|SK|48.64|19.13|0.43|0.88|0.90|7874|1|1043
TPQ|Tepic|Mexico|MX|21.42|-104.84|0.43|0.69|1.30|10171|1|3020
ATW|Appleton|EUA|US|44.26|-88.52|0.42|1.10|1.10|8003|1|918
FLA|Florencia|Colombia|CO|1.59|-75.56|0.42|0.55|1.10|4921|1|803
TEE|Tebessi|Argelia|DZ|35.43|8.12|0.42|0.60|0.70|9843|1|2661
VAS|Sivas|Turquia|TR|39.81|36.90|0.42|0.65|1.30|12503|1|5239
VLL|Valladolid|Espanha|ES|41.71|-4.85|0.42|0.85|1.90|9843|1|2776
CJZ|Cajazeiras|Brasil|BR|-6.88|-38.62|0.41|0.68|0.85|5249|1|1099
DUM|Dumai|Indonesia|ID|1.61|101.43|0.41|0.50|0.90|5905|1|55
ERS|Windhoek|Namibia|NA|-22.60|17.08|0.41|0.45|1.30|7381|1|5575
IEG|Nowe Kramsko|Polonia|PL|52.14|15.80|0.41|0.81|1.10|8202|1|194
ISE|Isparta|Turquia|TR|37.86|30.37|0.41|0.65|1.30|9843|1|2835
KRP|Karup|Dinamarca|DK|56.30|9.10|0.41|1.40|1.30|9816|1|170
SBW|Sibu|Malasia|MY|2.26|111.99|0.41|0.72|1.50|9036|1|122
TBO|Tabora|Tanzania|TZ|-5.08|32.83|0.41|0.32|1.45|6234|1|3868
ANF|Antofagasta|Chile|CL|-23.45|-70.45|0.40|0.70|0.70|9186|1|455
BVB|Boa Vista|Brasil|BR|2.85|-60.69|0.40|0.58|0.70|8858|1|276
DHM|Kangra|India|IN|32.16|76.26|0.40|0.52|0.90|4620|1|2525
GDB|Gondia|India|IN|21.53|80.29|0.40|0.52|0.90|7500|1|987
JJD|Cruz|Brasil|BR|-2.91|-40.36|0.40|0.68|0.85|7218|1|89
PSS|Posadas|Argentina|AR|-27.39|-55.97|0.40|0.60|1.50|7388|1|430
PXU|Pleiku|Vietna|VN|14.00|108.02|0.40|0.58|1.40|7874|1|2434
TPS|Trapani|Italia|IT|37.91|12.49|0.40|0.72|1.40|8852|1|25
VVC|Villavicencio|Colombia|CO|4.17|-73.61|0.40|0.55|1.10|5616|1|1394
WDH|Windhoek|Namibia|NA|-22.48|17.47|0.40|0.45|1.30|15010|1|5640
AGH|Angelholm|Suecia|SE|56.30|12.85|0.39|1.23|1.00|6381|1|68
BAY|Tautii-Magheraus|Romenia|RO|47.66|23.46|0.39|0.73|0.90|7054|1|605
BUZ|Bushehr|Ira|IR|28.94|50.83|0.39|0.45|0.80|14664|1|68
CSW|Los Cabos|Mexico|MX|22.95|-109.94|0.39|0.70|2.10|6998|1|459
IXI|Lilabari|India|IN|27.30|94.10|0.39|0.52|0.90|7500|1|330
KMW|Kostroma|Russia|RU|57.80|41.02|0.39|0.71|1.05|5577|1|446
KSQ|Karshi|Uzbequistao|UZ|38.80|65.77|0.39|0.50|0.80|9299|1|1230
MAB|Maraba|Brasil|BR|-5.37|-49.14|0.39|0.68|0.85|6562|1|357
MSR|Mus|Turquia|TR|38.75|41.66|0.39|0.65|1.30|11649|1|4157
NCY|Annecy|Franca|FR|45.93|6.10|0.39|1.05|1.00|5348|1|1521
OSW|Orsk|Russia|RU|51.07|58.60|0.39|0.71|1.05|9514|1|909
PLW|Palu|Indonesia|ID|-0.92|119.91|0.39|0.50|0.90|6781|1|284
TUA|Tulcan|Equador|EC|0.81|-77.71|0.39|0.57|1.05|8071|1|9649
ZND|Zinder|Niger|NE|13.78|8.98|0.39|0.20|0.50|5988|1|1516
FLZ|Sibolga|Indonesia|ID|1.56|98.89|0.38|0.50|0.90|5655|1|33
GEL|Santo Angelo|Brasil|BR|-28.28|-54.17|0.38|0.68|0.85|5331|1|1056
HGI|Hollongi|India|IN|26.97|93.64|0.38|0.52|0.90|7546|1|328
LMM|Los Mochis|Mexico|MX|25.69|-109.08|0.38|0.69|1.30|6562|1|16
NVI|Navoi|Uzbequistao|UZ|40.12|65.17|0.38|0.50|0.80|13123|1|1140
RXS|Roxas City|Filipinas|PH|11.60|122.75|0.38|0.47|1.05|6201|1|10
CSG|Columbus|EUA|US|32.52|-84.94|0.37|1.10|1.10|6997|1|397
HHQ|Hua Hin|Tailandia|TH|12.64|99.95|0.37|0.60|2.00|6890|1|62
MNC|Nacala|Mocambique|MZ|-14.49|40.71|0.37|0.30|0.80|10171|1|410
SLI|Solwesi|Zambia|ZM|-12.17|26.37|0.37|0.32|0.80|8858|1|4551
TIV|Tivat|Montenegro|ME|42.40|18.72|0.37|0.62|1.70|8208|1|20
UEL|Quelimane|Mocambique|MZ|-17.86|36.87|0.37|0.30|0.80|5905|1|36
AXU|Axum|Etiopia|ET|14.15|38.77|0.36|0.35|0.80|7874|1|6959
BHI|Bahia Blanca|Argentina|AR|-38.73|-62.17|0.36|0.60|1.50|7907|1|246
BJB|Bojnord|Ira|IR|37.49|57.31|0.36|0.45|0.80|10582|1|3499
BSX|Pathein|Mianmar|MM|16.82|94.78|0.36|0.30|0.70|4400|1|20
CKS|Parauapebas|Brasil|BR|-6.12|-50.00|0.36|0.68|0.85|6562|1|2064
EUG|Eugene|EUA|US|44.12|-123.21|0.36|1.10|1.10|8009|1|374
MAZ|Mayaguez|Porto Rico|PR|18.26|-67.15|0.36|0.85|1.90|4998|1|28
PAV|Paulo Afonso|Brasil|BR|-9.40|-38.25|0.36|0.68|0.85|5906|1|883
AJL|Aizawl|India|IN|23.84|92.62|0.35|0.52|0.90|8202|1|1398
ELU|Guemar|Argelia|DZ|33.51|6.78|0.35|0.60|0.70|9843|1|203
FAY|Fayetteville|EUA|US|34.99|-78.88|0.35|1.10|1.10|7709|1|189
JIM|Jimma|Etiopia|ET|7.67|36.82|0.35|0.35|0.80|10236|1|5500
KDI|Kendari|Indonesia|ID|-4.08|122.42|0.35|0.50|0.90|6890|1|538
KYP|Kyaukpyu|Mianmar|MM|19.43|93.53|0.35|0.30|0.70|4600|1|20
PHB|Parnaiba|Brasil|BR|-2.89|-41.73|0.35|0.68|0.85|6890|1|23
PTO|Pato Branco|Brasil|BR|-26.22|-52.69|0.35|0.68|0.85|5318|1|2697
SBN|South Bend|EUA|US|41.71|-86.32|0.35|1.10|1.10|8412|1|799
BTR|Baton Rouge|EUA|US|30.53|-91.15|0.34|1.10|1.10|7500|1|70
CEE|Cherepovets|Russia|RU|59.27|38.02|0.34|0.71|1.05|8202|1|377
CUP|Carupano|Venezuela|VE|10.66|-63.26|0.34|0.45|0.70|6611|1|33
LNK|Lincoln|EUA|US|40.84|-96.76|0.34|1.10|1.10|12901|1|1219
LOH|La Toma|Equador|EC|-4.00|-79.37|0.34|0.57|1.05|6725|1|4056
LSC|La Serena-Coquimbo|Chile|CL|-29.92|-71.20|0.34|0.70|1.30|6358|1|481
RIA|Santa Maria|Brasil|BR|-29.71|-53.69|0.34|0.68|0.85|8839|1|287
RNS|Saint-Jacques-de-la-Lande,|Franca|FR|48.07|-1.73|0.34|1.12|1.35|6890|1|124
SUJ|Satu Mare|Romenia|RO|47.70|22.89|0.34|0.73|0.90|8160|1|405
TEZ|Nagaon|India|IN|26.71|92.78|0.34|0.52|0.90|9010|1|240
AMH|Arba Minch|Etiopia|ET|6.04|37.59|0.33|0.35|0.80|9170|1|3901
BZO|Bolzano|Italia|IT|46.46|11.33|0.33|1.00|1.40|5708|1|789
CHM|Chimbote|Peru|PE|-9.15|-78.52|0.33|0.52|1.50|5905|1|69
CVM|Ciudad Victoria|Mexico|MX|23.70|-98.96|0.33|0.69|1.30|7218|1|761
DEC|Decatur|EUA|US|39.83|-88.87|0.33|1.10|1.10|8496|1|682
HCJ|Hechi|China|CN|24.80|107.71|0.33|0.80|1.00|7218|1|2221
IXS|Silchar|India|IN|24.91|92.98|0.33|0.52|0.90|5993|1|352
KET|Kengtung|Mianmar|MM|21.30|99.64|0.33|0.30|0.70|7815|1|2798
MWQ|Magway|Mianmar|MM|20.17|94.94|0.33|0.30|0.70|8530|1|279
NAW|Yala|Tailandia|TH|6.52|101.74|0.33|0.60|2.00|8202|1|16
PGK|Pangkal Pinang|Indonesia|ID|-2.16|106.14|0.33|0.50|0.90|7382|1|109
RZR|Ramsar|Ira|IR|36.91|50.69|0.33|0.45|0.80|7448|1|-70
VPS|Valparaiso|EUA|US|30.48|-86.52|0.33|1.10|1.10|12004|1|87
FWA|Fort Wayne|EUA|US|40.98|-85.19|0.32|1.10|1.10|11981|1|814
ITH|Ithaca|EUA|US|42.49|-76.46|0.32|1.10|1.10|6977|1|1099
KXK|Komsomolsk-on-Amur|Russia|RU|50.41|136.93|0.32|0.71|1.05|8202|1|92
LBU|Labuan|Malasia|MY|5.30|115.25|0.32|0.72|1.50|9006|1|101
LRD|Laredo|EUA|US|27.54|-99.46|0.32|1.10|1.10|8743|1|508
MLI|Moline|EUA|US|41.45|-90.51|0.32|1.10|1.10|10002|1|590
NRK|Norrkoping|Suecia|SE|58.59|16.25|0.32|1.23|1.00|7228|1|32
OPP|Salinopolis|Brasil|BR|-0.70|-47.34|0.32|0.68|0.85|6102|1|105
PKY|Palangkaraya|Indonesia|ID|-2.23|113.94|0.32|0.50|0.90|8202|1|82
SBP|San Luis Obispo|EUA|US|35.24|-120.64|0.32|1.10|1.10|6101|1|212
TCQ|Tacna|Peru|PE|-18.05|-70.28|0.32|0.52|1.50|8202|1|1538
TRK|Tarakan|Indonesia|ID|3.33|117.56|0.32|0.50|0.90|7382|1|23
VOL|Nea Anchialos|Grecia|GR|39.22|22.79|0.32|0.77|2.10|9052|1|83
YBG|Saguenay|Canada|CA|48.33|-70.99|0.32|1.10|0.95|10000|1|522
BQS|Blagoveschensk|Russia|RU|50.43|127.42|0.31|0.71|1.05|9256|1|638
CXB|Cox's Bazar|Bangladesh|BD|21.46|91.96|0.31|0.35|0.50|6790|1|12
CYP|Calbayog City|Filipinas|PH|12.07|124.55|0.31|0.47|1.05|4843|1|12
GVR|Governador Valadares|Brasil|BR|-18.90|-41.98|0.31|0.68|0.85|5581|1|561
HAU|Karmoy|Noruega|NO|59.35|5.21|0.31|1.20|1.20|6957|1|86
KRO|Kurgan|Russia|RU|55.48|65.42|0.31|0.71|1.05|8530|1|240
MYP|Mary|Turcomenistao|TM|37.62|61.90|0.31|0.45|0.60|12467|1|728
PBR|Puerto Barrios|Guatemala|GT|15.73|-88.58|0.31|0.45|1.00|8880|1|33
PES|Petrozavodsk|Russia|RU|61.89|34.15|0.31|0.71|1.05|8202|1|151
XNA|Fayetteville/Springdale/Ro|EUA|US|36.28|-94.31|0.31|1.10|1.10|8801|1|1287
YQR|Regina|Canada|CA|50.43|-104.66|0.31|1.10|0.95|7900|1|1894
ELF|El Fasher|Sudao|SD|13.61|25.32|0.30|0.24|0.50|9744|1|2393
HUU|Huanuco|Peru|PE|-9.88|-76.20|0.30|0.52|1.50|8202|1|6070
LPT|Lampang|Tailandia|TH|18.27|99.50|0.30|0.60|2.00|6465|1|811
LRH|La Rochelle|Franca|FR|46.18|-1.20|0.30|1.12|1.35|7398|1|74
MBS|Freeland|EUA|US|43.53|-84.08|0.30|1.10|1.10|8002|1|668
MSZ|Mocamedes|Angola|AO|-15.26|12.15|0.30|0.38|0.60|8202|1|210
OGX|Ouargla|Argelia|DZ|31.92|5.41|0.30|0.60|0.70|10171|1|492
ORK|Cork|Irlanda|IE|51.84|-8.49|0.30|1.00|0.90|6998|1|502
PMC|Puerto Montt|Chile|CL|-41.44|-73.09|0.30|0.62|1.40|8694|1|294
PMW|Palmas|Brasil|BR|-10.29|-48.36|0.30|0.65|0.60|8202|1|774
RZV|Rize|Turquia|TR|41.18|40.85|0.30|0.65|1.30|9843|1|16
SCW|Syktyvkar|Russia|RU|61.65|50.85|0.30|0.71|1.05|8203|1|342
TGR|Touggourt|Argelia|DZ|33.07|6.09|0.30|0.60|0.70|9843|1|279
YYF|Penticton|Canada|CA|49.46|-119.60|0.30|1.10|0.95|6000|1|1129
AAX|Araxa|Brasil|BR|-19.56|-46.96|0.29|0.68|0.85|6234|1|3276
BWO|Balakovo|Russia|RU|51.86|47.75|0.29|0.71|1.05|7710|1|95
CRV|Isola di Capo Rizzuto|Italia|IT|39.00|17.08|0.29|1.00|1.40|6562|1|522
DPL|Dipolog|Filipinas|PH|8.60|123.34|0.29|0.47|1.05|6273|1|12
EJA|Barrancabermeja|Colombia|CO|7.02|-73.81|0.29|0.55|1.10|5905|1|412
GCH|Gachsaran|Ira|IR|30.33|50.83|0.29|0.45|0.80|6070|1|2414
GPT|Gulfport|EUA|US|30.41|-89.07|0.29|1.10|1.10|9002|1|28
HGR|Hagerstown|EUA|US|39.71|-77.73|0.29|1.10|1.10|7000|1|703
IPL|Imperial|EUA|US|32.84|-115.57|0.29|1.10|1.10|5308|1|-54
LAJ|Lages|Brasil|BR|-27.78|-50.28|0.29|0.68|0.85|5020|1|3065
LPI|Linkoping|Suecia|SE|58.40|15.68|0.29|1.23|1.00|7004|1|172
SEB|Sabha|Libia|LY|26.99|14.47|0.29|0.40|0.50|11778|1|1427
SMX|Santa Maria|EUA|US|34.90|-120.46|0.29|1.10|1.10|8004|1|261
SZK|Skukuza|Africa do Sul|ZA|-24.96|31.59|0.29|0.65|1.20|5085|1|1020
THS|Phitsanulok|Tailandia|TH|17.24|99.82|0.29|0.60|2.00|6890|1|179
TRT|Toraja|Indonesia|ID|-3.18|119.92|0.29|0.50|0.90|6562|1|2884
ARI|Arica|Chile|CL|-18.35|-70.34|0.28|0.70|1.30|9186|1|167
BJZ|Badajoz|Espanha|ES|38.89|-6.82|0.28|0.85|1.90|9350|1|609
BKZ|Bukoba|Tanzania|TZ|-1.33|31.82|0.28|0.32|1.45|4535|1|3784
BTK|Bratsk|Russia|RU|56.37|101.70|0.28|0.71|1.05|10368|1|1610
GNV|Gainesville|EUA|US|29.69|-82.27|0.28|1.10|1.10|7504|1|152
GSP|Greenville/Greer/Spartanbu|EUA|US|34.90|-82.22|0.28|1.10|1.10|11001|1|964
HHH|Hilton Head Island|EUA|US|32.22|-80.70|0.28|1.10|1.10|5000|1|19
HMI|Hami|China|CN|42.84|93.67|0.28|0.80|1.00|7874|1|2703
IZT|Ixtepec|Mexico|MX|16.45|-95.09|0.28|0.69|1.30|7640|1|164
JAN|Jackson|EUA|US|32.31|-90.08|0.28|1.10|1.10|8500|1|346
LAN|Lansing|EUA|US|42.78|-84.59|0.28|1.10|1.10|8506|1|861
LMN|Limbang|Malasia|MY|4.81|115.01|0.28|0.72|1.50|4922|1|14
MGM|Montgomery|EUA|US|32.30|-86.39|0.28|1.10|1.10|9020|1|221
NLT|Xinyuan|China|CN|43.43|83.38|0.28|0.80|1.00|7546|1|3050
PGV|Greenville|EUA|US|35.64|-77.38|0.28|1.10|1.10|7175|1|26
RCH|Riohacha|Colombia|CO|11.53|-72.93|0.28|0.55|1.10|5413|1|43
ROO|Rondonopolis|Brasil|BR|-16.58|-54.72|0.28|0.68|0.85|6070|1|1467
SDE|Santiago del Estero|Argentina|AR|-27.77|-64.31|0.28|0.60|1.50|7946|1|656
SHV|Shreveport|EUA|US|32.44|-93.83|0.28|1.10|1.10|8348|1|258
TMJ|Termez|Uzbequistao|UZ|37.29|67.31|0.28|0.50|0.80|9843|1|1027
TUR|Tucurui|Brasil|BR|-3.79|-49.72|0.28|0.68|0.85|6562|1|830
VJB|Xai-Xai|Mocambique|MZ|-24.89|33.75|0.28|0.30|0.80|5906|1|291
VXC|Lichinga|Mocambique|MZ|-13.27|35.27|0.28|0.30|0.80|8300|1|4505
APO|Carepa|Colombia|CO|7.81|-76.72|0.27|0.55|1.10|7153|1|46
BTC|Batticaloa|Sri Lanka|LK|7.71|81.68|0.27|0.45|1.70|5118|1|20
CKZ|Canakkale|Turquia|TR|40.14|26.43|0.27|0.65|1.30|7710|1|23
CMI|Savoy|EUA|US|40.04|-88.28|0.27|1.10|1.10|8101|1|755
CYS|Cheyenne|EUA|US|41.16|-104.81|0.27|1.10|1.10|9270|1|6159
GPA|Patras|Grecia|GR|38.15|21.43|0.27|0.77|2.10|10997|1|46
LAF|West Lafayette|EUA|US|40.41|-86.94|0.27|1.10|1.10|6600|1|606
LBB|Lubbock|EUA|US|33.66|-101.82|0.27|1.10|1.10|11500|1|3282
MAF|Midland|EUA|US|31.94|-102.20|0.27|1.10|1.10|9501|1|2871
MBX|Maribor|Eslovenia|SI|46.48|15.69|0.27|0.95|1.10|8202|1|876
MKM|Mukah|Malasia|MY|2.88|112.04|0.27|0.72|1.50|4921|1|20
MYW|Mtwara|Tanzania|TZ|-10.34|40.18|0.27|0.32|1.45|7410|1|371
ROT|Rotorua|Nova Zelandia|NZ|-38.11|176.32|0.27|1.12|1.65|5321|1|935
SDW|Chipi|India|IN|16.00|73.53|0.27|0.52|2.00|8202|1|203
TJL|Tres Lagoas|Brasil|BR|-20.75|-51.68|0.27|0.68|0.85|6562|1|1063
UBP|Ubon Ratchathani|Tailandia|TH|15.25|104.87|0.27|0.60|2.00|9848|1|406
AJI|Agri|Turquia|TR|39.66|43.03|0.26|0.65|1.30|9843|1|5462
BGG|Bingol|Turquia|TR|38.86|40.59|0.26|0.65|1.30|7546|1|3506
BMO|Banmaw|Mianmar|MM|24.27|97.25|0.26|0.30|0.70|5502|1|370
FDU|Bandundu|Congo (Kinshasa)|CD|-3.31|17.38|0.26|0.22|0.50|4528|1|1063
GIL|Gilgit|Paquistao|PK|35.92|74.33|0.26|0.40|0.60|5400|1|4796
IRP|Isiro|Congo (Kinshasa)|CD|2.83|27.59|0.26|0.22|0.50|8202|1|2438
JKG|Jonkoping|Suecia|SE|57.76|14.07|0.26|1.23|1.00|7228|1|741
LLO|Palopo|Indonesia|ID|-3.08|120.24|0.26|0.50|0.90|4593|1|14
PHS|Phitsanulok|Tailandia|TH|16.78|100.28|0.26|0.60|2.00|9843|1|154
SAF|Santa Fe|EUA|US|35.62|-106.09|0.26|1.10|1.10|8366|1|6348
SET|Serra Talhada|Brasil|BR|-8.06|-38.33|0.26|0.68|0.85|5905|1|1542
SJI|San Jose|Filipinas|PH|12.36|121.05|0.26|0.47|1.05|6024|1|14
SOB|Sarmellek|Hungria|HU|46.69|17.16|0.26|0.85|1.60|8202|1|408
TGO|Tongliao|China|CN|43.56|122.20|0.26|0.80|1.00|7546|1|2395
THN|Trollhattan|Suecia|SE|58.32|12.35|0.26|1.23|1.00|5610|1|137
ZIG|Ziguinchor|Senegal|SN|12.56|-16.28|0.26|0.35|1.00|5069|1|75
AVL|Asheville|EUA|US|35.44|-82.54|0.25|1.10|1.10|8002|1|2165
AZS|Samana|Republica Dominicana|DO|19.27|-69.74|0.25|0.49|1.80|9843|1|30
CAE|Columbia|EUA|US|33.94|-81.12|0.25|1.10|1.10|8601|1|236
CCZ|Chub Cay|Bahamas|BS|25.42|-77.88|0.25|0.75|2.10|5000|1|5
CPE|Campeche|Mexico|MX|19.82|-90.50|0.25|0.69|1.30|8202|1|34
ERC|Erzincan|Turquia|TR|39.71|39.53|0.25|0.65|1.30|9843|1|3783
HYA|Hyannis|EUA|US|41.67|-70.28|0.25|1.10|1.10|5425|1|54
INH|Inhambane|Mocambique|MZ|-23.88|35.41|0.25|0.30|0.80|4921|1|30
KKC|Khon Kaen|Tailandia|TH|16.47|102.78|0.25|0.60|2.00|10007|1|670
LAP|La Paz|Mexico|MX|24.07|-110.36|0.25|0.69|1.30|8202|1|69
LDY|Derry, Derry and Strabane|Reino Unido|GB|55.04|-7.16|0.25|1.05|1.10|6460|1|22
LPY|Chaspuzac, Haute-Loire|Franca|FR|45.08|3.76|0.25|1.12|1.35|4570|1|2731
LSW|Lhok Seumawe-Sumatra|Indonesia|ID|5.23|96.95|0.25|0.50|0.90|6070|1|90
LYH|Lynchburg|EUA|US|37.33|-79.20|0.25|1.10|1.10|7100|1|938
OBO|Obihiro|Japao|JP|42.73|143.22|0.25|1.23|1.50|8202|1|505
ROI|Roi Et|Tailandia|TH|16.12|103.77|0.25|0.60|2.00|6890|1|451
SPP|Menongue|Angola|AO|-14.66|17.72|0.25|0.38|0.60|11483|1|4469
STC|Saint Cloud|EUA|US|45.55|-94.06|0.25|1.10|1.10|7500|1|1031
TAT|Poprad|Eslovaquia|SK|49.07|20.24|0.25|0.88|0.90|8530|1|2356
ZOS|Osorno|Chile|CL|-40.61|-73.06|0.25|0.70|1.30|6398|1|187
ACT|Waco|EUA|US|31.61|-97.23|0.24|1.10|1.10|7107|1|516
AFZ|Sabzevar|Ira|IR|36.17|57.60|0.24|0.45|0.80|10428|1|3010
BBO|Berbera|Somalia|SO|10.39|44.94|0.24|0.20|0.50|13582|1|30
BPT|Beaumont/Port Arthur|EUA|US|29.95|-94.02|0.24|1.10|1.10|6751|1|15
BQN|Aguadilla|Porto Rico|PR|18.49|-67.13|0.24|0.85|1.90|11702|1|237
BVS|Breves|Brasil|BR|-1.64|-50.44|0.24|0.68|0.85|5249|1|98
EYP|Yopal|Colombia|CO|5.32|-72.38|0.24|0.55|1.10|8448|1|1028
GMZ|Alajero|Espanha|ES|28.03|-17.21|0.24|0.82|2.00|4921|1|716
HDS|Hoedspruit|Africa do Sul|ZA|-24.36|31.05|0.24|0.65|1.20|13094|1|1801
LLK|Lankaran|Azerbaijao|AZ|38.76|48.81|0.24|0.70|1.00|10837|1|30
NGE|N'Gaoundere|Camaroes|CM|7.36|13.56|0.24|0.30|0.60|8858|1|3655
ORB|Orebro|Suecia|SE|59.22|15.04|0.24|1.23|1.00|10728|1|188
PKV|Pskov|Russia|RU|57.78|28.39|0.24|0.71|1.05|8281|1|154
SLM|Salamanca|Espanha|ES|40.95|-5.50|0.24|0.85|1.90|8245|1|2595
TLI|Toli Toli-Celebes Island|Indonesia|ID|1.12|120.79|0.24|0.50|0.90|4593|1|17
TTE|Ternate|Indonesia|ID|0.83|127.38|0.24|0.50|0.90|5875|1|49
ZAL|Valdivia|Chile|CL|-39.65|-73.09|0.24|0.70|1.30|6870|1|59
ACE|San Bartolome|Espanha|ES|28.95|-13.61|0.23|0.85|1.90|7874|1|46
BRA|Barreiras|Brasil|BR|-12.08|-45.01|0.23|0.68|0.85|5249|1|2451
BRX|Barahona|Republica Dominicana|DO|18.25|-71.12|0.23|0.49|1.80|9843|1|10
CLV|Caldas Novas|Brasil|BR|-17.73|-48.61|0.23|0.68|0.85|6890|1|2307
EBJ|Esbjerg|Dinamarca|DK|55.53|8.55|0.23|1.40|1.30|8527|1|97
EWN|New Bern|EUA|US|35.07|-77.04|0.23|1.10|1.10|6452|1|18
HDF|Zirchow|Alemanha|DE|53.88|14.15|0.23|1.15|1.00|7562|1|94
JIC|Jinchang|China|CN|38.54|102.35|0.23|0.80|1.00|9843|1|4740
KND|Kindu|Congo (Kinshasa)|CD|-2.92|25.92|0.23|0.22|0.50|7218|1|1630
LBJ|Labuan Bajo, Manggarai|Indonesia|ID|-8.48|119.89|0.23|0.50|0.90|7381|1|66
LOO|Laghouat|Argelia|DZ|33.76|2.93|0.23|0.60|0.70|12486|1|2510
OAL|Cacoal|Brasil|BR|-11.50|-61.45|0.23|0.68|0.85|6890|1|778
OWB|Owensboro|EUA|US|37.74|-87.17|0.23|1.10|1.10|8000|1|407
PGF|Perpignan/Rivesaltes|Franca|FR|42.74|2.87|0.23|1.12|1.35|8202|1|144
POL|Pemba|Mocambique|MZ|-12.99|40.52|0.23|0.30|0.80|5905|1|331
RKV|Reiquiavique|Islandia|IS|64.13|-21.94|0.23|1.15|2.10|5138|1|48
ROA|Roanoke|EUA|US|37.33|-79.98|0.23|1.10|1.10|6800|1|1175
SGF|Springfield|EUA|US|37.25|-93.39|0.23|1.10|1.10|8000|1|1268
TRG|Tauranga|Nova Zelandia|NZ|-37.67|176.20|0.23|1.12|1.65|5988|1|13
UMU|Umuarama|Brasil|BR|-23.80|-53.31|0.23|0.68|0.85|4692|1|1552
BMU|Bima|Indonesia|ID|-8.54|118.69|0.22|0.50|0.90|5405|1|3
DSI|Destin|EUA|US|30.40|-86.47|0.22|1.10|1.10|5001|1|23
EVV|Evansville|EUA|US|38.04|-87.53|0.22|1.10|1.10|8021|1|418
FMA|Formosa|Argentina|AR|-26.21|-58.23|0.22|0.60|1.50|5905|1|193
HLZ|Hamilton|Nova Zelandia|NZ|-37.87|175.33|0.22|1.12|1.65|6755|1|172
KHK|Khark|Ira|IR|29.26|50.32|0.22|0.45|0.80|5922|1|17
KZI|Kozani|Grecia|GR|40.29|21.84|0.22|0.77|2.10|5978|1|2059
OLA|Orland|Noruega|NO|63.70|9.60|0.22|1.20|1.20|10755|1|28
OPS|Sinop|Brasil|BR|-11.89|-55.59|0.22|0.68|0.85|5348|1|1227
SOQ|Sorong|Indonesia|ID|-0.89|131.29|0.22|0.50|0.90|6070|1|10
SVB|Sambava|Madagascar|MG|-14.28|50.17|0.22|0.25|1.20|4577|1|20
TDX|Laem Ngop|Tailandia|TH|12.27|102.32|0.22|0.60|2.00|5899|1|105
TLH|Tallahassee|EUA|US|30.40|-84.35|0.22|1.10|1.10|8000|1|81
TSV|Townsville|Australia|AU|-19.25|146.77|0.22|1.20|1.40|7999|1|18
ULU|Gulu|Uganda|UG|2.81|32.27|0.22|0.30|1.10|10314|1|3510
ZLO|Manzanillo|Mexico|MX|19.14|-104.56|0.22|0.69|1.30|7218|1|30
AAT|Altay|China|CN|47.75|88.09|0.21|0.80|1.00|7218|1|2460
AKY|Sittwe|Mianmar|MM|20.13|92.87|0.21|0.30|0.70|6001|1|27
BTU|Bintulu|Malasia|MY|3.12|113.02|0.21|0.72|1.50|9006|1|74
CLL|College Station|EUA|US|30.59|-96.36|0.21|1.10|1.10|7000|1|320
CSK|Cap Skirring|Senegal|SN|12.40|-16.75|0.21|0.35|1.00|6573|1|52
DIG|Diqing|China|CN|27.79|99.68|0.21|0.80|1.00|11647|1|10761
GGG|Longview|EUA|US|32.38|-94.71|0.21|1.10|1.10|10000|1|365
GHA|El Atteuf|Argelia|DZ|32.38|3.79|0.21|0.60|0.70|10171|1|1512
GTO|Gorontalo|Indonesia|ID|0.64|122.85|0.21|0.50|0.90|8202|1|105
MDT|Harrisburg|EUA|US|40.19|-76.76|0.21|1.10|1.10|10001|1|310
MZI|Sevare|Mali|ML|14.51|-4.08|0.21|0.24|0.60|8340|1|906
NSH|Nowshahr|Ira|IR|36.66|51.46|0.21|0.45|0.80|6677|1|-61
PUF|Pau/Pyrenees|Franca|FR|43.38|-0.42|0.21|1.12|1.35|8202|1|616
SPI|Springfield|EUA|US|39.84|-89.68|0.21|1.10|1.10|8001|1|598
WUU|Wau|Sudao do Sul|SS|7.73|27.98|0.21|0.20|0.50|8202|1|1529
ALW|Walla Walla|EUA|US|46.09|-118.29|0.20|1.10|1.10|6527|1|1194
AMA|Amarillo|EUA|US|35.22|-101.71|0.20|1.10|1.10|13502|1|3607
BCA|Baracoa|Cuba|CU|20.37|-74.51|0.20|0.40|1.70|6070|1|26
BIQ|Biarritz|Franca|FR|43.47|-1.52|0.20|1.12|1.35|7382|1|245
BRC|Bariloche|Argentina|AR|-41.15|-71.16|0.20|0.58|1.90|7703|1|2774
CJA|Cajamarca|Peru|PE|-7.14|-78.49|0.20|0.52|1.50|8201|1|8781
CRM|Catarman|Filipinas|PH|12.50|124.64|0.20|0.47|1.05|4429|1|6
DRW|Darwin|Australia|AU|-12.41|130.88|0.20|0.95|1.20|11004|1|103
GMA|Gemena|Congo (Kinshasa)|CD|3.24|19.77|0.20|0.22|0.50|6550|1|1378
HBA|Hobart|Australia|AU|-42.84|147.51|0.20|1.00|1.40|8947|1|13
ILM|Wilmington|EUA|US|34.27|-77.91|0.20|1.10|1.10|8016|1|32
JGD|Jiagedaqi|China|CN|50.37|124.12|0.20|0.80|1.00|7546|1|1205
JRO|Kilimanjaro|Tanzania|TZ|-3.43|37.07|0.20|0.30|1.80|11811|1|2932
JYV|Jyvaskylan Maalaiskunta|Finlandia|FI|62.40|25.68|0.20|1.30|1.10|8533|1|459
KHT|Khost|Afeganistao|AF|33.28|69.81|0.20|0.22|0.50|8740|1|4204
MBD|Mafeking|Africa do Sul|ZA|-25.80|25.55|0.20|0.65|1.20|15157|1|4181
MCN|Macon|EUA|US|32.69|-83.65|0.20|1.10|1.10|6500|1|354
MMB|Ozora|Japao|JP|43.88|144.16|0.20|1.23|1.50|8202|1|135
MVB|Franceville|Gabao|GA|-1.66|13.44|0.20|0.45|0.70|10105|1|1450
NOU|Noumea|Nova Caledonia|NC|-22.01|166.21|0.20|0.90|1.70|10663|1|52
NST|Nakhon Si Thammarat|Tailandia|TH|8.54|99.94|0.20|0.60|2.00|6890|1|13
PDS|Piedras Negras|Mexico|MX|28.63|-100.54|0.20|0.69|1.30|6655|1|901
PIS|Poitiers/Biard|Franca|FR|46.59|0.31|0.20|1.12|1.35|7710|1|423
SPS|Wichita Falls|EUA|US|33.99|-98.49|0.20|1.10|1.10|13100|1|1019
TRD|Trondheim|Noruega|NO|63.46|10.92|0.20|1.15|0.90|9052|1|56
TYL|Talara|Peru|PE|-4.58|-81.25|0.20|0.52|1.50|8038|1|282
TYR|Tyler|EUA|US|32.35|-95.40|0.20|1.10|1.10|8334|1|544
YUM|Yuma|EUA|US|32.65|-114.61|0.20|1.10|1.10|13300|1|213
AHO|Alghero|Italia|IT|40.63|8.29|0.19|1.00|1.40|9843|1|87
CME|Ciudad del Carmen|Mexico|MX|18.65|-91.80|0.19|0.69|1.30|7218|1|10
CTC|Catamarca|Argentina|AR|-28.59|-65.75|0.19|0.60|1.50|9186|1|1522
FAR|Fargo|EUA|US|46.92|-96.82|0.19|1.10|1.10|9001|1|902
GNS|Gunungsitoli|Indonesia|ID|1.17|97.71|0.19|0.50|0.90|4445|1|20
JPR|Ji-Parana|Brasil|BR|-10.87|-61.85|0.19|0.68|0.85|5906|1|598
KVK|Apatity|Russia|RU|67.46|33.59|0.19|0.71|1.05|8202|1|515
KYS|Kayes|Mali|ML|14.48|-11.40|0.19|0.24|0.60|8858|1|164
LEN|La Virgen del Camino|Espanha|ES|42.59|-5.65|0.19|0.85|1.90|9843|1|3006
PMY|Puerto Madryn|Argentina|AR|-42.76|-65.10|0.19|0.60|1.50|8202|1|427
REL|Rawson|Argentina|AR|-43.21|-65.27|0.19|0.60|1.50|8399|1|141
SRT|Soroti|Uganda|UG|1.73|33.62|0.19|0.30|1.10|6100|1|3697
SSY|Mbanza Congo|Angola|AO|-6.27|14.25|0.19|0.38|0.60|5905|1|1860
VRC|Virac|Filipinas|PH|13.58|124.21|0.19|0.47|1.05|5118|1|121
ABT|Al-Baha|Arabia Saudita|SA|20.30|41.64|0.18|0.97|1.10|10991|1|5486
ATM|Altamira|Brasil|BR|-3.25|-52.25|0.18|0.68|0.85|6572|1|368
AUX|Araguaina|Brasil|BR|-7.23|-48.24|0.18|0.68|0.85|5919|1|771
AZO|Kalamazoo|EUA|US|42.23|-85.55|0.18|1.10|1.10|6502|1|874
BBM|Battambang|Camboja|KH|13.10|103.22|0.18|0.35|1.40|5250|1|59
ERH|Errachidia|Marrocos|MA|31.95|-4.40|0.18|0.54|1.65|10499|1|3428
HRI|Mattala|Sri Lanka|LK|6.28|81.12|0.18|0.45|1.70|11483|1|157
IRJ|La Rioja|Argentina|AR|-29.38|-66.80|0.18|0.60|1.50|9383|1|1437
NZH|Manzhouli|China|CN|49.57|117.33|0.18|0.80|1.00|9186|1|2231
SST|Santa Teresita|Argentina|AR|-36.54|-56.72|0.18|0.60|1.50|4921|1|9
SZE|Semera|Etiopia|ET|11.79|40.99|0.18|0.35|0.80|8202|1|1390
TBP|Tumbes|Peru|PE|-3.55|-80.38|0.18|0.52|1.50|8202|1|115
TLE|Toliara|Madagascar|MG|-23.38|43.73|0.18|0.25|1.20|6562|1|29
TRI|Blountville|EUA|US|36.48|-82.41|0.18|1.10|1.10|8000|1|1519
URT|Surat Thani|Tailandia|TH|9.13|99.14|0.18|0.60|2.00|9843|1|20
UTT|Mthatha|Africa do Sul|ZA|-31.55|28.67|0.18|0.65|1.20|8530|1|2400
YSB|Sudbury|Canada|CA|46.62|-80.80|0.18|1.10|0.95|6600|1|1141
AVP|Wilkes-Barre/Scranton|EUA|US|41.34|-75.72|0.17|1.10|1.10|7502|1|962
BWK|Split|Croacia|HR|43.28|16.68|0.17|0.75|2.10|5774|1|1776
CBH|Bechar|Argelia|DZ|31.65|-2.27|0.17|0.60|0.70|12245|1|2661
CJC|Calama|Chile|CL|-22.50|-68.90|0.17|0.70|1.30|9974|1|7543
COU|Columbia|EUA|US|38.82|-92.22|0.17|1.10|1.10|7401|1|889
CTM|Chetumal|Mexico|MX|18.50|-88.33|0.17|0.69|1.30|7244|1|39
DTB|Siborong-Borong|Indonesia|ID|2.26|98.99|0.17|0.50|0.90|7875|1|4700
ENE|Ende|Indonesia|ID|-8.85|121.66|0.17|0.50|0.90|5440|1|49
FSD|Sioux Falls|EUA|US|43.59|-96.74|0.17|1.10|1.10|9000|1|1429
KFS|Kastamonu|Turquia|TR|41.31|33.80|0.17|0.65|1.30|7382|1|3520
KOS|Preah Sihanouk|Camboja|KH|10.57|103.63|0.17|0.35|1.40|8202|1|33
KUH|Kushiro|Japao|JP|43.04|144.19|0.17|1.23|1.50|8202|1|327
LDU|Lahad Datu|Malasia|MY|5.03|118.32|0.17|0.72|1.50|4498|1|45
LEC|Lencois|Brasil|BR|-12.48|-41.28|0.17|0.68|0.85|6831|1|1676
LFT|Lafayette|EUA|US|30.21|-91.99|0.17|1.10|1.10|8000|1|42
LUQ|San Luis|Argentina|AR|-33.27|-66.36|0.17|0.60|1.50|9678|1|2328
MGZ|Mkeik|Mianmar|MM|12.44|98.62|0.17|0.30|0.70|8795|1|75
MOF|Waioti|Indonesia|ID|-8.64|122.24|0.17|0.50|0.90|5980|1|115
OSI|Osijek|Croacia|HR|45.46|18.81|0.17|0.75|2.10|8202|1|290
PDP|Punta del Este|Uruguai|UY|-34.86|-55.09|0.17|0.85|1.10|6998|1|95
PFQ|Parsabad|Ira|IR|39.60|47.88|0.17|0.45|0.80|8515|1|251
RJN|Rafsanjan|Ira|IR|30.30|56.05|0.17|0.45|0.80|9814|1|5298
SMQ|Sampit|Indonesia|ID|-2.50|112.97|0.17|0.50|0.90|6060|1|50
YKO|Hakkari|Turquia|TR|37.55|44.24|0.17|0.65|1.30|10499|1|6400
AGS|Augusta|EUA|US|33.37|-81.96|0.16|1.10|1.10|8001|1|144
AHA|Ambikapur|India|IN|22.99|83.20|0.16|0.52|0.90|6299|1|1930
AYP|Ayacucho|Peru|PE|-13.15|-74.20|0.16|0.52|1.50|9186|1|8917
CCF|Carcassonne|Franca|FR|43.22|2.31|0.16|1.12|1.35|6726|1|433
CHO|Charlottesville|EUA|US|38.14|-78.45|0.16|1.10|1.10|6801|1|639
DEM|Dembidollo|Etiopia|ET|8.55|34.86|0.16|0.35|0.80|6168|1|5200
FMI|Kalemie|Congo (Kinshasa)|CD|-5.88|29.25|0.16|0.22|0.50|5741|1|2569
GMB|Gambela|Etiopia|ET|8.13|34.56|0.16|0.35|0.80|8248|1|1614
GYM|Guaymas|Mexico|MX|27.97|-110.93|0.16|0.69|1.30|7710|1|59
KSY|Kars|Turquia|TR|40.56|43.12|0.16|0.65|1.30|11483|1|5889
LIG|Limoges/Bellegarde|Franca|FR|45.86|1.18|0.16|1.12|1.35|8202|1|1300
LSH|Lashio|Mianmar|MM|22.98|97.75|0.16|0.30|0.70|5285|1|2450
MAK|Malakal|Sudao do Sul|SS|9.56|31.65|0.16|0.20|0.50|6562|1|1291
MBE|Monbetsu|Japao|JP|44.30|143.40|0.16|1.23|1.50|6562|1|80
MFR|Medford|EUA|US|42.37|-122.87|0.16|1.10|1.10|8800|1|1335
MLN|Melilla|Espanha|ES|35.28|-2.96|0.16|0.85|1.90|4701|1|156
MSL|Muscle Shoals|EUA|US|34.75|-87.61|0.16|1.10|1.10|6693|1|551
PMR|Palmerston North|Nova Zelandia|NZ|-40.32|175.62|0.16|1.12|1.65|6240|1|151
POR|Pori|Finlandia|FI|61.46|21.80|0.16|1.30|1.10|7713|1|44
RJK|Rijeka|Croacia|HR|45.22|14.57|0.16|0.75|2.10|8164|1|278
RST|Rochester|EUA|US|43.91|-92.50|0.16|1.10|1.10|9034|1|1317
SNX|Semnan|Ira|IR|35.59|53.50|0.16|0.45|0.80|11739|1|3665
SWO|Stillwater|EUA|US|36.16|-97.09|0.16|1.10|1.10|7401|1|1000
TBJ|Tabarka|Tunisia|TN|36.98|8.88|0.16|0.55|1.30|9416|1|230
TDK|Taldykorgan|Cazaquistao|KZ|45.12|78.44|0.16|0.67|0.75|9846|1|1925
TGQ|Tangara da Serra|Brasil|BR|-14.66|-57.44|0.16|0.68|0.85|4921|1|1473
TJA|Tarija|Bolivia|BO|-21.56|-64.70|0.16|0.46|1.05|10007|1|6079
TTT|Taitung City|Taiwan|TW|22.75|121.10|0.16|1.07|1.15|7999|1|143
BGM|Binghamton|EUA|US|42.21|-75.98|0.15|1.10|1.10|7305|1|1636
CPO|Copiapo|Chile|CL|-27.26|-70.78|0.15|0.70|1.30|7218|1|670
HAD|Halmstad|Suecia|SE|56.69|12.82|0.15|1.23|1.00|7419|1|101
ITB|Itaituba|Brasil|BR|-4.24|-56.00|0.15|0.68|0.85|5577|1|110
LDE|Tarbes/Lourdes/Pyrenees|Franca|FR|43.18|-0.01|0.15|1.12|1.35|9843|1|1260
LSE|La Crosse|EUA|US|43.88|-91.26|0.15|1.10|1.10|8742|1|655
NPE|Napier|Nova Zelandia|NZ|-39.47|176.87|0.15|1.12|1.65|5741|1|6
RAE|Arar|Arabia Saudita|SA|30.91|41.14|0.15|0.97|1.10|10007|1|1813
SHD|Weyers Cave|EUA|US|38.26|-78.90|0.15|1.10|1.10|6002|1|1201
TJG|Tanta-Tabalong|Indonesia|ID|-2.22|115.44|0.15|0.50|0.90|4601|1|197
TOE|Tozeur|Tunisia|TN|33.94|8.11|0.15|0.55|1.30|10581|1|287
UIB|Quibdo|Colombia|CO|5.69|-76.64|0.15|0.55|1.10|4593|1|204
YQM|Moncton|Canada|CA|46.11|-64.68|0.15|1.10|0.95|10001|1|232
ZPC|Pucon|Chile|CL|-39.29|-71.92|0.15|0.70|1.30|5576|1|853
CCC|Cayo Coco|Cuba|CU|22.46|-78.33|0.14|0.40|1.70|9842|1|13
CJL|Chitral|Paquistao|PK|35.89|71.80|0.14|0.40|0.60|5741|1|4920
DIE|Antisiranana|Madagascar|MG|-12.35|49.29|0.14|0.25|1.20|4921|1|374
DPO|Devonport|Australia|AU|-41.17|146.43|0.14|1.20|1.40|6030|1|33
LAW|Lawton|EUA|US|34.57|-98.42|0.14|1.10|1.10|8599|1|1110
OAJ|Richlands|EUA|US|34.83|-77.61|0.14|1.10|1.10|7100|1|94
OKY|Toowoomba|Australia|AU|-27.41|151.74|0.14|1.20|1.40|5410|1|1335
PGU|Khiyaroo|Ira|IR|27.38|52.74|0.14|0.45|0.80|13115|1|27
RDZ|Rodez/Marcillac|Franca|FR|44.41|2.48|0.14|1.12|1.35|6693|1|1910
TIM|Timika|Indonesia|ID|-4.53|136.89|0.14|0.50|0.90|7841|1|103
TJQ|Tanjung Pandan|Indonesia|ID|-2.74|107.75|0.14|0.50|0.90|8202|1|164
TRA|Tarama|Japao|JP|24.65|124.68|0.14|1.23|1.50|4921|1|36
TVY|Dawei|Mianmar|MM|14.10|98.20|0.14|0.30|0.70|12013|1|84
TWC|Tumxuk|China|CN|39.89|79.23|0.14|0.80|1.00|8530|1|3566
WAG|Wanganui|Nova Zelandia|NZ|-39.96|175.02|0.14|1.12|1.65|4521|1|27
YUS|Yushu|China|CN|32.84|97.04|0.14|0.80|1.00|12467|1|12816
ABI|Abilene|EUA|US|32.41|-99.68|0.13|1.10|1.10|7208|1|1791
ACF|Aral|China|CN|40.43|81.26|0.13|0.80|1.00|9186|1|3314
AOO|Altoona|EUA|US|40.30|-78.32|0.13|1.10|1.10|5465|1|1503
ASO|Asosa|Etiopia|ET|10.02|34.59|0.13|0.35|0.80|8218|1|5100
BDB|Bundaberg|Australia|AU|-24.91|152.32|0.13|1.20|1.40|6562|1|107
BKN|Balkanabat|Turcomenistao|TM|39.68|54.21|0.13|0.45|0.60|10499|1|-26
BVE|Brive|Franca|FR|45.04|1.49|0.13|1.12|1.35|6890|1|1016
BVH|Vilhena|Brasil|BR|-12.69|-60.10|0.13|0.68|0.85|8530|1|2018
CZS|Cruzeiro Do Sul|Brasil|BR|-7.60|-72.77|0.13|0.68|0.85|7874|1|637
DUD|Dunedin|Nova Zelandia|NZ|-45.93|170.20|0.13|1.12|1.65|6234|1|4
EGC|Bergerac|Franca|FR|44.83|0.52|0.13|1.12|1.35|7234|1|171
GAQ|Gao|Mali|ML|16.25|-0.01|0.13|0.24|0.60|8202|1|870
KSZ|Kotlas|Russia|RU|61.24|46.70|0.13|0.71|1.05|4757|1|184
LOE|Loei|Tailandia|TH|17.44|101.72|0.13|0.60|2.00|6890|1|860
MKK|Kaunakakai|Estados Unidos|US|21.15|-157.10|0.13|1.00|2.10|4494|1|454
MKW|Manokwari|Indonesia|ID|-0.89|134.05|0.13|0.50|0.90|6562|1|23
MPH|Caticlan|Filipinas|PH|11.92|121.95|0.13|0.47|1.05|5905|1|7
RHD|Termas de Rio Hondo|Argentina|AR|-27.50|-64.94|0.13|0.60|1.50|8232|1|935
SGU|St George|EUA|US|37.04|-113.51|0.13|1.10|1.10|9300|1|2941
TBT|Tabatinga|Brasil|BR|-4.26|-69.94|0.13|0.68|0.85|7054|1|263
TRR|Trincomalee|Sri Lanka|LK|8.54|81.18|0.13|0.45|1.70|7850|1|6
TST|Trang|Tailandia|TH|7.51|99.62|0.13|0.60|2.00|6890|1|67
UCT|Ukhta|Russia|RU|63.57|53.80|0.13|0.71|1.05|8691|1|482
URG|Uruguaiana|Brasil|BR|-29.78|-57.04|0.13|0.68|0.85|4921|1|256
YKM|Yakima|EUA|US|46.57|-120.54|0.13|1.10|1.10|7604|1|1099
AFA|San Rafael|Argentina|AR|-34.59|-68.40|0.12|0.60|1.50|6923|1|2470
BHE|Blenheim|Nova Zelandia|NZ|-41.52|173.87|0.12|1.12|1.65|4675|1|109
BHH|Bisha|Arabia Saudita|SA|19.98|42.62|0.12|0.97|1.10|10007|1|3887
BIL|Billings|EUA|US|45.81|-108.54|0.12|1.10|1.10|10518|1|3652
BQB|Busselton|Australia|AU|-33.69|115.40|0.12|1.20|1.40|8071|1|55
BXR|Bam|Ira|IR|29.08|58.45|0.12|0.45|0.80|11107|1|3231
CMG|Corumba|Brasil|BR|-19.01|-57.67|0.12|0.68|0.85|4921|1|463
CWA|Mosinee|EUA|US|44.78|-89.67|0.12|1.10|1.10|7723|1|1277
DAV|David|Panama|PA|8.39|-82.44|0.12|0.80|1.20|8530|1|89
ERI|Erie|EUA|US|42.08|-80.17|0.12|1.10|1.10|8420|1|732
FTU|Tolanaro|Madagascar|MG|-25.04|46.96|0.12|0.25|1.20|5280|1|29
JSI|Skiathos|Grecia|GR|39.18|23.50|0.12|0.77|2.10|5341|1|54
KOP|Nakhon Phanom|Tailandia|TH|17.38|104.64|0.12|0.60|2.00|8203|1|587
KSO|Argos Orestiko|Grecia|GR|40.45|21.28|0.12|0.77|2.10|8852|1|2167
KYZ|Kyzyl|Russia|RU|51.67|94.40|0.12|0.71|1.05|8858|1|2123
LCH|Lake Charles|EUA|US|30.13|-93.22|0.12|1.10|1.10|6500|1|15
LKM|Lolak|Indonesia|ID|0.89|124.03|0.12|0.50|0.90|5249|1|28
LRR|Lar|Ira|IR|27.67|54.38|0.12|0.45|0.80|10397|1|2641
LRU|Las Cruces|EUA|US|32.29|-106.92|0.12|1.10|1.10|7506|1|4456
LWS|Lewiston|EUA|US|46.37|-117.01|0.12|1.10|1.10|6511|1|1442
LZG|Nanchong|China|CN|31.50|106.03|0.12|0.80|1.00|11811|1|1444
MAQ|Mae Sot|Tailandia|TH|16.70|98.55|0.12|0.60|2.00|4921|1|690
MGH|Margate|Africa do Sul|ZA|-30.86|30.34|0.12|0.65|1.20|4495|1|495
MKQ|Merauke|Indonesia|ID|-8.52|140.42|0.12|0.50|0.90|6070|1|10
MYT|Myitkyina|Mianmar|MM|25.38|97.35|0.12|0.30|0.70|6100|1|475
NSN|Nelson|Nova Zelandia|NZ|-41.30|173.22|0.12|1.12|1.65|4420|1|17
OND|Ondangwa|Namibia|NA|-17.88|15.95|0.12|0.45|1.30|9800|1|3599
PEM|Puerto Maldonado|Peru|PE|-12.61|-69.23|0.12|0.52|1.50|11482|1|659
PUW|Pullman|EUA|US|46.74|-117.11|0.12|1.10|1.10|7100|1|2556
RDM|Redmond|EUA|US|44.25|-121.15|0.12|1.10|1.10|7038|1|3080
RSA|Santa Rosa|Argentina|AR|-36.59|-64.28|0.12|0.60|1.50|7546|1|630
SMT|Sorriso|Brasil|BR|-12.48|-55.67|0.12|0.68|0.85|5577|1|1266
SWQ|Sumbawa Besar|Indonesia|ID|-8.49|117.41|0.12|0.50|0.90|5906|1|16
VPE|Ngiva|Angola|AO|-17.04|15.68|0.12|0.38|0.60|10640|1|3566
YKA|Kamloops|Canada|CA|50.70|-120.45|0.12|1.10|0.95|8000|1|1133
YQY|Sydney|Canada|CA|46.16|-60.05|0.12|1.10|0.95|7070|1|203
ABY|Albany|EUA|US|31.53|-84.20|0.11|1.10|1.10|6601|1|197
ALO|Waterloo|EUA|US|42.56|-92.40|0.11|1.10|1.10|8399|1|873
AUG|Augusta|EUA|US|44.32|-69.80|0.11|1.10|1.10|5002|1|352
AXD|Alexandroupolis|Grecia|GR|40.86|25.96|0.11|0.77|2.10|8471|1|24
BOR|Ton Phueng|Laos|LA|20.32|100.17|0.11|0.32|1.10|8858|1|1175
CAL|Campbeltown|Reino Unido|GB|55.44|-5.69|0.11|1.05|1.10|4633|1|42
DIN|Dien Bien Phu|Vietna|VN|21.40|103.01|0.11|0.58|1.40|7874|1|1611
DLH|Duluth|EUA|US|46.84|-92.20|0.11|1.10|1.10|10591|1|1428
EAR|Kearney|EUA|US|40.73|-99.01|0.11|1.10|1.10|7094|1|2131
ESL|Elista|Russia|RU|46.37|44.33|0.11|0.71|1.05|10499|1|501
FSM|Fort Smith|EUA|US|35.34|-94.37|0.11|1.10|1.10|8000|1|469
KSD|Karlstad|Suecia|SE|59.44|13.34|0.11|1.23|1.00|8255|1|352
NLH|Ninglang|China|CN|27.54|100.76|0.11|0.80|1.00|11155|1|10804
NOJ|Noyabrsk|Russia|RU|63.18|75.27|0.11|0.71|1.05|8202|1|446
OYE|Oyem|Gabao|GA|1.54|11.58|0.11|0.45|0.70|5906|1|2158
PHW|Phalaborwa|Africa do Sul|ZA|-23.94|31.16|0.11|0.65|1.20|4491|1|1432
PKN|Pangkalanbun|Indonesia|ID|-2.71|111.67|0.11|0.50|0.90|5415|1|75
PMG|Ponta Pora|Brasil|BR|-22.55|-55.70|0.11|0.68|0.85|6562|1|2156
RMZ|Tobolsk|Russia|RU|58.06|68.35|0.11|0.71|1.05|7875|1|167
SNO|Sakon Nakhon|Tailandia|TH|17.20|104.12|0.11|0.60|2.00|8530|1|529
SUG|Surigao City|Filipinas|PH|9.76|125.48|0.11|0.47|1.05|5603|1|20
TAY|Tartu|Estonia|EE|58.31|26.69|0.11|0.90|1.20|5905|1|220
TFF|Tefe|Brasil|BR|-3.38|-64.72|0.11|0.68|0.85|7218|1|186
TUI|Turaif|Arabia Saudita|SA|31.69|38.73|0.11|0.97|1.10|9843|1|2803
VXO|Vaxjo|Suecia|SE|56.93|14.73|0.11|1.23|1.00|6900|1|610
YFC|Fredericton|Canada|CA|45.87|-66.53|0.11|1.10|0.95|8005|1|68
YQT|Thunder Bay|Canada|CA|48.37|-89.32|0.11|1.10|0.95|7318|1|653
YSJ|Saint John|Canada|CA|45.32|-65.89|0.11|1.10|0.95|7000|1|357
AEU|Abu Musa|Ira|IR|25.88|55.03|0.10|0.45|0.80|9796|1|23
AUC|Arauca|Colombia|CO|7.07|-70.74|0.10|0.55|1.10|6890|1|420
BIS|Bismarck|EUA|US|46.77|-100.75|0.10|1.10|1.10|8794|1|1661
BTV|Burlington|EUA|US|44.47|-73.15|0.10|1.10|1.10|8319|1|335
BXG|Bendigo|Australia|AU|-36.74|144.33|0.10|1.20|1.40|5249|1|705
CLY|Calvi|Franca|FR|42.53|8.79|0.10|1.12|1.35|7579|1|209
CWJ|Lincang|China|CN|23.28|99.37|0.10|0.80|1.00|8530|1|6102
DHN|Dothan|EUA|US|31.32|-85.45|0.10|1.10|1.10|8500|1|401
HMA|Khanty-Mansiysk|Russia|RU|61.03|69.09|0.10|0.71|1.05|9180|1|76
IGR|Puerto Iguazu|Argentina|AR|-25.74|-54.47|0.10|0.55|2.00|10827|1|916
IKG|Karakol|Quirguistao|KG|42.51|78.41|0.10|0.32|0.90|8202|1|5590
JAE|Jaen|Peru|PE|-5.59|-78.77|0.10|0.52|1.50|7874|1|2477
JBR|Jonesboro|EUA|US|35.83|-90.65|0.10|1.10|1.10|6200|1|262
KCA|Kuqa|China|CN|41.68|82.87|0.10|0.80|1.00|8530|1|3524
KGT|Garze|China|CN|30.14|101.74|0.10|0.80|1.00|13123|1|14042
KLX|Kalamata|Grecia|GR|37.07|22.03|0.10|0.77|2.10|9843|1|26
KRC|Sungai Penuh|Indonesia|ID|-2.09|101.47|0.10|0.50|0.90|5906|1|2600
LIR|Liberia|Costa Rica|CR|10.59|-85.54|0.10|0.60|1.80|9022|1|270
MOL|Aro|Noruega|NO|62.74|7.26|0.10|1.20|1.20|6922|1|10
MWA|Marion|EUA|US|37.75|-89.02|0.10|1.10|1.10|8012|1|472
PBG|Plattsburgh|EUA|US|44.65|-73.47|0.10|1.10|1.10|11759|1|234
SJT|San Angelo|EUA|US|31.36|-100.50|0.10|1.10|1.10|8054|1|1919
URY|Gurayat|Arabia Saudita|SA|31.41|37.28|0.10|0.97|1.10|10007|1|1672
USH|Ushuaia|Argentina|AR|-54.84|-68.30|0.10|0.55|1.80|9186|1|102
VKT|Vorkuta|Russia|RU|67.49|63.99|0.10|0.71|1.05|7218|1|604
YQL|Lethbridge|Canada|CA|49.63|-112.80|0.10|1.10|0.95|6500|1|3048
ZQN|Queenstown|Nova Zelandia|NZ|-45.02|168.75|0.10|1.00|2.10|6204|1|1171
AKF|Kufra|Libia|LY|24.18|23.31|0.09|0.40|0.50|12007|1|1367
ANS|Andahuaylas|Peru|PE|-13.71|-73.35|0.09|0.52|1.50|8202|1|11300
BCO|Jinka|Etiopia|ET|5.75|36.56|0.09|0.35|0.80|8612|1|4475
BFV|Buriram|Tailandia|TH|15.23|103.25|0.09|0.60|2.00|6890|1|590
BLE|Borlange|Suecia|SE|60.42|15.52|0.09|1.23|1.00|7579|1|503
BPX|Bangda|China|CN|30.55|97.11|0.09|0.80|1.00|14764|1|14219
DWD|Dawadmi|Arabia Saudita|SA|24.45|44.12|0.09|0.97|1.10|10006|1|3026
EBH|El Bayadh|Argelia|DZ|33.72|1.09|0.09|0.60|0.70|9843|1|4493
ECP|Panama City Beach|EUA|US|30.36|-85.80|0.09|1.10|1.10|10000|1|69
EIE|Yeniseysk|Russia|RU|58.47|92.11|0.09|0.71|1.05|7217|1|253
ELM|Elmira/Corning|EUA|US|42.16|-76.89|0.09|1.10|1.10|8001|1|954
ESU|Essaouira|Marrocos|MA|31.40|-9.68|0.09|0.54|1.65|8553|1|384
FLO|Florence|EUA|US|34.19|-79.72|0.09|1.10|1.10|6502|1|146
GDX|Magadan|Russia|RU|59.91|150.72|0.09|0.71|1.05|11326|1|574
HII|Lake Havasu City|EUA|US|34.57|-114.36|0.09|1.10|1.10|8000|1|783
HOT|Hot Springs|EUA|US|34.48|-93.10|0.09|1.10|1.10|6595|1|540
IDA|Idaho Falls|EUA|US|43.51|-112.07|0.09|1.10|1.10|9002|1|4744
IOA|Ioannina|Grecia|GR|39.70|20.82|0.09|0.77|2.10|7874|1|1558
JOE|Joensuu|Finlandia|FI|62.66|29.62|0.09|1.30|1.10|8202|1|398
JSJ|Jiansanjiang|China|CN|47.11|132.66|0.09|0.80|1.00|8202|1|180
KRW|Turkmenbasy|Turcomenistao|TM|40.06|53.01|0.09|0.45|0.60|11483|1|279
LFM|Lamerd|Ira|IR|27.37|53.19|0.09|0.45|0.80|10020|1|1337
LST|Launceston|Australia|AU|-41.54|147.21|0.09|1.20|1.40|6499|1|562
LUV|Langgur|Indonesia|ID|-5.76|132.76|0.09|0.50|0.90|7710|1|78
MMY|Miyakojima|Japao|JP|24.78|125.29|0.09|1.23|1.50|6560|1|150
MZV|Mulu|Malasia|MY|4.05|114.81|0.09|0.72|1.50|4921|1|80
NUX|Novy Urengoy|Russia|RU|66.07|76.52|0.09|0.71|1.05|8366|1|210
OCC|Coca|Equador|EC|-0.46|-76.99|0.09|0.57|1.05|6760|1|834
PHY|Phetchabun|Tailandia|TH|16.68|101.19|0.09|0.60|2.00|6890|1|450
PUU|Puerto Asis|Colombia|CO|0.51|-76.50|0.09|0.55|1.10|5331|1|815
PVK|Preveza|Grecia|GR|38.93|20.77|0.09|0.77|2.10|9419|1|11
PXR|Surin|Tailandia|TH|14.87|103.50|0.09|0.60|2.00|5053|1|478
PYT|Paracatu|Brasil|BR|-17.24|-46.88|0.09|0.68|0.85|4921|1|2359
RDD|Redding|EUA|US|40.51|-122.29|0.09|1.10|1.10|7003|1|505
RNB|Ronneby|Suecia|SE|56.27|15.27|0.09|1.23|1.00|7648|1|191
SCE|State College|EUA|US|40.85|-77.85|0.09|1.10|1.10|6701|1|1239
SHI|Miyakojima|Japao|JP|24.83|125.14|0.09|1.23|1.50|9842|1|54
SUI|Sukhumi|Georgia|GE|42.86|41.13|0.09|0.55|1.30|12012|1|53
TCO|Tumaco|Colombia|CO|1.81|-78.75|0.09|0.55|1.10|5249|1|8
THL|Tachileik|Mianmar|MM|20.48|99.94|0.09|0.30|0.70|7002|1|1280
TMT|Oriximina|Brasil|BR|-1.49|-56.40|0.09|0.68|0.85|5249|1|167
TUO|Taupo|Nova Zelandia|NZ|-38.74|176.08|0.09|1.12|1.65|4547|1|1335
UYN|Yulin|China|CN|38.36|109.59|0.09|0.80|1.00|9186|1|3891
VUS|Velikiy Ustyug|Russia|RU|60.79|46.26|0.09|0.71|1.05|5069|1|331
WJR|Wajir|Quenia|KE|1.73|40.09|0.09|0.45|1.50|9193|1|770
WMX|Wamena|Indonesia|ID|-4.10|138.95|0.09|0.50|0.90|7135|1|5435
YQA|Gravenhurst|Canada|CA|44.98|-79.31|0.09|1.10|0.95|6000|1|925
ZBR|Konarak|Ira|IR|25.44|60.38|0.09|0.45|0.80|12514|1|13
ACV|Arcata/Eureka|EUA|US|40.98|-124.11|0.08|1.10|1.10|6046|1|221
ASJ|Amami|Japao|JP|28.43|129.71|0.08|1.23|1.50|6560|1|27
AUR|Aurillac|Franca|FR|44.89|2.42|0.08|1.12|1.35|5577|1|2096
BHS|Bathurst|Australia|AU|-33.41|149.65|0.08|1.20|1.40|5594|1|2435
BQK|Brunswick|EUA|US|31.26|-81.47|0.08|1.10|1.10|8001|1|26
BRL|Burlington|EUA|US|40.78|-91.13|0.08|1.10|1.10|6102|1|698
BXH|Balkhash|Cazaquistao|KZ|46.89|75.00|0.08|0.67|0.75|8208|1|1446
CFS|Coffs Harbour|Australia|AU|-30.32|153.12|0.08|1.20|1.40|6824|1|18
CGI|Cape Girardeau|EUA|US|37.23|-89.57|0.08|1.10|1.10|6500|1|342
EAU|Eau Claire|EUA|US|44.87|-91.48|0.08|1.10|1.10|8101|1|913
FUJ|Goto|Japao|JP|32.67|128.83|0.08|1.23|1.50|6561|1|273
GJT|Grand Junction|EUA|US|39.13|-108.53|0.08|1.10|1.10|9339|1|4858
GRI|Grand Island|EUA|US|40.97|-98.31|0.08|1.10|1.10|7002|1|1847
HVB|Hervey Bay|Australia|AU|-25.32|152.88|0.08|1.20|1.40|6561|1|60
KHS|Khasab|Oma|OM|26.17|56.24|0.08|0.95|1.30|8202|1|100
KOK|Kokkola / Kruunupyy|Finlandia|FI|63.72|23.14|0.08|1.30|1.10|8202|1|84
LIO|Limon|Costa Rica|CR|9.96|-83.02|0.08|0.61|1.85|5906|1|7
LLB|Qiannan|China|CN|25.45|107.96|0.08|0.80|1.00|7546|1|2694
MHC|Dalcahue|Chile|CL|-42.34|-73.72|0.08|0.70|1.30|6562|1|528
MHK|Manhattan|EUA|US|39.14|-96.67|0.08|1.10|1.10|7400|1|1057
MJT|Mytilene|Grecia|GR|39.06|26.60|0.08|0.77|2.10|7894|1|60
MKL|Jackson|EUA|US|35.60|-88.92|0.08|1.10|1.10|6005|1|434
MKY|Mackay|Australia|AU|-21.17|149.18|0.08|1.20|1.40|6499|1|19
MOQ|Morondava|Madagascar|MG|-20.28|44.32|0.08|0.25|1.20|4921|1|30
NDU|Rundu|Namibia|NA|-17.96|19.72|0.08|0.45|1.30|11004|1|3627
PRC|Prescott|EUA|US|34.65|-112.42|0.08|1.10|1.10|7619|1|5045
RIH|Rio Hato|Panama|PA|8.38|-80.13|0.08|0.80|1.20|8038|1|105
ROK|Rockhampton|Australia|AU|-23.38|150.48|0.08|1.20|1.40|8622|1|34
SDL|Sundsvall/ Harnosand|Suecia|SE|62.53|17.44|0.08|1.23|1.00|6857|1|16
SHB|Nakashibetsu|Japao|JP|43.58|144.96|0.08|1.23|1.50|6560|1|234
SLY|Salekhard|Russia|RU|66.59|66.61|0.08|0.71|1.05|8917|1|218
SUX|Sioux City|EUA|US|42.40|-96.38|0.08|1.10|1.10|9002|1|1098
TDD|Trinidad|Bolivia|BO|-14.82|-64.92|0.08|0.46|1.05|7874|1|509
TTA|Tan Tan|Marrocos|MA|28.45|-11.16|0.08|0.54|1.65|6562|1|653
YQQ|Comox|Canada|CA|49.71|-124.89|0.08|1.10|0.95|10000|1|84
YXS|Prince George|Canada|CA|53.88|-122.67|0.08|1.10|0.95|11450|1|2267
ABX|East Albury|Australia|AU|-36.07|146.96|0.07|1.20|1.40|6234|1|539
ACK|Nantucket|EUA|US|41.25|-70.06|0.07|1.10|1.10|6303|1|47
AEX|Alexandria|EUA|US|31.33|-92.55|0.07|1.10|1.10|9352|1|89
AZR|Adrar|Argelia|DZ|27.84|-0.19|0.07|0.60|0.70|9843|1|919
BDT|Gbadolite|Congo (Kinshasa)|CD|4.25|20.98|0.07|0.22|0.50|10499|1|1509
CJM|Chumphon|Tailandia|TH|10.71|99.36|0.07|0.60|2.00|6890|1|18
CKB|Bridgeport|EUA|US|39.30|-80.23|0.07|1.10|1.10|7800|1|1217
FLG|Flagstaff|EUA|US|35.14|-111.67|0.07|1.10|1.10|8800|1|7014
GDE|Gode|Etiopia|ET|5.94|43.58|0.07|0.35|0.80|7505|1|834
ILQ|Ilo|Peru|PE|-17.70|-71.34|0.07|0.52|1.50|8202|1|72
INV|Inverness|Reino Unido|GB|57.54|-4.05|0.07|1.05|1.10|6194|1|31
JLN|Joplin|EUA|US|37.15|-94.50|0.07|1.10|1.10|6502|1|981
JSA|Jaisalmer|India|IN|26.89|70.86|0.07|0.52|0.90|9000|1|751
JST|Johnstown|EUA|US|40.32|-78.83|0.07|1.10|1.10|7004|1|2284
KGP|Kogalym|Russia|RU|62.19|74.53|0.07|0.71|1.05|8225|1|220
LET|Leticia|Colombia|CO|-4.19|-69.94|0.07|0.55|1.10|6168|1|277
MCW|Mason City|EUA|US|43.16|-93.33|0.07|1.10|1.10|6501|1|1213
MGW|Morgantown|EUA|US|39.64|-79.92|0.07|1.10|1.10|5199|1|1248
MLU|Monroe|EUA|US|32.51|-92.04|0.07|1.10|1.10|7504|1|79
MSO|Missoula|EUA|US|46.92|-114.09|0.07|1.10|1.10|9501|1|3206
MZW|Mecheria|Argelia|DZ|33.54|-0.24|0.07|0.60|0.70|11780|1|3855
NEC|Necochea|Argentina|AR|-38.49|-58.82|0.07|0.60|1.50|4921|1|72
NER|Neryungri|Russia|RU|56.91|124.91|0.07|0.71|1.05|11811|1|2812
PIB|Moselle|EUA|US|31.47|-89.34|0.07|1.10|1.10|6503|1|298
PQQ|Port Macquarie|Australia|AU|-31.44|152.86|0.07|1.20|1.40|5203|1|12
RAP|Rapid City|EUA|US|44.05|-103.06|0.07|1.10|1.10|8701|1|3204
SLU|Castries|Santa Lucia|LC|14.02|-60.99|0.07|0.65|1.90|5735|1|22
TXK|Texarkana|EUA|US|33.45|-93.99|0.07|1.10|1.10|6602|1|390
UAI|Suai|Timor-Leste|TL|-9.30|125.29|0.07|0.30|0.80|4921|1|96
UTN|Upington|Africa do Sul|ZA|-28.40|21.26|0.07|0.65|1.20|16076|1|2782
VCT|Victoria|EUA|US|28.85|-96.92|0.07|1.10|1.10|9111|1|115
VDM|Viedma / Carmen de|Argentina|AR|-40.87|-63.00|0.07|0.60|1.50|8366|1|20
VLD|Valdosta|EUA|US|30.78|-83.28|0.07|1.10|1.10|8003|1|203
YAM|Sault Ste Marie|Canada|CA|46.48|-84.51|0.07|1.10|0.95|6000|1|630
YMM|Fort McMurray|Canada|CA|56.65|-111.22|0.07|1.10|0.95|7503|1|1211
YQU|Grande Prairie|Canada|CA|55.18|-118.89|0.07|1.10|0.95|8502|1|2195
BDU|Malselv|Noruega|NO|69.06|18.54|0.06|1.20|1.20|8015|1|252
BEF|Bluefields|Nicaragua|NI|11.99|-83.77|0.06|0.35|0.80|6625|1|20
CPR|Casper|EUA|US|42.91|-106.46|0.06|1.10|1.10|10165|1|5350
CTD|Chitre|Panama|PA|7.99|-80.41|0.06|0.80|1.20|4921|1|33
DBQ|Dubuque|EUA|US|42.40|-90.71|0.06|1.10|1.10|6502|1|1077
DOG|Dongola|Sudao|SD|19.15|30.43|0.06|0.24|0.50|9843|1|772
DRO|Durango|EUA|US|37.15|-107.75|0.06|1.10|1.10|9201|1|6685
ELG|El Menia|Argelia|DZ|30.58|2.86|0.06|0.60|0.70|9843|1|1306
EPU|Parnu|Estonia|EE|58.42|24.47|0.06|0.90|1.20|6463|1|47
GFK|Grand Forks|EUA|US|47.95|-97.18|0.06|1.10|1.10|7351|1|845
GGR|Garowe|Somalia|SO|8.46|48.57|0.06|0.20|0.50|6562|1|1465
GLK|Galcaio|Somalia|SO|6.78|47.45|0.06|0.20|0.50|9859|1|975
GMQ|Golog|China|CN|34.42|100.30|0.06|0.80|1.00|12467|1|12426
GTF|Great Falls|EUA|US|47.48|-111.37|0.06|1.10|1.10|10502|1|3680
IVC|Invercargill|Nova Zelandia|NZ|-46.41|168.31|0.06|1.12|1.65|7251|1|5
KAW|Kawthoung|Mianmar|MM|10.05|98.54|0.06|0.30|0.70|6000|1|180
KLR|Kalmar|Suecia|SE|56.69|16.29|0.06|1.23|1.00|6726|1|17
KRF|Nyland|Suecia|SE|63.05|17.77|0.06|1.23|1.00|6565|1|34
LNY|Lanai City|Estados Unidos|US|20.79|-156.95|0.06|1.00|2.10|5001|1|1308
MOG|Mong Hsat|Mianmar|MM|20.52|99.26|0.06|0.30|0.70|5000|1|1875
NOP|Sinop|Turquia|TR|42.02|35.07|0.06|0.65|1.30|6482|1|20
OHE|Mohe|China|CN|52.92|122.42|0.06|0.80|1.00|7218|1|1836
OUZ|Zouerate|Mauritania|MR|22.76|-12.48|0.06|0.30|0.60|8202|1|1119
PKB|Parkersburg|EUA|US|39.35|-81.44|0.06|1.10|1.10|7240|1|858
PPE|Puerto Penasco|Mexico|MX|31.35|-113.31|0.06|0.69|1.30|8202|1|71
RIS|Rishiri|Japao|JP|45.24|141.19|0.06|1.23|1.50|5906|1|112
TME|Tame|Colombia|CO|6.45|-71.76|0.06|0.55|1.10|6561|1|1050
TSJ|Tsushima|Japao|JP|34.28|129.33|0.06|1.23|1.50|6234|1|213
TUP|Tupelo|EUA|US|34.27|-88.77|0.06|1.10|1.10|7150|1|346
TVF|Thief River Falls|EUA|US|48.07|-96.18|0.06|1.10|1.10|6504|1|1119
UIN|Quincy|EUA|US|39.94|-91.19|0.06|1.10|1.10|7098|1|768
VAI|Vanimo|Papua-Nova Guine|PG|-2.69|141.30|0.06|0.34|0.90|5775|1|10
WBM|Wapenamanda|Papua-Nova Guine|PG|-5.64|143.89|0.06|0.34|0.90|5052|1|5889
WKJ|Wakkanai|Japao|JP|45.40|141.80|0.06|1.23|1.50|6560|1|30
YBL|Campbell River|Canada|CA|49.95|-125.27|0.06|1.10|0.95|6499|1|346
YXH|Medicine Hat|Canada|CA|50.02|-110.72|0.06|1.10|0.95|5000|1|2352
YYY|Mont-Joli|Canada|CA|48.61|-68.21|0.06|1.10|0.95|6000|1|172
ABK|Kebri Dahar|Etiopia|ET|6.73|44.24|0.05|0.35|0.80|8202|1|1800
AJA|Ajaccio|Franca|FR|41.92|8.80|0.05|1.12|1.35|7897|1|18
ART|Watertown|EUA|US|43.99|-76.02|0.05|1.10|1.10|7001|1|325
BBA|Balmaceda|Chile|CL|-45.92|-71.69|0.05|0.70|1.30|8205|1|1722
BBQ|Codrington|Antigua e Barbuda|AG|17.62|-61.80|0.05|0.80|2.00|6100|1|28
BCH|Baucau|Timor-Leste|TL|-8.49|126.40|0.05|0.30|0.80|8233|1|1771
BDH|Bandar Lengeh|Ira|IR|26.53|54.82|0.05|0.45|0.80|8203|1|67
BGC|Braganca|Portugal|PT|41.86|-6.71|0.05|0.84|1.90|5600|1|2241
BGR|Bangor|EUA|US|44.81|-68.83|0.05|1.10|1.10|11440|1|192
BWT|Burnie|Australia|AU|-41.00|145.73|0.05|1.20|1.40|5413|1|62
BYO|Bonito|Brasil|BR|-21.25|-56.45|0.05|0.68|0.85|6562|1|1180
CDC|Cedar City|EUA|US|37.70|-113.10|0.05|1.10|1.10|8653|1|5622
CFN|Donegal|Irlanda|IE|55.04|-8.34|0.05|1.15|1.15|4908|1|30
CIW|Canouan|Sao Vicente e Granadinas|VC|12.70|-61.34|0.05|0.62|1.80|5900|1|11
CRW|Charleston|EUA|US|38.37|-81.59|0.05|1.10|1.10|6715|1|981
EAT|Wenatchee|EUA|US|47.40|-120.21|0.05|1.10|1.10|7000|1|1249
FAI|Fairbanks|EUA|US|64.82|-147.86|0.05|1.10|1.10|11800|1|439
FRS|San Benito|Guatemala|GT|16.91|-89.87|0.05|0.45|1.00|9842|1|427
FSC|Figari|Franca|FR|41.50|9.10|0.05|1.12|1.35|8136|1|85
GCK|Garden City|EUA|US|37.93|-100.72|0.05|1.10|1.10|7299|1|2891
GLT|Gladstone|Australia|AU|-23.87|151.23|0.05|1.20|1.40|5364|1|64
GTR|Columbus/W|EUA|US|33.45|-88.59|0.05|1.10|1.10|8003|1|264
GYA|Guayaramerin|Bolivia|BO|-10.89|-65.38|0.05|0.46|1.05|5767|1|456
ISG|Ishigaki|Japao|JP|24.40|124.25|0.05|1.23|1.50|6562|1|102
JER|St. Peter|Jersey|JE|49.21|-2.20|0.05|1.25|1.30|5594|1|277
JKH|Chios Island|Grecia|GR|38.34|26.14|0.05|0.77|2.10|4957|1|15
KSU|Kvernberget|Noruega|NO|63.11|7.82|0.05|1.20|1.20|7841|1|204
LXG|Luang Namtha|Laos|LA|20.97|101.40|0.05|0.32|1.10|5249|1|1968
MNJ|Mananjary|Madagascar|MG|-21.20|48.36|0.05|0.25|1.20|4921|1|20
MOT|Minot|EUA|US|48.26|-101.28|0.05|1.10|1.10|7700|1|1716
NYA|Nyagan|Russia|RU|62.11|65.61|0.05|0.71|1.05|8307|1|361
NYM|Nadym|Russia|RU|65.48|72.70|0.05|0.71|1.05|8360|1|49
OSD|Ostersund|Suecia|SE|63.19|14.50|0.05|1.23|1.00|8202|1|1233
OVS|Sovetskiy|Russia|RU|61.33|63.60|0.05|0.71|1.05|8202|1|351
PEX|Pechora|Russia|RU|65.12|57.13|0.05|0.71|1.05|5905|1|98
PIH|Pocatello|EUA|US|42.91|-112.60|0.05|1.10|1.10|9059|1|4452
PZH|Fort Sandeman|Paquistao|PK|31.36|69.46|0.05|0.40|0.60|6001|1|4728
RGA|Rio Grande|Argentina|AR|-53.78|-67.75|0.05|0.60|1.50|6562|1|65
ROW|Roswell|EUA|US|33.30|-104.53|0.05|1.10|1.10|13000|1|3671
SBY|Salisbury|EUA|US|38.34|-75.51|0.05|1.10|1.10|6400|1|52
SJE|San Jose Del Guaviare|Colombia|CO|2.58|-72.64|0.05|0.55|1.10|4897|1|605
SJL|Sao Gabriel da Cachoeira|Brasil|BR|-0.15|-66.99|0.05|0.68|0.85|8530|1|249
SLN|Salina|EUA|US|38.79|-97.65|0.05|1.10|1.10|12301|1|1288
SNW|Thandwe|Mianmar|MM|18.46|94.30|0.05|0.30|0.70|5502|1|20
SPN|I Fadang, Saipan|Marianas do Norte|MP|15.12|145.73|0.05|0.75|1.70|8700|1|215
STX|Christiansted|Ilhas Virgens Americanas|VI|17.70|-64.80|0.05|0.90|2.00|10002|1|74
SVL|Savonlinna|Finlandia|FI|61.94|28.95|0.05|1.30|1.10|7546|1|311
TBH|Tablas Island|Filipinas|PH|12.31|122.08|0.05|0.47|1.05|4560|1|10
TIN|Tindouf|Argelia|DZ|27.70|-8.17|0.05|0.60|0.70|9840|1|1453
TIQ|Tinian Island|Marianas do Norte|MP|15.00|145.62|0.05|0.75|1.70|8600|1|271
TWF|Twin Falls|EUA|US|42.48|-114.49|0.05|1.10|1.10|8704|1|4154
UKX|Ust-Kut|Russia|RU|56.86|105.73|0.05|0.71|1.05|6561|1|2188
UNN|Ranong|Tailandia|TH|9.78|98.59|0.05|0.60|2.00|6562|1|57
YBR|Brandon|Canada|CA|49.91|-99.95|0.05|1.10|0.95|6500|1|1343
YYB|North Bay|Canada|CA|46.36|-79.42|0.05|1.10|0.95|10000|1|1215
AAA|Anaa|Polinesia Francesa|PF|-17.35|-145.51|0.04|0.85|2.10|4921|1|10
AAY|Al Ghaydah|Iemen|YE|16.19|52.17|0.04|0.20|0.50|8858|1|134
ABM|Bamaga|Australia|AU|-10.95|142.46|0.04|1.20|1.40|5462|1|34
ABR|Aberdeen|EUA|US|45.45|-98.42|0.04|1.10|1.10|6901|1|1302
ABS|Abu Simbel|Egito|EG|22.38|31.61|0.04|0.45|2.00|9843|1|614
ADK|Adak|EUA|US|51.88|-176.64|0.04|1.10|1.10|7790|1|18
ADQ|Kodiak|EUA|US|57.75|-152.49|0.04|1.10|1.10|7534|1|78
AFL|Alta Floresta|Brasil|BR|-9.87|-56.11|0.04|0.68|0.85|8202|1|948
AIA|Alliance|EUA|US|42.05|-102.80|0.04|1.10|1.10|9203|1|3931
AIT|Aitutaki|Ilhas Cook|CK|-18.83|-159.76|0.04|0.75|2.00|5920|1|14
AJN|Ouani|Comores|KM|-12.13|44.43|0.04|0.24|1.00|4429|1|62
AJR|Arvidsjaur|Suecia|SE|65.59|19.28|0.04|1.23|1.00|8201|1|1245
AKB|Atka|EUA|US|52.22|-174.21|0.04|1.10|1.10|4500|1|57
AKN|King Salmon|EUA|US|58.68|-156.65|0.04|1.10|1.10|8901|1|73
ALF|Alta|Noruega|NO|69.98|23.37|0.04|1.20|1.20|7165|1|9
ALH|Albany|Australia|AU|-34.94|117.81|0.04|1.20|1.40|5906|1|233
ALS|Alamosa|EUA|US|37.43|-105.87|0.04|1.10|1.10|8521|1|7539
ANI|Aniak|EUA|US|61.58|-159.54|0.04|1.10|1.10|6200|1|88
ANX|Andenes|Noruega|NO|69.30|16.14|0.04|1.20|1.20|8097|1|43
AOK|Karpathos Island|Grecia|GR|35.42|27.15|0.04|0.77|2.10|7871|1|66
APN|Alpena|EUA|US|45.08|-83.56|0.04|1.10|1.10|9001|1|690
ARD|Kabola|Indonesia|ID|-8.13|124.60|0.04|0.50|0.90|4586|1|10
ARM|Armidale|Australia|AU|-30.53|151.62|0.04|1.20|1.40|5702|1|3556
ASE|Aspen|EUA|US|39.22|-106.87|0.04|1.10|1.10|8006|1|7820
ASI|Cat Hill|Santa Helena|SH|-7.97|-14.39|0.04|0.80|1.50|10019|1|278
ASP|Alice Springs|Australia|AU|-23.81|133.90|0.04|1.20|1.40|7999|1|1789
ATC|Arthur's Town|Bahamas|BS|24.63|-75.67|0.04|0.75|2.10|7015|1|18
ATY|Watertown|EUA|US|44.91|-97.15|0.04|1.10|1.10|6898|1|1749
AWK|Wake Island|Ilhas Menores dos EUA|UM|19.28|166.64|0.04|0.80|0.80|9843|1|14
AXA|The Valley|Anguila|AI|18.20|-63.05|0.04|0.85|2.00|5462|1|127
AXP|Spring Point|Bahamas|BS|22.44|-73.97|0.04|0.75|2.10|5000|1|11
AYQ|Yulara|Australia|AU|-25.19|130.98|0.04|1.20|1.40|8527|1|1626
BCI|Barcaldine|Australia|AU|-23.57|145.30|0.04|1.20|1.40|5591|1|878
BEB|Balivanich|Reino Unido|GB|57.48|-7.36|0.04|1.05|1.10|6027|1|19
BEJ|Tanjung Redeb - Borneo|Indonesia|ID|2.15|117.43|0.04|0.50|0.90|4625|1|59
BET|Bethel|EUA|US|60.78|-161.84|0.04|1.10|1.10|6400|1|126
BEU|Bedourie|Australia|AU|-24.35|139.46|0.04|1.20|1.40|4921|1|300
BFD|Bradford|EUA|US|41.80|-78.64|0.04|1.10|1.10|6307|1|2143
BFF|Scottsbluff|EUA|US|41.87|-103.60|0.04|1.10|1.10|8279|1|3967
BHB|Bar Harbor|EUA|US|44.45|-68.36|0.04|1.10|1.10|5200|1|83
BHQ|Broken Hill|Australia|AU|-32.00|141.47|0.04|1.20|1.40|8251|1|958
BIH|Bishop|EUA|US|37.37|-118.36|0.04|1.10|1.10|7498|1|4124
BIK|Biak|Indonesia|ID|-1.19|136.11|0.04|0.50|0.90|11715|1|46
BIM|South Bimini|Bahamas|BS|25.70|-79.26|0.04|0.75|2.10|5409|1|10
BKG|Branson|EUA|US|36.53|-93.20|0.04|1.10|1.10|7140|1|1302
BKQ|Blackall|Australia|AU|-24.43|145.43|0.04|1.20|1.40|5538|1|928
BKW|Beaver|EUA|US|37.79|-81.12|0.04|1.10|1.10|6750|1|2504
BMW|Bordj Badji Mokhtar|Argelia|DZ|21.38|0.93|0.04|0.60|0.70|9843|1|1303
BNK|Ballina|Australia|AU|-28.83|153.56|0.04|1.20|1.40|6234|1|7
BOB|Motu Mute|Polinesia Francesa|PF|-16.44|-151.75|0.04|0.85|2.10|4921|1|10
BOC|Isla Colon|Panama|PA|9.34|-82.25|0.04|0.80|1.20|4921|1|10
BQG|Bogorodskoye|Russia|RU|52.38|140.45|0.04|0.71|1.05|4593|1|150
BRD|Brainerd|EUA|US|46.40|-94.13|0.04|1.10|1.10|7100|1|1232
BRK|Bourke|Australia|AU|-30.04|145.95|0.04|1.20|1.40|6004|1|352
BRW|Utqiagvik|EUA|US|71.29|-156.77|0.04|1.10|1.10|7100|1|44
BTM|Butte|EUA|US|45.95|-112.50|0.04|1.10|1.10|9000|1|5550
BTW|Batu Licin|Indonesia|ID|-3.41|116.00|0.04|0.50|0.90|5930|1|3
BUA|Buka Island|Papua-Nova Guine|PG|-5.42|154.67|0.04|0.34|0.90|5125|1|11
BUC|Burketown|Australia|AU|-17.75|139.53|0.04|1.20|1.40|4501|1|21
BUU|Muara Bungo|Indonesia|ID|-1.54|102.18|0.04|0.50|0.90|4430|1|192
BVC|Rabil|Cabo Verde|CV|16.14|-22.89|0.04|0.45|1.90|6890|1|69
BVI|Birdsville|Australia|AU|-25.90|139.35|0.04|1.20|1.40|5682|1|159
BVJ|Bovanenkovo|Russia|RU|70.32|68.33|0.04|0.71|1.05|8698|1|24
BYN|Bayankhongor|Mongolia|MN|46.16|100.70|0.04|0.42|1.10|9186|1|6085
BZN|Bozeman|EUA|US|45.78|-111.15|0.04|1.10|1.10|8994|1|4473
CAF|Carauari|Brasil|BR|-4.87|-66.90|0.04|0.68|0.85|5463|1|355
CAJ|Canaima|Venezuela|VE|6.23|-62.85|0.04|0.45|0.70|7070|1|1450
CAZ|Cobar|Australia|AU|-31.54|145.79|0.04|1.20|1.40|5564|1|724
CCA|Chimore|Bolivia|BO|-16.98|-65.15|0.04|0.46|1.05|4801|1|875
CDB|Cold Bay|EUA|US|55.21|-162.73|0.04|1.10|1.10|10179|1|96
CDR|Chadron|EUA|US|42.84|-103.10|0.04|1.10|1.10|5998|1|3297
CDV|Cordova|EUA|US|60.49|-145.48|0.04|1.10|1.10|7500|1|54
CEC|Crescent City|EUA|US|41.78|-124.24|0.04|1.10|1.10|5002|1|61
CED|Ceduna|Australia|AU|-32.13|133.71|0.04|1.20|1.40|5709|1|77
CEZ|Cortez|EUA|US|37.30|-108.63|0.04|1.10|1.10|7205|1|5918
CHH|Chachapoyas|Peru|PE|-6.20|-77.86|0.04|0.52|1.50|6496|1|8333
CHT|Te One|Nova Zelandia|NZ|-43.81|-176.47|0.04|1.12|1.65|4462|1|43
CIJ|Cobija|Bolivia|BO|-11.04|-68.78|0.04|0.46|1.05|6562|1|889
CIU|Kincheloe|EUA|US|46.24|-84.46|0.04|1.10|1.10|7203|1|800
CKH|Chokurdah|Russia|RU|70.62|147.90|0.04|0.71|1.05|6233|1|151
CKW|Christmas Creek Mine|Australia|AU|-22.35|119.64|0.04|1.20|1.40|8202|1|1462
CMA|Cunnamulla|Australia|AU|-28.03|145.62|0.04|1.20|1.40|5686|1|630
CMX|Hancock|EUA|US|47.17|-88.49|0.04|1.10|1.10|6501|1|1095
CNB|Coonamble|Australia|AU|-30.98|148.38|0.04|1.20|1.40|5010|1|604
CNJ|Cloncurry|Australia|AU|-20.67|140.50|0.04|1.20|1.40|6562|1|616
CNM|Carlsbad|EUA|US|32.34|-104.26|0.04|1.10|1.10|7854|1|3295
CNY|Moab|EUA|US|38.76|-109.75|0.04|1.10|1.10|7360|1|4557
COD|Cody|EUA|US|44.52|-109.02|0.04|1.10|1.10|8268|1|5102
COQ|Choibalsan|Mongolia|MN|48.14|114.65|0.04|0.42|1.10|8530|1|2457
CPC|Chapelco/San Martin de|Argentina|AR|-40.08|-71.14|0.04|0.60|1.50|8205|1|2569
CSH|Solovetsky Islands|Russia|RU|65.03|35.73|0.04|0.71|1.05|4920|1|60
CTL|Charleville|Australia|AU|-26.41|146.26|0.04|1.20|1.40|5000|1|1003
CTN|Cooktown|Australia|AU|-15.44|145.18|0.04|1.20|1.40|5338|1|26
CVN|Clovis|EUA|US|34.43|-103.08|0.04|1.10|1.10|7200|1|4216
CVQ|Carnarvon|Australia|AU|-24.88|113.67|0.04|1.20|1.40|5509|1|13
CYB|West End|Ilhas Cayman|KY|19.69|-79.88|0.04|1.25|2.00|6000|1|8
CYO|Cayo Largo del Sur|Cuba|CU|21.62|-81.55|0.04|0.40|1.70|9869|1|10
CYX|Cherskiy|Russia|RU|68.74|161.34|0.04|0.71|1.05|5577|1|20
DAU|Daru|Papua-Nova Guine|PG|-9.09|143.21|0.04|0.34|0.90|4593|1|20
DBO|Dubbo|Australia|AU|-32.22|148.57|0.04|1.20|1.40|5604|1|935
DCY|Garze|China|CN|29.32|100.06|0.04|0.80|1.00|13780|1|14472
DDC|Dodge City|EUA|US|37.76|-99.97|0.04|1.10|1.10|6899|1|2594
DDR|Xigaze|China|CN|28.60|86.80|0.04|0.80|1.00|14764|1|14108
DEX|Dekai|Indonesia|ID|-4.86|139.48|0.04|0.50|0.90|6398|1|198
DIK|Dickinson|EUA|US|46.80|-102.80|0.04|1.10|1.10|7301|1|2592
DLG|Dillingham|EUA|US|59.04|-158.51|0.04|1.10|1.10|6400|1|81
DLZ|Dalanzadgad|Mongolia|MN|43.61|104.37|0.04|0.42|1.10|7545|1|4787
DMD|Doomadgee|Australia|AU|-17.94|138.82|0.04|1.20|1.40|5433|1|153
DOM|Marigot|Dominica|DM|15.55|-61.30|0.04|0.60|1.70|6352|1|73
DUJ|Dubois|EUA|US|41.18|-78.90|0.04|1.10|1.10|5503|1|1817
DUT|Unalaska|EUA|US|53.90|-166.54|0.04|1.10|1.10|4500|1|22
DVL|Devils Lake|EUA|US|48.12|-98.91|0.04|1.10|1.10|6400|1|1456
DYR|Anadyr|Russia|RU|64.73|177.74|0.04|0.71|1.05|11483|1|194
EDR|Pormpuraaw|Australia|AU|-14.90|141.61|0.04|1.20|1.40|4462|1|10
EFL|Kefallinia Island|Grecia|GR|38.12|20.50|0.04|0.77|2.10|7992|1|59
EGE|Eagle|EUA|US|39.64|-106.92|0.04|1.10|1.10|9000|1|6548
EGS|Egilsstadir|Islandia|IS|65.28|-14.40|0.04|1.15|2.10|7054|1|76
EJH|Al Wajh|Arabia Saudita|SA|26.20|36.48|0.04|0.97|1.10|10007|1|66
EKO|Elko|EUA|US|40.82|-115.79|0.04|1.10|1.10|7214|1|5140
ELC|Elcho Island|Australia|AU|-12.02|135.57|0.04|1.20|1.40|4724|1|101
ELD|El Dorado|EUA|US|33.22|-92.81|0.04|1.10|1.10|6601|1|277
ELH|North Eleuthera|Bahamas|BS|25.48|-76.68|0.04|0.75|2.10|6020|1|13
EMD|Emerald|Australia|AU|-23.57|148.18|0.04|1.20|1.40|6234|1|624
ENA|Kenai|EUA|US|60.57|-151.25|0.04|1.10|1.10|7855|1|99
ENF|Enontekio|Finlandia|FI|68.36|23.42|0.04|1.30|1.10|6565|1|1005
ENT|Eniwetok Atoll|Ilhas Marshall|MH|11.34|162.33|0.04|0.48|1.10|7700|1|13
EPR|Esperance|Australia|AU|-33.68|121.82|0.04|1.20|1.40|4921|1|470
EQS|Esquel|Argentina|AR|-42.91|-71.14|0.04|0.60|1.50|7874|1|2621
ERL|Erenhot|China|CN|43.42|112.09|0.04|0.80|1.00|9186|1|3301
ESC|Escanaba|EUA|US|45.72|-87.09|0.04|1.10|1.10|6498|1|609
ESR|El Salvador|Chile|CL|-26.31|-69.77|0.04|0.70|1.30|7546|1|5240
EVG|Sveg|Suecia|SE|62.05|14.42|0.04|1.23|1.00|5579|1|1178
EYK|Beloyarskiy|Russia|RU|63.69|66.70|0.04|0.71|1.05|7028|1|82
EYW|Key West|EUA|US|24.56|-81.76|0.04|1.10|1.10|5076|1|3
FAV|Fakarava|Polinesia Francesa|PF|-16.05|-145.66|0.04|0.85|2.10|4596|1|13
FCA|Kalispell|EUA|US|48.31|-114.26|0.04|1.10|1.10|9007|1|2977
FEN|Fernando de Noronha|Brasil|BR|-3.85|-32.42|0.04|0.68|0.85|6053|1|193
FLW|Santa Cruz das Flores|Portugal|PT|39.46|-31.13|0.04|0.84|1.90|4593|1|112
FOD|Fort Dodge|EUA|US|42.55|-94.19|0.04|1.10|1.10|6547|1|1156
FSP|Saint-Pierre|Sao Pedro e Miquelao|PM|46.76|-56.17|0.04|0.95|1.20|5906|1|27
FTE|El Calafate|Argentina|AR|-50.28|-72.05|0.04|0.60|1.50|8366|1|669
FUN|Funafuti|Tuvalu|TV|-8.52|179.20|0.04|0.42|1.00|5040|1|9
GAL|Galena|EUA|US|64.74|-156.94|0.04|1.10|1.10|6000|1|153
GAM|Gambell|EUA|US|63.77|-171.73|0.04|1.10|1.10|4500|1|27
GAX|Gamba|Gabao|GA|-2.79|10.05|0.04|0.45|0.70|5906|1|30
GCC|Gillette|EUA|US|44.35|-105.54|0.04|1.10|1.10|7501|1|4365
GCI|Saint Peter Port|Guernsey|GG|49.44|-2.60|0.04|1.20|1.20|5194|1|336
GCN|Grand Canyon - Tusayan|EUA|US|35.95|-112.15|0.04|1.10|1.10|8999|1|6609
GDT|Cockburn Town|Ilhas Turcas e Caicos|TC|21.44|-71.14|0.04|0.90|2.10|6362|1|13
GDV|Glendive|EUA|US|47.14|-104.81|0.04|1.10|1.10|5704|1|2458
GEM|Mengomeyen|Guine Equatorial|GQ|1.68|11.02|0.04|0.40|0.50|9843|1|2165
GER|Nueva Gerona|Cuba|CU|21.83|-82.78|0.04|0.40|1.70|8202|1|79
GET|Moonyoonooka|Australia|AU|-28.80|114.71|0.04|1.20|1.40|7838|1|121
GEV|Gallivare|Suecia|SE|67.13|20.81|0.04|1.23|1.00|5623|1|1027
GFF|Griffith|Australia|AU|-34.25|146.07|0.04|1.20|1.40|4931|1|439
GGT|Moss Town|Bahamas|BS|23.56|-75.88|0.04|0.75|2.10|7051|1|9
GGW|Glasgow|EUA|US|48.21|-106.61|0.04|1.10|1.10|5002|1|2296
GHB|Governor's Harbour|Bahamas|BS|25.28|-76.33|0.04|0.75|2.10|8024|1|26
GKA|Goronka|Papua-Nova Guine|PG|-6.08|145.39|0.04|0.34|0.90|5400|1|5282
GKN|Gulkana|EUA|US|62.16|-145.45|0.04|1.10|1.10|5001|1|1586
GLF|Golfito|Costa Rica|CR|8.65|-83.18|0.04|0.61|1.85|4593|1|49
GLH|Greenville|EUA|US|33.48|-90.99|0.04|1.10|1.10|8001|1|131
GMR|Totegegie|Polinesia Francesa|PF|-23.08|-134.89|0.04|0.85|2.10|6562|1|7
GOQ|Golmud|China|CN|36.40|94.79|0.04|0.80|1.00|15748|1|9334
GOV|Nhulunbuy|Australia|AU|-12.27|136.82|0.04|1.20|1.40|7244|1|192
GOY|Tura|Russia|RU|64.33|100.43|0.04|0.71|1.05|4593|1|2044
GPS|Isla Baltra|Equador|EC|-0.45|-90.27|0.04|0.57|1.05|7877|1|207
GRW|Santa Cruz da Graciosa|Portugal|PT|39.09|-28.03|0.04|0.84|1.90|4529|1|86
GST|Gustavus|EUA|US|58.43|-135.71|0.04|1.10|1.10|6720|1|35
GTE|Groote Eylandt|Australia|AU|-13.97|136.46|0.04|1.20|1.40|6237|1|53
GUB|San Quintin|Mexico|MX|28.03|-114.02|0.04|0.69|1.30|7216|1|59
GUC|Gunnison|EUA|US|38.53|-106.93|0.04|1.10|1.10|9400|1|7680
GUP|Gallup|EUA|US|35.51|-108.79|0.04|1.10|1.10|7312|1|6472
GUR|Gurney|Papua-Nova Guine|PG|-10.31|150.33|0.04|0.34|0.90|5546|1|88
GWT|Sylt|Alemanha|DE|54.91|8.34|0.04|1.15|1.00|6955|1|51
GYZ|Cosmo Newbery|Australia|AU|-28.03|123.82|0.04|1.20|1.40|6890|1|1542
HAC|Hachijojima|Japao|JP|33.11|139.79|0.04|1.23|1.50|6563|1|303
HDN|Hayden|EUA|US|40.48|-107.22|0.04|1.10|1.10|10000|1|6606
HFN|Hofn|Islandia|IS|64.30|-15.23|0.04|1.15|2.10|4921|1|24
HFS|Rada|Suecia|SE|60.02|13.58|0.04|1.23|1.00|4951|1|474
HGD|Hughenden|Australia|AU|-20.82|144.23|0.04|1.20|1.40|5394|1|1043
HGN|Mae Hong Son|Tailandia|TH|19.30|97.98|0.04|0.60|2.00|6562|1|929
HGU|Mount Hagen|Papua-Nova Guine|PG|-5.83|144.30|0.04|0.34|0.90|7185|1|5388
HIB|Hibbing|EUA|US|47.38|-92.84|0.04|1.10|1.10|6758|1|1354
HID|Horn|Australia|AU|-10.59|142.29|0.04|1.20|1.40|4557|1|43
HKN|Kimbe|Papua-Nova Guine|PG|-5.46|150.41|0.04|0.34|0.90|6644|1|66
HLE|Jamestown|Santa Helena|SH|-15.96|-5.65|0.04|0.80|1.50|6398|1|1017
HLN|Helena|EUA|US|46.61|-111.98|0.04|1.10|1.10|9000|1|3877
HME|Hassi Messaoud|Argelia|DZ|31.67|6.14|0.04|0.60|0.70|9843|1|463
HMV|Hemavan|Suecia|SE|65.81|15.08|0.04|1.23|1.00|5254|1|1503
HOB|Hobbs|EUA|US|32.69|-103.22|0.04|1.10|1.10|8000|1|3661
HOI|Otepa|Polinesia Francesa|PF|-18.07|-140.95|0.04|0.85|2.10|11089|1|10
HOM|Homer|EUA|US|59.64|-151.48|0.04|1.10|1.10|6701|1|84
HOR|Horta|Portugal|PT|38.52|-28.72|0.04|0.84|1.90|5233|1|118
HRO|Harrison|EUA|US|36.26|-93.15|0.04|1.10|1.10|6161|1|1365
HTG|Khatanga|Russia|RU|71.98|102.49|0.04|0.71|1.05|8872|1|95
HTI|Hamilton Island|Australia|AU|-20.36|148.95|0.04|1.20|1.40|5591|1|15
HUH|Fare|Polinesia Francesa|PF|-16.69|-151.02|0.04|0.85|2.10|4921|1|7
HVD|Khovd|Mongolia|MN|47.95|91.63|0.04|0.42|1.10|9352|1|4898
HVR|Havre|EUA|US|48.54|-109.76|0.04|1.10|1.10|5205|1|2591
HYS|Hays|EUA|US|38.84|-99.27|0.04|1.10|1.10|6501|1|1999
IAA|Igarka|Russia|RU|67.44|86.62|0.04|0.71|1.05|8202|1|82
IAM|In Amenas|Argelia|DZ|28.05|9.64|0.04|0.60|0.70|9843|1|1847
IBB|Puerto Villamil|Equador|EC|-0.94|-90.95|0.04|0.57|1.05|4921|1|35
IFJ|Isafjordur|Islandia|IS|66.06|-23.14|0.04|1.15|2.10|4593|1|8
IGA|Matthew Town|Bahamas|BS|20.98|-73.67|0.04|0.75|2.10|7020|1|8
IKS|Tiksi|Russia|RU|71.70|128.90|0.04|0.71|1.05|9845|1|26
ILI|Iliamna|EUA|US|59.75|-154.91|0.04|1.10|1.10|5086|1|192
ILY|Isle of Islay, Argyll and|Reino Unido|GB|55.68|-6.26|0.04|1.05|1.10|5098|1|56
IMT|Kingsford|EUA|US|45.82|-88.11|0.04|1.10|1.10|6502|1|1182
INL|International Falls|EUA|US|48.57|-93.40|0.04|1.10|1.10|7400|1|1185
INU|Yaren|Nauru|NR|-0.55|166.92|0.04|0.55|0.80|7054|1|22
INZ|In Salah|Argelia|DZ|27.25|2.51|0.04|0.60|0.70|9843|1|896
IPT|Williamsport|EUA|US|41.24|-76.92|0.04|1.10|1.10|6825|1|529
IRG|Lockhart River|Australia|AU|-12.79|143.30|0.04|1.20|1.40|4919|1|77
IRK|Kirksville|EUA|US|40.09|-92.54|0.04|1.10|1.10|6005|1|966
ISA|Mount Isa|Australia|AU|-20.67|139.49|0.04|1.20|1.40|8399|1|1121
ITO|Hilo|EUA|US|19.72|-155.05|0.04|1.10|1.10|9800|1|38
ITU|Kurilsk|Russia|RU|45.26|147.96|0.04|0.71|1.05|7546|1|387
IUE|Alofi|Niue|NU|-19.08|-169.92|0.04|0.70|1.60|7660|1|209
IWD|Ironwood|EUA|US|46.53|-90.13|0.04|1.10|1.10|6502|1|1230
IXL|Leh|India|IN|34.14|77.55|0.04|0.52|0.90|9040|1|10682
JAC|Jackson|EUA|US|43.61|-110.74|0.04|1.10|1.10|6300|1|6451
JCK|Julia Creek|Australia|AU|-20.67|141.72|0.04|1.20|1.40|4600|1|404
JIK|Ikaria Island|Grecia|GR|37.68|26.35|0.04|0.77|2.10|4551|1|79
JJU|Qaqortoq|Groenlandia|GL|60.76|-46.07|0.04|1.00|1.60|4924|1|505
JMK|Mykonos|Grecia|GR|37.44|25.35|0.04|0.77|2.10|6240|1|405
JMS|Jamestown|EUA|US|46.93|-98.68|0.04|1.10|1.10|6502|1|1500
JNU|Juneau|EUA|US|58.35|-134.57|0.04|1.10|1.10|8857|1|21
JSH|Crete Island|Grecia|GR|35.22|26.10|0.04|0.77|2.10|6804|1|376
JZH|Ngawa|China|CN|32.85|103.68|0.04|0.80|1.00|10499|1|11327
KAB|Kariba|Zimbabue|ZW|-16.52|28.89|0.04|0.30|0.90|5413|1|1706
KAJ|Kajaani|Finlandia|FI|64.29|27.69|0.04|1.30|1.10|8199|1|483
KAO|Kuusamo|Finlandia|FI|65.99|29.24|0.04|1.30|1.10|8202|1|866
KAT|Awanui|Nova Zelandia|NZ|-35.07|173.29|0.04|1.12|1.65|4600|1|270
KAX|Kalbarri|Australia|AU|-27.69|114.26|0.04|1.20|1.40|5246|1|157
KBU|Stagen|Indonesia|ID|-3.29|116.16|0.04|0.50|0.90|5413|1|4
KDL|Kardla|Estonia|EE|58.99|22.83|0.04|0.90|1.20|4987|1|18
KEM|Kemi / Tornio|Finlandia|FI|65.78|24.58|0.04|1.30|1.10|8212|1|61
KGC|Kingscote|Australia|AU|-35.71|137.52|0.04|1.20|1.40|4600|1|24
KGI|Broadwood|Australia|AU|-30.79|121.46|0.04|1.20|1.40|6562|1|1203
KIE|Kieta|Papua-Nova Guine|PG|-6.31|155.73|0.04|0.34|0.90|5397|1|20
KIR|Farranfore|Irlanda|IE|52.18|-9.52|0.04|1.15|1.15|6562|1|112
KIT|Kithira Island|Grecia|GR|36.27|23.02|0.04|0.77|2.10|4794|1|1045
KJI|Burqin|China|CN|48.22|87.00|0.04|0.80|1.00|8202|1|3921
KKN|Kirkenes|Noruega|NO|69.73|29.89|0.04|1.20|1.20|6939|1|283
KLW|Klawock|EUA|US|55.58|-133.08|0.04|1.10|1.10|5000|1|80
KMC|King Khaled Military City|Arabia Saudita|SA|27.90|45.53|0.04|0.97|1.10|12005|1|1352
KNG|Kaimana|Indonesia|ID|-3.64|133.70|0.04|0.50|0.90|5249|1|19
KNS|King Island|Australia|AU|-39.88|143.88|0.04|1.20|1.40|5198|1|132
KNX|Kununurra|Australia|AU|-15.78|128.71|0.04|1.20|1.40|6000|1|145
KOI|Kirkwall, Orkney Islands|Reino Unido|GB|58.96|-2.91|0.04|1.05|1.10|4690|1|50
KPW|Keperveem|Russia|RU|67.85|166.14|0.04|0.71|1.05|11482|1|623
KQA|Akutan|EUA|US|54.14|-165.60|0.04|1.10|1.10|4500|1|133
KQR|Karara|Australia|AU|-29.22|116.69|0.04|1.20|1.40|4593|1|1011
KTA|Karratha|Australia|AU|-20.71|116.77|0.04|1.20|1.40|7480|1|29
KTD|Kitadaitojima|Japao|JP|25.94|131.33|0.04|1.23|1.50|4921|1|80
KTG|Ketapang|Indonesia|ID|-1.82|109.96|0.04|0.50|0.90|4585|1|46
KTN|Ketchikan|EUA|US|55.36|-131.71|0.04|1.10|1.10|7500|1|89
KUM|Yakushima|Japao|JP|30.39|130.66|0.04|1.23|1.50|4921|1|124
KVG|Kavieng|Papua-Nova Guine|PG|-2.58|150.81|0.04|0.34|0.90|5592|1|7
KWA|Kwajalein|Ilhas Marshall|MH|8.72|167.73|0.04|0.48|1.10|6668|1|9
KWM|Kowanyama|Australia|AU|-15.49|141.75|0.04|1.20|1.40|4528|1|35
KXB|Kolaka|Indonesia|ID|-4.34|121.52|0.04|0.50|0.90|6070|1|40
LAR|Laramie|EUA|US|41.31|-105.68|0.04|1.10|1.10|8503|1|7284
LAU|Lamu|Quenia|KE|-2.25|40.91|0.04|0.45|1.50|6561|1|20
LBF|North Platte|EUA|US|41.13|-100.68|0.04|1.10|1.10|8001|1|2777
LBL|Liberal|EUA|US|37.04|-100.96|0.04|1.10|1.10|7105|1|2885
LDG|Leshukonskoye|Russia|RU|64.90|45.72|0.04|0.71|1.05|5236|1|220
LEA|Exmouth|Australia|AU|-22.24|114.09|0.04|1.20|1.40|9997|1|19
LEB|Lebanon|EUA|US|43.63|-72.30|0.04|1.10|1.10|5496|1|603
LER|Leinster|Australia|AU|-27.84|120.70|0.04|1.20|1.40|5906|1|1631
LHG|Lightning Ridge|Australia|AU|-29.45|147.98|0.04|1.20|1.40|4613|1|540
LHS|Las Heras|Argentina|AR|-46.54|-68.97|0.04|0.60|1.50|4593|1|1082
LIW|Loikaw|Mianmar|MM|19.69|97.21|0.04|0.30|0.70|5200|1|2940
LKL|Lakselv|Noruega|NO|70.07|24.97|0.04|1.20|1.20|9147|1|25
LMP|Lampedusa|Italia|IT|35.50|12.62|0.04|1.00|1.40|5906|1|70
LNO|Leonora|Australia|AU|-28.88|121.32|0.04|1.20|1.40|6621|1|1217
LRE|Longreach|Australia|AU|-23.43|144.28|0.04|1.20|1.40|6352|1|627
LSI|Lerwick, Shetland|Reino Unido|GB|59.88|-1.30|0.04|1.05|1.10|4915|1|20
LSR|Kutacane|Indonesia|ID|3.39|97.86|0.04|0.50|0.90|5358|1|419
LSY|Lismore|Australia|AU|-28.83|153.26|0.04|1.20|1.40|5404|1|35
LTD|Ghadames|Libia|LY|30.15|9.70|0.04|0.40|0.50|11811|1|1122
LTM|Lethem|Guiana|GY|3.37|-59.79|0.04|0.48|0.80|5985|1|351
LUD|Luderitz|Namibia|NA|-26.69|15.24|0.04|0.45|1.30|6004|1|457
LVO|Laverton|Australia|AU|-28.61|122.43|0.04|1.20|1.40|5906|1|1530
LWB|Lewisburg|EUA|US|37.86|-80.40|0.04|1.10|1.10|7003|1|2302
LWK|Lerwick, Shetland Islands|Reino Unido|GB|60.19|-1.24|0.04|1.05|1.10|5787|1|43
LXS|Limnos Island|Grecia|GR|39.92|25.24|0.04|0.77|2.10|9895|1|14
LYC|Lycksele|Suecia|SE|64.55|18.72|0.04|1.23|1.00|6564|1|705
LYR|Longyearbyen|Noruega|NO|78.25|15.47|0.04|1.20|1.20|7608|1|88
MAG|Madang|Papua-Nova Guine|PG|-5.21|145.79|0.04|0.34|0.90|5174|1|20
MAS|Manus Island|Papua-Nova Guine|PG|-2.06|147.42|0.04|0.34|0.90|6136|1|12
MBL|Manistee|EUA|US|44.27|-86.25|0.04|1.10|1.10|5501|1|621
MCG|McGrath|EUA|US|62.95|-155.61|0.04|1.10|1.10|5936|1|341
MCK|McCook|EUA|US|40.21|-100.59|0.04|1.10|1.10|6450|1|2583
MCV|McArthur River Mine|Australia|AU|-16.44|136.08|0.04|1.20|1.40|4931|1|131
MDU|Mendi|Papua-Nova Guine|PG|-6.15|143.66|0.04|0.34|0.90|4411|1|5680
MEI|Meridian|EUA|US|32.33|-88.75|0.04|1.10|1.10|10003|1|297
MFA|Kilindoni|Tanzania|TZ|-7.92|39.67|0.04|0.32|1.45|5348|1|60
MGB|Mount Gambier|Australia|AU|-37.74|140.78|0.04|1.20|1.40|5394|1|217
MHH|Marsh Harbour|Bahamas|BS|26.51|-77.08|0.04|0.75|2.10|6100|1|6
MHQ|Mariehamn|Finlandia|FI|60.12|19.90|0.04|1.30|1.10|6243|1|17
MHU|Mount Hotham|Australia|AU|-37.05|147.33|0.04|1.20|1.40|4762|1|4260
MIM|Merimbula|Australia|AU|-36.91|149.90|0.04|1.20|1.40|5256|1|7
MJK|Denham|Australia|AU|-25.90|113.58|0.04|1.20|1.40|5545|1|111
MJZ|Mirny|Russia|RU|62.53|114.04|0.04|0.71|1.05|9187|1|1156
MKP|Makemo|Polinesia Francesa|PF|-16.58|-143.66|0.04|0.85|2.10|4920|1|3
MKR|Meekatharra|Australia|AU|-26.61|118.55|0.04|1.20|1.40|7156|1|1713
MKU|Makokou|Gabao|GA|0.58|12.89|0.04|0.45|0.70|5892|1|1726
MMD|Minamidaito|Japao|JP|25.85|131.26|0.04|1.23|1.50|4921|1|167
MMH|Mammoth Lakes|EUA|US|37.63|-118.84|0.04|1.10|1.10|7000|1|7135
MNG|Maningrida|Australia|AU|-12.06|134.23|0.04|1.20|1.40|5020|1|123
MOH|Morowali|Indonesia|ID|-2.20|121.66|0.04|0.50|0.90|6070|1|12
MOV|Moranbah|Australia|AU|-22.06|148.08|0.04|1.20|1.40|5000|1|770
MPA|Mpacha|Namibia|NA|-17.63|24.18|0.04|0.45|1.30|7520|1|3144
MPN|Mount Pleasant|Ilhas Malvinas|FK|-51.82|-58.45|0.04|0.90|1.40|8497|1|244
MQL|Mildura|Australia|AU|-34.23|142.09|0.04|1.20|1.40|6004|1|167
MQT|Gwinn|EUA|US|46.35|-87.40|0.04|1.10|1.10|9072|1|1221
MRZ|Moree|Australia|AU|-29.50|149.85|0.04|1.20|1.40|5292|1|701
MSS|Massena|EUA|US|44.94|-74.84|0.04|1.10|1.10|5601|1|215
MTJ|Montrose|EUA|US|38.51|-107.89|0.04|1.10|1.10|10000|1|5759
MUA|Munda|Ilhas Salomao|SB|-8.33|157.26|0.04|0.30|1.20|4593|1|10
MUE|Waimea|EUA|US|20.00|-155.67|0.04|1.10|1.10|5197|1|2671
MVP|Mitu|Colombia|CO|1.25|-70.23|0.04|0.55|1.10|5889|1|680
MXV|Moron|Mongolia|MN|49.66|100.10|0.04|0.42|1.10|7874|1|4272
MXX|Mora|Suecia|SE|60.96|14.51|0.04|1.23|1.00|5951|1|634
MYA|Moruya|Australia|AU|-35.90|150.14|0.04|1.20|1.40|4997|1|14
MYG|Abraham Bay Settlement|Bahamas|BS|22.38|-73.01|0.04|0.75|2.10|7297|1|11
MYL|McCall|EUA|US|44.89|-116.10|0.04|1.10|1.10|6101|1|5024
MZQ|Mkuze|Africa do Sul|ZA|-27.63|32.04|0.04|0.65|1.20|6070|1|400
NAA|Narrabri|Australia|AU|-30.32|149.83|0.04|1.20|1.40|5000|1|788
NAM|Namniwel|Indonesia|ID|-3.14|126.98|0.04|0.50|0.90|5249|1|7
NBN|San Antonio de Pale|Guine Equatorial|GQ|-1.41|5.62|0.04|0.40|0.50|6177|1|82
NGK|Nogliki|Russia|RU|51.78|143.14|0.04|0.71|1.05|5741|1|109
NGQ|Shiquanhe|China|CN|32.10|80.05|0.04|0.80|1.00|14764|1|14022
NHV|Nuku Hiva|Polinesia Francesa|PF|-8.80|-140.23|0.04|0.85|2.10|5578|1|220
NLI|Nikolayevsk-na-Amure|Russia|RU|53.15|140.65|0.04|0.71|1.05|6233|1|170
NLK|Burnt Pine|Ilha Norfolk|NF|-29.04|167.94|0.04|0.85|1.40|6398|1|371
NMF|Noonu Atoll|Maldivas|MV|5.82|73.47|0.04|0.75|2.20|9350|1|6
NNM|Naryan Mar|Russia|RU|67.64|53.12|0.04|0.71|1.05|8202|1|36
NNT|Nan|Tailandia|TH|18.81|100.78|0.04|0.60|2.00|6562|1|685
NRA|Narrandera|Australia|AU|-34.70|146.51|0.04|1.20|1.40|5302|1|474
NTN|Normanton|Australia|AU|-17.68|141.07|0.04|1.20|1.40|5499|1|73
NTX|Ranai-Natuna Besar Island|Indonesia|ID|3.91|108.39|0.04|0.50|0.90|8410|1|7
NZG|Nizhneangarsk|Russia|RU|55.80|109.60|0.04|0.71|1.05|5249|1|1545
OER|Ornskoldsvik|Suecia|SE|63.41|18.99|0.04|1.23|1.00|6607|1|354
OES|San Antonio Oeste|Argentina|AR|-40.75|-65.03|0.04|0.60|1.50|5905|1|85
OGN|Yonaguni|Japao|JP|24.47|122.98|0.04|1.23|1.50|4920|1|70
OGS|Ogdensburg|EUA|US|44.68|-75.47|0.04|1.10|1.10|6400|1|297
OHO|Okhotsk|Russia|RU|59.41|143.06|0.04|0.71|1.05|6562|1|45
OIR|Okushiri Island|Japao|JP|42.07|139.43|0.04|1.23|1.50|4922|1|161
OJU|Tojo Una-Una|Indonesia|ID|-0.87|121.63|0.04|0.50|0.90|6070|1|49
OKE|Wadomari|Japao|JP|27.43|128.71|0.04|1.23|1.50|4430|1|101
OKI|Okinoshima|Japao|JP|36.18|133.32|0.04|1.23|1.50|6531|1|311
OLF|Wolf Point|EUA|US|48.09|-105.57|0.04|1.10|1.10|5091|1|1986
OLP|Olympic Dam|Australia|AU|-30.48|136.88|0.04|1.20|1.40|6102|1|344
OMD|Oranjemund|Namibia|NA|-28.59|16.45|0.04|0.45|1.30|5252|1|14
OME|Nome|EUA|US|64.51|-165.45|0.04|1.10|1.10|6176|1|37
OOM|Cooma|Australia|AU|-36.30|148.97|0.04|1.20|1.40|6955|1|3088
OTH|North Bend|EUA|US|43.42|-124.25|0.04|1.10|1.10|5980|1|17
OTZ|Kotzebue|EUA|US|66.88|-162.60|0.04|1.10|1.10|6300|1|14
PAH|Paducah|EUA|US|37.06|-88.77|0.04|1.10|1.10|6499|1|410
PAS|Paros|Grecia|GR|37.02|25.11|0.04|0.77|2.10|4593|1|131
PBO|Paraburdoo|Australia|AU|-23.17|117.75|0.04|1.20|1.40|6995|1|1406
PBU|Putao|Mianmar|MM|27.33|97.43|0.04|0.30|0.70|7002|1|1500
PCR|Puerto Carreno|Colombia|CO|6.18|-67.49|0.04|0.55|1.10|5907|1|177
PDA|Puerto Inirida|Colombia|CO|3.85|-67.91|0.04|0.55|1.10|5910|1|460
PGA|Page|EUA|US|36.92|-111.45|0.04|1.10|1.10|5950|1|4316
PIR|Pierre|EUA|US|44.38|-100.29|0.04|1.10|1.10|6900|1|1744
PIX|Pico Island|Portugal|PT|38.55|-28.44|0.04|0.84|1.90|5725|1|109
PJA|Pajala|Suecia|SE|67.24|23.07|0.04|1.23|1.00|7552|1|542
PKE|Parkes|Australia|AU|-33.13|148.24|0.04|1.20|1.40|5525|1|1069
PLN|Pellston|EUA|US|45.57|-84.80|0.04|1.10|1.10|6513|1|721
PLO|Port Lincoln|Australia|AU|-34.61|135.88|0.04|1.20|1.40|4918|1|36
PMQ|Perito Moreno|Argentina|AR|-46.54|-70.98|0.04|0.60|1.50|5577|1|1410
PNI|Pohnpei Island|Micronesia|FM|6.99|158.21|0.04|0.50|1.20|6600|1|10
PNL|Pantelleria|Italia|IT|36.82|11.97|0.04|1.00|1.40|5495|1|628
PNP|Popondetta|Papua-Nova Guine|PG|-8.80|148.31|0.04|0.34|0.90|5485|1|311
PNT|Puerto Natales|Chile|CL|-51.67|-72.53|0.04|0.70|1.30|5786|1|217
PPP|Proserpine|Australia|AU|-20.49|148.55|0.04|1.20|1.40|6801|1|82
PQI|Presque Isle|EUA|US|46.69|-68.04|0.04|1.10|1.10|7441|1|534
PSG|Petersburg|EUA|US|56.80|-132.95|0.04|1.10|1.10|6400|1|111
PSZ|Puerto Suarez|Bolivia|BO|-18.98|-57.82|0.04|0.46|1.05|6562|1|440
PTJ|Portland|Australia|AU|-38.32|141.47|0.04|1.20|1.40|5302|1|265
PUD|Puerto Deseado|Argentina|AR|-47.74|-65.90|0.04|0.60|1.50|4921|1|268
PUG|Whyalla|Australia|AU|-32.51|137.72|0.04|1.20|1.40|5413|1|56
PUZ|Puerto Cabezas|Nicaragua|NI|14.05|-83.39|0.04|0.35|0.80|8130|1|52
PWE|Apapelgino|Russia|RU|69.78|170.60|0.04|0.71|1.05|8202|1|11
PXM|Puerto Escondido|Mexico|MX|15.88|-97.09|0.04|0.69|1.30|7546|1|294
PXO|Vila Baleira|Portugal|PT|33.07|-16.35|0.04|0.78|1.90|9861|1|341
PYJ|Yakutia|Russia|RU|66.40|112.03|0.04|0.71|1.05|10170|1|1660
RAB|Kokopo|Papua-Nova Guine|PG|-4.34|152.38|0.04|0.34|0.90|5643|1|49
RAH|Rafha|Arabia Saudita|SA|29.63|43.49|0.04|0.97|1.10|9834|1|1474
RBQ|Rurrenabaque|Bolivia|BO|-14.43|-67.50|0.04|0.46|1.05|4921|1|676
RCM|Richmond|Australia|AU|-20.70|143.12|0.04|1.20|1.40|5000|1|676
RFP|Uturoa|Polinesia Francesa|PF|-16.72|-151.47|0.04|0.85|2.10|4593|1|3
RGI|Rangiroa|Polinesia Francesa|PF|-14.95|-147.66|0.04|0.85|2.10|6890|1|10
RHI|Rhinelander|EUA|US|45.63|-89.47|0.04|1.10|1.10|6800|1|1624
RIW|Riverton|EUA|US|43.06|-108.46|0.04|1.10|1.10|8204|1|5525
RKD|Rockland|EUA|US|44.06|-69.10|0.04|1.10|1.10|5412|1|56
RKI|Sipura Island|Indonesia|ID|-2.10|99.70|0.04|0.50|0.90|4921|1|26
RKS|Rock Springs|EUA|US|41.59|-109.07|0.04|1.10|1.10|10002|1|6764
RMA|Roma|Australia|AU|-26.55|148.77|0.04|1.20|1.40|4934|1|1032
RNI|Corn Island|Nicaragua|NI|12.17|-83.06|0.04|0.35|0.80|6234|1|1
RNN|Ronne|Dinamarca|DK|55.06|14.76|0.04|1.40|1.30|6568|1|52
RRS|Roros|Noruega|NO|62.58|11.34|0.04|1.20|1.20|5643|1|2054
RSD|Rock Sound|Bahamas|BS|24.89|-76.18|0.04|0.75|2.10|7213|1|10
RTI|Ba'a - Rote Island|Indonesia|ID|-10.77|123.08|0.04|0.50|0.90|5413|1|470
RUR|Rurutu|Polinesia Francesa|PF|-22.43|-151.36|0.04|0.85|2.10|4757|1|18
RUT|Rutland|EUA|US|43.53|-72.95|0.04|1.10|1.10|5304|1|787
RVV|Raivavae|Polinesia Francesa|PF|-23.89|-147.66|0.04|0.85|2.10|4592|1|7
RYO|Rio Turbio|Argentina|AR|-51.60|-72.22|0.04|0.60|1.50|6340|1|909
SAQ|Andros Island|Bahamas|BS|25.05|-78.05|0.04|0.75|2.10|5025|1|5
SBT|Sabetta|Russia|RU|71.22|72.05|0.04|0.71|1.05|8858|1|46
SCC|Deadhorse|EUA|US|70.19|-148.46|0.04|1.10|1.10|6500|1|65
SCT|Mori|Iemen|YE|12.63|53.91|0.04|0.20|0.50|10827|1|146
SCY|Puerto Baquerizo Moreno|Equador|EC|-0.91|-89.62|0.04|0.57|1.05|6214|1|62
SDY|Sidney|EUA|US|47.71|-104.19|0.04|1.10|1.10|5705|1|1985
SEK|Srednekolymsk|Russia|RU|67.48|153.74|0.04|0.71|1.05|5906|1|60
SFJ|Kangerlussuaq|Groenlandia|GL|67.01|-50.72|0.04|1.00|1.60|9219|1|165
SFT|Skelleftea|Suecia|SE|64.62|21.08|0.04|1.23|1.00|8268|1|157
SGO|St George|Australia|AU|-28.05|148.60|0.04|1.20|1.40|4987|1|656
SHH|Shishmaref|EUA|US|66.25|-166.09|0.04|1.10|1.10|4997|1|12
SHR|Sheridan|EUA|US|44.77|-106.98|0.04|1.10|1.10|8301|1|4021
SHW|Sharurah|Arabia Saudita|SA|17.47|47.12|0.04|0.97|1.10|11975|1|2363
SIS|Sishen|Africa do Sul|ZA|-27.65|23.00|0.04|0.65|1.20|5709|1|3848
SIT|Sitka|EUA|US|57.05|-135.36|0.04|1.10|1.10|7200|1|21
SJZ|Velas|Portugal|PT|38.67|-28.18|0.04|0.84|1.90|4633|1|311
SKU|Skiros Island|Grecia|GR|38.97|24.49|0.04|0.77|2.10|9849|1|44
SLK|Saranac Lake|EUA|US|44.39|-74.20|0.04|1.10|1.10|6573|1|1663
SMA|Vila do Porto|Portugal|PT|36.97|-25.17|0.04|0.84|1.90|10000|1|308
SMI|Samos Island|Grecia|GR|37.69|26.91|0.04|0.77|2.10|6706|1|19
SMN|Salmon|EUA|US|45.12|-113.88|0.04|1.10|1.10|5510|1|4043
SMW|Smara|Saara Ocidental|EH|26.73|-11.68|0.04|0.30|0.60|9843|1|350
SNB|Milikapiti|Australia|AU|-11.42|130.65|0.04|1.20|1.40|4734|1|173
SNE|Preguica|Cabo Verde|CV|16.59|-24.28|0.04|0.45|1.90|4593|1|669
SNP|St Paul Island|EUA|US|57.17|-170.22|0.04|1.10|1.10|6500|1|63
SNV|Santa Elena de Uairen|Venezuela|VE|4.55|-61.15|0.04|0.45|0.70|5445|1|2938
SON|Luganville|Vanuatu|VU|-15.51|167.22|0.04|0.38|1.60|6523|1|184
SOW|Show Low|EUA|US|34.26|-110.01|0.04|1.10|1.10|7202|1|6415
SPC|Sta Cruz de la Palma, La|Espanha|ES|28.63|-17.76|0.04|0.85|1.90|7218|1|107
SSJ|Alstahaug|Noruega|NO|65.96|12.47|0.04|1.20|1.20|4619|1|56
SUN|Hailey|EUA|US|43.50|-114.30|0.04|1.10|1.10|7550|1|5318
SUY|Suntar|Russia|RU|62.19|117.64|0.04|0.71|1.05|5906|1|452
SVC|Silver City|EUA|US|32.64|-108.15|0.04|1.10|1.10|6803|1|5446
SVI|San Vicente Del Caguan|Colombia|CO|2.15|-74.77|0.04|0.55|1.10|4921|1|920
SWL|San Vicente|Filipinas|PH|10.52|119.27|0.04|0.47|1.05|5915|1|24
SWX|Shakawe|Botsuana|BW|-18.37|21.83|0.04|0.52|1.30|6102|1|3379
SXK|Saumlaki-Yamdena Island|Indonesia|ID|-7.85|131.34|0.04|0.50|0.90|6562|1|446
SYY|Stornoway, Western Isles|Reino Unido|GB|58.22|-6.33|0.04|1.05|1.10|7218|1|26
SZI|Zaysan|Cazaquistao|KZ|47.49|84.89|0.04|0.67|0.75|4938|1|1877
TBI|Cat Island|Bahamas|BS|24.32|-75.45|0.04|0.75|2.10|5050|1|5
TBN|Fort Leonard Wood|EUA|US|37.74|-92.14|0.04|1.10|1.10|6037|1|1159
TCA|Tennant Creek|Australia|AU|-19.63|134.18|0.04|1.20|1.40|6427|1|1236
TCB|Treasure Cay|Bahamas|BS|26.75|-77.39|0.04|0.75|2.10|7001|1|8
TCP|Taba|Egito|EG|29.59|34.78|0.04|0.45|2.00|13123|1|2425
TER|Praia da Vitoria|Portugal|PT|38.76|-27.09|0.04|0.84|1.90|10870|1|180
TEX|Telluride|EUA|US|37.95|-107.91|0.04|1.10|1.10|7111|1|9070
THG|Biloela|Australia|AU|-24.49|150.58|0.04|1.20|1.40|4993|1|644
THX|Turukhansk|Russia|RU|65.80|87.94|0.04|0.71|1.05|5905|1|128
TKN|Amagi|Japao|JP|27.84|128.88|0.04|1.23|1.50|6561|1|17
TMC|Radamata|Indonesia|ID|-9.41|119.24|0.04|0.50|0.90|5905|1|161
TMW|Tamworth|Australia|AU|-31.08|150.85|0.04|1.20|1.40|7218|1|1334
TMX|Timimoun|Argelia|DZ|29.24|0.28|0.04|0.60|0.70|9843|1|1027
TNE|Tanegashima|Japao|JP|30.61|130.99|0.04|1.23|1.50|6544|1|768
TPP|Tarapoto|Peru|PE|-6.51|-76.37|0.04|0.52|1.50|8530|1|869
TRE|Balemartine, Argyll and|Reino Unido|GB|56.50|-6.87|0.04|1.05|1.10|4600|1|38
TSM|Taos|EUA|US|36.45|-105.68|0.04|1.10|1.10|5504|1|7095
TUB|Tubuai|Polinesia Francesa|PF|-23.37|-149.52|0.04|0.85|2.10|4921|1|7
TVC|Traverse City|EUA|US|44.74|-85.58|0.04|1.10|1.10|7016|1|624
TWT|Bongao|Filipinas|PH|5.05|119.74|0.04|0.47|1.05|6102|1|15
TYF|Torsby|Suecia|SE|60.16|12.99|0.04|1.23|1.00|5219|1|393
TZN|Andros|Bahamas|BS|24.16|-77.59|0.04|0.75|2.10|5300|1|15
UAR|Bouarfa|Marrocos|MA|32.51|-1.98|0.04|0.54|1.65|10499|1|3630
UEO|Kumejima|Japao|JP|26.36|126.71|0.04|1.23|1.50|6562|1|23
ULO|Ulaangom|Mongolia|MN|50.07|91.94|0.04|0.42|1.10|8815|1|5676
ULP|Quilpie|Australia|AU|-26.61|144.25|0.04|1.20|1.40|4898|1|655
UNK|Unalakleet|EUA|US|63.89|-160.80|0.04|1.10|1.10|5900|1|27
URE|Kuressaare|Estonia|EE|58.23|22.51|0.04|0.90|1.20|6561|1|14
URJ|Uray|Russia|RU|60.10|64.83|0.04|0.71|1.05|7218|1|190
USJ|Usharal|Cazaquistao|KZ|46.19|80.83|0.04|0.67|0.75|7546|1|1288
USK|Usinsk|Russia|RU|66.00|57.37|0.04|0.71|1.05|8202|1|262
USR|Ust-Nera|Russia|RU|64.55|143.12|0.04|0.71|1.05|5020|1|1805
VAM|Maamigili|Maldivas|MV|3.47|72.83|0.04|0.75|2.20|5905|1|6
VAQ|Vanavara|Russia|RU|60.36|102.31|0.04|0.71|1.05|4592|1|892
VCS|Con Dao|Vietna|VN|8.73|106.63|0.04|0.58|1.40|6004|1|20
VDZ|Valdez|EUA|US|61.13|-146.25|0.04|1.10|1.10|6500|1|121
VEL|Vernal|EUA|US|40.44|-109.51|0.04|1.10|1.10|7000|1|5278
VEO|Severo-Yeniseysk|Russia|RU|60.37|93.01|0.04|0.71|1.05|4920|1|1706
VHM|Vilhelmina|Suecia|SE|64.58|16.83|0.04|1.23|1.00|4928|1|1140
VHV|Verkhnevilyuisk|Russia|RU|63.46|120.27|0.04|0.71|1.05|4593|1|411
VNX|Vilanculo|Mocambique|MZ|-22.02|35.31|0.04|0.30|0.80|4823|1|46
VVZ|Illizi|Argelia|DZ|26.72|8.62|0.04|0.60|0.70|9843|1|1778
VYI|Vilyuisk|Russia|RU|63.76|121.69|0.04|0.71|1.05|5249|1|361
WAE|Wadi Al Dawasir|Arabia Saudita|SA|20.50|45.20|0.04|0.97|1.10|10007|1|2062
WEI|Weipa|Australia|AU|-12.68|141.92|0.04|1.20|1.40|5397|1|63
WGA|Forest Hill|Australia|AU|-35.16|147.47|0.04|1.20|1.40|5807|1|724
WGE|Walgett|Australia|AU|-30.03|148.13|0.04|1.20|1.40|5335|1|439
WGP|Waingapu-Sumba Island|Indonesia|ID|-9.67|120.30|0.04|0.50|0.90|5415|1|33
WIC|Wick|Reino Unido|GB|58.46|-3.09|0.04|1.05|1.10|6007|1|126
WIN|Winton|Australia|AU|-22.36|143.09|0.04|1.20|1.40|4600|1|638
WNI|Wangi-wangi Island|Indonesia|ID|-5.29|123.64|0.04|0.50|0.90|6959|1|88
WNR|Windorah|Australia|AU|-25.41|142.67|0.04|1.20|1.40|4508|1|452
WRG|Wrangell|EUA|US|56.48|-132.37|0.04|1.10|1.10|6000|1|49
WUN|Wiluna|Australia|AU|-26.63|120.22|0.04|1.20|1.40|5942|1|1649
WWK|Wewak|Papua-Nova Guine|PG|-3.58|143.67|0.04|0.34|0.90|5234|1|19
WYA|Whyalla|Australia|AU|-33.06|137.51|0.04|1.20|1.40|5531|1|41
WYS|West Yellowstone|EUA|US|44.69|-111.12|0.04|1.10|1.10|8400|1|6649
XCH|Flying Fish Cove|Ilha Christmas|CX|-10.45|105.69|0.04|0.80|1.20|6900|1|916
XKH|Xieng Khouang|Laos|LA|19.45|103.16|0.04|0.32|1.10|8555|1|3445
XMS|Macas|Equador|EC|-2.30|-78.12|0.04|0.57|1.05|8202|1|3452
XSC|South Caicos|Ilhas Turcas e Caicos|TC|21.52|-71.53|0.04|0.90|2.10|6335|1|6
XTG|Thargomindah|Australia|AU|-27.99|143.81|0.04|1.20|1.40|4800|1|433
XWA|Williston|EUA|US|48.26|-103.75|0.04|1.10|1.10|7503|1|2344
YAG|Fort Frances|Canada|CA|48.66|-93.44|0.04|1.10|0.95|4500|1|1125
YAK|Yakutat|EUA|US|59.51|-139.66|0.04|1.10|1.10|7732|1|33
YAZ|Tofino|Canada|CA|49.08|-125.78|0.04|1.10|0.95|5000|1|80
YBC|Baie-Comeau|Canada|CA|49.13|-68.20|0.04|1.10|0.95|6000|1|71
YBX|Blanc-Sablon|Canada|CA|51.44|-57.19|0.04|1.10|0.95|4500|1|121
YBY|Bonnyville|Canada|CA|54.30|-110.74|0.04|1.10|0.95|4434|1|1836
YCG|Castlegar|Canada|CA|49.30|-117.63|0.04|1.10|0.95|5300|1|1624
YDA|Dawson City|Canada|CA|64.04|-139.13|0.04|1.10|0.95|5000|1|1215
YDF|Deer Lake|Canada|CA|49.21|-57.40|0.04|1.10|0.95|8005|1|72
YDL|Dease Lake|Canada|CA|58.42|-130.03|0.04|1.10|0.95|6000|1|2600
YDN|Dauphin|Canada|CA|51.10|-100.05|0.04|1.10|0.95|5000|1|999
YEV|Inuvik|Canada|CA|68.30|-133.48|0.04|1.10|0.95|6000|1|224
YFB|Iqaluit|Canada|CA|63.76|-68.56|0.04|1.10|0.95|8605|1|110
YFO|Flin Flon|Canada|CA|54.68|-101.68|0.04|1.10|0.95|5004|1|997
YFS|Fort Simpson|Canada|CA|61.76|-121.24|0.04|1.10|0.95|6000|1|555
YGL|La Grande Riviere|Canada|CA|53.63|-77.70|0.04|1.10|0.95|6500|1|639
YGP|Gaspe|Canada|CA|48.77|-64.48|0.04|1.10|0.95|5488|1|112
YGR|Les Iles-de-la-Madeleine|Canada|CA|47.43|-61.78|0.04|1.10|0.95|4500|1|35
YGV|Havre-Saint-Pierre|Canada|CA|50.28|-63.61|0.04|1.10|0.95|4500|1|124
YHR|Chevery|Canada|CA|50.47|-59.64|0.04|1.10|0.95|4500|1|39
YHY|Hay River|Canada|CA|60.84|-115.78|0.04|1.10|0.95|6000|1|541
YIF|St-Augustin|Canada|CA|51.21|-58.66|0.04|1.10|0.95|4590|1|20
YKL|Schefferville|Canada|CA|54.81|-66.81|0.04|1.10|0.95|5000|1|1709
YLL|Lloydminster|Canada|CA|53.31|-110.07|0.04|1.10|0.95|5577|1|2193
YMS|Yurimaguas|Peru|PE|-5.89|-76.12|0.04|0.52|1.50|5912|1|587
YMT|Chibougamau|Canada|CA|49.77|-74.53|0.04|1.10|0.95|6496|1|1270
YNA|Natashquan|Canada|CA|50.19|-61.79|0.04|1.10|0.95|4494|1|39
YOJ|High Level|Canada|CA|58.62|-117.17|0.04|1.10|0.95|5000|1|1110
YPA|Prince Albert|Canada|CA|53.21|-105.67|0.04|1.10|0.95|5000|1|1405
YPE|Peace River|Canada|CA|56.23|-117.45|0.04|1.10|0.95|5000|1|1873
YPL|Pickle Lake|Canada|CA|51.45|-90.21|0.04|1.10|0.95|4921|1|1267
YPN|Port-Menier|Canada|CA|49.84|-64.29|0.04|1.10|0.95|4886|1|167
YPR|Prince Rupert|Canada|CA|54.29|-130.45|0.04|1.10|0.95|6000|1|116
YPY|Fort Chipewyan|Canada|CA|58.77|-111.12|0.04|1.10|0.95|5000|1|761
YPZ|Burns Lake|Canada|CA|54.38|-125.95|0.04|1.10|0.95|5000|1|2343
YQD|The Pas|Canada|CA|53.97|-101.09|0.04|1.10|0.95|5901|1|887
YQH|Watson Lake|Canada|CA|60.12|-128.82|0.04|1.10|0.95|5504|1|2255
YQK|Kenora|Canada|CA|49.79|-94.36|0.04|1.10|0.95|5800|1|1332
YQX|Gander|Canada|CA|48.94|-54.57|0.04|1.10|0.95|10200|1|496
YQZ|Quesnel|Canada|CA|53.03|-122.51|0.04|1.10|0.95|5500|1|1789
YRJ|Roberval|Canada|CA|48.52|-72.27|0.04|1.10|0.95|5000|1|586
YRL|Red Lake|Canada|CA|51.07|-93.79|0.04|1.10|0.95|5001|1|1265
YRT|Rankin Inlet|Canada|CA|62.81|-92.12|0.04|1.10|0.95|6000|1|94
YSM|Fort Smith|Canada|CA|60.02|-111.96|0.04|1.10|0.95|6000|1|671
YTH|Thompson|Canada|CA|55.80|-97.86|0.04|1.10|0.95|5800|1|729
YTS|Timmins|Canada|CA|48.57|-81.38|0.04|1.10|0.95|6000|1|967
YUY|Rouyn-Noranda|Canada|CA|48.21|-78.84|0.04|1.10|0.95|7485|1|988
YVB|Bonaventure|Canada|CA|48.07|-65.46|0.04|1.10|0.95|5985|1|123
YVC|La Ronge|Canada|CA|55.15|-105.26|0.04|1.10|0.95|5000|1|1242
YVO|Val-d'Or|Canada|CA|48.05|-77.78|0.04|1.10|0.95|10000|1|1107
YVP|Kuujjuaq|Canada|CA|58.10|-68.43|0.04|1.10|0.95|6000|1|129
YVQ|Norman Wells|Canada|CA|65.28|-126.80|0.04|1.10|0.95|5998|1|238
YVV|Wiarton|Canada|CA|44.75|-81.11|0.04|1.10|0.95|5021|1|729
YWK|Wabush|Canada|CA|52.92|-66.86|0.04|1.10|0.95|6002|1|1808
YWL|Williams Lake|Canada|CA|52.18|-122.05|0.04|1.10|0.95|7000|1|3085
YXC|Cranbrook|Canada|CA|49.61|-115.78|0.04|1.10|0.95|6000|1|3082
YXJ|Fort Saint John|Canada|CA|56.24|-120.74|0.04|1.10|0.95|6909|1|2280
YXL|Sioux Lookout|Canada|CA|50.11|-91.91|0.04|1.10|0.95|5300|1|1258
YXT|Terrace|Canada|CA|54.47|-128.58|0.04|1.10|0.95|7497|1|713
YXY|Whitehorse|Canada|CA|60.71|-135.07|0.04|1.10|0.95|9497|1|2317
YYD|Smithers|Canada|CA|54.82|-127.18|0.04|1.10|0.95|5000|1|1712
YYE|Fort Nelson|Canada|CA|58.84|-122.60|0.04|1.10|0.95|6400|1|1253
YYG|Charlottetown|Canada|CA|46.29|-63.13|0.04|1.10|0.95|7002|1|160
YYL|Lynn Lake|Canada|CA|56.86|-101.08|0.04|1.10|0.95|5000|1|1170
YYQ|Churchill|Canada|CA|58.74|-94.07|0.04|1.10|0.95|9200|1|94
YYR|Goose Bay|Canada|CA|53.32|-60.43|0.04|1.10|0.95|11046|1|160
YZF|Yellowknife|Canada|CA|62.46|-114.44|0.04|1.10|0.95|7500|1|675
YZP|Sandspit|Canada|CA|53.25|-131.81|0.04|1.10|0.95|5120|1|21
YZT|Port Hardy|Canada|CA|50.68|-127.37|0.04|1.10|0.95|5000|1|71
YZU|Whitecourt|Canada|CA|54.14|-115.79|0.04|1.10|0.95|5800|1|2567
YZV|Sept-Iles|Canada|CA|50.22|-66.27|0.04|1.10|0.95|6552|1|180
ZBF|South Tetagouche|Canada|CA|47.63|-65.74|0.04|1.10|0.95|5613|1|193
ZDY|Delma Island|Emirados|AE|24.51|52.34|0.04|1.35|1.40|8202|1|30
ZMT|Masset|Canada|CA|54.03|-132.12|0.04|1.10|0.95|5000|1|25
ZNE|Newman|Australia|AU|-23.42|119.80|0.04|1.20|1.40|6798|1|1724
ZTH|Zakynthos|Grecia|GR|37.75|20.88|0.04|0.77|2.10|7310|1|12
ZUM|Churchill Falls|Canada|CA|53.56|-64.11|0.04|1.10|0.95|5500|1|1442
PIN|Parintins|Brasil|BR|-2.67|-56.77|0.12|0.68|0.85|5905|1|82
`.trim()

export type Continente = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA'
export type Escopo = 'dom' | 'reg' | 'int'

export const ESCOPO_LABEL: Record<Escopo, string> = {
  dom: 'Doméstico',
  reg: 'Regional',
  int: 'Internacional',
}

/**
 * Continente de cada país, da tabela `countries.csv` da OurAirports — a mesma
 * fonte da sigla, da coordenada e da pista. Cobre os 231 países da lista.
 *
 * Ela segue a divisão da própria fonte, que tem duas decisões que surpreendem:
 * Turquia entra na Ásia e Rússia na Europa, e América Central e Caribe entram
 * na América do Norte. Ficam como estão — inventar uma divisão própria seria
 * trocar dado por gosto.
 */
const CONTINENTE: Record<string, Continente> = Object.fromEntries(
  `AE:AS AF:AS AG:NA AI:NA AL:EU AM:AS AO:AF AR:SA AS:OC AT:EU AU:OC AW:NA
AZ:AS BA:EU BB:NA BD:AS BE:EU BF:AF BG:EU BH:AS BI:AF BJ:AF BM:NA BN:AS
BO:SA BQ:NA BR:SA BS:NA BT:AS BW:AF BY:EU BZ:NA CA:NA CC:AS CD:AF CF:AF
CG:AF CH:EU CI:AF CK:OC CL:SA CM:AF CN:AS CO:SA CR:NA CU:NA CV:AF CW:NA
CX:AS CY:AS CZ:EU DE:EU DJ:AF DK:EU DM:NA DO:NA DZ:AF EC:SA EE:EU EG:AF
EH:AF ER:AF ES:EU ET:AF FI:EU FJ:OC FK:SA FM:OC FO:EU FR:EU GA:AF GB:EU
GD:NA GE:AS GF:SA GG:EU GH:AF GI:EU GL:NA GM:AF GN:AF GP:NA GQ:AF GR:EU
GT:NA GU:OC GW:AF GY:SA HK:AS HN:NA HR:EU HT:NA HU:EU ID:AS IE:EU IL:AS
IM:EU IN:AS IQ:AS IR:AS IS:EU IT:EU JE:EU JM:NA JO:AS JP:AS KE:AF KG:AS
KH:AS KI:OC KM:AF KN:NA KP:AS KR:AS KW:AS KY:NA KZ:AS LA:AS LB:AS LC:NA
LK:AS LR:AF LS:AF LT:EU LU:EU LV:EU LY:AF MA:AF MD:EU ME:EU MG:AF MH:OC
MK:EU ML:AF MM:AS MN:AS MO:AS MP:OC MQ:NA MR:AF MT:EU MU:AF MV:AS MW:AF
MX:NA MY:AS MZ:AF NA:AF NC:OC NE:AF NF:OC NG:AF NI:NA NL:EU NO:EU NP:AS
NR:OC NU:OC NZ:OC OM:AS PA:NA PE:SA PF:OC PG:OC PH:AS PK:AS PL:EU PM:NA
PR:NA PT:EU PW:OC PY:SA QA:AS RE:AF RO:EU RS:EU RU:EU RW:AF SA:AS SB:OC
SC:AF SD:AF SE:EU SG:AS SH:AF SI:EU SK:EU SL:AF SN:AF SO:AF SR:SA SS:AF
ST:AF SV:NA SX:NA SY:AS SZ:AF TC:NA TD:AF TG:AF TH:AS TJ:AS TL:AS TM:AS
TN:AF TO:OC TR:AS TT:NA TV:OC TW:AS TZ:AF UA:EU UG:AF UM:OC US:NA UY:SA
UZ:AS VC:NA VE:SA VG:NA VI:NA VN:AS VU:OC WF:OC WS:OC XK:EU YE:AS YT:AF
ZA:AF ZM:AF ZW:AF`
    .split(/\s+/)
    .map((p) => p.split(':')),
) as Record<string, Continente>

/**
 * Até onde cada aeroporto recebe voo — doméstico, regional ou internacional.
 *
 * **O que decide na vida real é a alfândega.** Voo internacional só pousa em
 * aeroporto designado ponto de entrada, com posto de fronteira e receita;
 * Congonhas perdeu o dele quando Guarulhos abriu, em 1985, e por isso é
 * doméstico até hoje apesar de ser o segundo aeroporto do país em passageiro.
 * Santos Dumont é doméstico pela mesma razão — e desde 2024 por resolução
 * também: a norma que trocou o raio de 400 km pelo teto de 6,5 milhões de
 * passageiros manteve que ele não opera com aeroporto internacional.
 *
 * O degrau do meio existe por causa do Aeroparque. AEP passou anos aceitando
 * só cabotagem e voo ponto a ponto com país limítrofe mais Peru e Colômbia,
 * com teto de 200 assentos — teto que caiu em agosto de 2024. É o molde do
 * `reg`: doméstico mais internacional do próprio continente.
 *
 * **O escopo é índice de jogo, não cadastro aduaneiro.** Não existe lista
 * pública de posto de fronteira para os 3.086 aeroportos, então ele sai de dois
 * sinais — o degrau do aeroporto e a palavra "internacional" no nome, tanto no
 * oficial curado quanto no da OurAirports — mais as exceções conhecidas abaixo.
 * Onde o jogo erra, erra para o lado de deixar operar.
 *
 * A primeira versão só olhava o nome curado, que existe para 180 aeroportos, e
 * por isso 2.749 saíam domésticos — entre eles Malpensa, Atenas, Viena,
 * Vancouver e o Tocumen. Com o nome da OurAirports, que cobre 3.014, a conta
 * ficou 1.873 domésticos, 972 regionais e 240 internacionais.
 */
const MARCA_INTERNACIONAL =
  /international|internacional|internationale|internationaal|intl\b|国际|国際|международн|uluslararası|nemzetközi|międzynarodow|mezinárodní|διεθν/i

/**
 * Aeroportos cujo nome na OurAirports diz "internacional".
 *
 * A primeira versão do escopo só olhava o nome oficial curado à mão, e esse
 * existe para **180** dos 3.086 aeroportos — o resto caía no rótulo genérico
 * "Cidade (SIGLA)", que nunca carrega a palavra. Resultado: 2.749 aeroportos
 * saíam domésticos, e entre eles Malpensa, Atenas, Viena, Vancouver e o
 * Tocumen do Panamá. Errado, e errado para o lado que **fecha** o jogo.
 *
 * O nome da OurAirports cobre 3.015 dos 3.086 e carrega a marca em 1.132 —
 * mil a mais que a tabela curada. Continua sendo um sinal indireto e não um
 * cadastro aduaneiro: um aeroporto pode ter alfândega sem "internacional" no
 * nome (Heathrow, Zurique, Congonhas até 1985), e é para isso que existem o
 * degrau e a lista à mão abaixo.
 */
const MARCADOS_INTERNACIONAL = new Set(
  `AAC AAN AAP AAY ABA ABB ABD ABE ABJ ABQ ABV ABZ ACA ACC ACY ADB ADD ADE ADJ
ADL ADZ AER AEX AEY AGT AGU AHB AJF AKL AKX ALA ALB ALP AMA AMD AMM AMQ ANC
ANF ANR ANU APW AQI AQJ AQP ARI ART ARW ASB ASF ASM ASR ASU ASW ATH ATL ATQ
ATW ATZ AUA AUH AUS AVP AVV AWA AWZ AXA AYJ AYT AZN AZO AZS BAH BAQ BAV BAX
BAY BBI BBK BBQ BBU BCD BCM BCU BDA BDH BDJ BDL BDO BDQ BEL BEN BEW BEY BFI
BFN BFS BGF BGI BGR BGW BGY BHK BHM BHO BIA BIL BJL BJM BJV BJX BKI BKN BKO
BLA BLB BLI BLR BLZ BME BNA BND BNE BNX BOC BOG BOM BON BOR BOS BPN BPS BQN
BQT BRC BRI BRM BRO BRX BSA BSB BSG BSR BSZ BTC BTH BTJ BTV BUD BUF BUQ BUS
BVB BVC BWA BWI BWN BXY BZE BZN BZV CAI CAN CAP CBB CBQ CCE CCJ CCP CCS CCU
CDG CEB CEI CEK CEN CFK CFU CGB CGK CGO CGP CGQ CGY CHC CHQ CHS CIA CIT CIU
CIX CJB CJJ CJS CJU CKG CKY CLE CLJ CLO CLQ CLT CMB CME CMG CMH CMN CMW CND
CNF CNN CNS CNX COK COO COR COV CPE CPR CPT CRA CRD CRK CRP CRZ CSW CSX CTC
CTG CTM CTU CUC CUF CUL CUN CUR CUU CUZ CVG CVM CWB CWL CXI CXR CYB CYO CZL
CZM CZX DAB DAC DAD DAM DAR DAT DAV DAY DBB DDG DEB DEL DEN DFW DGO DHX DIA
DIL DIR DJE DJJ DJT DKR DLA DLC DLH DLM DMB DME DMK DMM DOH DPS DQM DRP DRW
DSM DSN DSS DSY DUD DUR DVO DWC DXB DXN DYU DZA EBB EBL ECN ECP EDL EHU EIS
ELP ELQ ENO ENU EQS ERI ERL ERZ ESB ESM ETR EUN EVN EWR EXT EYW EZE FAI FAO
FAR FAT FBM FCA FCO FDF FEG FEZ FIH FJR FKI FLL FLN FNA FNC FNJ FNT FOC FOR
FPO FRL FRS FRW FTE FTW FUN FWA GAN GAQ GAU GBB GBE GCM GDL GDT GEG GEM GEO
GES GFK GGT GHV GIG GMO GMP GND GNJ GOH GOI GOJ GOM GOU GOX GPT GRB GRR GRU
GRV GSM GSO GSP GSV GTF GUA GUM GUW GVA GWD GXF GYD GYE GYM GYN GYY GZT HAH
HAK HAN HAQ HAS HAV HBA HBE HDY HEA HER HET HFE HGA HGH HIR HKG HKT HLA HLE
HLP HLZ HMB HMO HND HNL HOF HOG HPH HRB HRE HRG HRI HRL HSA HSG HSN HSR HSS
HSV HTA HUI HUX HWR HYD IAD IAG IAR IAS ICN IFN IGR IGU IKA IKG IKT IKU ILM
ILO ILR ILS IMF INC IND INL INU IPC IQQ IQT ISB ISE ISK ISU ITM ITO IUE IXC
IXE IXZ JAF JAI JAN JAX JBQ JED JFK JGN JHB JHG JIJ JJN JMU JNB JNU JOG JPA
JRO JTR JUB JUJ JUL KAC KAD KAN KBL KBP KBV KCH KDH KDU KEF KEJ KER KGL KGP
KGS KHG KHH KHI KHN KHT KIH KIK KIN KIS KIX KJA KLO KMG KMS KNO KOA KOS KOV
KQT KRK KRR KRT KRW KSA KSC KSN KTI KTM KTN KTT KTW KUF KUL KUN KUT KVA KWE
KWI KWL KZN KZO LAD LAE LAL LAN LAO LAP LAQ LAS LAX LBB LBD LBV LCA LCE LCK
LET LFW LGB LGK LHE LHW LIM LIO LJG LKO LLK LLW LMM LOP LOS LPB LPQ LRD LRM
LRU LSP LTK LTO LTX LUM LUN LUX LVI LWN LXA LXR LYP MAA MAF MAJ MAK MAM MAO
MAR MBA MBD MBJ MBS MCI MCO MCP MCT MCX MCZ MDC MDE MDG MDL MDQ MDT MDW MDZ
MEC MEM MEX MFE MFM MFR MFU MGA MGQ MHD MHH MIA MID MIR MIU MJI MJT MKE MKQ
MKZ MLA MLB MLE MLI MLM MME MNC MNL MOT MQF MQP MRA MRU MSP MSS MSU MSY MSZ
MTT MTY MUB MUH MUN MUX MVB MVD MWX MWZ MXL MXP MXZ MYP MYR MZO MZR MZT NAG
NAJ NAN NAP NAS NAT NBE NBJ NBO NCU NDB NDJ NDR NGB NGO NIM NJF NKC NKG NLA
NLD NLK NLU NMA NMF NMI NNG NOS NOU NQN NQZ NRT NSI NSK NTG NVI NVT NYT NZG
OAX OCJ OCS OGG OGS OGZ OHS OKA OMO OMR ONT ORD ORF ORK ORN ORU OSL OSS OST
OTP OUA OXB OZZ PAC PAE PAP PBC PBG PBH PBM PCL PDG PDP PDS PDV PDX PEE PEG
PEI PEK PEM PEN PER PET PEV PEW PFO PGU PHB PHC PHE PHF PHH PHL PHX PIA PIE
PIT PIU PKU PKV PKX PKZ PLQ PLS PLX PLZ PMC PMV PNH PNI PNK PNQ PNR PNS POA
POG POM POP POS PPE PPG PPK PPS PPT PQC PQI PRN PSA PSD PSE PSP PTG PTP PTY
PUJ PUQ PUS PVD PVG PVH PVR PWM PWQ PXM PYK PZO PZU QOW RAI RAR RBR RDU REC
RES REX RFD RGA RGL RGN RHD RHO RIC RIH RIX RIY RKT RMF RMI RML RMO RMQ RMU
RNO ROB ROC ROP ROR ROS RSD RSI RST RSW RTB RUH SAH SAI SAL SAN SAP SAT SAV
SAW SBD SBN SBT SBZ SCL SCO SCU SCV SDD SDF SDQ SEA SEZ SFA SFB SFJ SFO SFS
SGC SGN SHA SHE SHJ SHO SID SJC SJD SJJ SJO SJU SJW SKB SKD SKG SKO SKP SKT
SKX SKZ SLA SLC SLL SLP SLW SLZ SMF SMR SNA SNC SNU SOC SON SPN SPX SRE SRQ
SRY SSA SSG SSH STD STI STL STM STV SUB SUF SUI SUJ SUV SVD SVO SVZ SWF SXM
SXR SYD SYQ SYR SYX SYZ SZB SZX TAB TAE TAG TAI TAM TAO TAP TAS TAZ TBJ TBP
TBS TBT TBU TBZ TCP TCQ TFU TGM TGZ THR TIA TIF TIJ TIQ TIR TJM TJQ TJU TKG
TKK TLC TLH TLV TML TNA TNJ TNN TNR TOE TPA TPE TQO TRC TRK TRU TRV TRW TRZ
TSA TSN TSR TUA TUC TUK TUL TUN TUS TUU TVT TYL TYN TZL TZX UAI UBN UET UFA
UGC UIO UKK ULH UPG UPN URA URC USH USM UTH UTP UUD UUS UVF UYU VAM VAV VCA
VCP VDO VER VFA VGA VIE VIX VKO VLI VLN VNO VNS VOG VOZ VRA VSA VTE VVI VVO
VXE WDH WLG WNZ WUH WUX WVB WWK XBJ XCH XIY XMN XNN XPL XUZ XWA YAP YCU YEG
YFC YHM YHZ YIA YKF YKS YLW YMM YMX YNB YNT YNY YNZ YOW YQB YQG YQM YQQ YQR
YQT YQX YUL YUM YVR YWG YXC YXE YXS YXU YXX YXY YYC YYJ YYT YYZ YZF ZAG ZAH
ZAM ZBR ZCL ZCO ZIA ZIH ZLO ZNZ ZSA ZTH ZYL`.split(/\s+/),
)

/**
 * Onde a derivação erra e a verdade é conhecida. Cada linha tem uma razão:
 * ou o aeroporto perdeu a alfândega, ou nunca teve, ou tem uma limitada.
 */
const ESCOPO_A_MAO: Record<string, Escopo> = {
  // Perderam o internacional para o aeroporto novo da mesma cidade.
  CGH: 'dom', // Congonhas: o internacional foi para Guarulhos em 1985
  SDU: 'dom', // Santos Dumont: doméstico, e a resolução de 2024 confirma
  // Aeroparque: cabotagem mais país limítrofe, Peru e Colômbia.
  AEP: 'reg',
  // Aeroporto de cidade, pista curta e alfândega só para o curto curso.
  LCY: 'reg', // London City
  TSA: 'reg', // Taipei Songshan: Tóquio, Seul e Xangai, e nada além
  HND: 'int', // Haneda voltou ao longo curso em 2010
  /*
   * Cabo Frio: internacional de verdade, e o dado público não sabia.
   *
   * Ele saía doméstico porque o escopo se apoia na palavra "internacional" no
   * nome, e o nome que a OurAirports traz é "Cabo Frio Airport" — sem ela. O
   * aeroporto é o Internacional de Cabo Frio, tem alfândega, recebeu linha da
   * Aerolíneas Argentinas de Buenos Aires e fretamento internacional de
   * temporada, e a pista de 2.550 m já recebeu 747. Dois sinais que não
   * enxergam o terceiro é o caso clássico de exceção à mão.
   */
  CFB: 'int',
  // Fronteira seca: internacional de verdade, mas só com o vizinho.
  IGU: 'reg', // Foz do Iguaçu
  TBT: 'reg', // Tabatinga, na tríplice fronteira com Colômbia e Peru
  URG: 'reg', // Uruguaiana, colado na Argentina
}

const escopoDe = (iata: string, tier: number, official: string): Escopo => {
  const mao = ESCOPO_A_MAO[iata]
  if (mao) return mao
  const marca = MARCADOS_INTERNACIONAL.has(iata) || MARCA_INTERNACIONAL.test(official)
  if (tier >= 4 || (marca && tier >= 3)) return 'int'
  if (marca || tier === 3) return 'reg'
  return 'dom'
}

/**
 * Fuso de cada aeroporto, em minutos de diferença para o UTC.
 *
 * Era `Math.round(lon / 15) * 60` — hora solar. Funciona onde o fuso segue o
 * sol e erra onde ele segue decreto, que é o caso de metade do mundo: a China
 * inteira no horário de Pequim, a Espanha no de Berlim, a Índia com meia hora
 * de deslocamento, o Nepal com quarenta e cinco minutos. **1.249 dos 3.086
 * aeroportos mudaram de fuso** quando isto entrou.
 *
 * Sai da zona IANA de cada coordenada, que é a base que sistema operacional,
 * navegador e banco de dados usam para data local. O deslocamento gravado aqui
 * continua sendo **fixo**, porque o jogo não modela a virada de horário de
 * verão, mas agora ele sai do fuso padrão certo de cada aeroporto — não de um
 * nome de cidade ambíguo nem de janeiro no hemisfério sul.
 *
 * Norte usa janeiro; sul usa julho. Onde os dois lados da fronteira divergem,
 * vale o que a aviação publica: na China inteira o jogo fica em UTC+8, inclusive
 * Ürümqi e Kashgar, porque grade aérea chinesa não troca para o horário local de
 * Xinjiang.
 */
const FUSO: Record<string, number> = Object.fromEntries(
  `-660=IUE,PPG
-600=AAA,ADK,AIT,AKB,BOB,FAV,HNL,HOI,HUH,ITO,KOA,LIH,LNY,MKK,MKP,MUE,OGG,PPT,RAR,RFP
-600=RGI,RUR,RVV,TUB
-570=NHV
-540=ADQ,AKN,ANC,ANI,BET,BRW,CDB,CDV,DLG,DUT,ENA,FAI,GAL,GAM,GKN,GMR,GST,HOM,ILI,JNU
-540=KLW,KQA,KTN,MCG,OME,OTZ,PSG,SCC,SHH,SIT,SNP,UNK,VDZ,WRG,YAK
-480=ACV,ALW,BFI,BFL,BIH,BLD,BLI,BUR,CCR,CEC,CLD,EAT,EKO,EUG,FAT,GEG,GUB,HHR,IPL,LAS
-480=LAX,LGB,LWS,MCE,MFR,MMH,MRY,MXL,OAK,OLM,ONT,OTH,PAE,PDT,PDX,PSC,PSP,PUW,RDD,RDM
-480=RNO,SAN,SBA,SBD,SBP,SCK,SEA,SFO,SJC,SLE,SMF,SMX,SNA,STS,TIJ,TIW,TKF,YAZ,YBL,YCD
-480=YCG,YDL,YKA,YKM,YLW,YPR,YPZ,YQQ,YQZ,YVR,YWL,YXS,YXT,YXX,YYD,YYF,YYJ,YZP,YZT,ZMT
-420=ABQ,AIA,ALS,ASE,AZA,BFF,BIL,BJC,BOI,BTM,BZN,CDC,CDR,CEN,CEZ,CJS,CNM,CNY,COD,COS
-420=CPR,CSW,CUL,CVN,CYS,DEN,DIK,DRO,EGE,ELP,FCA,FLG,GCC,GCN,GDV,GGW,GJT,GTF,GUC,GUP
-420=GYM,HDN,HII,HLN,HMO,HOB,HVR,IDA,JAC,LAP,LAR,LMM,LRU,LTO,MSO,MTJ,MYL,MZT,OGD,OLF
-420=PGA,PHX,PIH,PPE,PRC,PUB,PVU,RAP,RIW,RKS,ROW,SAF,SDY,SGU,SHR,SJD,SLC,SMN,SOW,SUN
-420=SVC,TEX,TPQ,TSM,TUS,TWF,VEL,WYS,YBY,YDA,YEG,YEV,YFS,YHY,YLL,YMM,YOJ,YPE,YPY,YQH
-420=YQL,YQU,YSM,YUM,YVQ,YXC,YXH,YXJ,YXY,YYC,YYE,YZF,YZU
-360=AAZ,ABI,ABR,ACA,ACT,AEX,AGU,ALO,AMA,ATW,ATY,AUS,BEF,BHM,BIS,BJX,BKG,BLV,BMI,BNA
-360=BPT,BRD,BRL,BRO,BTR,BZE,CGI,CLL,CLQ,CME,CMI,COU,CPE,CRP,CUU,CVM,CWA,DAL,DBQ,DDC
-360=DEC,DFW,DGO,DHN,DLH,DSI,DSM,DVL,EAR,EAU,ECP,ELD,EVV,FAR,FOD,FRS,FSD,FSM,FTW,GCK
-360=GDL,GFK,GGG,GLF,GLH,GPS,GPT,GRB,GRI,GRK,GTR,GUA,GYY,HIB,HOT,HOU,HRL,HRO,HSV,HUX
-360=HYS,IAH,IBB,ICT,ILS,IMT,INL,IPC,IRK,IWD,IZT,JAN,JBR,JLN,JMS,LAW,LBB,LBF,LBL,LCE
-360=LCH,LFT,LIO,LIR,LIT,LNK,LRD,LSE,MAF,MAM,MCI,MCK,MCW,MDW,MEI,MEM,MEX,MFE,MGA,MGM
-360=MHK,MID,MKE,MKL,MLI,MLM,MLU,MOB,MOT,MSL,MSN,MSP,MSY,MTT,MTY,MWA,MWL,NLD,NLU,OAX
-360=OKC,OMA,ORD,OWB,PAH,PAZ,PBC,PBR,PDS,PIA,PIB,PIR,PNS,PUZ,PVR,PXM,QRO,RER,REX,RFD
-360=RHI,RNI,RST,RTB,SAL,SAP,SAT,SCY,SGF,SHV,SJO,SJT,SLN,SLP,SLW,SPI,SPS,STC,STL,SUX
-360=SWO,SYQ,TAM,TAP,TBN,TGU,TGZ,TLC,TRC,TUL,TUP,TVF,TXK,TYR,UIN,UPN,VCT,VER,VPS,VSA
-360=XNA,XPL,XWA,YAG,YBR,YDN,YFO,YPA,YQD,YQK,YQR,YRL,YRT,YTH,YVC,YWG,YXE,YXL,YYL,YYQ
-360=ZCL,ZIH,ZLO
-300=ABE,ABY,ACK,ACY,ADZ,AGS,ALB,ANS,AOO,APN,APO,AQP,ART,ATC,ATL,AUC,AUG,AVL,AVP,AXM
-300=AXP,AYP,AZO,BAQ,BCA,BDL,BED,BFD,BGA,BGM,BGR,BHB,BIM,BKW,BLB,BOC,BOG,BOS,BQK,BTV
-300=BUF,BWI,BYM,CAE,CAK,CAP,CCC,CCZ,CFG,CHA,CHH,CHM,CHO,CHS,CIU,CIX,CJA,CKB,CLE,CLO
-300=CLT,CMH,CMW,CMX,CRW,CSG,CTD,CTG,CTM,CUC,CUE,CUN,CUZ,CVG,CYB,CYO,CZM,CZS,CZU,DAB
-300=DAV,DAY,DCA,DJT,DOV,DTW,DUJ,EJA,ELH,ELM,EOH,ERI,ESC,ESM,ETR,EWB,EWN,EWR,EYP,EYW
-300=FAY,FLA,FLL,FLO,FNT,FPO,FWA,GCM,GDT,GER,GGT,GHB,GNV,GRR,GSO,GSP,GYE,HAV,HGR,HHH
-300=HOG,HPN,HTS,HUU,HVN,HYA,IAD,IAG,IBE,IGA,ILG,ILM,ILQ,IND,IPI,IPT,IQT,ISP,ITH,JAE
-300=JAU,JAX,JFK,JST,JUL,KIN,LAF,LAL,LAN,LBE,LCK,LEB,LET,LEX,LGA,LIM,LNS,LOH,LTX,LUK
-300=LWB,LYH,MBJ,MBL,MBS,MCN,MCO,MDE,MDT,MEC,MGW,MHH,MHT,MIA,MKG,MLB,MQT,MSS,MTR,MVP
-300=MVY,MYG,MYR,MZL,MZO,NAS,NVA,OAJ,OCC,OCJ,OGS,ONX,OPF,ORF,ORH,PAC,PAP,PBG,PCL,PCR
-300=PDA,PDK,PEI,PEM,PGD,PGV,PHF,PHL,PIE,PIT,PIU,PKB,PLN,PLS,PPN,PQI,PSM,PSO,PTY,PUU
-300=PVD,PWM,RBR,RCH,RDU,RIC,RIH,RKD,ROA,ROC,RSD,RSW,RUT,SAQ,SAV,SBN,SBY,SCE,SCU,SDF
-300=SFB,SHD,SJE,SLK,SMR,SNC,SNU,SRQ,SVI,SWF,SYR,TBI,TBP,TBT,TCB,TCO,TCQ,TEB,TLH,TLU
-300=TME,TND,TOL,TPA,TPP,TQO,TRI,TRU,TTN,TUA,TVC,TYL,TYS,TZN,UIB,UIO,USA,UST,VLD,VRA
-300=VRB,VTU,VUP,VVC,XMS,XSC,YAM,YBC,YBG,YCM,YFB,YGL,YGP,YGV,YHM,YHU,YKF,YKL,YLK,YMS
-300=YMT,YMX,YND,YOW,YPL,YPN,YPQ,YQA,YQB,YQG,YQT,YRJ,YSB,YTS,YUL,YUY,YVB,YVO,YVP,YVV
-300=YXU,YYB,YYY,YYZ,YZV,ZSA
-240=AFL,ANF,ANU,ARI,AUA,AXA,AZS,BBQ,BDA,BGI,BLA,BNS,BON,BQN,BRM,BRX,BVB,BVH,BYO,CAF
-240=CAJ,CBB,CCA,CCP,CCS,CGB,CGR,CIJ,CIW,CJC,CMG,CPO,CUM,CUP,CUR,CZE,DOM,EIS,ESR,FDF
-240=GEO,GND,GYA,IQQ,JBQ,JPR,LPB,LRM,LSC,LSP,LTM,MAO,MAR,MAZ,MHC,MUN,NRR,OAL,OPS,ORU
-240=PMC,PMG,PMV,PIN,POP,POS,PSE,PSZ,PTP,PUJ,PVH,PZO,RBQ,ROO,SCL,SDQ,SIG,SJL,SJU,SKB,SLU
-240=SMT,SNV,SOM,SRE,SRZ,STD,STI,STT,STX,SVD,SVZ,SXM,TAB,TDD,TFF,TGQ,TJA,TJL,UVF,UYU
-240=VIG,VLN,VLV,VVI,YBX,YFC,YGR,YHR,YHZ,YIF,YNA,YQM,YQY,YSJ,YWK,YYG,YYR,ZAL,ZBF,ZCO
-240=ZOS,ZPC,ZUM
-210=YDF,YQX,YYT
-180=AAX,AEP,AFA,AGT,AJU,AQA,ARU,ASU,ATM,AUX,BBA,BEL,BHI,BPS,BRA,BRC,BSB,BVS,CAC,CAU
-180=CAW,CAY,CFB,CGH,CJZ,CKS,CLV,CNF,CNQ,COR,CPC,CPV,CRD,CTC,CWB,CXJ,ENO,EQS,EZE,FLN
-180=FMA,FOR,FSP,FTE,GEL,GIG,GRU,GVR,GYN,IGR,IGU,IMP,IOS,IPN,IRJ,ITB,IZA,JDF,JDO,JJD
-180=JJG,JOI,JPA,JTC,JUJ,LAJ,LDB,LEC,LHS,LUQ,MAB,MCP,MCZ,MDQ,MDZ,MEA,MGF,MII,MOC,MPN
-180=MVD,MVF,NAT,NEC,NQN,NVT,OES,OPP,PAV,PBM,PDP,PET,PFB,PGZ,PHB,PLU,PMQ,PMW,PMY,PNT
-180=PNZ,POA,PPB,PRA,PSS,PTO,PUD,PUQ,PYT,RAO,REC,REL,RES,RGA,RGL,RHD,RIA,ROS,RSA,RYO
-180=SDE,SDU,SET,SFN,SJK,SJP,SLA,SLZ,SOD,SSA,SST,STM,THE,TMT,TOW,TUC,TUR,UAQ,UBA,UDI
-180=UMU,UNA,URG,USH,VAL,VCP,VDC,VDM,VIX,XAP
-120=FEN,GOH,JJU,SFJ
-60=BVC,FLW,GRW,HOR,PDL,PIX,RAI,SID,SJZ,SMA,SNE,TER,VXE
0=ABJ,ABZ,ACC,ACE,AEY,ASI,BEB,BFS,BGC,BHD,BHX,BJL,BKO,BOH,BOY,BRS,BYK,CAL,CAT,CFN
0=CKY,CSK,CWL,DKR,DND,DSS,DUB,EDI,EGS,EMA,EXT,FAE,FAO,FNA,FNC,FUE,GAQ,GCI,GLA,GMZ
0=HFN,HGO,HLE,HUY,IFJ,ILY,INV,IOM,JER,KEF,KIR,KMS,KOI,KYS,LBA,LCY,LDY,LFW,LGW,LHR
0=LIS,LPA,LPL,LSI,LTN,LWK,MAN,MLW,MME,MZI,NCL,NDB,NKC,NOC,NQY,NWI,NYI,OPO,ORK,OUA
0=OUZ,OXB,PIK,PXO,RKV,ROB,SEN,SNN,SOU,SPC,SPY,STN,SYY,TFN,TFS,TKD,TML,TMS,TOM,TRE
0=WIC,ZIG
60=AAE,AAL,AAR,ABB,ABV,ACH,AES,AGA,AGH,AGP,AHO,AHU,AJA,AJR,AKR,ALC,ALF,ALG,AMS,ANR
60=ANX,AOI,ARN,AUR,AVN,AZR,BCN,BCU,BDS,BDT,BDU,BEG,BEM,BER,BES,BGF,BGO,BGY,BIA,BIO
60=BIQ,BJA,BJZ,BLE,BLJ,BLL,BLQ,BMA,BMW,BNI,BNX,BOD,BOO,BRE,BRI,BRN,BRQ,BRU,BSG,BSK
60=BSL,BTS,BUD,BVA,BVE,BWK,BZG,BZO,BZR,BZV,CAB,CAG,CBH,CBQ,CBT,CCF,CDG,CDT,CFE,CFK
60=CFR,CGN,CIA,CIY,CLY,CMF,CMN,COO,CPH,CRL,CRV,CTA,CUF,CZL,DBV,DCM,DEB,DJE,DJG,DKA
60=DLA,DLE,DOL,DRS,DTM,DUE,DUS,EAS,EBH,EBJ,EGC,EIN,ELG,ELU,ENU,ERF,ERH,ESU,ETZ,EUN
60=EVE,EVG,FCN,FCO,FDH,FDU,FEZ,FIH,FKB,FLR,FMM,FMO,FNI,FOG,FRA,FRL,FSC,GAX,GDN,GEM
60=GEV,GHA,GIB,GJL,GMA,GMO,GNB,GOA,GOT,GOU,GRO,GRQ,GRX,GRZ,GVA,GWT,GXG,HAD,HAJ,HAM
60=HAU,HDF,HFS,HHN,HME,HMV,IAM,IBA,IBZ,IEG,ILR,INI,INN,INZ,JCL,JKG,JOS,KAD,KAN,KKN
60=KKW,KLR,KLU,KLV,KRF,KRK,KRN,KRP,KRS,KSC,KSD,KSF,KSU,KTW,KVO,LAD,LBC,LBV,LCG,LCJ
60=LDE,LEI,LEJ,LEN,LGG,LIG,LIL,LIN,LJU,LKL,LLA,LMP,LNZ,LOO,LOS,LPI,LPY,LRH,LUG,LUX
60=LUZ,LYC,LYR,LYS,MAD,MAH,MBX,MDI,MDK,MEG,MIR,MIU,MKU,MLA,MLN,MMX,MOL,MPL,MRS,MST
60=MSZ,MUC,MVB,MVR,MXP,MXX,MZW,NAP,NBE,NBJ,NBN,NCE,NCY,NDJ,NDR,NGE,NIM,NOV,NRK,NRN
60=NSI,NTE,NUE,NYO,OCS,ODB,ODE,OER,OGX,OHD,OLA,OLB,OMO,ORB,ORN,ORY,OSD,OSI,OSL,OSR
60=OST,OUD,OVD,OYE,OZZ,PAD,PED,PEG,PEV,PGF,PHC,PHG,PIS,PJA,PMF,PMI,PMO,PNA,PNL,PNR
60=POG,POZ,PRG,PRN,PSA,PSR,PUF,PUY,QOW,QRW,QSF,QSR,RAK,RBA,RDO,RDZ,REG,REU,RJK,RJL
60=RKE,RLG,RMI,RMU,RNB,RNN,RNS,RRS,RTM,RZE,SCN,SCQ,SCR,SDD,SDL,SDR,SFA,SFT,SGD,SJJ
60=SKO,SKP,SLD,SLM,SMW,SOB,SPP,SPU,SSG,SSJ,SSY,STR,SUF,SVG,SVQ,SXB,SZA,SZG,SZY,SZZ
60=TAT,TBJ,TEE,TGD,TGR,THN,TIA,TIN,TIV,TLM,TLN,TLS,TMR,TMX,TNG,TOE,TOS,TPS,TRD,TRF
60=TRN,TRS,TSF,TTA,TTU,TUF,TUN,TYF,TZL,UAR,UME,VBS,VBY,VCE,VGO,VHM,VIE,VIL,VIT,VLC
60=VLL,VPE,VRN,VST,VVZ,VXO,WAW,WMI,WRO,XCR,XRY,YOL,ZAD,ZAG,ZAZ,ZND,ZRH
120=AAC,ABS,AKF,AOK,APL,ARW,ASW,ATH,ATZ,AXD,BAY,BBK,BBU,BCM,BEN,BEW,BEY,BFN,BJM,BLZ
120=BOJ,BUQ,BUX,CAI,CCE,CFU,CHQ,CLJ,CND,CPT,CRA,DBB,DOG,DUR,EBD,ECN,EFL,ELF,ELS,ENF
120=EPU,ERS,FBM,FKI,FMI,FRW,GBE,GHV,GOM,GPA,GRJ,HBE,HDS,HEL,HER,HLA,HMB,HRE,HRG,IAS
120=INH,IOA,IRP,IVL,JIK,JKH,JMK,JNB,JOE,JSH,JSI,JTR,JUB,JYV,KAB,KAJ,KAO,KBP,KDL,KEM
120=KGA,KGD,KGL,KGS,KIM,KIT,KLX,KME,KND,KOK,KRT,KSL,KSO,KTT,KUN,KUO,KVA,KWZ,KZI,LAQ
120=LCA,LLW,LPP,LTD,LUD,LUN,LVI,LXR,LXS,MAK,MBD,MFU,MGH,MHQ,MJI,MJM,MJT,MNC,MPA,MPM
120=MQP,MRA,MSU,MUB,MUH,MZQ,NDU,NLA,OMD,OMR,OND,OTP,OUL,PAS,PDV,PFO,PHW,PLQ,PLZ,POL
120=POR,PSD,PTG,PVK,PZB,PZU,RHO,RIX,RMF,RMO,RVN,SBZ,SCV,SEB,SHO,SIS,SKG,SKU,SLI,SMI
120=SOF,SPX,SSH,SUJ,SVL,SWX,SZK,TAY,TCP,TET,TGM,TKU,TLL,TLV,TMP,TSR,UEL,URE,UTN,UTT
120=UYL,VAA,VAR,VFA,VJB,VNO,VNX,VOL,VPY,VXC,WDH,WUU,WVB,ZTH
180=AAY,ABK,ABT,ADB,ADD,ADE,ADF,ADJ,AER,AHB,AJF,AJI,AJN,ALP,AMH,AMM,AOE,AQI,AQJ,ARH
180=ARK,ASM,ASO,ASR,AWA,AXU,AYT,BAH,BAL,BBO,BCO,BGG,BGW,BHH,BJR,BJV,BKZ,BQT,BSA,BSR
180=BZI,CEE,CKZ,COV,CSH,CSY,DAM,DAR,DEM,DIA,DIE,DIR,DIY,DLM,DME,DMM,DNZ,DOD,DOH,DWD
180=DZA,EAM,EBB,EBL,EDL,EDO,EJH,ELQ,ERC,ERZ,ESB,ESL,EZS,FTU,GDE,GDQ,GDZ,GGR,GIZ,GLK
180=GMB,GME,GNY,GOJ,GRV,GXF,GZP,GZT,HAH,HAS,HGA,HOF,HTY,IAR,IGD,IGT,ISE,IST,ISU,IWA
180=JED,JIB,JIJ,JIM,JRO,KAC,KCM,KFS,KIK,KIS,KMC,KMW,KRR,KSY,KSZ,KVK,KVX,KWI,KYA,KZN
180=KZR,LAU,LDG,LED,LTK,MBA,MBI,MCX,MED,MFA,MGQ,MJN,MLX,MMK,MNJ,MOQ,MQM,MQX,MRV,MSQ
180=MSR,MVQ,MWZ,MYW,MZH,NAL,NAV,NBC,NBO,NJF,NKT,NNM,NOP,NOS,NUM,OGU,OGZ,ONQ,PES,PEX
180=PEZ,PKV,RAE,RAH,RIY,RSI,RUH,RZV,SAH,SAW,SCT,SCW,SHW,SKX,SRT,STW,SVB,SVO,SZE,SZF
180=TAI,TBO,TEQ,TIF,TJK,TLE,TMM,TNR,TUI,TUU,TZX,UCT,ULH,ULU,URY,USK,UUA,VAN,VAS,VKO
180=VKT,VOG,VOZ,VUS,WAE,WIL,WJR,YEI,YKO,YNB,ZIA,ZNZ
210=ABD,ADU,AEU,AFZ,AWZ,AZD,BDH,BJB,BND,BUZ,BXR,DEF,GCH,GSM,HDM,IFN,IKA,KER,KHD,KHK
210=KIH,KKS,KSH,LFM,LRR,MHD,MRX,NSH,OMH,PFQ,PGU,PYK,RAS,RJN,RZR,SDG,SNX,SRY,SYZ,TBZ
210=THR,XBJ,ZAH,ZBR
240=AAN,ASF,AUH,BUS,BWO,DQM,DWC,DXB,EVN,FJR,GBB,GNJ,GSV,GYD,IJK,KHS,KUF,KUT,LLK,LWN
240=MCT,MRU,NAJ,OHS,RKT,RUN,SEZ,SHJ,SLL,SUI,TBS,ULV,ULY,ZDY,ZSE
270=HEA,KBL,KDH,KHT,MZR
300=AKX,ALA,ASB,AZN,BHK,BHV,BKN,BVJ,BXH,BXY,CEK,CIT,CJL,CRZ,DEA,DMB,DYU,DZN,EYK,FEG
300=GAN,GIL,GUW,GWD,HAQ,HDD,HMA,HSA,ISB,KDU,KGF,KGP,KHI,KOV,KQT,KRO,KRW,KSN,KSQ,KZO
300=LBD,LHE,LYP,MLE,MQF,MUX,MYP,NCU,NJC,NMA,NMF,NOJ,NQZ,NUX,NVI,NYA,NYM,OSW,OVS,PEE
300=PEW,PLX,PPK,PWQ,PZH,REN,RMZ,RYK,SBT,SCO,SGC,SKD,SKT,SKZ,SLY,SVX,SZI,TAS,TAZ,TDK
300=TJM,TJU,TMJ,TUK,TVT,UET,UFA,UGC,UKK,URA,URJ,USJ,VAM,WNS
330=AGR,AHA,AIP,AJL,AMD,ATQ,AVR,AYJ,BBI,BDQ,BEK,BHJ,BHO,BHU,BLR,BOM,BTC,CCJ,CCU,CDP
330=CJB,CMB,CNN,COK,DBR,DED,DEL,DHM,DIB,DIU,DMU,DXN,GAU,GAY,GBI,GDB,GOI,GOP,GOX,GWL
330=HBX,HDO,HGI,HJR,HRI,HSR,HSS,HWR,HYD,IMF,ISK,IXA,IXB,IXC,IXD,IXE,IXG,IXI,IXJ,IXK
330=IXL,IXM,IXP,IXR,IXS,IXU,IXY,IXZ,JAF,JAI,JDH,JGA,JLG,JLR,JRG,JRH,JSA,KJB,KLH,KNU
330=KQH,LKO,LTU,MAA,MYQ,NAG,NDC,NMI,PAB,PAT,PBD,PGH,PNQ,PNY,RDP,REW,RJA,RML,RPR,SDW
330=SHL,STV,SXR,TCR,TEZ,TIR,TRR,TRV,TRZ,UDR,VGA,VNS,VSV
345=BIR,BWA,KEP,KTM,PHH,PKR
360=BSZ,BZL,CGP,CXB,DAC,IKG,IKU,JSR,OMS,OSS,PBH,RJH,SPD,ZYL
390=AKY,BMO,BSX,CCK,HEH,KAW,KET,KYP,LIW,LSH,MDL,MGZ,MNU,MOG,MWQ,MYT,NYT,NYU,PBU,RGN
390=SNW,THL,TVY
420=ABA,BAX,BBM,BDO,BFV,BKK,BKS,BMV,BOR,BTH,BTJ,BUU,BWX,CAH,CEI,CGK,CJM,CJN,CNX,CXP
420=CXR,DAD,DHX,DIN,DJB,DLI,DMK,DSY,DTB,DUM,EIE,FLZ,GNS,GOY,HAN,HDY,HGN,HHQ,HKT,HLP
420=HPH,HTG,HUI,HVD,IAA,JBB,JOG,KBV,KCY,KEJ,KJA,KKC,KNO,KOP,KOS,KRC,KTG,KTI,KYZ,LOE
420=LPQ,LPT,LSR,LSW,LXG,MAQ,MLG,NAW,NNT,NOZ,NSK,NST,NTX,OVB,PDG,PGK,PHS,PHY,PKN,PKU
420=PKY,PKZ,PLM,PNH,PNK,PQC,PXR,PXU,RKI,ROI,SAI,SGN,SMQ,SNO,SOC,SRG,SUB,TBB,TDX,THD
420=THS,THX,TJQ,TKG,TNJ,TOF,TST,UBP,UIH,ULO,UNN,URT,USM,UTH,UTP,VAQ,VCA,VCL,VCS,VDH
420=VDO,VEO,VII,VKG,VTE,XCH,XKH,YIA
480=AAP,AAT,ACF,AEB,AKA,AKU,ALH,AOR,AQG,ARD,AXF,BAR,BAV,BCD,BDJ,BEJ,BFJ,BFY,BHY,BKI
480=BME,BMU,BPE,BPN,BPX,BQB,BTK,BTU,BTW,BWN,BXU,BYN,BZX,CAN,CBO,CEB,CGO,CGQ,CGY,CIH
480=CKG,CKW,COQ,CQW,CRK,CRM,CSX,CTU,CVQ,CWJ,CYI,CYP,CYZ,CZX,DAT,DCY,DDG,DDR,DGT,DIG
480=DLC,DLU,DLZ,DNH,DOY,DPL,DPS,DQA,DRP,DSN,DVO,DXJ,EHU,ENE,ENH,EPR,ERL,FOC,FUG,GES
480=GET,GMQ,GOQ,GTO,GYZ,HAK,HCJ,HEK,HET,HFE,HGH,HIA,HKG,HLD,HMI,HRB,HSN,HTN,HUN,IKT
480=ILO,INC,IPH,JDZ,JGD,JGN,JGS,JHB,JHG,JIC,JIU,JJN,JMU,JNG,JSJ,JUH,JXA,JZH,KAX,KBR
480=KBU,KCA,KCH,KDI,KGI,KGT,KHG,KHH,KHN,KJI,KLO,KMG,KNH,KNX,KOE,KQR,KTA,KUA,KUL,KWE
480=KWL,KXB,LAO,LBJ,LBU,LDU,LEA,LER,LFQ,LGK,LHW,LJG,LKM,LLB,LLO,LMN,LNL,LNO,LOP,LUM
480=LVO,LXA,LYA,LYI,LZG,LZN,MDC,MDG,MFM,MJK,MKM,MKR,MKZ,MNL,MOF,MOH,MPH,MXV,MXZ,MYY
480=MZG,MZV,NDG,NGB,NGQ,NKG,NLH,NLT,NNG,NTG,NZG,NZH,OHE,OJU,OZC,PAG,PBO,PEK,PEN,PER
480=PHE,PKX,PLW,PPS,PVG,PZI,RKZ,RLK,RMQ,RTI,RXS,SBW,SDK,SFS,SHA,SHE,SHS,SIN,SJI,SJW
480=SQD,SUG,SWA,SWL,SWQ,SYX,SZB,SZH,SZX,TAC,TAG,TAO,TBH,TEN,TFU,TGG,TGO,TJG,TLI,TMC
480=TNA,TNN,TPE,TRK,TRT,TSA,TSN,TTT,TUG,TVS,TWC,TWT,TWU,TXN,TYN,UBN,UCB,UKX,UPG,URC
480=UUD,UYN,VRC,WEF,WEH,WGP,WNI,WNP,WNZ,WUA,WUH,WUN,WUX,WUZ,XAI,XFN,XIC,XIL,XIY,XMN
480=XNN,XSP,XUZ,YCU,YIH,YIW,YLX,YNJ,YNT,YNZ,YTY,YUS,ZAM,ZHY,ZNE,ZQZ,ZUH
540=AKJ,AMQ,AOJ,ASJ,AXT,BCH,BIK,BQS,CJJ,CJU,CTS,DEX,DIL,DJJ,DSO,FKS,FNJ,FSZ,FUJ,FUK
540=GAJ,GMP,HAC,HIJ,HIN,HKD,HNA,HND,HSG,HTA,IBR,ICN,IKS,ISG,ITM,IWJ,IWK,IZO,KCZ,KIJ
540=KIX,KKJ,KMI,KMJ,KMQ,KNG,KOJ,KPO,KTD,KUH,KUM,KUV,KWJ,LUV,MBE,MJZ,MKQ,MKW,MMB,MMD
540=MMJ,MMY,MSJ,MWX,MYJ,NAM,NER,NGO,NGS,NKM,NRT,NTQ,OBO,OEC,OGN,OIM,OIR,OIT,OKA,OKD
540=OKE,OKI,OKJ,ONJ,PUS,PYJ,RGO,RIS,ROR,RSU,SDJ,SHB,SHI,SHM,SOQ,SUY,SXK,SYO,TAE,TAK
540=TIM,TKN,TKS,TNE,TOY,TRA,TSJ,TTE,TTJ,UAI,UBJ,UEO,UKB,USN,VHV,VYI,WJU,WKJ,WMX,WOS
540=YGJ,YKS,YNY
570=ADL,ASP,AYQ,BHQ,CED,DRW,ELC,GOV,GTE,KGC,MCV,MGB,MNG,OLP,PLO,PUG,SNB,TCA,WYA
600=ABM,ABX,ARM,AVV,BCI,BDB,BEU,BHS,BKQ,BNE,BNK,BQG,BRK,BUC,BVI,BWT,BXG,CAZ,CBR,CFS
600=CMA,CNB,CNJ,CNS,CTL,CTN,DAU,DBO,DMD,DPO,EDR,EMD,GFF,GKA,GLT,GUM,GUR,HBA,HGD,HGU
600=HID,HKN,HTI,HVB,IRG,ISA,JCK,KHV,KNS,KVG,KWM,KXK,LAE,LHG,LRE,LST,LSY,MAG,MAS,MCY
600=MDU,MEB,MEL,MHU,MIM,MKY,MOV,MQL,MRZ,MYA,NAA,NLI,NRA,NTL,NTN,OHO,OKY,OOL,OOM,PKE
600=PNP,POM,PPP,PQQ,PTJ,RAB,RCM,RMA,ROK,ROP,SGO,SPN,SYD,THG,TIQ,TKK,TMW,TSV,ULP,USR
600=VAI,VVO,WBM,WEI,WGA,WGE,WIN,WNR,WTB,WWK,XTG,YAP
660=BUA,CKH,CYX,GDX,HIR,ITU,KIE,KSA,MUA,NGK,NLK,NOU,PNI,SEK,SON,UUS,VLI
720=AKL,AWK,BHE,CHC,DUD,DYR,ENT,FUN,HLZ,INU,IVC,KAT,KPW,KWA,MAJ,NAN,NPE,NSN,PKC,PMR
720=PWE,ROT,SUV,TRG,TRW,TUO,WAG,WLG,WLS,ZQN
765=CHT
780=APW,TBU,VAV
840=CXI`
    .split(/\s+/)
    .flatMap((grupo) => {
      const [min, siglas] = grupo.split('=')
      return siglas.split(',').map((iata) => [iata, Number(min)] as const)
    }),
)

const SLOTS_BY_TIER: Record<number, number> = { 1: 90, 2: 200, 3: 420, 4: 780, 5: 1300 }

export const AIRPORTS: Airport[] = RAW.split('\n').map((line) => {
  const [iata, city, country, cc, lat, lon, pop, gdp, tour, runway, tier, elev] = line.split('|')
  const t = Number(tier) as Airport['tier']
  return {
    iata,
    city,
    country,
    cc,
    lat: Number(lat),
    lon: Number(lon),
    pop: Number(pop),
    gdp: Number(gdp),
    tour: Number(tour),
    runway: Number(runway),
    elev: Number(elev),
    tier: t,
    cont: CONTINENTE[cc] ?? 'AN',
    paxDia: movimentoDiario(
      MOVIMENTO_ANUAL[iata] ?? estimarMovimento(Number(pop), Number(gdp), t, Number(runway)),
    ),
    fluxo: fatorFluxo(iata),
    medido: MOVIMENTO_ANUAL[iata] !== undefined,
    fuso: FUSO[iata] ?? Math.round(Number(lon) / 15) * 60,
    escopo: escopoDe(iata, t, AIRPORT_NAMES[iata] ?? ''),
    slots: SLOTS_BY_TIER[t],
    name: `${city} (${iata})`,
    official: AIRPORT_NAMES[iata] ?? `${city} (${iata})`,
    tetoAssentos: TETO_ASSENTOS[iata],
  } as Airport
})

/**
 * Raio em que dois aeroportos servem a mesma cidade.
 *
 * Setenta e cinco quilômetros cobrem Guarulhos com Congonhas, Galeão com
 * Santos Dumont, Heathrow com Gatwick, Stansted, Luton e City, Narita com
 * Haneda, e Charles de Gaulle com Orly e Beauvais. Viracopos fica de fora, a
 * 95 km de Guarulhos: é vendido como aeroporto de São Paulo, mas está em
 * Campinas, e esticar o raio até lá começa a juntar cidades que ninguém trata
 * como uma só.
 */
const RAIO_IRMAOS = 75

/**
 * Distância em quilômetros, escrita aqui em vez de importada de `geo.ts`.
 *
 * `geo.ts` importa este arquivo para resolver sigla em aeroporto; importar de
 * volta fecharia um ciclo, e ciclo de módulo neste ponto deixa `AIRPORTS` pela
 * metade na hora em que a lista de irmãos é montada. São cinco linhas de
 * trigonometria — mais barato que o ciclo.
 */
const kmEntre = (a: Airport, b: Airport) => {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Quem divide cidade com quem.
 *
 * Só serve para um propósito, e é o que o índice de afinidade em `demand.ts`
 * usa: num par de cidades onde as duas pontas têm mais de um aeroporto, o
 * passageiro **escolhe**, e não escolhe ao acaso — o voo de centro a centro é
 * outro mercado que o de hub a hub.
 */
export const IRMAOS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {}
  // varredura por faixa de latitude: comparar 3.086 com 3.086 são 9,5 milhões
  // de pares, e ordenar corta isso para uma vizinhança por aeroporto
  const ordenados = [...AIRPORTS].sort((x, y) => x.lat - y.lat)
  const grau = RAIO_IRMAOS / 111
  for (let i = 0; i < ordenados.length; i++) {
    const a = ordenados[i]
    for (let j = i + 1; j < ordenados.length && ordenados[j].lat - a.lat < grau; j++) {
      const b = ordenados[j]
      if (Math.abs(a.lon - b.lon) > grau / Math.max(0.05, Math.cos((a.lat * Math.PI) / 180))) continue
      if (kmEntre(a, b) > RAIO_IRMAOS) continue
      ;(out[a.iata] ??= []).push(b.iata)
      ;(out[b.iata] ??= []).push(a.iata)
    }
  }
  return out
})()

/** O aeroporto divide a cidade com outro? */
export const temIrmao = (iata: string) => (IRMAOS[iata]?.length ?? 0) > 0

export const AIRPORT_BY_IATA: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.iata, a]),
)

/**
 * A rota entre os dois aeroportos é permitida? Devolve o motivo, ou nulo.
 *
 * Voo dentro do mesmo país passa sempre: escopo é sobre alfândega, e voo
 * doméstico não passa por ela. O que o escopo trava é o internacional —
 * `dom` não recebe nenhum, `reg` só recebe do próprio continente.
 *
 * Só a papelada: pista e alcance são outra conta, em `spec.ts`, e continuam
 * valendo por cima desta.
 */
/**
 * Aeroportos com restrição de operação noturna, e a janela fechada.
 *
 * É regra local de ruído, não norma internacional, então não existe cadastro
 * mundial: esta é uma lista à mão dos casos conhecidos e documentados, do mesmo
 * jeito que `ESCOPO_A_MAO`. Onde o jogo não sabe, deixa voar — errar para o
 * lado de permitir é melhor que inventar uma proibição.
 *
 * As janelas são as publicadas por cada aeroporto, arredondadas para a hora
 * cheia. Heathrow tem cota de movimentos em vez de proibição pura, mas o efeito
 * prático para quem monta grade é o mesmo: não se marca partida ali às três da
 * manhã.
 */
export const TOQUE_DE_RECOLHER: Record<string, [number, number]> = {
  // Reino Unido: cota noturna 23:30–06:00 nos três de Londres
  LHR: [23, 6], LGW: [23, 6], STN: [23, 6],
  // França: Orly fecha de verdade, 23:30–06:00; Charles de Gaulle limita
  ORY: [23, 6], CDG: [0, 5],
  // Alemanha e Áustria
  FRA: [23, 5], MUC: [0, 5], DUS: [22, 6], VIE: [23, 6],
  // Suíça
  ZRH: [23, 6],
  // Itália: Linate fecha, Malpensa limita
  LIN: [23, 6], MXP: [0, 5],
  // Bélgica e Noruega
  BRU: [23, 6], OSL: [23, 6],
  // Londres City, que ainda fecha no fim de semana
  LCY: [22, 6],
  // Austrália: Sydney tem toque de recolher em lei desde 1995
  SYD: [23, 6], ADL: [23, 6], BNE: [22, 6], PER: [23, 6],
  // Japão: Narita e Haneda têm janela fechada
  NRT: [0, 6],
  // Brasil: aeroporto de cidade, vizinhança colada na cabeceira
  CGH: [23, 6], SDU: [23, 6], PLU: [23, 6],
  // Estados Unidos: Reagan, John Wayne e Burbank têm regra de ruído
  DCA: [22, 7], SNA: [23, 7], BUR: [22, 7],
}

/** O horário cai na janela fechada do aeroporto? */
export function noToqueDeRecolher(iata: string, minutos: number): boolean {
  const janela = TOQUE_DE_RECOLHER[iata]
  if (!janela) return false
  const h = Math.floor((((minutos % 1440) + 1440) % 1440) / 60)
  const [fecha, abre] = janela
  return fecha > abre ? h >= fecha || h < abre : h >= fecha && h < abre
}

/** O aeroporto tem nome oficial de verdade, ou só o rótulo curto? */
export const temNomeOficial = (a: Airport) => a.official !== a.name

export function vooPermitido(a: Airport, b: Airport): string | null {
  if (a.cc === b.cc) return null
  const fechado = a.escopo === 'dom' ? a : b.escopo === 'dom' ? b : null
  if (fechado) return `${fechado.iata} é doméstico: não recebe voo internacional.`
  const regional = a.escopo === 'reg' ? a : b.escopo === 'reg' ? b : null
  if (regional && a.cont !== b.cont) {
    const outro = regional === a ? b : a
    return `${regional.iata} é regional: internacional só dentro de ${CONTINENTE_LABEL[regional.cont]}, e ${outro.iata} fica em ${CONTINENTE_LABEL[outro.cont]}.`
  }
  return null
}

export const CONTINENTE_LABEL: Record<Continente, string> = {
  AF: 'África', AN: 'Antártida', AS: 'Ásia', EU: 'Europa',
  NA: 'América do Norte', OC: 'Oceania', SA: 'América do Sul',
}

/** Aeroportos que podem ser escolhidos como base inicial. */
export const STARTER_HUBS = AIRPORTS.filter((a) => a.tier >= 3).map((a) => a.iata)
