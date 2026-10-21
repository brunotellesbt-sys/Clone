# Grade semanal, desfazer e inspeções

## Referência visual

A implementação usa a estrutura de `AircraftFlightScheduleSection` e `FlightScheduleBlock` do código Hermes extraído do APK fornecido: sete colunas, eixo de 38 unidades, corpo de 528, margens verticais de 17,5 e marcas de 00:00 a 24:00 a cada duas horas. Isso corresponde a 493 unidades úteis para 1.440 minutos. O tempo não é ampliado ou reduzido conforme a quantidade de voos. A largura acompanha o painel e todos os dias permanecem visíveis no celular.

A referência de fuso é o hub principal da companhia, para que trechos internacionais não se sobreponham artificialmente por usarem horas locais distintas. Um voo que passa da meia-noite continua na coluna seguinte, inclusive sábado/domingo. Selecionar um bloco só mostra os horários locais de saída e chegada; não há edição, arrasto nem exclusão pela grade. A arte foi implementada em SVG, mantendo as medidas extraídas; não é uma captura de tela do aplicativo original.

## Último movimento

Cada clique de Marcar cria um lote de uma ou mais pernas, conforme os dias selecionados. Desfazer último movimento remove somente as pernas aceitas naquele clique, mesmo se alguns dias falharam. Não restaura uma cópia antiga da companhia, não reverte caixa nem apaga marcações posteriores ou de outras aeronaves. O lote fica salvo no JSON e pode ser desfeito após reabrir.

Se uma perna desse lote foi posteriormente remarcada, alterada de aeronave, número ou destino, o desfazer é recusado para não apagar silenciosamente a edição. Uma tentativa sem nenhum voo aceito conserva o último lote válido. A operação sincroniza frequências, aeronaves e ocupação de slots. O botão fica no lado oposto do campo Parte às.

Nas indisponibilidades por sobreposição de voo, o aviso inclui origem, destino, dia/hora de partida e dia/hora local do pouso.

## Inspeção em solo

Regra de balanceamento do jogo: uma parada contínua de pelo menos duas horas permite inspeção antes da próxima decolagem. Aos 120 minutos o desgaste desse voo é reduzido em 5%; a cada meia hora completa adicional a redução cresce 2,5 pontos percentuais, limitada a 65% (desgaste mínimo de 35%). Exemplos: 2h = 5%, 2h30 = 7,5%, 3h = 10%, 6h = 25%. Paradas abaixo de 2h não dão benefício.

Os intervalos são comparados em UTC, incluindo a virada semanal, usando a escala admitida nos slots. O destino anterior precisa ser a origem seguinte: uma quebra com voo vazio não é contada como permanência contínua no aeroporto. Não soma paradas separadas de uma hora para inventar uma inspeção de duas horas. A mesma regra se aplica a passageiros e carga.

O benefício reduz o desgaste por ciclo/horas nos voos efetivamente apurados. Não restaura condição retroativamente, não altera horas/ciclos e não substitui a manutenção pesada, que conserva suas condições de acionamento, duração e cobrança. A frota mostra as paradas elegíveis e a redução média por voo na semana. Esta é uma mecânica de simulação, não um programa real de manutenção aeronáutica.

## Conferência do save de 21/10

O arquivo foi importado somente em memória e no perfil temporário do navegador, sem sobrescrever o JSON original: dia 504, 89 aeronaves e 299 rotas. ANF tem capacidade de 90 movimentos e oferta programada de 90 pela IA; a migração da reserva inicial deixa 2 para o jogador e 88 operantes para as rivais. GRU–ANF estava aberta sem aeronave alocada.

PR-BKU e PR-YDD têm 84 pernas e sete paradas elegíveis cada; a redução média de desgaste por voo na escala é de aproximadamente 2,71%. Uma inspeção longa beneficia o voo seguinte, não todos os voos do dia. O teste `schedule-inspection-check.ts` cobre desfazer, persistência, horários e limites; `schedule-actions-ui.mjs` cobre clique semanal/diário, grade sem edição e telas de 360/412/1365 px.
