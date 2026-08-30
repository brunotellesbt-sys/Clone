# Airbus A319-100 — teste de sprite

Primeiro teste do pipeline da Meshy como substituto do desenho vetorial.

| Arquivo | Vista |
|---|---|
| `a319-frente.png` | três-quartos dianteiro, ~35° do nariz |
| `a319-lateral.png` | perfil lateral, câmera perpendicular |
| `a319-traseira.png` | três-quartos traseiro, ~35° da cauda |

1536×1024 (3:2), fundo branco sólido (`#FFFFFF`), `gpt-image-2`, 9 créditos cada.
`catalogo.json` traz os prompts e `manifest.json` o id da task, o modelo e o
custo real de cada geração — é o que permite reproduzir ou auditar o lote.

## Procedência

Gerado **só por prompt**, sem imagem de referência. Nenhuma foto de terceiro
entrou na cadeia, o que mantém a promessa do README do projeto de que nenhum
ativo veio de produto de terceiros.

## Fundo

A primeira geração usou `remove_background: true` e saiu com uma sombra cinza
"queimada" na borda do recorte — visível sobretudo atrás da deriva e do nariz.
Por pedido do autor, a versão publicada usa fundo branco sólido
(`remove_background: false` + `SOLID PURE WHITE background` no prompt) em vez
de transparência: sem esse degradê, contorno mais limpo. Recorte por alfa fica
para depois, quando fizer sentido — o `catalogo.json` já traz os dois modos,
então é só reverter o campo e regerar.

## A ficha que o prompt trava

O prompt descreve o A319-100 como ele é, e os pontos abaixo são o que separa um
A319 de um narrow-body genérico. Ao regerar, mantenha todos:

- **Envergadura maior que o comprimento** — 34,1 m contra 33,84 m. É a proporção
  atarracada que identifica o A319; o erro comum da IA é desenhar um narrow-body
  longo e esbelto.
- **Uma única saída sobre a asa por lado.** O A320 tem duas. É o marcador mais
  confiável da variante, e o que o guia de spotting usa.
- **Duas portas plenas por lado**, uma atrás do cockpit e uma antes do cone.
- **Treze janelas** à frente da saída sobre a asa.
- **Wingtip fence** — superfície triangular curta para cima *e* para baixo, não
  sharklet curvado nem winglet grande. Sharklet é do A319neo.
- **Entrada da nacela perfeitamente circular** (CFM56-5B, fan de 1,73 m). Nacela
  achatada embaixo é do 737, e é o engano mais frequente.
- **Radome arredondado e levemente caído**, seis janelas de cockpit.

Dimensões conferidas contra `src/game/data/aircraft.ts`, que por sua vez saiu
das fichas do fabricante.

## Como regerar

```bash
export MESHY_API_KEY=msy_...
node .claude/skills/meshy-assets/scripts/meshy.mjs gen \
  assets/aircraft/a319/catalogo.json --out assets/aircraft/a319 --force
```
