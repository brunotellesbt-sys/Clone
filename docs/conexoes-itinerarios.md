# Conexões por itinerário e mapa

Uma venda de SDU → BSB → LIM guarda os mesmos passageiros por classe nos dois voos. No primeiro, aparecem saindo para conexão; no segundo, entrando de outro voo. Esses embarques ocupam assentos e geram receita, mas não são contabilizados como procura local SDU–BSB ou BSB–LIM atendida. O mercado SDU–LIM é a origem da venda.

## Procura, preferência e capacidade

- A procura O&D existente continua variando com a data, sazonalidade e evolução do mercado. Cada sentido recebe metade da procura diária bidirecional.
- Combinações para a mesma região compartilham a procura, inclusive entre hubs. Aeroportos do mesmo país a até 100 km entram como alternativas. Aumentar frequências não cria uma nova demanda para cada combinação.
- Menor desvio, espera e preço, maior reputação e integração favorecem uma conexão. Voos diretos próprios e concorrentes, inclusive GIG como alternativa a SDU, reduzem sua participação. Diretos já vendidos pela companhia são descontados da procura ainda disponível antes de vender conexões.
- Uma conexão não é oferecida quando o próprio par já tem voo direto ativo. Quando há mais de um hub possível, o jogo compara os caminhos de duas pernas: uma alternativa claramente mais curta por outro hub elimina a conexão mais longa. Assim, GIG–SSA–CKS pode existir sem GIG–CKS direto, enquanto FLN–BSB–POA não aparece quando FLN–GRU–POA é a alternativa melhor.
- A quantidade vendida é limitada simultaneamente à capacidade dos dois trechos, por classe. Em voo que sairia com assentos vazios, a conexão usa apenas essa sobra, sem limite percentual. Quando a classe já sairia cheia, até 40% dos lugares podem ser ocupados por conexões; os outros 60% ficam com passageiros locais.
- O bilhete integrado é calculado sobre a viagem final, com desconto de 10% na referência ponderada; a receita é dividida entre os trechos pela distância. A receita de um trecho parceiro não vai para a companhia do jogador.
- Reserva que cruza meia-noite fica no save e tem prioridade no próximo dia. Mudança de horário, remoção de voo, manutenção ou redução de capacidade que inviabilize a reserva interrompe a conexão. A apuração por voo usa o dia UTC de partida, assim como o mapa.
- Interline continua usando o horário representativo já existente para a rota da parceira. A frota e a demanda das IAs continuam abstraídas pelo simulador; isto não transforma sua operação em um sistema completo de reservas.

O painel **Conexões** distingue passageiros únicos, embarques nos voos próprios e reservas aguardando o segundo trecho. Permite filtrar hub, período e aeroporto/número de voo. **Rotas** continua mostrando atendimento local e a média de embarques de conexão separadamente. Histórico de saves anteriores sem essa separação conserva seus totais; novas apurações gravam os campos separados.

Os itinerários vendidos são ordenáveis por lucro ou prejuízo. Cada resultado usa a receita líquida dos trechos próprios e uma parcela proporcional do custo operacional de cada voo; reservas com segundo trecho ainda pendente mostram resultado parcial. Saves anteriores à gravação de custos por conexão mostram o resultado indisponível. A aba **Finanças** lista rotas em déficit dos últimos 14 dias, da maior perda à menor, com ocupação, oferta, procura, receita por passageiro ou tonelada, custo por unidade e principal despesa quando houver detalhamento.

A procura apresentada para um par reúne ida e volta. Com o ajuste adicional de 3%, o piso de um par que aceita jato regional é 309 passageiros por dia (154,5 por sentido); o de um par restrito a turboélices é 117,42 (58,71 por sentido, permitindo uma ida e volta de ATR 42 mesmo com tarifa 1,15×). Trata-se de procura potencial do mercado, não de passageiros garantidos à companhia: concorrência, preço, horários e número de assentos continuam disputando esse mercado. Eventos e férias podem elevar essa base nas semanas indicadas no [calendário](calendario-demanda.md).

## Retirada de bagagem, não apenas imigração

As janelas abaixo são regras de gameplay solicitadas pelo jogador, não MCTs oficiais para planejar viagens reais. Consideram bilhete integrado no mesmo aeroporto; troca de aeroporto e bilhetes independentes não são tratados como conexão da malha.

| Situação | Janela no jogo | Exemplo |
| --- | --- | --- |
| Doméstico → doméstico | 40 min–3 h | SDU–BSB–REC |
| Internacional envolvido, sem recolher/redespachar bagagem | 1–4 h | SDU–GRU–JFK; GRU–MAD–OPO |
| Recolher, passar pela alfândega e redespachar | 3–6 h | LHR–GRU–SDU; GIG–ATL–JFK |

No modelo, chegada internacional seguida de doméstico exige redespacho, com exceções de bagagem integrada no espaço Schengen, Reino Unido e Bogotá. A primeira chegada aos EUA exige o procedimento mesmo continuando ao exterior; aeroportos de origem com preclearance têm exceção. Passar por controle de passaporte em Madrid, por si só, não ativa a janela de redespacho. Programas experimentais específicos por voo/companhia, terminais e outras exceções comerciais não são simulados.

Referências oficiais consultadas em 25/09/2026:

- [LATAM: retirada de bagagem em conexão](https://www.latamairlines.com/us/pt/central-ajuda/perguntas/bagagem/voos-conexao-escala/retirada-conexao) — mesma reserva, internacional/doméstico e exceções Schengen, Inglaterra e BOG.
- [LATAM: guia doméstico → internacional em GRU](https://www.latamairlines.com/content/dam/latamxp/sites/experiencia/aeropuerto/conexiones/GUIA_T2_VUELOS-NAC-A-INT_PT.pdf) — bagagem segue quando os voos estão na mesma reserva.
- [Aena: conexões em Madrid](https://www.aena.es/en/adolfo-suarez-madrid-barajas/airport-services/connecting-flights.html) — controle de passaporte, segurança e retirada de bagagem são procedimentos distintos.
- [CBP: chegada e bagagem em conexão](https://www.help.cbp.gov/s/article/Article-1244?language=en_US), [preclearance](https://www.help.cbp.gov/s/article/Article-1333?language=en_US) — primeira entrada nos EUA e inspeção antes da partida.

## Mapa e relógio

Os sprites originais do APK apontam para baixo, enquanto o ícone alternativo aponta para cima. Cada um recebe sua rotação intrínseca antes da orientação pela tangente do grande círculo. A precisão do traçado acompanha o zoom para evitar afastamento entre linha e aeronave. A passagem pela linha de data não inverte o rumo.

A engrenagem permite mostrar ou esconder separadamente rotas próprias, concorrentes e o trajeto selecionado. Preferências ficam neste navegador. Zoom máximo: 72×. Velocidades: pausa, 1×, 25×, 50× e 100×; saves antigos com 4×, 12× e 40× migram para as novas velocidades correspondentes.

Validação: `connections:check`, `flights:check`, `map:geometry`, `connections:ui`, `mapa` e `mobile`, além dos testes gerais de simulação e carga.
