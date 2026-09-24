# Os 17 perfis sem base no ZIP

Os cinco aviões de passageiros e doze cargueiros abaixo foram regenerados com
o gerador de imagens integrado ao Codex em setembro de 2026. O gerador escolhe
automaticamente o modelo GPT Image disponível e não expõe o identificador da
versão no resultado; por isso este registro não atribui um número de modelo.

Todos os prompts pediram **um único avião**, perfil lateral com nariz para a
esquerda, pintura branca sem companhia, trem totalmente recolhido, sem texto
ou logotipo. Os cargueiros não recebem fileira de janelas de passageiros.
Cada modelo teve uma geração separada e foi comparado com os perfis que já
estavam resolvidos no jogo. O SJ-100 foi encurtado para proporções de jato
regional; o ATR 72-600F passou a ter apenas a hélice da asa próxima em destaque;
o An-124 mostra duas naceles na asa próxima, das quatro totais; e o 747-8F
recebeu o convés superior curto característico. O An-225 mantém três naceles
na asa próxima, das seis totais, e cauda dupla.

| Modelo | Distinções pedidas no prompt | Sprite final |
|---|---|---|
| An-148 | asa alta, dois motores sob a asa, cauda T | `public/sprites/aircraft/an148.png` |
| An-158 | fuselagem regional alongada, asa alta, cauda T | `public/sprites/aircraft/an158.png` |
| Il-96-300 | widebody de quatro motores e asa baixa | `public/sprites/aircraft/il96.png` |
| SJ-100 | jato regional com dois PD-8 sob a asa | `public/sprites/aircraft/sj100.png` |
| Tu-204-100 | narrowbody longo, winglets e trem recolhido | `public/sprites/aircraft/tu204.png` |
| ATR 72-600F | asa alta, hélices de seis pás, cauda T | `public/sprites/freighters/atr72f.png` |
| 737-800BCF | fuselagem estreita convertida e porta dianteira de carga | `public/sprites/freighters/b737f.png` |
| A321P2F | fuselagem alongada, sharklets e porta de carga | `public/sprites/freighters/a321f.png` |
| 757-200PCF | fuselagem longa, dois turbofans e porta dianteira | `public/sprites/freighters/b752f.png` |
| Tu-204-100C | winglets, trem recolhido e porta de carga | `public/sprites/freighters/tu204f.png` |
| 767-300BDSF | widebody bimotor convertido | `public/sprites/freighters/b763f.png` |
| A330-200F | cargueiro de fábrica, dois motores e piso de carga | `public/sprites/freighters/a332f.png` |
| Il-96-400T | cargueiro alongado de quatro motores | `public/sprites/freighters/il96f.png` |
| 747-8F | quatro motores e convés superior curto | `public/sprites/freighters/b748f.png` |
| An-124-100 | asa alta, quatro motores no total e trem recolhido | `public/sprites/freighters/an124.png` |
| An-225 | seis motores no total, três visíveis em perfil, cauda dupla | `public/sprites/freighters/an225.png` |
| BelugaXL | fuselagem superior volumosa e cabine abaixo dela | `public/sprites/freighters/belugaxl.png` |

As 17 silhuetas e máscaras de fuselagem, cauda, motores e trem foram
recalculadas das imagens finais por `scripts/build-generated-2d.py`. A máscara
de trem é vazia em todos os 17 modelos. Cada perfil ganhou 15 camadas de
pintura, incluindo padrões de cauda e fuselagem derivados das camadas do A320
fornecidas no ZIP, além do acabamento que preserva janelas, portas e sombras.
Os 63 modelos com base no ZIP continuam usando suas camadas originais.

O `apk_contents.zip` fornecido depois contém fotos dos 28 modelos de poltrona
e ícones de fileiras. Esses recursos já estavam preservados no acervo do
projeto; o código da alocação do aplicativo antigo está compilado no bundle
Hermes, não em arquivos-fonte. A interface de alocação foi reimplementada no
jogo com as artes de fileira correspondentes, limite de saídas e cálculo de
espaço da cabine.

Na revisão das silhuetas, foram consultadas as fichas do
[SJ-100](https://eng.yakovlev.ru/products/sj-100/),
[ATR 72-600F](https://www.atr-aircraft.com/regional-mobility/regional-aircraft/atr-72-600f-freighter/),
[747-8](https://www.boeing.com/commercial/747-8),
[An-124](https://www.antonov.com/en/file/V5hQc2hGrJGRs) e
[An-225](https://www.antonov.com/en/file/V5hQc2hGrJGRs?inline=1).

A [galeria de pintura simulada](images/pintura-simulada-17.png) mostra os 17
perfis pelo renderizador real do jogo, usando o preset Bandeirante e o letreiro
fictício AERO BRASIL. Para recriá-la, execute o servidor Vite e depois
`node scripts/painted-17-preview.mjs`. A galeria não altera partidas salvas.

As imagens são arte de jogo e precisam de revisão humana antes de serem usadas
como desenho técnico ou referência de configuração real de aeronave.
