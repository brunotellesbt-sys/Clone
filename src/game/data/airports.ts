// Aeroportos — dados factuais (código IATA, cidade, país, coordenadas) mais
// índices de jogo escritos à mão: população da região metropolitana (milhões),
// índice econômico (poder de compra, 0.3–1.6), atratividade turística (0.5–2.2),
// pista mais longa em pés e "tier" (1 = regional, 5 = mega hub).
import { AIRPORT_NAMES } from './airportNames'

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
  tier: 1 | 2 | 3 | 4 | 5
  slots: number
  /** Rótulo curto: "Cidade (IATA)". */
  name: string
  /** Nome oficial do aeroporto. */
  official: string
}

const RAW = `
GRU|Sao Paulo|Brasil|BR|-23.43|-46.47|22.4|0.78|1.0|12139|5
CGH|Sao Paulo|Brasil|BR|-23.63|-46.66|22.4|0.85|0.8|6365|3
VCP|Campinas|Brasil|BR|-23.01|-47.13|3.3|0.80|0.7|10630|3
GIG|Rio de Janeiro|Brasil|BR|-22.81|-43.25|13.5|0.72|1.9|13123|4
SDU|Rio de Janeiro|Brasil|BR|-22.91|-43.16|13.5|0.85|1.4|4341|2
BSB|Brasilia|Brasil|BR|-15.87|-47.92|4.8|0.95|0.8|10499|4
CNF|Belo Horizonte|Brasil|BR|-19.63|-43.97|6.0|0.75|0.8|10007|3
POA|Porto Alegre|Brasil|BR|-29.99|-51.17|4.4|0.80|0.9|6900|3
CWB|Curitiba|Brasil|BR|-25.53|-49.18|3.7|0.82|0.8|7215|3
REC|Recife|Brasil|BR|-8.13|-34.92|4.1|0.65|1.6|9843|3
SSA|Salvador|Brasil|BR|-12.91|-38.33|3.9|0.62|1.7|9843|3
FOR|Fortaleza|Brasil|BR|-3.78|-38.53|4.1|0.60|1.5|8858|3
BEL|Belem|Brasil|BR|-1.38|-48.48|2.5|0.55|1.0|9186|2
MAO|Manaus|Brasil|BR|-3.04|-60.05|2.6|0.58|1.1|8858|2
FLN|Florianopolis|Brasil|BR|-27.67|-48.55|1.3|0.85|1.8|7546|2
GYN|Goiania|Brasil|BR|-16.63|-49.22|2.7|0.72|0.6|7500|2
NAT|Natal|Brasil|BR|-5.77|-35.37|1.6|0.58|1.6|9843|2
IGU|Foz do Iguacu|Brasil|BR|-25.60|-54.49|0.3|0.60|2.2|7218|2
VIX|Vitoria|Brasil|BR|-20.26|-40.29|2.0|0.78|0.8|6900|2
MCZ|Maceio|Brasil|BR|-9.51|-35.79|1.3|0.55|1.6|8858|2
CGB|Cuiaba|Brasil|BR|-15.65|-56.12|1.1|0.70|0.7|8202|2
SLZ|Sao Luis|Brasil|BR|-2.58|-44.23|1.6|0.52|0.9|7546|1
EZE|Buenos Aires|Argentina|AR|-34.82|-58.54|15.4|0.70|1.5|10827|4
AEP|Buenos Aires|Argentina|AR|-34.56|-58.42|15.4|0.75|1.1|6890|2
SCL|Santiago|Chile|CL|-33.39|-70.79|7.1|0.90|1.3|12303|4
LIM|Lima|Peru|PE|-12.02|-77.11|10.7|0.65|1.5|11506|4
BOG|Bogota|Colombia|CO|4.70|-74.15|11.3|0.68|1.1|12467|4
MDE|Medellin|Colombia|CO|6.16|-75.42|4.1|0.65|1.3|11483|2
UIO|Quito|Equador|EC|-0.13|-78.36|2.8|0.62|1.2|13451|2
MVD|Montevideu|Uruguai|UY|-34.84|-56.03|1.9|0.85|1.1|8996|2
ASU|Assuncao|Paraguai|PY|-25.24|-57.52|2.5|0.55|0.7|11024|1
VVI|Santa Cruz|Bolivia|BO|-17.64|-63.14|1.9|0.50|0.8|11483|1
CCS|Caracas|Venezuela|VE|10.60|-66.99|5.2|0.45|0.7|11483|2
MEX|Cidade do Mexico|Mexico|MX|19.44|-99.07|22.0|0.72|1.4|12966|5
CUN|Cancun|Mexico|MX|21.04|-86.87|0.9|0.65|2.2|11480|4
GDL|Guadalajara|Mexico|MX|20.52|-103.31|5.3|0.70|1.0|13123|3
PTY|Cidade do Panama|Panama|PA|9.07|-79.38|1.9|0.80|1.2|10006|4
HAV|Havana|Cuba|CU|22.99|-82.41|2.1|0.40|1.7|13123|2
SJU|San Juan|Porto Rico|PR|18.44|-66.00|2.4|0.85|1.9|10400|3
JFK|Nova York|EUA|US|40.64|-73.78|20.1|1.45|2.0|14511|5
EWR|Nova York|EUA|US|40.69|-74.17|20.1|1.40|1.5|11000|4
LGA|Nova York|EUA|US|40.78|-73.87|20.1|1.40|1.2|7003|3
ATL|Atlanta|EUA|US|33.64|-84.43|6.3|1.25|0.9|12390|5
ORD|Chicago|EUA|US|41.98|-87.90|9.5|1.30|1.2|13000|5
LAX|Los Angeles|EUA|US|33.94|-118.41|13.2|1.40|1.9|12091|5
SFO|Sao Francisco|EUA|US|37.62|-122.38|4.7|1.60|1.6|11870|4
DFW|Dallas|EUA|US|32.90|-97.04|7.9|1.30|0.9|13401|5
DEN|Denver|EUA|US|39.86|-104.67|3.0|1.25|1.2|16000|4
MIA|Miami|EUA|US|25.79|-80.29|6.2|1.20|2.0|13016|5
SEA|Seattle|EUA|US|47.45|-122.31|4.0|1.45|1.2|11901|4
BOS|Boston|EUA|US|42.36|-71.01|4.9|1.45|1.2|10083|4
IAD|Washington|EUA|US|38.95|-77.46|6.4|1.45|1.3|11500|4
IAH|Houston|EUA|US|29.99|-95.34|7.1|1.30|0.8|12001|4
PHX|Phoenix|EUA|US|33.44|-112.01|5.0|1.15|1.1|11489|3
LAS|Las Vegas|EUA|US|36.08|-115.15|2.3|1.10|2.2|14511|4
MCO|Orlando|EUA|US|28.43|-81.31|2.7|1.05|2.2|12005|4
CLT|Charlotte|EUA|US|35.21|-80.94|2.7|1.20|0.8|10000|4
MSP|Minneapolis|EUA|US|44.88|-93.22|3.7|1.25|0.8|11006|3
DTW|Detroit|EUA|US|42.21|-83.35|4.4|1.05|0.7|12003|3
PHL|Filadelfia|EUA|US|39.87|-75.24|6.2|1.20|1.0|10500|3
SAN|San Diego|EUA|US|32.73|-117.19|3.3|1.30|1.4|9401|3
YYZ|Toronto|Canada|CA|43.68|-79.63|6.4|1.25|1.2|11120|5
YVR|Vancouver|Canada|CA|49.19|-123.18|2.6|1.30|1.5|11500|4
YUL|Montreal|Canada|CA|45.47|-73.74|4.3|1.15|1.2|11000|3
YYC|Calgary|Canada|CA|51.13|-114.01|1.6|1.30|1.0|14000|3
LHR|Londres|Reino Unido|GB|51.47|-0.45|14.3|1.45|2.0|12799|5
LGW|Londres|Reino Unido|GB|51.15|-0.19|14.3|1.30|1.6|10879|4
MAN|Manchester|Reino Unido|GB|53.35|-2.27|2.8|1.05|1.0|10000|3
EDI|Edimburgo|Reino Unido|GB|55.95|-3.37|0.9|1.10|1.5|8400|2
DUB|Dublin|Irlanda|IE|53.42|-6.27|1.4|1.30|1.4|10499|4
CDG|Paris|Franca|FR|49.01|2.55|13.0|1.35|2.1|13829|5
ORY|Paris|Franca|FR|48.73|2.37|13.0|1.25|1.4|11975|3
NCE|Nice|Franca|FR|43.66|7.22|1.0|1.20|2.0|9711|2
AMS|Amsterda|Holanda|NL|52.31|4.76|2.9|1.40|1.8|12467|5
FRA|Frankfurt|Alemanha|DE|50.03|8.56|5.8|1.40|1.1|13123|5
MUC|Munique|Alemanha|DE|48.35|11.79|3.0|1.40|1.4|13123|5
BER|Berlim|Alemanha|DE|52.36|13.50|4.7|1.20|1.4|13123|4
MAD|Madri|Espanha|ES|40.47|-3.56|6.8|1.10|1.6|14268|5
BCN|Barcelona|Espanha|ES|41.30|2.08|5.6|1.10|2.0|10531|4
PMI|Palma|Espanha|ES|39.55|2.74|0.6|1.00|2.2|10826|3
AGP|Malaga|Espanha|ES|36.67|-4.50|1.0|0.95|2.0|10499|2
LIS|Lisboa|Portugal|PT|38.77|-9.13|2.9|0.95|1.9|12484|4
OPO|Porto|Portugal|PT|41.24|-8.68|1.7|0.90|1.5|11417|3
FCO|Roma|Italia|IT|41.80|12.25|4.3|1.10|2.1|12795|5
MXP|Milao|Italia|IT|45.63|8.72|5.1|1.25|1.4|12844|4
ZRH|Zurique|Suica|CH|47.46|8.55|1.4|1.60|1.4|12139|4
GVA|Genebra|Suica|CH|46.24|6.11|1.0|1.60|1.5|12795|3
VIE|Viena|Austria|AT|48.11|16.57|2.0|1.25|1.5|11811|4
BRU|Bruxelas|Belgica|BE|50.90|4.48|2.1|1.30|1.1|11936|3
CPH|Copenhague|Dinamarca|DK|55.62|12.66|2.1|1.40|1.3|11811|4
ARN|Estocolmo|Suecia|SE|59.65|17.92|2.4|1.35|1.2|10827|3
OSL|Oslo|Noruega|NO|60.19|11.10|1.5|1.50|1.2|11811|3
HEL|Helsinque|Finlandia|FI|60.32|24.96|1.5|1.30|1.1|11286|3
WAW|Varsovia|Polonia|PL|52.17|20.97|3.1|0.90|1.0|12106|3
PRG|Praga|Chequia|CZ|50.10|14.26|2.7|0.95|1.7|12188|3
BUD|Budapeste|Hungria|HU|47.44|19.26|2.5|0.85|1.6|11532|3
OTP|Bucareste|Romenia|RO|44.57|26.09|2.3|0.75|0.9|11483|2
ATH|Atenas|Grecia|GR|37.94|23.94|3.8|0.90|2.1|13123|4
IST|Istambul|Turquia|TR|41.28|28.75|16.0|0.80|1.8|13780|5
SAW|Istambul|Turquia|TR|40.90|29.31|16.0|0.70|1.2|9843|3
SVO|Moscou|Russia|RU|55.97|37.41|17.3|0.75|0.9|12467|4
LED|Sao Petersburgo|Russia|RU|59.80|30.26|5.6|0.70|1.2|12405|3
DXB|Dubai|Emirados|AE|25.25|55.36|3.6|1.35|2.2|13123|5
AUH|Abu Dhabi|Emirados|AE|24.44|54.65|1.6|1.40|1.4|13451|4
DOH|Doha|Catar|QA|25.27|51.61|2.4|1.45|1.3|15912|5
RUH|Riade|Arabia Saudita|SA|24.96|46.70|8.0|1.10|0.7|13780|4
JED|Jeda|Arabia Saudita|SA|21.68|39.16|4.7|1.00|1.5|12467|4
KWI|Kuwait|Kuwait|KW|29.23|47.98|3.1|1.10|0.6|11155|2
BAH|Manama|Bahrein|BH|26.27|50.63|1.5|1.15|0.9|13000|2
TLV|Tel Aviv|Israel|IL|32.01|34.89|4.2|1.30|1.3|11989|4
AMM|Ama|Jordania|JO|31.72|35.99|4.5|0.70|1.2|12008|2
CAI|Cairo|Egito|EG|30.11|31.41|21.3|0.50|1.7|13123|4
CMN|Casablanca|Marrocos|MA|33.37|-7.59|4.4|0.60|1.3|12205|3
TUN|Tunis|Tunisia|TN|36.85|10.23|2.8|0.55|1.3|10499|2
ALG|Argel|Argelia|DZ|36.69|3.22|3.4|0.60|0.7|11483|2
LOS|Lagos|Nigeria|NG|6.58|3.32|15.4|0.45|0.6|12795|3
ABV|Abuja|Nigeria|NG|9.01|7.26|3.8|0.50|0.5|11810|2
ACC|Acra|Gana|GH|5.61|-0.17|5.1|0.45|0.8|11165|2
ADD|Adis Abeba|Etiopia|ET|8.98|38.80|5.2|0.35|0.8|12467|4
NBO|Nairobi|Quenia|KE|-1.32|36.93|5.3|0.45|1.5|13507|3
DAR|Dar es Salaam|Tanzania|TZ|-6.87|39.20|7.4|0.35|1.1|9843|1
JNB|Joanesburgo|Africa do Sul|ZA|-26.13|28.25|10.5|0.65|1.1|14495|4
CPT|Cidade do Cabo|Africa do Sul|ZA|-33.97|18.60|4.8|0.70|2.0|10502|3
DUR|Durban|Africa do Sul|ZA|-29.61|31.12|3.7|0.60|1.2|12139|2
MRU|Maurcio|Mauricio|MU|-20.43|57.68|0.2|0.75|2.2|11056|2
DEL|Nova Delhi|India|IN|28.56|77.10|32.9|0.55|1.2|14534|5
BOM|Mumbai|India|IN|19.09|72.87|21.7|0.62|1.1|11302|5
BLR|Bangalore|India|IN|13.20|77.71|13.6|0.65|0.8|13123|4
MAA|Chennai|India|IN|12.99|80.17|11.5|0.55|0.8|12001|3
HYD|Hyderabad|India|IN|17.24|78.43|10.5|0.60|0.8|13976|3
CCU|Calcuta|India|IN|22.65|88.45|15.3|0.45|0.8|11900|3
CMB|Colombo|Sri Lanka|LK|7.18|79.88|5.6|0.45|1.7|11004|2
DAC|Daca|Bangladesh|BD|23.84|90.40|22.5|0.35|0.5|10500|3
KHI|Carachi|Paquistao|PK|24.91|67.16|17.2|0.40|0.5|11155|2
ISB|Islamabade|Paquistao|PK|33.55|72.83|3.5|0.45|0.6|12224|2
KTM|Katmandu|Nepal|NP|27.70|85.36|2.7|0.35|1.9|10121|1
PEK|Pequim|China|CN|40.08|116.58|22.0|0.95|1.4|12467|5
PKX|Pequim|China|CN|39.51|116.41|22.0|0.90|1.0|12467|4
PVG|Xangai|China|CN|31.14|121.81|29.2|1.05|1.3|13123|5
SHA|Xangai|China|CN|31.20|121.34|29.2|1.00|0.9|11154|4
CAN|Guangzhou|China|CN|23.39|113.30|18.7|0.95|0.9|12467|5
SZX|Shenzhen|China|CN|22.64|113.81|17.6|1.05|0.8|11483|4
CTU|Chengdu|China|CN|30.31|103.95|21.4|0.80|1.0|13123|4
XIY|Xian|China|CN|34.44|108.75|13.0|0.75|1.2|11811|3
KMG|Kunming|China|CN|25.10|102.93|8.5|0.70|1.2|13780|3
HKG|Hong Kong|Hong Kong|HK|22.31|113.91|7.5|1.35|1.7|12467|5
TPE|Taipe|Taiwan|TW|25.08|121.23|7.0|1.15|1.3|12008|4
ICN|Seul|Coreia do Sul|KR|37.46|126.44|25.6|1.25|1.5|12303|5
GMP|Seul|Coreia do Sul|KR|37.56|126.79|25.6|1.20|1.0|11811|4
CJU|Jeju|Coreia do Sul|KR|33.51|126.49|0.7|0.95|2.1|10499|3
NRT|Toquio|Japao|JP|35.76|140.39|37.4|1.30|1.8|13123|5
HND|Toquio|Japao|JP|35.55|139.78|37.4|1.40|1.5|9843|5
KIX|Osaka|Japao|JP|34.43|135.23|19.1|1.25|1.5|13123|4
ITM|Osaka|Japao|JP|34.79|135.44|19.1|1.30|1.0|9843|3
CTS|Sapporo|Japao|JP|42.78|141.69|2.6|1.15|1.7|9843|3
FUK|Fukuoka|Japao|JP|33.59|130.45|5.6|1.20|1.2|9186|3
OKA|Okinawa|Japao|JP|26.20|127.65|1.4|1.00|1.9|9843|2
SIN|Singapura|Singapura|SG|1.36|103.99|6.0|1.50|1.7|13123|5
KUL|Kuala Lumpur|Malasia|MY|2.75|101.71|8.4|0.80|1.4|13648|4
BKK|Banguecoque|Tailandia|TH|13.69|100.75|17.4|0.70|2.1|13123|5
DMK|Banguecoque|Tailandia|TH|13.91|100.61|17.4|0.60|1.5|11483|3
HKT|Phuket|Tailandia|TH|8.11|98.32|0.6|0.65|2.2|9843|2
CGK|Jacarta|Indonesia|ID|-6.13|106.66|33.4|0.60|1.0|12008|5
DPS|Bali|Indonesia|ID|-8.75|115.17|1.0|0.60|2.2|9843|3
MNL|Manila|Filipinas|PH|14.51|121.02|24.9|0.55|1.2|12261|4
CEB|Cebu|Filipinas|PH|10.31|123.98|3.0|0.50|1.7|10827|2
SGN|Ho Chi Minh|Vietna|VN|10.82|106.66|9.3|0.60|1.4|12467|4
HAN|Hanoi|Vietna|VN|21.22|105.81|8.5|0.58|1.3|12467|4
RGN|Yangon|Mianmar|MM|16.91|96.13|5.4|0.30|0.7|11200|1
PNH|Phnom Penh|Camboja|KH|11.55|104.84|2.3|0.35|1.4|9843|1
ALA|Almaty|Cazaquistao|KZ|43.35|77.04|2.2|0.65|0.8|14435|2
TAS|Tashkent|Uzbequistao|UZ|41.26|69.28|2.9|0.50|0.8|13123|2
SYD|Sydney|Australia|AU|-33.95|151.18|5.4|1.40|1.9|13000|5
MEL|Melbourne|Australia|AU|-37.67|144.84|5.2|1.35|1.4|11998|4
BNE|Brisbane|Australia|AU|-27.38|153.12|2.6|1.30|1.4|11680|4
PER|Perth|Australia|AU|-31.94|115.97|2.2|1.35|1.0|11300|3
ADL|Adelaide|Australia|AU|-34.95|138.53|1.4|1.25|0.9|10171|2
AKL|Auckland|Nova Zelandia|NZ|-37.01|174.79|1.7|1.25|1.7|11926|4
CHC|Christchurch|Nova Zelandia|NZ|-43.49|172.53|0.4|1.20|1.6|10787|2
NAN|Nadi|Fiji|FJ|-17.75|177.44|0.2|0.60|2.2|10500|2
CGR|Campo Grande|Brasil|BR|-20.47|-54.67|0.9|0.72|0.6|8530|2
JPA|Joao Pessoa|Brasil|BR|-7.15|-34.95|1.2|0.62|1.2|8202|2
AJU|Aracaju|Brasil|BR|-10.98|-37.07|1.0|0.60|1.1|7546|2
THE|Teresina|Brasil|BR|-5.06|-42.82|1.1|0.58|0.6|8202|2
PVH|Porto Velho|Brasil|BR|-8.71|-63.90|0.6|0.60|0.6|7218|1
MCP|Macapa|Brasil|BR|0.05|-51.07|0.5|0.55|0.6|6562|1
BVB|Boa Vista|Brasil|BR|2.84|-60.69|0.4|0.58|0.7|8202|1
PMW|Palmas|Brasil|BR|-10.29|-48.36|0.3|0.65|0.6|8202|1
LDB|Londrina|Brasil|BR|-23.33|-51.13|0.6|0.80|0.6|6890|1
UDI|Uberlandia|Brasil|BR|-18.88|-48.23|0.7|0.82|0.6|6890|1
COR|Cordoba|Argentina|AR|-31.32|-64.21|1.6|0.62|0.9|10499|2
MDZ|Mendoza|Argentina|AR|-32.83|-68.79|1.2|0.60|1.3|9186|2
BRC|Bariloche|Argentina|AR|-41.15|-71.16|0.2|0.58|1.9|7710|1
USH|Ushuaia|Argentina|AR|-54.84|-68.30|0.1|0.55|1.8|9186|1
IGR|Puerto Iguazu|Argentina|AR|-25.74|-54.47|0.1|0.55|2.0|7218|1
CUZ|Cusco|Peru|PE|-13.54|-71.94|0.5|0.52|2.2|11483|2
AQP|Arequipa|Peru|PE|-16.34|-71.57|1.1|0.50|1.0|9678|1
GYE|Guayaquil|Equador|EC|-2.16|-79.88|3.1|0.52|0.9|8858|2
CLO|Cali|Colombia|CO|3.54|-76.38|2.9|0.55|0.9|9843|2
CTG|Cartagena|Colombia|CO|10.44|-75.51|1.1|0.55|1.9|8530|2
BAQ|Barranquilla|Colombia|CO|10.89|-74.78|2.2|0.55|0.8|9843|2
LPB|La Paz|Bolivia|BO|-16.51|-68.19|1.9|0.42|1.3|13123|2
PMC|Puerto Montt|Chile|CL|-41.43|-73.09|0.3|0.62|1.4|7218|1
ANF|Antofagasta|Chile|CL|-23.44|-70.44|0.4|0.70|0.7|8530|1
SJO|San Jose|Costa Rica|CR|9.99|-84.20|2.2|0.62|1.9|9882|3
LIR|Liberia|Costa Rica|CR|10.59|-85.54|0.1|0.60|1.8|9186|1
GUA|Cidade da Guatemala|Guatemala|GT|14.58|-90.53|3.0|0.45|1.0|9678|2
SAL|San Salvador|El Salvador|SV|13.44|-89.06|1.8|0.45|0.9|10500|2
TGU|Tegucigalpa|Honduras|HN|14.06|-87.22|1.4|0.35|0.7|7080|1
SAP|San Pedro Sula|Honduras|HN|15.45|-87.92|1.0|0.38|0.7|8497|1
MGA|Managua|Nicaragua|NI|12.14|-86.17|1.4|0.35|0.8|8012|1
MTY|Monterrey|Mexico|MX|25.78|-100.11|5.3|0.78|0.7|9843|3
TIJ|Tijuana|Mexico|MX|32.54|-116.97|2.2|0.68|0.9|9678|3
SJD|Los Cabos|Mexico|MX|23.15|-109.72|0.3|0.70|2.1|9843|2
PVR|Puerto Vallarta|Mexico|MX|20.68|-105.25|0.4|0.65|2.0|10171|2
MID|Merida|Mexico|MX|20.94|-89.66|1.3|0.60|1.2|7513|2
SDQ|Santo Domingo|Republica Dominicana|DO|18.43|-69.67|3.5|0.48|1.4|11155|3
PUJ|Punta Cana|Republica Dominicana|DO|18.57|-68.36|0.1|0.50|2.2|10171|3
MBJ|Montego Bay|Jamaica|JM|18.50|-77.91|0.1|0.48|2.1|8700|2
KIN|Kingston|Jamaica|JM|17.94|-76.79|1.2|0.45|1.2|8911|2
NAS|Nassau|Bahamas|BS|25.04|-77.47|0.3|0.75|2.1|11000|2
BGI|Bridgetown|Barbados|BB|13.07|-59.49|0.3|0.72|1.9|11000|2
POS|Port of Spain|Trinidad e Tobago|TT|10.60|-61.34|0.6|0.80|0.9|10500|2
CUR|Willemstad|Curacao|CW|12.19|-68.96|0.2|0.70|1.8|11188|2
AUA|Oranjestad|Aruba|AW|12.50|-70.02|0.1|0.75|2.0|9000|2
SXM|Philipsburg|Sint Maarten|SX|18.04|-63.11|0.1|0.72|2.0|7546|2
FLL|Fort Lauderdale|Estados Unidos|US|26.07|-80.15|6.2|1.05|1.6|9000|3
TPA|Tampa|Estados Unidos|US|27.98|-82.53|3.2|1.02|1.3|11002|3
SLC|Salt Lake City|Estados Unidos|US|40.79|-111.98|1.3|1.08|1.0|12000|3
PDX|Portland|Estados Unidos|US|45.59|-122.60|2.5|1.10|1.0|11000|3
STL|St. Louis|Estados Unidos|US|38.75|-90.37|2.8|1.02|0.7|11019|2
MCI|Kansas City|Estados Unidos|US|39.30|-94.71|2.2|1.02|0.7|10801|2
AUS|Austin|Estados Unidos|US|30.20|-97.67|2.3|1.15|1.1|12250|3
SAT|San Antonio|Estados Unidos|US|29.53|-98.47|2.6|0.98|1.0|8502|2
RDU|Raleigh|Estados Unidos|US|35.88|-78.79|1.5|1.10|0.8|10000|2
BNA|Nashville|Estados Unidos|US|36.13|-86.68|2.0|1.05|1.3|11030|3
MEM|Memphis|Estados Unidos|US|35.04|-89.98|1.3|0.92|0.8|11120|2
IND|Indianapolis|Estados Unidos|US|39.72|-86.29|2.1|1.00|0.7|11200|2
CVG|Cincinnati|Estados Unidos|US|39.05|-84.66|2.2|1.00|0.7|12000|2
PIT|Pittsburgh|Estados Unidos|US|40.49|-80.23|2.4|0.98|0.8|11500|2
CLE|Cleveland|Estados Unidos|US|41.41|-81.85|2.1|0.95|0.7|9956|2
MKE|Milwaukee|Estados Unidos|US|42.95|-87.90|1.6|0.98|0.7|9690|2
ABQ|Albuquerque|Estados Unidos|US|35.04|-106.61|0.9|0.92|0.9|13793|2
HNL|Honolulu|Estados Unidos|US|21.32|-157.92|1.0|1.05|2.2|12300|3
ANC|Anchorage|Estados Unidos|US|61.17|-149.99|0.4|1.05|1.4|12400|2
OGG|Kahului|Estados Unidos|US|20.90|-156.43|0.2|1.00|2.1|6995|2
YEG|Edmonton|Canada|CA|53.31|-113.58|1.4|1.02|0.7|11000|2
YOW|Ottawa|Canada|CA|45.32|-75.67|1.4|1.05|0.9|10000|2
YHZ|Halifax|Canada|CA|44.88|-63.51|0.5|0.95|0.9|10500|2
YWG|Winnipeg|Canada|CA|49.91|-97.24|0.8|0.95|0.6|11000|2
STN|Londres Stansted|Reino Unido|GB|51.89|0.24|9.5|1.05|1.1|10003|3
BHX|Birmingham|Reino Unido|GB|52.45|-1.75|2.9|0.95|0.8|10013|3
GLA|Glasgow|Reino Unido|GB|55.87|-4.43|1.8|0.92|0.9|8720|2
DUS|Dusseldorf|Alemanha|DE|51.28|6.77|11.3|1.10|0.8|9843|3
HAM|Hamburgo|Alemanha|DE|53.63|10.01|3.1|1.12|1.0|12028|3
STR|Stuttgart|Alemanha|DE|48.69|9.22|2.7|1.15|0.8|10925|3
CGN|Colonia|Alemanha|DE|50.87|7.14|3.6|1.08|0.8|12467|2
LYS|Lyon|Franca|FR|45.73|5.08|2.3|1.05|1.0|13123|3
MRS|Marselha|Franca|FR|43.44|5.22|1.9|0.98|1.3|11319|2
TLS|Toulouse|Franca|FR|43.63|1.37|1.4|1.02|0.9|11480|2
VLC|Valencia|Espanha|ES|39.49|-0.48|1.6|0.85|1.4|10827|2
SVQ|Sevilha|Espanha|ES|37.42|-5.90|1.5|0.80|1.5|11020|2
BIO|Bilbao|Espanha|ES|43.30|-2.91|1.0|0.92|1.1|8530|2
LPA|Las Palmas|Espanha|ES|27.93|-15.39|0.9|0.82|1.9|10171|3
TFS|Tenerife Sul|Espanha|ES|28.04|-16.57|0.9|0.82|2.0|10499|3
ALC|Alicante|Espanha|ES|38.28|-0.56|0.8|0.82|1.8|9843|2
IBZ|Ibiza|Espanha|ES|38.87|1.37|0.2|0.85|2.2|9186|2
FAO|Faro|Portugal|PT|37.01|-7.97|0.5|0.78|2.0|8169|2
FNC|Funchal|Portugal|PT|32.69|-16.77|0.3|0.78|1.9|9104|2
LIN|Milao Linate|Italia|IT|45.45|9.28|8.2|1.15|0.9|8005|2
BGY|Bergamo|Italia|IT|45.67|9.70|1.1|1.00|0.9|9186|2
VCE|Veneza|Italia|IT|45.51|12.35|0.9|1.00|2.2|10827|3
NAP|Napoles|Italia|IT|40.89|14.29|3.1|0.78|1.6|8622|2
BLQ|Bolonha|Italia|IT|44.53|11.29|1.0|1.05|1.1|8038|2
CTA|Catania|Italia|IT|37.47|15.07|1.1|0.75|1.4|8038|2
PMO|Palermo|Italia|IT|38.18|13.10|1.0|0.72|1.4|10827|2
BSL|Basileia|Suica|CH|47.60|7.53|0.8|1.20|0.9|12795|2
EIN|Eindhoven|Holanda|NL|51.45|5.37|0.8|1.10|0.7|9843|2
GOT|Gotemburgo|Suecia|SE|57.66|12.29|1.0|1.10|0.8|10826|2
BGO|Bergen|Noruega|NO|60.29|5.22|0.4|1.20|1.5|9810|2
TRD|Trondheim|Noruega|NO|63.46|10.92|0.2|1.15|0.9|9186|1
TLL|Tallinn|Estonia|EE|59.41|24.83|0.6|0.90|1.2|10171|2
RIX|Riga|Letonia|LV|56.92|23.97|0.7|0.85|1.1|10499|2
VNO|Vilnius|Lituania|LT|54.64|25.28|0.6|0.85|1.0|8202|2
KRK|Cracovia|Polonia|PL|50.08|19.80|1.0|0.82|1.6|8366|2
GDN|Gdansk|Polonia|PL|54.38|18.47|1.1|0.80|1.2|9186|2
WRO|Wroclaw|Polonia|PL|51.10|16.89|0.9|0.80|0.9|8202|2
ZAG|Zagreb|Croacia|HR|45.74|16.07|1.1|0.78|1.0|10663|2
SPU|Split|Croacia|HR|43.54|16.30|0.3|0.75|2.1|8366|2
DBV|Dubrovnik|Croacia|HR|42.56|18.27|0.1|0.75|2.2|10827|2
BEG|Belgrado|Servia|RS|44.82|20.31|1.7|0.65|1.0|11155|2
SOF|Sofia|Bulgaria|BG|42.70|23.41|1.5|0.70|1.0|11811|2
SKG|Tessalonica|Grecia|GR|40.52|22.97|1.1|0.78|1.4|7913|2
HER|Heraklion|Grecia|GR|35.34|25.18|0.2|0.75|2.2|8858|2
RHO|Rodes|Grecia|GR|36.41|28.09|0.1|0.72|2.1|10499|2
TIA|Tirana|Albania|AL|41.41|19.72|0.9|0.55|1.3|9022|2
CLJ|Cluj|Romenia|RO|46.78|23.69|0.5|0.72|0.9|6562|1
BTS|Bratislava|Eslovaquia|SK|48.17|17.21|0.7|0.88|0.9|10171|1
LJU|Liubliana|Eslovenia|SI|46.22|14.46|0.5|0.95|1.1|10827|1
KEF|Reiquiavique|Islandia|IS|63.99|-22.61|0.2|1.15|2.1|10056|3
ORK|Cork|Irlanda|IE|51.84|-8.49|0.3|1.00|0.9|7218|1
MLA|Malta|Malta|MT|35.86|14.48|0.5|0.90|1.9|11627|2
LCA|Larnaca|Chipre|CY|34.88|33.63|0.4|0.85|1.9|9843|2
AYT|Antalya|Turquia|TR|36.90|30.79|1.3|0.62|2.2|11155|3
ADB|Izmir|Turquia|TR|38.29|27.16|3.0|0.62|1.3|10500|2
ESB|Ancara|Turquia|TR|40.13|32.99|5.7|0.65|0.8|12303|2
DME|Moscou Domodedovo|Russia|RU|55.41|37.90|12.6|0.72|0.8|12467|3
AER|Sochi|Russia|RU|43.45|39.96|0.5|0.68|1.6|9678|2
KBP|Kiev|Ucrania|UA|50.34|30.89|3.0|0.52|0.9|10827|2
SSH|Sharm el-Sheikh|Egito|EG|27.98|34.39|0.1|0.45|2.1|10105|2
HRG|Hurghada|Egito|EG|27.18|33.80|0.2|0.45|2.0|13120|2
RAK|Marraquexe|Marrocos|MA|31.61|-8.04|1.0|0.48|2.0|10171|2
DKR|Dacar|Senegal|SN|14.67|-17.07|3.1|0.35|1.0|11483|2
ABJ|Abidjan|Costa do Marfim|CI|5.26|-3.93|5.6|0.35|0.8|9843|2
DLA|Duala|Camaroes|CM|4.01|9.72|3.4|0.30|0.6|9186|1
LAD|Luanda|Angola|AO|-8.86|13.23|8.3|0.38|0.6|12139|2
MPM|Maputo|Mocambique|MZ|-25.92|32.57|1.8|0.30|0.8|11814|1
HRE|Harare|Zimbabue|ZW|-17.93|31.10|1.6|0.30|0.9|15502|1
LUN|Lusaka|Zambia|ZM|-15.33|28.45|2.9|0.32|0.8|13000|1
WDH|Windhoek|Namibia|NA|-22.48|17.47|0.4|0.45|1.3|14600|1
EBB|Entebbe|Uganda|UG|0.04|32.44|3.6|0.30|1.1|12000|2
KGL|Kigali|Ruanda|RW|-1.97|30.14|1.3|0.32|1.0|11480|2
JRO|Kilimanjaro|Tanzania|TZ|-3.43|37.07|0.2|0.30|1.8|11811|1
SEZ|Mahe|Seicheles|SC|-4.67|55.52|0.1|0.85|2.1|9800|2
TNR|Antananarivo|Madagascar|MG|-18.80|47.48|3.2|0.25|1.2|10171|1
RUN|Saint-Denis|Reuniao|RE|-20.89|55.51|0.6|0.85|1.5|10499|2
MED|Medina|Arabia Saudita|SA|24.55|39.70|1.5|0.85|2.0|13123|3
DMM|Dammam|Arabia Saudita|SA|26.47|49.80|1.6|0.95|0.7|13124|3
SHJ|Sharjah|Emirados Arabes Unidos|AE|25.33|55.52|1.8|0.95|0.9|13124|2
MCT|Mascate|Oma|OM|23.59|58.28|1.6|0.95|1.3|13123|3
IKA|Teera|Ira|IR|35.42|51.15|9.5|0.45|0.8|13780|2
BEY|Beirute|Libano|LB|33.82|35.49|2.4|0.45|1.2|10663|2
NGO|Nagoia|Japao|JP|34.86|136.81|9.4|1.20|0.9|11480|3
PUS|Busan|Coreia do Sul|KR|35.18|128.94|3.4|1.05|1.1|10500|3
HGH|Hangzhou|China|CN|30.23|120.43|11.9|0.82|1.2|11811|3
NKG|Nanquim|China|CN|31.74|118.86|9.3|0.82|1.0|11811|3
WUH|Wuhan|China|CN|30.78|114.21|12.3|0.78|0.8|11811|3
CKG|Chongqing|China|CN|29.72|106.64|16.9|0.72|0.9|12467|4
XMN|Xiamen|China|CN|24.54|118.13|5.2|0.85|1.2|10827|3
TSN|Tianjin|China|CN|39.12|117.35|13.9|0.80|0.7|11155|3
DLC|Dalian|China|CN|38.97|121.54|7.2|0.80|0.9|10827|2
SHE|Shenyang|China|CN|41.64|123.48|9.1|0.72|0.7|10499|2
HRB|Harbin|China|CN|45.62|126.25|10.0|0.68|0.8|10499|2
URC|Urumqi|China|CN|43.91|87.47|4.5|0.65|1.0|11811|2
TAO|Qingdao|China|CN|36.37|120.10|9.0|0.82|1.1|12467|3
CSX|Changsha|China|CN|28.19|113.22|10.5|0.75|0.8|11811|3
KHH|Kaohsiung|Taiwan|TW|22.58|120.35|2.7|1.00|1.0|10335|2
MFM|Macau|Macau|MO|22.15|113.59|0.7|1.15|2.0|11713|2
DVO|Davao|Filipinas|PH|7.13|125.65|2.5|0.42|0.9|9843|2
CRK|Clark|Filipinas|PH|15.19|120.56|2.0|0.45|0.9|10499|2
DAD|Da Nang|Vietna|VN|16.06|108.20|1.2|0.48|1.8|10000|3
CNX|Chiang Mai|Tailandia|TH|18.77|98.96|1.2|0.52|1.9|10004|2
KBV|Krabi|Tailandia|TH|8.10|98.99|0.1|0.50|2.0|9843|2
PEN|Penang|Malasia|MY|5.30|100.28|1.8|0.72|1.5|10997|2
BKI|Kota Kinabalu|Malasia|MY|5.94|116.05|0.6|0.68|1.6|9928|2
SUB|Surabaia|Indonesia|ID|-7.38|112.79|9.8|0.50|0.7|9843|3
UPG|Macassar|Indonesia|ID|-5.06|119.55|2.7|0.48|0.9|10171|2
KNO|Medan|Indonesia|ID|3.64|98.87|4.7|0.48|0.9|12139|2
VTE|Vientiane|Laos|LA|17.99|102.56|0.9|0.32|1.1|10499|1
MLE|Male|Maldivas|MV|4.19|73.53|0.2|0.75|2.2|10826|2
COK|Kochi|India|IN|10.15|76.40|2.3|0.48|1.6|11155|2
AMD|Amedabade|India|IN|23.08|72.63|8.4|0.50|0.7|11447|3
PNQ|Pune|India|IN|18.58|73.92|7.0|0.55|0.7|8284|2
GOI|Goa|India|IN|15.38|73.83|0.6|0.52|2.0|11319|2
JAI|Jaipur|India|IN|26.82|75.80|4.1|0.45|1.5|9187|2
LKO|Lucknow|India|IN|26.76|80.88|3.7|0.42|0.9|9000|2
TRV|Trivandrum|India|IN|8.48|76.92|1.7|0.45|1.3|11155|2
LHE|Lahore|Paquistao|PK|31.52|74.40|13.0|0.35|0.8|11024|2
NQZ|Astana|Cazaquistao|KZ|51.02|71.47|1.3|0.68|0.7|11483|2
TBS|Tiblisi|Georgia|GE|41.67|44.95|1.2|0.55|1.3|9843|2
EVN|Erevan|Armenia|AM|40.15|44.40|1.1|0.50|1.1|12467|2
GYD|Baku|Azerbaijao|AZ|40.47|50.05|2.3|0.70|1.0|10827|2
OOL|Gold Coast|Australia|AU|-28.16|153.50|0.7|1.05|1.8|7700|2
CNS|Cairns|Australia|AU|-16.89|145.75|0.2|0.98|1.9|10499|2
HBA|Hobart|Australia|AU|-42.84|147.51|0.2|1.00|1.4|7382|1
CBR|Camberra|Australia|AU|-35.31|149.20|0.5|1.15|0.8|10827|2
DRW|Darwin|Australia|AU|-12.41|130.88|0.2|0.95|1.2|11004|1
WLG|Wellington|Nova Zelandia|NZ|-41.33|174.81|0.4|1.05|1.0|6350|2
ZQN|Queenstown|Nova Zelandia|NZ|-45.02|168.74|0.1|1.00|2.1|6234|1
PPT|Papeete|Polinesia Francesa|PF|-17.56|-149.61|0.1|0.85|2.1|11220|2
NOU|Noumea|Nova Caledonia|NC|-22.01|166.21|0.2|0.90|1.7|10171|1
GUM|Guam|Guam|GU|13.48|144.80|0.2|0.95|1.6|12000|2
`.trim()

const SLOTS_BY_TIER: Record<number, number> = { 1: 90, 2: 200, 3: 420, 4: 780, 5: 1300 }

export const AIRPORTS: Airport[] = RAW.split('\n').map((line) => {
  const [iata, city, country, cc, lat, lon, pop, gdp, tour, runway, tier] = line.split('|')
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
    tier: t,
    slots: SLOTS_BY_TIER[t],
    name: `${city} (${iata})`,
    official: AIRPORT_NAMES[iata] ?? `${city} (${iata})`,
  } as Airport
})

export const AIRPORT_BY_IATA: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.iata, a]),
)

/** Aeroportos que podem ser escolhidos como base inicial. */
export const STARTER_HUBS = AIRPORTS.filter((a) => a.tier >= 3).map((a) => a.iata)
