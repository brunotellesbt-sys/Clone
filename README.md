# Skyline Tycoon

Simulador de companhia aérea que roda inteiro no navegador — sem servidor, sem
conta, sem backend. Funde a empresa, compra aeronaves, abre rotas, define
frequência e tarifa, disputa passageiro com companhias controladas por IA e
pinta a frota.

## Estado do repositório

O código do jogo ainda não está aqui. Este repositório carregava um fork do
`pokemon-roulette` (Angular), removido por não ter relação com o projeto; o
histórico anterior continua acessível pelos commits antigos.

Por enquanto ele guarda o que prepara o terreno:

```
CLAUDE.md          identidade do projeto, stack, comandos e convenções
.claude/skills/    conhecimento de domínio para o desenvolvimento assistido
```

## As skills

Cada uma cobre uma área onde errar sai caro, e carrega o **porquê** de cada
regra — não só o passo a passo:

| Skill | Cobre |
|---|---|
| `skyline-sim` | demanda, custos de voo, divisão de mercado, tick diário e IA concorrente; como mexer em número sem quebrar o balanceamento |
| `skyline-fleet-data` | catálogo de aeronaves, motorizações e aeroportos; o que é dado real de fabricante e o que é número de jogo |
| `skyline-livery` | silhueta vetorial, pintura peça por peça e arte livre da Wikimedia Commons |
| `meshy-assets` | geração de sprites e liveries pela API da Meshy, com scripts de geração e de padronização |
| `skyline-qa` | as três camadas de verificação antes de considerar algo pronto |

As duas ferramentas de `meshy-assets/scripts/` rodam sozinhas:

```bash
export MESHY_API_KEY=msy_...
node .claude/skills/meshy-assets/scripts/meshy.mjs balance
node .claude/skills/meshy-assets/scripts/meshy.mjs gen catalogo.json --out public/aircraft/sprites
node .claude/skills/meshy-assets/scripts/normalize-sprites.mjs --in public/aircraft/sprites --dims dims.json
```

A chave da Meshy é credencial de cobrança: vive em `MESHY_API_KEY`, no
ambiente, e nunca em arquivo commitado nem no código do jogo — que é estático e
roda no navegador do jogador.

## Licença

MIT.
