# Auditoria dos comprimentos de pista — 02/10/2026

Correção do comprimento físico, sem alterar permissões de aeronaves, elevação,
tetos de assentos, categorias, demanda, slots ou programação. O comprimento é o
da maior pista pavimentada publicada, não a distância utilizável por toda aeronave
em qualquer cabeceira. Exemplo: PNZ tem 3.250 m físicos, mas LDA de 2.760 m na
cabeceira 13 (cabeceira deslocada 490 m).

## Abrangência e fontes

Comparação dos 3.088 registros do catálogo com os arquivos airports.csv e
runways.csv de [OurAirports](https://ourairports.com/data/), consultados em
02/10/2026, associando IATA, país e coordenadas. Revisão adicional de todos os
119 aeroportos brasileiros do catálogo nas dimensões ASPH/CONC do ROTAER/DECEA.
O DECEA prevalece sobre OurAirports para o Brasil. Foram corrigidos 26 registros.
A concordância com uma base pública não garante auditoria independente de todos
os aeroportos do mundo.

Oito correspondências exigiram revisão manual: LYI, IXU, IXG, PZI, JGN, LPY e ULP
usam descrições alternativas de pavimento; BSL é catalogado como suíço no jogo,
mas fica fisicamente na França. Seus comprimentos coincidem e foram mantidos.
DKR foi mantido: IATA aponta para GOOY, mas as coordenadas do jogo são de DSS/GOBD;
não se trocou o aeroporto nem se inferiu uma pista a partir dessa identidade ambígua.
MEA também foi mantido em 1.410 m: o DECEA publica a nova 05/23, ausente da
comparação inicial com OurAirports. PQC considera a nova pista física de 3.300 m
confirmada pela autoridade vietnamita em julho de 2026; isso não presume nem
altera autorizações comerciais. KBP usa a maior pista física, independentemente
de suspensão de operações no mundo real.

## Correções (metros, valores anteriores arredondados)

| IATA | ICAO | Antes | Corrigido | Fonte |
| --- | --- | ---: | ---: | --- |
| AUX | SWGN | 1804 | 1799 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SWGN&i=aerodromos) |
| CGH | SBSP | 1940 | 1883 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBSP&i=aerodromos) |
| CLV | SBCN | 2100 | 2110 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBCN&i=aerodromos) |
| JOI | SBJV | 1640 | 1540 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBJV&i=aerodromos) |
| KBP | UKBB | 3300 | 4000 | [Publicação](https://ourairports.com/airports/UKBB/runways.html) |
| LAJ | SBLJ | 1530 | 1532 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBLJ&i=aerodromos) |
| MGF | SBMG | 2372 | 2380 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBMG&i=aerodromos) |
| MII | SBML | 1500 | 1700 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBML&i=aerodromos) |
| MVF | SBMS | 2000 | 1900 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBMS&i=aerodromos) |
| OPP | SNSM | 1860 | 1600 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SNSM&i=aerodromos) |
| OPS | SBSI | 1630 | 2000 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBSI&i=aerodromos) |
| PET | SBPK | 1980 | 1823 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBPK&i=aerodromos) |
| PHB | SBPB | 2100 | 2500 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBPB&i=aerodromos) |
| PLU | SBBH | 2540 | 2364 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBBH&i=aerodromos) |
| PMG | SBPP | 2000 | 1927 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBPP&i=aerodromos) |
| PNZ | SBPL | 2760 | 3250 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBPL&i=aerodromos) |
| PPB | SBDN | 2110 | 2100 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBDN&i=aerodromos) |
| PQC | VVPQ | 3000 | 3300 | [Publicação](https://caa.gov.vn/hoat-dong-nganh/chuyen-bay-hieu-chuan-dau-tien-tai-duong-cat-ha-canh-so-2-cang-hang-khong-quoc-te-phu-quoc-20260728091729379.htm) |
| REC | SBRF | 3007 | 2937 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBRF&i=aerodromos) |
| SJK | SBSJ | 2676 | 2675 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBSJ&i=aerodromos) |
| SSA | SBSV | 3005 | 3003 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBSV&i=aerodromos) |
| TFF | SBTF | 2200 | 2000 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBTF&i=aerodromos) |
| THE | SBTE | 2200 | 2118 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBTE&i=aerodromos) |
| UDI | SBUL | 1950 | 2100 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBUL&i=aerodromos) |
| UNA | SBTC | 1900 | 2000 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBTC&i=aerodromos) |
| URG | SBUG | 1500 | 1304 | [Publicação](https://aisweb.decea.mil.br/index.cfm?codigo=SBUG&i=aerodromos) |

## Compatibilidade e obras

`RAW` mantém a referência de simulação anterior. `RUNWAY_CORRECTIONS` substitui
apenas o comprimento físico exposto pelo catálogo. Onde não havia exceção,
`pistaOperacional` passa a guardar explicitamente a mesma régua de antes.
O cálculo de passageiros continua usando o valor original.

`AirportDevelopment.runway` mantém a referência persistida anterior das obras.
`effectiveAirport` soma somente o incremento efetivamente construído ao novo
comprimento físico. Assim um save sem obra não ganha uma ampliação fictícia,
e um save com obra não perde seus direitos de operação. Não é necessário regravar
ou migrar o save original. Preços, duração, limites e efeitos operacionais das obras
continuam iguais; o limite físico exibido considera a correção do cadastro.

`npm run runways:check` compara todos os aeroportos e todas as combinações de
modelo/motor, incluindo cargueiros, contra o catálogo anterior ao PR. Também
verifica obras anteriores, novas obras, importação/exportação e invariância da
demanda base. A fixture registra a versão anterior e não é regenerada no teste.

## Validação

Passaram: TypeScript, build Vite, runways:check (382.912 combinações base),
hubs:check e save:file:check. O teste escopo passou nas verificações de pista,
mas continua falhando em 12 verificações já presentes no código base a7afed4:
dez de equilíbrio de demanda e duas que esperam recusar An-225 em FEN/SDU.
A execução com o catálogo e o script anteriores reproduziu as mesmas 12 falhas.
Corrigi-las alteraria demanda ou permissões, fora do pedido deste PR.
