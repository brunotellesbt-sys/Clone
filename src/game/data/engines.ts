// Motorização. As designações são reais e correspondem ao que cada fabricante
// oferece (ou ofereceu) de fábrica para o modelo. Os números são relativos ao
// motor de referência daquela aeronave: 1,00 é o consumo de catálogo do tipo.
//
// As diferenças refletem o que se sabe da operação: o GTF da Pratt é mais
// silencioso e um pouco mais econômico, mas passou anos com problema de
// durabilidade e oficina cheia; o LEAP gasta um pouco mais e incomoda menos a
// manutenção. Empuxo maior dentro da mesma família compra pista curta, altitude
// e alcance, e cobra em combustível e revisão.

export interface Engine {
  id: string
  /** Designação completa, como sai da ficha do fabricante. */
  name: string
  maker: string
  /** Diâmetro do fan, em metros — é o que muda o tamanho da nacela no desenho. */
  fan: number
  /** Empuxo de decolagem, em libras-força. */
  thrust: number
  /** Multiplicador de consumo (1 = número de catálogo do tipo). */
  burn: number
  /** Multiplicador do custo de manutenção. */
  maint: number
  /** Diferença no preço de tabela, em milhões de dólares. */
  price: number
  /** Multiplicador de alcance. */
  range: number
  /** Pista exigida: empuxo maior tira metros da decolagem. */
  runway: number
  /** Ruído relativo (1 = referência). Entra nas taxas e na reputação. */
  noise: number
  /** Ano em que a motorização passa a ser oferecida. */
  since: number
  /** Uma linha sobre o que essa escolha significa na prática. */
  note: string
}

const E = (
  id: string, name: string, maker: string, fan: number, thrust: number,
  burn: number, maint: number, price: number, range: number, runway: number,
  noise: number, since: number, note: string,
): Engine => ({ id, name, maker, fan, thrust, burn, maint, price, range, runway, noise, since, note })

export const ENGINES: Record<string, Engine> = Object.fromEntries(
  [
    // ---------------------------------------------------------- turboélice
    E('pw127m', 'PW127M', 'Pratt & Whitney Canada', 3.93, 2750, 1, 1, 0, 1, 1, 1, 2007,
      'A motorização clássica do ATR, conhecida de qualquer oficina.'),
    E('pw127xt', 'PW127XT-M', 'Pratt & Whitney Canada', 3.93, 2750, 0.97, 0.88, 0.6, 1.01, 1, 0.97, 2023,
      'Revisão a cada 20 mil horas em vez de 12 mil: 3% menos combustível e 20% menos manutenção.'),
    E('pw150a', 'PW150A', 'Pratt & Whitney Canada', 4.11, 5071, 1, 1, 0, 1, 1, 1.04, 2000,
      'Muito empuxo para um turboélice: é o que dá 360 kt ao Dash 8.'),

    // ------------------------------------------------------------ CF34
    E('cf348c5', 'CF34-8C5', 'GE Aerospace', 1.16, 13360, 1, 1, 0, 1, 1, 1, 2001,
      'O motor dos CRJ da segunda geração.'),
    E('cf348c5a1', 'CF34-8C5A1', 'GE Aerospace', 1.16, 13360, 1, 1, 0, 1, 0.99, 1, 2010,
      'Versão do CRJ1000, com controle de empuxo revisado.'),
    E('cf348e5', 'CF34-8E5', 'GE Aerospace', 1.16, 14200, 1, 1, 0, 1, 1, 1, 2004,
      'O CF34 na versão dos E-Jets menores.'),
    E('cf3410e5', 'CF34-10E5', 'GE Aerospace', 1.45, 18500, 1, 1, 0, 1, 1, 1, 2005,
      'Empuxo de série do E190/E195.'),
    E('cf3410e6', 'CF34-10E6', 'GE Aerospace', 1.45, 20000, 1.02, 1.04, 0.8, 1.04, 0.96, 1.01, 2005,
      'Empuxo alto: útil em pista curta e aeroporto quente, cobra em combustível.'),

    // ---------------------------------------------------- GTF (PW1000G)
    E('pw1919g', 'PW1919G', 'Pratt & Whitney', 1.85, 19000, 1, 1, 0, 1, 1, 0.9, 2018,
      'GTF do E190-E2. Redutor na frente do fan: 16 dB abaixo do limite.'),
    E('pw1922g', 'PW1922G', 'Pratt & Whitney', 1.85, 22000, 1.03, 1.05, 1.2, 1.05, 0.95, 0.91, 2018,
      'Empuxo maior para operação quente e alta.'),
    E('pw1921g', 'PW1921G', 'Pratt & Whitney', 1.85, 21000, 1, 1, 0, 1, 1, 0.9, 2019,
      'GTF de série do E195-E2.'),
    E('pw1923g', 'PW1923G', 'Pratt & Whitney', 1.85, 23000, 1.03, 1.05, 1.4, 1.05, 0.95, 0.91, 2019,
      'A opção de empuxo alto do E195-E2.'),
    E('pw1519g', 'PW1519G', 'Pratt & Whitney', 1.85, 19000, 1, 1, 0, 1, 1, 0.88, 2016,
      'GTF de série do A220-100.'),
    E('pw1521g', 'PW1521G', 'Pratt & Whitney', 1.85, 21000, 1.02, 1.03, 1.1, 1.04, 0.96, 0.89, 2016,
      'O empuxo mais escolhido da família A220.'),
    E('pw1524g', 'PW1524G', 'Pratt & Whitney', 1.85, 23300, 1.04, 1.06, 2.2, 1.07, 0.93, 0.9, 2016,
      'Empuxo máximo do A220: alcance e pista curta.'),
    E('pw1124g', 'PW1124G-JM', 'Pratt & Whitney', 2.06, 24000, 1, 1.06, 0, 1, 1, 0.86, 2023,
      'GTF do A319neo. Silencioso; a oficina ainda é o ponto fraco da família.'),
    E('pw1127g', 'PW1127G-JM', 'Pratt & Whitney', 2.06, 27000, 0.985, 1.08, 0.5, 1.01, 0.99, 0.86, 2016,
      'Um pouco mais econômico que o LEAP no cruzeiro, e bem mais silencioso — mas o intervalo de oficina é menor.'),
    E('pw1133g', 'PW1133G-JM', 'Pratt & Whitney', 2.06, 33000, 0.985, 1.08, 0.8, 1.01, 0.98, 0.87, 2017,
      'A versão de empuxo alto do GTF, do A321neo.'),
    E('pw1133gr', 'PW1133GR-JM', 'Pratt & Whitney', 2.06, 33110, 0.985, 1.08, 1.2, 1.03, 0.98, 0.87, 2024,
      'GTF certificado para o tanque traseiro do XLR.'),

    // ------------------------------------------------------------- LEAP
    E('leap1a24', 'CFM LEAP-1A24', 'CFM International', 1.98, 24010, 1, 1, 0, 1, 1, 0.9, 2023,
      'LEAP de empuxo baixo, do A319neo.'),
    E('leap1a26', 'CFM LEAP-1A26', 'CFM International', 1.98, 27120, 1, 1, 0, 1, 1, 0.9, 2016,
      'O motor mais vendido do A320neo. Come um pouco mais que o GTF e vai muito mais longe entre revisões.'),
    E('leap1a32', 'CFM LEAP-1A32', 'CFM International', 1.98, 32160, 1, 1, 0, 1, 1, 0.91, 2017,
      'A versão de empuxo alto do A321neo.'),
    E('leap1a33x', 'CFM LEAP-1A33B2X', 'CFM International', 1.98, 33110, 1.005, 1.01, 0.4, 1.03, 0.99, 0.91, 2024,
      'Ajustado para o peso máximo do A321XLR.'),
    E('leap1b25', 'CFM LEAP-1B25', 'CFM International', 1.76, 25900, 1, 1, 0, 1, 1, 0.92, 2018,
      'O empuxo mais baixo da família MAX: menos consumo, menos desgaste.'),
    E('leap1b27', 'CFM LEAP-1B27', 'CFM International', 1.76, 27300, 1.015, 1.03, 0.6, 1.03, 0.97, 0.92, 2018,
      'O empuxo padrão do MAX 8 em diante.'),
    E('leap1b28', 'CFM LEAP-1B28', 'CFM International', 1.76, 28900, 1.03, 1.05, 1.1, 1.05, 0.94, 0.93, 2018,
      'Empuxo máximo: pista curta e aeroporto de altitude.'),

    // ------------------------------------------------------------ CFM56
    E('cfm567b24', 'CFM56-7B24', 'CFM International', 1.55, 24200, 1, 1, 0, 1, 1, 1, 1997,
      'O 737 NG de empuxo médio — a motorização mais comum da geração.'),
    E('cfm567b26', 'CFM56-7B26', 'CFM International', 1.55, 26300, 1.015, 1.03, 0.5, 1.03, 0.97, 1.01, 1997,
      'Mais empuxo para pista curta e etapa longa.'),
    E('cfm567b27', 'CFM56-7B27', 'CFM International', 1.55, 27300, 1.03, 1.05, 0.9, 1.05, 0.95, 1.02, 1998,
      'O topo do CFM56-7: o que o 737-900ER pede.'),
    E('cfm565b4', 'CFM56-5B4', 'CFM International', 1.73, 27000, 1, 1, 0, 1, 1, 1, 1996,
      'O CFM do A320 clássico.'),
    E('cfm565b6', 'CFM56-5B6', 'CFM International', 1.73, 23500, 1, 1, 0, 1, 1, 0.99, 1996,
      'A versão do A319.'),
    E('cfm565b3', 'CFM56-5B3', 'CFM International', 1.73, 33000, 1.03, 1.04, 0.8, 1.04, 0.96, 1.02, 1997,
      'Empuxo do A321 clássico.'),
    E('v2527', 'IAE V2527-A5', 'International Aero Engines', 1.61, 26500, 0.985, 1.05, 0.4, 1.02, 1.01, 1.03, 1993,
      'O V2500 gasta menos que o CFM no cruzeiro e é notoriamente mais barulhento na decolagem.'),
    E('v2524', 'IAE V2524-A5', 'International Aero Engines', 1.61, 23500, 0.985, 1.05, 0.3, 1.02, 1.01, 1.03, 1996,
      'A versão do A319.'),
    E('v2533', 'IAE V2533-A5', 'International Aero Engines', 1.61, 33000, 0.99, 1.06, 0.7, 1.04, 0.98, 1.04, 1997,
      'O V2500 de empuxo alto, do A321.'),

    // --------------------------------------------------------- 757 / 767
    E('rb535e4', 'RB211-535E4', 'Rolls-Royce', 1.88, 40100, 1, 1, 0, 1, 1, 0.96, 1984,
      'A motorização preferida do 757: fama de não dar trabalho.'),
    E('rb535e4b', 'RB211-535E4B', 'Rolls-Royce', 1.88, 43500, 1.02, 1.03, 1.2, 1.04, 0.97, 0.97, 1989,
      'Empuxo maior, para o 757-300 e o -200 pesado.'),
    E('pw2040', 'PW2040', 'Pratt & Whitney', 1.99, 41700, 1.01, 1.04, -1.5, 1.01, 1, 1.03, 1987,
      'Mais barato de comprar, mais caro de manter.'),
    E('pw2043', 'PW2043', 'Pratt & Whitney', 1.99, 43700, 1.02, 1.05, -1, 1.03, 0.98, 1.04, 1994,
      'A versão de empuxo alto do PW2000.'),
    E('cf680c2b6', 'CF6-80C2B6F', 'GE Aerospace', 2.36, 60200, 1, 1, 0, 1, 1, 1, 1988,
      'O CF6 do 767-300ER: a combinação mais vendida do modelo.'),
    E('cf680c2b8', 'CF6-80C2B8F', 'GE Aerospace', 2.36, 63500, 1.02, 1.02, 1.5, 1.03, 0.98, 1, 2000,
      'Empuxo do 767-400ER.'),
    E('pw4060', 'PW4060', 'Pratt & Whitney', 2.37, 60000, 1.01, 1.03, -2, 1, 1, 1.02, 1988,
      'A alternativa da Pratt no 767.'),
    E('pw4062', 'PW4062', 'Pratt & Whitney', 2.37, 63300, 1.02, 1.04, -1.5, 1.02, 0.99, 1.02, 2000,
      'A opção Pratt do 767-400ER.'),
    E('rb524h', 'RB211-524H', 'Rolls-Royce', 2.19, 60600, 1.01, 1.02, -1, 1.01, 1, 0.98, 1990,
      'A opção Rolls no 767, rara fora da Europa e da Ásia.'),

    // ------------------------------------------------------------- A330
    E('trent772', 'Trent 772B-60', 'Rolls-Royce', 2.47, 71100, 1, 1, 0, 1, 1, 0.97, 1995,
      'O Trent 700 fica em mais de metade dos A330 clássicos.'),
    E('cf680e1', 'CF6-80E1A4', 'GE Aerospace', 2.44, 70000, 1.01, 0.98, -3, 1, 1, 1.01, 1994,
      'Manutenção mais barata que a do Trent, consumo um pouco pior.'),
    E('pw4170', 'PW4170', 'Pratt & Whitney', 2.54, 70000, 1.02, 1.02, -4, 0.99, 1, 1.02, 1994,
      'A opção mais barata de comprar; quase ninguém escolheu.'),
    E('trent7000', 'Trent 7000-72', 'Rolls-Royce', 2.84, 72834, 1, 1, 0, 1, 1, 0.88, 2018,
      'Motor único do A330neo: fan maior, 6 dB mais silencioso que o Trent 700.'),

    // ------------------------------------------------------------- 787
    E('genx1b70', 'GEnx-1B70', 'GE Aerospace', 2.82, 69800, 1, 1, 0, 1, 1, 0.89, 2011,
      'O GEnx é a escolha da maioria dos 787 e a que menos parou avião em pátio.'),
    E('genx1b74', 'GEnx-1B74/75', 'GE Aerospace', 2.82, 74100, 1.01, 1.02, 1.5, 1.03, 0.98, 0.89, 2014,
      'Empuxo do 787-9.'),
    E('genx1b76', 'GEnx-1B76', 'GE Aerospace', 2.82, 76100, 1.02, 1.03, 2.5, 1.04, 0.97, 0.9, 2018,
      'Empuxo do 787-10.'),
    E('trent1000k', 'Trent 1000-K2', 'Rolls-Royce', 2.85, 70000, 0.995, 1.12, -3, 1, 1, 0.87, 2011,
      'Consumo ligeiramente melhor; foi o motor que deixou dezenas de 787 no chão por causa das pás da turbina.'),
    E('trent1000n', 'Trent 1000-N1', 'Rolls-Royce', 2.85, 74400, 1, 1.1, -2, 1.02, 0.99, 0.87, 2014,
      'A versão TEN, já com o problema de durabilidade endereçado.'),
    E('trent1000j', 'Trent 1000-J3', 'Rolls-Royce', 2.85, 78000, 1.01, 1.09, -1, 1.03, 0.98, 0.88, 2018,
      'A opção Rolls do 787-10.'),

    // ------------------------------------------------------------- A350
    E('trentxwb84', 'Trent XWB-84', 'Rolls-Royce', 3.0, 84200, 1, 1, 0, 1, 1, 0.86, 2015,
      'Motor único do A350-900. O turbofan de maior porte que a Rolls entregou em série.'),
    E('trentxwb97', 'Trent XWB-97', 'Rolls-Royce', 3.0, 97000, 1, 1, 0, 1, 1, 0.87, 2018,
      'Motor único do A350-1000, 15% mais empuxo que o -84.'),

    // -------------------------------------------------------------- 777
    E('ge9094b', 'GE90-94B', 'GE Aerospace', 3.12, 93700, 1, 1, 0, 1, 1, 1, 1997,
      'O GE90 original, do 777-200ER.'),
    E('trent895', 'Trent 895', 'Rolls-Royce', 2.79, 95000, 1.01, 0.99, -2, 1, 1, 0.98, 1997,
      'A opção Rolls do 777 clássico.'),
    E('pw4090', 'PW4090', 'Pratt & Whitney', 2.85, 90000, 1.02, 1.02, -4, 0.99, 1.01, 1.02, 1997,
      'A opção Pratt: a menos vendida das três.'),
    E('ge90115b', 'GE90-115B', 'GE Aerospace', 3.25, 115300, 1, 1, 0, 1, 1, 1.02, 2004,
      'Motor único do 777-300ER e o mais potente já certificado até a chegada do GE9X.'),
    E('ge9x', 'GE9X-105B1A', 'GE Aerospace', 3.4, 105000, 1, 1, 0, 1, 1, 0.85, 2027,
      'Fan de 3,4 m em compósito: 10% menos consumo que o GE90 e muito mais silencioso.'),

    // -------------------------------------------------------- quatro motores
    E('genx2b67', 'GEnx-2B67', 'GE Aerospace', 2.66, 66500, 1, 1, 0, 1, 1, 0.92, 2012,
      'Motor único do 747-8, derivado do GEnx do 787.'),
    E('trent970', 'Trent 970-84', 'Rolls-Royce', 2.95, 70000, 1, 1, 0, 1, 1, 0.9, 2007,
      'A motorização de lançamento do A380: mais silenciosa que a rival.'),
    E('gp7270', 'Engine Alliance GP7270', 'Engine Alliance', 2.96, 70000, 0.99, 0.99, -5, 1.01, 1, 0.93, 2008,
      'A alternativa GE/Pratt, um pouco mais econômica em serviço e mais barata.'),
  ].map((e) => [e.id, e]),
)

export const engineOf = (id: string) => ENGINES[id]
export const engineLabel = (e: Engine) => (e.name.startsWith(e.maker.split(' ')[0]) ? e.name : `${e.maker} ${e.name}`)
