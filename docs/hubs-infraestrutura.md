# Hubs, slots e infraestrutura

Regras de simulação (custos e prazos são parâmetros de jogo, não orçamentos reais).

## Ocupantes, bases grandes e encerramento

Hubs de nível 5 aceitam até quatro companhias; nível 4, até três; níveis 1–3, até duas. Inclui o jogador e hubs principais/secundários da IA. Operar voos sem contrato de hub não consome vaga. Na migração, preservam-se os hubs do jogador e priorizam-se as rivais com maior frota; excedentes procuram outra base, preferindo o mesmo país. As rotas afetadas são reconstruídas, com aeronave apta e dentro do orçamento de horas da frota. A expansão futura respeita vagas disponíveis.

O menu **Bases grandes** lista aeroportos com pelo menos 12 movimentos da própria companhia no dia de pico, em ordem de movimento, incluindo os que já são hubs (identificados como tal). Não exige quantidade mínima de destinos: seis idas e voltas no mesmo dia para um único destino bastam. Cada chegada e saída é contada no seu dia local, como na ocupação de slots. Os botões mostram o aeroporto e a contagem diretamente, além do seletor.

Bases sem contrato de hub recebem reserva dos lotes de crescimento e ociosidade com critérios iguais aos hubs, mas exigem 20% mais dias e pontos de tráfego: primeiro lote em 216 dias operados em vez de 180, e redistribuição após 438 dias observados em vez de 365. Hubs exibidos nessa lista mantêm os critérios de hub, sem bônus duplicado. As barras mostram dias, pontos, demanda e observação de ociosidade. As três primeiras devem estar completas na mesma revisão semanal, com limite populacional disponível e sem obra.

Uma concessão única para saves existentes que operam CGH acrescenta 41 movimentos à capacidade local e protege esses 41 para a companhia do jogador. Não exige hub, não é concedida à IA e não se repete ao reimportar/reabrir. Partidas novas não recebem esse benefício de migração. O indicador persistido é `cghExtraSlotsGranted`.

Fechar um hub devolve seu investimento de abertura registrado, normalmente $20 milhões. A base inicial gratuita tem reembolso zero; saves antigos consideram a primeira base gratuita e as demais adquiridas pelo preço vigente. É necessário manter ao menos um hub; uma obra ativa impede o encerramento. Rotas e aeronaves permanecem, mas a reserva excedente do contrato é liberada e a observação de ociosidade recomeça. Aportes em obras não são reembolsados. Uma base com operação suficiente segue no menu de bases grandes.

## Capacidade e migração

Referências iniciais de slots por dia, compartilhados por todas as companhias:

| Nível de infraestrutura | Capacidade inicial de referência |
|---|---:|
| 1 | 90 |
| 2 | 200 |
| 3 | 420 |
| 4 | 780 |
| 5 | 1.300 |

São valores de partida, não tetos fixos nem slots livres garantidos. O nível e a capacidade evoluem separadamente: uma obra de slots acrescenta 35% da capacidade-base (15% nos aeroportos restritos), em vez de substituir a capacidade pelo número do próximo nível. Exemplo: um aeroporto comum com base e capacidade de 90 passa a 122 após essa obra e pode chegar ao nível 2; não salta automaticamente para 200. O painel distingue referência, capacidade normal, capacidade temporária durante obras e folga para a companhia.

Cada partida e chegada usa um movimento no aeroporto, no respectivo dia local. O painel mostra o pico semanal. Abrir uma rota só paga sua estrutura comercial; a capacidade é validada ao marcar cada voo. Acabou a ocupação fictícia fixa de 62% por rivais.

A capacidade inicial é o maior entre a capacidade anterior (incluindo o crescimento acumulado) e 125% dos movimentos programados, mais 24. É calculada uma vez e persistida. Isso preserva saves existentes com folga, sem criar capacidade toda vez que novos voos são acrescentados. O catálogo inicial já contém os cinco níveis de infraestrutura.

Hubs recebem uma reserva inicial com margem. Capacidade compartilhada livre também pode ser usada; a reserva protege contra expansão das rivais. A quantidade mínima de movimentos que permaneceu ociosa durante 365 observações diárias consecutivas passa para a reserva do jogador. Não aumenta a capacidade física. Não se presume ociosidade anterior à importação de um save.

A concorrência expande apenas quando cabem movimentos nas duas pontas. Interdições temporárias distribuem rotações inteiras entre as rivais, com prioridade diária rotativa. O jogador mantém a programação: escalas semanais inteiras de aeronaves que não couberem ficam suspensas, sem apagar voos nem operar uma volta sem a ida. Mapa, vendas, conexões, receita e desenvolvimento consideram a operação admitida. Isso pode suspender mais movimentos que o excesso numérico; remanejar aeronaves e horários permite aproveitar a capacidade restante.

## Histórico e liberações graduais

O painel registra segundas-feiras e guarda até 104 semanas, com população, capacidade, ocupação, passageiros, conexões e demanda diária bidirecional por rota. Os primeiros dados começam no acompanhamento, sem inventar histórico. Passageiros são movimentos da própria companhia no aeroporto; cada conexão é contada uma vez, no segundo trecho. Conexões e passageiros não devem ser somados como pessoas distintas.

A população efetiva mantém a tendência/ciclo do país e o desenvolvimento dos hubs. Eventos, férias e variações semanais de demanda continuam ativos. Um lote natural libera 2,5% da capacidade-base (mínimo 2 movimentos), exigindo simultaneamente:

- 180 dias adicionais de operação por lote;
- tráfego acumulado de 100 vezes a capacidade-base por lote (passageiro = 1 ponto; conexão acrescenta 3);
- procura nas rotas efetivamente programadas de pelo menos 20 vezes a capacidade-base por dia;
- espaço no teto definido por população e nível de infraestrutura.

A tela informa o que falta em cada critério; não promete uma data baseada numa malha futura desconhecida. Demanda de rotas abertas sem voos aparece no histórico, mas não acelera liberações.

## Interesse e financiamento

A administradora precisa de ocupação acima de 72% e tráfego relevante. Conexões aceleram sua maturação. O governo exige população efetiva pelo menos 30% acima da base e ocupação acima de 50%; passageiros locais em rotas acima de 1.500 milhas náuticas aceleram seu interesse. Transferências não dão esse bônus ao governo.

Há um ano inicial de observação após cada expansão. O interesse amadurece em anos: aproximadamente 10–20 anos elegíveis para a administradora e 7,5–15 para o governo. Perda de viabilidade reduz os índices. Não existe aprovação garantida em determinada data. Ambos com 100% iniciam automaticamente uma obra sem cobrar a companhia. Um aprovado permite aporte de 35% (administradora) ou 45% (governo); o restante vem do parceiro. É possível revisar e cancelar antes de pagar.

## Obras

| Obra | Duração | Custo-base total | Resultado |
|---|---:|---:|---|
| Slots/terminal | 365 dias | $180 milhões | +35% da capacidade-base e até um nível de infraestrutura |
| Pista | 730 dias | $1,8 bilhão | +2.000 pés, até 14.000 pés |
| Categoria | 913 dias | $3,2 bilhões | Doméstico → regional → internacional, uma etapa por obra |

Custo-base é multiplicado por `0,65 + 0,35 × nível`. SDU, CGH e PLU não ampliam pista nem categoria: só slots, a 2,5 vezes o custo e ganho menor (+15%). Os tetos físicos limitam novos projetos e acompanham a população; nível máximo é 5.

Há uma obra por aeroporto de cada vez. Durante qualquer obra, a capacidade fica em 50% (arredondada para baixo), inclusive nas iniciativas públicas. O painel avisa antes do aporte e mostra dias restantes. Na conclusão, a capacidade anterior volta, com aumento quando a obra era de slots. Pista e categoria alteram as regras reais do simulador, inclusive catálogo de aeronaves aptas e abertura de rotas, sem modificar o catálogo global de outras partidas.

Aporte é investimento imediato debitado do caixa, registrado na obra; não é custo operacional recorrente de uma rota. Depois de paga, a obra não é cancelável. O histórico registra financiador, prazo e contribuição.

## Persistência e verificações

Saves locais grandes usam compressão LZ sem descarte de dados; arquivos exportados continuam JSON completo. Saves locais antigos não comprimidos continuam sendo lidos. O teste `hubs:check` cobre capacidade, obras, conclusão, migração, persistência, redistribuição anual, restrições, crescimento e virada de dia. A validação visual utilizou 360, 390, 430 e 1280 px com cópia do save fornecido. O arquivo original não é alterado.
