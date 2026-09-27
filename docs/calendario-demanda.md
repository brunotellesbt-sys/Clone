# Calendário de demanda turística

Pesquisa consultada em 27/09/2026. A primeira versão reúne 33 períodos no Brasil e no exterior, cobrindo América do Sul, América do Norte, Europa, África, Ásia e Oceania. É um catálogo selecionado, não uma lista de todas as festas e escolas do mundo.

## Demanda fluida e planejamento semanal

O mercado local continua calculado pelo movimento dos aeroportos, afinidade, distância, perfil turístico, renda, crescimento e ciclos econômicos de cada país. A sazonalidade anual permanece. A mudança é a referência temporal: esses fatores são consultados na segunda-feira da semana e permanecem iguais até domingo. O antigo multiplicador diferente para cada dia da semana foi removido dos passageiros.

Os eventos são uma camada adicional sobre essa base. O primeiro dia de cada período recua até a segunda-feira; o último avança até o domingo. Parintins, Círio e Sinulog incluem uma janela de retorno declarada no catálogo. Assim não é necessário desenhar uma malha diferente para a sexta-feira ou para o domingo. A ocupação efetiva ainda depende da oferta, preços relativos, concorrência, horários, reputação e conexões — demanda estável não é venda garantida.

Carnaval e Mardi Gras são calculados pela Páscoa gregoriana de cada ano; Círio e Sinulog pela posição do domingo no mês; os demais usam datas recorrentes ou projeções indicadas. Anos bissextos e temporadas que atravessam dezembro/janeiro usam a data real da partida. Janeiro encontra também o evento iniciado no ano anterior.

## Férias, eventos e aeroportos beneficiados

O verão brasileiro do jogo vai de **16 de dezembro a 15 de fevereiro**, expandido para semanas inteiras, conforme a regra solicitada. Julho tem temporadas próprias nos destinos pesquisados. Isso é uma janela da simulação, não uma afirmação de que todas as redes escolares param nos mesmos dias. As temporadas internacionais seguem as épocas dos respectivos destinos; não recebem automaticamente o calendário de férias brasileiro.

Cada aeroporto recebe um acréscimo definido para o jogo. Ele é maior em mercados concentrados no evento, menor em grandes aeroportos diversificados ou acessos terrestres alternativos. As fontes sustentam **datas, localidades e evidência de turismo**, não medem os percentuais escolhidos para o jogo.

- Econômica: recebe todo o acréscimo anunciado.
- Premium: 85% desse acréscimo; executiva: 35%; primeira: 20%.
- Uma classe com demanda zero continua em zero. O calendário não cria primeira classe em rotas inelegíveis.
- A mesma festa presente nas duas pontas conta uma vez, pelo maior bônus aplicável.
- Sobreposições usam o maior bônus de férias mais o maior bônus de evento, limitados a +120% na econômica. Festas simultâneas não se multiplicam entre si.
- As rotas continuam tendo um único mercado bidirecional: ida e volta somadas. Carga não recebe esses bônus de turistas.

Por exemplo, Navegantes recebe +35% na econômica nas férias de verão, +22% em julho e +40% no período projetado da Oktoberfest. São cenários da simulação, não previsões estatísticas de embarques reais.

### Parintins e Belém

O festival aumenta o mercado das viagens que têm PIN como uma das pontas. O catálogo identifica MAO, BEL e STM como acessos por conexão, com base nas operações documentadas. Uma viagem GRU–BEL–PIN pode aproveitar o aumento de procura GRU–PIN quando os dois voos, horários, capacidade e condições de venda permitem a conexão. O mesmo passageiro ocupa os dois trechos. Não há bônus de Parintins em toda a demanda local GRU–BEL, sem ligação com PIN. Belém também recebe seu próprio aumento no Círio.

A mesma regra beneficia conexões válidas por outros hubs da malha; a lista de acessos no calendário é informativa, não uma exclusão de outros itinerários possíveis. O total de passageiros depende da disputa com voos diretos e das regras existentes de conexão.

## Como usar o calendário

A aba abre no mês/ano atual da partida. É possível avançar até dezembro do ano seguinte, retornar ao mês atual e filtrar por evento, aeroporto, cidade, tipo de período ou aeroportos da própria malha. Cada semana mostra aeroportos, bônus e períodos ativos. Ao expandir um evento aparecem as datas-base, semanas de efeito, grau de confirmação, motivo e fontes.

O horizonte se renova com o passar do tempo. As datas podem aparecer como **Datas confirmadas**, **Recorrência anual**, **Projeção anual** ou **Temporada do jogo**. Uma projeção reaplica uma referência de época para a simulação; não afirma que o organizador já publicou o calendário daquela edição. Novas datas oficiais podem ser registradas em `confirmed` no catálogo, sem mudar o cálculo semanal.

O calendário e a demanda de venda compartilham as mesmas ocorrências. A referência exibida nas rotas, a estimativa ao abrir rota e os mercados usados por conexões/concorrentes recebem o mesmo calendário do save. A lista estrutural de destinos da IA não guarda picos temporários no cache de dois anos; a decisão de oferta e a apuração de receita usam a semana atual.

## Ajuste pequeno de tarifa e piso

A tarifa de referência de todas as passagens sobe **3% sobre o nível anterior**: fator 1,15 → 1,1845. Os multiplicadores de classe e os preços relativos escolhidos pelo jogador continuam iguais. Nenhum coeficiente ou fórmula de custo operacional foi alterado; operar mais voos ou transportar mais passageiros pode naturalmente aumentar o gasto total.

O piso de passageiros aumenta também **3%**:

| Par elegível | Antes, ida + volta/dia | Agora, ida + volta/dia |
| --- | ---: | ---: |
| Jato regional | 280 Y + 20 W = 300 | 288,4 Y + 20,6 W = 309 |
| Apenas turboélice | 114 Y | 117,42 Y |

Os bônus sazonais entram depois do piso, para que aeroportos pequenos também recebam o benefício. Mercados já maiores seguem sua fórmula normal. Custos de combustível, manutenção, tripulação, taxas, atendimento e serviço de bordo mantêm seus parâmetros. O modelo de carga permanece separado.

## Validação

`npm run calendar:check` cobre catálogo, fontes e IATAs, recorrências entre 2026 e 2069, Carnaval móvel, anos bissextos, continuidade anual, igualdade entre os sete dias, composição de bônus e integração das rotas. `npm run calendar:ui` cobre navegação e limites do horizonte, filtros, fontes, indicação nas rotas e larguras de 360, 412 e 1365 pixels.

## Catálogo e fontes

[Tela do calendário no desktop](images/calendario-desktop.png) · [No celular](images/calendario-mobile.png) · [Detalhes de férias e fontes](images/calendario-ferias.png)

As datas abaixo são as datas-base de **2027**; os efeitos no jogo são sempre ampliados até segunda/domingo. Uma temporada iniciada em dezembro ou outubro pode terminar em 2028. O catálogo executável é `src/game/data/travelEvents.ts`.

| Período | Datas-base de 2027 | Referência | Aeroportos e acréscimo em Y | Fontes |
| --- | --- | --- | --- | --- |
| Sinulog | 17/01/2027–17/01/2027 | Recorrência anual | CEB +40% | [Sinulog Foundation · recorrência no terceiro domingo de janeiro](https://www.sinulogfoundationinc.com/) · [Governo de Cebu · desfile oficial de 2026](https://www.cebu.gov.ph/9118/cebu-officials-open-grand-sinulog-parade-2026-at-cebu-city-sports-center/) |
| Carnaval | 04/02/2027–10/02/2027 | Recorrência anual | SSA +45%, REC +45%, GIG +35%, SDU +35%, CNF +20%, PLU +20%, GRU +12%, CGH +12%, VCP +12% | [Ministério do Turismo · cidades beneficiadas pelo Carnaval](https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/carnaval-beneficia-turismo-em-todo-o-brasil) · [Prefeitura do Recife · programação de 2026](https://www2.recife.pe.gov.br/node/299925) |
| Férias de inverno · Alpes austríacos | 01/02/2027–28/02/2027 | Temporada do jogo | INN +25%, SZG +25% | [Eurostat · pico de fevereiro em Tirol e Salzburgo](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/111235.pdf) |
| Festa de Iemanjá | 02/02/2027–02/02/2027 | Recorrência anual | SSA +20% | [Ministério do Turismo · calendário cultural de Salvador](https://www.gov.br/turismo/pt-br/assuntos/noticias/salvador-reune-historia-cultura-gastronomia-e-tradicoes-que-encantam-visitantes-durante-todo-o-ano) |
| Mardi Gras | 02/02/2027–09/02/2027 | Recorrência anual | MSY +40% | [New Orleans & Company · regra anual e pico dos desfiles](https://www.neworleans.com/events/holidays-seasonal/mardi-gras/the-ultimate-mardi-gras-guide/) |
| Songkran | 13/04/2027–15/04/2027 | Recorrência anual | CNX +35%, BKK +20%, DMK +20%, HKT +20% | [Autoridade de Turismo da Tailândia · datas fixas de Songkran](https://www.tatnews.org/2021/03/thailands-songkran-festival-its-origins-history-and-modern-day-observance/) |
| Golden Week | 29/04/2027–05/05/2027 | Recorrência anual | HND +25%, NRT +25%, KIX +25%, ITM +25%, CTS +25%, FUK +25%, OKA +25% | [JNTO · Golden Week](https://www.japan.travel/pt/spot/1834/) |
| São João de Caruaru | 30/05/2027–27/06/2027 | Projeção anual | CAU +55%, REC +12% | [Empetur · São João de Caruaru 2026](https://www.empetur.pe.gov.br/evento/2230-sao-joao-de-caruaru-2026) |
| Férias de verão · Orlando | 01/06/2027–31/08/2027 | Temporada do jogo | MCO +25%, SFB +25% | [Visit Orlando · temporada turística de verão](https://www.visitorlando.org/media/press-releases/post/orlando-delivers-a-summer-filled-with-headline-concerts-vibrant-festivals-and-new-attractions/) |
| São João de Campina Grande | 03/06/2027–05/07/2027 | Projeção anual | CPV +60%, JPA +12% | [Prefeitura de Campina Grande · programação oficial de 2026](https://campinagrande.pb.gov.br/o-maior-sao-joao-do-mundo-prefeitura-de-campina-grande-e-arte-producoes-divulgam-programacao-oficial-da-edicao-2026/) |
| São João do Maranhão | 01/06/2027–30/06/2027 | Projeção anual | SLZ +35% | [Setur-MA · lançamento da temporada junina de 2026](https://turismo.ma.gov.br/noticias/maranhao-promove-evento-de-lancamento-do-sao-joao-2026-para-imprensa-e-agentes-de-viagens-em-sao-paulo) |
| Santo António | 12/06/2027–13/06/2027 | Recorrência anual | LIS +18% | [Visit Lisboa · Santo António](https://www.visitlisboa.com/pt-pt/eventos/noite-de-santo-antonio-12-13-de-junho) |
| Forró Caju | 20/06/2027–28/06/2027 | Projeção anual | AJU +35% | [Funcaju · edital com datas da edição 2026](https://transparencia.aracaju.se.gov.br/funcaju/wp-content/uploads/sites/6/2026/04/8.-Aviso-e-Edital-005.2026-Patrocinio-Forro-Caju-2026-3-1.pdf) |
| Festival de Parintins | 25/06/2027–27/06/2027 | Recorrência anual | PIN +100%; conexões: MAO, BEL, STM | [Ministério do Turismo · recorrência do festival](https://www.turismo.gov.br/agenda-eventos/views/detalhe-evento.php?id=21894) · [Prefeitura de Parintins · datas de 2026](https://parintins.am.gov.br/noticia/lancamento-do-festival-de-parintins-2026-reune-multidao-shows-nacionais-e-espetaculo-de-caprichoso-e-garantido) · [Azul · ligações extras de Belém e Santarém](https://www.voeazul.com.br/content/dam/azul/voe-azul/imprensa/Azul%20dobra%20oferta%20de%20assentos%20para%20o%20Festival%20de%20Parintins%20%20.pdf) · [Azul · operação até 2 de julho de 2026](https://www.voeazul.com.br/content/dam/azul/voe-azul/imprensa/Azul%20amplia%20opera%C3%A7%C3%A3o%20para%20o%C2%A0Festival%20de%20Parintins%C2%A0com%C2%A0178%C2%A0vo.pdf) |
| Inti Raymi | 24/06/2027–24/06/2027 | Recorrência anual | CUZ +40%; conexões: LIM | [EMUFEC · data anual do Inti Raymi](https://www.emufec.gob.pe/inti-raymi) |
| São João do Porto | 23/06/2027–24/06/2027 | Recorrência anual | OPO +22% | [Visit Porto · São João](https://backoffice.visitporto.travel/pt-PT/sao-joao-the-porto-celebration) |
| Férias de inverno · Argentina | 01/07/2027–31/07/2027 | Temporada do jogo | BRC +30%, USH +30%, IGR +20%, SLA +20%, MDZ +20% | [Secretaria de Turismo da Argentina · resultados das férias de inverno de 2026](https://www.argentina.gob.ar/noticias/vacaciones-de-invierno-212-billones-de-impacto-economico-un-25-mas-que-en-2025) |
| Férias de julho · destinos do Sul | 01/07/2027–31/07/2027 | Temporada do jogo | CXJ +28%, IGU +28%, NVT +22%, POA +14% | [Maceió · procura nas férias de janeiro, fevereiro e julho](https://maceio.al.gov.br/noticias/semtur/maceio-conquista-lideranca-nacional-em-vendas-de-turismo-e-amplia-protagonismo-no-mercado-internacional) · [Ministério do Turismo · férias de julho](https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/partiu-ferias) · [Beto Carrero · temporada de férias de julho](https://destino.betocarrero.com.br/5-motivos-para-passar-as-ferias-de-julho-no-beto-carrero/) · [Beto Carrero · acesso pelo aeroporto de Navegantes](https://destino.betocarrero.com.br/conheca-os-3-aeroportos-mais-proximos-do-beto-carrero/) · [Itaipu Parquetec · pesquisa turística de Foz em julho de 2025](https://www.itaipuparquetec.org.br/wp-content/uploads/2025/11/Relatorio-FInal-Pesquisa-de-Demanda-de-Foz-Julho25.pdf) |
| Férias de julho · Nordeste | 01/07/2027–31/07/2027 | Temporada do jogo | MCZ +28%, FOR +28%, BPS +28%, SSA +20%, REC +20%, NAT +20% | [Ministério do Turismo · férias de julho](https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/partiu-ferias) · [Maceió · procura nas férias de janeiro, fevereiro e julho](https://maceio.al.gov.br/noticias/semtur/maceio-conquista-lideranca-nacional-em-vendas-de-turismo-e-amplia-protagonismo-no-mercado-internacional) · [Setur-BA · destinos procurados nas férias de julho](https://www.ba.gov.br/turismo/noticia/2024-07/4278/destinos-baianos-tem-destaque-em-ranking-de-agencia-de-viagens-para-ferias-de) |
| Verão · litoral e ilhas da Europa | 01/07/2027–31/08/2027 | Temporada do jogo | DBV +30%, SPU +30%, PUY +30%, HER +30%, RHO +30%, CFU +30%, JTR +30%, JMK +30%, KGS +30%, PMI +28%, IBZ +28%, FAO +28%, AJA +25%, BIA +25%, SUF +25%, BRI +25%, BDS +25%, OLB +25%, CAG +25% | [Eurostat · sazonalidade turística regional, incluindo litoral e ilhas](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/111235.pdf) · [Eurostat · pico turístico de julho e agosto](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260707-1) |
| San Fermín | 06/07/2027–14/07/2027 | Recorrência anual | PNA +50% | [Prefeitura de Pamplona · abertura e encerramento](https://www.pamplona.es/en/turismo/sanfermin/chupinazo) |
| Edinburgh Festival Fringe | 06/08/2027–30/08/2027 | Datas confirmadas | EDI +35% | [Edinburgh Festival Fringe · edição 2027](https://www.edfringe.com/experience/explore-the-fringe/what-is-the-edinburgh-festival-fringe/) |
| Oktoberfest de Munique | 18/09/2027–03/10/2027 | Datas confirmadas | MUC +25% | [Organização da Oktoberfest · recorrência e datas de 2027](https://www.oktoberfest.de/en/information/service-for-visitors/faqs-for-wiesn-visitors) |
| Sairé e Festival dos Botos | 16/09/2027–20/09/2027 | Projeção anual | STM +45% | [Prefeitura de Santarém · programação oficial do Sairé 2026](https://santarem.pa.gov.br/noticias/saire-2026/prefeitura-divulga-programacao-oficial-do-saire-2026-f34s5s) |
| Círio de Nazaré | 10/10/2027–10/10/2027 | Recorrência anual | BEL +50% | [Fapespa · Círio no segundo domingo de outubro](https://www.fapespa.pa.gov.br/wp-content/uploads/2024/03/Belem.pdf) |
| Oktoberfest de Blumenau | 07/10/2027–25/10/2027 | Projeção anual | NVT +40%, FLN +8%, JOI +8% | [Prefeitura de Blumenau · Oktoberfest 2026](https://www.blumenau.sc.gov.br/secao/noticias/125481) |
| Natal Luz | 22/10/2027–17/01/2028 | Projeção anual | CXJ +28%, POA +12% | [Natal Luz · calendário oficial 2026/2027](https://www.natalluzdegramado.com.br/) |
| Día de Muertos | 01/11/2027–02/11/2027 | Recorrência anual | OAX +35%, MLM +35%, MEX +18% | [Secretaría de Cultura · datas e tradições do Día de Muertos](https://www.gob.mx/cultura/prensa/mexico-se-prepara-para-celebrar-a-sus-muertos) · [Visit México · Oaxaca e região de Pátzcuaro](https://visitmexico.sectur.gob.mx/blog/post/dia-de-muertos) |
| Férias de verão · Cidade do Cabo | 01/12/2027–31/01/2028 | Temporada do jogo | CPT +25% | [Cape Town Tourism · temporadas ao longo do ano](https://www.capetown.travel/the-best-time-of-year-to-visit-cape-town/) · [Cape Town Tourism · procura nas férias de dezembro](https://www.capetown.travel/cape-town-tourism-reflects-on-a-vibrant-festive-season-awaiting-final-performance-metrics/) |
| Férias de verão · litoral catarinense | 16/12/2027–15/02/2028 | Temporada do jogo | NVT +35%, FLN +35%, JJG +15%, JOI +15% | [Prefeitura de Navegantes · temporada de verão 2025/2026](https://navegantes.sc.gov.br/2025/12/22/o-verao-chegou-navegantes-espera-receber-mais-de-300-mil-turistas-nesta-temporada-veja-como-curtir-com-seguranca/) · [Calendário escolar paulista de 2026](https://atendimento.educacao.sp.gov.br/knowledgebase/article/SED-08404/pt-br) · [SC · Operação Estação Verão nos municípios do litoral](https://portal.doe.sea.sc.gov.br/repositorio/2025/20251119/Jornal/22645.pdf) |
| Férias de verão · praias do Nordeste | 16/12/2027–15/02/2028 | Temporada do jogo | MCZ +30%, REC +30%, BPS +30%, NAT +30%, FOR +30% | [Maceió · procura nas férias de janeiro, fevereiro e julho](https://maceio.al.gov.br/noticias/semtur/maceio-conquista-lideranca-nacional-em-vendas-de-turismo-e-amplia-protagonismo-no-mercado-internacional) · [Ministério do Turismo · férias de julho](https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/partiu-ferias) · [Calendário escolar paulista de 2026](https://atendimento.educacao.sp.gov.br/knowledgebase/article/SED-08404/pt-br) |
| Réveillon de Sydney | 31/12/2027–01/01/2028 | Recorrência anual | SYD +25% | [City of Sydney · programação oficial do Réveillon](https://www.sydneynewyearseve.com/fireworks) · [Governo de NSW · Réveillon de 31 de dezembro](https://www.nsw.gov.au/visiting-and-exploring-nsw/nsw-events/new-years-eve-sydney) |
| Réveillon do Rio | 31/12/2027–01/01/2028 | Recorrência anual | GIG +30%, SDU +30% | [Prefeitura do Rio · operação do Réveillon](https://prefeitura.rio/cidade/prefeitura-apresenta-o-planejamento-operacional-para-o-reveillon-2026/) |
