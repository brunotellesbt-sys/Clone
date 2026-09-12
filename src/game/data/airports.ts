// Aeroportos.
//
// Entra aqui todo aeroporto com serviço aéreo regular, sigla IATA de três letras
// e pista firme de pelo menos 4.400 ft — a pista que o ATR 72 pede no catálogo
// do próprio jogo. O critério é esse e não "aeroporto grande" porque o que
// interessa é onde a frota do jogo **pode pousar**: a menor aeronave de linha
// dela define o piso, e a lista fica com 3.085 destinos em 231 países.
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
HND|Toquio|Japao|JP|35.55|139.79|37.40|1.40|1.50|11024|5
NRT|Toquio|Japao|JP|35.77|140.39|37.40|1.30|1.80|13123|5
CGK|Jacarta|Indonesia|ID|-6.13|106.66|33.40|0.60|1.00|12008|5
DEL|Nova Delhi|India|IN|28.56|77.10|32.90|0.55|1.20|14534|5
PVG|Xangai|China|CN|31.14|121.81|29.20|1.05|1.30|13123|5
ICN|Seul|Coreia do Sul|KR|37.47|126.45|25.60|1.25|1.50|13123|5
GRU|Sao Paulo|Brasil|BR|-23.43|-46.47|22.40|0.78|1.00|12139|5
MEX|Cidade do Mexico|Mexico|MX|19.44|-99.07|22.00|0.72|1.40|12966|5
PEK|Pequim|China|CN|40.08|116.60|22.00|0.95|1.40|12467|5
BOM|Mumbai|India|IN|19.09|72.87|21.70|0.62|1.10|11511|5
JFK|Nova York|EUA|US|40.64|-73.78|20.10|1.45|2.00|14511|5
CAN|Guangzhou|China|CN|23.39|113.30|18.70|0.95|0.90|12467|5
BKK|Banguecoque|Tailandia|TH|13.68|100.75|17.40|0.70|2.10|13123|5
IST|Istambul|Turquia|TR|41.27|28.73|16.00|0.80|1.80|13451|5
LHR|Londres|Reino Unido|GB|51.47|-0.46|14.30|1.45|2.00|12799|5
LAX|Los Angeles|EUA|US|33.94|-118.41|13.20|1.40|1.90|12894|5
CDG|Paris|Franca|FR|49.01|2.55|13.00|1.35|2.10|13829|5
ORD|Chicago|EUA|US|41.98|-87.90|9.50|1.30|1.20|13000|5
DFW|Dallas|EUA|US|32.90|-97.04|7.90|1.30|0.90|13401|5
HKG|Hong Kong|Hong Kong|HK|22.31|113.91|7.50|1.35|1.70|12467|5
MAD|Madri|Espanha|ES|40.49|-3.57|6.80|1.10|1.60|14271|5
YYZ|Toronto|Canada|CA|43.68|-79.63|6.40|1.25|1.20|11120|5
ATL|Atlanta|EUA|US|33.64|-84.43|6.30|1.25|0.90|12390|5
MIA|Miami|EUA|US|25.80|-80.29|6.20|1.20|2.00|13016|5
SIN|Singapura|Singapura|SG|1.35|103.99|6.00|1.50|1.70|13123|5
FRA|Frankfurt|Alemanha|DE|50.03|8.56|5.80|1.40|1.10|13123|5
SYD|Sydney|Australia|AU|-33.95|151.18|5.40|1.40|1.90|12999|5
FCO|Roma|Italia|IT|41.80|12.25|4.30|1.10|2.10|12801|5
DXB|Dubai|Emirados|AE|25.25|55.37|3.60|1.35|2.20|14590|5
MUC|Munique|Alemanha|DE|48.35|11.79|3.00|1.40|1.40|13123|5
AMS|Amsterda|Holanda|NL|52.31|4.76|2.90|1.40|1.80|12467|5
DOH|Doha|Catar|QA|25.27|51.61|2.40|1.45|1.30|15912|5
NLU|Cidade do Mexico|Mexico|MX|19.74|-99.02|32.14|0.72|1.40|14764|4
SHA|Xangai|China|CN|31.20|121.33|29.20|1.00|0.90|11154|4
NMI|Mumbai|India|IN|18.98|73.07|25.79|0.62|1.10|12139|4
GMP|Seul|Coreia do Sul|KR|37.56|126.79|25.60|1.20|1.00|11811|4
MNL|Manila|Filipinas|PH|14.51|121.02|24.90|0.55|1.20|12261|4
WUX|Wuxi|China|CN|31.50|120.43|23.66|0.80|1.00|10499|4
PKX|Pequim|China|CN|39.50|116.41|22.00|0.90|1.00|12467|4
CTU|Chengdu|China|CN|30.56|103.95|21.40|0.80|1.00|11811|4
CAI|Cairo|Egito|EG|30.11|31.40|21.30|0.50|1.70|13124|4
DXN|Nova Delhi|India|IN|28.18|77.61|20.83|0.55|1.20|12975|4
EWR|Nova York|EUA|US|40.69|-74.17|20.10|1.40|1.50|11000|4
KIX|Osaka|Japao|JP|34.43|135.24|19.10|1.25|1.50|13123|4
SZX|Shenzhen|China|CN|22.64|113.80|17.60|1.05|0.80|12467|4
SVO|Moscou|Russia|RU|55.98|37.41|17.30|0.75|0.90|12139|4
CKG|Chongqing|China|CN|29.71|106.65|16.90|0.72|0.90|12467|4
FIH|Kinshasa|Congo (Kinshasa)|CD|-4.39|15.44|16.83|0.22|0.50|13123|4
EZE|Buenos Aires|Argentina|AR|-34.82|-58.54|15.40|0.70|1.50|10827|4
ONT|Los Angeles|EUA|US|34.06|-117.60|15.18|1.40|1.90|12197|4
LGW|Londres|Reino Unido|GB|51.15|-0.19|14.30|1.30|1.60|10883|4
BLR|Bangalore|India|IN|13.20|77.71|13.60|0.65|0.80|13123|4
GIG|Rio de Janeiro|Brasil|BR|-22.81|-43.25|13.50|0.72|1.90|13123|4
BOG|Bogota|Colombia|CO|4.70|-74.15|11.30|0.68|1.10|12467|4
HFE|Hefei|China|CN|31.99|116.98|11.19|0.80|1.00|11155|4
INC|Yinchuan|China|CN|38.32|106.39|10.70|0.80|1.00|11811|4
LIM|Lima|Peru|PE|-12.02|-77.11|10.70|0.65|1.50|11506|4
JNB|Joanesburgo|Africa do Sul|ZA|-26.14|28.25|10.50|0.65|1.10|14495|4
BGW|Baghdad|Iraque|IQ|33.26|44.23|10.48|0.38|0.50|13124|4
SWA|Jieyang|China|CN|23.55|116.50|10.41|0.80|1.00|10499|4
CGO|Zhengzhou|China|CN|34.53|113.85|9.46|0.80|1.00|11155|4
SGN|Ho Chi Minh|Vietna|VN|10.82|106.65|9.30|0.60|1.40|12468|4
TNA|Jinan|China|CN|36.86|117.22|8.83|0.80|1.00|11812|4
HAN|Hanoi|Vietna|VN|21.22|105.81|8.50|0.58|1.30|12466|4
KUL|Kuala Lumpur|Malasia|MY|2.75|101.71|8.40|0.80|1.40|13530|4
JHB|Johor Bahru|Malasia|MY|1.64|103.67|8.08|0.72|1.50|12467|4
RUH|Riade|Arabia Saudita|SA|24.96|46.70|8.00|1.10|0.70|13796|4
YNT|Yantai|China|CN|37.66|120.98|7.57|0.80|1.00|11155|4
ZUH|Zhuhai|China|CN|22.01|113.38|7.53|0.80|1.00|13517|4
SJW|Shijiazhuang|China|CN|38.28|114.70|7.23|0.80|1.00|11155|4
IAH|Houston|EUA|US|29.98|-95.34|7.10|1.30|0.80|12001|4
SCL|Santiago|Chile|CL|-33.39|-70.79|7.10|0.90|1.30|12303|4
TPE|Taipe|Taiwan|TW|25.08|121.23|7.00|1.15|1.30|12008|4
IAD|Washington|EUA|US|38.94|-77.46|6.40|1.45|1.30|11500|4
BCN|Barcelona|Espanha|ES|41.30|2.08|5.60|1.10|2.00|11000|4
ADD|Adis Abeba|Etiopia|ET|8.98|38.80|5.20|0.35|0.80|12467|4
MEL|Melbourne|Australia|AU|-37.67|144.84|5.20|1.35|1.40|11998|4
MXP|Milao|Italia|IT|45.63|8.73|5.10|1.25|1.40|12861|4
BOS|Boston|EUA|US|42.36|-71.01|4.90|1.45|1.20|10083|4
BSB|Brasilia|Brasil|BR|-15.87|-47.92|4.80|0.95|0.80|10827|4
BER|Berlim|Alemanha|DE|52.36|13.50|4.70|1.20|1.40|13123|4
JED|Jeda|Arabia Saudita|SA|21.68|39.16|4.70|1.00|1.50|13123|4
SFO|Sao Francisco|EUA|US|37.62|-122.37|4.70|1.60|1.60|11870|4
TLV|Tel Aviv|Israel|IL|32.01|34.89|4.20|1.30|1.30|13327|4
SEA|Seattle|EUA|US|47.45|-122.31|4.00|1.45|1.20|11901|4
ATH|Atenas|Grecia|GR|37.94|23.94|3.80|0.90|2.10|13123|4
DEN|Denver|EUA|US|39.86|-104.67|3.00|1.25|1.20|16000|4
LIS|Lisboa|Portugal|PT|38.78|-9.14|2.90|0.95|1.90|12500|4
CLT|Charlotte|EUA|US|35.21|-80.94|2.70|1.20|0.80|10000|4
MCO|Orlando|EUA|US|28.43|-81.31|2.70|1.05|2.20|12005|4
BNE|Brisbane|Australia|AU|-27.38|153.12|2.60|1.30|1.40|11680|4
YVR|Vancouver|Canada|CA|49.19|-123.18|2.60|1.30|1.50|11500|4
LAS|Las Vegas|EUA|US|36.08|-115.15|2.30|1.10|2.20|14835|4
CPH|Copenhague|Dinamarca|DK|55.62|12.66|2.10|1.40|1.30|11811|4
VIE|Viena|Austria|AT|48.11|16.57|2.00|1.25|1.50|11811|4
PTY|Cidade do Panama|Panama|PA|9.07|-79.38|1.90|0.80|1.20|10006|4
AKL|Auckland|Nova Zelandia|NZ|-37.01|174.79|1.70|1.25|1.70|11926|4
AUH|Abu Dhabi|Emirados|AE|24.44|54.65|1.60|1.40|1.40|13471|4
DUB|Dublin|Irlanda|IE|53.43|-6.26|1.40|1.30|1.40|10203|4
ZRH|Zurique|Suica|CH|47.46|8.55|1.40|1.60|1.40|12139|4
CUN|Cancun|Mexico|MX|21.04|-86.87|0.90|0.65|2.20|11483|4
TLC|Cidade do Mexico|Mexico|MX|19.34|-99.57|31.88|0.72|1.40|13780|3
TFU|Chengdu|China|CN|30.31|104.44|22.95|0.80|1.00|13123|3
DAC|Daca|Bangladesh|BD|23.84|90.40|22.50|0.35|0.50|11500|3
CGH|Sao Paulo|Brasil|BR|-23.63|-46.65|22.40|0.85|0.80|6365|3
HLP|Jacarta|Indonesia|ID|-6.27|106.89|21.99|0.60|1.00|9843|3
SPX|Cairo|Egito|EG|30.11|30.90|20.88|0.50|1.70|11975|3
HLA|Joanesburgo|Africa do Sul|ZA|-25.94|27.93|20.58|0.65|1.10|9996|3
LGA|Nova York|EUA|US|40.78|-73.87|20.10|1.40|1.20|7002|3
ITM|Osaka|Japao|JP|34.78|135.44|19.10|1.30|1.00|9840|3
CZX|Changzhou|China|CN|31.92|119.78|18.16|0.80|1.00|11155|3
DMK|Banguecoque|Tailandia|TH|13.91|100.61|17.40|0.60|1.50|12139|3
SAW|Istambul|Turquia|TR|40.90|29.31|16.00|0.70|1.20|11614|3
WEF|Weifang|China|CN|36.65|119.12|15.77|0.80|1.00|8530|3
TSA|Taipe|Taiwan|TW|25.07|121.55|15.61|1.15|1.30|8547|3
LOS|Lagos|Nigeria|NG|6.58|3.32|15.40|0.45|0.60|12794|3
CCU|Calcuta|India|IN|22.65|88.45|15.30|0.45|0.80|11919|3
LGB|Los Angeles|EUA|US|33.82|-118.15|15.05|1.40|1.90|10000|3
SZB|Kuala Lumpur|Malasia|MY|3.13|101.55|14.85|0.80|1.40|12401|3
TSN|Tianjin|China|CN|39.12|117.35|13.90|0.80|0.70|11811|3
ORY|Paris|Franca|FR|48.73|2.36|13.00|1.25|1.40|11975|3
XIY|Xian|China|CN|34.44|108.76|13.00|0.75|1.20|12467|3
DME|Moscou Domodedovo|Russia|RU|55.41|37.91|12.60|0.72|0.80|11483|3
WUH|Wuhan|China|CN|30.77|114.21|12.30|0.78|0.80|11811|3
IBR|Toquio|Japao|JP|36.18|140.41|12.26|1.30|1.80|8858|3
HGH|Hangzhou|China|CN|30.24|120.43|11.90|0.82|1.20|11811|3
MAA|Chennai|India|IN|12.99|80.17|11.50|0.55|0.80|12001|3
DUS|Dusseldorf|Alemanha|DE|51.29|6.77|11.30|1.10|0.80|9842|3
CSX|Changsha|China|CN|28.19|113.22|10.50|0.75|0.80|12467|3
HYD|Hyderabad|India|IN|17.23|78.43|10.50|0.60|0.80|13976|3
SUB|Surabaia|Indonesia|ID|-7.38|112.79|9.80|0.50|0.70|9843|3
STN|Londres Stansted|Reino Unido|GB|51.88|0.23|9.50|1.05|1.10|10003|3
NGO|Nagoia|Japao|JP|34.86|136.80|9.40|1.20|0.90|11483|3
NKG|Nanquim|China|CN|31.74|118.87|9.30|0.82|1.00|11811|3
TAO|Qingdao|China|CN|36.36|120.09|9.00|0.82|1.10|11811|3
DWC|Dubai|Emirados|AE|24.90|55.16|8.80|1.35|2.20|14764|3
KMG|Kunming|China|CN|25.11|102.94|8.50|0.70|1.20|14764|3
AMD|Amedabade|India|IN|23.08|72.63|8.40|0.50|0.70|11499|3
AVV|Melbourne|Australia|AU|-38.04|144.47|8.30|1.35|1.40|10000|3
YTY|Yangzhou|China|CN|32.56|119.72|7.99|0.80|1.00|10499|3
YIW|Yiwu/Jinhua|China|CN|29.34|120.03|7.87|0.80|1.00|9843|3
NTG|Nantong|China|CN|32.07|120.98|7.78|0.80|1.00|11155|3
GYY|Chicago|EUA|US|41.62|-87.41|7.72|1.30|1.20|8859|3
LYP|Faisalabad|Paquistao|PK|31.36|73.00|7.42|0.40|0.60|9324|3
XUZ|Xuzhou|China|CN|34.06|117.56|7.42|0.80|1.00|11548|3
TYN|Taiyuan|China|CN|37.75|112.63|6.77|0.80|1.00|11811|3
ZNZ|Zanzibar|Tanzania|TZ|-6.22|39.22|6.59|0.32|1.45|9915|3
DSS|Dakar|Senegal|SN|14.67|-17.07|6.54|0.35|1.00|11483|3
NGB|Ningbo|China|CN|29.83|121.46|6.50|0.80|1.00|10499|3
JNG|Jining|China|CN|35.65|116.74|6.35|0.80|1.00|9186|3
STV|Surat|India|IN|21.12|72.74|6.31|0.52|0.90|9530|3
DAL|Dallas|EUA|US|32.84|-96.85|6.27|1.30|0.90|8800|3
FLL|Fort Lauderdale|Estados Unidos|US|26.07|-80.15|6.20|1.05|1.60|9000|3
PHL|Filadelfia|EUA|US|39.87|-75.24|6.20|1.20|1.00|12000|3
CJB|Coimbatore|India|IN|11.03|77.04|6.13|0.52|0.90|8480|3
NNG|Nanning|China|CN|22.60|108.18|6.11|0.80|1.00|10499|3
CGQ|Changchun|China|CN|44.00|125.68|6.10|0.80|1.00|10500|3
SKT|Sialkot|Paquistao|PK|32.54|74.36|6.07|0.40|0.60|11811|3
BWI|Washington|EUA|US|39.18|-76.67|6.03|1.45|1.30|10503|3
CNF|Belo Horizonte|Brasil|BR|-19.64|-43.97|6.00|0.75|0.80|11811|3
PEW|Peshawar|Paquistao|PK|33.99|71.51|5.95|0.40|0.60|9000|3
BFY|Bengbu|China|CN|33.17|117.06|5.85|0.80|1.00|8530|3
SJC|Sao Francisco|EUA|US|37.36|-121.93|5.82|1.60|1.60|11000|3
HBE|Alexandria|Egito|EG|30.93|29.70|5.80|0.45|2.00|11156|3
FNJ|Pyongyang|Coreia do Norte|KP|39.22|125.67|5.71|0.25|0.50|11490|3
FUK|Fukuoka|Japao|JP|33.59|130.45|5.60|1.20|1.20|9186|3
LED|Sao Petersburgo|Russia|RU|59.80|30.26|5.60|0.70|1.20|12402|3
CJJ|Cheongju|Coreia do Sul|KR|36.72|127.50|5.33|1.12|1.30|9000|3
GDL|Guadalajara|Mexico|MX|20.52|-103.31|5.30|0.70|1.00|13123|3
MTY|Monterrey|Mexico|MX|25.78|-100.11|5.30|0.78|0.70|9843|3
NBO|Nairobi|Quenia|KE|-1.32|36.93|5.30|0.45|1.50|13507|3
PBC|Puebla|Mexico|MX|19.16|-98.37|5.29|0.69|1.30|11811|3
SJK|Sao Paulo|Brasil|BR|-23.23|-45.86|5.27|0.78|1.00|8780|3
XMN|Xiamen|China|CN|24.54|118.13|5.20|0.85|1.20|11155|3
CGP|Chattogram|Bangladesh|BD|22.25|91.81|5.12|0.35|0.50|9646|3
YEI|Yenisehir|Turquia|TR|40.26|29.56|5.10|0.65|1.30|9818|3
RMQ|Taichung|Taiwan|TW|24.26|120.62|5.09|1.07|1.15|12000|3
PHX|Phoenix|EUA|US|33.44|-112.01|5.00|1.15|1.10|11489|3
KAN|Kano|Nigeria|NG|12.05|8.52|4.99|0.47|0.55|10831|3
YHM|Toronto|Canada|CA|43.17|-79.93|4.94|1.25|1.20|10006|3
BAV|Baotou|China|CN|40.56|110.00|4.93|0.80|1.00|9186|3
KRT|Khartoum|Sudao|SD|15.59|32.55|4.84|0.24|0.50|9751|3
HIA|Huai'an|China|CN|33.79|119.13|4.82|0.80|1.00|9186|3
VCA|Can Tho|Vietna|VN|10.08|105.71|4.81|0.58|1.40|9843|3
CPT|Cidade do Cabo|Africa do Sul|ZA|-33.97|18.60|4.80|0.70|2.00|10502|3
BKO|Bamako|Mali|ML|12.53|-7.95|4.78|0.24|0.60|10498|3
KBL|Kabul|Afeganistao|AF|34.57|69.21|4.71|0.22|0.50|11483|3
LHW|Lanzhou|China|CN|36.52|103.62|4.65|0.80|1.00|13123|3
HPH|Haiphong|Vietna|VN|20.82|106.72|4.60|0.58|1.40|10007|3
SRG|Semarang|Indonesia|ID|-6.97|110.37|4.57|0.50|0.90|8399|3
KWE|Guiyang|China|CN|26.54|106.80|4.51|0.80|1.00|13123|3
BZV|Brazzaville|Congo (Brazzaville)|CG|-4.25|15.25|4.46|0.32|0.60|10827|3
CKY|Conakry|Guine|GN|9.58|-13.61|4.41|0.24|0.50|10826|3
CMN|Casablanca|Marrocos|MA|33.37|-7.59|4.40|0.60|1.30|12205|3
DTW|Detroit|EUA|US|42.21|-83.35|4.40|1.05|0.70|12003|3
POA|Porto Alegre|Brasil|BR|-29.99|-51.17|4.40|0.80|0.90|10499|3
RBA|Rabat|Marrocos|MA|34.05|-6.75|4.40|0.54|1.65|11483|3
CCJ|Calicut|India|IN|11.14|75.96|4.39|0.52|0.90|9383|3
VLN|Valencia|Venezuela|VE|10.15|-67.93|4.33|0.45|0.70|9842|3
YUL|Montreal|Canada|CA|45.47|-73.74|4.30|1.15|1.20|11000|3
FOC|Fuzhou|China|CN|25.93|119.67|4.29|0.80|1.00|11811|3
HWR|Halwara|India|IN|30.75|75.63|4.28|0.52|0.90|10007|3
PHC|Port Harcourt|Nigeria|NG|5.02|6.95|4.22|0.47|0.55|9843|3
FOR|Fortaleza|Brasil|BR|-3.78|-38.53|4.10|0.60|1.50|9039|3
REC|Recife|Brasil|BR|-8.13|-34.92|4.10|0.65|1.60|9865|3
HAK|Haikou|China|CN|19.93|110.46|4.09|0.80|1.00|11811|3
HIJ|Hiroshima|Japao|JP|34.44|132.92|4.07|1.23|1.50|9842|3
BTH|Batam|Indonesia|ID|1.12|104.12|4.05|0.50|0.90|13218|3
SLW|Saltillo|Mexico|MX|25.54|-100.93|4.04|0.69|1.30|9506|3
ATQ|Amritsar|India|IN|31.71|74.80|3.92|0.52|0.90|12000|3
WNZ|Wenzhou|China|CN|27.91|120.85|3.92|0.80|1.00|10499|3
SSA|Salvador|Brasil|BR|-12.91|-38.32|3.90|0.62|1.70|9859|3
CWB|Curitiba|Brasil|BR|-25.53|-49.18|3.70|0.82|0.80|7277|3
MSP|Minneapolis|EUA|US|44.88|-93.22|3.70|1.25|0.80|11006|3
VGA|Vijayawada|India|IN|16.53|80.80|3.57|0.52|0.90|11023|3
IXC|Chandigarh|India|IN|30.67|76.79|3.56|0.52|0.90|12467|3
SDQ|Santo Domingo|Republica Dominicana|DO|18.43|-69.67|3.50|0.48|1.40|11000|3
BDQ|Vadodara|India|IN|22.34|73.23|3.49|0.52|0.90|8100|3
HET|Hohhot|China|CN|40.85|111.82|3.45|0.80|1.00|11811|3
AKR|Akure|Nigeria|NG|7.25|5.30|3.43|0.47|0.55|9195|3
PUS|Busan|Coreia do Sul|KR|35.18|128.94|3.40|1.05|1.10|10499|3
NAG|Nagpur|India|IN|21.09|79.05|3.37|0.52|0.90|10500|3
TRN|Caselle Torinese|Italia|IT|45.20|7.65|3.37|1.00|1.40|10827|3
LYI|Linyi|China|CN|35.05|118.41|3.33|0.80|1.00|10498|3
SDJ|Natori|Japao|JP|38.14|140.92|3.31|1.23|1.50|9842|3
AGR|Agra|India|IN|27.16|77.96|3.30|0.52|0.90|9000|3
SAN|San Diego|EUA|US|32.73|-117.19|3.30|1.30|1.40|9401|3
VCP|Campinas|Brasil|BR|-23.01|-47.13|3.30|0.80|0.70|10630|3
BFI|Seattle|EUA|US|47.53|-122.30|3.29|1.45|1.20|10007|3
TPA|Tampa|Estados Unidos|US|27.98|-82.53|3.20|1.02|1.30|11002|3
DAT|Datong|China|CN|40.06|113.48|3.18|0.80|1.00|9843|3
EHU|Ezhou|China|CN|30.34|115.04|3.13|0.80|1.00|11811|3
ABB|Asaba|Nigeria|NG|6.20|6.67|3.10|0.47|0.55|11155|3
HAM|Hamburgo|Alemanha|DE|53.63|9.99|3.10|1.12|1.00|12028|3
PVD|Providence/Warwick|EUA|US|41.73|-71.43|3.10|1.10|1.10|8700|3
WAW|Varsovia|Polonia|PL|52.17|20.97|3.10|0.90|1.00|12106|3
XNN|Haidong|China|CN|36.53|102.04|2.98|0.80|1.00|12467|3
BJC|Denver|EUA|US|39.91|-105.12|2.94|1.25|1.20|9000|3
BHX|Birmingham|Reino Unido|GB|52.45|-1.75|2.90|0.95|0.80|10013|3
COV|Tarsus|Turquia|TR|36.89|35.07|2.90|0.65|1.30|11482|3
YCU|Yuncheng|China|CN|35.12|111.03|2.90|0.80|1.00|10499|3
HIN|Sacheon|Coreia do Sul|KR|35.09|128.07|2.83|1.12|1.30|9000|3
BJX|Silao|Mexico|MX|20.99|-101.48|2.80|0.69|1.30|11483|3
MAN|Manchester|Reino Unido|GB|53.35|-2.28|2.80|1.05|1.00|10007|3
DSN|Ordos|China|CN|39.49|109.86|2.73|0.80|1.00|10499|3
MWX|Muan|Coreia do Sul|KR|34.99|126.38|2.71|1.12|1.30|9186|3
PRG|Praga|Chequia|CZ|50.10|14.26|2.70|0.95|1.70|12189|3
STR|Stuttgart|Alemanha|DE|48.69|9.22|2.70|1.15|0.80|10974|3
DOY|Dongying|China|CN|37.50|118.79|2.62|0.80|1.00|9186|3
CTS|Sapporo|Japao|JP|42.77|141.69|2.60|1.15|1.70|9843|3
XFN|Xiangyang|China|CN|32.15|112.29|2.58|0.80|1.00|8530|3
TEQ|Istambul|Turquia|TR|41.14|27.92|2.53|0.70|1.20|9844|3
BUD|Budapeste|Hungria|HU|47.43|19.26|2.50|0.85|1.60|12162|3
PDX|Portland|Estados Unidos|US|45.59|-122.60|2.50|1.10|1.00|11000|3
KHN|Nanchang|China|CN|28.86|115.90|2.46|0.80|1.00|11155|3
HAJ|Hannover|Alemanha|DE|52.46|9.69|2.45|1.15|1.00|12434|3
KOJ|Kagoshima|Japao|JP|31.80|130.72|2.45|1.23|1.50|9840|3
ARN|Estocolmo|Suecia|SE|59.65|17.93|2.40|1.35|1.20|10830|3
SJU|San Juan|Porto Rico|PR|18.44|-66.00|2.40|0.85|1.90|10002|3
SMF|Sacramento|EUA|US|38.70|-121.59|2.37|1.10|1.10|8605|3
CQW|Wulong|China|CN|29.47|107.69|2.31|0.80|1.00|9186|3
AUS|Austin|Estados Unidos|US|30.20|-97.66|2.30|1.15|1.10|12250|3
LYS|Lyon|Franca|FR|45.73|5.09|2.30|1.05|1.00|13124|3
LGG|Grace-Hollogne|Belgica|BE|50.64|5.44|2.26|1.30|1.10|12106|3
PER|Perth|Australia|AU|-31.94|115.97|2.20|1.35|1.00|11299|3
SJO|San Jose|Costa Rica|CR|9.99|-84.21|2.20|0.62|1.90|9882|3
TIJ|Tijuana|Mexico|MX|32.54|-116.97|2.20|0.68|0.90|9711|3
FKS|Sukagawa|Japao|JP|37.23|140.43|2.19|1.23|1.50|8202|3
KMQ|Kanazawa|Japao|JP|36.39|136.41|2.14|1.23|1.50|8876|3
BRU|Bruxelas|Belgica|BE|50.90|4.48|2.10|1.30|1.10|11936|3
DJT|Miami|EUA|US|26.68|-80.10|2.07|1.20|2.00|10001|3
WJU|Wonju|Coreia do Sul|KR|37.44|127.96|2.07|1.12|1.30|9000|3
BDL|Hartford|EUA|US|41.94|-72.69|2.01|1.10|1.10|9510|3
BNA|Nashville|Estados Unidos|US|36.12|-86.68|2.00|1.05|1.30|11030|3
KUV|Gunsan|Coreia do Sul|KR|35.90|126.62|1.94|1.12|1.30|9000|3
SCK|Stockton|EUA|US|37.89|-121.24|1.93|1.10|1.10|10245|3
KIJ|Niigata|Japao|JP|37.95|139.11|1.90|1.23|1.50|8200|3
OPO|Porto|Portugal|PT|41.25|-8.68|1.70|0.90|1.50|11417|3
DMM|Dammam|Arabia Saudita|SA|26.47|49.80|1.60|0.95|0.70|13124|3
MCT|Mascate|Oma|OM|23.60|58.29|1.60|0.95|1.30|13386|3
YYC|Calgary|Canada|CA|51.12|-114.01|1.60|1.30|1.00|14000|3
DIA|Doha|Catar|QA|25.26|51.57|1.57|1.45|1.30|15000|3
PSM|Boston|EUA|US|43.08|-70.82|1.56|1.45|1.20|11321|3
HEL|Helsinque|Finlandia|FI|60.32|24.96|1.50|1.30|1.10|11483|3
MED|Medina|Arabia Saudita|SA|24.55|39.71|1.50|0.85|2.00|14222|3
OSL|Oslo|Noruega|NO|60.19|11.10|1.50|1.50|1.20|11811|3
AYT|Antalya|Turquia|TR|36.90|30.80|1.30|0.62|2.20|11155|3
SLC|Salt Lake City|Estados Unidos|US|40.79|-111.98|1.30|1.08|1.00|12002|3
DAD|Da Nang|Vietna|VN|16.04|108.20|1.20|0.48|1.80|11483|3
DPS|Bali|Indonesia|ID|-8.75|115.17|1.00|0.60|2.20|9790|3
GVA|Genebra|Suica|CH|46.24|6.11|1.00|1.60|1.50|12795|3
HNL|Honolulu|Estados Unidos|US|21.32|-157.93|1.00|1.05|2.20|12360|3
LPA|Las Palmas|Espanha|ES|27.93|-15.39|0.90|0.82|1.90|10171|3
TFS|Tenerife Sul|Espanha|ES|28.04|-16.57|0.90|0.82|2.00|10499|3
VCE|Veneza|Italia|IT|45.51|12.35|0.90|1.00|2.20|10827|3
CJU|Jeju|Coreia do Sul|KR|33.51|126.49|0.70|0.95|2.10|10433|3
PMI|Palma|Espanha|ES|39.55|2.74|0.60|1.00|2.20|10728|3
KEF|Reiquiavique|Islandia|IS|63.99|-22.61|0.20|1.15|2.10|10056|3
PUJ|Punta Cana|Republica Dominicana|DO|18.57|-68.36|0.10|0.50|2.20|10171|3
HDO|Nova Delhi|India|IN|28.71|77.36|28.11|0.55|1.20|9000|2
ZIA|Moscou|Russia|RU|55.55|38.15|22.33|0.75|0.90|15092|2
LTN|Londres|Reino Unido|GB|51.87|-0.37|21.20|1.30|1.60|7093|2
CCE|Cairo|Egito|EG|30.06|31.84|20.91|0.50|1.70|11980|2
KHI|Carachi|Paquistao|PK|24.91|67.16|17.20|0.40|0.50|11155|2
AEP|Buenos Aires|Argentina|AR|-34.56|-58.42|15.40|0.75|1.10|7710|2
SDU|Rio de Janeiro|Brasil|BR|-22.91|-43.16|13.50|0.85|1.40|4341|2
LHE|Lahore|Paquistao|PK|31.52|74.40|13.00|0.35|0.80|11024|2
XSP|Singapura|Singapura|SG|1.42|103.87|12.67|1.50|1.70|6023|2
NKM|Nagoia|Japao|JP|35.26|136.92|11.00|1.20|0.90|8990|2
HRB|Harbin|China|CN|45.62|126.25|10.00|0.68|0.80|11811|2
IKA|Teera|Ira|IR|35.42|51.15|9.50|0.45|0.80|13772|2
MDW|Chicago|EUA|US|41.79|-87.75|9.17|1.30|1.20|6522|2
SHE|Shenyang|China|CN|41.64|123.48|9.10|0.72|0.70|10499|2
MEB|Melbourne|Australia|AU|-37.73|144.90|8.79|1.35|1.40|6302|2
RTM|Amsterda|Holanda|NL|51.96|4.44|8.49|1.40|1.80|7218|2
BVA|Paris|Franca|FR|49.45|2.11|8.36|1.35|2.10|7972|2
LAD|Luanda|Angola|AO|-8.86|13.23|8.30|0.38|0.60|12190|2
LIN|Milao Linate|Italia|IT|45.45|9.28|8.20|1.15|0.90|8012|2
EMA|Birmingham|Reino Unido|GB|52.83|-1.33|7.82|0.95|0.80|9495|2
YCM|Toronto|Canada|CA|43.19|-79.17|7.72|1.25|1.20|5000|2
JJN|Xiamen|China|CN|24.80|118.59|7.67|0.85|1.20|8530|2
LPL|Manchester|Reino Unido|GB|53.33|-2.85|7.63|1.05|1.00|7497|2
WIL|Nairobi|Quenia|KE|-1.32|36.81|7.40|0.45|1.50|5052|2
DLC|Dalian|China|CN|38.97|121.54|7.20|0.80|0.90|10827|2
IBA|Ibadan|Nigeria|NG|7.36|3.98|7.13|0.47|0.55|7875|2
PNQ|Pune|India|IN|18.58|73.92|7.00|0.55|0.70|10000|2
LBA|Leeds, West Yorkshire|Reino Unido|GB|53.87|-1.66|6.82|1.05|1.10|7381|2
OAK|Sao Francisco|EUA|US|37.72|-122.22|6.63|1.60|1.60|10520|2
LBC|Hamburgo|Alemanha|DE|53.81|10.72|6.60|1.12|1.00|6896|2
YMX|Montreal|Canada|CA|45.68|-74.04|6.12|1.15|1.20|12000|2
DCA|Washington|EUA|US|38.85|-77.04|5.91|1.45|1.30|7169|2
ESB|Ancara|Turquia|TR|40.13|33.00|5.70|0.65|0.80|12303|2
SBD|Los Angeles|EUA|US|34.10|-117.24|5.65|1.40|1.90|10000|2
ABJ|Abidjan|Costa do Marfim|CI|5.26|-3.93|5.60|0.35|0.80|9843|2
CMB|Colombo|Sri Lanka|LK|7.18|79.88|5.60|0.45|1.70|10991|2
FTW|Dallas|EUA|US|32.82|-97.36|5.59|1.30|0.90|7502|2
BDO|Bandung|Indonesia|ID|-6.90|107.58|5.52|0.50|0.90|7381|2
CCS|Caracas|Venezuela|VE|10.60|-66.99|5.20|0.45|0.70|11483|2
ACC|Acra|Gana|GH|5.61|-0.17|5.10|0.45|0.80|11165|2
SOD|Campinas|Brasil|BR|-23.48|-47.49|5.08|0.80|0.70|5348|2
YXX|Vancouver|Canada|CA|49.03|-122.36|4.90|1.30|1.50|9600|2
AZA|Phoenix|EUA|US|33.31|-111.65|4.85|1.15|1.10|10401|2
OPF|Miami|EUA|US|25.91|-80.28|4.71|1.20|2.00|8002|2
TAE|Busan|Coreia do Sul|KR|35.89|128.66|4.71|1.05|1.10|9039|2
KNO|Medan|Indonesia|ID|3.64|98.87|4.70|0.48|0.90|12303|2
JBQ|Santo Domingo|Republica Dominicana|DO|18.57|-69.99|4.55|0.48|1.40|5412|2
CRL|Bruxelas|Belgica|BE|50.46|4.46|4.54|1.30|1.10|10023|2
AMM|Ama|Jordania|JO|31.72|35.99|4.50|0.70|1.20|12008|2
URC|Urumqi|China|CN|43.91|87.48|4.50|0.65|1.00|11811|2
PAT|Patna|India|IN|25.59|85.09|4.49|0.52|0.90|6410|2
WMI|Varsovia|Polonia|PL|52.45|20.65|4.38|0.90|1.00|8202|2
YKF|Toronto|Canada|CA|43.46|-80.38|4.29|1.25|1.20|7003|2
CLD|San Diego|EUA|US|33.13|-117.28|4.16|1.30|1.40|4897|2
TVS|Tangshan|China|CN|39.72|118.00|4.11|0.80|1.00|8858|2
JAI|Jaipur|India|IN|26.82|75.81|4.10|0.45|1.50|9177|2
MDE|Medellin|Colombia|CO|6.16|-75.42|4.10|0.65|1.30|11286|2
HOU|Houston|EUA|US|29.65|-95.28|4.05|1.30|0.80|7602|2
PAP|Port-au-Prince|Haiti|HT|18.58|-72.29|3.82|0.22|0.60|9974|2
ABV|Abuja|Nigeria|NG|9.01|7.26|3.80|0.50|0.50|11842|2
CIA|Roma|Italia|IT|41.80|12.60|3.80|1.10|2.10|7226|2
MYJ|Matsuyama|Japao|JP|33.83|132.70|3.80|1.23|1.50|8200|2
KMJ|Fukuoka|Japao|JP|32.84|130.85|3.72|1.20|1.20|9840|2
DUR|Durban|Africa do Sul|ZA|-29.61|31.12|3.70|0.60|1.20|12139|2
LKO|Lucknow|India|IN|26.76|80.89|3.70|0.42|0.90|8996|2
IXM|Madurai|India|IN|9.83|78.09|3.67|0.52|0.90|5990|2
AIP|Adampur|India|IN|31.43|75.76|3.65|0.52|0.90|9039|2
CGN|Colonia|Alemanha|DE|50.87|7.14|3.60|1.08|0.80|12516|2
EBB|Entebbe|Uganda|UG|0.04|32.44|3.60|0.30|1.10|12000|2
HDD|Hyderabad|Paquistao|PK|25.32|68.37|3.58|0.40|0.60|6998|2
OKJ|Osaka|Japao|JP|34.76|133.85|3.58|1.25|1.50|9843|2
RKT|Dubai|Emirados|AE|25.61|55.94|3.56|1.35|2.20|12336|2
HUI|Da Nang|Vietna|VN|16.40|107.70|3.55|0.48|1.80|8775|2
ISB|Islamabade|Paquistao|PK|33.55|72.83|3.50|0.45|0.60|12001|2
CBO|Datu Odin Sinsuat|Filipinas|PH|7.16|124.21|3.42|0.47|1.05|6234|2
ALG|Argel|Argelia|DZ|36.69|3.21|3.40|0.60|0.70|11483|2
MLG|Surabaia|Indonesia|ID|-7.93|112.71|3.38|0.50|0.70|8202|2
VAL|Valenca|Brasil|BR|-13.30|-38.99|3.35|0.68|0.85|5906|2
OIM|Izu Oshima|Japao|JP|34.78|139.36|3.29|1.23|1.50|5905|2
CUF|Levaldigi|Italia|IT|44.55|7.62|3.26|1.00|1.40|6903|2
KWJ|Gwangju|Coreia do Sul|KR|35.12|126.81|3.25|1.12|1.30|9300|2
BMA|Estocolmo|Suecia|SE|59.35|17.94|3.12|1.35|1.20|5472|2
DKR|Dacar|Senegal|SN|14.67|-17.07|3.10|0.35|1.00|11483|2
GYE|Guayaquil|Equador|EC|-2.16|-79.88|3.10|0.52|0.90|9154|2
KWI|Kuwait|Kuwait|KW|29.22|47.97|3.10|1.10|0.60|15026|2
MUX|Multan|Paquistao|PK|30.20|71.42|3.10|0.40|0.60|12353|2
NAP|Napoles|Italia|IT|40.89|14.29|3.10|0.78|1.60|8622|2
FSZ|Makinohara / Shimada|Japao|JP|34.80|138.19|3.08|1.23|1.50|7218|2
KMS|Kumasi|Gana|GH|6.71|-1.59|3.08|0.45|0.80|7612|2
AXF|Bayanhot|China|CN|38.75|105.58|3.02|0.80|1.00|7874|2
ADB|Izmir|Turquia|TR|38.29|27.16|3.00|0.62|1.30|10630|2
CEB|Cebu|Filipinas|PH|10.31|123.98|3.00|0.50|1.70|10860|2
GUA|Cidade da Guatemala|Guatemala|GT|14.58|-90.53|3.00|0.45|1.00|9800|2
KBP|Kiev|Ucrania|UA|50.34|30.89|3.00|0.52|0.90|10827|2
IFN|Isfahan|Ira|IR|32.76|51.88|2.99|0.45|0.80|14425|2
CAT|Lisboa|Portugal|PT|38.72|-9.36|2.98|0.95|1.90|4593|2
GAJ|Higashine|Japao|JP|38.41|140.37|2.98|1.23|1.50|6560|2
MAR|Maracaibo|Venezuela|VE|10.56|-71.73|2.94|0.45|0.70|9843|2
ALP|Aleppo|Siria|SY|36.18|37.23|2.93|0.25|0.50|9547|2
OKD|Sapporo|Japao|JP|43.12|141.38|2.93|1.15|1.70|4920|2
PSD|Port Said|Egito|EG|31.28|32.24|2.93|0.45|2.00|7707|2
QOW|Owerri|Nigeria|NG|5.43|7.21|2.93|0.47|0.55|8858|2
CLO|Cali|Colombia|CO|3.54|-76.38|2.90|0.55|0.90|9842|2
TAS|Tashkent|Uzbequistao|UZ|41.26|69.28|2.90|0.50|0.80|13123|2
MGQ|Mogadishu|Somalia|SO|2.01|45.30|2.88|0.20|0.50|10446|2
KIS|Kisumu|Quenia|KE|-0.09|34.73|2.87|0.45|1.50|10823|2
KAD|Kaduna|Nigeria|NG|10.70|7.32|2.85|0.47|0.55|9843|2
OUA|Ouagadougou|Burquina Faso|BF|12.35|-1.51|2.84|0.26|0.60|9843|2
CWL|Cardiff|Reino Unido|GB|51.40|-3.34|2.82|1.05|1.10|7723|2
KTI|Phnom Penh|Camboja|KH|11.36|104.92|2.82|0.35|1.40|13123|2
NVT|Navegantes|Brasil|BR|-26.88|-48.65|2.81|0.68|0.85|5906|2
STL|St. Louis|Estados Unidos|US|38.75|-90.37|2.80|1.02|0.70|11020|2
TUN|Tunis|Tunisia|TN|36.85|10.23|2.80|0.55|1.30|10499|2
UIO|Quito|Equador|EC|-0.13|-78.35|2.80|0.62|1.20|13445|2
PAE|Seattle|EUA|US|47.91|-122.28|2.79|1.45|1.20|9010|2
MHT|Boston|EUA|US|42.93|-71.44|2.73|1.45|1.20|9250|2
NMA|Namangan|Uzbequistao|UZ|40.98|71.56|2.73|0.50|0.80|10698|2
KCM|Kahramanmaras|Turquia|TR|37.54|36.95|2.71|0.65|1.30|7546|2
GYN|Goiania|Brasil|BR|-16.63|-49.22|2.70|0.72|0.60|7500|2
KHH|Kaohsiung|Taiwan|TW|22.58|120.35|2.70|1.00|1.00|10335|2
MHD|Mashhad|Ira|IR|36.23|59.64|2.70|0.45|0.80|12877|2
UPG|Macassar|Indonesia|ID|-5.08|119.55|2.70|0.48|0.90|10171|2
CNN|Kannur|India|IN|11.92|75.54|2.67|0.52|0.90|10007|2
EDL|Eldoret|Quenia|KE|0.40|35.24|2.62|0.45|1.50|11480|2
TCR|Vagaikulam|India|IN|8.72|78.03|2.62|0.52|0.90|4434|2
MAO|Manaus|Brasil|BR|-3.04|-60.05|2.60|0.58|1.10|8858|2
SAT|San Antonio|Estados Unidos|US|29.53|-98.47|2.60|0.98|1.00|8505|2
MKZ|Malacca|Malasia|MY|2.27|102.25|2.59|0.72|1.50|7005|2
RPR|Raipur|India|IN|21.18|81.74|2.59|0.52|0.90|6414|2
BEK|Bareilly|India|IN|28.42|79.45|2.58|0.52|0.90|9000|2
GZT|Gaziantep|Turquia|TR|36.95|37.48|2.55|0.65|1.30|9842|2
FEZ|Saiss|Marrocos|MA|33.93|-4.98|2.52|0.54|1.65|10499|2
ILR|Ilorin/Ogbomosho|Nigeria|NG|8.44|4.49|2.51|0.47|0.55|10169|2
MJI|Tripoli|Libia|LY|32.89|13.29|2.51|0.40|0.50|11155|2
BEL|Belem|Brasil|BR|-1.38|-48.48|2.50|0.55|1.00|9186|2
BSR|Basra|Iraque|IQ|30.55|47.66|2.50|0.38|0.50|13124|2
DVO|Davao|Filipinas|PH|7.13|125.65|2.50|0.42|0.90|9842|2
QRO|Queretaro|Mexico|MX|20.62|-100.19|2.50|0.69|1.30|11483|2
DAM|Damascus|Siria|SY|33.41|36.52|2.49|0.25|0.50|11811|2
AXM|Armenia|Colombia|CO|4.45|-75.77|2.48|0.55|1.10|7045|2
BHO|Bhopal|India|IN|23.29|77.34|2.45|0.52|0.90|9022|2
RKE|Copenhague|Dinamarca|DK|55.59|12.13|2.45|1.40|1.30|5709|2
TLN|Hyeres, Var|Franca|FR|43.10|6.15|2.45|1.12|1.35|6955|2
EBL|Arbil|Iraque|IQ|36.24|43.95|2.41|0.38|0.50|15748|2
BEY|Beirute|Libano|LB|33.82|35.49|2.40|0.45|1.20|12467|2
PIT|Pittsburgh|Estados Unidos|US|40.49|-80.23|2.40|0.98|0.80|11500|2
FBM|Lubumbashi|Congo (Kinshasa)|CD|-11.59|27.53|2.39|0.22|0.50|10623|2
KLH|Kolhapur|India|IN|16.66|74.29|2.39|0.52|0.90|6332|2
DQA|Daqing|China|CN|46.75|125.14|2.37|0.80|1.00|8530|2
LFW|Lome|Togo|TG|6.17|1.25|2.36|0.26|0.60|9847|2
RJH|Rajshahi|Bangladesh|BD|24.44|88.62|2.36|0.35|0.50|6000|2
YYJ|Vancouver|Canada|CA|48.65|-123.43|2.36|1.30|1.50|7000|2
BRM|Barquisimeto|Venezuela|VE|10.04|-69.36|2.35|0.45|0.70|9350|2
RDP|Durgapur|India|IN|23.62|87.24|2.35|0.52|0.90|9186|2
PIE|Tampa|Estados Unidos|US|27.91|-82.69|2.32|1.02|1.30|9730|2
SKZ|Sukkur|Paquistao|PK|27.72|68.79|2.32|0.40|0.60|9000|2
IPH|Ipoh|Malasia|MY|4.57|101.09|2.31|0.72|1.50|5900|2
TOY|Toyama|Japao|JP|36.65|137.19|2.31|1.23|1.50|6562|2
COK|Kochi|India|IN|10.15|76.40|2.30|0.48|1.60|11155|2
GYD|Baku|Azerbaijao|AZ|40.47|50.05|2.30|0.70|1.00|13123|2
OTP|Bucareste|Romenia|RO|44.57|26.10|2.30|0.75|0.90|11484|2
JSR|Jashore|Bangladesh|BD|23.18|89.16|2.28|0.35|0.50|8000|2
XAI|Xinyang|China|CN|32.54|114.08|2.27|0.80|1.00|8858|2
VNS|Varanasi|India|IN|25.45|82.86|2.26|0.52|0.90|9006|2
GNB|Lyon|Franca|FR|45.36|5.33|2.24|1.05|1.00|10007|2
MJM|Mbuji Mayi|Congo (Kinshasa)|CD|-6.12|23.57|2.23|0.22|0.50|6558|2
YNZ|Yancheng|China|CN|33.43|120.21|2.21|0.80|1.00|9186|2
ALA|Almaty|Cazaquistao|KZ|43.35|77.04|2.20|0.65|0.80|14764|2
BAQ|Barranquilla|Colombia|CO|10.89|-74.78|2.20|0.55|0.80|9842|2
CVG|Cincinnati|Estados Unidos|US|39.05|-84.67|2.20|1.00|0.70|12001|2
MCI|Kansas City|Estados Unidos|US|39.30|-94.71|2.20|1.02|0.70|10801|2
CXJ|Caxias Do Sul|Brasil|BR|-29.20|-51.19|2.19|0.68|0.85|5479|2
AOR|Alor Satar|Malasia|MY|6.19|100.40|2.17|0.72|1.50|9005|2
SAH|Sanaa|Iemen|YE|15.48|44.22|2.17|0.20|0.50|10669|2
HSR|Rajkot|India|IN|22.38|71.04|2.16|0.52|0.90|9974|2
ILO|Cabatuan|Filipinas|PH|10.83|122.49|2.16|0.47|1.05|8202|2
PNY|Puducherry|India|IN|11.97|79.81|2.16|0.52|0.90|4921|2
BNI|Benin|Nigeria|NG|6.32|5.60|2.15|0.47|0.55|7870|2
GWL|Gwalior|India|IN|26.29|78.23|2.15|0.52|0.90|9000|2
KUF|Samara|Russia|RU|53.50|50.16|2.14|0.71|1.05|9846|2
VKG|Rach Gia|Vietna|VN|9.96|105.13|2.14|0.58|1.40|4921|2
IWJ|Masuda|Japao|JP|34.68|131.79|2.13|1.23|1.50|6562|2
PDK|Atlanta|EUA|US|33.88|-84.30|2.11|1.25|0.90|6001|2
BBI|Bhubaneswar|India|IN|20.25|85.81|2.10|0.52|0.90|9003|2
CLE|Cleveland|Estados Unidos|US|41.41|-81.85|2.10|0.95|0.70|9953|2
HAV|Havana|Cuba|CU|22.99|-82.41|2.10|0.40|1.70|13123|2
IND|Indianapolis|Estados Unidos|US|39.72|-86.29|2.10|1.00|0.70|11200|2
ISK|Nashik|India|IN|20.12|73.91|2.10|0.52|0.90|9843|2
JMU|Jiamusi|China|CN|46.84|130.46|2.10|0.80|1.00|8202|2
BHV|Bahawalpur|Paquistao|PK|29.35|71.72|2.09|0.40|0.60|9345|2
MSQ|Minsk|Belarus|BY|53.89|28.04|2.08|0.55|0.70|12139|2
SHS|Jingzhou|China|CN|30.29|112.45|2.08|0.80|1.00|8530|2
COO|Cotonou|Benim|BJ|6.36|2.38|2.07|0.28|0.60|7906|2
SVX|Yekaterinburg|Russia|RU|56.74|60.80|2.07|0.71|1.05|9925|2
TRZ|Tiruchirappalli|India|IN|10.76|78.72|2.06|0.52|0.90|6115|2
STI|Santiago|Republica Dominicana|DO|19.40|-70.60|2.04|0.49|1.80|8595|2
YIA|Yogyakarta|Indonesia|ID|-7.91|110.06|2.04|0.50|0.90|10663|2
NCL|Newcastle upon Tyne, Tyne|Reino Unido|GB|55.04|-1.69|2.01|1.05|1.10|7644|2
CRK|Clark|Filipinas|PH|15.19|120.56|2.00|0.45|0.90|10499|2
VIX|Vitoria|Brasil|BR|-20.26|-40.28|2.00|0.78|0.80|6752|2
CGY|Laguindingan|Filipinas|PH|8.61|124.46|1.99|0.47|1.05|6890|2
DHX|Kediri|Indonesia|ID|-7.75|111.95|1.98|0.50|0.90|10827|2
BLD|Las Vegas|EUA|US|35.95|-114.86|1.97|1.10|2.20|5103|2
FUG|Yingzhou, Fuyang|China|CN|32.88|115.73|1.97|0.80|1.00|7874|2
DIY|Diyarbakir|Turquia|TR|37.89|40.20|1.96|0.65|1.30|11644|2
LYA|Luoyang|China|CN|34.74|112.39|1.96|0.80|1.00|8202|2
ENU|Enegu|Nigeria|NG|6.47|7.56|1.94|0.47|0.55|7879|2
SXR|Srinagar|India|IN|33.99|74.77|1.94|0.52|0.90|12090|2
GRO|Girona|Espanha|ES|41.90|2.76|1.93|0.85|1.90|7874|2
TNG|Tangier|Marrocos|MA|35.73|-5.92|1.93|0.54|1.65|11483|2
SWF|Nova York|EUA|US|41.50|-74.11|1.92|1.40|1.50|11817|2
YIH|Yichang|China|CN|30.55|111.48|1.92|0.80|1.00|10499|2
MMJ|Matsumoto|Japao|JP|36.17|137.92|1.91|1.23|1.50|6560|2
RMU|Corvera|Espanha|ES|37.80|-1.12|1.91|0.85|1.90|9842|2
IXU|Aurangabad|India|IN|19.86|75.40|1.90|0.52|0.90|9314|2
LPB|La Paz|Bolivia|BO|-16.51|-68.19|1.90|0.42|1.30|13123|2
MRS|Marselha|Franca|FR|43.44|5.21|1.90|0.98|1.30|11483|2
MVD|Montevideu|Uruguai|UY|-34.84|-56.03|1.90|0.85|1.10|10499|2
MDL|Mandalay|Mianmar|MM|21.70|95.98|1.89|0.30|0.70|14003|2
HBX|Hubballi|India|IN|15.36|75.08|1.88|0.52|0.90|5479|2
KWL|Guilin|China|CN|25.22|110.04|1.87|0.80|1.00|10499|2
OVB|Novosibirsk|Russia|RU|55.02|82.62|1.87|0.71|1.05|11818|2
GOJ|Nizhny Novgorod|Russia|RU|56.23|43.79|1.86|0.71|1.05|9843|2
MBA|Mombasa|Quenia|KE|-4.03|39.59|1.86|0.45|1.50|10991|2
PSA|Pisa|Italia|IT|43.68|10.39|1.86|1.00|1.40|9820|2
NJF|Najaf|Iraque|IQ|31.99|44.41|1.84|0.38|0.50|9842|2
PLM|Palembang|Indonesia|ID|-2.90|104.70|1.84|0.50|0.90|8202|2
BOH|Bournemouth|Reino Unido|GB|50.78|-1.84|1.83|1.05|1.10|7454|2
NLA|Ndola|Zambia|ZM|-12.97|28.52|1.83|0.32|0.80|11483|2
RJA|Madhurapudi|India|IN|17.11|81.81|1.82|0.52|0.90|10384|2
ORN|Es-Senia|Argelia|DZ|35.62|-0.62|1.81|0.60|0.70|11811|2
TBZ|Tabriz|Ira|IR|38.13|46.24|1.81|0.45|0.80|11825|2
GES|General Santos|Filipinas|PH|6.06|125.10|1.80|0.47|1.05|10587|2
GLA|Glasgow|Reino Unido|GB|55.87|-4.43|1.80|0.92|0.90|8730|2
ORF|Norfolk|EUA|US|36.90|-76.20|1.80|1.10|1.10|9001|2
PEN|Penang|Malasia|MY|5.30|100.28|1.80|0.72|1.50|10997|2
SAL|San Salvador|El Salvador|SV|13.44|-89.06|1.80|0.45|0.90|10500|2
SHJ|Sharjah|Emirados Arabes Unidos|AE|25.33|55.52|1.80|0.95|0.90|13320|2
SPD|Saidpur|Bangladesh|BD|25.76|88.91|1.78|0.35|0.50|6000|2
LXR|Luxor|Egito|EG|25.67|32.71|1.77|0.45|2.00|9843|2
PVU|Salt Lake City|Estados Unidos|US|40.22|-111.72|1.77|1.08|1.00|8603|2
BZL|Barisal|Bangladesh|BD|22.80|90.30|1.76|0.35|0.50|5995|2
RLK|Bayannur|China|CN|40.93|107.74|1.76|0.80|1.00|8530|2
WNS|Nawabashah|Paquistao|PK|26.22|68.39|1.76|0.40|0.60|8999|2
DED|Dehradun|India|IN|30.19|78.18|1.75|0.52|0.90|7000|2
LEJ|Schkeuditz|Alemanha|DE|51.42|12.23|1.75|1.15|1.00|11811|2
MXZ|Meizhou|China|CN|24.26|116.10|1.75|0.80|1.00|7874|2
TAI|Taiz|Iemen|YE|13.69|44.14|1.75|0.20|0.50|10040|2
NBE|Enfidha|Tunisia|TN|36.08|10.44|1.74|0.55|1.30|10827|2
UET|Quetta|Paquistao|PK|30.25|66.94|1.73|0.40|0.60|12001|2
BRE|Bremen|Alemanha|DE|53.05|8.79|1.72|1.15|1.00|8642|2
ROB|Monrovia|Liberia|LR|6.23|-10.36|1.71|0.22|0.50|11000|2
AGA|Agadir|Marrocos|MA|30.32|-9.41|1.70|0.54|1.65|10499|2
BEG|Belgrado|Servia|RS|44.82|20.31|1.70|0.65|1.00|11483|2
BLA|Barcelona|Venezuela|VE|10.11|-64.69|1.70|0.45|0.70|9842|2
SFB|Orlando|EUA|US|28.77|-81.23|1.70|1.05|2.20|11002|2
TRV|Trivandrum|India|IN|8.48|76.92|1.70|0.45|1.30|11148|2
VII|Vinh|Vietna|VN|18.74|105.67|1.70|0.58|1.40|7875|2
BAR|Qionghai|China|CN|19.14|110.45|1.68|0.80|1.00|10499|2
FKB|Rheinmunster|Alemanha|DE|48.78|8.08|1.68|1.15|1.00|9787|2
ATZ|Asyut|Egito|EG|27.05|31.01|1.67|0.45|2.00|9905|2
IXR|Ranchi|India|IN|23.31|85.32|1.64|0.52|0.90|8855|2
CJS|Ciudad Juarez|Mexico|MX|31.64|-106.43|1.63|0.69|1.30|8858|2
HUY|Grimsby, Lincolnshire|Reino Unido|GB|53.58|-0.35|1.63|1.05|1.10|7218|2
PRN|Prishtina|Kosovo|XK|42.57|21.04|1.63|0.48|0.80|9974|2
CAU|Caruaru|Brasil|BR|-8.28|-36.01|1.62|0.68|0.85|5906|2
OST|Oostende|Belgica|BE|51.20|2.87|1.62|1.30|1.10|10499|2
COR|Cordoba|Argentina|AR|-31.31|-64.21|1.60|0.62|0.90|10499|2
FKI|Kisangani|Congo (Kinshasa)|CD|0.48|25.34|1.60|0.22|0.50|11483|2
LIL|Lesquin|Franca|FR|50.57|3.10|1.60|1.12|1.35|9268|2
MKE|Milwaukee|Estados Unidos|US|42.95|-87.90|1.60|0.98|0.70|9990|2
NAT|Natal|Brasil|BR|-5.77|-35.37|1.60|0.58|1.60|9843|2
SYZ|Shiraz|Ira|IR|29.54|52.59|1.60|0.45|0.80|14345|2
VLC|Valencia|Espanha|ES|39.49|-0.48|1.60|0.85|1.40|8858|2
BRI|Bari|Italia|IT|41.14|16.76|1.59|1.00|1.40|9843|2
MYQ|Mysore|India|IN|12.23|76.65|1.59|0.52|0.90|5709|2
USA|Charlotte|EUA|US|35.39|-80.71|1.59|1.20|0.80|7402|2
ASR|Kayseri|Turquia|TR|38.77|35.50|1.58|0.65|1.30|9841|2
LTK|Latakia|Siria|SY|35.40|35.95|1.56|0.25|0.50|9175|2
LXA|Shannan|China|CN|29.30|90.91|1.56|0.80|1.00|13123|2
DRS|Dresden|Alemanha|DE|51.13|13.77|1.55|1.15|1.00|9350|2
JBB|Jember|Indonesia|ID|-8.24|113.69|1.55|0.50|0.90|5594|2
GAY|Gaya|India|IN|24.74|84.95|1.53|0.52|0.90|7500|2
TNJ|Tanjung Pinang-Bintan|Indonesia|ID|0.92|104.53|1.53|0.50|0.90|7380|2
KYA|Konya|Turquia|TR|37.98|32.56|1.52|0.65|1.30|10990|2
RER|Retalhuleu|Guatemala|GT|14.52|-91.70|1.51|0.45|1.00|5065|2
BAH|Manama|Bahrein|BH|26.27|50.64|1.50|1.15|0.90|12979|2
ONX|Cidade do Panama|Panama|PA|9.36|-79.87|1.50|0.80|1.20|8858|2
PAC|Cidade do Panama|Panama|PA|8.97|-79.56|1.50|0.80|1.20|5906|2
RDU|Raleigh|Estados Unidos|US|35.88|-78.79|1.50|1.10|0.80|10000|2
SOF|Sofia|Bulgaria|BG|42.70|23.42|1.50|0.70|1.00|11811|2
SVQ|Sevilha|Espanha|ES|37.42|-5.89|1.50|0.80|1.50|11030|2
CZL|Constantine|Argelia|DZ|36.28|6.62|1.49|0.60|0.70|9843|2
NSI|Yaounde|Camaroes|CM|3.72|11.55|1.48|0.30|0.60|11155|2
BGF|Bangui|Republica Centro-Africana|CF|4.40|18.52|1.47|0.20|0.50|8530|2
GAU|Guwahati|India|IN|26.11|91.59|1.46|0.52|0.90|9000|2
JDH|Jodhpur|India|IN|26.25|73.05|1.46|0.52|0.90|9005|2
NDC|Nanded|India|IN|19.18|77.32|1.46|0.52|0.90|7546|2
RAO|Ribeirao Preto|Brasil|BR|-21.13|-47.77|1.46|0.68|0.85|6890|2
TIR|Tirupati|India|IN|13.63|79.54|1.46|0.52|0.90|12500|2
AVR|Amravati|India|IN|20.81|77.72|1.44|0.52|0.90|6070|2
JOI|Joinville|Brasil|BR|-26.22|-48.80|1.44|0.68|0.85|5381|2
KZN|Kazan|Russia|RU|55.61|49.28|1.44|0.71|1.05|12303|2
TKG|Bandar Lampung|Indonesia|ID|-5.25|105.18|1.44|0.50|0.90|9088|2
CBB|Cochabamba|Bolivia|BO|-17.42|-66.18|1.43|0.46|1.05|12460|2
CMH|Columbus|EUA|US|40.00|-82.89|1.43|1.10|1.10|10114|2
JIU|Jiujiang|China|CN|29.48|115.80|1.43|0.80|1.00|9186|2
JXA|Jixi|China|CN|45.29|131.19|1.43|0.80|1.00|7546|2
MWZ|Mwanza|Tanzania|TZ|-2.45|32.94|1.43|0.32|1.45|10212|2
NDJ|N'Djamena|Chade|TD|12.13|15.03|1.43|0.20|0.50|9186|2
RSU|Yeosu|Coreia do Sul|KR|34.84|127.62|1.43|1.12|1.30|6890|2
AQG|Anqing|China|CN|30.58|117.05|1.42|0.80|1.00|9186|2
CBT|Catumbela|Angola|AO|-12.48|13.49|1.42|0.38|0.60|12139|2
AWA|Hawassa|Etiopia|ET|7.10|38.40|1.41|0.35|0.80|9843|2
KCZ|Nankoku|Japao|JP|33.55|133.67|1.41|1.23|1.50|8203|2
NIM|Niamey|Niger|NE|13.48|2.18|1.41|0.20|0.50|9843|2
SKP|Ilinden|Macedonia do Norte|MK|41.96|21.62|1.41|0.55|0.90|9678|2
VOG|Volgograd|Russia|RU|48.78|44.34|1.41|0.71|1.05|9186|2
ADL|Adelaide|Australia|AU|-34.95|138.53|1.40|1.25|0.90|10171|2
OKA|Okinawa|Japao|JP|26.19|127.64|1.40|1.00|1.90|9840|2
TLS|Toulouse|Franca|FR|43.63|1.36|1.40|1.02|0.90|11483|2
YEG|Edmonton|Canada|CA|53.31|-113.58|1.40|1.02|0.70|11000|2
YOW|Ottawa|Canada|CA|45.32|-75.67|1.40|1.05|0.90|10000|2
GOP|Gorakhpur|India|IN|26.74|83.45|1.39|0.52|0.90|9000|2
KRR|Krasnodar|Russia|RU|45.03|39.17|1.39|0.71|1.05|9835|2
BHY|Beihai|China|CN|21.54|109.29|1.37|0.80|1.00|10499|2
HNA|Hanamaki|Japao|JP|39.43|141.13|1.37|1.23|1.50|8202|2
PLZ|Gqeberha|Africa do Sul|ZA|-33.99|25.62|1.37|0.65|1.20|7087|2
IBE|Ibague|Colombia|CO|4.42|-75.13|1.36|0.55|1.10|5905|2
IXD|Allahabad|India|IN|25.44|81.73|1.36|0.52|0.90|8110|2
TSF|Veneza|Italia|IT|45.65|12.19|1.36|1.00|2.20|7941|2
DBR|Darbhanga|India|IN|26.19|85.92|1.35|0.52|0.90|9000|2
JLG|Jalgaon|India|IN|20.96|75.63|1.35|0.52|0.90|5577|2
LCJ|Lodz|Polonia|PL|51.72|19.40|1.35|0.81|1.10|8202|2
NKC|Nouakchott|Mauritania|MR|18.31|-15.97|1.35|0.30|0.60|11155|2
CEK|Chelyabinsk|Russia|RU|55.30|61.50|1.34|0.71|1.05|10499|2
QRW|Okpe|Nigeria|NG|5.60|5.82|1.33|0.47|0.55|6868|2
HSS|Hisar|India|IN|29.19|75.74|1.31|0.52|0.90|10236|2
MXL|Mexicali|Mexico|MX|32.63|-115.24|1.31|0.69|1.30|8530|2
NDG|Qiqihar|China|CN|47.23|123.91|1.31|0.80|1.00|11811|2
YLX|Yulin|China|CN|22.43|110.12|1.31|0.80|1.00|8530|2
FLN|Florianopolis|Brasil|BR|-27.67|-48.55|1.30|0.85|1.80|7874|2
KGL|Kigali|Ruanda|RW|-1.97|30.14|1.30|0.32|1.00|11483|2
MCZ|Maceio|Brasil|BR|-9.51|-35.79|1.30|0.55|1.60|8537|2
MEM|Memphis|Estados Unidos|US|35.04|-89.98|1.30|0.92|0.80|11120|2
MID|Merida|Mexico|MX|20.93|-89.65|1.30|0.60|1.20|10499|2
NQZ|Astana|Cazaquistao|KZ|51.03|71.47|1.30|0.68|0.70|11484|2
XRY|Jerez de la Frontera|Espanha|ES|36.74|-6.06|1.30|0.85|1.90|7546|2
YQB|Quebec|Canada|CA|46.79|-71.39|1.30|1.10|0.95|9000|2
BGA|Bucaramanga|Colombia|CO|7.13|-73.18|1.29|0.55|1.10|7381|2
JIB|Djibouti City|Djibuti|DJ|11.55|43.16|1.29|0.38|0.70|10335|2
KGA|Kananga|Congo (Kinshasa)|CD|-5.90|22.47|1.29|0.22|0.50|7218|2
KSF|Calden|Alemanha|DE|51.42|9.39|1.29|1.15|1.00|8202|2
PDG|Padang|Indonesia|ID|-0.79|100.28|1.29|0.50|0.90|9843|2
CFB|Cabo Frio|Brasil|BR|-22.92|-42.07|1.28|0.68|0.85|8366|2
CIT|Shymkent|Cazaquistao|KZ|42.37|69.48|1.28|0.67|0.75|9186|2
FMM|Memmingen|Alemanha|DE|47.99|10.24|1.28|1.15|1.00|8629|2
MGF|Maringa|Brasil|BR|-23.48|-52.02|1.28|0.68|0.85|7783|2
NUE|Nuremberg|Alemanha|DE|49.50|11.08|1.28|1.15|1.00|8858|2
ROS|Rosario|Argentina|AR|-32.90|-60.78|1.28|0.60|1.50|9842|2
AAP|Samarinda|Indonesia|ID|-0.37|117.25|1.27|0.50|0.90|7382|2
BPE|Qinhuangdao|China|CN|39.67|119.06|1.27|0.80|1.00|8530|2
JAX|Jacksonville|EUA|US|30.49|-81.69|1.27|1.10|1.10|10000|2
KJA|Krasnoyarsk|Russia|RU|56.18|92.49|1.27|0.71|1.05|12139|2
HTY|Antakya|Turquia|TR|36.36|36.29|1.26|0.65|1.30|6830|2
PSP|Palm Springs|EUA|US|33.83|-116.51|1.26|1.10|1.10|10000|2
JLR|Jabalpur|India|IN|23.18|80.05|1.25|0.52|0.90|6522|2
KIK|Kirkuk|Iraque|IQ|35.47|44.35|1.25|0.38|0.50|9809|2
RYK|Rahim Yar Khan|Paquistao|PK|28.38|70.28|1.25|0.40|0.60|9842|2
SQD|Shangrao|China|CN|28.38|117.96|1.25|0.80|1.00|7874|2
AOE|Eskisehir|Turquia|TR|39.81|30.52|1.24|0.65|1.30|8261|2
PIU|Piura|Peru|PE|-5.21|-80.62|1.24|0.52|1.50|8202|2
TRC|Torreon|Mexico|MX|25.56|-103.40|1.24|0.69|1.30|9039|2
HOG|Holguin|Cuba|CU|20.79|-76.32|1.23|0.40|1.70|10624|2
KNH|Shang-I|Taiwan|TW|24.43|118.36|1.23|1.07|1.15|9843|2
PKU|Pekanbaru|Indonesia|ID|0.46|101.44|1.22|0.50|0.90|7360|2
THD|Thanh Hoa|Vietna|VN|19.90|105.47|1.22|0.58|1.40|10499|2
BJL|Banjul|Gambia|GM|13.34|-16.65|1.21|0.26|1.30|11811|2
CIH|Changzhi|China|CN|36.25|113.13|1.21|0.80|1.00|8530|2
GBI|Kalaburagi|India|IN|17.31|76.97|1.21|0.52|0.90|10417|2
HMB|Suhaj|Egito|EG|26.34|31.74|1.21|0.45|2.00|9843|2
IXK|Keshod|India|IN|21.32|70.27|1.21|0.52|0.90|4500|2
JOS|Jos|Nigeria|NG|9.64|8.87|1.21|0.47|0.55|9845|2
OSR|Mosnov|Chequia|CZ|49.70|18.11|1.21|0.95|1.70|11484|2
TRU|Trujillo|Peru|PE|-8.08|-79.11|1.21|0.52|1.50|9920|2
BXU|Butuan|Filipinas|PH|8.95|125.48|1.20|0.47|1.05|6877|2
CNX|Chiang Mai|Tailandia|TH|18.77|98.96|1.20|0.52|1.90|11155|2
JGA|Jamnagar|India|IN|22.47|70.01|1.20|0.52|0.90|8242|2
JPA|Joao Pessoa|Brasil|BR|-7.15|-34.95|1.20|0.62|1.20|8251|2
KIN|Kingston|Jamaica|JM|17.94|-76.79|1.20|0.45|1.20|8900|2
KMI|Miyazaki|Japao|JP|31.88|131.45|1.20|1.23|1.50|8200|2
MDZ|Mendoza|Argentina|AR|-32.83|-68.79|1.20|0.60|1.30|9301|2
TBS|Tiblisi|Georgia|GE|41.67|44.95|1.20|0.55|1.30|9843|2
UFA|Ufa|Russia|RU|54.56|55.87|1.20|0.71|1.05|12339|2
DLU|Dali|China|CN|25.65|100.32|1.19|0.80|1.00|8202|2
ELQ|Qassim|Arabia Saudita|SA|26.30|43.77|1.19|0.97|1.10|9843|2
HTN|Hotan|China|CN|37.04|79.86|1.19|0.80|1.00|10499|2
MBI|Mbeya|Tanzania|TZ|-8.92|33.27|1.19|0.32|1.45|10925|2
MLM|Morelia|Mexico|MX|19.85|-101.03|1.19|0.69|1.30|11155|2
NTQ|Wajima|Japao|JP|37.29|136.96|1.19|1.23|1.50|6562|2
AQA|Araraquara|Brasil|BR|-21.81|-48.13|1.18|0.68|0.85|5907|2
CXR|Nha Trang/nha Trang|Vietna|VN|12.00|109.22|1.18|0.58|1.40|10000|2
GNY|Sanliurfa|Turquia|TR|37.45|38.90|1.18|0.65|1.30|13123|2
IXE|Mangaluru|India|IN|12.95|74.89|1.18|0.52|0.90|8035|2
RAS|Rasht|Ira|IR|37.32|49.62|1.18|0.45|0.80|9571|2
SYX|Sanya|China|CN|18.30|109.41|1.18|0.80|1.00|11155|2
ZAM|Zamboanga|Filipinas|PH|6.92|122.06|1.18|0.47|1.05|8560|2
AKA|Ankang|China|CN|32.76|108.87|1.17|0.80|1.00|8530|2
DEA|Dera Ghazi Khan|Paquistao|PK|29.96|70.49|1.17|0.40|0.60|6499|2
IXB|Siliguri|India|IN|26.68|88.33|1.17|0.52|0.90|9035|2
OKC|Oklahoma City|EUA|US|35.39|-97.60|1.17|1.10|1.10|9802|2
OMS|Omsk|Russia|RU|54.96|73.31|1.17|0.71|1.05|8202|2
SYQ|San Jose|Costa Rica|CR|9.96|-84.14|1.17|0.62|1.90|5138|2
TKD|Sekondi-Takoradi|Gana|GH|4.90|-1.77|1.17|0.45|0.80|5745|2
VOZ|Voronezh|Russia|RU|51.81|39.23|1.17|0.71|1.05|7546|2
ZHY|Zhongwei|China|CN|37.57|105.15|1.17|0.80|1.00|9186|2
ASB|Ashgabat|Turcomenistao|TM|37.99|58.36|1.15|0.45|0.60|12467|2
CBQ|Calabar|Nigeria|NG|4.98|8.35|1.15|0.47|0.55|8040|2
CUC|Cucuta|Colombia|CO|7.93|-72.51|1.15|0.55|1.10|7700|2
BFJ|Bijie|China|CN|27.27|105.47|1.14|0.80|1.00|8530|2
LLW|Lumbadzi|Malaui|MW|-13.79|33.78|1.14|0.20|0.80|11614|2
KQH|Ajmer|India|IN|26.59|74.81|1.13|0.52|0.90|7060|2
LTU|Latur|India|IN|18.41|76.46|1.13|0.52|0.90|7546|2
MIU|Maiduguri|Nigeria|NG|11.85|13.08|1.13|0.47|0.55|9846|2
ADE|Aden|Iemen|YE|12.83|45.03|1.12|0.20|0.50|10171|2
BDJ|Banjarbaru|Indonesia|ID|-3.44|114.76|1.12|0.50|0.90|8202|2
DDG|Dandong|China|CN|40.03|124.29|1.12|0.80|1.00|8530|2
MWL|Dallas|EUA|US|32.78|-98.06|1.12|1.30|0.90|5996|2
SCN|Saarbrucken|Alemanha|DE|49.21|7.11|1.12|1.15|1.00|6562|2
SHM|Shirahama|Japao|JP|33.66|135.36|1.12|1.23|1.50|6560|2
SJJ|Sarajevo|Bosnia e Herzegovina|BA|43.82|18.33|1.12|0.60|1.00|8666|2
AGU|Aguascalientes|Mexico|MX|21.70|-102.32|1.11|0.69|1.30|9843|2
GSV|Saratov|Russia|RU|51.71|46.17|1.11|0.71|1.05|9843|2
SNU|Santa Clara|Cuba|CU|22.49|-79.94|1.11|0.40|1.70|9898|2
WEH|Weihai|China|CN|37.19|122.23|1.11|0.80|1.00|8530|2
BGY|Bergamo|Italia|IT|45.67|9.71|1.10|1.00|0.90|9429|2
CGB|Cuiaba|Brasil|BR|-15.65|-56.12|1.10|0.70|0.70|7546|2
CPV|Campina Grande|Brasil|BR|-7.27|-35.90|1.10|0.68|0.85|5135|2
CTA|Catania|Italia|IT|37.47|15.07|1.10|0.75|1.40|7989|2
CTG|Cartagena|Colombia|CO|10.44|-75.51|1.10|0.55|1.90|8530|2
DRP|Legazpi|Filipinas|PH|13.11|123.68|1.10|0.47|1.05|8202|2
ELP|El Paso|EUA|US|31.81|-106.38|1.10|1.10|1.10|12020|2
EVN|Erevan|Armenia|AM|40.15|44.40|1.10|0.50|1.10|12631|2
GDN|Gdansk|Polonia|PL|54.38|18.47|1.10|0.80|1.20|9186|2
HHN|Frankfurt am Main|Alemanha|DE|49.95|7.26|1.10|1.15|1.00|12467|2
SKG|Tessalonica|Grecia|GR|40.52|22.97|1.10|0.78|1.40|11286|2
THE|Teresina|Brasil|BR|-5.06|-42.82|1.10|0.58|0.60|7218|2
ZAG|Zagreb|Croacia|HR|45.74|16.07|1.10|0.78|1.00|10669|2
PEE|Perm|Russia|RU|57.91|56.02|1.09|0.71|1.05|10520|2
PZO|Guyana City|Venezuela|VE|8.29|-62.76|1.09|0.45|0.70|6726|2
KBR|Kota Baharu|Malasia|MY|6.17|102.29|1.08|0.72|1.50|7874|2
NOV|Huambo|Angola|AO|-12.81|15.76|1.08|0.38|0.60|8727|2
NYT|Naypyitaw|Mianmar|MM|19.62|96.20|1.08|0.30|0.70|12000|2
STD|Santo Domingo|Venezuela|VE|7.57|-72.04|1.08|0.45|0.70|9990|2
BJM|Bujumbura|Burundi|BI|-3.32|29.32|1.07|0.20|0.50|11811|2
IXJ|Jammu|India|IN|32.69|74.84|1.07|0.52|0.90|6700|2
RMO|Chisinau|Moldavia|MD|46.93|28.93|1.07|0.42|0.80|11778|2
SCU|Santiago|Cuba|CU|19.97|-75.84|1.07|0.40|1.70|13130|2
ZQZ|Zhangjiakou|China|CN|40.74|114.93|1.07|0.80|1.00|8202|2
AWZ|Ahvaz|Ira|IR|31.34|48.76|1.06|0.45|0.80|11149|2
BLZ|Blantyre|Malaui|MW|-15.68|34.97|1.06|0.20|0.80|7628|2
IAR|Tunoshna|Russia|RU|57.56|40.16|1.06|0.71|1.05|9870|2
IXG|Belgaum|India|IN|15.86|74.62|1.06|0.52|0.90|7546|2
NOZ|Novokuznetsk|Russia|RU|53.81|86.88|1.06|0.71|1.05|8789|2
PNR|Pointe Noire|Congo (Brazzaville)|CG|-4.82|11.89|1.06|0.32|0.60|8530|2
SKO|Sokoto|Nigeria|NG|12.92|5.21|1.06|0.47|0.55|9844|2
BSZ|Bishkek|Quirguistao|KG|43.06|74.48|1.05|0.32|0.90|13780|2
FAT|Fresno|EUA|US|36.78|-119.72|1.05|1.10|1.10|9539|2
LBV|Libreville|Gabao|GA|0.46|9.41|1.05|0.45|0.70|9844|2
SLP|San Luis Potosi|Mexico|MX|22.26|-100.94|1.05|0.69|1.30|9867|2
CSY|Cheboksary|Russia|RU|56.09|47.35|1.04|0.71|1.05|8241|2
HSN|Zhoushan|China|CN|29.93|122.36|1.04|0.80|1.00|8202|2
ISU|Sulaymaniyah|Iraque|IQ|35.56|45.32|1.04|0.38|0.50|11481|2
IZA|Juiz de Fora|Brasil|BR|-21.51|-43.17|1.04|0.68|0.85|8284|2
PHH|Pokhara|Nepal|NP|28.18|84.01|1.04|0.35|1.90|8202|2
AAE|Annaba|Argelia|DZ|36.83|7.81|1.03|0.60|0.70|9843|2
BRQ|Brno|Chequia|CZ|49.15|16.69|1.03|0.95|1.70|8694|2
CCP|Concepcion|Chile|CL|-36.77|-73.06|1.03|0.70|1.30|8530|2
LFQ|Linfen|China|CN|36.13|111.64|1.03|0.80|1.00|8530|2
CDP|Kadapa|India|IN|14.51|78.77|1.02|0.52|0.90|6562|2
ELS|East London|Africa do Sul|ZA|-33.04|27.83|1.02|0.65|1.20|6362|2
LUM|Dehong|China|CN|24.40|98.53|1.02|0.80|1.00|7218|2
SLE|Salem|EUA|US|44.91|-123.00|1.02|1.10|1.10|5811|2
SRY|Sari|Ira|IR|36.64|53.19|1.02|0.45|0.80|8688|2
TAC|Tacloban City|Filipinas|PH|11.23|125.03|1.02|0.47|1.05|7014|2
TGZ|Tuxtla Gutierrez|Mexico|MX|16.56|-93.03|1.02|0.69|1.30|8202|2
CAH|Ca Mau City|Vietna|VN|9.18|105.18|1.01|0.58|1.40|4921|2
EXT|Exeter, Devon|Reino Unido|GB|50.73|-3.41|1.01|1.05|1.10|6811|2
AGP|Malaga|Espanha|ES|36.67|-4.50|1.00|0.95|2.00|10500|2
AJU|Aracaju|Brasil|BR|-10.98|-37.07|1.00|0.60|1.10|7218|2
AOJ|Aomori|Japao|JP|40.73|140.69|1.00|1.23|1.50|9846|2
BIO|Bilbao|Espanha|ES|43.30|-2.91|1.00|0.92|1.10|8530|2
BLQ|Bolonha|Italia|IT|44.54|11.29|1.00|1.05|1.10|9196|2
CXP|Cilacap|Indonesia|ID|-7.65|109.03|1.00|0.50|0.90|4593|2
GOT|Gotemburgo|Suecia|SE|57.66|12.28|1.00|1.10|0.80|10823|2
KRK|Cracovia|Polonia|PL|50.08|19.78|1.00|0.82|1.60|8366|2
NCE|Nice|Franca|FR|43.66|7.22|1.00|1.20|2.00|9721|2
PMO|Palermo|Italia|IT|38.18|13.09|1.00|0.72|1.40|10912|2
RAK|Marraquexe|Marrocos|MA|31.60|-8.04|1.00|0.48|2.00|10170|2
UIH|Quy Nohn|Vietna|VN|13.96|109.04|1.00|0.58|1.40|10010|2
VIG|El Vigia|Venezuela|VE|8.62|-71.67|1.00|0.45|0.70|10645|2
BYK|Bouake|Costa do Marfim|CI|7.74|-5.07|0.99|0.35|0.80|10827|2
HRL|Harlingen|EUA|US|26.23|-97.65|0.99|1.10|1.10|9400|2
JJG|Jaguaruna|Brasil|BR|-28.68|-49.06|0.99|0.68|0.85|8199|2
PMV|Isla Margarita|Venezuela|VE|10.91|-63.97|0.99|0.45|0.70|10433|2
BZG|Bydgoszcz|Polonia|PL|53.10|17.98|0.98|0.81|1.10|8202|2
JTC|Bauru|Brasil|BR|-22.16|-49.07|0.98|0.68|0.85|6594|2
SDF|Louisville|EUA|US|38.17|-85.74|0.98|1.10|1.10|11887|2
WUZ|Tangbu|China|CN|23.40|111.09|0.98|0.80|1.00|8202|2
BJA|Bejaia|Argelia|DZ|36.71|5.07|0.97|0.60|0.70|7874|2
CUU|Chihuahua|Mexico|MX|28.70|-105.96|0.97|0.69|1.30|8530|2
KJB|Orvakal|India|IN|15.72|78.17|0.97|0.52|0.90|6562|2
MSY|New Orleans|EUA|US|29.99|-90.26|0.97|1.10|1.10|10104|2
POZ|Poznan|Polonia|PL|52.42|16.82|0.97|0.81|1.10|8215|2
ERF|Erfurt|Alemanha|DE|50.98|10.96|0.96|1.15|1.00|8530|2
GRQ|Groningen|Holanda|NL|53.12|6.58|0.96|1.25|1.25|8202|2
MNU|Mawlamyine|Mianmar|MM|16.44|97.66|0.96|0.30|0.70|5260|2
SZH|Shuozhou|China|CN|39.27|112.69|0.96|0.80|1.00|8530|2
ZAZ|Zaragoza|Espanha|ES|41.67|-1.04|0.96|0.85|1.90|12198|2
BFN|Bloemfontein|Africa do Sul|ZA|-29.09|26.30|0.95|0.65|1.20|8396|2
BOY|Bobo Dioulasso|Burquina Faso|BF|11.16|-4.33|0.95|0.26|0.60|10826|2
CAP|Cap Haitien|Haiti|HT|19.73|-72.20|0.95|0.22|0.60|8701|2
IJK|Izhevsk|Russia|RU|56.83|53.46|0.95|0.71|1.05|8202|2
UPN|Uruapan|Mexico|MX|19.40|-102.04|0.95|0.69|1.30|7874|2
VVO|Artyom|Russia|RU|43.40|132.15|0.95|0.71|1.05|11483|2
GOA|Genova|Italia|IT|44.41|8.84|0.94|1.00|1.40|9564|2
JDO|Juazeiro do Norte|Brasil|BR|-7.22|-39.27|0.94|0.68|0.85|6365|2
MTR|Monteria|Colombia|CO|8.82|-75.83|0.94|0.55|1.10|7539|2
REU|Reus|Espanha|ES|41.15|1.17|0.94|0.85|1.90|8054|2
YXU|London|Canada|CA|43.03|-81.15|0.94|1.10|0.95|8800|2
GRX|Granada|Espanha|ES|37.19|-3.78|0.93|0.85|1.90|9514|2
IKT|Irkutsk|Russia|RU|52.27|104.40|0.93|0.71|1.05|11696|2
KSH|Kermanshah|Ira|IR|34.35|47.16|0.93|0.45|0.80|11213|2
ABD|Abadan|Ira|IR|30.37|48.23|0.92|0.45|0.80|10169|2
BFS|Belfast|Reino Unido|GB|54.66|-6.22|0.92|1.05|1.10|9121|2
CZU|Corozal|Colombia|CO|9.33|-75.29|0.92|0.55|1.10|4930|2
FNA|Freetown|Serra Leoa|SL|8.62|-13.20|0.92|0.22|0.60|10498|2
PAB|Bilaspur|India|IN|21.99|82.11|0.92|0.52|0.90|5035|2
SCQ|Santiago de Compostela|Espanha|ES|42.90|-8.42|0.92|0.85|1.90|10499|2
UBN|Ulaanbaatar|Mongolia|MN|47.65|106.82|0.92|0.42|1.10|11811|2
CIX|Chiclayo|Peru|PE|-6.79|-79.83|0.91|0.52|1.50|8266|2
IXA|Agartala|India|IN|23.89|91.24|0.91|0.52|0.90|7500|2
OSS|Osh|Quirguistao|KG|40.61|72.79|0.91|0.32|0.90|10538|2
ABQ|Albuquerque|Estados Unidos|US|35.04|-106.61|0.90|0.92|0.90|13793|2
BEN|Benina|Libia|LY|32.10|20.27|0.90|0.40|0.50|11732|2
CGR|Campo Grande|Brasil|BR|-20.47|-54.67|0.90|0.72|0.60|8530|2
EDI|Edimburgo|Reino Unido|GB|55.95|-3.37|0.90|1.10|1.50|8392|2
HDM|Hamadan|Ira|IR|34.87|48.56|0.90|0.45|0.80|10611|2
NBC|Nizhnekamsk|Russia|RU|55.56|52.09|0.90|0.71|1.05|8209|2
SJP|Sao Jose do Rio Preto|Brasil|BR|-20.82|-49.41|0.90|0.68|0.85|5381|2
TIA|Tirana|Albania|AL|41.41|19.72|0.90|0.55|1.30|9843|2
WRO|Wroclaw|Polonia|PL|51.10|16.88|0.90|0.80|0.90|8212|2
BHU|Bhavnagar|India|IN|21.75|72.19|0.89|0.52|0.90|6300|2
BLI|Bellingham|EUA|US|48.79|-122.54|0.89|1.10|1.10|6700|2
CUL|Culiacan|Mexico|MX|24.77|-107.48|0.89|0.69|1.30|7365|2
DXJ|Xiangxi|China|CN|28.50|109.52|0.89|0.80|1.00|8530|2
PZI|Panzhihua|China|CN|26.54|101.80|0.89|0.80|1.00|9186|2
SKD|Samarkand|Uzbequistao|UZ|39.70|66.98|0.89|0.50|0.80|10187|2
BNS|Barinas|Venezuela|VE|8.62|-70.21|0.88|0.45|0.70|6560|2
MDG|Mudanjiang|China|CN|44.53|129.57|0.88|0.80|1.00|8530|2
OUD|Ahl Angad|Marrocos|MA|34.79|-1.93|0.88|0.54|1.65|9843|2
RGO|Hoemun-ri|Coreia do Norte|KP|41.43|129.65|0.88|0.25|0.50|8202|2
VGO|Vigo|Espanha|ES|42.23|-8.63|0.88|0.85|1.90|7874|2
DYU|Dushanbe|Tajiquistao|TJ|38.54|68.82|0.87|0.28|0.80|10170|2
LBD|Khujand|Tajiquistao|TJ|40.22|69.69|0.87|0.28|0.80|10433|2
YLK|Barrie|Canada|CA|44.49|-79.55|0.87|1.10|0.95|6001|2
AAN|Al Ain|Emirados|AE|24.26|55.61|0.86|1.35|1.40|13123|2
MMX|Malmo|Suecia|SE|55.54|13.38|0.86|1.23|1.00|9186|2
TUS|Tucson|EUA|US|32.12|-110.94|0.86|1.10|1.10|10996|2
ACY|Atlantic City|EUA|US|39.46|-74.58|0.85|1.10|1.10|10001|2
ASW|Aswan|Egito|EG|23.96|32.82|0.85|0.45|2.00|11161|2
DAY|Dayton|EUA|US|39.90|-84.22|0.85|1.10|1.10|10901|2
GSO|Greensboro|EUA|US|36.10|-79.94|0.85|1.10|1.10|10001|2
IWA|Ivanovo|Russia|RU|56.94|40.94|0.85|0.71|1.05|8202|2
TLM|Zenata|Argelia|DZ|35.01|-1.46|0.85|0.60|0.70|8530|2
BPN|Balikpapan|Indonesia|ID|-1.27|116.89|0.84|0.50|0.90|8202|2
HMO|Hermosillo|Mexico|MX|29.09|-111.05|0.84|0.69|1.30|7546|2
KUA|Kuantan|Malasia|MY|3.78|103.21|0.84|0.72|1.50|9200|2
YGJ|Yonago|Japao|JP|35.49|133.24|0.84|1.23|1.50|8202|2
REX|Reynosa|Mexico|MX|26.01|-98.23|0.83|0.69|1.30|6243|2
YQG|Windsor|Canada|CA|42.28|-82.96|0.83|1.10|0.95|9000|2
APL|Nampula|Mocambique|MZ|-15.11|39.28|0.82|0.30|0.80|6562|2
ENH|Enshi|China|CN|30.32|109.49|0.82|0.80|1.00|6890|2
ERZ|Erzurum|Turquia|TR|39.96|41.17|0.82|0.65|1.30|12500|2
IXP|Pathankot|India|IN|32.23|75.63|0.82|0.52|0.90|8970|2
KHG|Kashgar|China|CN|39.54|76.02|0.82|0.80|1.00|10499|2
TFN|Tenerife Sul|Espanha|ES|28.48|-16.34|0.82|0.82|2.00|10404|2
LEX|Lexington|EUA|US|38.04|-84.61|0.81|1.10|1.10|7004|2
MLX|Malatya|Turquia|TR|38.44|38.09|0.81|0.65|1.30|10990|2
NTE|Nantes|Franca|FR|47.15|-1.61|0.81|1.12|1.35|9514|2
SFN|Santa Fe|Argentina|AR|-31.71|-60.81|0.81|0.60|1.50|7628|2
TOF|Tomsk|Russia|RU|56.38|85.21|0.81|0.71|1.05|8202|2
UCB|Ulanqab|China|CN|41.13|113.11|0.81|0.80|1.00|10499|2
ALC|Alicante|Espanha|ES|38.28|-0.56|0.80|0.82|1.80|9842|2
BSL|Basileia|Suica|CH|47.60|7.52|0.80|1.20|0.90|12795|2
EIN|Eindhoven|Holanda|NL|51.45|5.37|0.80|1.10|0.70|9843|2
MCX|Makhachkala|Russia|RU|42.82|47.65|0.80|0.71|1.05|8662|2
MRV|Mineralnyye Vody|Russia|RU|44.23|43.08|0.80|0.71|1.05|12795|2
OXB|Bissau|Guine-Bissau|GW|11.89|-15.65|0.80|0.22|0.60|10499|2
YWG|Winnipeg|Canada|CA|49.91|-97.24|0.80|0.95|0.60|11000|2
BEW|Beira|Mocambique|MZ|-19.80|34.91|0.79|0.30|0.80|7874|2
CAB|Cabinda|Angola|AO|-5.60|12.19|0.79|0.38|0.60|8202|2
KEJ|Kemerovo|Russia|RU|55.27|86.11|0.79|0.71|1.05|10499|2
KGF|Karaganda|Cazaquistao|KZ|49.67|73.33|0.79|0.67|0.75|10831|2
PNZ|Petrolina|Brasil|BR|-9.36|-40.57|0.79|0.68|0.85|9055|2
RMI|Rimini|Italia|IT|44.02|12.61|0.79|1.00|1.40|9828|2
VSA|Villahermosa|Mexico|MX|17.99|-92.82|0.79|0.69|1.30|7218|2
YOL|Yola|Nigeria|NG|9.26|12.43|0.79|0.47|0.55|9840|2
BAL|Batman|Turquia|TR|37.93|41.12|0.78|0.65|1.30|10000|2
BUF|Buffalo|EUA|US|42.94|-78.73|0.78|1.10|1.10|8829|2
MDC|Manado|Indonesia|ID|1.55|124.93|0.78|0.50|0.90|8693|2
MUN|Maturin|Venezuela|VE|9.75|-63.15|0.78|0.45|0.70|6890|2
TJM|Tyumen|Russia|RU|57.18|65.33|0.78|0.71|1.05|9852|2
ULY|Cherdakly|Russia|RU|54.40|48.80|0.78|0.71|1.05|16404|2
VDO|Van Don|Vietna|VN|21.12|107.42|0.78|0.58|1.40|11811|2
YNJ|Yanji|China|CN|42.88|129.45|0.78|0.80|1.00|8530|2
BDS|Brindisi|Italia|IT|40.66|17.95|0.77|1.00|1.40|10000|2
DAB|Orlando|EUA|US|29.18|-81.06|0.77|1.05|2.20|10500|2
DOD|Dodoma|Tanzania|TZ|-6.17|35.76|0.77|0.32|1.45|6700|2
GMO|Gombe|Nigeria|NG|10.30|10.90|0.77|0.47|0.55|10827|2
KHD|Khorramabad|Ira|IR|33.44|48.28|0.77|0.45|0.80|10498|2
LNL|Longnan|China|CN|33.79|105.79|0.77|0.80|1.00|9186|2
LRM|Punta Cana|Republica Dominicana|DO|18.45|-68.91|0.77|0.50|2.20|9678|2
MDI|Makurdi|Nigeria|NG|7.70|8.61|0.77|0.47|0.55|9830|2
RZE|Jasionka|Polonia|PL|50.11|22.02|0.77|0.81|1.10|10498|2
AYJ|Faizabad|India|IN|26.75|82.16|0.76|0.52|0.90|7381|2
BIR|Biratnagar|Nepal|NP|26.48|87.26|0.76|0.35|1.90|4937|2
BOD|Bordeaux|Franca|FR|44.83|-0.72|0.76|1.12|1.35|10171|2
BRN|Bern|Suica|CH|46.91|7.50|0.76|1.60|1.40|5676|2
NDR|Al Aaroui|Marrocos|MA|34.99|-3.03|0.76|0.54|1.65|9842|2
RFD|Chicago/Rockford|EUA|US|42.20|-89.10|0.76|1.10|1.10|10002|2
TIF|Taif|Arabia Saudita|SA|21.48|40.54|0.76|0.97|1.10|12254|2
TUC|San Miguel de Tucuman|Argentina|AR|-26.84|-65.10|0.76|0.60|1.50|11483|2
VLV|Valera|Venezuela|VE|9.34|-70.58|0.76|0.45|0.70|6791|2
BAX|Barnaul|Russia|RU|53.36|83.54|0.75|0.71|1.05|9350|2
DLI|Da Lat|Vietna|VN|11.75|108.37|0.75|0.58|1.40|10663|2
JRG|Sambalpur|India|IN|21.91|84.05|0.75|0.52|0.90|7844|2
MZH|Amasya|Turquia|TR|40.83|35.52|0.75|0.65|1.30|9600|2
SDR|Santander|Espanha|ES|43.43|-3.82|0.75|0.85|1.90|7612|2
STW|Stavropol|Russia|RU|45.11|42.11|0.75|0.71|1.05|8530|2
TAM|Ciudad Madero|Mexico|MX|22.29|-97.87|0.75|0.69|1.30|8366|2
CFK|Chlef|Argelia|DZ|36.22|1.34|0.74|0.60|0.70|8793|2
COS|Colorado Springs|EUA|US|38.81|-104.70|0.74|1.10|1.10|13500|2
JGN|Jiayuguan|China|CN|39.86|98.34|0.74|0.80|1.00|9843|2
REW|Rewa|India|IN|24.50|81.22|0.74|0.52|0.90|4593|2
TXN|Huangshan|China|CN|29.73|118.26|0.74|0.80|1.00|8530|2
CUE|Cuenca|Equador|EC|-2.89|-78.98|0.73|0.57|1.05|6234|2
DJB|Jambi|Indonesia|ID|-1.64|103.65|0.73|0.50|0.90|8537|2
FCN|Wurster Nordseekuste|Alemanha|DE|53.77|8.66|0.73|1.15|1.00|8002|2
LUG|Agno|Suica|CH|46.00|8.91|0.73|1.60|1.40|4642|2
MZR|Mazar-i-Sharif|Afeganistao|AF|36.70|67.21|0.73|0.22|0.50|9843|2
RES|Resistencia|Argentina|AR|-27.45|-59.06|0.73|0.60|1.50|9088|2
SZF|Samsun|Turquia|TR|41.25|36.57|0.73|0.65|1.30|9843|2
TUL|Tulsa|EUA|US|36.20|-95.89|0.73|1.10|1.10|10000|2
GRK|Fort Cavazos|EUA|US|31.07|-97.83|0.72|1.10|1.10|9997|2
KKS|Kashan|Ira|IR|33.90|51.58|0.72|0.45|0.80|8845|2
SFA|Sfax|Tunisia|TN|34.72|10.69|0.72|0.55|1.30|9843|2
BEM|Oulad Yaich|Marrocos|MA|32.40|-6.32|0.71|0.54|1.65|8169|2
MAM|Matamoros|Mexico|MX|25.77|-97.53|0.71|0.69|1.30|7546|2
MEC|Manta|Equador|EC|-0.95|-80.68|0.71|0.57|1.05|9383|2
OVD|Ranon|Espanha|ES|43.56|-6.03|0.71|0.85|1.90|7218|2
PDV|Plovdiv|Bulgaria|BG|42.07|24.85|0.71|0.70|1.00|8202|2
DIR|Dire Dawa|Etiopia|ET|9.62|41.86|0.70|0.35|0.80|8791|2
MFM|Macau|Macau|MO|22.15|113.59|0.70|1.15|2.00|10544|2
MTT|Cosoleacaque|Mexico|MX|18.10|-94.58|0.70|0.69|1.30|6890|2
OOL|Gold Coast|Australia|AU|-28.17|153.51|0.70|1.05|1.80|8176|2
RIX|Riga|Letonia|LV|56.92|23.97|0.70|0.85|1.10|10499|2
AEB|Baise|China|CN|23.72|106.96|0.69|0.80|1.00|8202|2
BCU|Bauchi|Nigeria|NG|10.48|9.74|0.69|0.47|0.55|11154|2
BMV|Buon Ma Thuot|Vietna|VN|12.67|108.12|0.69|0.58|1.40|9843|2
KVO|Kraljevo|Servia|RS|43.82|20.59|0.69|0.65|1.00|7431|2
LUZ|Lublin|Polonia|PL|51.24|22.71|0.69|0.81|1.10|8268|2
MDQ|Mar del Plata|Argentina|AR|-37.93|-57.57|0.69|0.60|1.50|7218|2
PET|Pelotas|Brasil|BR|-31.72|-52.33|0.69|0.68|0.85|6496|2
PNK|Pontianak|Indonesia|ID|-0.15|109.40|0.69|0.50|0.90|7380|2
RSW|Fort Myers|EUA|US|26.53|-81.75|0.69|1.10|1.10|12000|2
STS|Santa Rosa|EUA|US|38.51|-122.81|0.69|1.10|1.10|6000|2
SZZ|Szczecin|Polonia|PL|53.58|14.90|0.69|0.81|1.10|8202|2
TUG|Tuguegarao City|Filipinas|PH|17.64|121.73|0.69|0.47|1.05|6455|2
YPQ|Peterborough|Canada|CA|44.23|-78.36|0.69|1.10|0.95|7005|2
DKA|Katsina|Nigeria|NG|13.01|7.66|0.68|0.47|0.55|11352|2
DOL|Deauville|Franca|FR|49.37|0.15|0.68|1.12|1.35|8366|2
EZS|Elazig|Turquia|TR|38.60|39.28|0.68|0.65|1.30|9843|2
HLD|Hailar|China|CN|49.21|119.82|0.68|0.80|1.00|8530|2
VRA|Matanzas|Cuba|CU|23.03|-81.44|0.68|0.40|1.70|11490|2
BUQ|Bulawayo|Zimbabue|ZW|-20.02|28.62|0.67|0.30|0.90|8491|2
LJG|Lijiang|China|CN|26.68|100.24|0.67|0.80|1.00|9843|2
LTX|Latacunga|Equador|EC|-0.91|-78.62|0.67|0.57|1.05|12117|2
OMA|Omaha|EUA|US|41.30|-95.89|0.67|1.10|1.10|9502|2
OMH|Urmia|Ira|IR|37.67|45.07|0.67|0.45|0.80|10658|2
TUU|Tabuk|Arabia Saudita|SA|28.37|36.62|0.67|0.97|1.10|10991|2
TZX|Trabzon|Turquia|TR|41.00|39.79|0.67|0.65|1.30|8661|2
UDR|Udaipur|India|IN|24.62|73.90|0.67|0.52|0.90|7484|2
VAN|Van|Turquia|TR|38.47|43.33|0.67|0.65|1.30|9022|2
ACA|Acapulco|Mexico|MX|16.76|-99.75|0.66|0.69|1.30|10832|2
ARH|Archangelsk|Russia|RU|64.60|40.72|0.66|0.71|1.05|8202|2
AZD|Yazd|Ira|IR|31.90|54.28|0.66|0.45|0.80|13446|2
CAC|Cascavel|Brasil|BR|-25.00|-53.50|0.66|0.68|0.85|5810|2
GRV|Grozny|Russia|RU|43.39|45.70|0.66|0.71|1.05|8202|2
IPN|Ipatinga|Brasil|BR|-19.47|-42.49|0.66|0.68|0.85|6575|2
KVX|Kirov|Russia|RU|58.50|49.35|0.66|0.71|1.05|7230|2
PGZ|Ponta Grossa|Brasil|BR|-25.18|-50.14|0.66|0.68|0.85|4692|2
TEN|Tongren|China|CN|27.88|109.31|0.66|0.80|1.00|9022|2
TTJ|Tottori|Japao|JP|35.53|134.17|0.66|1.23|1.50|6562|2
BHJ|Bhuj|India|IN|23.29|69.67|0.65|0.52|0.90|8205|2
CAW|Campos dos Goytacazes|Brasil|BR|-21.70|-41.30|0.65|0.68|0.85|5066|2
MCY|Maroochydore|Australia|AU|-26.59|153.08|0.65|1.20|1.40|9186|2
SLA|Salta|Argentina|AR|-24.86|-65.49|0.65|0.60|1.50|9842|2
VCL|Tam Nghia|Vietna|VN|15.40|108.71|0.65|0.58|1.40|10007|2
VUP|Valledupar|Colombia|CO|10.44|-73.25|0.65|0.55|1.10|6890|2
GBE|Gaborone|Botsuana|BW|-24.56|25.92|0.64|0.52|1.30|13123|2
HOF|Hofuf|Arabia Saudita|SA|25.29|49.49|0.64|0.97|1.10|10039|2
JAU|Jauja|Peru|PE|-11.78|-75.47|0.64|0.52|1.50|9220|2
CMW|Camaguey|Cuba|CU|21.42|-77.85|0.63|0.40|1.70|9842|2
CYZ|Cauayan City|Filipinas|PH|16.93|121.75|0.63|0.47|1.05|6890|2
FOG|Foggia|Italia|IT|41.43|15.53|0.63|1.00|1.40|5692|2
JGS|Ji'an|China|CN|26.86|114.74|0.63|0.80|1.00|8530|2
LBE|Latrobe|EUA|US|40.28|-79.40|0.63|1.10|1.10|8222|2
MCE|Merced|EUA|US|37.28|-120.51|0.63|1.10|1.10|5914|2
NWI|Norwich, Norfolk|Reino Unido|GB|52.68|1.28|0.63|1.05|1.10|6043|2
OGU|Ordu|Turquia|TR|40.97|38.09|0.63|0.65|1.30|9848|2
SXB|Strasbourg|Franca|FR|48.54|7.63|0.63|1.12|1.35|7874|2
AHB|Abha|Arabia Saudita|SA|18.24|42.66|0.62|0.97|1.10|10991|2
AKU|Aksu|China|CN|41.26|80.29|0.62|0.80|1.00|7874|2
ETZ|Goin|Franca|FR|48.98|6.25|0.62|1.12|1.35|8202|2
GRZ|Feldkirchen bei Graz|Austria|AT|46.99|15.44|0.62|1.25|1.50|9842|2
JIJ|Jijiga|Etiopia|ET|9.33|42.91|0.62|0.35|0.80|8202|2
KCH|Kuching|Malasia|MY|1.49|110.35|0.62|0.72|1.50|12402|2
KER|Kerman|Ira|IR|30.27|56.95|0.62|0.45|0.80|12635|2
KHV|Khabarovsk|Russia|RU|48.53|135.19|0.62|0.71|1.05|13124|2
KUN|Kaunas|Lituania|LT|54.96|24.09|0.62|0.85|1.00|10663|2
LOP|Mataram|Indonesia|ID|-8.76|116.28|0.62|0.50|0.90|10826|2
LZN|Matsu|Taiwan|TW|26.16|119.96|0.62|1.07|1.15|5180|2
MQM|Mardin|Turquia|TR|37.22|40.63|0.62|0.65|1.30|8204|2
NAV|Nevsehir|Turquia|TR|38.77|34.53|0.62|0.65|1.30|9842|2
NTL|Williamtown|Australia|AU|-32.80|151.84|0.62|1.20|1.40|10033|2
PEZ|Penza|Russia|RU|53.11|45.02|0.62|0.71|1.05|9155|2
PQC|Phu Quoc Island|Vietna|VN|10.17|103.99|0.62|0.58|1.40|9843|2
REG|Reggio Calabria|Italia|IT|38.07|15.65|0.62|1.00|1.40|6549|2
RIY|Mukalla|Iemen|YE|14.66|49.38|0.62|0.20|0.50|9843|2
XAP|Chapeco|Brasil|BR|-27.13|-52.66|0.62|0.68|0.85|6758|2
GRR|Grand Rapids|EUA|US|42.88|-85.52|0.61|1.10|1.10|10001|2
HAS|Hail|Arabia Saudita|SA|27.44|41.69|0.61|0.97|1.10|12204|2
IAS|Iasi|Romenia|RO|47.18|27.62|0.61|0.73|0.90|7874|2
TMP|Tampere / Pirkkala|Finlandia|FI|61.41|23.60|0.61|1.30|1.10|8858|2
BKI|Kota Kinabalu|Malasia|MY|5.93|116.05|0.60|0.68|1.60|12402|2
GOI|Goa|India|IN|15.38|73.83|0.60|0.52|2.00|11345|2
HKT|Phuket|Tailandia|TH|8.11|98.32|0.60|0.65|2.20|10171|2
POS|Port of Spain|Trinidad e Tobago|TT|10.60|-61.34|0.60|0.80|0.90|10500|2
RUN|Saint-Denis|Reuniao|RE|-20.89|55.52|0.60|0.85|1.50|10499|2
TLL|Tallinn|Estonia|EE|59.41|24.83|0.60|0.90|1.20|11417|2
VNO|Vilnius|Lituania|LT|54.63|25.29|0.60|0.85|1.00|8251|2
YXE|Saskatoon|Canada|CA|52.17|-106.70|0.60|1.10|0.95|8300|2
ZCO|Temuco|Chile|CL|-38.93|-72.65|0.60|0.70|1.30|8005|2
GME|Gomel|Belarus|BY|52.53|31.02|0.59|0.55|0.70|8428|2
GZP|Gazipasa|Turquia|TR|36.30|32.30|0.59|0.65|1.30|7710|2
HEA|Guzara|Afeganistao|AF|34.21|62.23|0.59|0.22|0.50|9888|2
IGD|Igdir|Turquia|TR|39.98|43.88|0.59|0.65|1.30|9843|2
IPI|Ipiales|Colombia|CO|0.86|-77.67|0.59|0.55|1.10|8202|2
PSR|Pescara|Italia|IT|42.43|14.18|0.59|1.00|1.40|7933|2
TRF|Sandefjord|Noruega|NO|59.19|10.26|0.59|1.20|1.20|9216|2
KLV|Karlovy Vary|Chequia|CZ|50.20|12.91|0.58|0.95|1.70|7054|2
MRY|Monterey|EUA|US|36.59|-121.84|0.58|1.10|1.10|7175|2
ODE|Odense|Dinamarca|DK|55.48|10.33|0.58|1.40|1.30|6053|2
REN|Orenburg|Russia|RU|51.79|55.46|0.58|0.71|1.05|8212|2
UTP|Rayong|Tailandia|TH|12.68|101.00|0.58|0.60|2.00|11500|2
ACH|St. Gallen|Suica|CH|47.49|9.56|0.57|1.60|1.40|4774|2
BHM|Birmingham|EUA|US|33.56|-86.75|0.57|1.10|1.10|12007|2
CLQ|Colima|Mexico|MX|19.28|-103.58|0.57|0.69|1.30|7546|2
IMF|Imphal|India|IN|24.76|93.90|0.57|0.52|0.90|9009|2
NKT|Sirnak|Turquia|TR|37.36|42.06|0.57|0.65|1.30|9843|2
PFB|Passo Fundo|Brasil|BR|-28.24|-52.33|0.57|0.68|0.85|5512|2
RDO|Radom|Polonia|PL|51.39|21.21|0.57|0.81|1.10|8202|2
AKJ|Higashikagura|Japao|JP|43.67|142.45|0.56|1.23|1.50|8200|2
ALB|Albany|EUA|US|42.75|-73.80|0.56|1.10|1.10|8500|2
BZI|Balikesir|Turquia|TR|39.62|27.93|0.56|0.65|1.30|9810|2
HGA|Hargeisa|Somalia|SO|9.51|44.08|0.56|0.20|0.50|12139|2
ODB|Cordoba|Espanha|ES|37.84|-4.85|0.56|0.85|1.90|7352|2
PZU|Port Sudan|Sudao|SD|19.43|37.23|0.56|0.24|0.50|8202|2
XIL|Xilinhot|China|CN|43.92|115.96|0.56|0.80|1.00|9186|2
ASF|Astrakhan|Russia|RU|46.28|48.01|0.55|0.71|1.05|10499|2
CDT|Castellon de la Plana|Espanha|ES|40.21|0.07|0.55|0.85|1.90|8858|2
DJE|Mellita|Tunisia|TN|33.87|10.78|0.55|0.55|1.30|10171|2
DSM|Des Moines|EUA|US|41.53|-93.66|0.55|1.10|1.10|9004|2
IOS|Ilheus|Brasil|BR|-14.82|-39.03|0.55|0.68|0.85|5174|2
KGD|Kaliningrad|Russia|RU|54.89|20.60|0.55|0.71|1.05|10991|2
NQN|Neuquen|Argentina|AR|-38.95|-68.16|0.55|0.60|1.50|8432|2
TAG|Panglao|Filipinas|PH|9.57|123.77|0.55|0.47|1.05|8202|2
VDC|Vitoria da Conquista|Brasil|BR|-14.91|-40.91|0.55|0.68|0.85|6890|2
ZAH|Zahedan|Ira|IR|29.48|60.91|0.55|0.45|0.80|14042|2
BFL|Bakersfield|EUA|US|35.43|-119.06|0.54|1.10|1.10|10849|2
BJV|Bodrum|Turquia|TR|37.25|27.66|0.54|0.65|1.30|9843|2
BOI|Boise|EUA|US|43.56|-116.22|0.54|1.10|1.10|10000|2
DGO|Durango|Mexico|MX|24.13|-104.53|0.54|0.69|1.30|9514|2
GHV|Brasov|Romenia|RO|45.71|25.52|0.54|0.73|0.90|9252|2
HKD|Hakodate|Japao|JP|41.77|140.82|0.54|1.23|1.50|9842|2
JDZ|Jingdezhen|China|CN|29.34|117.18|0.54|0.80|1.00|7874|2
LIT|Little Rock|EUA|US|34.73|-92.22|0.54|1.10|1.10|8273|2
TGG|Kuala Terengganu|Malasia|MY|5.38|103.10|0.54|0.72|1.50|11417|2
UGC|Urgench|Uzbequistao|UZ|41.58|60.64|0.54|0.50|0.80|11065|2
EAM|Najran|Arabia Saudita|SA|17.61|44.42|0.53|0.97|1.10|10007|2
GJL|Tahir|Argelia|DZ|36.79|5.87|0.53|0.60|0.70|7874|2
GNJ|Ganja|Azerbaijao|AZ|40.74|46.32|0.53|0.70|1.00|10827|2
MOC|Montes Claros|Brasil|BR|-16.71|-43.82|0.53|0.68|0.85|6890|2
RIC|Richmond|EUA|US|37.51|-77.32|0.53|1.10|1.10|9003|2
SBZ|Sibiu|Romenia|RO|45.79|24.09|0.53|0.73|0.90|8629|2
TJK|Tokat|Turquia|TR|40.32|36.39|0.53|0.65|1.30|8858|2
UUA|Bugulma|Russia|RU|54.64|52.80|0.53|0.71|1.05|6561|2
AOI|Falconara Marittima|Italia|IT|43.62|13.36|0.52|1.00|1.40|9718|2
BCM|Bacau|Romenia|RO|46.52|26.91|0.52|0.73|0.90|8203|2
DJJ|Sentani|Indonesia|ID|-2.58|140.52|0.52|0.50|0.90|9842|2
GDZ|Gelendzhik|Russia|RU|44.58|38.01|0.52|0.71|1.05|10171|2
KDH|Kandahar|Afeganistao|AF|31.51|65.85|0.52|0.22|0.50|10532|2
SBA|Santa Barbara|EUA|US|34.43|-119.84|0.52|1.10|1.10|6037|2
UTH|Udon Thani|Tailandia|TH|17.39|102.79|0.52|0.60|2.00|10000|2
VER|Veracruz|Mexico|MX|19.14|-96.19|0.52|0.69|1.30|7874|2
ZCL|Zacatecas|Mexico|MX|22.89|-102.69|0.52|0.69|1.30|9843|2
AAR|Aarhus|Dinamarca|DK|56.30|10.62|0.51|1.40|1.30|9111|2
CEN|Ciudad Obregon|Mexico|MX|27.39|-109.83|0.51|0.69|1.30|7546|2
CND|Constanta|Romenia|RO|44.36|28.49|0.51|0.73|0.90|11483|2
INI|Nis|Servia|RS|43.34|21.86|0.51|0.65|1.00|8202|2
IQT|Iquitos|Peru|PE|-3.78|-73.31|0.51|0.52|1.50|8202|2
PSC|Pasco|EUA|US|46.26|-119.12|0.51|1.10|1.10|7707|2
RLG|Laage|Alemanha|DE|53.92|12.28|0.51|1.15|1.00|8202|2
RNO|Reno|EUA|US|39.50|-119.77|0.51|1.10|1.10|11001|2
UBA|Uberaba|Brasil|BR|-19.77|-47.96|0.51|0.68|0.85|5771|2
AER|Sochi|Russia|RU|43.45|39.96|0.50|0.68|1.60|9498|2
AKX|Aktobe|Cazaquistao|KZ|50.25|57.20|0.50|0.67|0.75|10505|2
CBR|Camberra|Australia|AU|-35.31|149.20|0.50|1.15|0.80|10771|2
CUZ|Cusco|Peru|PE|-13.54|-71.94|0.50|0.52|2.20|11146|2
DEB|Debrecen|Hungria|HU|47.49|21.62|0.50|0.85|1.60|8196|2
FAO|Faro|Portugal|PT|37.02|-7.97|0.50|0.78|2.00|8169|2
MLA|Malta|Malta|MT|35.85|14.49|0.50|0.90|1.90|10991|2
NQY|Newquay|Reino Unido|GB|50.44|-5.00|0.50|1.05|1.10|9003|2
PEG|Perugia|Italia|IT|43.10|12.51|0.50|1.00|1.40|7215|2
TML|Tamale|Gana|GH|9.55|-0.87|0.50|0.45|0.80|7999|2
YHZ|Halifax|Canada|CA|44.88|-63.51|0.50|0.95|0.90|10500|2
YNY|Gonghang-ro|Coreia do Sul|KR|38.06|128.67|0.50|1.12|1.30|8202|2
MQP|Mbombela|Africa do Sul|ZA|-25.38|31.11|0.49|0.65|1.20|10171|2
TSR|Timisoara|Romenia|RO|45.81|21.34|0.49|0.73|0.90|11483|2
BLL|Billund|Dinamarca|DK|55.74|9.16|0.48|1.40|1.30|10172|2
ICT|Wichita|EUA|US|37.65|-97.43|0.48|1.10|1.10|10302|2
KSC|Kosice|Eslovaquia|SK|48.66|21.24|0.48|0.88|0.90|10171|2
MQF|Magnitogorsk|Russia|RU|53.39|58.76|0.48|0.71|1.05|10663|2
MSN|Madison|EUA|US|43.14|-89.34|0.48|1.10|1.10|9006|2
MSU|Maseru|Lesoto|LS|-29.46|27.55|0.48|0.30|0.70|10498|2
PIA|Peoria|EUA|US|40.66|-89.69|0.48|1.10|1.10|10104|2
WUA|Wuhai|China|CN|39.79|106.80|0.48|0.80|1.00|8530|2
XIC|Liangshan|China|CN|27.99|102.18|0.48|0.80|1.00|11811|2
CHA|Chattanooga|EUA|US|35.04|-85.20|0.47|1.10|1.10|7400|2
LEI|Almeria|Espanha|ES|36.84|-2.37|0.47|0.85|1.90|10499|2
PTG|Polokwane|Africa do Sul|ZA|-23.85|29.46|0.47|0.65|1.20|8400|2
TOL|Toledo|EUA|US|41.59|-83.81|0.47|1.10|1.10|10600|2
GIZ|Jizan|Arabia Saudita|SA|16.90|42.59|0.46|0.97|1.10|10006|2
MLB|Melbourne|EUA|US|28.10|-80.64|0.46|1.10|1.10|10181|2
PNS|Pensacola|EUA|US|30.47|-87.19|0.46|1.10|1.10|7004|2
RBR|Rio Branco|Brasil|BR|-9.87|-67.89|0.46|0.68|0.85|7080|2
VST|Stockholm / Vasteras|Suecia|SE|59.59|16.63|0.46|1.23|1.00|8468|2
ZYL|Sylhet|Bangladesh|BD|24.96|91.86|0.46|0.35|0.50|9478|2
BHK|Bukhara|Uzbequistao|UZ|39.78|64.48|0.45|0.50|0.80|9843|2
JUB|Juba|Sudao do Sul|SS|4.87|31.60|0.45|0.20|0.50|10171|2
NCU|Nukus|Uzbequistao|UZ|42.49|59.62|0.45|0.50|0.80|9865|2
PBM|Paramaribo|Suriname|SR|5.45|-55.19|0.45|0.45|0.80|11417|2
SGC|Surgut|Russia|RU|61.34|73.41|0.45|0.71|1.05|9154|2
TRS|Ronchi dei|Italia|IT|45.83|13.47|0.45|1.00|1.40|9843|2
GRJ|George|Africa do Sul|ZA|-34.01|22.38|0.44|0.65|1.20|6562|2
HDY|Hat Yai|Tailandia|TH|6.93|100.39|0.44|0.60|2.00|10007|2
JUL|Juliaca|Peru|PE|-15.47|-70.16|0.44|0.52|1.50|13780|2
BQT|Brest|Belarus|BY|52.11|23.90|0.43|0.55|0.70|8596|2
CHS|Charleston|EUA|US|32.90|-80.04|0.43|1.10|1.10|9001|2
GEG|Spokane|EUA|US|47.62|-117.53|0.43|1.10|1.10|11002|2
MZT|Mazatlan|Mexico|MX|23.16|-106.26|0.43|0.69|1.30|8868|2
PED|Pardubice|Chequia|CZ|50.02|15.74|0.43|0.95|1.70|8203|2
AGT|Ciudad del Este|Paraguai|PY|-25.46|-54.84|0.42|0.55|0.70|11154|2
DLE|Dole|Franca|FR|47.04|5.43|0.42|1.12|1.35|7318|2
VAR|Varna|Bulgaria|BG|43.23|27.83|0.42|0.70|1.00|8258|2
XCR|Chalons en Champagne|Franca|FR|48.77|4.21|0.42|1.12|1.35|12664|2
CRA|Craiova|Romenia|RO|44.32|23.89|0.41|0.73|0.90|8203|2
GRB|Green Bay|EUA|US|44.48|-88.13|0.41|1.10|1.10|8700|2
ANC|Anchorage|Estados Unidos|US|61.18|-149.99|0.40|1.05|1.40|12400|2
BGO|Bergen|Noruega|NO|60.29|5.22|0.40|1.20|1.50|9810|2
CHC|Christchurch|Nova Zelandia|NZ|-43.49|172.53|0.40|1.20|1.60|10787|2
LCA|Larnaca|Chipre|CY|34.88|33.62|0.40|0.85|1.90|9823|2
PVR|Puerto Vallarta|Mexico|MX|20.68|-105.25|0.40|0.65|2.00|10171|2
TAZ|Dasoguz|Turcomenistao|TM|41.76|59.84|0.40|0.45|0.60|12467|2
TET|Tete|Mocambique|MZ|-16.10|33.64|0.40|0.30|0.80|8225|2
WLG|Wellington|Nova Zelandia|NZ|-41.33|174.81|0.40|1.05|1.00|6352|2
DOV|Filadelfia|EUA|US|39.13|-75.47|0.39|1.20|1.00|12903|2
GIB|Gibraltar|Gibraltar|GI|36.15|-5.35|0.39|1.10|1.50|6000|2
GSM|Qeshm|Ira|IR|26.75|55.90|0.39|0.45|0.80|13864|2
MOB|Mobile|EUA|US|30.69|-88.24|0.39|1.10|1.10|8502|2
PCL|Pucallpa|Peru|PE|-8.38|-74.57|0.39|0.52|1.50|9186|2
TKU|Turku|Finlandia|FI|60.51|22.26|0.39|1.30|1.10|8202|2
TUF|Tours, Indre-et-Loire|Franca|FR|47.43|0.73|0.39|1.12|1.35|7887|2
BND|Bandar Abbas|Ira|IR|27.22|56.38|0.38|0.45|0.80|12008|2
BPS|Porto Seguro|Brasil|BR|-16.44|-39.08|0.38|0.68|0.85|6562|2
CRP|Corpus Christi|EUA|US|27.77|-97.50|0.38|1.10|1.10|7510|2
HSV|Huntsville|EUA|US|34.64|-86.77|0.38|1.10|1.10|12600|2
HTS|Huntington|EUA|US|38.37|-82.56|0.38|1.10|1.10|7017|2
OAX|Oaxaca|Mexico|MX|17.00|-96.73|0.38|0.69|1.30|8038|2
OHS|Suhar|Oma|OM|24.39|56.63|0.38|0.95|1.30|13173|2
TGD|Podgorica|Montenegro|ME|42.36|19.25|0.38|0.62|1.70|8202|2
DMB|Taraz|Cazaquistao|KZ|42.85|71.30|0.37|0.67|0.75|9514|2
KZO|Kyzylorda|Cazaquistao|KZ|44.71|65.59|0.37|0.67|0.75|8858|2
MMK|Murmansk|Russia|RU|68.78|32.75|0.37|0.71|1.05|8202|2
PWQ|Pavlodar|Cazaquistao|KZ|52.19|77.07|0.37|0.67|0.75|8202|2
ROC|Rochester|EUA|US|43.12|-77.67|0.37|1.10|1.10|8001|2
SKX|Saransk|Russia|RU|54.13|45.21|0.37|0.71|1.05|9186|2
AQI|Qaisumah|Arabia Saudita|SA|28.34|46.13|0.36|0.97|1.10|10007|2
CAG|Cagliari|Italia|IT|39.25|9.05|0.36|1.00|1.40|9196|2
IQQ|Iquique|Chile|CL|-20.54|-70.18|0.36|0.70|1.30|10991|2
KLO|Kalibo|Filipinas|PH|11.68|122.38|0.36|0.47|1.05|7175|2
NJC|Nizhnevartovsk|Russia|RU|60.95|76.48|0.36|0.71|1.05|10499|2
PEV|Pecs|Hungria|HU|45.99|18.24|0.36|0.85|1.60|4922|2
PWM|Portland|EUA|US|43.65|-70.31|0.36|1.10|1.10|7200|2
SCV|Suceava|Romenia|RO|47.69|26.35|0.36|0.73|0.90|8070|2
UUD|Ulan Ude|Russia|RU|51.81|107.44|0.36|0.71|1.05|11155|2
AAC|El Arish|Egito|EG|31.06|33.83|0.35|0.45|2.00|9905|2
ABA|Abakan|Russia|RU|53.74|91.39|0.35|0.71|1.05|10663|2
AMQ|Ambon|Indonesia|ID|-3.71|128.09|0.35|0.50|0.90|8202|2
EDO|Edremit|Turquia|TR|39.55|27.01|0.35|0.65|1.30|9842|2
HTA|Chita|Russia|RU|52.02|113.31|0.35|0.71|1.05|9430|2
OHD|Ohrid|Macedonia do Norte|MK|41.18|20.74|0.35|0.55|0.90|8366|2
SUF|Lamezia Terme|Italia|IT|38.91|16.25|0.35|1.00|1.40|9898|2
TMM|Toamasina|Madagascar|MG|-18.11|49.39|0.35|0.25|1.20|7218|2
BSK|Biskra|Argelia|DZ|34.79|5.74|0.34|0.60|0.70|9469|2
GOM|Goma|Congo (Kinshasa)|CD|-1.67|29.24|0.34|0.22|0.50|9695|2
JAF|Jaffna|Sri Lanka|LK|9.79|80.07|0.34|0.45|1.70|4593|2
LAO|Laoag City|Filipinas|PH|18.18|120.53|0.34|0.47|1.05|9120|2
SAV|Savannah|EUA|US|32.13|-81.20|0.34|1.10|1.10|9351|2
TZL|Dubrave Gornje|Bosnia e Herzegovina|BA|44.46|18.72|0.34|0.60|1.00|8152|2
YLW|Kelowna|Canada|CA|49.96|-119.38|0.34|1.10|0.95|8900|2
BTJ|Banda Aceh|Indonesia|ID|5.53|95.42|0.33|0.50|0.90|9843|2
BWA|Siddharthanagar|Nepal|NP|27.50|83.41|0.33|0.35|1.90|9843|2
KSN|Kostanay|Cazaquistao|KZ|53.21|63.55|0.33|0.67|0.75|9229|2
LNZ|Linz|Austria|AT|48.24|14.19|0.33|1.25|1.50|9843|2
NYO|Nykoping|Suecia|SE|58.79|16.91|0.33|1.23|1.00|9442|2
SVG|Stavanger|Noruega|NO|58.88|5.64|0.33|1.20|1.20|9369|2
SYR|Syracuse|EUA|US|43.11|-76.11|0.33|1.10|1.10|9013|2
URA|Uralsk|Cazaquistao|KZ|51.15|51.54|0.33|0.67|0.75|9183|2
TJU|Kulob|Tajiquistao|TJ|37.99|69.81|0.32|0.28|0.80|9843|2
UKK|Ust-Kamenogorsk|Cazaquistao|KZ|50.04|82.50|0.32|0.67|0.75|8234|2
GUW|Atyrau|Cazaquistao|KZ|47.12|51.82|0.31|0.67|0.75|9842|2
BGI|Bridgetown|Barbados|BB|13.07|-59.49|0.30|0.72|1.90|11000|2
FNC|Funchal|Portugal|PT|32.70|-16.77|0.30|0.78|1.90|9110|2
IGU|Foz do Iguacu|Brasil|BR|-25.59|-54.49|0.30|0.60|2.20|8875|2
MJN|Mahajanga|Madagascar|MG|-15.67|46.35|0.30|0.25|1.20|7218|2
NAS|Nassau|Bahamas|BS|25.04|-77.47|0.30|0.75|2.10|11353|2
SJD|Los Cabos|Mexico|MX|23.15|-109.72|0.30|0.70|2.10|9843|2
SPU|Split|Croacia|HR|43.54|16.30|0.30|0.75|2.10|8366|2
BNX|Mahovljani|Bosnia e Herzegovina|BA|44.94|17.30|0.29|0.60|1.00|8202|2
LAQ|Al Albraq|Libia|LY|32.79|21.95|0.29|0.40|0.50|11824|2
PLX|Semey|Cazaquistao|KZ|50.35|80.23|0.29|0.67|0.75|10159|2
TYS|Knoxville/Maryville|EUA|US|35.81|-83.99|0.29|1.10|1.10|10000|2
GEO|Georgetown|Guiana|GY|6.50|-58.25|0.28|0.48|0.80|11023|2
HSA|Turkistan|Cazaquistao|KZ|43.31|68.55|0.28|0.67|0.75|10827|2
POM|Port Moresby|Papua-Nova Guine|PG|-9.44|147.22|0.28|0.34|0.90|9022|2
UUS|Yuzhno-Sakhalinsk|Russia|RU|46.89|142.72|0.28|0.71|1.05|11155|2
KLU|Klagenfurt am Worthersee|Austria|AT|46.64|14.34|0.27|1.25|1.50|8924|2
KQT|Bokhtar|Tajiquistao|TJ|37.87|68.86|0.27|0.28|0.80|7497|2
LWN|Gyumri|Armenia|AM|40.75|43.86|0.27|0.50|1.10|10564|2
BES|Brest|Franca|FR|48.45|-4.42|0.26|1.12|1.35|10171|2
BUS|Batumi|Georgia|GE|41.61|41.60|0.26|0.55|1.30|8202|2
INN|Innsbruck|Austria|AT|47.26|11.34|0.26|1.25|1.50|6562|2
KDU|Skardu|Paquistao|PK|35.34|75.54|0.26|0.40|0.60|11995|2
KUT|Kopitnari|Georgia|GE|42.18|42.49|0.26|0.55|1.30|8202|2
OUL|Oulu / Oulunsalo|Finlandia|FI|64.93|25.35|0.26|1.30|1.10|8205|2
BOJ|Burgas|Bulgaria|BG|42.57|27.52|0.25|0.70|1.00|10499|2
CFE|Clermont-Ferrand|Franca|FR|45.79|3.17|0.25|1.12|1.35|9885|2
CRZ|Turkmenabat|Turcomenistao|TM|38.93|63.56|0.25|0.45|0.60|12467|2
CZM|Cancun|Mexico|MX|20.51|-86.93|0.25|0.65|2.20|8858|2
DLM|Dalaman|Turquia|TR|36.71|28.79|0.25|0.65|1.30|9842|2
FDF|Fort-de-France|Martinica|MQ|14.59|-61.00|0.25|0.88|1.80|9843|2
JHG|Jinghong|China|CN|21.97|100.76|0.25|0.80|1.00|7874|2
LUX|Luxembourg|Luxemburgo|LU|49.63|6.21|0.25|1.55|1.00|13123|2
NSK|Norilsk|Russia|RU|69.31|87.33|0.25|0.71|1.05|11254|2
OMR|Oradea|Romenia|RO|47.03|21.90|0.25|0.73|0.90|8267|2
PKC|Petropavlovsk-Kamchatsky|Russia|RU|53.17|158.45|0.25|0.71|1.05|11155|2
PLQ|Palanga|Lituania|LT|55.97|21.09|0.25|0.85|1.00|7480|2
PPS|Puerto Princesa|Filipinas|PH|9.74|118.76|0.25|0.47|1.05|8530|2
PTP|Pointe-a-Pitre|Guadalupe|GP|16.27|-61.53|0.25|0.85|1.80|11499|2
DIL|Dili|Timor-Leste|TL|-8.55|125.52|0.24|0.30|0.80|6065|2
YKS|Yakutsk|Russia|RU|62.09|129.77|0.24|0.71|1.05|11155|2
ABZ|Aberdeen|Reino Unido|GB|57.20|-2.20|0.23|1.05|1.10|6407|2
BWN|Bandar Seri Begawan|Brunei|BN|4.94|114.93|0.23|1.00|0.90|12000|2
EUN|El Aaiun|Saara Ocidental|EH|27.14|-13.22|0.23|0.30|0.60|8861|2
FUE|El Matorral|Espanha|ES|28.45|-13.86|0.23|0.85|1.90|11220|2
PFO|Paphos|Chipre|CY|34.72|32.49|0.23|0.85|1.90|8858|2
ESM|Tachina|Equador|EC|0.98|-79.63|0.22|0.57|1.05|7874|2
ORU|Oruro|Bolivia|BO|-17.96|-67.08|0.22|0.46|1.05|8075|2
RTB|Coxen Hole|Honduras|HN|16.32|-86.52|0.22|0.36|0.70|7349|2
SNN|Shannon|Irlanda|IE|52.70|-8.92|0.22|1.15|1.15|10495|2
SRE|Sucre|Bolivia|BO|-19.25|-65.15|0.22|0.46|1.05|11811|2
AAL|Aalborg|Dinamarca|DK|57.09|9.85|0.21|1.40|1.30|8707|2
KOV|Kokshetau|Cazaquistao|KZ|53.33|69.59|0.21|0.67|0.75|8325|2
SZG|Salzburg|Austria|AT|47.79|13.00|0.21|1.25|1.50|9022|2
CNS|Cairns|Australia|AU|-16.88|145.75|0.20|0.98|1.90|10489|2
CUR|Willemstad|Curacao|CW|12.19|-68.96|0.20|0.70|1.80|11188|2
GUM|Guam|Guam|GU|13.48|144.80|0.20|0.95|1.60|12015|2
HER|Heraklion|Grecia|GR|35.34|25.18|0.20|0.75|2.20|8904|2
HRG|Hurghada|Egito|EG|27.18|33.80|0.20|0.45|2.00|13171|2
HUN|Hualien City|Taiwan|TW|24.02|121.62|0.20|1.07|1.15|9022|2
IBZ|Ibiza|Espanha|ES|38.87|1.37|0.20|0.85|2.20|9186|2
JCL|Ceske Budejovice|Chequia|CZ|48.95|14.43|0.20|0.95|1.70|8202|2
MLE|Male|Maldivas|MV|4.19|73.53|0.20|0.75|2.20|11155|2
MRU|Maurcio|Mauricio|MU|-20.43|57.68|0.20|0.75|2.20|11056|2
MUH|Marsa Matruh|Egito|EG|31.32|27.22|0.20|0.45|2.00|9843|2
NAN|Nadi|Fiji|FJ|-17.76|177.44|0.20|0.60|2.20|10739|2
OGG|Kahului|Estados Unidos|US|20.90|-156.43|0.20|1.00|2.10|6998|2
PPK|Petropavl|Cazaquistao|KZ|54.78|69.19|0.20|0.67|0.75|8190|2
XBJ|Birjand|Ira|IR|32.90|59.28|0.20|0.45|0.80|9521|2
YNB|Yanbu|Arabia Saudita|SA|24.14|38.06|0.20|0.97|1.10|10532|2
DNH|Dunhuang|China|CN|40.16|94.81|0.19|0.80|1.00|9186|2
HIR|Honiara|Ilhas Salomao|SB|-9.43|160.05|0.19|0.30|1.20|7218|2
KVA|Kavala|Grecia|GR|40.91|24.62|0.19|0.77|2.10|9844|2
SHO|Mpaka|Essuatini|SZ|-26.36|31.72|0.19|0.38|0.90|11811|2
SUV|Nausori|Fiji|FJ|-18.04|178.56|0.19|0.60|2.20|7047|2
VAA|Vaasa|Finlandia|FI|63.05|21.76|0.19|1.30|1.10|8727|2
LVI|Livingstone|Zambia|ZM|-17.82|25.82|0.18|0.32|0.80|9843|2
SAI|Siem Reap|Camboja|KH|13.37|104.22|0.18|0.35|1.40|11827|2
SCO|Aktau|Cazaquistao|KZ|43.86|51.09|0.18|0.67|0.75|10013|2
SSG|Malabo|Guine Equatorial|GQ|3.76|8.71|0.18|0.40|0.50|9647|2
YYT|St. John's|Canada|CA|47.62|-52.75|0.18|1.10|0.95|8502|2
BSG|Bata|Guine Equatorial|GQ|1.91|9.81|0.17|0.40|0.50|10860|2
DZN|Zhezkazgan|Cazaquistao|KZ|47.71|67.74|0.17|0.67|0.75|8530|2
KRS|Kristiansand|Noruega|NO|58.20|8.09|0.17|1.20|1.20|6677|2
KUO|Kuopio / Siilinjarvi|Finlandia|FI|63.01|27.80|0.17|1.30|1.10|9186|2
LGK|Langkawi|Malasia|MY|6.33|99.73|0.17|0.72|1.50|12500|2
NOS|Nosy Be|Madagascar|MG|-13.31|48.31|0.17|0.25|1.20|7185|2
PBH|Paro|Butao|BT|27.40|89.42|0.17|0.38|1.60|7431|2
CEI|Chiang Rai|Tailandia|TH|19.95|99.88|0.16|0.60|2.00|9843|2
POG|Port Gentil|Gabao|GA|-0.71|8.75|0.16|0.45|0.70|6234|2
PUY|Pula|Croacia|HR|44.89|13.92|0.16|0.75|2.10|9678|2
RAI|Praia|Cabo Verde|CV|14.94|-23.48|0.16|0.45|1.90|6890|2
SLL|Salalah|Oma|OM|17.04|54.09|0.16|0.95|1.30|13123|2
SNC|Salinas/La Libertad|Equador|EC|-2.21|-80.99|0.16|0.57|1.05|8629|2
NDB|Nouadhibou|Mauritania|MR|20.93|-17.03|0.15|0.30|0.60|7961|2
CRD|Comodoro Rivadavia|Argentina|AR|-45.79|-67.46|0.14|0.60|1.50|9219|2
DZA|Dzaoudzi|Maiote|YT|-12.81|45.28|0.14|0.70|1.30|6330|2
GOU|Garoua|Camaroes|CM|9.33|13.37|0.14|0.30|0.60|11032|2
KIM|Kimberley|Africa do Sul|ZA|-28.81|24.76|0.14|0.65|1.20|9843|2
WTB|Toowoomba|Australia|AU|-27.56|151.79|0.14|1.20|1.40|9416|2
AJF|Al-Jawf|Arabia Saudita|SA|29.78|40.10|0.13|0.97|1.10|12011|2
CAY|Matoury|Guiana Francesa|GF|4.82|-52.36|0.13|0.85|1.00|10486|2
ENO|Encarnacion|Paraguai|PY|-27.23|-55.84|0.13|0.55|0.70|7218|2
FRW|Francistown|Botsuana|BW|-21.16|27.47|0.13|0.52|1.30|9843|2
NAJ|Nakhchivan|Azerbaijao|AZ|39.19|45.46|0.13|0.70|1.00|10826|2
OCS|Corisco Island|Guine Equatorial|GQ|0.91|9.33|0.13|0.40|0.50|10220|2
UME|Umea|Suecia|SE|63.79|20.28|0.13|1.23|1.00|7551|2
WVB|Walvis Bay|Namibia|NA|-22.98|14.65|0.13|0.45|1.30|11483|2
LLA|Lulea|Suecia|SE|65.54|22.12|0.12|1.23|1.00|10990|2
MZG|Huxi|Taiwan|TW|23.57|119.63|0.12|1.07|1.15|9843|2
OMO|Mostar|Bosnia e Herzegovina|BA|43.28|17.85|0.12|0.60|1.00|7874|2
PUQ|Punta Arenas|Chile|CL|-53.00|-70.85|0.12|0.70|1.30|9154|2
RKZ|Xigaze|China|CN|29.35|89.30|0.12|0.80|1.00|16404|2
TOM|Timbuktu|Mali|ML|16.73|-3.01|0.12|0.24|0.60|6923|2
AQJ|Aqaba|Jordania|JO|29.61|35.02|0.11|0.70|1.20|9855|2
BZE|Belize City|Belize|BZ|17.54|-88.30|0.11|0.50|1.80|9678|2
IXZ|Port Blair|India|IN|11.64|92.73|0.11|0.52|0.90|10795|2
LPP|Lappeenranta|Finlandia|FI|61.04|28.14|0.11|1.30|1.10|8202|2
OZZ|Ouarzazate|Marrocos|MA|30.94|-6.91|0.11|0.54|1.65|9842|2
VIL|Dakhla|Saara Ocidental|EH|23.72|-15.93|0.11|0.30|0.60|9842|2
AUA|Oranjestad|Aruba|AW|12.50|-70.01|0.10|0.75|2.00|9000|2
DBV|Dubrovnik|Croacia|HR|42.56|18.27|0.10|0.75|2.20|10597|2
KBV|Krabi|Tailandia|TH|8.10|98.99|0.10|0.50|2.00|9842|2
MBJ|Montego Bay|Jamaica|JM|18.50|-77.91|0.10|0.48|2.10|10039|2
OLB|Olbia|Italia|IT|40.90|9.52|0.10|1.00|1.40|9006|2
PKZ|Pakse|Laos|LA|15.13|105.78|0.10|0.32|1.10|7874|2
PPT|Papeete|Polinesia Francesa|PF|-17.55|-149.61|0.10|0.85|2.10|11360|2
RGL|Rio Gallegos|Argentina|AR|-51.61|-69.31|0.10|0.60|1.50|9022|2
RHO|Rodes|Grecia|GR|36.41|28.09|0.10|0.72|2.10|10846|2
SEZ|Mahe|Seicheles|SC|-4.67|55.52|0.10|0.85|2.10|9800|2
SSH|Sharm el-Sheikh|Egito|EG|27.98|34.39|0.10|0.45|2.10|10108|2
SXM|Philipsburg|Sint Maarten|SX|18.04|-63.11|0.10|0.72|2.00|7546|2
ZAD|Zadar|Croacia|HR|44.10|15.35|0.10|0.75|2.10|8202|2
BXY|Baikonur|Cazaquistao|KZ|45.62|63.21|0.09|0.67|0.75|10500|2
CHQ|Souda|Grecia|GR|35.53|24.15|0.09|0.77|2.10|10982|2
MUB|Maun|Botsuana|BW|-19.97|23.43|0.09|0.52|1.30|6562|2
MYR|Myrtle Beach|EUA|US|33.68|-78.93|0.09|1.10|1.10|9503|2
ZIH|Ixtapa|Mexico|MX|17.60|-101.46|0.09|0.69|1.30|8222|2
AES|Alesund|Noruega|NO|62.56|6.11|0.08|1.20|1.20|7592|2
LAE|Lae|Papua-Nova Guine|PG|-6.57|146.73|0.08|0.34|0.90|8000|2
TMR|Tamanrasset|Argelia|DZ|22.81|5.45|0.08|0.60|0.70|11811|2
TUK|Turbat|Paquistao|PK|25.98|63.03|0.08|0.40|0.60|9022|2
BSA|Bosaso|Somalia|SO|11.28|49.14|0.07|0.20|0.50|7874|2
DSY|Ta Noun|Camboja|KH|10.91|103.23|0.07|0.35|1.40|10498|2
FPO|Freeport|Bahamas|BS|26.56|-78.70|0.07|0.75|2.10|11019|2
GWD|Gurandani|Paquistao|PK|25.30|62.50|0.07|0.40|0.60|12000|2
HAH|Moroni|Comores|KM|-11.53|43.27|0.07|0.24|1.00|9514|2
RVN|Rovaniemi|Finlandia|FI|66.56|25.83|0.07|1.30|1.10|9849|2
VXE|Sao Pedro|Cabo Verde|CV|16.83|-25.06|0.07|0.45|1.90|6561|2
ADZ|San Andres|Colombia|CO|12.58|-81.71|0.06|0.55|1.10|7808|2
LPQ|Luang Phabang|Laos|LA|19.90|102.17|0.06|0.32|1.10|8202|2
MAH|Mahon|Espanha|ES|39.86|4.22|0.06|0.85|1.90|8366|2
TOS|Tromso|Noruega|NO|69.68|18.92|0.06|1.20|1.20|8041|2
VFA|Victoria Falls|Zimbabue|ZW|-18.10|25.84|0.06|0.30|0.90|13123|2
ANU|Osbourn|Antigua e Barbuda|AG|17.14|-61.79|0.05|0.80|2.00|9003|2
CFU|Kerkyra|Grecia|GR|39.60|19.91|0.05|0.77|2.10|7792|2
MAJ|Majuro Atoll|Ilhas Marshall|MH|7.07|171.27|0.05|0.48|1.10|7897|2
SVD|Kingstown|Sao Vicente e Granadinas|VC|13.16|-61.15|0.05|0.62|1.80|9000|2
TMS|Sao Tome|Sao Tome e Principe|ST|0.38|6.71|0.05|0.30|1.40|7283|2
USM|Na Thon|Tailandia|TH|9.55|100.06|0.05|0.60|2.00|6759|2
UVF|Vieux Fort|Santa Lucia|LC|13.73|-60.95|0.05|0.65|1.90|9003|2
AEY|Akureyri|Islandia|IS|65.66|-18.07|0.04|1.15|2.10|8858|2
APW|Apia|Samoa|WS|-13.83|-172.01|0.04|0.40|1.50|9843|2
BBK|Kasane|Botsuana|BW|-17.83|25.17|0.04|0.52|1.30|6562|2
BDA|Hamilton|Bermudas|BM|32.36|-64.68|0.04|1.30|1.80|9705|2
BIA|Bastia|Franca|FR|42.55|9.48|0.04|1.12|1.35|8266|2
BME|Broome|Australia|AU|-17.95|122.23|0.04|1.20|1.40|7769|2
BON|Kralendijk|Caribe Neerlandes|BQ|12.13|-68.27|0.04|0.85|1.90|9449|2
BOO|Bodo|Noruega|NO|67.27|14.37|0.04|1.20|1.20|9167|2
CCK|West Island|Ilhas Cocos|CC|-12.19|96.83|0.04|0.80|1.20|7999|2
CXI|Kiritimati|Quiribati|KI|1.99|-157.35|0.04|0.35|1.10|6900|2
DBB|El Alamein|Egito|EG|30.92|28.46|0.04|0.45|2.00|11479|2
DJG|Djanet|Argelia|DZ|24.29|9.46|0.04|0.60|0.70|9843|2
DQM|Duqm|Oma|OM|19.50|57.63|0.04|0.95|1.30|13123|2
EIS|Beef Island|Ilhas Virgens Britanicas|VG|18.45|-64.54|0.04|0.95|2.00|4642|2
EVE|Evenes|Noruega|NO|68.49|16.68|0.04|1.20|1.20|9236|2
FAE|Vagar|Ilhas Feroe|FO|62.06|-7.28|0.04|1.15|1.50|5905|2
GAN|Gan|Maldivas|MV|-0.69|73.15|0.04|0.75|2.20|12000|2
GCM|George Town|Ilhas Cayman|KY|19.29|-81.36|0.04|1.25|2.00|7867|2
GND|Saint George's|Granada|GD|12.00|-61.79|0.04|0.62|1.80|9003|2
GOH|Nuuk|Groenlandia|GL|64.19|-51.68|0.04|1.00|1.60|7217|2
GXF|Seiyun|Iemen|YE|15.97|48.79|0.04|0.20|0.50|9843|2
HAQ|Haa Dhaalu Atoll|Maldivas|MV|6.74|73.17|0.04|0.75|2.20|8087|2
HUX|Huatulco|Mexico|MX|15.78|-96.26|0.04|0.69|1.30|8858|2
IKU|Tamchy|Quirguistao|KG|42.59|76.70|0.04|0.32|0.90|12467|2
IOM|Castletown|Ilha de Man|IM|54.08|-4.62|0.04|1.20|1.20|6923|2
IPC|Isla De Pascua|Chile|CL|-27.17|-109.42|0.04|0.70|1.30|10827|2
IVL|Ivalo|Finlandia|FI|68.61|27.41|0.04|1.30|1.10|8199|2
JTR|Santorini Island|Grecia|GR|36.40|25.48|0.04|0.77|2.10|7208|2
KGS|Kos Island|Grecia|GR|36.79|27.09|0.04|0.77|2.10|7841|2
KIH|Kish Island|Ira|IR|26.53|53.98|0.04|0.45|0.80|12004|2
KOA|Kailua-Kona|EUA|US|19.74|-156.05|0.04|1.10|1.10|11000|2
KRN|Kiruna|Suecia|SE|67.82|20.34|0.04|1.23|1.00|8209|2
KSA|Okat|Micronesia|FM|5.36|162.96|0.04|0.50|1.20|5750|2
KTT|Kittila|Finlandia|FI|67.70|24.85|0.04|1.30|1.10|8202|2
LIH|Lihue, Kauai|EUA|US|21.97|-159.34|0.04|1.10|1.10|6500|2
LTO|Loreto|Mexico|MX|25.99|-111.35|0.04|0.69|1.30|7218|2
MFU|Mfuwe|Zambia|ZM|-13.26|31.94|0.04|0.32|0.80|7349|2
NOC|Charlestown|Irlanda|IE|53.91|-8.82|0.04|1.15|1.15|7546|2
NUM|Sharma|Arabia Saudita|SA|27.92|35.29|0.04|0.97|1.10|12326|2
OEC|Oecussi-Ambeno|Timor-Leste|TL|-9.20|124.34|0.04|0.30|0.80|7218|2
PDL|Ponta Delgada|Portugal|PT|37.74|-25.70|0.04|0.84|1.90|8192|2
PHE|Port Hedland|Australia|AU|-20.38|118.63|0.04|1.20|1.40|8202|2
PLS|Providenciales|Ilhas Turcas e Caicos|TC|21.77|-72.27|0.04|0.90|2.10|9199|2
PPG|Pago Pago|Samoa Americana|AS|-14.33|-170.71|0.04|0.70|1.20|10000|2
RAR|Avarua|Ilhas Cook|CK|-21.20|-159.81|0.04|0.75|2.00|7638|2
RMF|Marsa Alam|Egito|EG|25.56|34.59|0.04|0.45|2.00|11253|2
ROP|Rota Island|Marianas do Norte|MP|14.17|145.24|0.04|0.75|1.70|6000|2
ROR|Babelthuap Island|Palau|PW|7.37|134.54|0.04|0.70|2.00|7200|2
RSI|Hanak|Arabia Saudita|SA|25.63|37.09|0.04|0.97|1.10|12139|2
SCR|Malung-Salen|Suecia|SE|61.17|12.83|0.04|1.23|1.00|8202|2
SID|Espargos|Cabo Verde|CV|16.74|-22.95|0.04|0.45|1.90|10760|2
SKB|Basseterre|Sao Cristovao e Neves|KN|17.31|-62.72|0.04|0.78|1.90|7602|2
STT|Charlotte Amalie|Ilhas Virgens Americanas|VI|18.34|-64.98|0.04|0.90|2.00|7000|2
TAB|Scarborough|Trinidad e Tobago|TT|11.15|-60.83|0.04|0.80|0.90|9002|2
TBU|Nuku'alofa|Tonga|TO|-21.24|-175.15|0.04|0.45|1.50|8795|2
TKK|Weno Island|Micronesia|FM|7.46|151.84|0.04|0.50|1.20|6006|2
TQO|Tulum|Mexico|MX|20.17|-87.66|0.04|0.69|1.30|12139|2
TRW|South Tarawa|Quiribati|KI|1.38|173.15|0.04|0.35|1.10|6598|2
ULH|Al-Ula|Arabia Saudita|SA|26.48|38.12|0.04|0.97|1.10|10007|2
UYU|Quijarro|Bolivia|BO|-20.44|-66.86|0.04|0.46|1.05|13123|2
VAV|Vava'u Island|Tonga|TO|-18.59|-173.96|0.04|0.45|1.50|5593|2
VBY|Visby|Suecia|SE|57.66|18.35|0.04|1.23|1.00|6562|2
VLI|Port Vila|Vanuatu|VU|-17.70|168.32|0.04|0.38|1.60|8530|2
WLS|Wallis Island|Wallis e Futuna|WF|-13.24|-176.20|0.04|0.75|1.20|6890|2
YAP|Yap Island|Micronesia|FM|9.50|138.08|0.04|0.50|1.20|6000|2
ZSA|San Salvador|Bahamas|BS|24.06|-74.52|0.04|0.75|2.10|8000|2
TEB|Nova York|EUA|US|40.85|-74.06|29.35|1.40|1.50|6997|1
HPN|Nova York|EUA|US|41.07|-73.71|29.16|1.40|1.50|6549|1
VKO|Moscou|Russia|RU|55.59|37.26|22.06|0.75|0.90|11483|1
LCY|Londres|Reino Unido|GB|51.51|0.06|21.23|1.30|1.60|4948|1
UKB|Osaka|Japao|JP|34.63|135.22|19.26|1.25|1.50|8202|1
SEN|Londres|Reino Unido|GB|51.57|0.69|18.33|1.30|1.60|6089|1
SNA|Los Angeles|EUA|US|33.68|-117.87|15.48|1.40|1.90|5700|1
HHR|Los Angeles|EUA|US|33.92|-118.33|14.95|1.40|1.90|4884|1
BUR|Los Angeles|EUA|US|34.20|-118.36|14.47|1.40|1.90|6886|1
THR|Teera|Ira|IR|35.69|51.31|13.83|0.45|0.80|13258|1
NBJ|Luanda|Angola|AO|-9.05|13.50|12.99|0.38|0.60|13123|1
PYK|Teera|Ira|IR|35.78|50.83|12.81|0.45|0.80|12005|1
ISP|Nova York|EUA|US|40.80|-73.10|10.36|1.40|1.50|7006|1
DTM|Colonia|Alemanha|DE|51.52|7.61|10.06|1.08|0.80|6562|1
HSG|Fukuoka|Japao|JP|33.15|130.30|7.53|1.20|1.20|6562|1
DAR|Dar es Salaam|Tanzania|TZ|-6.87|39.21|7.40|0.35|1.10|9843|1
USN|Busan|Coreia do Sul|KR|35.59|129.35|6.74|1.05|1.10|6561|1
YHU|Montreal|Canada|CA|45.52|-73.42|6.38|1.15|1.20|7840|1
TTN|Filadelfia|EUA|US|40.28|-74.81|6.35|1.20|1.00|6006|1
ANR|Bruxelas|Belgica|BE|51.19|4.46|6.19|1.30|1.10|4954|1
NRN|Colonia|Alemanha|DE|51.60|6.14|6.00|1.08|0.80|8005|1
CCR|Sao Francisco|EUA|US|37.99|-122.06|5.88|1.60|1.60|5001|1
BED|Boston|EUA|US|42.47|-71.29|5.76|1.45|1.20|7011|1
TNN|Kaohsiung|Taiwan|TW|22.95|120.21|5.76|1.00|1.00|10007|1
KKJ|Fukuoka|Japao|JP|33.85|131.04|5.60|1.20|1.20|8202|1
RGN|Yangon|Mianmar|MM|16.91|96.13|5.40|0.30|0.70|11200|1
ORH|Boston|EUA|US|42.27|-71.88|5.33|1.45|1.20|7001|1
SOC|Surakarta|Indonesia|ID|-7.52|110.76|5.26|0.50|0.90|8530|1
PZB|Durban|Africa do Sul|ZA|-29.65|30.40|4.83|0.60|1.20|5043|1
SFS|Clark|Filipinas|PH|14.79|120.27|4.69|0.45|0.90|9003|1
ADJ|Ama|Jordania|JO|31.97|35.99|4.62|0.70|1.20|10745|1
KNU|Lucknow|India|IN|26.40|80.41|4.27|0.42|0.90|9000|1
BBU|Bucareste|Romenia|RO|44.50|26.10|4.20|0.75|0.90|10499|1
QSR|Napoles|Italia|IT|40.62|14.91|4.07|0.78|1.60|6437|1
TAK|Osaka|Japao|JP|34.21|134.02|3.97|1.25|1.50|8200|1
ILG|Filadelfia|EUA|US|39.68|-75.61|3.87|1.20|1.00|7275|1
FMO|Colonia|Alemanha|DE|52.13|7.69|3.81|1.08|0.80|7119|1
EOH|Medellin|Colombia|CO|6.22|-75.59|3.74|0.65|1.30|8202|1
CYI|Kaohsiung|Taiwan|TW|23.46|120.39|3.71|1.00|1.00|10007|1
PHG|Port Harcourt|Nigeria|NG|4.85|7.02|3.67|0.47|0.55|6923|1
IWK|Iwakuni|Japao|JP|34.15|132.25|3.51|1.23|1.50|8000|1
TVT|Tashkent|Uzbequistao|UZ|41.31|69.40|3.47|0.50|0.80|10630|1
DLA|Duala|Camaroes|CM|4.01|9.72|3.40|0.30|0.60|9350|1
KTW|Cracovia|Polonia|PL|50.48|19.08|3.39|0.82|1.60|10499|1
HVN|Nova York|EUA|US|41.26|-72.89|3.33|1.40|1.50|5600|1
PAD|Buren|Alemanha|DE|51.61|8.62|3.32|1.15|1.00|7152|1
UBJ|Fukuoka|Japao|JP|33.93|131.28|3.29|1.20|1.20|8200|1
JOG|Yogyakarta|Indonesia|ID|-7.79|110.43|3.21|0.50|0.90|7215|1
TNR|Antananarivo|Madagascar|MG|-18.80|47.48|3.20|0.25|1.20|10171|1
TIW|Seattle|EUA|US|47.27|-122.58|3.05|1.45|1.20|5002|1
SOU|Southampton|Reino Unido|GB|50.95|-1.36|2.97|1.05|1.10|6191|1
BZX|Bazhong|China|CN|31.74|106.64|2.96|0.80|1.00|8530|1
BRS|Bristol|Reino Unido|GB|51.38|-2.72|2.94|1.05|1.10|6598|1
AZN|Andijan|Uzbequistao|UZ|40.73|72.29|2.92|0.50|0.80|9770|1
LUN|Lusaka|Zambia|ZM|-15.33|28.45|2.90|0.32|0.80|12998|1
BCD|Bacolod City|Filipinas|PH|10.78|123.02|2.81|0.47|1.05|6562|1
TKS|Osaka|Japao|JP|34.13|134.61|2.73|1.25|1.50|6560|1
KTM|Katmandu|Nepal|NP|27.70|85.36|2.70|0.35|1.90|10991|1
ASU|Assuncao|Paraguai|PY|-25.24|-57.52|2.50|0.55|0.70|10997|1
NGS|Fukuoka|Japao|JP|32.92|129.91|2.50|1.20|1.20|9840|1
RML|Colombo|Sri Lanka|LK|6.82|79.89|2.50|0.45|1.70|6013|1
SMR|Barranquilla|Colombia|CO|11.12|-74.23|2.49|0.55|0.80|5577|1
YCD|Vancouver|Canada|CA|49.05|-123.87|2.48|1.30|1.50|6602|1
KPO|Busan|Coreia do Sul|KR|35.99|129.42|2.37|1.05|1.10|7000|1
YND|Ottawa|Canada|CA|45.52|-75.56|2.32|1.05|0.90|6000|1
PNH|Phnom Penh|Camboja|KH|11.55|104.84|2.30|0.35|1.40|9843|1
PEI|Pereira|Colombia|CO|4.81|-75.74|2.29|0.55|1.10|6627|1
MZL|Manizales|Colombia|CO|5.03|-75.46|2.27|0.55|1.10|4835|1
EWB|New Bedford|EUA|US|41.68|-70.96|2.26|1.10|1.10|5400|1
MME|Darlington, Durham|Reino Unido|GB|54.51|-1.43|2.26|1.05|1.10|7516|1
ILS|San Salvador|El Salvador|SV|13.70|-89.12|2.10|0.45|0.90|7349|1
LAL|Tampa|Estados Unidos|US|27.99|-82.02|2.08|1.02|1.30|8500|1
AAZ|Quezaltenango|Guatemala|GT|14.87|-91.50|1.98|0.45|1.00|6900|1
SRZ|Santa Cruz|Bolivia|BO|-17.81|-63.17|1.98|0.50|0.80|9098|1
OCJ|Kingston|Jamaica|JM|18.40|-76.97|1.95|0.45|1.20|4769|1
CAK|Cleveland|Estados Unidos|US|40.92|-81.44|1.91|0.95|0.70|8204|1
JUH|Chizhou|China|CN|30.74|117.69|1.91|0.80|1.00|7874|1
OIT|Fukuoka|Japao|JP|33.48|131.74|1.91|1.20|1.20|9840|1
VVI|Santa Cruz|Bolivia|BO|-17.64|-63.14|1.90|0.50|0.80|11483|1
POP|Puerto Plata|Republica Dominicana|DO|19.76|-70.57|1.87|0.49|1.80|10108|1
TTU|Tetouan|Marrocos|MA|35.59|-5.32|1.85|0.54|1.65|10784|1
OZC|Ozamiz|Filipinas|PH|8.18|123.84|1.84|0.47|1.05|5720|1
MPM|Maputo|Mocambique|MZ|-25.92|32.57|1.80|0.30|0.80|12008|1
PHF|Newport News|EUA|US|37.13|-76.49|1.78|1.10|1.10|8003|1
FEG|Fergana|Uzbequistao|UZ|40.36|71.75|1.76|0.50|0.80|9383|1
SRQ|Tampa|Estados Unidos|US|27.39|-82.55|1.71|1.02|1.30|9500|1
PIK|Glasgow|Reino Unido|GB|55.50|-4.58|1.67|0.92|0.90|9800|1
MLW|Monrovia|Liberia|LR|6.29|-10.76|1.66|0.22|0.50|6000|1
MST|Eindhoven|Holanda|NL|50.91|5.77|1.64|1.10|0.70|9022|1
VIT|Bilbao|Espanha|ES|42.88|-2.72|1.62|0.92|1.10|11483|1
DSO|Sondong-ni|Coreia do Norte|KP|39.75|127.47|1.60|0.25|0.50|8210|1
HRE|Harare|Zimbabue|ZW|-17.93|31.09|1.60|0.30|0.90|15502|1
PGH|Pantnagar|India|IN|29.03|79.47|1.60|0.52|0.90|4500|1
SLZ|Sao Luis|Brasil|BR|-2.59|-44.24|1.60|0.52|0.90|7828|1
FLR|Firenze|Italia|IT|43.81|11.20|1.52|1.00|1.40|5118|1
BLB|Cidade do Panama|Panama|PA|8.91|-79.60|1.50|0.80|1.20|8500|1
OGD|Salt Lake City|Estados Unidos|US|41.20|-112.01|1.44|1.08|1.00|8107|1
LCK|Columbus|EUA|US|39.81|-82.93|1.40|1.10|1.10|12103|1
MGA|Managua|Nicaragua|NI|12.14|-86.17|1.40|0.35|0.80|8012|1
TGU|Tegucigalpa|Honduras|HN|14.06|-87.22|1.40|0.35|0.70|6112|1
QSF|Setif|Argelia|DZ|36.18|5.33|1.39|0.60|0.70|9498|1
CJN|Cijulang|Indonesia|ID|-7.72|108.49|1.38|0.50|0.90|4549|1
PSE|San Juan|Porto Rico|PR|18.01|-66.56|1.37|0.85|1.90|6904|1
SHL|Shillong|India|IN|25.70|91.98|1.36|0.52|0.90|6000|1
SIG|San Juan|Porto Rico|PR|18.46|-66.10|1.36|0.85|1.90|5317|1
MIR|Monastir|Tunisia|TN|35.76|10.75|1.35|0.55|1.30|9678|1
UST|St Augustine|EUA|US|29.96|-81.34|1.32|1.10|1.10|8001|1
CUM|Cumana|Venezuela|VE|10.45|-64.13|1.29|0.45|0.70|10171|1
KCY|Krasnoyarsk|Russia|RU|56.18|92.55|1.27|0.71|1.05|5905|1
IGT|Sunzha|Russia|RU|43.32|45.01|1.25|0.71|1.05|9842|1
VBS|Milao|Italia|IT|45.43|10.33|1.25|1.25|1.40|9810|1
XPL|Tegucigalpa|Honduras|HN|14.38|-87.62|1.23|0.35|0.70|8064|1
NRR|San Juan|Porto Rico|PR|18.25|-65.64|1.20|0.85|1.90|11000|1
CIY|Catania|Italia|IT|37.00|14.61|1.18|0.75|1.40|8070|1
SVZ|San Antonio del Tachira|Venezuela|VE|7.84|-72.44|1.18|0.45|0.70|6135|1
VRN|Milao|Italia|IT|45.39|10.89|1.17|1.25|1.40|10064|1
BLV|St. Louis|Estados Unidos|US|38.55|-89.84|1.15|1.02|0.70|10000|1
PMF|Milao|Italia|IT|44.83|10.30|1.15|1.25|1.40|6962|1
DND|Glasgow|Reino Unido|GB|56.45|-3.03|1.14|0.92|0.90|4593|1
FRL|Forli|Italia|IT|44.19|12.07|1.11|1.00|1.40|7907|1
OLM|Seattle|EUA|US|46.97|-122.90|1.11|1.45|1.20|5500|1
AQP|Arequipa|Peru|PE|-16.34|-71.57|1.10|0.50|1.00|9777|1
BYM|Bayamo|Cuba|CU|20.40|-76.62|1.09|0.40|1.70|6887|1
FNI|Marselha|Franca|FR|43.76|4.42|1.03|0.98|1.30|8005|1
WNP|Naga|Filipinas|PH|13.58|123.27|1.03|0.47|1.05|4599|1
BLJ|Batna|Argelia|DZ|35.75|6.31|1.02|0.60|0.70|9843|1
ONJ|Kitaakita|Japao|JP|40.19|140.37|1.00|1.23|1.50|6562|1
SAP|San Pedro Sula|Honduras|HN|15.45|-87.92|1.00|0.38|0.70|9203|1
AVN|Marselha|Franca|FR|43.91|4.90|0.99|0.98|1.30|6168|1
FNT|Flint|EUA|US|42.97|-83.74|0.99|1.10|1.10|7852|1
JUJ|San Salvador de Jujuy|Argentina|AR|-24.39|-65.10|0.99|0.60|1.50|9698|1
ADF|Adiyaman|Turquia|TR|37.73|38.47|0.97|0.65|1.30|8153|1
TND|Trinidad|Cuba|CU|21.79|-80.00|0.95|0.40|1.70|5909|1
MSJ|Misawa|Japao|JP|40.70|141.37|0.94|1.23|1.50|10000|1
AXT|Akita|Japao|JP|39.62|140.22|0.93|1.23|1.50|8200|1
OGZ|Beslan|Russia|RU|43.21|44.61|0.92|0.71|1.05|9843|1
CFG|Cienfuegos|Cuba|CU|22.15|-80.41|0.90|0.40|1.70|7874|1
VTE|Vientiane|Laos|LA|17.99|102.57|0.90|0.32|1.10|9843|1
JDF|Juiz de Fora|Brasil|BR|-21.79|-43.39|0.89|0.68|0.85|5036|1
LUK|Cincinnati|Estados Unidos|US|39.10|-84.42|0.88|1.00|0.70|6101|1
BHD|Belfast|Reino Unido|GB|54.62|-5.87|0.87|1.05|1.10|6001|1
EAS|Bilbao|Espanha|ES|43.36|-1.79|0.83|0.92|1.10|5755|1
IAG|Niagara Falls|EUA|US|43.11|-78.95|0.83|1.10|1.10|9826|1
ARK|Kilimanjaro|Tanzania|TZ|-3.37|36.63|0.82|0.30|1.80|5377|1
IZO|Izumo|Japao|JP|35.41|132.89|0.81|1.23|1.50|6562|1
RJL|Bilbao|Espanha|ES|42.46|-2.32|0.81|0.92|1.10|7218|1
FDH|Friedrichshafen|Alemanha|DE|47.67|9.51|0.80|1.15|1.00|7729|1
TLU|Santiago de Tolu|Colombia|CO|9.51|-75.59|0.80|0.55|1.10|4429|1
ZSE|Saint-Denis|Reuniao|RE|-21.32|55.42|0.80|0.85|1.50|7000|1
ABE|Filadelfia|EUA|US|40.65|-75.44|0.79|1.20|1.00|7599|1
KWZ|Kolwezi|Congo (Kinshasa)|CD|-10.77|25.51|0.79|0.22|0.50|5741|1
PRA|Parana|Argentina|AR|-31.79|-60.48|0.79|0.60|1.50|6890|1
SZA|Soyo|Angola|AO|-6.14|12.37|0.79|0.38|0.60|5905|1
DNZ|Denizli|Turquia|TR|37.79|29.70|0.76|0.65|1.30|9842|1
ECN|Larnaca|Chipre|CY|35.15|33.51|0.75|0.85|1.90|9039|1
PNA|Bilbao|Espanha|ES|42.77|-1.65|0.75|0.92|1.10|7241|1
CNQ|Corrientes|Argentina|AR|-27.45|-58.76|0.73|0.60|1.50|6890|1
GOX|Goa|India|IN|15.74|73.86|0.73|0.52|2.00|11483|1
KAC|Qamishli|Siria|SY|37.02|41.19|0.73|0.25|0.50|11860|1
MPL|Marselha|Franca|FR|43.58|3.96|0.73|0.98|1.30|8530|1
TOW|Toledo|Brasil|BR|-24.69|-53.70|0.73|0.68|0.85|5479|1
MFE|McAllen|EUA|US|26.18|-98.24|0.72|1.10|1.10|7120|1
BTS|Bratislava|Eslovaquia|SK|48.17|17.21|0.70|0.88|0.90|10466|1
SPY|San-Pedro|Costa do Marfim|CI|4.75|-6.66|0.70|0.35|0.80|6234|1
UDI|Uberlandia|Brasil|BR|-18.88|-48.23|0.70|0.82|0.60|6398|1
KME|Kamembe|Ruanda|RW|-2.46|28.91|0.69|0.32|1.00|4921|1
PUB|Pueblo|EUA|US|38.29|-104.50|0.69|1.10|1.10|10498|1
DCM|Castres|Franca|FR|43.56|2.29|0.68|1.12|1.35|5988|1
IXY|Kandla|India|IN|23.11|70.10|0.68|0.52|0.90|4997|1
CMF|Lyon|Franca|FR|45.64|5.88|0.67|1.05|1.00|6628|1
GDQ|Azezo|Etiopia|ET|12.52|37.43|0.67|0.35|0.80|9072|1
LCE|La Ceiba|Honduras|HN|15.74|-86.85|0.67|0.36|0.70|9875|1
LCG|Culleredo|Espanha|ES|43.30|-8.38|0.67|0.85|1.90|7178|1
PGD|Punta Gorda|EUA|US|26.92|-81.99|0.67|1.10|1.10|7193|1
PKR|Pokhara|Nepal|NP|28.20|83.98|0.67|0.35|1.90|4720|1
ULV|Ulyanovsk|Russia|RU|54.27|48.23|0.64|0.71|1.05|12533|1
DEF|Dezful|Ira|IR|32.43|48.40|0.62|0.45|0.80|12641|1
MEG|Malanje|Angola|AO|-9.53|16.31|0.62|0.38|0.60|7283|1
CZE|Coro|Venezuela|VE|11.41|-69.68|0.61|0.45|0.70|6761|1
HEH|Heho|Mianmar|MM|20.75|96.79|0.61|0.30|0.70|8500|1
BJR|Bahir Dar|Etiopia|ET|11.61|37.32|0.60|0.35|0.80|9842|1
LDB|Londrina|Brasil|BR|-23.33|-51.13|0.60|0.80|0.60|6890|1
MQX|Mekele|Etiopia|ET|13.47|39.53|0.60|0.35|0.80|11811|1
MVR|Maroua|Camaroes|CM|10.45|14.26|0.60|0.30|0.60|6890|1
NYI|Sunyani|Gana|GH|7.36|-2.33|0.60|0.45|0.80|4594|1
PVH|Porto Velho|Brasil|BR|-8.71|-63.90|0.60|0.60|0.60|7874|1
SDD|Lubango|Angola|AO|-14.92|13.58|0.60|0.38|0.60|10335|1
SYO|Shonai|Japao|JP|38.81|139.79|0.60|1.23|1.50|6560|1
VTU|Las Tunas|Cuba|CU|20.99|-76.94|0.60|0.40|1.70|5971|1
KKW|Kikwit|Congo (Kinshasa)|CD|-5.04|18.79|0.59|0.22|0.50|5151|1
LNS|Lancaster|EUA|US|40.12|-76.30|0.59|1.10|1.10|6933|1
ASM|Asmara|Eritreia|ER|15.29|38.91|0.58|0.20|0.50|9842|1
MZO|Manzanillo|Cuba|CU|20.29|-77.09|0.58|0.40|1.70|7875|1
PBD|Porbandar|India|IN|21.65|69.66|0.58|0.52|0.90|4500|1
LSP|Paraguana|Venezuela|VE|11.78|-70.15|0.57|0.45|0.70|9186|1
PAG|Pagadian|Filipinas|PH|7.83|123.46|0.57|0.47|1.05|6574|1
PPN|Popayan|Colombia|CO|2.45|-76.61|0.57|0.55|1.10|6266|1
UYL|Nyala|Sudao|SD|12.05|24.96|0.57|0.24|0.50|9880|1
VSV|Shravasti|India|IN|27.50|82.03|0.57|0.52|0.90|5019|1
AHU|Al Hoceima|Marrocos|MA|35.18|-3.84|0.56|0.54|1.65|10511|1
MRA|Misrata|Libia|LY|32.33|15.06|0.56|0.40|0.50|11155|1
VRB|Vero Beach|EUA|US|27.66|-80.42|0.56|1.10|1.10|7314|1
ADU|Ardabil|Ira|IR|38.33|48.42|0.55|0.45|0.80|10823|1
DIB|Dibrugarh|India|IN|27.48|95.02|0.55|0.52|0.90|6000|1
HGO|Korhogo|Costa do Marfim|CI|9.39|-5.56|0.55|0.35|0.80|6890|1
SOM|El Tigre|Venezuela|VE|8.95|-64.15|0.55|0.45|0.70|6299|1
HJR|Khajuraho|India|IN|24.82|79.92|0.54|0.52|0.90|7460|1
MDK|Mbandaka|Congo (Kinshasa)|CD|0.02|18.29|0.53|0.22|0.50|7223|1
PSO|Chachagui|Colombia|CO|1.40|-77.29|0.53|0.55|1.10|7585|1
MKG|Muskegon|EUA|US|43.17|-86.24|0.52|1.10|1.10|6500|1
TGM|Cluj|Romenia|RO|46.47|24.41|0.52|0.72|0.90|6562|1
UAQ|San Juan|Argentina|AR|-31.57|-68.42|0.52|0.60|1.50|8071|1
VPY|Chimoio|Mocambique|MZ|-19.15|33.43|0.52|0.30|0.80|7874|1
BZR|Marselha|Franca|FR|43.32|3.35|0.51|0.98|1.30|5971|1
SDG|Sanandaj|Ira|IR|35.25|47.01|0.51|0.45|0.80|8660|1
TBB|Tuy Hoa|Vietna|VN|13.05|109.33|0.51|0.58|1.40|9520|1
BWX|Rogojampi, Banyuwangi|Indonesia|ID|-8.31|114.34|0.50|0.50|0.90|4593|1
CLJ|Cluj|Romenia|RO|46.79|23.69|0.50|0.72|0.90|6693|1
ETR|Santa Rosa|Equador|EC|-3.44|-80.00|0.50|0.57|1.05|8625|1
LJU|Liubliana|Eslovenia|SI|46.22|14.46|0.50|0.95|1.10|10827|1
MCP|Macapa|Brasil|BR|0.05|-51.07|0.50|0.55|0.60|6890|1
MVQ|Mogilev|Belarus|BY|53.95|30.10|0.50|0.55|0.70|8422|1
MVY|Martha's Vineyard|EUA|US|41.39|-70.61|0.50|1.10|1.10|5504|1
ONQ|Zonguldak|Turquia|TR|41.51|32.09|0.50|0.65|1.30|6991|1
UNA|Una|Brasil|BR|-15.35|-39.00|0.50|0.68|0.85|6234|1
BUX|Bunia|Congo (Kinshasa)|CD|1.57|30.22|0.49|0.22|0.50|8202|1
DGT|Dumaguete City|Filipinas|PH|9.33|123.30|0.49|0.47|1.05|6220|1
NAL|Nalchik|Russia|RU|43.51|43.64|0.49|0.71|1.05|7218|1
PPB|Presidente Prudente|Brasil|BR|-22.18|-51.42|0.49|0.68|0.85|6923|1
TKF|Truckee|EUA|US|39.32|-120.14|0.49|1.10|1.10|7001|1
JRH|Jorhat|India|IN|26.73|94.18|0.48|0.52|0.90|9000|1
KZR|Altintas|Turquia|TR|39.11|30.13|0.48|0.65|1.30|9843|1
MII|Marilia|Brasil|BR|-22.20|-49.93|0.48|0.68|0.85|4921|1
MYY|Miri|Malasia|MY|4.32|113.99|0.48|0.72|1.50|9006|1
TAP|Tapachula|Mexico|MX|14.79|-92.37|0.48|0.69|1.30|6562|1
ARU|Aracatuba|Brasil|BR|-21.14|-50.42|0.47|0.68|0.85|6955|1
GXG|Negage|Angola|AO|-7.75|15.29|0.47|0.38|0.60|7874|1
KOE|Kupang|Indonesia|ID|-10.17|123.67|0.47|0.50|0.90|8202|1
NLD|Nuevo Laredo|Mexico|MX|27.44|-99.57|0.47|0.69|1.30|6562|1
NYU|Nyaung U|Mianmar|MM|21.18|94.93|0.47|0.30|0.70|8500|1
VDH|Dong Hoi|Vietna|VN|17.52|106.59|0.47|0.58|1.40|7874|1
MRX|Mahshahr|Ira|IR|30.56|49.15|0.46|0.45|0.80|8874|1
NVA|Neiva|Colombia|CO|2.95|-75.29|0.46|0.55|1.10|5880|1
PDT|Pendleton|EUA|US|45.70|-118.84|0.46|1.10|1.10|6301|1
STM|Santarem|Brasil|BR|-2.42|-54.79|0.46|0.68|0.85|7874|1
ARW|Arad|Romenia|RO|46.18|21.26|0.45|0.73|0.90|6562|1
BMI|Bloomington/Normal|EUA|US|40.48|-88.92|0.45|1.10|1.10|8000|1
BRO|Brownsville|EUA|US|25.91|-97.43|0.45|1.10|1.10|7399|1
EBD|El-Obeid|Sudao|SD|13.15|30.23|0.45|0.24|0.50|9843|1
GBB|Gabala|Azerbaijao|AZ|40.81|47.73|0.45|0.70|1.00|11811|1
HEK|Heihe|China|CN|50.17|127.31|0.45|0.80|1.00|8202|1
KEP|Nepalgunj|Nepal|NP|28.10|81.67|0.45|0.35|1.90|4935|1
TWU|Tawau|Malasia|MY|4.31|118.12|0.45|0.72|1.50|8800|1
WOS|Wonsan|Coreia do Norte|KP|39.17|127.49|0.45|0.25|0.50|11482|1
BKS|Bengkulu|Indonesia|ID|-3.86|102.34|0.44|0.50|0.90|7345|1
CFR|Caen|Franca|FR|49.18|-0.45|0.44|1.12|1.35|6233|1
DIU|Diu|India|IN|20.71|70.92|0.44|0.52|0.90|5980|1
DMU|Dimapur|India|IN|25.88|93.77|0.44|0.52|0.90|7513|1
DUE|Chitato|Angola|AO|-7.40|20.82|0.44|0.38|0.60|6468|1
KSL|Kassala|Sudao|SD|15.39|36.33|0.44|0.24|0.50|8202|1
MVF|Mossoro|Brasil|BR|-5.20|-37.36|0.44|0.68|0.85|6562|1
PAZ|Poza Rica|Mexico|MX|20.60|-97.46|0.44|0.69|1.30|5906|1
SDK|Sandakan|Malasia|MY|5.90|118.06|0.44|0.72|1.50|8202|1
SZY|Szymany|Polonia|PL|53.48|20.94|0.44|0.81|1.10|8202|1
FJR|Dubai|Emirados|AE|25.11|56.33|0.43|1.35|2.20|10007|1
IMP|Imperatriz|Brasil|BR|-5.53|-47.46|0.43|0.68|0.85|5899|1
SGD|Sonderborg|Dinamarca|DK|54.96|9.79|0.43|1.40|1.30|5895|1
SLD|Sliac|Eslovaquia|SK|48.64|19.13|0.43|0.88|0.90|7874|1
TPQ|Tepic|Mexico|MX|21.42|-104.84|0.43|0.69|1.30|10171|1
ATW|Appleton|EUA|US|44.26|-88.52|0.42|1.10|1.10|8003|1
FLA|Florencia|Colombia|CO|1.59|-75.56|0.42|0.55|1.10|4921|1
TEE|Tebessi|Argelia|DZ|35.43|8.12|0.42|0.60|0.70|9843|1
VAS|Sivas|Turquia|TR|39.81|36.90|0.42|0.65|1.30|12503|1
VLL|Valladolid|Espanha|ES|41.71|-4.85|0.42|0.85|1.90|9843|1
CJZ|Cajazeiras|Brasil|BR|-6.88|-38.62|0.41|0.68|0.85|5249|1
DUM|Dumai|Indonesia|ID|1.61|101.43|0.41|0.50|0.90|5905|1
ERS|Windhoek|Namibia|NA|-22.60|17.08|0.41|0.45|1.30|7381|1
IEG|Nowe Kramsko|Polonia|PL|52.14|15.80|0.41|0.81|1.10|8202|1
ISE|Isparta|Turquia|TR|37.86|30.37|0.41|0.65|1.30|9843|1
KRP|Karup|Dinamarca|DK|56.30|9.10|0.41|1.40|1.30|9816|1
SBW|Sibu|Malasia|MY|2.26|111.99|0.41|0.72|1.50|9036|1
TBO|Tabora|Tanzania|TZ|-5.08|32.83|0.41|0.32|1.45|6234|1
ANF|Antofagasta|Chile|CL|-23.45|-70.45|0.40|0.70|0.70|9186|1
BVB|Boa Vista|Brasil|BR|2.85|-60.69|0.40|0.58|0.70|8858|1
DHM|Kangra|India|IN|32.16|76.26|0.40|0.52|0.90|4620|1
GDB|Gondia|India|IN|21.53|80.29|0.40|0.52|0.90|7500|1
JJD|Cruz|Brasil|BR|-2.91|-40.36|0.40|0.68|0.85|7218|1
PSS|Posadas|Argentina|AR|-27.39|-55.97|0.40|0.60|1.50|7388|1
PXU|Pleiku|Vietna|VN|14.00|108.02|0.40|0.58|1.40|7874|1
TPS|Palermo|Italia|IT|37.91|12.49|0.40|0.72|1.40|8852|1
VVC|Villavicencio|Colombia|CO|4.17|-73.61|0.40|0.55|1.10|5616|1
WDH|Windhoek|Namibia|NA|-22.48|17.47|0.40|0.45|1.30|15010|1
AGH|Angelholm|Suecia|SE|56.30|12.85|0.39|1.23|1.00|6381|1
BAY|Tautii-Magheraus|Romenia|RO|47.66|23.46|0.39|0.73|0.90|7054|1
BUZ|Bushehr|Ira|IR|28.94|50.83|0.39|0.45|0.80|14664|1
CSW|Los Cabos|Mexico|MX|22.95|-109.94|0.39|0.70|2.10|6998|1
IXI|Lilabari|India|IN|27.30|94.10|0.39|0.52|0.90|7500|1
KMW|Kostroma|Russia|RU|57.80|41.02|0.39|0.71|1.05|5577|1
KSQ|Karshi|Uzbequistao|UZ|38.80|65.77|0.39|0.50|0.80|9299|1
MAB|Maraba|Brasil|BR|-5.37|-49.14|0.39|0.68|0.85|6562|1
MSR|Mus|Turquia|TR|38.75|41.66|0.39|0.65|1.30|11649|1
NCY|Lyon|Franca|FR|45.93|6.10|0.39|1.05|1.00|5348|1
OSW|Orsk|Russia|RU|51.07|58.60|0.39|0.71|1.05|9514|1
PLW|Palu|Indonesia|ID|-0.92|119.91|0.39|0.50|0.90|6781|1
TUA|Tulcan|Equador|EC|0.81|-77.71|0.39|0.57|1.05|8071|1
ZND|Zinder|Niger|NE|13.78|8.98|0.39|0.20|0.50|5988|1
FLZ|Sibolga|Indonesia|ID|1.56|98.89|0.38|0.50|0.90|5655|1
GEL|Santo Angelo|Brasil|BR|-28.28|-54.17|0.38|0.68|0.85|5331|1
HGI|Hollongi|India|IN|26.97|93.64|0.38|0.52|0.90|7546|1
LMM|Los Mochis|Mexico|MX|25.69|-109.08|0.38|0.69|1.30|6562|1
NVI|Navoi|Uzbequistao|UZ|40.12|65.17|0.38|0.50|0.80|13123|1
RXS|Roxas City|Filipinas|PH|11.60|122.75|0.38|0.47|1.05|6201|1
CSG|Columbus|EUA|US|32.52|-84.94|0.37|1.10|1.10|6997|1
HHQ|Hua Hin|Tailandia|TH|12.64|99.95|0.37|0.60|2.00|6890|1
MNC|Nacala|Mocambique|MZ|-14.49|40.71|0.37|0.30|0.80|10171|1
SLI|Solwesi|Zambia|ZM|-12.17|26.37|0.37|0.32|0.80|8858|1
TIV|Tivat|Montenegro|ME|42.40|18.72|0.37|0.62|1.70|8208|1
UEL|Quelimane|Mocambique|MZ|-17.86|36.87|0.37|0.30|0.80|5905|1
AXU|Axum|Etiopia|ET|14.15|38.77|0.36|0.35|0.80|7874|1
BHI|Bahia Blanca|Argentina|AR|-38.73|-62.17|0.36|0.60|1.50|7907|1
BJB|Bojnord|Ira|IR|37.49|57.31|0.36|0.45|0.80|10582|1
BSX|Pathein|Mianmar|MM|16.82|94.78|0.36|0.30|0.70|4400|1
CKS|Parauapebas|Brasil|BR|-6.12|-50.00|0.36|0.68|0.85|6562|1
EUG|Eugene|EUA|US|44.12|-123.21|0.36|1.10|1.10|8009|1
MAZ|San Juan|Porto Rico|PR|18.26|-67.15|0.36|0.85|1.90|4998|1
PAV|Paulo Afonso|Brasil|BR|-9.40|-38.25|0.36|0.68|0.85|5906|1
AJL|Aizawl|India|IN|23.84|92.62|0.35|0.52|0.90|8202|1
ELU|Guemar|Argelia|DZ|33.51|6.78|0.35|0.60|0.70|9843|1
FAY|Fayetteville|EUA|US|34.99|-78.88|0.35|1.10|1.10|7709|1
JIM|Jimma|Etiopia|ET|7.67|36.82|0.35|0.35|0.80|10236|1
KDI|Kendari|Indonesia|ID|-4.08|122.42|0.35|0.50|0.90|6890|1
KYP|Kyaukpyu|Mianmar|MM|19.43|93.53|0.35|0.30|0.70|4600|1
PHB|Parnaiba|Brasil|BR|-2.89|-41.73|0.35|0.68|0.85|6890|1
PTO|Pato Branco|Brasil|BR|-26.22|-52.69|0.35|0.68|0.85|5318|1
SBN|South Bend|EUA|US|41.71|-86.32|0.35|1.10|1.10|8412|1
BTR|Baton Rouge|EUA|US|30.53|-91.15|0.34|1.10|1.10|7500|1
CEE|Cherepovets|Russia|RU|59.27|38.02|0.34|0.71|1.05|8202|1
CUP|Carupano|Venezuela|VE|10.66|-63.26|0.34|0.45|0.70|6611|1
LNK|Lincoln|EUA|US|40.84|-96.76|0.34|1.10|1.10|12901|1
LOH|La Toma|Equador|EC|-4.00|-79.37|0.34|0.57|1.05|6725|1
LSC|La Serena-Coquimbo|Chile|CL|-29.92|-71.20|0.34|0.70|1.30|6358|1
RIA|Santa Maria|Brasil|BR|-29.71|-53.69|0.34|0.68|0.85|8839|1
RNS|Saint-Jacques-de-la-Lande,|Franca|FR|48.07|-1.73|0.34|1.12|1.35|6890|1
SUJ|Satu Mare|Romenia|RO|47.70|22.89|0.34|0.73|0.90|8160|1
TEZ|Nagaon|India|IN|26.71|92.78|0.34|0.52|0.90|9010|1
AMH|Arba Minch|Etiopia|ET|6.04|37.59|0.33|0.35|0.80|9170|1
BZO|Bolzano|Italia|IT|46.46|11.33|0.33|1.00|1.40|5708|1
CHM|Chimbote|Peru|PE|-9.15|-78.52|0.33|0.52|1.50|5905|1
CVM|Ciudad Victoria|Mexico|MX|23.70|-98.96|0.33|0.69|1.30|7218|1
DEC|Decatur|EUA|US|39.83|-88.87|0.33|1.10|1.10|8496|1
HCJ|Hechi|China|CN|24.80|107.71|0.33|0.80|1.00|7218|1
IXS|Silchar|India|IN|24.91|92.98|0.33|0.52|0.90|5993|1
KET|Kengtung|Mianmar|MM|21.30|99.64|0.33|0.30|0.70|7815|1
MWQ|Magway|Mianmar|MM|20.17|94.94|0.33|0.30|0.70|8530|1
NAW|Yala|Tailandia|TH|6.52|101.74|0.33|0.60|2.00|8202|1
PGK|Pangkal Pinang|Indonesia|ID|-2.16|106.14|0.33|0.50|0.90|7382|1
RZR|Ramsar|Ira|IR|36.91|50.69|0.33|0.45|0.80|7448|1
VPS|Valparaiso|EUA|US|30.48|-86.52|0.33|1.10|1.10|12004|1
FWA|Fort Wayne|EUA|US|40.98|-85.19|0.32|1.10|1.10|11981|1
ITH|Ithaca|EUA|US|42.49|-76.46|0.32|1.10|1.10|6977|1
KXK|Komsomolsk-on-Amur|Russia|RU|50.41|136.93|0.32|0.71|1.05|8202|1
LBU|Labuan|Malasia|MY|5.30|115.25|0.32|0.72|1.50|9006|1
LRD|Laredo|EUA|US|27.54|-99.46|0.32|1.10|1.10|8743|1
MLI|Moline|EUA|US|41.45|-90.51|0.32|1.10|1.10|10002|1
NRK|Norrkoping|Suecia|SE|58.59|16.25|0.32|1.23|1.00|7228|1
OPP|Salinopolis|Brasil|BR|-0.70|-47.34|0.32|0.68|0.85|6102|1
PKY|Palangkaraya|Indonesia|ID|-2.23|113.94|0.32|0.50|0.90|8202|1
SBP|San Luis Obispo|EUA|US|35.24|-120.64|0.32|1.10|1.10|6101|1
TCQ|Tacna|Peru|PE|-18.05|-70.28|0.32|0.52|1.50|8202|1
TRK|Tarakan|Indonesia|ID|3.33|117.56|0.32|0.50|0.90|7382|1
VOL|Nea Anchialos|Grecia|GR|39.22|22.79|0.32|0.77|2.10|9052|1
YBG|Saguenay|Canada|CA|48.33|-70.99|0.32|1.10|0.95|10000|1
BQS|Blagoveschensk|Russia|RU|50.43|127.42|0.31|0.71|1.05|9256|1
CXB|Cox's Bazar|Bangladesh|BD|21.46|91.96|0.31|0.35|0.50|6790|1
CYP|Calbayog City|Filipinas|PH|12.07|124.55|0.31|0.47|1.05|4843|1
GVR|Governador Valadares|Brasil|BR|-18.90|-41.98|0.31|0.68|0.85|5581|1
HAU|Karmoy|Noruega|NO|59.35|5.21|0.31|1.20|1.20|6957|1
KRO|Kurgan|Russia|RU|55.48|65.42|0.31|0.71|1.05|8530|1
MYP|Mary|Turcomenistao|TM|37.62|61.90|0.31|0.45|0.60|12467|1
PBR|Puerto Barrios|Guatemala|GT|15.73|-88.58|0.31|0.45|1.00|8880|1
PES|Petrozavodsk|Russia|RU|61.89|34.15|0.31|0.71|1.05|8202|1
XNA|Fayetteville/Springdale/Ro|EUA|US|36.28|-94.31|0.31|1.10|1.10|8801|1
YQR|Regina|Canada|CA|50.43|-104.66|0.31|1.10|0.95|7900|1
ELF|El Fasher|Sudao|SD|13.61|25.32|0.30|0.24|0.50|9744|1
HUU|Huanuco|Peru|PE|-9.88|-76.20|0.30|0.52|1.50|8202|1
LPT|Lampang|Tailandia|TH|18.27|99.50|0.30|0.60|2.00|6465|1
LRH|La Rochelle|Franca|FR|46.18|-1.20|0.30|1.12|1.35|7398|1
MBS|Freeland|EUA|US|43.53|-84.08|0.30|1.10|1.10|8002|1
MSZ|Mocamedes|Angola|AO|-15.26|12.15|0.30|0.38|0.60|8202|1
OGX|Ouargla|Argelia|DZ|31.92|5.41|0.30|0.60|0.70|10171|1
ORK|Cork|Irlanda|IE|51.84|-8.49|0.30|1.00|0.90|6998|1
PMC|Puerto Montt|Chile|CL|-41.44|-73.09|0.30|0.62|1.40|8694|1
PMW|Palmas|Brasil|BR|-10.29|-48.36|0.30|0.65|0.60|8202|1
RZV|Rize|Turquia|TR|41.18|40.85|0.30|0.65|1.30|9843|1
SCW|Syktyvkar|Russia|RU|61.65|50.85|0.30|0.71|1.05|8203|1
TGR|Touggourt|Argelia|DZ|33.07|6.09|0.30|0.60|0.70|9843|1
YYF|Penticton|Canada|CA|49.46|-119.60|0.30|1.10|0.95|6000|1
AAX|Araxa|Brasil|BR|-19.56|-46.96|0.29|0.68|0.85|6234|1
BWO|Balakovo|Russia|RU|51.86|47.75|0.29|0.71|1.05|7710|1
CRV|Isola di Capo Rizzuto|Italia|IT|39.00|17.08|0.29|1.00|1.40|6562|1
DPL|Dipolog|Filipinas|PH|8.60|123.34|0.29|0.47|1.05|6273|1
EJA|Barrancabermeja|Colombia|CO|7.02|-73.81|0.29|0.55|1.10|5905|1
GCH|Gachsaran|Ira|IR|30.33|50.83|0.29|0.45|0.80|6070|1
GPT|Gulfport|EUA|US|30.41|-89.07|0.29|1.10|1.10|9002|1
HGR|Hagerstown|EUA|US|39.71|-77.73|0.29|1.10|1.10|7000|1
IPL|Imperial|EUA|US|32.84|-115.57|0.29|1.10|1.10|5308|1
LAJ|Lages|Brasil|BR|-27.78|-50.28|0.29|0.68|0.85|5020|1
LPI|Linkoping|Suecia|SE|58.40|15.68|0.29|1.23|1.00|7004|1
SEB|Sabha|Libia|LY|26.99|14.47|0.29|0.40|0.50|11778|1
SMX|Santa Maria|EUA|US|34.90|-120.46|0.29|1.10|1.10|8004|1
SZK|Skukuza|Africa do Sul|ZA|-24.96|31.59|0.29|0.65|1.20|5085|1
THS|Phitsanulok|Tailandia|TH|17.24|99.82|0.29|0.60|2.00|6890|1
TRT|Toraja|Indonesia|ID|-3.18|119.92|0.29|0.50|0.90|6562|1
ARI|Arica|Chile|CL|-18.35|-70.34|0.28|0.70|1.30|9186|1
BJZ|Badajoz|Espanha|ES|38.89|-6.82|0.28|0.85|1.90|9350|1
BKZ|Bukoba|Tanzania|TZ|-1.33|31.82|0.28|0.32|1.45|4535|1
BTK|Bratsk|Russia|RU|56.37|101.70|0.28|0.71|1.05|10368|1
GNV|Gainesville|EUA|US|29.69|-82.27|0.28|1.10|1.10|7504|1
GSP|Greenville/Greer/Spartanbu|EUA|US|34.90|-82.22|0.28|1.10|1.10|11001|1
HHH|Hilton Head Island|EUA|US|32.22|-80.70|0.28|1.10|1.10|5000|1
HMI|Hami|China|CN|42.84|93.67|0.28|0.80|1.00|7874|1
IZT|Ixtepec|Mexico|MX|16.45|-95.09|0.28|0.69|1.30|7640|1
JAN|Jackson|EUA|US|32.31|-90.08|0.28|1.10|1.10|8500|1
LAN|Lansing|EUA|US|42.78|-84.59|0.28|1.10|1.10|8506|1
LMN|Limbang|Malasia|MY|4.81|115.01|0.28|0.72|1.50|4922|1
MGM|Montgomery|EUA|US|32.30|-86.39|0.28|1.10|1.10|9020|1
NLT|Xinyuan|China|CN|43.43|83.38|0.28|0.80|1.00|7546|1
PGV|Greenville|EUA|US|35.64|-77.38|0.28|1.10|1.10|7175|1
RCH|Riohacha|Colombia|CO|11.53|-72.93|0.28|0.55|1.10|5413|1
ROO|Rondonopolis|Brasil|BR|-16.58|-54.72|0.28|0.68|0.85|6070|1
SDE|Santiago del Estero|Argentina|AR|-27.77|-64.31|0.28|0.60|1.50|7946|1
SHV|Shreveport|EUA|US|32.44|-93.83|0.28|1.10|1.10|8348|1
TMJ|Termez|Uzbequistao|UZ|37.29|67.31|0.28|0.50|0.80|9843|1
TUR|Tucurui|Brasil|BR|-3.79|-49.72|0.28|0.68|0.85|6562|1
VJB|Xai-Xai|Mocambique|MZ|-24.89|33.75|0.28|0.30|0.80|5906|1
VXC|Lichinga|Mocambique|MZ|-13.27|35.27|0.28|0.30|0.80|8300|1
APO|Carepa|Colombia|CO|7.81|-76.72|0.27|0.55|1.10|7153|1
BTC|Batticaloa|Sri Lanka|LK|7.71|81.68|0.27|0.45|1.70|5118|1
CKZ|Canakkale|Turquia|TR|40.14|26.43|0.27|0.65|1.30|7710|1
CMI|Savoy|EUA|US|40.04|-88.28|0.27|1.10|1.10|8101|1
CYS|Cheyenne|EUA|US|41.16|-104.81|0.27|1.10|1.10|9270|1
GPA|Patras|Grecia|GR|38.15|21.43|0.27|0.77|2.10|10997|1
LAF|West Lafayette|EUA|US|40.41|-86.94|0.27|1.10|1.10|6600|1
LBB|Lubbock|EUA|US|33.66|-101.82|0.27|1.10|1.10|11500|1
MAF|Midland|EUA|US|31.94|-102.20|0.27|1.10|1.10|9501|1
MBX|Maribor|Eslovenia|SI|46.48|15.69|0.27|0.95|1.10|8202|1
MKM|Mukah|Malasia|MY|2.88|112.04|0.27|0.72|1.50|4921|1
MYW|Mtwara|Tanzania|TZ|-10.34|40.18|0.27|0.32|1.45|7410|1
ROT|Rotorua|Nova Zelandia|NZ|-38.11|176.32|0.27|1.12|1.65|5321|1
SDW|Goa|India|IN|16.00|73.53|0.27|0.52|2.00|8202|1
TJL|Tres Lagoas|Brasil|BR|-20.75|-51.68|0.27|0.68|0.85|6562|1
UBP|Ubon Ratchathani|Tailandia|TH|15.25|104.87|0.27|0.60|2.00|9848|1
AJI|Agri|Turquia|TR|39.66|43.03|0.26|0.65|1.30|9843|1
BGG|Bingol|Turquia|TR|38.86|40.59|0.26|0.65|1.30|7546|1
BMO|Banmaw|Mianmar|MM|24.27|97.25|0.26|0.30|0.70|5502|1
FDU|Bandundu|Congo (Kinshasa)|CD|-3.31|17.38|0.26|0.22|0.50|4528|1
GIL|Gilgit|Paquistao|PK|35.92|74.33|0.26|0.40|0.60|5400|1
IRP|Isiro|Congo (Kinshasa)|CD|2.83|27.59|0.26|0.22|0.50|8202|1
JKG|Jonkoping|Suecia|SE|57.76|14.07|0.26|1.23|1.00|7228|1
LLO|Palopo|Indonesia|ID|-3.08|120.24|0.26|0.50|0.90|4593|1
PHS|Phitsanulok|Tailandia|TH|16.78|100.28|0.26|0.60|2.00|9843|1
SAF|Santa Fe|EUA|US|35.62|-106.09|0.26|1.10|1.10|8366|1
SET|Serra Talhada|Brasil|BR|-8.06|-38.33|0.26|0.68|0.85|5905|1
SJI|San Jose|Filipinas|PH|12.36|121.05|0.26|0.47|1.05|6024|1
SOB|Sarmellek|Hungria|HU|46.69|17.16|0.26|0.85|1.60|8202|1
TGO|Tongliao|China|CN|43.56|122.20|0.26|0.80|1.00|7546|1
THN|Trollhattan|Suecia|SE|58.32|12.35|0.26|1.23|1.00|5610|1
ZIG|Ziguinchor|Senegal|SN|12.56|-16.28|0.26|0.35|1.00|5069|1
AVL|Asheville|EUA|US|35.44|-82.54|0.25|1.10|1.10|8002|1
AZS|Samana|Republica Dominicana|DO|19.27|-69.74|0.25|0.49|1.80|9843|1
CAE|Columbia|EUA|US|33.94|-81.12|0.25|1.10|1.10|8601|1
CCZ|Nassau|Bahamas|BS|25.42|-77.88|0.25|0.75|2.10|5000|1
CPE|Campeche|Mexico|MX|19.82|-90.50|0.25|0.69|1.30|8202|1
ERC|Erzincan|Turquia|TR|39.71|39.53|0.25|0.65|1.30|9843|1
HYA|Hyannis|EUA|US|41.67|-70.28|0.25|1.10|1.10|5425|1
INH|Inhambane|Mocambique|MZ|-23.88|35.41|0.25|0.30|0.80|4921|1
KKC|Khon Kaen|Tailandia|TH|16.47|102.78|0.25|0.60|2.00|10007|1
LAP|La Paz|Mexico|MX|24.07|-110.36|0.25|0.69|1.30|8202|1
LDY|Derry, Derry and Strabane|Reino Unido|GB|55.04|-7.16|0.25|1.05|1.10|6460|1
LPY|Chaspuzac, Haute-Loire|Franca|FR|45.08|3.76|0.25|1.12|1.35|4570|1
LSW|Lhok Seumawe-Sumatra|Indonesia|ID|5.23|96.95|0.25|0.50|0.90|6070|1
LYH|Lynchburg|EUA|US|37.33|-79.20|0.25|1.10|1.10|7100|1
OBO|Obihiro|Japao|JP|42.73|143.22|0.25|1.23|1.50|8202|1
ROI|Roi Et|Tailandia|TH|16.12|103.77|0.25|0.60|2.00|6890|1
SPP|Menongue|Angola|AO|-14.66|17.72|0.25|0.38|0.60|11483|1
STC|Saint Cloud|EUA|US|45.55|-94.06|0.25|1.10|1.10|7500|1
TAT|Poprad|Eslovaquia|SK|49.07|20.24|0.25|0.88|0.90|8530|1
ZOS|Osorno|Chile|CL|-40.61|-73.06|0.25|0.70|1.30|6398|1
ACT|Waco|EUA|US|31.61|-97.23|0.24|1.10|1.10|7107|1
AFZ|Sabzevar|Ira|IR|36.17|57.60|0.24|0.45|0.80|10428|1
BBO|Berbera|Somalia|SO|10.39|44.94|0.24|0.20|0.50|13582|1
BPT|Beaumont/Port Arthur|EUA|US|29.95|-94.02|0.24|1.10|1.10|6751|1
BQN|San Juan|Porto Rico|PR|18.49|-67.13|0.24|0.85|1.90|11702|1
BVS|Breves|Brasil|BR|-1.64|-50.44|0.24|0.68|0.85|5249|1
EYP|Yopal|Colombia|CO|5.32|-72.38|0.24|0.55|1.10|8448|1
GMZ|Tenerife Sul|Espanha|ES|28.03|-17.21|0.24|0.82|2.00|4921|1
HDS|Hoedspruit|Africa do Sul|ZA|-24.36|31.05|0.24|0.65|1.20|13094|1
LLK|Lankaran|Azerbaijao|AZ|38.76|48.81|0.24|0.70|1.00|10837|1
NGE|N'Gaoundere|Camaroes|CM|7.36|13.56|0.24|0.30|0.60|8858|1
ORB|Orebro|Suecia|SE|59.22|15.04|0.24|1.23|1.00|10728|1
PKV|Pskov|Russia|RU|57.78|28.39|0.24|0.71|1.05|8281|1
SLM|Salamanca|Espanha|ES|40.95|-5.50|0.24|0.85|1.90|8245|1
TLI|Toli Toli-Celebes Island|Indonesia|ID|1.12|120.79|0.24|0.50|0.90|4593|1
TTE|Ternate|Indonesia|ID|0.83|127.38|0.24|0.50|0.90|5875|1
ZAL|Valdivia|Chile|CL|-39.65|-73.09|0.24|0.70|1.30|6870|1
ACE|San Bartolome|Espanha|ES|28.95|-13.61|0.23|0.85|1.90|7874|1
BRA|Barreiras|Brasil|BR|-12.08|-45.01|0.23|0.68|0.85|5249|1
BRX|Barahona|Republica Dominicana|DO|18.25|-71.12|0.23|0.49|1.80|9843|1
CLV|Caldas Novas|Brasil|BR|-17.73|-48.61|0.23|0.68|0.85|6890|1
EBJ|Esbjerg|Dinamarca|DK|55.53|8.55|0.23|1.40|1.30|8527|1
EWN|New Bern|EUA|US|35.07|-77.04|0.23|1.10|1.10|6452|1
HDF|Zirchow|Alemanha|DE|53.88|14.15|0.23|1.15|1.00|7562|1
JIC|Jinchang|China|CN|38.54|102.35|0.23|0.80|1.00|9843|1
KND|Kindu|Congo (Kinshasa)|CD|-2.92|25.92|0.23|0.22|0.50|7218|1
LBJ|Labuan Bajo, Manggarai|Indonesia|ID|-8.48|119.89|0.23|0.50|0.90|7381|1
LOO|Laghouat|Argelia|DZ|33.76|2.93|0.23|0.60|0.70|12486|1
OAL|Cacoal|Brasil|BR|-11.50|-61.45|0.23|0.68|0.85|6890|1
OWB|Owensboro|EUA|US|37.74|-87.17|0.23|1.10|1.10|8000|1
PGF|Perpignan/Rivesaltes|Franca|FR|42.74|2.87|0.23|1.12|1.35|8202|1
POL|Pemba|Mocambique|MZ|-12.99|40.52|0.23|0.30|0.80|5905|1
RKV|Reiquiavique|Islandia|IS|64.13|-21.94|0.23|1.15|2.10|5138|1
ROA|Roanoke|EUA|US|37.33|-79.98|0.23|1.10|1.10|6800|1
SGF|Springfield|EUA|US|37.25|-93.39|0.23|1.10|1.10|8000|1
TRG|Tauranga|Nova Zelandia|NZ|-37.67|176.20|0.23|1.12|1.65|5988|1
UMU|Umuarama|Brasil|BR|-23.80|-53.31|0.23|0.68|0.85|4692|1
BMU|Bima|Indonesia|ID|-8.54|118.69|0.22|0.50|0.90|5405|1
DSI|Destin|EUA|US|30.40|-86.47|0.22|1.10|1.10|5001|1
EVV|Evansville|EUA|US|38.04|-87.53|0.22|1.10|1.10|8021|1
FMA|Formosa|Argentina|AR|-26.21|-58.23|0.22|0.60|1.50|5905|1
HLZ|Hamilton|Nova Zelandia|NZ|-37.87|175.33|0.22|1.12|1.65|6755|1
KHK|Khark|Ira|IR|29.26|50.32|0.22|0.45|0.80|5922|1
KZI|Kozani|Grecia|GR|40.29|21.84|0.22|0.77|2.10|5978|1
OLA|Orland|Noruega|NO|63.70|9.60|0.22|1.20|1.20|10755|1
OPS|Sinop|Brasil|BR|-11.89|-55.59|0.22|0.68|0.85|5348|1
SOQ|Sorong|Indonesia|ID|-0.89|131.29|0.22|0.50|0.90|6070|1
SVB|Sambava|Madagascar|MG|-14.28|50.17|0.22|0.25|1.20|4577|1
TDX|Laem Ngop|Tailandia|TH|12.27|102.32|0.22|0.60|2.00|5899|1
TLH|Tallahassee|EUA|US|30.40|-84.35|0.22|1.10|1.10|8000|1
TSV|Townsville|Australia|AU|-19.25|146.77|0.22|1.20|1.40|7999|1
ULU|Gulu|Uganda|UG|2.81|32.27|0.22|0.30|1.10|10314|1
ZLO|Manzanillo|Mexico|MX|19.14|-104.56|0.22|0.69|1.30|7218|1
AAT|Altay|China|CN|47.75|88.09|0.21|0.80|1.00|7218|1
AKY|Sittwe|Mianmar|MM|20.13|92.87|0.21|0.30|0.70|6001|1
BTU|Bintulu|Malasia|MY|3.12|113.02|0.21|0.72|1.50|9006|1
CLL|College Station|EUA|US|30.59|-96.36|0.21|1.10|1.10|7000|1
CSK|Cap Skirring|Senegal|SN|12.40|-16.75|0.21|0.35|1.00|6573|1
DIG|Diqing|China|CN|27.79|99.68|0.21|0.80|1.00|11647|1
GGG|Longview|EUA|US|32.38|-94.71|0.21|1.10|1.10|10000|1
GHA|El Atteuf|Argelia|DZ|32.38|3.79|0.21|0.60|0.70|10171|1
GTO|Gorontalo|Indonesia|ID|0.64|122.85|0.21|0.50|0.90|8202|1
MDT|Harrisburg|EUA|US|40.19|-76.76|0.21|1.10|1.10|10001|1
MZI|Sevare|Mali|ML|14.51|-4.08|0.21|0.24|0.60|8340|1
NSH|Nowshahr|Ira|IR|36.66|51.46|0.21|0.45|0.80|6677|1
PUF|Pau/Pyrenees|Franca|FR|43.38|-0.42|0.21|1.12|1.35|8202|1
SPI|Springfield|EUA|US|39.84|-89.68|0.21|1.10|1.10|8001|1
WUU|Wau|Sudao do Sul|SS|7.73|27.98|0.21|0.20|0.50|8202|1
ALW|Walla Walla|EUA|US|46.09|-118.29|0.20|1.10|1.10|6527|1
AMA|Amarillo|EUA|US|35.22|-101.71|0.20|1.10|1.10|13502|1
BCA|Baracoa|Cuba|CU|20.37|-74.51|0.20|0.40|1.70|6070|1
BIQ|Biarritz|Franca|FR|43.47|-1.52|0.20|1.12|1.35|7382|1
BRC|Bariloche|Argentina|AR|-41.15|-71.16|0.20|0.58|1.90|7703|1
CJA|Cajamarca|Peru|PE|-7.14|-78.49|0.20|0.52|1.50|8201|1
CRM|Catarman|Filipinas|PH|12.50|124.64|0.20|0.47|1.05|4429|1
DRW|Darwin|Australia|AU|-12.41|130.88|0.20|0.95|1.20|11004|1
GMA|Gemena|Congo (Kinshasa)|CD|3.24|19.77|0.20|0.22|0.50|6550|1
HBA|Hobart|Australia|AU|-42.84|147.51|0.20|1.00|1.40|8947|1
ILM|Wilmington|EUA|US|34.27|-77.91|0.20|1.10|1.10|8016|1
JGD|Jiagedaqi|China|CN|50.37|124.12|0.20|0.80|1.00|7546|1
JRO|Kilimanjaro|Tanzania|TZ|-3.43|37.07|0.20|0.30|1.80|11811|1
JYV|Jyvaskylan Maalaiskunta|Finlandia|FI|62.40|25.68|0.20|1.30|1.10|8533|1
KHT|Khost|Afeganistao|AF|33.28|69.81|0.20|0.22|0.50|8740|1
MBD|Mafeking|Africa do Sul|ZA|-25.80|25.55|0.20|0.65|1.20|15157|1
MCN|Macon|EUA|US|32.69|-83.65|0.20|1.10|1.10|6500|1
MMB|Ozora|Japao|JP|43.88|144.16|0.20|1.23|1.50|8202|1
MVB|Franceville|Gabao|GA|-1.66|13.44|0.20|0.45|0.70|10105|1
NOU|Noumea|Nova Caledonia|NC|-22.01|166.21|0.20|0.90|1.70|10663|1
NST|Nakhon Si Thammarat|Tailandia|TH|8.54|99.94|0.20|0.60|2.00|6890|1
PDS|Piedras Negras|Mexico|MX|28.63|-100.54|0.20|0.69|1.30|6655|1
PIS|Poitiers/Biard|Franca|FR|46.59|0.31|0.20|1.12|1.35|7710|1
SPS|Wichita Falls|EUA|US|33.99|-98.49|0.20|1.10|1.10|13100|1
TRD|Trondheim|Noruega|NO|63.46|10.92|0.20|1.15|0.90|9052|1
TYL|Talara|Peru|PE|-4.58|-81.25|0.20|0.52|1.50|8038|1
TYR|Tyler|EUA|US|32.35|-95.40|0.20|1.10|1.10|8334|1
YUM|Yuma|EUA|US|32.65|-114.61|0.20|1.10|1.10|13300|1
AHO|Alghero|Italia|IT|40.63|8.29|0.19|1.00|1.40|9843|1
CME|Ciudad del Carmen|Mexico|MX|18.65|-91.80|0.19|0.69|1.30|7218|1
CTC|Catamarca|Argentina|AR|-28.59|-65.75|0.19|0.60|1.50|9186|1
FAR|Fargo|EUA|US|46.92|-96.82|0.19|1.10|1.10|9001|1
GNS|Gunungsitoli|Indonesia|ID|1.17|97.71|0.19|0.50|0.90|4445|1
JPR|Ji-Parana|Brasil|BR|-10.87|-61.85|0.19|0.68|0.85|5906|1
KVK|Apatity|Russia|RU|67.46|33.59|0.19|0.71|1.05|8202|1
KYS|Kayes|Mali|ML|14.48|-11.40|0.19|0.24|0.60|8858|1
LEN|La Virgen del Camino|Espanha|ES|42.59|-5.65|0.19|0.85|1.90|9843|1
PMY|Puerto Madryn|Argentina|AR|-42.76|-65.10|0.19|0.60|1.50|8202|1
REL|Rawson|Argentina|AR|-43.21|-65.27|0.19|0.60|1.50|8399|1
SRT|Soroti|Uganda|UG|1.73|33.62|0.19|0.30|1.10|6100|1
SSY|Mbanza Congo|Angola|AO|-6.27|14.25|0.19|0.38|0.60|5905|1
VRC|Virac|Filipinas|PH|13.58|124.21|0.19|0.47|1.05|5118|1
ABT|Al-Baha|Arabia Saudita|SA|20.30|41.64|0.18|0.97|1.10|10991|1
ATM|Altamira|Brasil|BR|-3.25|-52.25|0.18|0.68|0.85|6572|1
AUX|Araguaina|Brasil|BR|-7.23|-48.24|0.18|0.68|0.85|5919|1
AZO|Kalamazoo|EUA|US|42.23|-85.55|0.18|1.10|1.10|6502|1
BBM|Battambang|Camboja|KH|13.10|103.22|0.18|0.35|1.40|5250|1
ERH|Errachidia|Marrocos|MA|31.95|-4.40|0.18|0.54|1.65|10499|1
HRI|Mattala|Sri Lanka|LK|6.28|81.12|0.18|0.45|1.70|11483|1
IRJ|La Rioja|Argentina|AR|-29.38|-66.80|0.18|0.60|1.50|9383|1
NZH|Manzhouli|China|CN|49.57|117.33|0.18|0.80|1.00|9186|1
SST|Santa Teresita|Argentina|AR|-36.54|-56.72|0.18|0.60|1.50|4921|1
SZE|Semera|Etiopia|ET|11.79|40.99|0.18|0.35|0.80|8202|1
TBP|Tumbes|Peru|PE|-3.55|-80.38|0.18|0.52|1.50|8202|1
TLE|Toliara|Madagascar|MG|-23.38|43.73|0.18|0.25|1.20|6562|1
TRI|Blountville|EUA|US|36.48|-82.41|0.18|1.10|1.10|8000|1
URT|Surat Thani|Tailandia|TH|9.13|99.14|0.18|0.60|2.00|9843|1
UTT|Mthatha|Africa do Sul|ZA|-31.55|28.67|0.18|0.65|1.20|8530|1
YSB|Sudbury|Canada|CA|46.62|-80.80|0.18|1.10|0.95|6600|1
AVP|Wilkes-Barre/Scranton|EUA|US|41.34|-75.72|0.17|1.10|1.10|7502|1
BWK|Split|Croacia|HR|43.28|16.68|0.17|0.75|2.10|5774|1
CBH|Bechar|Argelia|DZ|31.65|-2.27|0.17|0.60|0.70|12245|1
CJC|Calama|Chile|CL|-22.50|-68.90|0.17|0.70|1.30|9974|1
COU|Columbia|EUA|US|38.82|-92.22|0.17|1.10|1.10|7401|1
CTM|Chetumal|Mexico|MX|18.50|-88.33|0.17|0.69|1.30|7244|1
DTB|Siborong-Borong|Indonesia|ID|2.26|98.99|0.17|0.50|0.90|7875|1
ENE|Ende|Indonesia|ID|-8.85|121.66|0.17|0.50|0.90|5440|1
FSD|Sioux Falls|EUA|US|43.59|-96.74|0.17|1.10|1.10|9000|1
KFS|Kastamonu|Turquia|TR|41.31|33.80|0.17|0.65|1.30|7382|1
KOS|Preah Sihanouk|Camboja|KH|10.57|103.63|0.17|0.35|1.40|8202|1
KUH|Kushiro|Japao|JP|43.04|144.19|0.17|1.23|1.50|8202|1
LDU|Lahad Datu|Malasia|MY|5.03|118.32|0.17|0.72|1.50|4498|1
LEC|Lencois|Brasil|BR|-12.48|-41.28|0.17|0.68|0.85|6831|1
LFT|Lafayette|EUA|US|30.21|-91.99|0.17|1.10|1.10|8000|1
LUQ|San Luis|Argentina|AR|-33.27|-66.36|0.17|0.60|1.50|9678|1
MGZ|Mkeik|Mianmar|MM|12.44|98.62|0.17|0.30|0.70|8795|1
MOF|Waioti|Indonesia|ID|-8.64|122.24|0.17|0.50|0.90|5980|1
OSI|Osijek|Croacia|HR|45.46|18.81|0.17|0.75|2.10|8202|1
PDP|Punta del Este|Uruguai|UY|-34.86|-55.09|0.17|0.85|1.10|6998|1
PFQ|Parsabad|Ira|IR|39.60|47.88|0.17|0.45|0.80|8515|1
RJN|Rafsanjan|Ira|IR|30.30|56.05|0.17|0.45|0.80|9814|1
SMQ|Sampit|Indonesia|ID|-2.50|112.97|0.17|0.50|0.90|6060|1
YKO|Hakkari|Turquia|TR|37.55|44.24|0.17|0.65|1.30|10499|1
AGS|Augusta|EUA|US|33.37|-81.96|0.16|1.10|1.10|8001|1
AHA|Ambikapur|India|IN|22.99|83.20|0.16|0.52|0.90|6299|1
AYP|Ayacucho|Peru|PE|-13.15|-74.20|0.16|0.52|1.50|9186|1
CCF|Carcassonne|Franca|FR|43.22|2.31|0.16|1.12|1.35|6726|1
CHO|Charlottesville|EUA|US|38.14|-78.45|0.16|1.10|1.10|6801|1
DEM|Dembidollo|Etiopia|ET|8.55|34.86|0.16|0.35|0.80|6168|1
FMI|Kalemie|Congo (Kinshasa)|CD|-5.88|29.25|0.16|0.22|0.50|5741|1
GMB|Gambela|Etiopia|ET|8.13|34.56|0.16|0.35|0.80|8248|1
GYM|Guaymas|Mexico|MX|27.97|-110.93|0.16|0.69|1.30|7710|1
KSY|Kars|Turquia|TR|40.56|43.12|0.16|0.65|1.30|11483|1
LIG|Limoges/Bellegarde|Franca|FR|45.86|1.18|0.16|1.12|1.35|8202|1
LSH|Lashio|Mianmar|MM|22.98|97.75|0.16|0.30|0.70|5285|1
MAK|Malakal|Sudao do Sul|SS|9.56|31.65|0.16|0.20|0.50|6562|1
MBE|Monbetsu|Japao|JP|44.30|143.40|0.16|1.23|1.50|6562|1
MFR|Medford|EUA|US|42.37|-122.87|0.16|1.10|1.10|8800|1
MLN|Melilla|Espanha|ES|35.28|-2.96|0.16|0.85|1.90|4701|1
MSL|Muscle Shoals|EUA|US|34.75|-87.61|0.16|1.10|1.10|6693|1
PMR|Palmerston North|Nova Zelandia|NZ|-40.32|175.62|0.16|1.12|1.65|6240|1
POR|Pori|Finlandia|FI|61.46|21.80|0.16|1.30|1.10|7713|1
RJK|Rijeka|Croacia|HR|45.22|14.57|0.16|0.75|2.10|8164|1
RST|Rochester|EUA|US|43.91|-92.50|0.16|1.10|1.10|9034|1
SNX|Semnan|Ira|IR|35.59|53.50|0.16|0.45|0.80|11739|1
SWO|Stillwater|EUA|US|36.16|-97.09|0.16|1.10|1.10|7401|1
TBJ|Tabarka|Tunisia|TN|36.98|8.88|0.16|0.55|1.30|9416|1
TDK|Taldykorgan|Cazaquistao|KZ|45.12|78.44|0.16|0.67|0.75|9846|1
TGQ|Tangara da Serra|Brasil|BR|-14.66|-57.44|0.16|0.68|0.85|4921|1
TJA|Tarija|Bolivia|BO|-21.56|-64.70|0.16|0.46|1.05|10007|1
TTT|Taitung City|Taiwan|TW|22.75|121.10|0.16|1.07|1.15|7999|1
BGM|Binghamton|EUA|US|42.21|-75.98|0.15|1.10|1.10|7305|1
CPO|Copiapo|Chile|CL|-27.26|-70.78|0.15|0.70|1.30|7218|1
HAD|Halmstad|Suecia|SE|56.69|12.82|0.15|1.23|1.00|7419|1
ITB|Itaituba|Brasil|BR|-4.24|-56.00|0.15|0.68|0.85|5577|1
LDE|Tarbes/Lourdes/Pyrenees|Franca|FR|43.18|-0.01|0.15|1.12|1.35|9843|1
LSE|La Crosse|EUA|US|43.88|-91.26|0.15|1.10|1.10|8742|1
NPE|Napier|Nova Zelandia|NZ|-39.47|176.87|0.15|1.12|1.65|5741|1
RAE|Arar|Arabia Saudita|SA|30.91|41.14|0.15|0.97|1.10|10007|1
SHD|Weyers Cave|EUA|US|38.26|-78.90|0.15|1.10|1.10|6002|1
TJG|Tanta-Tabalong|Indonesia|ID|-2.22|115.44|0.15|0.50|0.90|4601|1
TOE|Tozeur|Tunisia|TN|33.94|8.11|0.15|0.55|1.30|10581|1
UIB|Quibdo|Colombia|CO|5.69|-76.64|0.15|0.55|1.10|4593|1
YQM|Moncton|Canada|CA|46.11|-64.68|0.15|1.10|0.95|10001|1
ZPC|Pucon|Chile|CL|-39.29|-71.92|0.15|0.70|1.30|5576|1
CCC|Cayo Coco|Cuba|CU|22.46|-78.33|0.14|0.40|1.70|9842|1
CJL|Chitral|Paquistao|PK|35.89|71.80|0.14|0.40|0.60|5741|1
DIE|Antisiranana|Madagascar|MG|-12.35|49.29|0.14|0.25|1.20|4921|1
DPO|Devonport|Australia|AU|-41.17|146.43|0.14|1.20|1.40|6030|1
LAW|Lawton|EUA|US|34.57|-98.42|0.14|1.10|1.10|8599|1
OAJ|Richlands|EUA|US|34.83|-77.61|0.14|1.10|1.10|7100|1
OKY|Toowoomba|Australia|AU|-27.41|151.74|0.14|1.20|1.40|5410|1
PGU|Khiyaroo|Ira|IR|27.38|52.74|0.14|0.45|0.80|13115|1
RDZ|Rodez/Marcillac|Franca|FR|44.41|2.48|0.14|1.12|1.35|6693|1
TIM|Timika|Indonesia|ID|-4.53|136.89|0.14|0.50|0.90|7841|1
TJQ|Tanjung Pandan|Indonesia|ID|-2.74|107.75|0.14|0.50|0.90|8202|1
TRA|Tarama|Japao|JP|24.65|124.68|0.14|1.23|1.50|4921|1
TVY|Dawei|Mianmar|MM|14.10|98.20|0.14|0.30|0.70|12013|1
TWC|Tumxuk|China|CN|39.89|79.23|0.14|0.80|1.00|8530|1
WAG|Wanganui|Nova Zelandia|NZ|-39.96|175.02|0.14|1.12|1.65|4521|1
YUS|Yushu|China|CN|32.84|97.04|0.14|0.80|1.00|12467|1
ABI|Abilene|EUA|US|32.41|-99.68|0.13|1.10|1.10|7208|1
ACF|Aral|China|CN|40.43|81.26|0.13|0.80|1.00|9186|1
AOO|Altoona|EUA|US|40.30|-78.32|0.13|1.10|1.10|5465|1
ASO|Asosa|Etiopia|ET|10.02|34.59|0.13|0.35|0.80|8218|1
BDB|Bundaberg|Australia|AU|-24.91|152.32|0.13|1.20|1.40|6562|1
BKN|Balkanabat|Turcomenistao|TM|39.68|54.21|0.13|0.45|0.60|10499|1
BVE|Brive|Franca|FR|45.04|1.49|0.13|1.12|1.35|6890|1
BVH|Vilhena|Brasil|BR|-12.69|-60.10|0.13|0.68|0.85|8530|1
CZS|Cruzeiro Do Sul|Brasil|BR|-7.60|-72.77|0.13|0.68|0.85|7874|1
DUD|Dunedin|Nova Zelandia|NZ|-45.93|170.20|0.13|1.12|1.65|6234|1
EGC|Bergerac|Franca|FR|44.83|0.52|0.13|1.12|1.35|7234|1
GAQ|Gao|Mali|ML|16.25|-0.01|0.13|0.24|0.60|8202|1
KSZ|Kotlas|Russia|RU|61.24|46.70|0.13|0.71|1.05|4757|1
LOE|Loei|Tailandia|TH|17.44|101.72|0.13|0.60|2.00|6890|1
MKK|Kahului|Estados Unidos|US|21.15|-157.10|0.13|1.00|2.10|4494|1
MKW|Manokwari|Indonesia|ID|-0.89|134.05|0.13|0.50|0.90|6562|1
MPH|Caticlan|Filipinas|PH|11.92|121.95|0.13|0.47|1.05|5905|1
RHD|Termas de Rio Hondo|Argentina|AR|-27.50|-64.94|0.13|0.60|1.50|8232|1
SGU|St George|EUA|US|37.04|-113.51|0.13|1.10|1.10|9300|1
TBT|Tabatinga|Brasil|BR|-4.26|-69.94|0.13|0.68|0.85|7054|1
TRR|Trincomalee|Sri Lanka|LK|8.54|81.18|0.13|0.45|1.70|7850|1
TST|Trang|Tailandia|TH|7.51|99.62|0.13|0.60|2.00|6890|1
UCT|Ukhta|Russia|RU|63.57|53.80|0.13|0.71|1.05|8691|1
URG|Uruguaiana|Brasil|BR|-29.78|-57.04|0.13|0.68|0.85|4921|1
YKM|Yakima|EUA|US|46.57|-120.54|0.13|1.10|1.10|7604|1
AFA|San Rafael|Argentina|AR|-34.59|-68.40|0.12|0.60|1.50|6923|1
BHE|Blenheim|Nova Zelandia|NZ|-41.52|173.87|0.12|1.12|1.65|4675|1
BHH|Bisha|Arabia Saudita|SA|19.98|42.62|0.12|0.97|1.10|10007|1
BIL|Billings|EUA|US|45.81|-108.54|0.12|1.10|1.10|10518|1
BQB|Busselton|Australia|AU|-33.69|115.40|0.12|1.20|1.40|8071|1
BXR|Bam|Ira|IR|29.08|58.45|0.12|0.45|0.80|11107|1
CMG|Corumba|Brasil|BR|-19.01|-57.67|0.12|0.68|0.85|4921|1
CWA|Mosinee|EUA|US|44.78|-89.67|0.12|1.10|1.10|7723|1
DAV|David|Panama|PA|8.39|-82.44|0.12|0.80|1.20|8530|1
ERI|Erie|EUA|US|42.08|-80.17|0.12|1.10|1.10|8420|1
FTU|Tolanaro|Madagascar|MG|-25.04|46.96|0.12|0.25|1.20|5280|1
JSI|Skiathos|Grecia|GR|39.18|23.50|0.12|0.77|2.10|5341|1
KOP|Nakhon Phanom|Tailandia|TH|17.38|104.64|0.12|0.60|2.00|8203|1
KSO|Argos Orestiko|Grecia|GR|40.45|21.28|0.12|0.77|2.10|8852|1
KYZ|Kyzyl|Russia|RU|51.67|94.40|0.12|0.71|1.05|8858|1
LCH|Lake Charles|EUA|US|30.13|-93.22|0.12|1.10|1.10|6500|1
LKM|Lolak|Indonesia|ID|0.89|124.03|0.12|0.50|0.90|5249|1
LRR|Lar|Ira|IR|27.67|54.38|0.12|0.45|0.80|10397|1
LRU|Las Cruces|EUA|US|32.29|-106.92|0.12|1.10|1.10|7506|1
LWS|Lewiston|EUA|US|46.37|-117.01|0.12|1.10|1.10|6511|1
LZG|Nanchong|China|CN|31.50|106.03|0.12|0.80|1.00|11811|1
MAQ|Mae Sot|Tailandia|TH|16.70|98.55|0.12|0.60|2.00|4921|1
MGH|Margate|Africa do Sul|ZA|-30.86|30.34|0.12|0.65|1.20|4495|1
MKQ|Merauke|Indonesia|ID|-8.52|140.42|0.12|0.50|0.90|6070|1
MYT|Myitkyina|Mianmar|MM|25.38|97.35|0.12|0.30|0.70|6100|1
NSN|Nelson|Nova Zelandia|NZ|-41.30|173.22|0.12|1.12|1.65|4420|1
OND|Ondangwa|Namibia|NA|-17.88|15.95|0.12|0.45|1.30|9800|1
PEM|Puerto Maldonado|Peru|PE|-12.61|-69.23|0.12|0.52|1.50|11482|1
PUW|Pullman|EUA|US|46.74|-117.11|0.12|1.10|1.10|7100|1
RDM|Redmond|EUA|US|44.25|-121.15|0.12|1.10|1.10|7038|1
RSA|Santa Rosa|Argentina|AR|-36.59|-64.28|0.12|0.60|1.50|7546|1
SMT|Sorriso|Brasil|BR|-12.48|-55.67|0.12|0.68|0.85|5577|1
SWQ|Sumbawa Besar|Indonesia|ID|-8.49|117.41|0.12|0.50|0.90|5906|1
VPE|Ngiva|Angola|AO|-17.04|15.68|0.12|0.38|0.60|10640|1
YKA|Kamloops|Canada|CA|50.70|-120.45|0.12|1.10|0.95|8000|1
YQY|Sydney|Canada|CA|46.16|-60.05|0.12|1.10|0.95|7070|1
ABY|Albany|EUA|US|31.53|-84.20|0.11|1.10|1.10|6601|1
ALO|Waterloo|EUA|US|42.56|-92.40|0.11|1.10|1.10|8399|1
AUG|Augusta|EUA|US|44.32|-69.80|0.11|1.10|1.10|5002|1
AXD|Alexandroupolis|Grecia|GR|40.86|25.96|0.11|0.77|2.10|8471|1
BOR|Ton Phueng|Laos|LA|20.32|100.17|0.11|0.32|1.10|8858|1
CAL|Campbeltown|Reino Unido|GB|55.44|-5.69|0.11|1.05|1.10|4633|1
DIN|Dien Bien Phu|Vietna|VN|21.40|103.01|0.11|0.58|1.40|7874|1
DLH|Duluth|EUA|US|46.84|-92.20|0.11|1.10|1.10|10591|1
EAR|Kearney|EUA|US|40.73|-99.01|0.11|1.10|1.10|7094|1
ESL|Elista|Russia|RU|46.37|44.33|0.11|0.71|1.05|10499|1
FSM|Fort Smith|EUA|US|35.34|-94.37|0.11|1.10|1.10|8000|1
KSD|Karlstad|Suecia|SE|59.44|13.34|0.11|1.23|1.00|8255|1
NLH|Ninglang|China|CN|27.54|100.76|0.11|0.80|1.00|11155|1
NOJ|Noyabrsk|Russia|RU|63.18|75.27|0.11|0.71|1.05|8202|1
OYE|Oyem|Gabao|GA|1.54|11.58|0.11|0.45|0.70|5906|1
PHW|Phalaborwa|Africa do Sul|ZA|-23.94|31.16|0.11|0.65|1.20|4491|1
PKN|Pangkalanbun|Indonesia|ID|-2.71|111.67|0.11|0.50|0.90|5415|1
PMG|Ponta Pora|Brasil|BR|-22.55|-55.70|0.11|0.68|0.85|6562|1
RMZ|Tobolsk|Russia|RU|58.06|68.35|0.11|0.71|1.05|7875|1
SNO|Sakon Nakhon|Tailandia|TH|17.20|104.12|0.11|0.60|2.00|8530|1
SUG|Surigao City|Filipinas|PH|9.76|125.48|0.11|0.47|1.05|5603|1
TAY|Tartu|Estonia|EE|58.31|26.69|0.11|0.90|1.20|5905|1
TFF|Tefe|Brasil|BR|-3.38|-64.72|0.11|0.68|0.85|7218|1
TUI|Turaif|Arabia Saudita|SA|31.69|38.73|0.11|0.97|1.10|9843|1
VXO|Vaxjo|Suecia|SE|56.93|14.73|0.11|1.23|1.00|6900|1
YFC|Fredericton|Canada|CA|45.87|-66.53|0.11|1.10|0.95|8005|1
YQT|Thunder Bay|Canada|CA|48.37|-89.32|0.11|1.10|0.95|7318|1
YSJ|Saint John|Canada|CA|45.32|-65.89|0.11|1.10|0.95|7000|1
AEU|Abu Musa|Ira|IR|25.88|55.03|0.10|0.45|0.80|9796|1
AUC|Arauca|Colombia|CO|7.07|-70.74|0.10|0.55|1.10|6890|1
BIS|Bismarck|EUA|US|46.77|-100.75|0.10|1.10|1.10|8794|1
BTV|Burlington|EUA|US|44.47|-73.15|0.10|1.10|1.10|8319|1
BXG|Bendigo|Australia|AU|-36.74|144.33|0.10|1.20|1.40|5249|1
CLY|Calvi|Franca|FR|42.53|8.79|0.10|1.12|1.35|7579|1
CWJ|Lincang|China|CN|23.28|99.37|0.10|0.80|1.00|8530|1
DHN|Dothan|EUA|US|31.32|-85.45|0.10|1.10|1.10|8500|1
HMA|Khanty-Mansiysk|Russia|RU|61.03|69.09|0.10|0.71|1.05|9180|1
IGR|Puerto Iguazu|Argentina|AR|-25.74|-54.47|0.10|0.55|2.00|10827|1
IKG|Karakol|Quirguistao|KG|42.51|78.41|0.10|0.32|0.90|8202|1
JAE|Jaen|Peru|PE|-5.59|-78.77|0.10|0.52|1.50|7874|1
JBR|Jonesboro|EUA|US|35.83|-90.65|0.10|1.10|1.10|6200|1
KCA|Kuqa|China|CN|41.68|82.87|0.10|0.80|1.00|8530|1
KGT|Garze|China|CN|30.14|101.74|0.10|0.80|1.00|13123|1
KLX|Kalamata|Grecia|GR|37.07|22.03|0.10|0.77|2.10|9843|1
KRC|Sungai Penuh|Indonesia|ID|-2.09|101.47|0.10|0.50|0.90|5906|1
LIR|Liberia|Costa Rica|CR|10.59|-85.54|0.10|0.60|1.80|9022|1
MOL|Aro|Noruega|NO|62.74|7.26|0.10|1.20|1.20|6922|1
MWA|Marion|EUA|US|37.75|-89.02|0.10|1.10|1.10|8012|1
PBG|Plattsburgh|EUA|US|44.65|-73.47|0.10|1.10|1.10|11759|1
SJT|San Angelo|EUA|US|31.36|-100.50|0.10|1.10|1.10|8054|1
URY|Gurayat|Arabia Saudita|SA|31.41|37.28|0.10|0.97|1.10|10007|1
USH|Ushuaia|Argentina|AR|-54.84|-68.30|0.10|0.55|1.80|9186|1
VKT|Vorkuta|Russia|RU|67.49|63.99|0.10|0.71|1.05|7218|1
YQL|Lethbridge|Canada|CA|49.63|-112.80|0.10|1.10|0.95|6500|1
ZQN|Queenstown|Nova Zelandia|NZ|-45.02|168.75|0.10|1.00|2.10|6204|1
AKF|Kufra|Libia|LY|24.18|23.31|0.09|0.40|0.50|12007|1
ANS|Andahuaylas|Peru|PE|-13.71|-73.35|0.09|0.52|1.50|8202|1
BCO|Jinka|Etiopia|ET|5.75|36.56|0.09|0.35|0.80|8612|1
BFV|Buriram|Tailandia|TH|15.23|103.25|0.09|0.60|2.00|6890|1
BLE|Borlange|Suecia|SE|60.42|15.52|0.09|1.23|1.00|7579|1
BPX|Bangda|China|CN|30.55|97.11|0.09|0.80|1.00|14764|1
DWD|Dawadmi|Arabia Saudita|SA|24.45|44.12|0.09|0.97|1.10|10006|1
EBH|El Bayadh|Argelia|DZ|33.72|1.09|0.09|0.60|0.70|9843|1
ECP|Panama City Beach|EUA|US|30.36|-85.80|0.09|1.10|1.10|10000|1
EIE|Yeniseysk|Russia|RU|58.47|92.11|0.09|0.71|1.05|7217|1
ELM|Elmira/Corning|EUA|US|42.16|-76.89|0.09|1.10|1.10|8001|1
ESU|Essaouira|Marrocos|MA|31.40|-9.68|0.09|0.54|1.65|8553|1
FLO|Florence|EUA|US|34.19|-79.72|0.09|1.10|1.10|6502|1
GDX|Magadan|Russia|RU|59.91|150.72|0.09|0.71|1.05|11326|1
HII|Lake Havasu City|EUA|US|34.57|-114.36|0.09|1.10|1.10|8000|1
HOT|Hot Springs|EUA|US|34.48|-93.10|0.09|1.10|1.10|6595|1
IDA|Idaho Falls|EUA|US|43.51|-112.07|0.09|1.10|1.10|9002|1
IOA|Ioannina|Grecia|GR|39.70|20.82|0.09|0.77|2.10|7874|1
JOE|Joensuu|Finlandia|FI|62.66|29.62|0.09|1.30|1.10|8202|1
JSJ|Jiansanjiang|China|CN|47.11|132.66|0.09|0.80|1.00|8202|1
KRW|Turkmenbasy|Turcomenistao|TM|40.06|53.01|0.09|0.45|0.60|11483|1
LFM|Lamerd|Ira|IR|27.37|53.19|0.09|0.45|0.80|10020|1
LST|Launceston|Australia|AU|-41.54|147.21|0.09|1.20|1.40|6499|1
LUV|Langgur|Indonesia|ID|-5.76|132.76|0.09|0.50|0.90|7710|1
MMY|Miyakojima|Japao|JP|24.78|125.29|0.09|1.23|1.50|6560|1
MZV|Mulu|Malasia|MY|4.05|114.81|0.09|0.72|1.50|4921|1
NUX|Novy Urengoy|Russia|RU|66.07|76.52|0.09|0.71|1.05|8366|1
OCC|Coca|Equador|EC|-0.46|-76.99|0.09|0.57|1.05|6760|1
PHY|Phetchabun|Tailandia|TH|16.68|101.19|0.09|0.60|2.00|6890|1
PUU|Puerto Asis|Colombia|CO|0.51|-76.50|0.09|0.55|1.10|5331|1
PVK|Preveza|Grecia|GR|38.93|20.77|0.09|0.77|2.10|9419|1
PXR|Surin|Tailandia|TH|14.87|103.50|0.09|0.60|2.00|5053|1
PYT|Paracatu|Brasil|BR|-17.24|-46.88|0.09|0.68|0.85|4921|1
RDD|Redding|EUA|US|40.51|-122.29|0.09|1.10|1.10|7003|1
RNB|Ronneby|Suecia|SE|56.27|15.27|0.09|1.23|1.00|7648|1
SCE|State College|EUA|US|40.85|-77.85|0.09|1.10|1.10|6701|1
SHI|Miyakojima|Japao|JP|24.83|125.14|0.09|1.23|1.50|9842|1
SUI|Sukhumi|Georgia|GE|42.86|41.13|0.09|0.55|1.30|12012|1
TCO|Tumaco|Colombia|CO|1.81|-78.75|0.09|0.55|1.10|5249|1
THL|Tachileik|Mianmar|MM|20.48|99.94|0.09|0.30|0.70|7002|1
TMT|Oriximina|Brasil|BR|-1.49|-56.40|0.09|0.68|0.85|5249|1
TUO|Taupo|Nova Zelandia|NZ|-38.74|176.08|0.09|1.12|1.65|4547|1
UYN|Yulin|China|CN|38.36|109.59|0.09|0.80|1.00|9186|1
VUS|Velikiy Ustyug|Russia|RU|60.79|46.26|0.09|0.71|1.05|5069|1
WJR|Wajir|Quenia|KE|1.73|40.09|0.09|0.45|1.50|9193|1
WMX|Wamena|Indonesia|ID|-4.10|138.95|0.09|0.50|0.90|7135|1
YQA|Gravenhurst|Canada|CA|44.98|-79.31|0.09|1.10|0.95|6000|1
ZBR|Konarak|Ira|IR|25.44|60.38|0.09|0.45|0.80|12514|1
ACV|Arcata/Eureka|EUA|US|40.98|-124.11|0.08|1.10|1.10|6046|1
ASJ|Amami|Japao|JP|28.43|129.71|0.08|1.23|1.50|6560|1
AUR|Aurillac|Franca|FR|44.89|2.42|0.08|1.12|1.35|5577|1
BHS|Bathurst|Australia|AU|-33.41|149.65|0.08|1.20|1.40|5594|1
BQK|Brunswick|EUA|US|31.26|-81.47|0.08|1.10|1.10|8001|1
BRL|Burlington|EUA|US|40.78|-91.13|0.08|1.10|1.10|6102|1
BXH|Balkhash|Cazaquistao|KZ|46.89|75.00|0.08|0.67|0.75|8208|1
CFS|Coffs Harbour|Australia|AU|-30.32|153.12|0.08|1.20|1.40|6824|1
CGI|Cape Girardeau|EUA|US|37.23|-89.57|0.08|1.10|1.10|6500|1
EAU|Eau Claire|EUA|US|44.87|-91.48|0.08|1.10|1.10|8101|1
FUJ|Goto|Japao|JP|32.67|128.83|0.08|1.23|1.50|6561|1
GJT|Grand Junction|EUA|US|39.13|-108.53|0.08|1.10|1.10|9339|1
GRI|Grand Island|EUA|US|40.97|-98.31|0.08|1.10|1.10|7002|1
HVB|Hervey Bay|Australia|AU|-25.32|152.88|0.08|1.20|1.40|6561|1
KHS|Khasab|Oma|OM|26.17|56.24|0.08|0.95|1.30|8202|1
KOK|Kokkola / Kruunupyy|Finlandia|FI|63.72|23.14|0.08|1.30|1.10|8202|1
LIO|Limon|Costa Rica|CR|9.96|-83.02|0.08|0.61|1.85|5906|1
LLB|Qiannan|China|CN|25.45|107.96|0.08|0.80|1.00|7546|1
MHC|Dalcahue|Chile|CL|-42.34|-73.72|0.08|0.70|1.30|6562|1
MHK|Manhattan|EUA|US|39.14|-96.67|0.08|1.10|1.10|7400|1
MJT|Mytilene|Grecia|GR|39.06|26.60|0.08|0.77|2.10|7894|1
MKL|Jackson|EUA|US|35.60|-88.92|0.08|1.10|1.10|6005|1
MKY|Mackay|Australia|AU|-21.17|149.18|0.08|1.20|1.40|6499|1
MOQ|Morondava|Madagascar|MG|-20.28|44.32|0.08|0.25|1.20|4921|1
NDU|Rundu|Namibia|NA|-17.96|19.72|0.08|0.45|1.30|11004|1
PRC|Prescott|EUA|US|34.65|-112.42|0.08|1.10|1.10|7619|1
RIH|Rio Hato|Panama|PA|8.38|-80.13|0.08|0.80|1.20|8038|1
ROK|Rockhampton|Australia|AU|-23.38|150.48|0.08|1.20|1.40|8622|1
SDL|Sundsvall/ Harnosand|Suecia|SE|62.53|17.44|0.08|1.23|1.00|6857|1
SHB|Nakashibetsu|Japao|JP|43.58|144.96|0.08|1.23|1.50|6560|1
SLY|Salekhard|Russia|RU|66.59|66.61|0.08|0.71|1.05|8917|1
SUX|Sioux City|EUA|US|42.40|-96.38|0.08|1.10|1.10|9002|1
TDD|Trinidad|Bolivia|BO|-14.82|-64.92|0.08|0.46|1.05|7874|1
TTA|Tan Tan|Marrocos|MA|28.45|-11.16|0.08|0.54|1.65|6562|1
YQQ|Comox|Canada|CA|49.71|-124.89|0.08|1.10|0.95|10000|1
YXS|Prince George|Canada|CA|53.88|-122.67|0.08|1.10|0.95|11450|1
ABX|East Albury|Australia|AU|-36.07|146.96|0.07|1.20|1.40|6234|1
ACK|Nantucket|EUA|US|41.25|-70.06|0.07|1.10|1.10|6303|1
AEX|Alexandria|EUA|US|31.33|-92.55|0.07|1.10|1.10|9352|1
AZR|Adrar|Argelia|DZ|27.84|-0.19|0.07|0.60|0.70|9843|1
BDT|Gbadolite|Congo (Kinshasa)|CD|4.25|20.98|0.07|0.22|0.50|10499|1
CJM|Chumphon|Tailandia|TH|10.71|99.36|0.07|0.60|2.00|6890|1
CKB|Bridgeport|EUA|US|39.30|-80.23|0.07|1.10|1.10|7800|1
FLG|Flagstaff|EUA|US|35.14|-111.67|0.07|1.10|1.10|8800|1
GDE|Gode|Etiopia|ET|5.94|43.58|0.07|0.35|0.80|7505|1
ILQ|Ilo|Peru|PE|-17.70|-71.34|0.07|0.52|1.50|8202|1
INV|Inverness|Reino Unido|GB|57.54|-4.05|0.07|1.05|1.10|6194|1
JLN|Joplin|EUA|US|37.15|-94.50|0.07|1.10|1.10|6502|1
JSA|Jaisalmer|India|IN|26.89|70.86|0.07|0.52|0.90|9000|1
JST|Johnstown|EUA|US|40.32|-78.83|0.07|1.10|1.10|7004|1
KGP|Kogalym|Russia|RU|62.19|74.53|0.07|0.71|1.05|8225|1
LET|Leticia|Colombia|CO|-4.19|-69.94|0.07|0.55|1.10|6168|1
MCW|Mason City|EUA|US|43.16|-93.33|0.07|1.10|1.10|6501|1
MGW|Morgantown|EUA|US|39.64|-79.92|0.07|1.10|1.10|5199|1
MLU|Monroe|EUA|US|32.51|-92.04|0.07|1.10|1.10|7504|1
MSO|Missoula|EUA|US|46.92|-114.09|0.07|1.10|1.10|9501|1
MZW|Mecheria|Argelia|DZ|33.54|-0.24|0.07|0.60|0.70|11780|1
NEC|Necochea|Argentina|AR|-38.49|-58.82|0.07|0.60|1.50|4921|1
NER|Neryungri|Russia|RU|56.91|124.91|0.07|0.71|1.05|11811|1
PIB|Moselle|EUA|US|31.47|-89.34|0.07|1.10|1.10|6503|1
PQQ|Port Macquarie|Australia|AU|-31.44|152.86|0.07|1.20|1.40|5203|1
RAP|Rapid City|EUA|US|44.05|-103.06|0.07|1.10|1.10|8701|1
SLU|Castries|Santa Lucia|LC|14.02|-60.99|0.07|0.65|1.90|5735|1
TXK|Texarkana|EUA|US|33.45|-93.99|0.07|1.10|1.10|6602|1
UAI|Suai|Timor-Leste|TL|-9.30|125.29|0.07|0.30|0.80|4921|1
UTN|Upington|Africa do Sul|ZA|-28.40|21.26|0.07|0.65|1.20|16076|1
VCT|Victoria|EUA|US|28.85|-96.92|0.07|1.10|1.10|9111|1
VDM|Viedma / Carmen de|Argentina|AR|-40.87|-63.00|0.07|0.60|1.50|8366|1
VLD|Valdosta|EUA|US|30.78|-83.28|0.07|1.10|1.10|8003|1
YAM|Sault Ste Marie|Canada|CA|46.48|-84.51|0.07|1.10|0.95|6000|1
YMM|Fort McMurray|Canada|CA|56.65|-111.22|0.07|1.10|0.95|7503|1
YQU|Grande Prairie|Canada|CA|55.18|-118.89|0.07|1.10|0.95|8502|1
BDU|Malselv|Noruega|NO|69.06|18.54|0.06|1.20|1.20|8015|1
BEF|Bluefields|Nicaragua|NI|11.99|-83.77|0.06|0.35|0.80|6625|1
CPR|Casper|EUA|US|42.91|-106.46|0.06|1.10|1.10|10165|1
CTD|Chitre|Panama|PA|7.99|-80.41|0.06|0.80|1.20|4921|1
DBQ|Dubuque|EUA|US|42.40|-90.71|0.06|1.10|1.10|6502|1
DOG|Dongola|Sudao|SD|19.15|30.43|0.06|0.24|0.50|9843|1
DRO|Durango|EUA|US|37.15|-107.75|0.06|1.10|1.10|9201|1
ELG|El Menia|Argelia|DZ|30.58|2.86|0.06|0.60|0.70|9843|1
EPU|Parnu|Estonia|EE|58.42|24.47|0.06|0.90|1.20|6463|1
GFK|Grand Forks|EUA|US|47.95|-97.18|0.06|1.10|1.10|7351|1
GGR|Garowe|Somalia|SO|8.46|48.57|0.06|0.20|0.50|6562|1
GLK|Galcaio|Somalia|SO|6.78|47.45|0.06|0.20|0.50|9859|1
GMQ|Golog|China|CN|34.42|100.30|0.06|0.80|1.00|12467|1
GTF|Great Falls|EUA|US|47.48|-111.37|0.06|1.10|1.10|10502|1
IVC|Invercargill|Nova Zelandia|NZ|-46.41|168.31|0.06|1.12|1.65|7251|1
KAW|Kawthoung|Mianmar|MM|10.05|98.54|0.06|0.30|0.70|6000|1
KLR|Kalmar|Suecia|SE|56.69|16.29|0.06|1.23|1.00|6726|1
KRF|Nyland|Suecia|SE|63.05|17.77|0.06|1.23|1.00|6565|1
LNY|Kahului|Estados Unidos|US|20.79|-156.95|0.06|1.00|2.10|5001|1
MOG|Mong Hsat|Mianmar|MM|20.52|99.26|0.06|0.30|0.70|5000|1
NOP|Sinop|Turquia|TR|42.02|35.07|0.06|0.65|1.30|6482|1
OHE|Mohe|China|CN|52.92|122.42|0.06|0.80|1.00|7218|1
OUZ|Zouerate|Mauritania|MR|22.76|-12.48|0.06|0.30|0.60|8202|1
PKB|Parkersburg|EUA|US|39.35|-81.44|0.06|1.10|1.10|7240|1
PPE|Puerto Penasco|Mexico|MX|31.35|-113.31|0.06|0.69|1.30|8202|1
RIS|Rishiri|Japao|JP|45.24|141.19|0.06|1.23|1.50|5906|1
TME|Tame|Colombia|CO|6.45|-71.76|0.06|0.55|1.10|6561|1
TSJ|Tsushima|Japao|JP|34.28|129.33|0.06|1.23|1.50|6234|1
TUP|Tupelo|EUA|US|34.27|-88.77|0.06|1.10|1.10|7150|1
TVF|Thief River Falls|EUA|US|48.07|-96.18|0.06|1.10|1.10|6504|1
UIN|Quincy|EUA|US|39.94|-91.19|0.06|1.10|1.10|7098|1
VAI|Vanimo|Papua-Nova Guine|PG|-2.69|141.30|0.06|0.34|0.90|5775|1
WBM|Wapenamanda|Papua-Nova Guine|PG|-5.64|143.89|0.06|0.34|0.90|5052|1
WKJ|Wakkanai|Japao|JP|45.40|141.80|0.06|1.23|1.50|6560|1
YBL|Campbell River|Canada|CA|49.95|-125.27|0.06|1.10|0.95|6499|1
YXH|Medicine Hat|Canada|CA|50.02|-110.72|0.06|1.10|0.95|5000|1
YYY|Mont-Joli|Canada|CA|48.61|-68.21|0.06|1.10|0.95|6000|1
ABK|Kebri Dahar|Etiopia|ET|6.73|44.24|0.05|0.35|0.80|8202|1
AJA|Ajaccio|Franca|FR|41.92|8.80|0.05|1.12|1.35|7897|1
ART|Watertown|EUA|US|43.99|-76.02|0.05|1.10|1.10|7001|1
BBA|Balmaceda|Chile|CL|-45.92|-71.69|0.05|0.70|1.30|8205|1
BBQ|Codrington|Antigua e Barbuda|AG|17.62|-61.80|0.05|0.80|2.00|6100|1
BCH|Baucau|Timor-Leste|TL|-8.49|126.40|0.05|0.30|0.80|8233|1
BDH|Bandar Lengeh|Ira|IR|26.53|54.82|0.05|0.45|0.80|8203|1
BGC|Braganca|Portugal|PT|41.86|-6.71|0.05|0.84|1.90|5600|1
BGR|Bangor|EUA|US|44.81|-68.83|0.05|1.10|1.10|11440|1
BWT|Burnie|Australia|AU|-41.00|145.73|0.05|1.20|1.40|5413|1
BYO|Bonito|Brasil|BR|-21.25|-56.45|0.05|0.68|0.85|6562|1
CDC|Cedar City|EUA|US|37.70|-113.10|0.05|1.10|1.10|8653|1
CFN|Donegal|Irlanda|IE|55.04|-8.34|0.05|1.15|1.15|4908|1
CIW|Canouan|Sao Vicente e Granadinas|VC|12.70|-61.34|0.05|0.62|1.80|5900|1
CRW|Charleston|EUA|US|38.37|-81.59|0.05|1.10|1.10|6715|1
EAT|Wenatchee|EUA|US|47.40|-120.21|0.05|1.10|1.10|7000|1
FAI|Fairbanks|EUA|US|64.82|-147.86|0.05|1.10|1.10|11800|1
FRS|San Benito|Guatemala|GT|16.91|-89.87|0.05|0.45|1.00|9842|1
FSC|Figari|Franca|FR|41.50|9.10|0.05|1.12|1.35|8136|1
GCK|Garden City|EUA|US|37.93|-100.72|0.05|1.10|1.10|7299|1
GLT|Gladstone|Australia|AU|-23.87|151.23|0.05|1.20|1.40|5364|1
GTR|Columbus/W|EUA|US|33.45|-88.59|0.05|1.10|1.10|8003|1
GYA|Guayaramerin|Bolivia|BO|-10.89|-65.38|0.05|0.46|1.05|5767|1
ISG|Ishigaki|Japao|JP|24.40|124.25|0.05|1.23|1.50|6562|1
JER|St. Peter|Jersey|JE|49.21|-2.20|0.05|1.25|1.30|5594|1
JKH|Chios Island|Grecia|GR|38.34|26.14|0.05|0.77|2.10|4957|1
KSU|Kvernberget|Noruega|NO|63.11|7.82|0.05|1.20|1.20|7841|1
LXG|Luang Namtha|Laos|LA|20.97|101.40|0.05|0.32|1.10|5249|1
MNJ|Mananjary|Madagascar|MG|-21.20|48.36|0.05|0.25|1.20|4921|1
MOT|Minot|EUA|US|48.26|-101.28|0.05|1.10|1.10|7700|1
NYA|Nyagan|Russia|RU|62.11|65.61|0.05|0.71|1.05|8307|1
NYM|Nadym|Russia|RU|65.48|72.70|0.05|0.71|1.05|8360|1
OSD|Ostersund|Suecia|SE|63.19|14.50|0.05|1.23|1.00|8202|1
OVS|Sovetskiy|Russia|RU|61.33|63.60|0.05|0.71|1.05|8202|1
PEX|Pechora|Russia|RU|65.12|57.13|0.05|0.71|1.05|5905|1
PIH|Pocatello|EUA|US|42.91|-112.60|0.05|1.10|1.10|9059|1
PZH|Fort Sandeman|Paquistao|PK|31.36|69.46|0.05|0.40|0.60|6001|1
RGA|Rio Grande|Argentina|AR|-53.78|-67.75|0.05|0.60|1.50|6562|1
ROW|Roswell|EUA|US|33.30|-104.53|0.05|1.10|1.10|13000|1
SBY|Salisbury|EUA|US|38.34|-75.51|0.05|1.10|1.10|6400|1
SJE|San Jose Del Guaviare|Colombia|CO|2.58|-72.64|0.05|0.55|1.10|4897|1
SJL|Sao Gabriel da Cachoeira|Brasil|BR|-0.15|-66.99|0.05|0.68|0.85|8530|1
SLN|Salina|EUA|US|38.79|-97.65|0.05|1.10|1.10|12301|1
SNW|Thandwe|Mianmar|MM|18.46|94.30|0.05|0.30|0.70|5502|1
SPN|I Fadang, Saipan|Marianas do Norte|MP|15.12|145.73|0.05|0.75|1.70|8700|1
STX|Christiansted|Ilhas Virgens Americanas|VI|17.70|-64.80|0.05|0.90|2.00|10002|1
SVL|Savonlinna|Finlandia|FI|61.94|28.95|0.05|1.30|1.10|7546|1
TBH|Tablas Island|Filipinas|PH|12.31|122.08|0.05|0.47|1.05|4560|1
TIN|Tindouf|Argelia|DZ|27.70|-8.17|0.05|0.60|0.70|9840|1
TIQ|Tinian Island|Marianas do Norte|MP|15.00|145.62|0.05|0.75|1.70|8600|1
TWF|Twin Falls|EUA|US|42.48|-114.49|0.05|1.10|1.10|8704|1
UKX|Ust-Kut|Russia|RU|56.86|105.73|0.05|0.71|1.05|6561|1
UNN|Ranong|Tailandia|TH|9.78|98.59|0.05|0.60|2.00|6562|1
YBR|Brandon|Canada|CA|49.91|-99.95|0.05|1.10|0.95|6500|1
YYB|North Bay|Canada|CA|46.36|-79.42|0.05|1.10|0.95|10000|1
AAA|Anaa|Polinesia Francesa|PF|-17.35|-145.51|0.04|0.85|2.10|4921|1
AAY|Al Ghaydah|Iemen|YE|16.19|52.17|0.04|0.20|0.50|8858|1
ABM|Bamaga|Australia|AU|-10.95|142.46|0.04|1.20|1.40|5462|1
ABR|Aberdeen|EUA|US|45.45|-98.42|0.04|1.10|1.10|6901|1
ABS|Abu Simbel|Egito|EG|22.38|31.61|0.04|0.45|2.00|9843|1
ADK|Adak|EUA|US|51.88|-176.64|0.04|1.10|1.10|7790|1
ADQ|Kodiak|EUA|US|57.75|-152.49|0.04|1.10|1.10|7534|1
AFL|Alta Floresta|Brasil|BR|-9.87|-56.11|0.04|0.68|0.85|8202|1
AIA|Alliance|EUA|US|42.05|-102.80|0.04|1.10|1.10|9203|1
AIT|Aitutaki|Ilhas Cook|CK|-18.83|-159.76|0.04|0.75|2.00|5920|1
AJN|Ouani|Comores|KM|-12.13|44.43|0.04|0.24|1.00|4429|1
AJR|Arvidsjaur|Suecia|SE|65.59|19.28|0.04|1.23|1.00|8201|1
AKB|Atka|EUA|US|52.22|-174.21|0.04|1.10|1.10|4500|1
AKN|King Salmon|EUA|US|58.68|-156.65|0.04|1.10|1.10|8901|1
ALF|Alta|Noruega|NO|69.98|23.37|0.04|1.20|1.20|7165|1
ALH|Albany|Australia|AU|-34.94|117.81|0.04|1.20|1.40|5906|1
ALS|Alamosa|EUA|US|37.43|-105.87|0.04|1.10|1.10|8521|1
ANI|Aniak|EUA|US|61.58|-159.54|0.04|1.10|1.10|6200|1
ANX|Andenes|Noruega|NO|69.30|16.14|0.04|1.20|1.20|8097|1
AOK|Karpathos Island|Grecia|GR|35.42|27.15|0.04|0.77|2.10|7871|1
APN|Alpena|EUA|US|45.08|-83.56|0.04|1.10|1.10|9001|1
ARD|Kabola|Indonesia|ID|-8.13|124.60|0.04|0.50|0.90|4586|1
ARM|Armidale|Australia|AU|-30.53|151.62|0.04|1.20|1.40|5702|1
ASE|Aspen|EUA|US|39.22|-106.87|0.04|1.10|1.10|8006|1
ASI|Cat Hill|Santa Helena|SH|-7.97|-14.39|0.04|0.80|1.50|10019|1
ASP|Alice Springs|Australia|AU|-23.81|133.90|0.04|1.20|1.40|7999|1
ATC|Arthur's Town|Bahamas|BS|24.63|-75.67|0.04|0.75|2.10|7015|1
ATY|Watertown|EUA|US|44.91|-97.15|0.04|1.10|1.10|6898|1
AWK|Wake Island|Ilhas Menores dos EUA|UM|19.28|166.64|0.04|0.80|0.80|9843|1
AXA|The Valley|Anguila|AI|18.20|-63.05|0.04|0.85|2.00|5462|1
AXP|Spring Point|Bahamas|BS|22.44|-73.97|0.04|0.75|2.10|5000|1
AYQ|Yulara|Australia|AU|-25.19|130.98|0.04|1.20|1.40|8527|1
BCI|Barcaldine|Australia|AU|-23.57|145.30|0.04|1.20|1.40|5591|1
BEB|Balivanich|Reino Unido|GB|57.48|-7.36|0.04|1.05|1.10|6027|1
BEJ|Tanjung Redeb - Borneo|Indonesia|ID|2.15|117.43|0.04|0.50|0.90|4625|1
BET|Bethel|EUA|US|60.78|-161.84|0.04|1.10|1.10|6400|1
BEU|Bedourie|Australia|AU|-24.35|139.46|0.04|1.20|1.40|4921|1
BFD|Bradford|EUA|US|41.80|-78.64|0.04|1.10|1.10|6307|1
BFF|Scottsbluff|EUA|US|41.87|-103.60|0.04|1.10|1.10|8279|1
BHB|Bar Harbor|EUA|US|44.45|-68.36|0.04|1.10|1.10|5200|1
BHQ|Broken Hill|Australia|AU|-32.00|141.47|0.04|1.20|1.40|8251|1
BIH|Bishop|EUA|US|37.37|-118.36|0.04|1.10|1.10|7498|1
BIK|Biak|Indonesia|ID|-1.19|136.11|0.04|0.50|0.90|11715|1
BIM|South Bimini|Bahamas|BS|25.70|-79.26|0.04|0.75|2.10|5409|1
BKG|Branson|EUA|US|36.53|-93.20|0.04|1.10|1.10|7140|1
BKQ|Blackall|Australia|AU|-24.43|145.43|0.04|1.20|1.40|5538|1
BKW|Beaver|EUA|US|37.79|-81.12|0.04|1.10|1.10|6750|1
BMW|Bordj Badji Mokhtar|Argelia|DZ|21.38|0.93|0.04|0.60|0.70|9843|1
BNK|Ballina|Australia|AU|-28.83|153.56|0.04|1.20|1.40|6234|1
BOB|Motu Mute|Polinesia Francesa|PF|-16.44|-151.75|0.04|0.85|2.10|4921|1
BOC|Isla Colon|Panama|PA|9.34|-82.25|0.04|0.80|1.20|4921|1
BQG|Bogorodskoye|Russia|RU|52.38|140.45|0.04|0.71|1.05|4593|1
BRD|Brainerd|EUA|US|46.40|-94.13|0.04|1.10|1.10|7100|1
BRK|Bourke|Australia|AU|-30.04|145.95|0.04|1.20|1.40|6004|1
BRW|Utqiagvik|EUA|US|71.29|-156.77|0.04|1.10|1.10|7100|1
BTM|Butte|EUA|US|45.95|-112.50|0.04|1.10|1.10|9000|1
BTW|Batu Licin|Indonesia|ID|-3.41|116.00|0.04|0.50|0.90|5930|1
BUA|Buka Island|Papua-Nova Guine|PG|-5.42|154.67|0.04|0.34|0.90|5125|1
BUC|Burketown|Australia|AU|-17.75|139.53|0.04|1.20|1.40|4501|1
BUU|Muara Bungo|Indonesia|ID|-1.54|102.18|0.04|0.50|0.90|4430|1
BVC|Rabil|Cabo Verde|CV|16.14|-22.89|0.04|0.45|1.90|6890|1
BVI|Birdsville|Australia|AU|-25.90|139.35|0.04|1.20|1.40|5682|1
BVJ|Bovanenkovo|Russia|RU|70.32|68.33|0.04|0.71|1.05|8698|1
BYN|Bayankhongor|Mongolia|MN|46.16|100.70|0.04|0.42|1.10|9186|1
BZN|Bozeman|EUA|US|45.78|-111.15|0.04|1.10|1.10|8994|1
CAF|Carauari|Brasil|BR|-4.87|-66.90|0.04|0.68|0.85|5463|1
CAJ|Canaima|Venezuela|VE|6.23|-62.85|0.04|0.45|0.70|7070|1
CAZ|Cobar|Australia|AU|-31.54|145.79|0.04|1.20|1.40|5564|1
CCA|Chimore|Bolivia|BO|-16.98|-65.15|0.04|0.46|1.05|4801|1
CDB|Cold Bay|EUA|US|55.21|-162.73|0.04|1.10|1.10|10179|1
CDR|Chadron|EUA|US|42.84|-103.10|0.04|1.10|1.10|5998|1
CDV|Cordova|EUA|US|60.49|-145.48|0.04|1.10|1.10|7500|1
CEC|Crescent City|EUA|US|41.78|-124.24|0.04|1.10|1.10|5002|1
CED|Ceduna|Australia|AU|-32.13|133.71|0.04|1.20|1.40|5709|1
CEZ|Cortez|EUA|US|37.30|-108.63|0.04|1.10|1.10|7205|1
CHH|Chachapoyas|Peru|PE|-6.20|-77.86|0.04|0.52|1.50|6496|1
CHT|Te One|Nova Zelandia|NZ|-43.81|-176.47|0.04|1.12|1.65|4462|1
CIJ|Cobija|Bolivia|BO|-11.04|-68.78|0.04|0.46|1.05|6562|1
CIU|Kincheloe|EUA|US|46.24|-84.46|0.04|1.10|1.10|7203|1
CKH|Chokurdah|Russia|RU|70.62|147.90|0.04|0.71|1.05|6233|1
CKW|Christmas Creek Mine|Australia|AU|-22.35|119.64|0.04|1.20|1.40|8202|1
CMA|Cunnamulla|Australia|AU|-28.03|145.62|0.04|1.20|1.40|5686|1
CMX|Hancock|EUA|US|47.17|-88.49|0.04|1.10|1.10|6501|1
CNB|Coonamble|Australia|AU|-30.98|148.38|0.04|1.20|1.40|5010|1
CNJ|Cloncurry|Australia|AU|-20.67|140.50|0.04|1.20|1.40|6562|1
CNM|Carlsbad|EUA|US|32.34|-104.26|0.04|1.10|1.10|7854|1
CNY|Moab|EUA|US|38.76|-109.75|0.04|1.10|1.10|7360|1
COD|Cody|EUA|US|44.52|-109.02|0.04|1.10|1.10|8268|1
COQ|Choibalsan|Mongolia|MN|48.14|114.65|0.04|0.42|1.10|8530|1
CPC|Chapelco/San Martin de|Argentina|AR|-40.08|-71.14|0.04|0.60|1.50|8205|1
CSH|Solovetsky Islands|Russia|RU|65.03|35.73|0.04|0.71|1.05|4920|1
CTL|Charleville|Australia|AU|-26.41|146.26|0.04|1.20|1.40|5000|1
CTN|Cooktown|Australia|AU|-15.44|145.18|0.04|1.20|1.40|5338|1
CVN|Clovis|EUA|US|34.43|-103.08|0.04|1.10|1.10|7200|1
CVQ|Carnarvon|Australia|AU|-24.88|113.67|0.04|1.20|1.40|5509|1
CYB|West End|Ilhas Cayman|KY|19.69|-79.88|0.04|1.25|2.00|6000|1
CYO|Cayo Largo del Sur|Cuba|CU|21.62|-81.55|0.04|0.40|1.70|9869|1
CYX|Cherskiy|Russia|RU|68.74|161.34|0.04|0.71|1.05|5577|1
DAU|Daru|Papua-Nova Guine|PG|-9.09|143.21|0.04|0.34|0.90|4593|1
DBO|Dubbo|Australia|AU|-32.22|148.57|0.04|1.20|1.40|5604|1
DCY|Garze|China|CN|29.32|100.06|0.04|0.80|1.00|13780|1
DDC|Dodge City|EUA|US|37.76|-99.97|0.04|1.10|1.10|6899|1
DDR|Xigaze|China|CN|28.60|86.80|0.04|0.80|1.00|14764|1
DEX|Dekai|Indonesia|ID|-4.86|139.48|0.04|0.50|0.90|6398|1
DIK|Dickinson|EUA|US|46.80|-102.80|0.04|1.10|1.10|7301|1
DLG|Dillingham|EUA|US|59.04|-158.51|0.04|1.10|1.10|6400|1
DLZ|Dalanzadgad|Mongolia|MN|43.61|104.37|0.04|0.42|1.10|7545|1
DMD|Doomadgee|Australia|AU|-17.94|138.82|0.04|1.20|1.40|5433|1
DOM|Marigot|Dominica|DM|15.55|-61.30|0.04|0.60|1.70|6352|1
DUJ|Dubois|EUA|US|41.18|-78.90|0.04|1.10|1.10|5503|1
DUT|Unalaska|EUA|US|53.90|-166.54|0.04|1.10|1.10|4500|1
DVL|Devils Lake|EUA|US|48.12|-98.91|0.04|1.10|1.10|6400|1
DYR|Anadyr|Russia|RU|64.73|177.74|0.04|0.71|1.05|11483|1
EDR|Pormpuraaw|Australia|AU|-14.90|141.61|0.04|1.20|1.40|4462|1
EFL|Kefallinia Island|Grecia|GR|38.12|20.50|0.04|0.77|2.10|7992|1
EGE|Eagle|EUA|US|39.64|-106.92|0.04|1.10|1.10|9000|1
EGS|Egilsstadir|Islandia|IS|65.28|-14.40|0.04|1.15|2.10|7054|1
EJH|Al Wajh|Arabia Saudita|SA|26.20|36.48|0.04|0.97|1.10|10007|1
EKO|Elko|EUA|US|40.82|-115.79|0.04|1.10|1.10|7214|1
ELC|Elcho Island|Australia|AU|-12.02|135.57|0.04|1.20|1.40|4724|1
ELD|El Dorado|EUA|US|33.22|-92.81|0.04|1.10|1.10|6601|1
ELH|North Eleuthera|Bahamas|BS|25.48|-76.68|0.04|0.75|2.10|6020|1
EMD|Emerald|Australia|AU|-23.57|148.18|0.04|1.20|1.40|6234|1
ENA|Kenai|EUA|US|60.57|-151.25|0.04|1.10|1.10|7855|1
ENF|Enontekio|Finlandia|FI|68.36|23.42|0.04|1.30|1.10|6565|1
ENT|Eniwetok Atoll|Ilhas Marshall|MH|11.34|162.33|0.04|0.48|1.10|7700|1
EPR|Esperance|Australia|AU|-33.68|121.82|0.04|1.20|1.40|4921|1
EQS|Esquel|Argentina|AR|-42.91|-71.14|0.04|0.60|1.50|7874|1
ERL|Erenhot|China|CN|43.42|112.09|0.04|0.80|1.00|9186|1
ESC|Escanaba|EUA|US|45.72|-87.09|0.04|1.10|1.10|6498|1
ESR|El Salvador|Chile|CL|-26.31|-69.77|0.04|0.70|1.30|7546|1
EVG|Sveg|Suecia|SE|62.05|14.42|0.04|1.23|1.00|5579|1
EYK|Beloyarskiy|Russia|RU|63.69|66.70|0.04|0.71|1.05|7028|1
EYW|Key West|EUA|US|24.56|-81.76|0.04|1.10|1.10|5076|1
FAV|Fakarava|Polinesia Francesa|PF|-16.05|-145.66|0.04|0.85|2.10|4596|1
FCA|Kalispell|EUA|US|48.31|-114.26|0.04|1.10|1.10|9007|1
FEN|Fernando de Noronha|Brasil|BR|-3.85|-32.42|0.04|0.68|0.85|6053|1
FLW|Santa Cruz das Flores|Portugal|PT|39.46|-31.13|0.04|0.84|1.90|4593|1
FOD|Fort Dodge|EUA|US|42.55|-94.19|0.04|1.10|1.10|6547|1
FSP|Saint-Pierre|Sao Pedro e Miquelao|PM|46.76|-56.17|0.04|0.95|1.20|5906|1
FTE|El Calafate|Argentina|AR|-50.28|-72.05|0.04|0.60|1.50|8366|1
FUN|Funafuti|Tuvalu|TV|-8.52|179.20|0.04|0.42|1.00|5040|1
GAL|Galena|EUA|US|64.74|-156.94|0.04|1.10|1.10|6000|1
GAM|Gambell|EUA|US|63.77|-171.73|0.04|1.10|1.10|4500|1
GAX|Gamba|Gabao|GA|-2.79|10.05|0.04|0.45|0.70|5906|1
GCC|Gillette|EUA|US|44.35|-105.54|0.04|1.10|1.10|7501|1
GCI|Saint Peter Port|Guernsey|GG|49.44|-2.60|0.04|1.20|1.20|5194|1
GCN|Grand Canyon - Tusayan|EUA|US|35.95|-112.15|0.04|1.10|1.10|8999|1
GDT|Cockburn Town|Ilhas Turcas e Caicos|TC|21.44|-71.14|0.04|0.90|2.10|6362|1
GDV|Glendive|EUA|US|47.14|-104.81|0.04|1.10|1.10|5704|1
GEM|Mengomeyen|Guine Equatorial|GQ|1.68|11.02|0.04|0.40|0.50|9843|1
GER|Nueva Gerona|Cuba|CU|21.83|-82.78|0.04|0.40|1.70|8202|1
GET|Moonyoonooka|Australia|AU|-28.80|114.71|0.04|1.20|1.40|7838|1
GEV|Gallivare|Suecia|SE|67.13|20.81|0.04|1.23|1.00|5623|1
GFF|Griffith|Australia|AU|-34.25|146.07|0.04|1.20|1.40|4931|1
GGT|Moss Town|Bahamas|BS|23.56|-75.88|0.04|0.75|2.10|7051|1
GGW|Glasgow|EUA|US|48.21|-106.61|0.04|1.10|1.10|5002|1
GHB|Governor's Harbour|Bahamas|BS|25.28|-76.33|0.04|0.75|2.10|8024|1
GKA|Goronka|Papua-Nova Guine|PG|-6.08|145.39|0.04|0.34|0.90|5400|1
GKN|Gulkana|EUA|US|62.16|-145.45|0.04|1.10|1.10|5001|1
GLF|Golfito|Costa Rica|CR|8.65|-83.18|0.04|0.61|1.85|4593|1
GLH|Greenville|EUA|US|33.48|-90.99|0.04|1.10|1.10|8001|1
GMR|Totegegie|Polinesia Francesa|PF|-23.08|-134.89|0.04|0.85|2.10|6562|1
GOQ|Golmud|China|CN|36.40|94.79|0.04|0.80|1.00|15748|1
GOV|Nhulunbuy|Australia|AU|-12.27|136.82|0.04|1.20|1.40|7244|1
GOY|Tura|Russia|RU|64.33|100.43|0.04|0.71|1.05|4593|1
GPS|Isla Baltra|Equador|EC|-0.45|-90.27|0.04|0.57|1.05|7877|1
GRW|Santa Cruz da Graciosa|Portugal|PT|39.09|-28.03|0.04|0.84|1.90|4529|1
GST|Gustavus|EUA|US|58.43|-135.71|0.04|1.10|1.10|6720|1
GTE|Groote Eylandt|Australia|AU|-13.97|136.46|0.04|1.20|1.40|6237|1
GUB|San Quintin|Mexico|MX|28.03|-114.02|0.04|0.69|1.30|7216|1
GUC|Gunnison|EUA|US|38.53|-106.93|0.04|1.10|1.10|9400|1
GUP|Gallup|EUA|US|35.51|-108.79|0.04|1.10|1.10|7312|1
GUR|Gurney|Papua-Nova Guine|PG|-10.31|150.33|0.04|0.34|0.90|5546|1
GWT|Sylt|Alemanha|DE|54.91|8.34|0.04|1.15|1.00|6955|1
GYZ|Cosmo Newbery|Australia|AU|-28.03|123.82|0.04|1.20|1.40|6890|1
HAC|Hachijojima|Japao|JP|33.11|139.79|0.04|1.23|1.50|6563|1
HDN|Hayden|EUA|US|40.48|-107.22|0.04|1.10|1.10|10000|1
HFN|Hofn|Islandia|IS|64.30|-15.23|0.04|1.15|2.10|4921|1
HFS|Rada|Suecia|SE|60.02|13.58|0.04|1.23|1.00|4951|1
HGD|Hughenden|Australia|AU|-20.82|144.23|0.04|1.20|1.40|5394|1
HGN|Mae Hong Son|Tailandia|TH|19.30|97.98|0.04|0.60|2.00|6562|1
HGU|Mount Hagen|Papua-Nova Guine|PG|-5.83|144.30|0.04|0.34|0.90|7185|1
HIB|Hibbing|EUA|US|47.38|-92.84|0.04|1.10|1.10|6758|1
HID|Horn|Australia|AU|-10.59|142.29|0.04|1.20|1.40|4557|1
HKN|Kimbe|Papua-Nova Guine|PG|-5.46|150.41|0.04|0.34|0.90|6644|1
HLE|Jamestown|Santa Helena|SH|-15.96|-5.65|0.04|0.80|1.50|6398|1
HLN|Helena|EUA|US|46.61|-111.98|0.04|1.10|1.10|9000|1
HME|Hassi Messaoud|Argelia|DZ|31.67|6.14|0.04|0.60|0.70|9843|1
HMV|Hemavan|Suecia|SE|65.81|15.08|0.04|1.23|1.00|5254|1
HOB|Hobbs|EUA|US|32.69|-103.22|0.04|1.10|1.10|8000|1
HOI|Otepa|Polinesia Francesa|PF|-18.07|-140.95|0.04|0.85|2.10|11089|1
HOM|Homer|EUA|US|59.64|-151.48|0.04|1.10|1.10|6701|1
HOR|Horta|Portugal|PT|38.52|-28.72|0.04|0.84|1.90|5233|1
HRO|Harrison|EUA|US|36.26|-93.15|0.04|1.10|1.10|6161|1
HTG|Khatanga|Russia|RU|71.98|102.49|0.04|0.71|1.05|8872|1
HTI|Hamilton Island|Australia|AU|-20.36|148.95|0.04|1.20|1.40|5591|1
HUH|Fare|Polinesia Francesa|PF|-16.69|-151.02|0.04|0.85|2.10|4921|1
HVD|Khovd|Mongolia|MN|47.95|91.63|0.04|0.42|1.10|9352|1
HVR|Havre|EUA|US|48.54|-109.76|0.04|1.10|1.10|5205|1
HYS|Hays|EUA|US|38.84|-99.27|0.04|1.10|1.10|6501|1
IAA|Igarka|Russia|RU|67.44|86.62|0.04|0.71|1.05|8202|1
IAM|In Amenas|Argelia|DZ|28.05|9.64|0.04|0.60|0.70|9843|1
IBB|Puerto Villamil|Equador|EC|-0.94|-90.95|0.04|0.57|1.05|4921|1
IFJ|Isafjordur|Islandia|IS|66.06|-23.14|0.04|1.15|2.10|4593|1
IGA|Matthew Town|Bahamas|BS|20.98|-73.67|0.04|0.75|2.10|7020|1
IKS|Tiksi|Russia|RU|71.70|128.90|0.04|0.71|1.05|9845|1
ILI|Iliamna|EUA|US|59.75|-154.91|0.04|1.10|1.10|5086|1
ILY|Isle of Islay, Argyll and|Reino Unido|GB|55.68|-6.26|0.04|1.05|1.10|5098|1
IMT|Kingsford|EUA|US|45.82|-88.11|0.04|1.10|1.10|6502|1
INL|International Falls|EUA|US|48.57|-93.40|0.04|1.10|1.10|7400|1
INU|Yaren|Nauru|NR|-0.55|166.92|0.04|0.55|0.80|7054|1
INZ|In Salah|Argelia|DZ|27.25|2.51|0.04|0.60|0.70|9843|1
IPT|Williamsport|EUA|US|41.24|-76.92|0.04|1.10|1.10|6825|1
IRG|Lockhart River|Australia|AU|-12.79|143.30|0.04|1.20|1.40|4919|1
IRK|Kirksville|EUA|US|40.09|-92.54|0.04|1.10|1.10|6005|1
ISA|Mount Isa|Australia|AU|-20.67|139.49|0.04|1.20|1.40|8399|1
ITO|Hilo|EUA|US|19.72|-155.05|0.04|1.10|1.10|9800|1
ITU|Kurilsk|Russia|RU|45.26|147.96|0.04|0.71|1.05|7546|1
IUE|Alofi|Niue|NU|-19.08|-169.92|0.04|0.70|1.60|7660|1
IWD|Ironwood|EUA|US|46.53|-90.13|0.04|1.10|1.10|6502|1
IXL|Leh|India|IN|34.14|77.55|0.04|0.52|0.90|9040|1
JAC|Jackson|EUA|US|43.61|-110.74|0.04|1.10|1.10|6300|1
JCK|Julia Creek|Australia|AU|-20.67|141.72|0.04|1.20|1.40|4600|1
JIK|Ikaria Island|Grecia|GR|37.68|26.35|0.04|0.77|2.10|4551|1
JJU|Qaqortoq|Groenlandia|GL|60.76|-46.07|0.04|1.00|1.60|4924|1
JMK|Mykonos|Grecia|GR|37.44|25.35|0.04|0.77|2.10|6240|1
JMS|Jamestown|EUA|US|46.93|-98.68|0.04|1.10|1.10|6502|1
JNU|Juneau|EUA|US|58.35|-134.57|0.04|1.10|1.10|8857|1
JSH|Crete Island|Grecia|GR|35.22|26.10|0.04|0.77|2.10|6804|1
JZH|Ngawa|China|CN|32.85|103.68|0.04|0.80|1.00|10499|1
KAB|Kariba|Zimbabue|ZW|-16.52|28.89|0.04|0.30|0.90|5413|1
KAJ|Kajaani|Finlandia|FI|64.29|27.69|0.04|1.30|1.10|8199|1
KAO|Kuusamo|Finlandia|FI|65.99|29.24|0.04|1.30|1.10|8202|1
KAT|Awanui|Nova Zelandia|NZ|-35.07|173.29|0.04|1.12|1.65|4600|1
KAX|Kalbarri|Australia|AU|-27.69|114.26|0.04|1.20|1.40|5246|1
KBU|Stagen|Indonesia|ID|-3.29|116.16|0.04|0.50|0.90|5413|1
KDL|Kardla|Estonia|EE|58.99|22.83|0.04|0.90|1.20|4987|1
KEM|Kemi / Tornio|Finlandia|FI|65.78|24.58|0.04|1.30|1.10|8212|1
KGC|Kingscote|Australia|AU|-35.71|137.52|0.04|1.20|1.40|4600|1
KGI|Broadwood|Australia|AU|-30.79|121.46|0.04|1.20|1.40|6562|1
KIE|Kieta|Papua-Nova Guine|PG|-6.31|155.73|0.04|0.34|0.90|5397|1
KIR|Farranfore|Irlanda|IE|52.18|-9.52|0.04|1.15|1.15|6562|1
KIT|Kithira Island|Grecia|GR|36.27|23.02|0.04|0.77|2.10|4794|1
KJI|Burqin|China|CN|48.22|87.00|0.04|0.80|1.00|8202|1
KKN|Kirkenes|Noruega|NO|69.73|29.89|0.04|1.20|1.20|6939|1
KLW|Klawock|EUA|US|55.58|-133.08|0.04|1.10|1.10|5000|1
KMC|King Khaled Military City|Arabia Saudita|SA|27.90|45.53|0.04|0.97|1.10|12005|1
KNG|Kaimana|Indonesia|ID|-3.64|133.70|0.04|0.50|0.90|5249|1
KNS|King Island|Australia|AU|-39.88|143.88|0.04|1.20|1.40|5198|1
KNX|Kununurra|Australia|AU|-15.78|128.71|0.04|1.20|1.40|6000|1
KOI|Kirkwall, Orkney Islands|Reino Unido|GB|58.96|-2.91|0.04|1.05|1.10|4690|1
KPW|Keperveem|Russia|RU|67.85|166.14|0.04|0.71|1.05|11482|1
KQA|Akutan|EUA|US|54.14|-165.60|0.04|1.10|1.10|4500|1
KQR|Karara|Australia|AU|-29.22|116.69|0.04|1.20|1.40|4593|1
KTA|Karratha|Australia|AU|-20.71|116.77|0.04|1.20|1.40|7480|1
KTD|Kitadaitojima|Japao|JP|25.94|131.33|0.04|1.23|1.50|4921|1
KTG|Ketapang|Indonesia|ID|-1.82|109.96|0.04|0.50|0.90|4585|1
KTN|Ketchikan|EUA|US|55.36|-131.71|0.04|1.10|1.10|7500|1
KUM|Yakushima|Japao|JP|30.39|130.66|0.04|1.23|1.50|4921|1
KVG|Kavieng|Papua-Nova Guine|PG|-2.58|150.81|0.04|0.34|0.90|5592|1
KWA|Kwajalein|Ilhas Marshall|MH|8.72|167.73|0.04|0.48|1.10|6668|1
KWM|Kowanyama|Australia|AU|-15.49|141.75|0.04|1.20|1.40|4528|1
KXB|Kolaka|Indonesia|ID|-4.34|121.52|0.04|0.50|0.90|6070|1
LAR|Laramie|EUA|US|41.31|-105.68|0.04|1.10|1.10|8503|1
LAU|Lamu|Quenia|KE|-2.25|40.91|0.04|0.45|1.50|6561|1
LBF|North Platte|EUA|US|41.13|-100.68|0.04|1.10|1.10|8001|1
LBL|Liberal|EUA|US|37.04|-100.96|0.04|1.10|1.10|7105|1
LDG|Leshukonskoye|Russia|RU|64.90|45.72|0.04|0.71|1.05|5236|1
LEA|Exmouth|Australia|AU|-22.24|114.09|0.04|1.20|1.40|9997|1
LEB|Lebanon|EUA|US|43.63|-72.30|0.04|1.10|1.10|5496|1
LER|Leinster|Australia|AU|-27.84|120.70|0.04|1.20|1.40|5906|1
LHG|Lightning Ridge|Australia|AU|-29.45|147.98|0.04|1.20|1.40|4613|1
LHS|Las Heras|Argentina|AR|-46.54|-68.97|0.04|0.60|1.50|4593|1
LIW|Loikaw|Mianmar|MM|19.69|97.21|0.04|0.30|0.70|5200|1
LKL|Lakselv|Noruega|NO|70.07|24.97|0.04|1.20|1.20|9147|1
LMP|Lampedusa|Italia|IT|35.50|12.62|0.04|1.00|1.40|5906|1
LNO|Leonora|Australia|AU|-28.88|121.32|0.04|1.20|1.40|6621|1
LRE|Longreach|Australia|AU|-23.43|144.28|0.04|1.20|1.40|6352|1
LSI|Lerwick, Shetland|Reino Unido|GB|59.88|-1.30|0.04|1.05|1.10|4915|1
LSR|Kutacane|Indonesia|ID|3.39|97.86|0.04|0.50|0.90|5358|1
LSY|Lismore|Australia|AU|-28.83|153.26|0.04|1.20|1.40|5404|1
LTD|Ghadames|Libia|LY|30.15|9.70|0.04|0.40|0.50|11811|1
LTM|Lethem|Guiana|GY|3.37|-59.79|0.04|0.48|0.80|5985|1
LUD|Luderitz|Namibia|NA|-26.69|15.24|0.04|0.45|1.30|6004|1
LVO|Laverton|Australia|AU|-28.61|122.43|0.04|1.20|1.40|5906|1
LWB|Lewisburg|EUA|US|37.86|-80.40|0.04|1.10|1.10|7003|1
LWK|Lerwick, Shetland Islands|Reino Unido|GB|60.19|-1.24|0.04|1.05|1.10|5787|1
LXS|Limnos Island|Grecia|GR|39.92|25.24|0.04|0.77|2.10|9895|1
LYC|Lycksele|Suecia|SE|64.55|18.72|0.04|1.23|1.00|6564|1
LYR|Longyearbyen|Noruega|NO|78.25|15.47|0.04|1.20|1.20|7608|1
MAG|Madang|Papua-Nova Guine|PG|-5.21|145.79|0.04|0.34|0.90|5174|1
MAS|Manus Island|Papua-Nova Guine|PG|-2.06|147.42|0.04|0.34|0.90|6136|1
MBL|Manistee|EUA|US|44.27|-86.25|0.04|1.10|1.10|5501|1
MCG|McGrath|EUA|US|62.95|-155.61|0.04|1.10|1.10|5936|1
MCK|McCook|EUA|US|40.21|-100.59|0.04|1.10|1.10|6450|1
MCV|McArthur River Mine|Australia|AU|-16.44|136.08|0.04|1.20|1.40|4931|1
MDU|Mendi|Papua-Nova Guine|PG|-6.15|143.66|0.04|0.34|0.90|4411|1
MEI|Meridian|EUA|US|32.33|-88.75|0.04|1.10|1.10|10003|1
MFA|Kilindoni|Tanzania|TZ|-7.92|39.67|0.04|0.32|1.45|5348|1
MGB|Mount Gambier|Australia|AU|-37.74|140.78|0.04|1.20|1.40|5394|1
MHH|Marsh Harbour|Bahamas|BS|26.51|-77.08|0.04|0.75|2.10|6100|1
MHQ|Mariehamn|Finlandia|FI|60.12|19.90|0.04|1.30|1.10|6243|1
MHU|Mount Hotham|Australia|AU|-37.05|147.33|0.04|1.20|1.40|4762|1
MIM|Merimbula|Australia|AU|-36.91|149.90|0.04|1.20|1.40|5256|1
MJK|Denham|Australia|AU|-25.90|113.58|0.04|1.20|1.40|5545|1
MJZ|Mirny|Russia|RU|62.53|114.04|0.04|0.71|1.05|9187|1
MKP|Makemo|Polinesia Francesa|PF|-16.58|-143.66|0.04|0.85|2.10|4920|1
MKR|Meekatharra|Australia|AU|-26.61|118.55|0.04|1.20|1.40|7156|1
MKU|Makokou|Gabao|GA|0.58|12.89|0.04|0.45|0.70|5892|1
MMD|Minamidaito|Japao|JP|25.85|131.26|0.04|1.23|1.50|4921|1
MMH|Mammoth Lakes|EUA|US|37.63|-118.84|0.04|1.10|1.10|7000|1
MNG|Maningrida|Australia|AU|-12.06|134.23|0.04|1.20|1.40|5020|1
MOH|Morowali|Indonesia|ID|-2.20|121.66|0.04|0.50|0.90|6070|1
MOV|Moranbah|Australia|AU|-22.06|148.08|0.04|1.20|1.40|5000|1
MPA|Mpacha|Namibia|NA|-17.63|24.18|0.04|0.45|1.30|7520|1
MPN|Mount Pleasant|Ilhas Malvinas|FK|-51.82|-58.45|0.04|0.90|1.40|8497|1
MQL|Mildura|Australia|AU|-34.23|142.09|0.04|1.20|1.40|6004|1
MQT|Gwinn|EUA|US|46.35|-87.40|0.04|1.10|1.10|9072|1
MRZ|Moree|Australia|AU|-29.50|149.85|0.04|1.20|1.40|5292|1
MSS|Massena|EUA|US|44.94|-74.84|0.04|1.10|1.10|5601|1
MTJ|Montrose|EUA|US|38.51|-107.89|0.04|1.10|1.10|10000|1
MUA|Munda|Ilhas Salomao|SB|-8.33|157.26|0.04|0.30|1.20|4593|1
MUE|Waimea|EUA|US|20.00|-155.67|0.04|1.10|1.10|5197|1
MVP|Mitu|Colombia|CO|1.25|-70.23|0.04|0.55|1.10|5889|1
MXV|Moron|Mongolia|MN|49.66|100.10|0.04|0.42|1.10|7874|1
MXX|Mora|Suecia|SE|60.96|14.51|0.04|1.23|1.00|5951|1
MYA|Moruya|Australia|AU|-35.90|150.14|0.04|1.20|1.40|4997|1
MYG|Abraham Bay Settlement|Bahamas|BS|22.38|-73.01|0.04|0.75|2.10|7297|1
MYL|McCall|EUA|US|44.89|-116.10|0.04|1.10|1.10|6101|1
MZQ|Mkuze|Africa do Sul|ZA|-27.63|32.04|0.04|0.65|1.20|6070|1
NAA|Narrabri|Australia|AU|-30.32|149.83|0.04|1.20|1.40|5000|1
NAM|Namniwel|Indonesia|ID|-3.14|126.98|0.04|0.50|0.90|5249|1
NBN|San Antonio de Pale|Guine Equatorial|GQ|-1.41|5.62|0.04|0.40|0.50|6177|1
NGK|Nogliki|Russia|RU|51.78|143.14|0.04|0.71|1.05|5741|1
NGQ|Shiquanhe|China|CN|32.10|80.05|0.04|0.80|1.00|14764|1
NHV|Nuku Hiva|Polinesia Francesa|PF|-8.80|-140.23|0.04|0.85|2.10|5578|1
NLI|Nikolayevsk-na-Amure|Russia|RU|53.15|140.65|0.04|0.71|1.05|6233|1
NLK|Burnt Pine|Ilha Norfolk|NF|-29.04|167.94|0.04|0.85|1.40|6398|1
NMF|Noonu Atoll|Maldivas|MV|5.82|73.47|0.04|0.75|2.20|9350|1
NNM|Naryan Mar|Russia|RU|67.64|53.12|0.04|0.71|1.05|8202|1
NNT|Nan|Tailandia|TH|18.81|100.78|0.04|0.60|2.00|6562|1
NRA|Narrandera|Australia|AU|-34.70|146.51|0.04|1.20|1.40|5302|1
NTN|Normanton|Australia|AU|-17.68|141.07|0.04|1.20|1.40|5499|1
NTX|Ranai-Natuna Besar Island|Indonesia|ID|3.91|108.39|0.04|0.50|0.90|8410|1
NZG|Nizhneangarsk|Russia|RU|55.80|109.60|0.04|0.71|1.05|5249|1
OER|Ornskoldsvik|Suecia|SE|63.41|18.99|0.04|1.23|1.00|6607|1
OES|San Antonio Oeste|Argentina|AR|-40.75|-65.03|0.04|0.60|1.50|5905|1
OGN|Yonaguni|Japao|JP|24.47|122.98|0.04|1.23|1.50|4920|1
OGS|Ogdensburg|EUA|US|44.68|-75.47|0.04|1.10|1.10|6400|1
OHO|Okhotsk|Russia|RU|59.41|143.06|0.04|0.71|1.05|6562|1
OIR|Okushiri Island|Japao|JP|42.07|139.43|0.04|1.23|1.50|4922|1
OJU|Tojo Una-Una|Indonesia|ID|-0.87|121.63|0.04|0.50|0.90|6070|1
OKE|Wadomari|Japao|JP|27.43|128.71|0.04|1.23|1.50|4430|1
OKI|Okinoshima|Japao|JP|36.18|133.32|0.04|1.23|1.50|6531|1
OLF|Wolf Point|EUA|US|48.09|-105.57|0.04|1.10|1.10|5091|1
OLP|Olympic Dam|Australia|AU|-30.48|136.88|0.04|1.20|1.40|6102|1
OMD|Oranjemund|Namibia|NA|-28.59|16.45|0.04|0.45|1.30|5252|1
OME|Nome|EUA|US|64.51|-165.45|0.04|1.10|1.10|6176|1
OOM|Cooma|Australia|AU|-36.30|148.97|0.04|1.20|1.40|6955|1
OTH|North Bend|EUA|US|43.42|-124.25|0.04|1.10|1.10|5980|1
OTZ|Kotzebue|EUA|US|66.88|-162.60|0.04|1.10|1.10|6300|1
PAH|Paducah|EUA|US|37.06|-88.77|0.04|1.10|1.10|6499|1
PAS|Paros|Grecia|GR|37.02|25.11|0.04|0.77|2.10|4593|1
PBO|Paraburdoo|Australia|AU|-23.17|117.75|0.04|1.20|1.40|6995|1
PBU|Putao|Mianmar|MM|27.33|97.43|0.04|0.30|0.70|7002|1
PCR|Puerto Carreno|Colombia|CO|6.18|-67.49|0.04|0.55|1.10|5907|1
PDA|Puerto Inirida|Colombia|CO|3.85|-67.91|0.04|0.55|1.10|5910|1
PGA|Page|EUA|US|36.92|-111.45|0.04|1.10|1.10|5950|1
PIR|Pierre|EUA|US|44.38|-100.29|0.04|1.10|1.10|6900|1
PIX|Pico Island|Portugal|PT|38.55|-28.44|0.04|0.84|1.90|5725|1
PJA|Pajala|Suecia|SE|67.24|23.07|0.04|1.23|1.00|7552|1
PKE|Parkes|Australia|AU|-33.13|148.24|0.04|1.20|1.40|5525|1
PLN|Pellston|EUA|US|45.57|-84.80|0.04|1.10|1.10|6513|1
PLO|Port Lincoln|Australia|AU|-34.61|135.88|0.04|1.20|1.40|4918|1
PMQ|Perito Moreno|Argentina|AR|-46.54|-70.98|0.04|0.60|1.50|5577|1
PNI|Pohnpei Island|Micronesia|FM|6.99|158.21|0.04|0.50|1.20|6600|1
PNL|Pantelleria|Italia|IT|36.82|11.97|0.04|1.00|1.40|5495|1
PNP|Popondetta|Papua-Nova Guine|PG|-8.80|148.31|0.04|0.34|0.90|5485|1
PNT|Puerto Natales|Chile|CL|-51.67|-72.53|0.04|0.70|1.30|5786|1
PPP|Proserpine|Australia|AU|-20.49|148.55|0.04|1.20|1.40|6801|1
PQI|Presque Isle|EUA|US|46.69|-68.04|0.04|1.10|1.10|7441|1
PSG|Petersburg|EUA|US|56.80|-132.95|0.04|1.10|1.10|6400|1
PSZ|Puerto Suarez|Bolivia|BO|-18.98|-57.82|0.04|0.46|1.05|6562|1
PTJ|Portland|Australia|AU|-38.32|141.47|0.04|1.20|1.40|5302|1
PUD|Puerto Deseado|Argentina|AR|-47.74|-65.90|0.04|0.60|1.50|4921|1
PUG|Whyalla|Australia|AU|-32.51|137.72|0.04|1.20|1.40|5413|1
PUZ|Puerto Cabezas|Nicaragua|NI|14.05|-83.39|0.04|0.35|0.80|8130|1
PWE|Apapelgino|Russia|RU|69.78|170.60|0.04|0.71|1.05|8202|1
PXM|Puerto Escondido|Mexico|MX|15.88|-97.09|0.04|0.69|1.30|7546|1
PXO|Funchal|Portugal|PT|33.07|-16.35|0.04|0.78|1.90|9861|1
PYJ|Yakutia|Russia|RU|66.40|112.03|0.04|0.71|1.05|10170|1
RAB|Kokopo|Papua-Nova Guine|PG|-4.34|152.38|0.04|0.34|0.90|5643|1
RAH|Rafha|Arabia Saudita|SA|29.63|43.49|0.04|0.97|1.10|9834|1
RBQ|Rurrenabaque|Bolivia|BO|-14.43|-67.50|0.04|0.46|1.05|4921|1
RCM|Richmond|Australia|AU|-20.70|143.12|0.04|1.20|1.40|5000|1
RFP|Uturoa|Polinesia Francesa|PF|-16.72|-151.47|0.04|0.85|2.10|4593|1
RGI|Rangiroa|Polinesia Francesa|PF|-14.95|-147.66|0.04|0.85|2.10|6890|1
RHI|Rhinelander|EUA|US|45.63|-89.47|0.04|1.10|1.10|6800|1
RIW|Riverton|EUA|US|43.06|-108.46|0.04|1.10|1.10|8204|1
RKD|Rockland|EUA|US|44.06|-69.10|0.04|1.10|1.10|5412|1
RKI|Sipura Island|Indonesia|ID|-2.10|99.70|0.04|0.50|0.90|4921|1
RKS|Rock Springs|EUA|US|41.59|-109.07|0.04|1.10|1.10|10002|1
RMA|Roma|Australia|AU|-26.55|148.77|0.04|1.20|1.40|4934|1
RNI|Corn Island|Nicaragua|NI|12.17|-83.06|0.04|0.35|0.80|6234|1
RNN|Ronne|Dinamarca|DK|55.06|14.76|0.04|1.40|1.30|6568|1
RRS|Roros|Noruega|NO|62.58|11.34|0.04|1.20|1.20|5643|1
RSD|Rock Sound|Bahamas|BS|24.89|-76.18|0.04|0.75|2.10|7213|1
RTI|Ba'a - Rote Island|Indonesia|ID|-10.77|123.08|0.04|0.50|0.90|5413|1
RUR|Rurutu|Polinesia Francesa|PF|-22.43|-151.36|0.04|0.85|2.10|4757|1
RUT|Rutland|EUA|US|43.53|-72.95|0.04|1.10|1.10|5304|1
RVV|Raivavae|Polinesia Francesa|PF|-23.89|-147.66|0.04|0.85|2.10|4592|1
RYO|Rio Turbio|Argentina|AR|-51.60|-72.22|0.04|0.60|1.50|6340|1
SAQ|Nassau|Bahamas|BS|25.05|-78.05|0.04|0.75|2.10|5025|1
SBT|Sabetta|Russia|RU|71.22|72.05|0.04|0.71|1.05|8858|1
SCC|Deadhorse|EUA|US|70.19|-148.46|0.04|1.10|1.10|6500|1
SCT|Mori|Iemen|YE|12.63|53.91|0.04|0.20|0.50|10827|1
SCY|Puerto Baquerizo Moreno|Equador|EC|-0.91|-89.62|0.04|0.57|1.05|6214|1
SDY|Sidney|EUA|US|47.71|-104.19|0.04|1.10|1.10|5705|1
SEK|Srednekolymsk|Russia|RU|67.48|153.74|0.04|0.71|1.05|5906|1
SFJ|Kangerlussuaq|Groenlandia|GL|67.01|-50.72|0.04|1.00|1.60|9219|1
SFT|Skelleftea|Suecia|SE|64.62|21.08|0.04|1.23|1.00|8268|1
SGO|St George|Australia|AU|-28.05|148.60|0.04|1.20|1.40|4987|1
SHH|Shishmaref|EUA|US|66.25|-166.09|0.04|1.10|1.10|4997|1
SHR|Sheridan|EUA|US|44.77|-106.98|0.04|1.10|1.10|8301|1
SHW|Sharurah|Arabia Saudita|SA|17.47|47.12|0.04|0.97|1.10|11975|1
SIS|Sishen|Africa do Sul|ZA|-27.65|23.00|0.04|0.65|1.20|5709|1
SIT|Sitka|EUA|US|57.05|-135.36|0.04|1.10|1.10|7200|1
SJZ|Velas|Portugal|PT|38.67|-28.18|0.04|0.84|1.90|4633|1
SKU|Skiros Island|Grecia|GR|38.97|24.49|0.04|0.77|2.10|9849|1
SLK|Saranac Lake|EUA|US|44.39|-74.20|0.04|1.10|1.10|6573|1
SMA|Vila do Porto|Portugal|PT|36.97|-25.17|0.04|0.84|1.90|10000|1
SMI|Samos Island|Grecia|GR|37.69|26.91|0.04|0.77|2.10|6706|1
SMN|Salmon|EUA|US|45.12|-113.88|0.04|1.10|1.10|5510|1
SMW|Smara|Saara Ocidental|EH|26.73|-11.68|0.04|0.30|0.60|9843|1
SNB|Milikapiti|Australia|AU|-11.42|130.65|0.04|1.20|1.40|4734|1
SNE|Preguica|Cabo Verde|CV|16.59|-24.28|0.04|0.45|1.90|4593|1
SNP|St Paul Island|EUA|US|57.17|-170.22|0.04|1.10|1.10|6500|1
SNV|Santa Elena de Uairen|Venezuela|VE|4.55|-61.15|0.04|0.45|0.70|5445|1
SON|Luganville|Vanuatu|VU|-15.51|167.22|0.04|0.38|1.60|6523|1
SOW|Show Low|EUA|US|34.26|-110.01|0.04|1.10|1.10|7202|1
SPC|Sta Cruz de la Palma, La|Espanha|ES|28.63|-17.76|0.04|0.85|1.90|7218|1
SSJ|Alstahaug|Noruega|NO|65.96|12.47|0.04|1.20|1.20|4619|1
SUN|Hailey|EUA|US|43.50|-114.30|0.04|1.10|1.10|7550|1
SUY|Suntar|Russia|RU|62.19|117.64|0.04|0.71|1.05|5906|1
SVC|Silver City|EUA|US|32.64|-108.15|0.04|1.10|1.10|6803|1
SVI|San Vicente Del Caguan|Colombia|CO|2.15|-74.77|0.04|0.55|1.10|4921|1
SWL|San Vicente|Filipinas|PH|10.52|119.27|0.04|0.47|1.05|5915|1
SWX|Shakawe|Botsuana|BW|-18.37|21.83|0.04|0.52|1.30|6102|1
SXK|Saumlaki-Yamdena Island|Indonesia|ID|-7.85|131.34|0.04|0.50|0.90|6562|1
SYY|Stornoway, Western Isles|Reino Unido|GB|58.22|-6.33|0.04|1.05|1.10|7218|1
SZI|Zaysan|Cazaquistao|KZ|47.49|84.89|0.04|0.67|0.75|4938|1
TBI|Cat Island|Bahamas|BS|24.32|-75.45|0.04|0.75|2.10|5050|1
TBN|Fort Leonard Wood|EUA|US|37.74|-92.14|0.04|1.10|1.10|6037|1
TCA|Tennant Creek|Australia|AU|-19.63|134.18|0.04|1.20|1.40|6427|1
TCB|Treasure Cay|Bahamas|BS|26.75|-77.39|0.04|0.75|2.10|7001|1
TCP|Taba|Egito|EG|29.59|34.78|0.04|0.45|2.00|13123|1
TER|Praia da Vitoria|Portugal|PT|38.76|-27.09|0.04|0.84|1.90|10870|1
TEX|Telluride|EUA|US|37.95|-107.91|0.04|1.10|1.10|7111|1
THG|Biloela|Australia|AU|-24.49|150.58|0.04|1.20|1.40|4993|1
THX|Turukhansk|Russia|RU|65.80|87.94|0.04|0.71|1.05|5905|1
TKN|Amagi|Japao|JP|27.84|128.88|0.04|1.23|1.50|6561|1
TMC|Radamata|Indonesia|ID|-9.41|119.24|0.04|0.50|0.90|5905|1
TMW|Tamworth|Australia|AU|-31.08|150.85|0.04|1.20|1.40|7218|1
TMX|Timimoun|Argelia|DZ|29.24|0.28|0.04|0.60|0.70|9843|1
TNE|Tanegashima|Japao|JP|30.61|130.99|0.04|1.23|1.50|6544|1
TPP|Tarapoto|Peru|PE|-6.51|-76.37|0.04|0.52|1.50|8530|1
TRE|Balemartine, Argyll and|Reino Unido|GB|56.50|-6.87|0.04|1.05|1.10|4600|1
TSM|Taos|EUA|US|36.45|-105.68|0.04|1.10|1.10|5504|1
TUB|Tubuai|Polinesia Francesa|PF|-23.37|-149.52|0.04|0.85|2.10|4921|1
TVC|Traverse City|EUA|US|44.74|-85.58|0.04|1.10|1.10|7016|1
TWT|Bongao|Filipinas|PH|5.05|119.74|0.04|0.47|1.05|6102|1
TYF|Torsby|Suecia|SE|60.16|12.99|0.04|1.23|1.00|5219|1
TZN|Andros|Bahamas|BS|24.16|-77.59|0.04|0.75|2.10|5300|1
UAR|Bouarfa|Marrocos|MA|32.51|-1.98|0.04|0.54|1.65|10499|1
UEO|Kumejima|Japao|JP|26.36|126.71|0.04|1.23|1.50|6562|1
ULO|Ulaangom|Mongolia|MN|50.07|91.94|0.04|0.42|1.10|8815|1
ULP|Quilpie|Australia|AU|-26.61|144.25|0.04|1.20|1.40|4898|1
UNK|Unalakleet|EUA|US|63.89|-160.80|0.04|1.10|1.10|5900|1
URE|Kuressaare|Estonia|EE|58.23|22.51|0.04|0.90|1.20|6561|1
URJ|Uray|Russia|RU|60.10|64.83|0.04|0.71|1.05|7218|1
USJ|Usharal|Cazaquistao|KZ|46.19|80.83|0.04|0.67|0.75|7546|1
USK|Usinsk|Russia|RU|66.00|57.37|0.04|0.71|1.05|8202|1
USR|Ust-Nera|Russia|RU|64.55|143.12|0.04|0.71|1.05|5020|1
VAM|Maamigili|Maldivas|MV|3.47|72.83|0.04|0.75|2.20|5905|1
VAQ|Vanavara|Russia|RU|60.36|102.31|0.04|0.71|1.05|4592|1
VCS|Con Dao|Vietna|VN|8.73|106.63|0.04|0.58|1.40|6004|1
VDZ|Valdez|EUA|US|61.13|-146.25|0.04|1.10|1.10|6500|1
VEL|Vernal|EUA|US|40.44|-109.51|0.04|1.10|1.10|7000|1
VEO|Severo-Yeniseysk|Russia|RU|60.37|93.01|0.04|0.71|1.05|4920|1
VHM|Vilhelmina|Suecia|SE|64.58|16.83|0.04|1.23|1.00|4928|1
VHV|Verkhnevilyuisk|Russia|RU|63.46|120.27|0.04|0.71|1.05|4593|1
VNX|Vilanculo|Mocambique|MZ|-22.02|35.31|0.04|0.30|0.80|4823|1
VVZ|Illizi|Argelia|DZ|26.72|8.62|0.04|0.60|0.70|9843|1
VYI|Vilyuisk|Russia|RU|63.76|121.69|0.04|0.71|1.05|5249|1
WAE|Wadi Al Dawasir|Arabia Saudita|SA|20.50|45.20|0.04|0.97|1.10|10007|1
WEI|Weipa|Australia|AU|-12.68|141.92|0.04|1.20|1.40|5397|1
WGA|Forest Hill|Australia|AU|-35.16|147.47|0.04|1.20|1.40|5807|1
WGE|Walgett|Australia|AU|-30.03|148.13|0.04|1.20|1.40|5335|1
WGP|Waingapu-Sumba Island|Indonesia|ID|-9.67|120.30|0.04|0.50|0.90|5415|1
WIC|Wick|Reino Unido|GB|58.46|-3.09|0.04|1.05|1.10|6007|1
WIN|Winton|Australia|AU|-22.36|143.09|0.04|1.20|1.40|4600|1
WNI|Wangi-wangi Island|Indonesia|ID|-5.29|123.64|0.04|0.50|0.90|6959|1
WNR|Windorah|Australia|AU|-25.41|142.67|0.04|1.20|1.40|4508|1
WRG|Wrangell|EUA|US|56.48|-132.37|0.04|1.10|1.10|6000|1
WUN|Wiluna|Australia|AU|-26.63|120.22|0.04|1.20|1.40|5942|1
WWK|Wewak|Papua-Nova Guine|PG|-3.58|143.67|0.04|0.34|0.90|5234|1
WYA|Whyalla|Australia|AU|-33.06|137.51|0.04|1.20|1.40|5531|1
WYS|West Yellowstone|EUA|US|44.69|-111.12|0.04|1.10|1.10|8400|1
XCH|Flying Fish Cove|Ilha Christmas|CX|-10.45|105.69|0.04|0.80|1.20|6900|1
XKH|Xieng Khouang|Laos|LA|19.45|103.16|0.04|0.32|1.10|8555|1
XMS|Macas|Equador|EC|-2.30|-78.12|0.04|0.57|1.05|8202|1
XSC|South Caicos|Ilhas Turcas e Caicos|TC|21.52|-71.53|0.04|0.90|2.10|6335|1
XTG|Thargomindah|Australia|AU|-27.99|143.81|0.04|1.20|1.40|4800|1
XWA|Williston|EUA|US|48.26|-103.75|0.04|1.10|1.10|7503|1
YAG|Fort Frances|Canada|CA|48.66|-93.44|0.04|1.10|0.95|4500|1
YAK|Yakutat|EUA|US|59.51|-139.66|0.04|1.10|1.10|7732|1
YAZ|Tofino|Canada|CA|49.08|-125.78|0.04|1.10|0.95|5000|1
YBC|Baie-Comeau|Canada|CA|49.13|-68.20|0.04|1.10|0.95|6000|1
YBX|Blanc-Sablon|Canada|CA|51.44|-57.19|0.04|1.10|0.95|4500|1
YBY|Bonnyville|Canada|CA|54.30|-110.74|0.04|1.10|0.95|4434|1
YCG|Castlegar|Canada|CA|49.30|-117.63|0.04|1.10|0.95|5300|1
YDA|Dawson City|Canada|CA|64.04|-139.13|0.04|1.10|0.95|5000|1
YDF|Deer Lake|Canada|CA|49.21|-57.40|0.04|1.10|0.95|8005|1
YDL|Dease Lake|Canada|CA|58.42|-130.03|0.04|1.10|0.95|6000|1
YDN|Dauphin|Canada|CA|51.10|-100.05|0.04|1.10|0.95|5000|1
YEV|Inuvik|Canada|CA|68.30|-133.48|0.04|1.10|0.95|6000|1
YFB|Iqaluit|Canada|CA|63.76|-68.56|0.04|1.10|0.95|8605|1
YFO|Flin Flon|Canada|CA|54.68|-101.68|0.04|1.10|0.95|5004|1
YFS|Fort Simpson|Canada|CA|61.76|-121.24|0.04|1.10|0.95|6000|1
YGL|La Grande Riviere|Canada|CA|53.63|-77.70|0.04|1.10|0.95|6500|1
YGP|Gaspe|Canada|CA|48.77|-64.48|0.04|1.10|0.95|5488|1
YGR|Les Iles-de-la-Madeleine|Canada|CA|47.43|-61.78|0.04|1.10|0.95|4500|1
YGV|Havre-Saint-Pierre|Canada|CA|50.28|-63.61|0.04|1.10|0.95|4500|1
YHR|Chevery|Canada|CA|50.47|-59.64|0.04|1.10|0.95|4500|1
YHY|Hay River|Canada|CA|60.84|-115.78|0.04|1.10|0.95|6000|1
YIF|St-Augustin|Canada|CA|51.21|-58.66|0.04|1.10|0.95|4590|1
YKL|Schefferville|Canada|CA|54.81|-66.81|0.04|1.10|0.95|5000|1
YLL|Lloydminster|Canada|CA|53.31|-110.07|0.04|1.10|0.95|5577|1
YMS|Yurimaguas|Peru|PE|-5.89|-76.12|0.04|0.52|1.50|5912|1
YMT|Chibougamau|Canada|CA|49.77|-74.53|0.04|1.10|0.95|6496|1
YNA|Natashquan|Canada|CA|50.19|-61.79|0.04|1.10|0.95|4494|1
YOJ|High Level|Canada|CA|58.62|-117.17|0.04|1.10|0.95|5000|1
YPA|Prince Albert|Canada|CA|53.21|-105.67|0.04|1.10|0.95|5000|1
YPE|Peace River|Canada|CA|56.23|-117.45|0.04|1.10|0.95|5000|1
YPL|Pickle Lake|Canada|CA|51.45|-90.21|0.04|1.10|0.95|4921|1
YPN|Port-Menier|Canada|CA|49.84|-64.29|0.04|1.10|0.95|4886|1
YPR|Prince Rupert|Canada|CA|54.29|-130.45|0.04|1.10|0.95|6000|1
YPY|Fort Chipewyan|Canada|CA|58.77|-111.12|0.04|1.10|0.95|5000|1
YPZ|Burns Lake|Canada|CA|54.38|-125.95|0.04|1.10|0.95|5000|1
YQD|The Pas|Canada|CA|53.97|-101.09|0.04|1.10|0.95|5901|1
YQH|Watson Lake|Canada|CA|60.12|-128.82|0.04|1.10|0.95|5504|1
YQK|Kenora|Canada|CA|49.79|-94.36|0.04|1.10|0.95|5800|1
YQX|Gander|Canada|CA|48.94|-54.57|0.04|1.10|0.95|10200|1
YQZ|Quesnel|Canada|CA|53.03|-122.51|0.04|1.10|0.95|5500|1
YRJ|Roberval|Canada|CA|48.52|-72.27|0.04|1.10|0.95|5000|1
YRL|Red Lake|Canada|CA|51.07|-93.79|0.04|1.10|0.95|5001|1
YRT|Rankin Inlet|Canada|CA|62.81|-92.12|0.04|1.10|0.95|6000|1
YSM|Fort Smith|Canada|CA|60.02|-111.96|0.04|1.10|0.95|6000|1
YTH|Thompson|Canada|CA|55.80|-97.86|0.04|1.10|0.95|5800|1
YTS|Timmins|Canada|CA|48.57|-81.38|0.04|1.10|0.95|6000|1
YUY|Rouyn-Noranda|Canada|CA|48.21|-78.84|0.04|1.10|0.95|7485|1
YVB|Bonaventure|Canada|CA|48.07|-65.46|0.04|1.10|0.95|5985|1
YVC|La Ronge|Canada|CA|55.15|-105.26|0.04|1.10|0.95|5000|1
YVO|Val-d'Or|Canada|CA|48.05|-77.78|0.04|1.10|0.95|10000|1
YVP|Kuujjuaq|Canada|CA|58.10|-68.43|0.04|1.10|0.95|6000|1
YVQ|Norman Wells|Canada|CA|65.28|-126.80|0.04|1.10|0.95|5998|1
YVV|Wiarton|Canada|CA|44.75|-81.11|0.04|1.10|0.95|5021|1
YWK|Wabush|Canada|CA|52.92|-66.86|0.04|1.10|0.95|6002|1
YWL|Williams Lake|Canada|CA|52.18|-122.05|0.04|1.10|0.95|7000|1
YXC|Cranbrook|Canada|CA|49.61|-115.78|0.04|1.10|0.95|6000|1
YXJ|Fort Saint John|Canada|CA|56.24|-120.74|0.04|1.10|0.95|6909|1
YXL|Sioux Lookout|Canada|CA|50.11|-91.91|0.04|1.10|0.95|5300|1
YXT|Terrace|Canada|CA|54.47|-128.58|0.04|1.10|0.95|7497|1
YXY|Whitehorse|Canada|CA|60.71|-135.07|0.04|1.10|0.95|9497|1
YYD|Smithers|Canada|CA|54.82|-127.18|0.04|1.10|0.95|5000|1
YYE|Fort Nelson|Canada|CA|58.84|-122.60|0.04|1.10|0.95|6400|1
YYG|Charlottetown|Canada|CA|46.29|-63.13|0.04|1.10|0.95|7002|1
YYL|Lynn Lake|Canada|CA|56.86|-101.08|0.04|1.10|0.95|5000|1
YYQ|Churchill|Canada|CA|58.74|-94.07|0.04|1.10|0.95|9200|1
YYR|Goose Bay|Canada|CA|53.32|-60.43|0.04|1.10|0.95|11046|1
YZF|Yellowknife|Canada|CA|62.46|-114.44|0.04|1.10|0.95|7500|1
YZP|Sandspit|Canada|CA|53.25|-131.81|0.04|1.10|0.95|5120|1
YZT|Port Hardy|Canada|CA|50.68|-127.37|0.04|1.10|0.95|5000|1
YZU|Whitecourt|Canada|CA|54.14|-115.79|0.04|1.10|0.95|5800|1
YZV|Sept-Iles|Canada|CA|50.22|-66.27|0.04|1.10|0.95|6552|1
ZBF|South Tetagouche|Canada|CA|47.63|-65.74|0.04|1.10|0.95|5613|1
ZDY|Delma Island|Emirados|AE|24.51|52.34|0.04|1.35|1.40|8202|1
ZMT|Masset|Canada|CA|54.03|-132.12|0.04|1.10|0.95|5000|1
ZNE|Newman|Australia|AU|-23.42|119.80|0.04|1.20|1.40|6798|1
ZTH|Zakynthos|Grecia|GR|37.75|20.88|0.04|0.77|2.10|7310|1
ZUM|Churchill Falls|Canada|CA|53.56|-64.11|0.04|1.10|0.95|5500|1
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
