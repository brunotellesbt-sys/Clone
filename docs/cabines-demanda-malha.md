# Cabines, demanda e malha

Prévias: [cabine com dados do APK](cabine-apk-selecionada.png) ·
[mapa e painel do hub](mapa-hub-satelite.png).

## Dados de poltronas do APK

`src/game/data/apk-seats.json` contém os 28 produtos, preços, dimensões,
índices de apelo e restrições das 15 famílias de cabine extraídos do bundle
Hermes 98 de The Airline Simulator 1.29.3 fornecido para este projeto.
O SHA-256 do bundle está no próprio JSON. A extração lê literais da função
671, sem executar o aplicativo; `scripts/extract-apk-seats.py` permite
reproduzi-la a partir da saída do [hermes-dec](https://github.com/P1sec/hermes-dec).
O APK e sua descompilação permanecem fora do repositório.

`apeloDaPoltrona` aplica a fórmula original de `getSeatRatings` (função 17856):
produto, passo e, quando aplicável, densidade. O índice pode ultrapassar 100%.
Exemplo: Suíte ampla usa passo fixo de 54 polegadas, custa 40.000 por assento
e tem apelo de 115%; no A350 usa 1-2-1 e no A320 não está disponível.
Os nomes e fotos acompanham a seleção; os antigos presets genéricos saíram
das telas de encomenda e reforma. Cabines salvas pelo jogador continuam disponíveis.

As famílias adicionais usam uma cabine de largura equivalente. As restrições
do simulador para classes e comprimento de cabine continuam valendo. Ao carregar
um save, opções incompatíveis são substituídas por produtos compatíveis e os
assentos são ajustados ao espaço, priorizando F, C e W antes de Y. Isso pode
reduzir a capacidade de configurações antigas que não cabiam nas regras originais.
Cargueiros não recebem configuração de passageiros.

O efeito sobre a reputação usa a fórmula já existente do simulador, incluindo
seus limites. O valor ao lado de cada classe é o ganho potencial no alvo,
comparado ao menor apelo da classe nesta aeronave, antes da média da frota.
Não é aumento instantâneo nem promessa de pontos por dia.

## Demanda e concorrência

O aumento é uma calibração de jogo: preserva massa dos aeroportos, distância,
riqueza, sazonalidade, ciclos e crescimento anual. O multiplicador passa de
0,9 a 1,15, o teto por par de 50% a 55% da ponta menor e os pisos regionais
sobem. A executiva recebe uma proporção crescente com a distância, distinta da
premium. Primeira doméstica continua limitada a mercados elegíveis acima de 2.000 km.

Comparação com a versão anterior no mesmo dia (dia 0, dia do ano 1), passageiros/dia
somando as classes nos dois sentidos:

| Mercado | Antes | Agora |
|---|---:|---:|
| SDU–CGH | 13.953 | 15.350 |
| GRU–BSB | 17.390 | 22.129 |
| GRU–REC | 4.424 | 5.652 |
| GRU–JFK | 3.003 | 3.837 |
| IZA–GRU | 203 | 229 |

Os números são resultados do modelo, não medições dessas rotas. As referências
de contexto são os relatórios da IATA de
[2024](https://www.iata.org/en/pressroom/2025-releases/2025-01-30-01/) e
[dezembro de 2025](https://www.iata.org/en/iata-repository/publications/economic-reports/air-passenger-market-analysis-december-2025/).
Os dados reais não justificam aplicar uma taxa única a todos os mercados.

A IA pode ampliar o ritmo de abertura de rotas conforme o tamanho da malha do
jogador, mantendo limites de caixa, frota e alcance. A frota exibida deixa de ser
sobrescrita por uma estimativa financeira. Companhias novas: máximo de duas no
mundo, primeira após pelo menos 15 anos e segunda pelo menos 15 anos depois;
ambas dependem de sorteio e mercado pouco atendido. Saves com mais companhias já
fundadas não perdem companhias, mas não recebem outras novas.

## Conexões e números de voo

Janelas acordadas: doméstica 40 minutos–3 horas; internacional em trânsito
1–4 horas; transferência doméstica/internacional 3–6 horas. A classificação
usa os países das pernas; não implementa todas as exceções nacionais de vistos,
preclearance ou trânsito estéril. CDG–GRU–IZA usa a janela de 3–6 horas.

Cada perna guarda passageiros por classe e contadores de conexão de entrada e
saída na última apuração. Os contadores distribuem a procura adicional de
conexões efetivamente atendida pela rota entre seus voos compatíveis, respeitando
a ocupação. São uma atribuição agregada do simulador, não rastreamento individual
de bilhetes entre os dois voos. A interface distingue o último resultado das
possibilidades futuras da grade. Carga e aeronaves em manutenção não alimentam
conexões de passageiros.

O codeshare depende de interline, reputação e taxa de contratação. Aumenta o
peso comercial das conexões da parceira e atribui códigos de comercialização às
rotas dela. Não cria aeronaves próprias nem receita automática por vender toda a
malha da parceira. Voos próprios e codeshare compartilham números únicos; repetir
o mesmo serviço em outros dias conserva o número.

## Mapa e painel de companhias

O fundo é o mosaico diurno
[Blue Marble Next Generation, NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/),
armazenado localmente, com os sprites de mapa do APK por família e trajetos da
escala. O mapa não é uma imagem de satélite ao vivo. Aeroportos abrem painéis
com chegadas/partidas locais e rotas de concorrentes; hubs próprios têm destaque.

O painel Companhias compara frota, malha, frequências por sentido, tarifas e
sobreposição com a companhia do jogador. A lotação é identificada como estimativa
e considera oferta, demanda, horário, qualidade e a média semanal da escala própria.

## Verificação

`npm run build`, `npm run aircraft2d:check`, `npm run cabines`, `npm run rotas`,
`npm run malha`, `npm run ai:foundation`, `npm run flights:check` e
`npx tsx scripts/cargo-check.ts` verificam regras, simulação e saves.
Com o servidor local ativo, `npm run mobile`, `npm run cabin:selected` e
`npm run mapa` verificam navegação, fotos selecionadas, ausência de transbordo
no celular, zoom, clique, trajetos e painel de aeroporto. Capturas ficam em `.qa/`,
ignorada pelo Git.
