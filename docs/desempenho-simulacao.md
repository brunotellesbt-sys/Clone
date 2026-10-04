# Resposta da interface e passagem de dia

A passagem de dia roda em um Web Worker persistente enquanto o relógio está ativo. Há no máximo um dia em cálculo. O worker recebe uma cópia do estado; a interface continua recebendo cliques. O resultado só é publicado se nenhuma ação alterou o jogo desde o início do cálculo. Compra, alteração de voo, importação e pausa não podem ser sobrescritas por um resultado antigo. Pausar encerra o worker. Falha de cálculo pausa a simulação e apresenta o erro.

As velocidades continuam 1×, 75×, 300× e 600×. O agendamento desconta o tempo de cálculo do intervalo e não acumula dias atrasados. As regras de demanda, conexões, concorrência, custos e capacidade não foram simplificadas para acelerar o jogo.

Otimizações do motor:

- Índice estático de aeroportos por cidade e sistema, preservando exceções e o limite de distância. Evita comparar cada aeroporto com todo o catálogo ao buscar alternativas.
- Conexões já validadas são reutilizadas no mesmo dia e revisão da malha. Mudanças operacionais invalidam o resultado.
- Mudanças de concorrentes só refazem a admissão da frota própria se alterarem seus limites efetivos nos aeroportos consultados. Mudanças de escala continuam invalidando a admissão integralmente.
- A alocação diária não percorre 14 dias de histórico para cada mercado: filtra primeiro as reservas relevantes, preservando ordem e aritmética.
- Pausa e velocidade não invalidam os cálculos de oferta de voos.

## Medições locais

No save fornecido de 03/10, com 3.396 pernas semanais, em Edge/desktop e servidor de desenvolvimento:

| Operação | Antes | Depois |
|---|---:|---:|
| Primeira abertura de Rotas | 1.940 ms | 214–233 ms |
| Revisão semanal do motor | 2.176 ms | 1.158 ms |

Em um teste isolado do worker com esse save, um cálculo de 1.135 ms permitiu 111 callbacks da interface, com maior intervalo observado de 44 ms. Isso mede a execução/transferência do cálculo, não promete o mesmo tempo de renderização em todos os celulares. Resultados variam por aparelho e tamanho da malha.

O estado completo após oito dias (incluindo duas revisões semanais) foi comparado antes/depois das otimizações e permaneceu idêntico. O arquivo original do save não foi alterado. O teste do worker também compara oito dias com a execução síncrona e reproduz compra e pausa durante um cálculo pendente.

Validações: `performance-cache-check.ts`, `simulation-worker-ui.mjs`, regressões de conexões/infraestrutura/economia, TypeScript e smoke da versão compilada. Bases grandes são uma alteração separada de regra: apenas aeroportos sem hub com pelo menos 30 movimentos próprios no dia de pico.
