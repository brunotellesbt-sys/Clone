/**
 * Quanto o tráfego aéreo de cada país cresce por ano, em porcento.
 *
 * O jogo fazia o mundo inteiro crescer na mesma taxa — `1 + dia * 0.00012`, um
 * número só para 233 países. Nessa conta Tóquio e Lagos crescem igual, e o mapa
 * de 2050 é o de 2027 com todo mundo 10% maior. Isso não é simulação de mundo:
 * é um multiplicador.
 *
 * ## De onde vem
 *
 * Duas séries do Banco Mundial, de 2015 a 2024, em `scripts/crescimento.py`
 * (`npm run crescimento`):
 *
 * - `SP.POP.GROW` — crescimento populacional anual;
 * - `NY.GDP.PCAP.KD.ZG` — crescimento do PIB per capita real.
 *
 * Tráfego aéreo não cresce na taxa do PIB: cresce mais, porque passagem é bem
 * superior — quem enriquece voa mais do que proporcionalmente. A elasticidade
 * que ICAO e IATA usam fica entre 1,3 e 2,0; aqui é **1,4**, um valor único e
 * conservador.
 *
 *     taxa = crescimento da população + 1,4 × crescimento do PIB per capita
 *
 * Cada série entra como **média aparada**: descartados o melhor e o pior ano, a
 * média do resto. A janela tem a pandemia dentro, e ela conta duas vezes — o
 * tombo de 2020 e a retomada de 2021, medida sobre a base já afundada. Nenhum
 * dos dois é tendência.
 *
 * Mediana não resolve, e vale registrar porque foi a primeira tentativa: com
 * dez anos ela descarta o tombo, que fica na cauda de baixo, e mantém um ano de
 * retomada no meio da ordenação. A média mundial **subiu** de 2,81% para 3,26%
 * em vez de cair. Aparar as duas pontas tira um episódio de cada lado, que é
 * exatamente o que se queria remover.
 *
 * O resultado é comprimido entre −1,5% e +5,5% ao ano. Não é decoração: os
 * extremos da janela são episódio — guerra, boom de petróleo, recuperação de
 * colapso —, e projetar episódio por décadas é o que faz simulação virar ficção
 * científica.
 *
 * A compressão tem joelho, e não é um `min`: com corte duro em 5,5, China,
 * Bangladesh, Chipre e a República Dominicana saíam todos em exatamente 5,50 —
 * o teto cumpria o objetivo dele e destruía a ordem entre os quatro, que é o
 * que o jogo lê. Até 70% do caminho a função é a identidade; dali em diante ela
 * se aproxima do limite sem encostar.
 *
 * ## Onde isto cai
 *
 * A média mundial dá **+3,09% ao ano**. O que interessa não é a média, é o
 * espalhamento, e ele bate com as previsões de vinte anos que Boeing e Airbus
 * publicam:
 *
 * | país | pop | PIB/hab | tráfego | 30 anos |
 * |---|---|---|---|---|
 * | China | +0,27 | +5,56 | **+5,37%/ano** | 4,80× |
 * | Índia | +1,01 | +5,81 | **+5,43%/ano** | 4,89× |
 * | EUA | +0,65 | +1,90 | **+3,30%/ano** | 2,65× |
 * | Alemanha | +0,28 | +0,78 | **+1,37%/ano** | 1,51× |
 * | Japão | −0,26 | +1,04 | **+1,20%/ano** | 1,43× |
 * | Brasil | +0,58 | +0,36 | **+1,08%/ano** | 1,38× |
 * | Venezuela | — | — | **−1,50%/ano** | 0,63× |
 *
 * ## O que isto não é
 *
 * **Não é projeção.** É o que aconteceu, levado para a frente. O limite honesto
 * disso é que um país que acabou de sair de uma crise carrega a recuperação
 * como se fosse tendência, e nenhum número aqui sabe de uma decisão que ainda
 * não foi tomada. Serve para dar ao mundo do jogo uma direção plausível, não
 * para acertar 2050.
 */

const RAW = `
AE:3.25 AF:-0.39 AG:4.88 AL:4.93 AM:5.31 AO:-0.50 AR:-0.03 AS:1.61 AT:2.00
AU:2.72 AW:5.19 AZ:1.86 BA:4.74 BB:2.47 BD:5.40 BE:2.35 BF:4.89 BG:4.51
BH:3.23 BI:3.25 BJ:5.23 BM:2.53 BN:0.26 BO:3.36 BR:1.08 BS:3.57 BT:5.19
BW:2.78 BY:1.22 BZ:2.44 CA:2.21 CD:4.84 CF:2.84 CG:-1.47 CH:2.14 CI:5.35
CL:2.13 CM:3.98 CN:5.37 CO:3.25 CR:4.77 CU:0.94 CV:5.22 CW:0.78 CY:5.29
CZ:3.61 DE:1.37 DJ:5.31 DK:2.55 DM:1.82 DO:5.24 DZ:3.05 EC:1.57 EE:2.29
EG:4.75 ER:1.39 ES:4.28 ET:5.44 FI:1.25 FJ:4.15 FM:1.87 FO:3.28 FR:2.13
GA:2.00 GB:2.46 GD:4.83 GE:5.41 GH:4.85 GI:1.84 GL:1.51 GM:4.98 GN:5.28
GQ:-1.50 GR:2.83 GT:4.21 GU:1.74 GW:4.97 GY:5.50 HK:1.38 HN:4.39 HR:4.92
HT:-1.32 HU:4.37 ID:5.14 IE:5.44 IL:3.90 IM:0.49 IN:5.43 IQ:2.05 IR:3.29
IS:4.32 IT:2.03 JM:3.12 JO:1.96 JP:1.20 KE:5.01 KG:5.24 KH:5.38 KI:5.08
KM:2.81 KN:2.34 KP:0.41 KR:3.58 KW:-0.25 KY:4.42 KZ:4.14 LA:5.08 LB:-1.50
LC:4.60 LK:2.25 LR:1.45 LS:0.76 LT:4.54 LU:1.38 LV:2.91 LY:4.07 MA:3.88
MD:3.18 ME:5.11 MG:4.30 MH:3.85 MK:4.05 ML:4.80 MM:3.16 MN:4.79 MO:0.16
MP:4.52 MR:4.55 MT:5.39 MU:4.95 MV:5.42 MW:2.86 MX:2.40 MY:4.95 MZ:3.56
NA:1.64 NC:-0.81 NE:5.01 NG:1.55 NI:3.00 NL:2.71 NO:2.09 NP:5.01 NR:2.51
NZ:2.97 OM:1.89 PA:5.23 PE:3.19 PF:3.22 PG:3.71 PH:5.38 PK:4.54 PL:4.90
PR:-0.03 PT:3.97 PW:0.20 PY:3.53 QA:0.89 RO:4.72 RS:4.76 RU:2.13 RW:5.45
SA:3.76 SB:1.00 SC:4.26 SD:-1.50 SE:2.17 SG:3.22 SI:4.26 SK:3.65 SL:4.42
SN:5.19 SO:4.68 SR:-0.62 SS:-1.50 ST:2.48 SV:3.54 SX:0.81 SY:-0.23 SZ:3.06
TC:5.50 TD:1.80 TG:5.13 TH:3.81 TJ:5.44 TL:0.05 TM:5.35 TN:1.88 TO:1.73
TR:5.04 TT:-1.46 TV:4.24 TZ:5.12 UA:0.10 UG:4.87 US:3.30 UY:2.31 UZ:5.37
VC:4.06 VE:-1.50 VG:1.97 VI:0.95 VN:5.39 VU:3.45 WS:3.27 XK:5.36 YE:-1.50
ZA:0.97 ZM:3.97 ZW:2.72
`

/**
 * Taxa anual de cada país, já em fração (0.0114 = +1,14% ao ano).
 * Países fora da tabela caem na média mundial.
 */
export const CRESCIMENTO: Record<string, number> = Object.fromEntries(
  RAW.trim()
    .split(/\s+/)
    .map((par) => {
      const [cc, v] = par.split(':')
      return [cc, Number(v) / 100]
    }),
)

/**
 * O que um país fora da tabela cresce.
 *
 * É a média dos que estão nela, e não zero: zero diria "este país não cresce",
 * que é uma afirmação, enquanto a média diz "não sei deste, fica no comum" —
 * que é a verdade.
 */
export const CRESCIMENTO_PADRAO = (() => {
  const v = Object.values(CRESCIMENTO)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0.021
})()

export const crescimentoDe = (cc: string) => CRESCIMENTO[cc] ?? CRESCIMENTO_PADRAO

/**
 * Amplitude do ciclo, e o período dele em anos.
 *
 * Um país não sobe em linha reta: ele tem ano bom e ano ruim, e é isso que dá
 * a um jogo de trinta anos a sensação de mundo em vez de planilha. Oito por
 * cento para cada lado da tendência é o bastante para o jogador perceber — uma
 * rota de 10 mil passageiros varia 800 — e pouco o bastante para nunca inverter
 * o sinal da tendência: nenhum país fica rico numa oscilação nem quebra numa.
 *
 * O período varia de 9 a 15 anos por país, para os ciclos não baterem todos
 * juntos e o mundo inteiro subir e descer em uníssono, que seria pior do que
 * não ter ciclo nenhum.
 */
const AMPLITUDE = 0.08
const PERIODO_MIN = 9
const PERIODO_MAX = 15

/** Número estável de 0 a 1 a partir do código do país. */
function semente(cc: string): number {
  let h = 2166136261
  for (let i = 0; i < cc.length; i++) {
    h ^= cc.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Quanto o mercado de um país vale hoje, em relação ao dia 1.
 *
 * Tendência composta mais ciclo. O ciclo é **ancorado no dia 1**: a fase é
 * descontada de si mesma, então `derivaDoPais(cc, 0)` vale exatamente 1 para
 * todo país. Isso não é capricho — os fatores de equilíbrio do fluxo em
 * `movimento.ts` são calculados no dia 1, e um país que já começasse 6% acima
 * da tendência faria a tabela de Furness nascer desalinhada com o jogo.
 */
export function derivaDoPais(cc: string, day: number): number {
  const anos = day / 365
  const s = semente(cc)
  const periodo = PERIODO_MIN + (PERIODO_MAX - PERIODO_MIN) * s
  const fase = 2 * Math.PI * s
  const ciclo = Math.sin((2 * Math.PI * anos) / periodo + fase) - Math.sin(fase)
  return Math.pow(1 + crescimentoDe(cc), anos) * (1 + AMPLITUDE * ciclo)
}
