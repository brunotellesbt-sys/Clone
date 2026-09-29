# Calendário de demanda turística

Pesquisa ampliada em 28/09/2026: **300 eventos distintos e 23 períodos de férias e temporadas**, em **47 países e territórios** dos seis continentes habitados, beneficiando 285 aeroportos. O requisito de 300 conta apenas eventos: férias, vários aeroportos e semanas de uma mesma festa não aumentam essa contagem. O catálogo é uma seleção mundial, não uma lista exaustiva de todos os eventos e escolas.

## Demanda fluida e planejamento semanal

O mercado local continua calculado pelo movimento dos aeroportos, afinidade, distância, perfil turístico, renda, crescimento e ciclos econômicos de cada país. A sazonalidade anual permanece. A mudança é a referência temporal: esses fatores são consultados na segunda-feira da semana e permanecem iguais até domingo. O antigo multiplicador diferente para cada dia da semana foi removido dos passageiros.

Os eventos são uma camada adicional sobre essa base. O primeiro dia de cada período recua até a segunda-feira; o último avança até o domingo. Parintins, Círio e Sinulog incluem uma janela de retorno declarada no catálogo. Assim não é necessário desenhar uma malha diferente para a sexta-feira ou para o domingo. A ocupação efetiva ainda depende da oferta, preços relativos, concorrência, horários, reputação e conexões — demanda estável não é venda garantida.

Carnaval e Mardi Gras são calculados pela Páscoa gregoriana de cada ano; Círio e Sinulog pela posição do domingo no mês. Regras também permitem deslocamento em relação a um dia da semana, como o sábado anterior à segunda segunda-feira de outubro no festival Hiwasa. Anos bissextos e temporadas que atravessam dezembro/janeiro usam a data real da partida. Janeiro encontra também o evento iniciado no ano anterior.

Ano-Novo Chinês, Dragon Boat e Mid-Autumn usam tabelas do Observatório de Hong Kong de 2026 a 2100, incluídas no jogo e sem acesso à rede durante a partida. Isso evita divergências de um dia presentes em algumas versões do ICU dos navegadores. Meses intercalares não duplicam a festa. Além desse intervalo, o cálculo ICU fica explicitamente identificado como projeção. `node scripts/update-lunar-calendar.mjs` atualiza a tabela após validar todas as respostas do órgão oficial.

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

A aba abre no mês/ano atual da partida. É possível avançar até dezembro do ano seguinte, retornar ao mês atual e combinar busca por evento, aeroporto ou cidade com filtros de tipo, continente, país/território e própria malha. Trocar de continente limpa um país incompatível. A geografia se refere aos aeroportos beneficiados, não aos hubs de conexão distantes.

Cada semana começa com até seis cartões, priorizando destinos da companhia, e permite expandir a lista inteira. Mudar os filtros reinicia essa expansão. Eventos e férias têm contadores separados, tanto no catálogo completo como no período filtrado. O grau de confirmação aparece no cartão fechado; ao expandir surgem datas-base, semanas de efeito, motivo e fontes.

O horizonte se renova com o passar do tempo. As datas podem aparecer como **Datas confirmadas**, **Recorrência anual**, **Projeção anual** ou **Temporada do jogo**. Uma projeção reaplica uma referência de época para a simulação; não afirma que o organizador já publicou o calendário daquela edição. Novas datas oficiais podem ser registradas em `confirmed` no catálogo, sem mudar o cálculo semanal.

O calendário e a demanda de venda compartilham as mesmas ocorrências. A referência exibida nas rotas, a estimativa ao abrir rota e os mercados usados por conexões/concorrentes recebem o mesmo calendário do save. A lista estrutural de destinos da IA não guarda picos temporários no cache de dois anos; a decisão de oferta e a apuração de receita usam a semana atual.

## Ajuste pequeno de tarifa e piso

Estes ajustes foram aplicados no PR #94 e são preservados nesta ampliação do catálogo, sem outro aumento de tarifa ou piso.

A tarifa de referência de todas as passagens sobe **3% sobre o nível anterior**: fator 1,15 → 1,1845. Os multiplicadores de classe e os preços relativos escolhidos pelo jogador continuam iguais. Nenhum coeficiente ou fórmula de custo operacional foi alterado; operar mais voos ou transportar mais passageiros pode naturalmente aumentar o gasto total.

O piso de passageiros aumenta também **3%**:

| Par elegível | Antes, ida + volta/dia | Agora, ida + volta/dia |
| --- | ---: | ---: |
| Jato regional | 280 Y + 20 W = 300 | 288,4 Y + 20,6 W = 309 |
| Apenas turboélice | 114 Y | 117,42 Y |

Os bônus sazonais entram depois do piso, para que aeroportos pequenos também recebam o benefício. Mercados já maiores seguem sua fórmula normal. Custos de combustível, manutenção, tripulação, taxas, atendimento e serviço de bordo mantêm seus parâmetros. O modelo de carga permanece separado.

## Validação

`npm run calendar:check` cobre catálogo, fontes e IATAs, recorrências entre 2026 e 2069, tabela lunar de 2026 a 2100, Carnaval móvel, anos bissextos, continuidade anual, igualdade entre os sete dias, composição de bônus e integração das rotas. `npm run calendar:ui` cobre navegação e limites do horizonte, filtros, fontes, indicação nas rotas e larguras de 360, 412 e 1365 pixels.

## Catálogo e fontes

[Tela do calendário no desktop](images/calendario-desktop.png) · [No celular](images/calendario-mobile.png) · [Detalhes de férias e fontes](images/calendario-ferias.png)

[Catálogo completo com datas, aeroportos e fontes](calendario-catalogo.md). O catálogo executável está dividido por região em src/game/data/travelEvents*.ts e travelSeasons.ts.
