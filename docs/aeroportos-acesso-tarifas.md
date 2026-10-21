# Categorias, acesso inicial e edição de tarifas

A categoria é uma regra de jogo: todo aeroporto operável por ao menos uma variante de motor de widebody do catálogo recebe escopo internacional. A verificação usa a mesma pista operacional, elevação e teto de porte da seleção de aeronaves. Não modifica esses limites nem concede alcance a modelos. MAO, FLN, POA, REC, NAT, CWB, SSA, CNF, BEL, VCP, PNZ, CFB, IGU, MCZ, SLZ e THE também são explicitamente internacionais. Essa regra de simulação não representa certificação alfandegária real.

O cadastro internacional prevalece sobre uma categoria antiga inferior gravada no save. Obras e capacidades persistidas permanecem preservadas. Aeroportos sem aptidão a widebody conservam as classificações específicas, incluindo SDU, CGH e PLU domésticos.

## Estações novas e ANF

Antes, abrir uma rota cobrava taxas comerciais sem verificar ou proteger capacidade nas duas pontas. O hub usava sua reserva; destinos sem hub dependiam da sobra após a oferta das rivais, podendo aparecer com zero movimentos disponíveis mesmo após a abertura.

Uma estação nova sem movimentos próprios pode obter reserva inicial de dois movimentos dentro da capacidade física existente. Essa reserva é compartilhada por todas as rotas do jogador no aeroporto e identificada por `entryAccess`, não se renova ao fechar e reabrir uma rota. A IA usa o restante da capacidade. Um movimento é um pouso ou uma decolagem: dois permitem uma ida e volta diária. Frequências extras dependem de espaço adicional e a escala continua respeitando horários e dias locais.

A abertura valida pelo menos dois slots disponíveis em cada ponta, incluindo a reserva inicial quando elegível. Se não couber, devolve o motivo antes de cobrar a taxa. Obras continuam reduzindo capacidade e podem inviabilizar temporariamente voos. Não há expansão automática de capacidade. Rotas antigas já pagas, ainda sem operação em destinos elegíveis, recebem a mesma proteção uma única vez ao carregar.

A tela de abrir rota identifica a disponibilidade por código de aeroporto e explica a reserva. A abertura permanece sem programar voos automaticamente. Os direitos iniciais não alteram os prazos de crescimento ou ociosidade.

## Tarifas

A seção de tarifas começa com o botão Editar preços. Ao abrir, mostra os controles por cabine, valores e sugestão já existentes; Fechar edição de preços recolhe o conteúdo. Trocar de rota recolhe novamente. Classes continuam seguindo a elegibilidade de demanda, e carga mantém seu único controle. As faixas e o cálculo das tarifas são preservados.

Validação: `airport-entry-check.ts` cobre categorias, migração, ANF saturado, capacidade fixa, frequência da IA, reabertura, persistência e falha sem cobrança. `route-prices-ui.mjs` cobre edição, persistência, reserva na tela de abertura e responsividade. `runways-check` continua congelando a aptidão de aeronaves e os demais índices cadastrais; a categoria é coberta separadamente pela nova regra.
