# Categorias, acesso inicial e edição de tarifas

A categoria é uma regra de jogo: todo aeroporto operável por ao menos uma variante de motor de widebody do catálogo recebe escopo internacional. A verificação usa a mesma pista operacional, elevação e teto de porte da seleção de aeronaves. Não modifica esses limites nem concede alcance a modelos. MAO, FLN, POA, REC, NAT, CWB, SSA, CNF, BEL, VCP, PNZ, CFB, IGU, MCZ, SLZ e THE também são explicitamente internacionais. Essa regra de simulação não representa certificação alfandegária real.

O cadastro internacional prevalece sobre uma categoria antiga inferior gravada no save. Obras e capacidades persistidas permanecem preservadas. Aeroportos sem aptidão a widebody conservam as classificações específicas, incluindo SDU, CGH e PLU domésticos.

## Estações novas e ANF

Antes, abrir uma rota cobrava taxas comerciais sem verificar ou proteger capacidade nas duas pontas. O hub usava sua reserva; destinos sem hub dependiam da sobra após a oferta das rivais, podendo aparecer com zero movimentos disponíveis mesmo após a abertura.

O cálculo normal de disponibilidade permanece como no PR #113: estações sem hub podem usar a capacidade compartilhada livre, além de suas reservas. Abrir uma rota onde há pelo menos dois movimentos disponíveis não compra slots de outra companhia nem cria uma reserva artificial. Um movimento é um pouso ou uma decolagem.

Somente na abertura de uma rota para uma estação nova sem espaço para a primeira ida e volta pode haver cessão de até dois movimentos dentro da capacidade física existente. A compra prioriza dois slots ociosos de outra companhia; sem eles, usa a companhia com mais movimentos programados. A cessão é compartilhada pelas rotas na estação e não se repete ao fechar e reabrir.

A compra escolhe primeiro a operadora com mais slots vagos; sem sobra, escolhe a maior operação. Como os saves antigos não tinham títulos individuais de slots, a cota de referência inicial é dividida entre as operadoras locais, considerando uso programado e sobra física. A transferência registra a companhia escolhida e reduz o limite de sua oferta, preservando as demais dentro da capacidade global. 25% da taxa de abertura por ponta com cessão é repassada à cedente, sem cobrança adicional ao jogador. A migração de rotas já pagas não cobra novamente.

O marcador `entryAccess` registra a cessão; não limita a estação à reserva. Capacidade compartilhada que estiver livre continua utilizável, inclusive depois de uma cessão. Hubs conservam suas regras de reserva; crescimento, obras e redistribuição anual mantêm seus critérios e prazos.

A abertura valida pelo menos dois slots disponíveis em cada ponta, incluindo a cessão quando elegível. Se não couber, devolve o motivo antes de cobrar a taxa. Obras continuam reduzindo capacidade e podem inviabilizar temporariamente voos. Não há expansão automática de capacidade. Carregar um save não compra nem transfere slots retroativamente.

Saves afetados pelo limite geral de dois movimentos recuperam a disponibilidade normal ao carregar na versão corrigida. O cálculo ignora o marcador antigo como teto, sem apagar voos, alterar a frota, cobrar novamente ou remover reservas já adquiridas.

A tela de abrir rota identifica a disponibilidade por código de aeroporto e explica a reserva. A abertura permanece sem programar voos automaticamente. Os direitos iniciais não alteram os prazos de crescimento ou ociosidade.

## Tarifas

A seção de tarifas começa com o botão Editar preços. Ao abrir, mostra os controles por cabine, valores e sugestão já existentes; Fechar edição de preços recolhe o conteúdo. Trocar de rota recolhe novamente. Classes continuam seguindo a elegibilidade de demanda, e carga mantém seu único controle. As faixas e o cálculo das tarifas são preservados.

Validação: `airport-entry-check.ts` cobre categorias, migração, ANF saturado, capacidade fixa, frequência da IA, reabertura, persistência e falha sem cobrança. `route-prices-ui.mjs` cobre edição, persistência, reserva na tela de abertura e responsividade. `runways-check` continua congelando a aptidão de aeronaves e os demais índices cadastrais; a categoria é coberta separadamente pela nova regra.
