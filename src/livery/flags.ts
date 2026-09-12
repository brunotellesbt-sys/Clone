/**
 * Bandeiras de país, desenhadas em vetor e **simplificadas de propósito**.
 *
 * A bandeira aparece do lado do prefixo, com uns 20px de altura na tela. Nessa
 * escala ninguém distingue as vinte e sete estrelas da faixa do Brasil nem as
 * cinquenta do cantão dos Estados Unidos, e tentar desenhá-las custaria muito
 * arquivo para virar um borrão. Então cada bandeira sai reduzida ao que a
 * identifica no tamanho em que ela é vista: campo, divisões e um símbolo
 * central quando ele é a marca da bandeira.
 *
 * Nenhuma imagem de terceiro entra aqui — é a mesma regra do resto do projeto.
 * Bandeira nacional é símbolo de estado, não obra de autor, e o desenho abaixo
 * é feito no próprio jogo, a partir das proporções e cores oficiais.
 *
 * Sem entrada para o país, não há bandeira: o controle simplesmente não oferece
 * nada, que é melhor do que oferecer a bandeira errada.
 */

/** Uma faixa do campo, em fração da altura (horizontal) ou largura (vertical). */
interface Faixa {
  cor: string
  /** Fração do lado dividido. Somadas, as faixas fecham 1. */
  parte: number
}

export interface Flag {
  /** Fundo, quando as faixas não cobrem tudo. */
  campo?: string
  faixas?: Faixa[]
  /** Faixas verticais em vez de horizontais. */
  vertical?: boolean
  /** Disco central: cor e raio em fração da altura. */
  disco?: { cor: string; r: number }
  /** Losango central: cor e meia-largura em fração da largura. */
  losango?: { cor: string; w: number }
  /** Cantão no topo do lado da haste: cor e tamanho em fração. */
  cantao?: { cor: string; w: number; h: number }
  /** Cruz centrada (escandinava quando `off` desloca para a haste). */
  cruz?: { cor: string; e: number; off?: number }
  /** Estrela de cinco pontas no centro do disco ou do campo. */
  estrela?: { cor: string; r: number }
}

const TRI = (a: string, b: string, c: string): Flag => ({
  faixas: [{ cor: a, parte: 1 / 3 }, { cor: b, parte: 1 / 3 }, { cor: c, parte: 1 / 3 }],
})
const TRI_V = (a: string, b: string, c: string): Flag => ({ ...TRI(a, b, c), vertical: true })
const BI = (a: string, b: string): Flag => ({
  faixas: [{ cor: a, parte: 0.5 }, { cor: b, parte: 0.5 }],
})

/**
 * Uma entrada por país presente no catálogo de aeroportos. Cores oficiais
 * quando publicadas; a divisão é sempre a de verdade.
 */
export const FLAGS: Record<string, Flag> = {
  // ---- Américas
  BR: { campo: '#009b3a', losango: { cor: '#fedf00', w: 0.42 }, disco: { cor: '#002776', r: 0.22 } },
  AR: {
    faixas: [{ cor: '#74acdf', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#74acdf', parte: 1 / 3 }],
    disco: { cor: '#f6b40e', r: 0.13 },
  },
  CL: { faixas: [{ cor: '#fff', parte: 0.5 }, { cor: '#d52b1e', parte: 0.5 }], cantao: { cor: '#0039a6', w: 0.33, h: 0.5 }, estrela: { cor: '#fff', r: 0.16 } },
  PE: TRI_V('#d91023', '#fff', '#d91023'),
  CO: { faixas: [{ cor: '#fcd116', parte: 0.5 }, { cor: '#003893', parte: 0.25 }, { cor: '#ce1126', parte: 0.25 }] },
  EC: { faixas: [{ cor: '#ffdd00', parte: 0.5 }, { cor: '#034ea2', parte: 0.25 }, { cor: '#ed1c24', parte: 0.25 }] },
  VE: TRI('#ffcc00', '#00247d', '#cf142b'),
  BO: TRI('#d52b1e', '#f9e300', '#007934'),
  PY: TRI('#d52b1e', '#fff', '#0038a8'),
  UY: { campo: '#fff', faixas: [{ cor: '#fff', parte: 0.5 }, { cor: '#0038a8', parte: 0.11 }, { cor: '#fff', parte: 0.11 }, { cor: '#0038a8', parte: 0.11 }, { cor: '#fff', parte: 0.11 }, { cor: '#0038a8', parte: 0.06 }], cantao: { cor: '#fff', w: 0.4, h: 0.5 } },
  MX: TRI_V('#006847', '#fff', '#ce1126'),
  PA: { campo: '#fff', cantao: { cor: '#fff', w: 0.5, h: 0.5 }, faixas: [{ cor: '#fff', parte: 0.5 }, { cor: '#fff', parte: 0.5 }], estrela: { cor: '#005293', r: 0.14 } },
  CU: { faixas: [{ cor: '#002a8f', parte: 0.2 }, { cor: '#fff', parte: 0.2 }, { cor: '#002a8f', parte: 0.2 }, { cor: '#fff', parte: 0.2 }, { cor: '#002a8f', parte: 0.2 }], cantao: { cor: '#cf142b', w: 0.38, h: 1 }, estrela: { cor: '#fff', r: 0.13 } },
  US: { faixas: [{ cor: '#b22234', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#b22234', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#b22234', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#b22234', parte: 1 / 7 }], cantao: { cor: '#3c3b6e', w: 0.4, h: 0.54 } },
  PR: { faixas: [{ cor: '#ed0000', parte: 0.2 }, { cor: '#fff', parte: 0.2 }, { cor: '#ed0000', parte: 0.2 }, { cor: '#fff', parte: 0.2 }, { cor: '#ed0000', parte: 0.2 }], cantao: { cor: '#0050f0', w: 0.38, h: 1 }, estrela: { cor: '#fff', r: 0.13 } },
  CA: { faixas: [{ cor: '#ff0000', parte: 0.25 }, { cor: '#fff', parte: 0.5 }, { cor: '#ff0000', parte: 0.25 }], vertical: true, losango: { cor: '#ff0000', w: 0.16 } },
  CR: { faixas: [{ cor: '#002b7f', parte: 0.2 }, { cor: '#fff', parte: 0.15 }, { cor: '#ce1126', parte: 0.3 }, { cor: '#fff', parte: 0.15 }, { cor: '#002b7f', parte: 0.2 }] },
  DO: { campo: '#002d62', cruz: { cor: '#fff', e: 0.16 } },
  GT: TRI_V('#4997d0', '#fff', '#4997d0'),
  SV: TRI('#0f47af', '#fff', '#0f47af'),
  HN: TRI('#0073cf', '#fff', '#0073cf'),
  NI: TRI('#0067c6', '#fff', '#0067c6'),
  JM: { campo: '#009b3a', cruz: { cor: '#fed100', e: 0.16 } },
  TT: { campo: '#ce1126' },
  BS: { faixas: [{ cor: '#00abc9', parte: 1 / 3 }, { cor: '#fae042', parte: 1 / 3 }, { cor: '#00abc9', parte: 1 / 3 }] },

  // ---- Europa
  GB: { campo: '#012169', cruz: { cor: '#c8102e', e: 0.18 } },
  IE: TRI_V('#169b62', '#fff', '#ff883e'),
  FR: TRI_V('#002395', '#fff', '#ed2939'),
  ES: { faixas: [{ cor: '#aa151b', parte: 0.25 }, { cor: '#f1bf00', parte: 0.5 }, { cor: '#aa151b', parte: 0.25 }] },
  PT: { faixas: [{ cor: '#046a38', parte: 0.4 }, { cor: '#da291c', parte: 0.6 }], vertical: true, disco: { cor: '#f1bf00', r: 0.2 } },
  DE: TRI('#000', '#dd0000', '#ffce00'),
  IT: TRI_V('#009246', '#fff', '#ce2b37'),
  NL: TRI('#ae1c28', '#fff', '#21468b'),
  BE: TRI_V('#000', '#fdda24', '#ef3340'),
  CH: { campo: '#ff0000', cruz: { cor: '#fff', e: 0.2 } },
  AT: TRI('#ed2939', '#fff', '#ed2939'),
  DK: { campo: '#c8102e', cruz: { cor: '#fff', e: 0.18, off: -0.08 } },
  SE: { campo: '#006aa7', cruz: { cor: '#fecc00', e: 0.18, off: -0.08 } },
  NO: { campo: '#ba0c2f', cruz: { cor: '#fff', e: 0.24, off: -0.08 } },
  FI: { campo: '#fff', cruz: { cor: '#002f6c', e: 0.18, off: -0.08 } },
  IS: { campo: '#02529c', cruz: { cor: '#fff', e: 0.22, off: -0.08 } },
  PL: BI('#fff', '#dc143c'),
  CZ: BI('#fff', '#d7141a'),
  HU: TRI('#cd2a3e', '#fff', '#436f4d'),
  RO: TRI_V('#002b7f', '#fcd116', '#ce1126'),
  GR: { faixas: [{ cor: '#0d5eaf', parte: 0.22 }, { cor: '#fff', parte: 0.22 }, { cor: '#0d5eaf', parte: 0.22 }, { cor: '#fff', parte: 0.22 }, { cor: '#0d5eaf', parte: 0.12 }], cantao: { cor: '#0d5eaf', w: 0.4, h: 0.55 } },
  RU: TRI('#fff', '#0039a6', '#d52b1e'),
  UA: BI('#0057b7', '#ffd700'),
  TR: { campo: '#e30a17', disco: { cor: '#fff', r: 0.2 } },
  HR: TRI('#ff0000', '#fff', '#171796'),
  RS: TRI('#c6363c', '#0c4076', '#fff'),
  BG: TRI('#fff', '#00966e', '#d62612'),
  SK: TRI('#fff', '#0b4ea2', '#ee1c25'),
  SI: TRI('#fff', '#005ce6', '#ed1c24'),
  EE: TRI('#0072ce', '#000', '#fff'),
  LV: { faixas: [{ cor: '#9e3039', parte: 0.4 }, { cor: '#fff', parte: 0.2 }, { cor: '#9e3039', parte: 0.4 }] },
  LT: TRI('#fdb913', '#006a44', '#c1272d'),
  LU: TRI('#ed2939', '#fff', '#00a1de'),
  MT: BI('#fff', '#cf142b'),
  CY: { campo: '#fff' },

  // ---- África e Oriente Médio
  MA: { campo: '#c1272d', estrela: { cor: '#006233', r: 0.26 } },
  DZ: { faixas: [{ cor: '#006233', parte: 0.5 }, { cor: '#fff', parte: 0.5 }], vertical: true, estrela: { cor: '#d21034', r: 0.2 } },
  TN: { campo: '#e70013', disco: { cor: '#fff', r: 0.28 }, estrela: { cor: '#e70013', r: 0.16 } },
  EG: { faixas: [{ cor: '#ce1126', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#000', parte: 1 / 3 }] },
  ZA: { faixas: [{ cor: '#e03c31', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#001489', parte: 1 / 3 }], cantao: { cor: '#007749', w: 0.34, h: 1 } },
  NG: TRI_V('#008751', '#fff', '#008751'),
  GH: TRI('#ce1126', '#fcd116', '#006b3f'),
  ET: TRI('#078930', '#fcdd09', '#da121a'),
  KE: { faixas: [{ cor: '#000', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#006600', parte: 1 / 3 }], losango: { cor: '#bb0000', w: 0.3 } },
  TZ: TRI('#1eb53a', '#000', '#00a3dd'),
  MU: { faixas: [{ cor: '#ea2839', parte: 0.25 }, { cor: '#1a206d', parte: 0.25 }, { cor: '#ffd500', parte: 0.25 }, { cor: '#00a551', parte: 0.25 }] },
  AO: { faixas: [{ cor: '#ce1126', parte: 0.5 }, { cor: '#000', parte: 0.5 }] },
  SN: TRI_V('#00853f', '#fdef42', '#e31b23'),
  CI: TRI_V('#f77f00', '#fff', '#009e60'),
  CM: TRI_V('#007a5e', '#ce1126', '#fcd116'),
  AE: { faixas: [{ cor: '#00732f', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#000', parte: 1 / 3 }], cantao: { cor: '#ff0000', w: 0.26, h: 1 } },
  SA: { campo: '#006c35' },
  QA: { faixas: [{ cor: '#8d1b3d', parte: 1 }], cantao: { cor: '#fff', w: 0.3, h: 1 } },
  KW: { faixas: [{ cor: '#007a3d', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#ce1126', parte: 1 / 3 }], cantao: { cor: '#000', w: 0.26, h: 1 } },
  BH: { campo: '#ce1126', cantao: { cor: '#fff', w: 0.38, h: 1 } },
  OM: { faixas: [{ cor: '#fff', parte: 1 / 3 }, { cor: '#db161b', parte: 1 / 3 }, { cor: '#008000', parte: 1 / 3 }], cantao: { cor: '#db161b', w: 0.28, h: 1 } },
  IL: { campo: '#fff', faixas: [{ cor: '#fff', parte: 0.16 }, { cor: '#0038b8', parte: 0.14 }, { cor: '#fff', parte: 0.4 }, { cor: '#0038b8', parte: 0.14 }, { cor: '#fff', parte: 0.16 }] },
  JO: { faixas: [{ cor: '#000', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#007a3d', parte: 1 / 3 }], cantao: { cor: '#ce1126', w: 0.34, h: 1 } },
  LB: { faixas: [{ cor: '#ed1c24', parte: 0.25 }, { cor: '#fff', parte: 0.5 }, { cor: '#ed1c24', parte: 0.25 }] },
  IR: TRI('#239f40', '#fff', '#da0000'),
  IQ: TRI('#ce1126', '#fff', '#000'),

  // ---- Ásia e Oceania
  CN: { campo: '#de2910', cantao: { cor: '#de2910', w: 0.5, h: 0.5 }, estrela: { cor: '#ffde00', r: 0.2 } },
  HK: { campo: '#de2910', estrela: { cor: '#fff', r: 0.22 } },
  TW: { campo: '#fe0000', cantao: { cor: '#000095', w: 0.5, h: 0.5 }, estrela: { cor: '#fff', r: 0.12 } },
  JP: { campo: '#fff', disco: { cor: '#bc002d', r: 0.3 } },
  KR: { campo: '#fff', disco: { cor: '#cd2e3a', r: 0.2 } },
  IN: { faixas: [{ cor: '#ff9933', parte: 1 / 3 }, { cor: '#fff', parte: 1 / 3 }, { cor: '#138808', parte: 1 / 3 }], disco: { cor: '#000080', r: 0.14 } },
  PK: { faixas: [{ cor: '#01411c', parte: 1 }], cantao: { cor: '#fff', w: 0.25, h: 1 } },
  BD: { campo: '#006a4e', disco: { cor: '#f42a41', r: 0.28 } },
  LK: { campo: '#eb7400' },
  NP: { campo: '#dc143c' },
  TH: { faixas: [{ cor: '#a51931', parte: 1 / 6 }, { cor: '#f4f5f8', parte: 1 / 6 }, { cor: '#2d2a4a', parte: 1 / 3 }, { cor: '#f4f5f8', parte: 1 / 6 }, { cor: '#a51931', parte: 1 / 6 }] },
  VN: { campo: '#da251d', estrela: { cor: '#ffff00', r: 0.28 } },
  MY: { faixas: [{ cor: '#cc0001', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#cc0001', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#cc0001', parte: 1 / 7 }, { cor: '#fff', parte: 1 / 7 }, { cor: '#cc0001', parte: 1 / 7 }], cantao: { cor: '#010066', w: 0.5, h: 0.54 } },
  SG: { faixas: [{ cor: '#ed2939', parte: 0.5 }, { cor: '#fff', parte: 0.5 }], disco: { cor: '#fff', r: 0.16 } },
  ID: BI('#ff0000', '#fff'),
  PH: { faixas: [{ cor: '#0038a8', parte: 0.5 }, { cor: '#ce1126', parte: 0.5 }], cantao: { cor: '#fff', w: 0.34, h: 1 } },
  MM: TRI('#fecb00', '#34b233', '#ea2839'),
  KH: { faixas: [{ cor: '#032ea1', parte: 0.25 }, { cor: '#e00025', parte: 0.5 }, { cor: '#032ea1', parte: 0.25 }] },
  KZ: { campo: '#00afca', disco: { cor: '#fec50c', r: 0.2 } },
  UZ: TRI('#0099b5', '#fff', '#1eb53a'),
  AU: { campo: '#012169', cantao: { cor: '#012169', w: 0.5, h: 0.5 }, estrela: { cor: '#fff', r: 0.14 } },
  NZ: { campo: '#00247d', cantao: { cor: '#00247d', w: 0.5, h: 0.5 }, estrela: { cor: '#cc142b', r: 0.12 } },
  FJ: { campo: '#68bfe5', cantao: { cor: '#68bfe5', w: 0.5, h: 0.5 } },
  PF: { faixas: [{ cor: '#ce1126', parte: 0.25 }, { cor: '#fff', parte: 0.5 }, { cor: '#ce1126', parte: 0.25 }], disco: { cor: '#083d9c', r: 0.14 } },
  NC: TRI('#009543', '#ed4135', '#0035ad'),
  GU: { campo: '#002868', disco: { cor: '#d7192d', r: 0.22 } },

  // ---- Cáucaso e Ásia Central
  GE: { campo: '#fff', cruz: { cor: '#ff0000', e: 0.16 } },
  AM: TRI('#d90012', '#0033a0', '#f2a800'),
  AZ: TRI('#0092bc', '#e4002b', '#00af66'),
  LA: { faixas: [{ cor: '#ce1126', parte: 0.25 }, { cor: '#002868', parte: 0.5 }, { cor: '#ce1126', parte: 0.25 }], disco: { cor: '#fff', r: 0.18 } },
  MO: { campo: '#00785e' },
  AL: { campo: '#e41e20' },
  ZM: { campo: '#198a00' },
  BB: TRI_V('#00267f', '#ffc726', '#00267f'),
  CW: { faixas: [{ cor: '#002b7f', parte: 0.66 }, { cor: '#f9e814', parte: 0.14 }, { cor: '#002b7f', parte: 0.2 }], estrela: { cor: '#fff', r: 0.12 } },
  AW: { faixas: [{ cor: '#418fde', parte: 0.66 }, { cor: '#f9e814', parte: 0.1 }, { cor: '#418fde', parte: 0.14 }, { cor: '#f9e814', parte: 0.1 }], estrela: { cor: '#ef3340', r: 0.14 } },
  // Reunião vota e voa com a bandeira francesa.
  RE: TRI_V('#002395', '#fff', '#ed2939'),
}

/**
 * Uns poucos países do catálogo de aeroportos ficaram **sem** bandeira, e de
 * propósito: Namíbia, Seicheles, Maldivas, Sint Maarten, Uganda, Ruanda,
 * Zimbábue, Madagascar e Moçambique têm desenho que este renderizador não
 * reproduz sem inventar (faixa diagonal, sol raiado, emblema central), e
 * bandeira errada é pior que bandeira nenhuma. Nenhum deles é base inicial —
 * a bandeira sai do país da base —, então na prática nenhuma aeronave do jogo
 * pede uma dessas hoje.
 */

export const temBandeira = (cc: string) => !!FLAGS[cc]
