// Catálogo de aeronaves. As designações são as reais e as variantes existem de
// verdade — A319neo, A320neo, A321neo, A321LR e A321XLR são cinco aviões
// diferentes, com asa, peso, alcance e motor diferentes, e no jogo também.
// Dimensões e alcance vêm das fichas dos fabricantes; consumo, preço e
// manutenção estão arredondados e balanceados para o jogo, não para despacho.
import { ENGINES } from './engines'

export type Family = 'turboprop' | 'regional' | 'narrowbody' | 'widebody'

export interface AircraftType {
  id: string
  name: string
  maker: string
  family: Family
  /** Limite certificado de passageiros (saídas de emergência). */
  maxSeats: number
  /** Assentos por fileira na econômica — é o que define quanto cabe na cabine. */
  abreast: number
  /** Alcance prático com carga típica, em milhas náuticas. */
  range: number
  /** Velocidade de cruzeiro, em nós. */
  speed: number
  /** Consumo médio, kg de combustível por hora de voo. */
  burn: number
  /** Preço de tabela, em milhões de dólares. */
  price: number
  /** Pista mínima necessária, em pés. */
  runway: number
  /** Tripulação de cabine de referência (1 por 50 assentos). */
  crew: number
  /** Multiplicador de custo de manutenção. */
  maint: number
  /** Conforto percebido da cabine crua (0.85–1.16), entra no market share. */
  comfort: number
  /** Tempo de solo entre voos, em minutos. */
  turn: number
  /** Ano em que entra no catálogo. */
  since: number
  /** Motorizações oferecidas de fábrica; a primeira é a de série. */
  engines: string[]
  /** Diâmetro do fan instalado, em metros — define o tamanho da nacela no desenho. */
  fan: number
  /** Dimensões reais, usadas para desenhar a silhueta fiel do modelo. */
  shape: Shape
}

export interface Shape {
  /** Comprimento total, em metros. */
  length: number
  /** Diâmetro da fuselagem, em metros. */
  fuseD: number
  /** Altura total (solo até o topo da deriva), em metros. */
  height: number
  /** Envergadura, em metros. */
  span: number
  wing: 'low' | 'high'
  tail: 'conv' | 'ttail'
  engines: 2 | 4
  /** Onde os motores ficam: sob a asa ou na traseira da fuselagem. */
  mount: 'wing' | 'rear'
  prop: boolean
  deck: 'single' | 'hump' | 'double'
  winglet: 'none' | 'fence' | 'blended' | 'sharklet' | 'split' | 'raked'
}

const A = (
  id: string, name: string, maker: string, family: Family, maxSeats: number, abreast: number,
  range: number, speed: number, burn: number, price: number, runway: number, maint: number,
  comfort: number, turn: number, since: number, engines: string[], shape: Shape,
): AircraftType => ({
  id, name, maker, family, maxSeats, abreast, range, speed, burn, price, runway,
  // Regra real: um comissário para cada 50 assentos.
  crew: Math.max(1, Math.ceil(maxSeats / 50)),
  maint, comfort, turn, since, engines,
  fan: ENGINES[engines[0]]?.fan ?? 1.6,
  shape,
})

const S = (
  length: number, fuseD: number, height: number, span: number,
  wing: Shape['wing'], tail: Shape['tail'], engines: Shape['engines'], mount: Shape['mount'],
  prop: boolean, deck: Shape['deck'], winglet: Shape['winglet'],
): Shape => ({ length, fuseD, height, span, wing, tail, engines, mount, prop, deck, winglet })

export const AIRCRAFT: AircraftType[] = [
  // ------------------------------------------------------------ turboélice
  A('atr42', 'ATR 42-600', 'ATR', 'turboprop', 50, 4, 726, 275, 480, 22, 3600, 0.82, 0.9, 20, 2012,
    ['pw127m', 'pw127xt'],
    S(22.67, 2.87, 7.59, 24.57, 'high', 'ttail', 2, 'wing', true, 'single', 'none')),
  A('atr72', 'ATR 72-600', 'ATR', 'turboprop', 78, 4, 740, 275, 650, 27, 4400, 0.85, 0.92, 25, 2011,
    ['pw127m', 'pw127xt'],
    S(27.17, 2.87, 7.65, 27.05, 'high', 'ttail', 2, 'wing', true, 'single', 'none')),
  A('q400', 'Dash 8 Q400', 'De Havilland Canada', 'turboprop', 90, 4, 1100, 360, 780, 33, 4500, 0.9, 0.94, 25, 2000,
    ['pw150a'],
    S(32.84, 2.69, 8.34, 28.42, 'high', 'ttail', 2, 'wing', true, 'single', 'none')),

  // -------------------------------------------------------------- regional
  A('crj700', 'CRJ700', 'Bombardier', 'regional', 78, 4, 1400, 447, 830, 41, 5300, 0.93, 0.89, 22, 2001,
    ['cf348c5'],
    S(32.3, 2.69, 7.51, 23.25, 'low', 'ttail', 2, 'rear', false, 'single', 'fence')),
  A('crj900', 'CRJ900', 'Bombardier', 'regional', 90, 4, 1550, 447, 980, 46, 5600, 0.95, 0.9, 25, 2003,
    ['cf348c5'],
    S(36.4, 2.69, 7.51, 24.85, 'low', 'ttail', 2, 'rear', false, 'single', 'fence')),
  A('crj1000', 'CRJ1000', 'Bombardier', 'regional', 104, 4, 1650, 447, 1050, 50, 6300, 0.97, 0.9, 27, 2010,
    ['cf348c5a1'],
    S(39.13, 2.69, 7.47, 26.17, 'low', 'ttail', 2, 'rear', false, 'single', 'fence')),
  A('e170', 'E170', 'Embraer', 'regional', 80, 4, 2150, 447, 880, 41, 5000, 0.9, 0.98, 22, 2004,
    ['cf348e5'],
    S(29.9, 3.01, 9.85, 26.0, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('e175', 'E175', 'Embraer', 'regional', 88, 4, 2200, 447, 970, 50, 4900, 0.92, 0.99, 25, 2005,
    ['cf348e5'],
    S(31.68, 3.01, 9.86, 28.72, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('e190', 'E190', 'Embraer', 'regional', 114, 4, 2450, 447, 1150, 56, 5500, 0.95, 1.0, 30, 2005,
    ['cf3410e5', 'cf3410e6'],
    S(36.24, 3.01, 10.28, 28.72, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('e195', 'E195', 'Embraer', 'regional', 124, 4, 2300, 447, 1220, 60, 6100, 0.97, 1.0, 30, 2006,
    ['cf3410e6'],
    S(38.65, 3.01, 10.55, 28.72, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('e190e2', 'E190-E2', 'Embraer', 'regional', 114, 4, 2950, 460, 990, 61, 5300, 0.86, 1.05, 28, 2018,
    ['pw1919g', 'pw1922g'],
    S(36.24, 3.01, 10.69, 33.72, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('e195e2', 'E195-E2', 'Embraer', 'regional', 146, 4, 3000, 460, 1080, 71, 5200, 0.88, 1.06, 30, 2019,
    ['pw1921g', 'pw1923g'],
    S(41.5, 3.01, 10.9, 35.1, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),

  // ---------------------------------------------------------- corredor único
  A('a220100', 'A220-100', 'Airbus', 'narrowbody', 135, 5, 3600, 470, 1150, 82, 4800, 0.88, 1.08, 32, 2016,
    ['pw1519g', 'pw1521g', 'pw1524g'],
    S(35.0, 3.7, 11.5, 35.1, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a220300', 'A220-300', 'Airbus', 'narrowbody', 160, 5, 3400, 470, 1250, 92, 5900, 0.9, 1.08, 35, 2016,
    ['pw1521g', 'pw1524g'],
    S(38.71, 3.7, 11.5, 35.1, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('b73g', '737-700', 'Boeing', 'narrowbody', 149, 6, 3010, 455, 2150, 89, 6700, 0.96, 0.97, 30, 1998,
    ['cfm567b24', 'cfm567b26'],
    S(33.63, 3.76, 12.55, 35.79, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('b737', '737-800', 'Boeing', 'narrowbody', 189, 6, 2935, 455, 2450, 106, 7500, 1.0, 0.98, 35, 1998,
    ['cfm567b24', 'cfm567b26', 'cfm567b27'],
    S(39.5, 3.76, 12.55, 35.79, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('b739', '737-900ER', 'Boeing', 'narrowbody', 220, 6, 2950, 455, 2600, 112, 8600, 1.03, 0.97, 40, 2007,
    ['cfm567b27'],
    S(42.11, 3.76, 12.55, 35.79, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('a319', 'A319-100', 'Airbus', 'narrowbody', 156, 6, 3750, 455, 2150, 92, 6100, 0.97, 0.99, 30, 1996,
    ['cfm565b6', 'v2524'],
    S(33.84, 3.95, 11.76, 34.1, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('a320', 'A320-200', 'Airbus', 'narrowbody', 180, 6, 3350, 455, 2400, 101, 6900, 1.0, 1.0, 35, 1993,
    ['cfm565b4', 'v2527'],
    S(37.57, 3.95, 11.76, 34.1, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('a321', 'A321-200', 'Airbus', 'narrowbody', 236, 6, 3200, 455, 2750, 118, 7500, 1.05, 1.0, 40, 1997,
    ['cfm565b3', 'v2533'],
    S(44.51, 3.95, 11.76, 34.1, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('a319neo', 'A319neo', 'Airbus', 'narrowbody', 160, 6, 3700, 460, 1800, 102, 6100, 0.9, 1.04, 30, 2023,
    ['leap1a24', 'pw1124g'],
    S(33.84, 3.95, 11.76, 35.8, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a320neo', 'A320neo', 'Airbus', 'narrowbody', 194, 6, 3400, 460, 1980, 111, 6600, 0.92, 1.05, 35, 2016,
    ['leap1a26', 'pw1127g'],
    S(37.57, 3.95, 11.76, 35.8, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a321neo', 'A321neo', 'Airbus', 'narrowbody', 244, 6, 4000, 460, 2280, 130, 7200, 0.95, 1.05, 40, 2017,
    ['leap1a32', 'pw1133g'],
    S(44.51, 3.95, 11.76, 35.8, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a21lr', 'A321LR', 'Airbus', 'narrowbody', 244, 6, 4000, 460, 2340, 138, 7600, 0.96, 1.06, 42, 2018,
    ['leap1a32', 'pw1133g'],
    S(44.51, 3.95, 11.76, 35.8, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a21xlr', 'A321XLR', 'Airbus', 'narrowbody', 244, 6, 4700, 460, 2400, 148, 7900, 0.98, 1.06, 45, 2024,
    ['leap1a33x', 'pw1133gr'],
    S(44.51, 3.95, 11.76, 35.8, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('b37m', '737 MAX 7', 'Boeing', 'narrowbody', 172, 6, 3800, 460, 1800, 100, 6900, 0.9, 1.03, 32, 2026,
    ['leap1b25', 'leap1b27'],
    S(35.56, 3.76, 12.3, 35.92, 'low', 'conv', 2, 'wing', false, 'single', 'split')),
  A('b38m', '737 MAX 8', 'Boeing', 'narrowbody', 189, 6, 3500, 460, 1950, 122, 7000, 0.92, 1.04, 35, 2018,
    ['leap1b25', 'leap1b27'],
    S(39.52, 3.76, 12.3, 35.92, 'low', 'conv', 2, 'wing', false, 'single', 'split')),
  A('b39m', '737 MAX 9', 'Boeing', 'narrowbody', 220, 6, 3300, 460, 2120, 129, 8400, 0.95, 1.04, 40, 2018,
    ['leap1b27', 'leap1b28'],
    S(42.11, 3.76, 12.3, 35.92, 'low', 'conv', 2, 'wing', false, 'single', 'split')),
  A('b310m', '737 MAX 10', 'Boeing', 'narrowbody', 230, 6, 3100, 460, 2210, 135, 8600, 0.97, 1.04, 42, 2026,
    ['leap1b27', 'leap1b28'],
    S(43.79, 3.76, 12.3, 35.92, 'low', 'conv', 2, 'wing', false, 'single', 'split')),
  A('b752', '757-200', 'Boeing', 'narrowbody', 239, 6, 3915, 470, 3100, 95, 7400, 1.15, 0.97, 40, 1983,
    ['rb535e4', 'pw2040'],
    S(47.32, 3.76, 13.6, 38.05, 'low', 'conv', 2, 'wing', false, 'single', 'none')),
  A('b753', '757-300', 'Boeing', 'narrowbody', 289, 6, 3395, 470, 3450, 105, 8600, 1.2, 0.95, 45, 1999,
    ['rb535e4b', 'pw2043'],
    S(54.43, 3.76, 13.6, 38.05, 'low', 'conv', 2, 'wing', false, 'single', 'none')),

  // -------------------------------------------------------- fuselagem larga
  A('b763', '767-300ER', 'Boeing', 'widebody', 350, 7, 5980, 470, 4300, 135, 8300, 1.15, 1.0, 60, 1988,
    ['cf680c2b6', 'pw4060', 'rb524h'],
    S(54.94, 5.03, 15.85, 47.57, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('b764', '767-400ER', 'Boeing', 'widebody', 409, 7, 5625, 470, 4700, 152, 9400, 1.18, 1.03, 70, 2000,
    ['cf680c2b8', 'pw4062'],
    S(61.37, 5.03, 16.8, 51.92, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('a332', 'A330-200', 'Airbus', 'widebody', 406, 8, 7250, 470, 5100, 240, 8200, 1.1, 1.03, 60, 1998,
    ['trent772', 'cf680e1', 'pw4170'],
    S(58.82, 5.64, 17.39, 60.3, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('a333', 'A330-300', 'Airbus', 'widebody', 440, 8, 6350, 470, 5400, 265, 8200, 1.1, 1.04, 65, 1994,
    ['trent772', 'cf680e1', 'pw4170'],
    S(63.67, 5.64, 16.79, 60.3, 'low', 'conv', 2, 'wing', false, 'single', 'fence')),
  A('a338', 'A330-800neo', 'Airbus', 'widebody', 406, 8, 8100, 475, 4400, 260, 8000, 0.98, 1.1, 60, 2020,
    ['trent7000'],
    S(58.82, 5.64, 17.39, 64.0, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('a339', 'A330-900neo', 'Airbus', 'widebody', 460, 8, 7350, 475, 4700, 300, 8000, 1.0, 1.1, 65, 2018,
    ['trent7000'],
    S(63.66, 5.64, 17.39, 64.0, 'low', 'conv', 2, 'wing', false, 'single', 'sharklet')),
  A('b788', '787-8', 'Boeing', 'widebody', 381, 9, 8000, 488, 4300, 249, 8000, 0.95, 1.12, 65, 2011,
    ['genx1b70', 'trent1000k'],
    S(56.72, 5.77, 16.92, 60.12, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('b789', '787-9', 'Boeing', 'widebody', 420, 9, 8300, 488, 4750, 293, 8500, 0.97, 1.13, 70, 2014,
    ['genx1b74', 'trent1000n'],
    S(62.81, 5.77, 17.02, 60.12, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('b78x', '787-10', 'Boeing', 'widebody', 440, 9, 7500, 488, 5100, 338, 9100, 1.0, 1.13, 75, 2018,
    ['genx1b76', 'trent1000j'],
    S(68.3, 5.77, 17.02, 60.12, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('a359', 'A350-900', 'Airbus', 'widebody', 440, 9, 8600, 488, 5000, 320, 8500, 0.97, 1.14, 70, 2015,
    ['trentxwb84'],
    S(66.8, 5.96, 17.05, 64.75, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('a35k', 'A350-1000', 'Airbus', 'widebody', 480, 9, 9100, 488, 5800, 366, 9200, 1.02, 1.14, 80, 2018,
    ['trentxwb97'],
    S(73.79, 5.96, 17.08, 64.75, 'low', 'conv', 2, 'wing', false, 'single', 'blended')),
  A('b77e', '777-200ER', 'Boeing', 'widebody', 440, 10, 7500, 490, 6600, 290, 9800, 1.14, 1.02, 75, 1997,
    ['ge9094b', 'trent895', 'pw4090'],
    S(63.73, 6.2, 18.5, 60.93, 'low', 'conv', 2, 'wing', false, 'single', 'none')),
  A('b77w', '777-300ER', 'Boeing', 'widebody', 550, 10, 7500, 490, 7200, 375, 9800, 1.12, 1.05, 85, 2004,
    ['ge90115b'],
    S(73.86, 6.2, 18.5, 64.8, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('b779', '777-9', 'Boeing', 'widebody', 550, 10, 8000, 490, 6300, 442, 10000, 1.05, 1.13, 85, 2027,
    ['ge9x'],
    S(76.72, 6.2, 19.53, 71.75, 'low', 'conv', 2, 'wing', false, 'single', 'raked')),
  A('b748', '747-8 Intercontinental', 'Boeing', 'widebody', 605, 10, 7730, 495, 8600, 419, 10500, 1.3, 1.08, 95, 2012,
    ['genx2b67'],
    S(76.3, 6.5, 19.4, 68.4, 'low', 'conv', 4, 'wing', false, 'hump', 'blended')),
  A('a388', 'A380-800', 'Airbus', 'widebody', 853, 10, 8000, 490, 10500, 445, 10500, 1.4, 1.15, 110, 2007,
    ['trent970', 'gp7270'],
    S(72.72, 7.14, 24.1, 79.75, 'low', 'conv', 4, 'wing', false, 'double', 'fence')),
]

export const AIRCRAFT_BY_ID: Record<string, AircraftType> = Object.fromEntries(
  AIRCRAFT.map((a) => [a.id, a]),
)

/** Designação completa, com fabricante: "Boeing 737-800", mas sem repetir "ATR ATR 72". */
export const acLabel = (t: AircraftType) =>
  t.name.startsWith(t.maker) ? t.name : `${t.maker} ${t.name}`

/** Família comercial, para agrupar o catálogo na tela de mercado. */
export const FAMILY_OF: Record<string, string> = {
  atr42: 'ATR', atr72: 'ATR', q400: 'Dash 8',
  crj700: 'CRJ', crj900: 'CRJ', crj1000: 'CRJ',
  e170: 'E-Jet', e175: 'E-Jet', e190: 'E-Jet', e195: 'E-Jet',
  e190e2: 'E-Jet E2', e195e2: 'E-Jet E2',
  a220100: 'A220', a220300: 'A220',
  b73g: '737 NG', b737: '737 NG', b739: '737 NG',
  b37m: '737 MAX', b38m: '737 MAX', b39m: '737 MAX', b310m: '737 MAX',
  a319: 'A320ceo', a320: 'A320ceo', a321: 'A320ceo',
  a319neo: 'A320neo', a320neo: 'A320neo', a321neo: 'A320neo', a21lr: 'A320neo', a21xlr: 'A320neo',
  b752: '757', b753: '757',
  b763: '767', b764: '767',
  a332: 'A330ceo', a333: 'A330ceo', a338: 'A330neo', a339: 'A330neo',
  b788: '787', b789: '787', b78x: '787',
  a359: 'A350', a35k: 'A350',
  b77e: '777', b77w: '777', b779: '777X',
  b748: '747', a388: 'A380',
}
