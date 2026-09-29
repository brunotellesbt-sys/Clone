# Demanda e desenvolvimento dos hubs

A demanda diária continua sendo a soma dos dois sentidos. O piso estrutural é **2 × maxSeats** da maior aeronave de passageiros que possa operar o par, considerando os dois aeroportos, elevação/pista/porte, distância, motorização e ano. Não é garantia de lotação: tarifa, concorrência, configuração de cabine e horário continuam afetando as vendas.

A curva gravitacional e seu teto crescem na mesma proporção entre o novo piso e a referência histórica (309 passageiros para jatos ou 117,42 para turboélices), sem redução dessa curva. Depois aplica-se o piso ao total, distribuído por renda e distância. Não se acrescenta um piso separado para cada classe. Turboélices ficam na econômica; primeira classe mantém as restrições de distância/renda e disponibilidade de aeronave. Mercados origem/destino sem voo direto possível continuam existindo para conexões, mas não ganham piso de voo direto.

Tendência econômica dos países, ciclos, estações e calendário de eventos/férias continuam ativos. A ampliação não altera custos operacionais nem os parâmetros da carga.

## Cidades

Só hubs com voos programados ativos desenvolvem a cidade. Movimento próprio e das rivais conta; aeronaves próprias em manutenção não contam. Aeroportos com o mesmo país/cidade compartilham o desenvolvimento, sem duplicar a taxa.

- Força = mínimo de 1 e `0,25 + movimentos diários / 40`.
- Bônus da taxa = força × 1 em hub doméstico; força × 3 quando há voo internacional. Assim hubs fortes chegam a **2× e 4× a taxa anual**, respectivamente.
- Em cidades com pelo menos 10 milhões de habitantes, o bônus cai pela metade: até 1,5×/2,5×.
- Taxa local de referência = crescimento do país, com mínimo de 0,5% para o investimento adicional do hub. A tendência/ciclo original do país permanece separado, inclusive quando negativo.
- O fator adicional acumula semanalmente como `((1 + taxa × multiplicador) / (1 + taxa))^(dias / 365)`. Não dobra a população instantaneamente.
- O efeito acumulado se distribui entre população (`fator^0,55`) e poder de compra (`fator^0,45`); seu produto amplia a procura. Poder de compra também afeta a mistura de classes e a tarifa de referência.
- Slots adicionais = parte inteira de `slots originais × (fator - 1)`, disponíveis para quem possui e opera hub no aeroporto. Hub próprio vazio não recebe slots por conta de operação da IA.

Saves antigos iniciam o contador ao continuar a simulação, sem crescimento retroativo presumido. O histórico acumulado é salvo/exportado. Um hub inativo deixa de gerar crescimento adicional, preservando o que a cidade já conquistou.

Entre dois hubs ativos, de qualquer companhia, a procura dobra até a maior distância entre SSA–FOR, FOR–BSB e SSA–BSB. Depois o bônus diminui linearmente até zero no dobro desse raio; MAO–PVH está contemplada. O painel do aeroporto mostra a taxa e os efeitos acumulados.

## Concorrentes

As rivais passam a manter múltiplos hubs e abrir rotas a partir deles. O alvo de frota/rotas/hubs acompanha o jogador com perfil individual entre 80% e 120%, ajustado pela maturidade e pelo tamanho do mercado do país. Empresas de países pequenos não viram automaticamente companhias gigantes. Uma frota madura já maior não é desmontada para copiar o jogador. A frota também tem um alvo orgânico ligado à evolução do país desde o início dessa regra; companhias grandes podem abrir mais hubs mesmo quando o jogador ainda possui poucos.

A cada semana a IA pode adquirir até 4% da frota (arredondado para cima), conforme caixa e necessidade. A contabilidade simplificada reinveste 10% da receita mensal estimada, proporcionalmente à semana; a entrada de expansão custa 3 milhões por aeronave e uma base custa 5 milhões. Abre no máximo uma base a cada 28 dias, em outra cidade do país já atendida pela companhia. Oferta e expansão respeitam o orçamento de 18 horas diárias por aeronave e a capacidade máxima operável de cada trecho.

A malha inteira revê assentos/frequências semanalmente. A regra de fundação de novas empresas continua separada: primeira após pelo menos 15 anos, segunda pelo menos 15 anos depois, no máximo duas novas empresas no mundo.

## Verificação

`npm run economy:hubs` cobre pisos/classes, conexões sem direto, hubs ativos/inativos, persistência e isolamento de saves, crescimento doméstico/internacional/megacidades, slots e um ano de expansão de concorrente.

Também foi executada uma simulação de 28 dias em memória a partir do save de diagnóstico (46 aeronaves, 7 hubs, 224 rotas). As rotas MAO–GYN e FOR–JDO deixaram de apresentar déficit na janela final. As rivais brasileiras passaram de 18/10/12 para 22/14/16 aeronaves e abriram um segundo hub. Isso é resultado dessa simulação, não promessa de lucro para qualquer malha. O arquivo original foi preservado e não é incluído no repositório.
