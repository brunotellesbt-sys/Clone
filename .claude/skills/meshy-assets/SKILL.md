---
name: meshy-assets
description: Pipeline de geração de arte de aeronave pela API da Meshy (text-to-image, image-to-image, image-to-3d) para o Skyline Tycoon — sprites de frota em PNG transparente, derivação de livery e modelos 3D. Use quando o pedido envolver gerar imagem ou modelo de avião por IA, criar sprites da frota, arte para o catálogo do mercado, pintar variação de livery a partir de um avião branco, normalizar ou padronizar as imagens geradas, conferir créditos da Meshy, ou quando aparecer chave de API da Meshy, MESHY_API_KEY, nano-banana, gpt-image-2 ou "gerar o avião no Meshy".
---

# Arte de aeronave pela Meshy

## Segurança da chave, antes de tudo

A chave da Meshy é credencial de cobrança: quem a tem gasta os créditos da
conta. Duas regras que não têm exceção neste projeto:

- **A chave vive em `MESHY_API_KEY`, no ambiente**, nunca em arquivo commitado,
  nunca em `.env` versionado, nunca no código do jogo.
- **Nunca chamar a Meshy do frontend.** O jogo é estático e roda inteiro no
  navegador do jogador: qualquer chave que chegue ao bundle está publicada. Se
  algum dia precisar de geração em tempo real, ela passa por um backend — mas
  o caminho certo aqui é outro, ver a seção seguinte.

Se uma chave for exposta em conversa, commit, print ou log, ela está
comprometida: avise e recomende rotacionar no painel da Meshy. Não continue
usando uma chave exposta só porque ela ainda funciona.

## Isto é pipeline de asset, não runtime

Geração leva de segundos a minutos e consome crédito por chamada. O jogo nunca
espera por isso. O fluxo é:

```
gerar (uma vez, no terminal) → revisar a olho → normalizar → commitar o PNG
```

Os assets finais ficam em `public/aircraft/sprites/`, versionados como
qualquer outro arquivo do jogo. E há um prazo: **as URLs da Meshy expiram** —
o campo `expires_at` costuma ficar poucos dias à frente. Baixar na hora da
geração não é otimização, é a única janela.

## O contrato da API

Base `https://api.meshy.ai/openapi`. Autenticação `Authorization: Bearer $MESHY_API_KEY`.
O prefixo `/openapi` é obrigatório — sem ele a resposta é `404 NoMatchingRoute`,
que engana porque parece chave inválida.

| Endpoint | Uso |
|---|---|
| `GET /v1/balance` | créditos restantes |
| `POST /v1/text-to-image` | prompt → imagem. Devolve `{"result": "<id>"}` |
| `GET /v1/text-to-image/{id}` | estado da task |
| `GET /v1/text-to-image?page_num=1&page_size=10` | lista (inclui as de `image-to-image`) |
| `POST /v1/image-to-3d`, `GET /v1/image-to-3d` | malha a partir de imagem |
| `POST /v2/text-to-3d` | malha a partir de prompt (repare: **v2**, não v1) |

Corpo de `text-to-image`: `ai_model` (`nano-banana`, `nano-banana-2`,
`nano-banana-pro`, `gpt-image-2`), `prompt`, e os opcionais `aspect_ratio`,
`remove_background`, `generate_multi_view`, `pose_mode`.

A task devolve `status` (`PENDING`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`,
`CANCELED`), `progress`, `image_urls`, `consumed_credits` e `task_error`.

Custo de tabela por imagem: 3 créditos (`nano-banana`), 6 (`nano-banana-2`),
9 (`nano-banana-pro` e `gpt-image-2`). O custo real cobrado pode ser maior que
o de tabela quando a chamada usa imagens de referência — confira
`consumed_credits` na task em vez de estimar, e cheque o saldo antes de um lote
grande.

## Prompt que funciona para sprite de frota

O que o jogo precisa é uma **base branca sem marca** — silhueta correta, sem
logo, sem pintura de companhia — para depois derivar as liveries. Alguns
aprendizados que economizam crédito:

- **Descrição positiva vence negativa.** "NO winglets" tende a ser ignorado ou
  a reforçar o conceito; "wingtip fence, flat and short" descreve o que você
  quer e o modelo obedece. Use o negativo só como reforço final.
- **O que distingue um modelo é a silhueta, não o texto.** Vale gastar o prompt
  em proporção de fuselagem, formato do nariz, desenho da ponta da asa, formato
  e posição da nacela, altura do trem de pouso — não em adjetivo.
- **Fixe o enquadramento no prompt** e repita a mesma frase em todos os
  modelos: mesma vista lateral, mesma distância, nariz para o mesmo lado, fundo
  neutro. Consistência entre imagens vale mais que perfeição em cada uma.
- **`remove_background: true`** desde a primeira geração. Recortar depois custa
  trabalho e sai pior.
- **`aspect_ratio: "3:2"`** para avião inteiro de perfil.

## Consistência é o problema de verdade

Um lote gerado com o mesmo prompt sai com câmera, distância e escala
diferentes. Individualmente as imagens ficam ótimas; lado a lado numa lista de
frota, o defeito salta — um A320 do tamanho de um 777, um avião apontando para
o outro lado.

Isso **não se resolve regerando**, resolve-se normalizando depois: recortar
pelo canal alfa e reescalar cada avião pelo comprimento real do modelo, que o
catálogo já tem em `shape.length`. Dois aviões diferentes passam a ter a mesma
relação pixel/metro, e o 777 fica maior que o A320 na proporção certa. É o
mesmo princípio que `src/livery/measure.ts` já usa para a arte da Commons.

## Os scripts

```bash
export MESHY_API_KEY=msy_...

node .claude/skills/meshy-assets/scripts/meshy.mjs balance
node .claude/skills/meshy-assets/scripts/meshy.mjs gen catalogo.json --out public/aircraft/sprites
node .claude/skills/meshy-assets/scripts/meshy.mjs status <task-id>

node .claude/skills/meshy-assets/scripts/normalize-sprites.mjs \
  --in public/aircraft/sprites --dims dims.json --out public/aircraft/sprites/norm
```

`meshy.mjs gen` lê um catálogo JSON, cria uma task por item, acompanha o
progresso, baixa o PNG e pula o que já existe (`--force` refaz). Ele **para
antes de gastar** se o saldo não cobrir o lote, e grava `manifest.json` com id
da task, créditos consumidos e prompt de cada imagem — é o que permite
reproduzir ou auditar um lote depois.

Formato do catálogo:

```json
{
  "defaults": {
    "ai_model": "gpt-image-2",
    "aspect_ratio": "3:2",
    "remove_background": true,
    "prompt_prefix": "side profile view of a commercial airliner, ",
    "prompt_suffix": ", pure white unpainted fuselage, no logos, no titles, centered, nose pointing left, even studio lighting, plain background, game-ready asset"
  },
  "items": [
    { "id": "a320neo", "prompt": "narrow-body twinjet, ... " },
    { "id": "b789",    "prompt": "wide-body twinjet, ... " }
  ]
}
```

`normalize-sprites.mjs` precisa de `sharp` (`npm i -D sharp`) e de um mapa
`{"a320neo": 37.6, "b789": 62.8}` de comprimento em metros — que sai direto de
`shape.length` no catálogo de aeronaves.

## Livery por derivação

Para pintar a companhia do jogador, o caminho é `image-to-image` a partir do
avião branco já aprovado, não uma geração nova por companhia: partir da mesma
base mantém a silhueta estável entre as pinturas, e é o que faz a frota parecer
uma frota.

Mas repare no que o jogo já tem: `src/livery/` monta a pintura **peça por peça
em vetor**, com cor por parte, e responde na hora a cada ajuste do jogador.
Livery gerada por IA é imagem fixa — não dá para o jogador editar. Então a
divisão natural é: **vetor para o que o jogador pinta, Meshy para o que é
cenário e catálogo**. Gerar por IA algo que o editor já faz em tempo real é
trocar uma funcionalidade por uma figura.

## Direito de uso

Gerar a partir de prompt, do zero, é o caminho seguro. Partir de foto de avião
de companhia real e mandar apagar a marca **não** torna o resultado livre: a
pintura e o design continuam sendo de terceiros, e fabricantes e companhias
licenciam isso. Como o jogo se compromete a não usar marca real em lugar
nenhum, sprite derivado de foto de companhia real não entra — nem com a marca
apagada.
