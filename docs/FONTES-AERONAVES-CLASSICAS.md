# Aeronaves adicionadas a partir das bases restantes do ZIP

As 13 entradas abaixo tornam utilizáveis as bases que estavam apenas no acervo. Os sprites, camadas de pintura e poltronas vêm exclusivamente de `Sistema Aeronaves 2D.zip`. As fichas de desempenho foram cadastradas para o Skyline; o ZIP não fornece uma tabela de desempenho operacional pronta para este jogo.

## Catálogo

Máximo é o limite de passageiros adotado para a configuração de saídas, não a quantidade entregue na compra. Alcance representa uma carga típica: não é alcance com o máximo de assentos ocupado. Pista é uma referência fixa arredondada, baseada em condições publicadas de decolagem; o jogo não recalcula peso, vento, temperatura ou altitude. As dimensões estão em metros; alcance em milhas náuticas e pista em pés.

| ID | Modelo | Máximo / fileira econômica | Alcance | Pista | Comprimento × envergadura | Motor cadastrado |
|---|---|---|---|---|---|---|
| q200 | Dash 8 Q200 (DHC-8-202) | 39 / 2-2 | 1.125 | 3.280 | 22,25 × 25,89 | PW123D |
| q300 | Dash 8 Q300 (DHC-8-314) | 56 / 2-2 | 924 | 3.870 | 25,68 × 27,43 | PW123B |
| crj200 | CRJ200 | 50 / 2-2 | 1.400 | 5.800 | 26,77 × 21,21 | CF34-3B1 |
| erj135 | ERJ135LR | 37 / 1-2 | 1.750 | 5.774 | 26,33 × 20,04 | AE 3007A1/3 |
| erj140 | ERJ140LR | 44 / 1-2 | 1.650 | 6.070 | 28,45 × 20,04 | AE 3007A1/3 |
| erj145 | ERJ145LR | 50 / 1-2 | 1.550 | 7.448 | 29,87 × 20,04 | AE 3007A1 |
| ssj100 | Superjet 100-95B | 103 / 2-3 | 1.646 | 5.680 | 29,94 × 27,80 | SaM146-1S17 |
| a318 | A318-100 | 136 / 3-3 | 3.100 | 5.869 | 31,44 × 34,10 | CFM56-5B8; PW6124A |
| b712 | 717-200, maior peso | 134 / 2-3 | 2.055 | 5.750 | 37,81 × 28,45 | BR715-C1-30 |
| b736 | 737-600 | 149 / 3-3 | 3.050 | 6.160 | 31,24 × 34,31 | CFM56-7B22 |
| a343 | A340-300 | 440 / 2-4-2 | 7.300 | 9.820 | 63,69 × 60,30 | CFM56-5C4 |
| a346 | A340-600 | 440 / 2-4-2 | 7.900 | 10.200 | 75,36 × 63,45 | Trent 556-61 |
| b744 | 747-400 | 660 / 3-4-3 | 7.260 | 10.500 | 70,67 × 64,44 | CF6-80C2B1F; PW4056; RB211-524G2-T |

O jogo mantém a convenção de uma ficha representativa por tipo: não cadastra cada peso certificado, ajuste de empuxo ou pacote de saídas como uma aeronave diferente. As opções de motor acima são as incluídas nesta versão, não todas as certificadas durante a história de cada família.

## Referências técnicas

- **Q200/Q300:** manuais de planejamento [D8200-APM](https://dehavillandportal.com/assets/public-documents/D8200-APM.pdf) e [D8300-APM](https://dehavillandportal.com/assets/public-documents/D8300-APM.pdf), especialmente seções 2 e 3. O Q200 usa o PW123D de 2.150 shp; o Q300 adota o PW123B de 2.500 shp. O [relatório da CAA da Nova Zelândia](https://www.aviation.govt.nz/assets/aircraft/type-acceptance-reports/Bombardier-DHC-8-Series.pdf) discrimina os limites de passageiros e as variantes. Q200 conserva o limite original de 39; não incorpora a modificação específica para 40. Os alcances e velocidades Q-Series estão na [ficha disponibilizada pelo Air Portal](https://www.airportal.go.kr/file/htmlOpen/upload/aircraft/Bombardier%20Dash%20Q-Series.pdf).
- **CRJ200:** [MHIRJ, CRJ Series](https://mhirj.com/en/products-and-services/crj-series), 50 passageiros e alcance de 1.400 nm. A referência de pista é 5.800 ft, também publicada pela operadora [Saurya](https://www.sauryaairlines.com/ourfleet.jsp). A [ficha GE CF34-3](https://www.geaerospace.com/sites/default/files/datasheet-CF34-3.pdf) informa 8.729 lbf sem APR e fan de 44 polegadas.
- **ERJ135/140/145LR:** fichas Embraer [ERJ135](https://www.embraercommercialaviation.com/wp-content/uploads/2017/02/Embraer_spec_135_web.pdf), [ERJ140](https://www.embraercommercialaviation.com/wp-content/uploads/2017/02/Embraer_spec_140_web.pdf) e [ERJ145](https://www.embraercommercialaviation.com/wp-content/uploads/2017/06/Embraer_spec_ERJ145_web-EN.pdf). Usam os valores **LR**, incluindo pista ao MTOW, ao nível do mar e ISA. Cruzeiro Mach 0,78 é convertido aproximadamente para 447 kt. A família [Rolls-Royce AE 3007](https://www.rolls-royce.com/products-and-services/civil-aerospace/business-aviation/ae-3007.aspx) equipa os três tipos. ERJ145LR não recebe winglets nem strakes do XR.
- **Superjet original:** [UAC, Superjet 100](https://uacrussia.ru/en/aircraft/lineup/lineup/superjet-100/). O modelo básico usa alcance de 3.048 km, decolagem de 1.731 m e SaM146. O `sj100` existente, com PD-8, mantém ID, ficha, arte e cabine anteriores; o novo ID é `ssj100`.
- **Airbus:** [Aircraft Characteristics](https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/aircraft-characteristics), manuais A318 e A340-200/300 e A340-500/600. A referência de alcance do A340-300 também aparece no [prospecto Airbus](https://www.airbus.com/sites/g/files/jlcbta136/files/2021-07/ipo-de.pdf); a de 7.900 nm do A340-600, na [ficha de família mantida pelo EUROCONTROL](https://skybrary.aero/index.php/aircraft-family/a340-family). As pistas são referências aproximadas das curvas de planejamento, não mínimos universais.
- **Limites Airbus:** [EASA.A.064](https://www.easa.europa.eu/en/downloads/16507/en) para A318 (136); [EASA.A.015, edição 28](https://www.easa.europa.eu/en/downloads/19823/en), página 36 para A340-300 (440 com MOD 40161, saídas A-A-A-A) e página 51 para A340-600 (**440**, limite de evacuação nessa ficha). Não se adotou o valor comercial de 475 como limite certificado do A340-600.
- **Boeing:** [Airplane Characteristics for Airport Planning](https://www.boeing.com/commercial/airports/plan-manuals): D6-58330 (717), D6-58325-6 (737 NG) e D6-58326-1 (747-400). As tabelas históricas de [717](https://www.boeing.com/content/dam/boeing/boeingdotcom/company/about_bca/startup/pdf/historical/717_passenger.pdf) e [737](https://www.boeing.com/content/dam/boeing/boeingdotcom/company/about_bca/startup/pdf/historical/737-classic-passenger.pdf) contêm as referências de desempenho; alguns links históricos variam conforme a reorganização do site. [Boeing Products](https://www.boeing.com/content/dam/boeing/boeingdotcom/history/pdf/Boeing_Products.pdf) distingue 7.260 nm do 747-400 e 7.670 nm do -400ER: esta entrada é **-400**, não -400ER ou -400D.
- **Limites Boeing:** [FAA, Federal Register de 17/06/2013, página 36085](https://www.govinfo.gov/content/pkg/FR-2013-06-17/pdf/FR-2013-06-17.pdf) registra 134 passageiros e motores BR715 no 717. O [apêndice EASA.IM.A.120, condição D-14](https://www.easa.europa.eu/sites/default/files/dfu/IM.A.120%20Boeing737%20TCDS%20APPENDIX%20ISS%2011.pdf) admite 149 no 737-600 com a configuração de saídas indicada; os layouts comerciais usuais têm menos lugares. [EASA.IM.A.196](https://www.easa.europa.eu/en/downloads/7250/en), seção 3, página 18, registra 660 no 747-400 (550 no convés principal e 110 no superior). O mapa de cabine do Skyline continua usando comprimento equivalente, sem simular cada convés separadamente.

## O que é balanceamento

Consumo médio, preço, manutenção, conforto, ruído, tempo de solo, custo de poltronas e diferenças econômicas entre motores são **parâmetros do jogo**. Não foram extraídos do ZIP nem devem ser interpretados como cotações ou dados de despacho. Motores alternativos têm ajuste visual e econômico; seus multiplicadores de alcance e pista permanecem 1 nesta inclusão. O campo `since` controla disponibilidade no catálogo, sem retirar modelos antigos de produção; todas as novas aeronaves estão disponíveis em partidas atuais.

## Verificação de uso

`aircraft2d:check` compra e arrenda cada novo tipo com cada motor cadastrado, abre GRU–GIG, aloca a aeronave, simula sete dias, verifica voos com receita, reforma a cabine e faz um ciclo de exportação/importação de save. Também verifica os seis layouts de cabine por tipo e impede sobreposição de nacelas. `aircraft2d:ui` repete a aquisição dos 13 tipos pelo Mercado e confirma a frota após recarregar a partida. As fichas dos 67 tipos anteriores não foram alteradas.
