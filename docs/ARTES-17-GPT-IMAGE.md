# Os 17 perfis sem base no ZIP

Os cinco aviões de passageiros e doze cargueiros abaixo foram regenerados com
o gerador de imagens integrado ao Codex em setembro de 2026. O gerador escolhe
automaticamente o modelo GPT Image disponível e não expõe o identificador da
versão no resultado; por isso este registro não atribui um número de modelo.

Todos os prompts pediram **um único avião**, perfil lateral ortográfico com
nariz para a esquerda, avião inteiro centralizado, pintura branca sem companhia,
fundo branco sólido, trem estendido, detalhes discretos e ausência de texto,
logotipo e sombra. Os prompts de cargueiro também exigiram porta de carga e
ausência de fileira de janelas de passageiros. Cada modelo teve uma geração
separada. O fundo do Tu-204-100C e do 767-300BDSF foi corrigido em uma edição
posterior que preservou o avião; o An-225 teve uma segunda geração para deixar
três naceles visíveis na asa próxima e a cauda dupla.

| Modelo | Distinções pedidas no prompt | Sprite final |
|---|---|---|
| An-148 | asa alta, dois motores sob a asa, cauda T | `public/sprites/aircraft/an148.png` |
| An-158 | fuselagem regional alongada, asa alta, cauda T | `public/sprites/aircraft/an158.png` |
| Il-96-300 | widebody de quatro motores e asa baixa | `public/sprites/aircraft/il96.png` |
| SJ-100 | jato regional com dois PD-8 sob a asa | `public/sprites/aircraft/sj100.png` |
| Tu-204-100 | narrowbody longo, winglets e trem principal de seis rodas | `public/sprites/aircraft/tu204.png` |
| ATR 72-600F | asa alta, hélices de seis pás, cauda T | `public/sprites/freighters/atr72f.png` |
| 737-800BCF | fuselagem estreita convertida e porta dianteira de carga | `public/sprites/freighters/b737f.png` |
| A321P2F | fuselagem alongada, sharklets e porta de carga | `public/sprites/freighters/a321f.png` |
| 757-200PCF | fuselagem longa, dois turbofans e porta dianteira | `public/sprites/freighters/b752f.png` |
| Tu-204-100C | winglets, trem de seis rodas e porão de carga | `public/sprites/freighters/tu204f.png` |
| 767-300BDSF | widebody bimotor convertido | `public/sprites/freighters/b763f.png` |
| A330-200F | cargueiro de fábrica, dois motores e piso de carga | `public/sprites/freighters/a332f.png` |
| Il-96-400T | cargueiro alongado de quatro motores | `public/sprites/freighters/il96f.png` |
| 747-8F | quatro motores e convés superior curto | `public/sprites/freighters/b748f.png` |
| An-124-100 | asa alta, quatro motores e trem pesado | `public/sprites/freighters/an124.png` |
| An-225 | seis motores no total, três visíveis em perfil, cauda dupla | `public/sprites/freighters/an225.png` |
| BelugaXL | fuselagem superior volumosa e cabine abaixo dela | `public/sprites/freighters/belugaxl.png` |

As 17 silhuetas de pintura foram recalculadas a partir das imagens finais em
`public/sprites/planemasks/`. Os cinco passageiros receberam setores de
pintura realinhados por `scripts/realign-regenerated-masks.py`, janelas
extraídas da arte nova e novas alturas de fuselagem em `fusebands.json`.
Esses perfis usam a oficina de pintura por sprite. Os 63 modelos com base no
ZIP continuam usando a oficina de camadas originais.

As imagens são arte de jogo e precisam de revisão humana antes de serem usadas
como desenho técnico ou referência de configuração real de aeronave.
