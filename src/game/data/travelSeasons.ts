import { event as e, fixed as f } from './travelEventHelpers'

const holiday = { category: 'ferias', basis: 'regra-do-jogo',
  note: 'Janela sazonal de planejamento do jogo, ampliada para semanas completas. Não é um calendário escolar universal: datas oficiais variam por região e escola.' } as const
const australia = 'https://www.australia.com/en/facts-and-planning/when-to-go/australian-school-holidays.html'
const nz = 'https://www.newzealand.com/nz/school-holidays-in-new-zealand/'
const florida = 'https://www.visitflorida.com/more/faq/'
const chile = 'https://chile.travel/blog/salares-volcanes-y-bosques-unicos-los-destinos-imperdibles-del-2026-en-chile/'
export const TRAVEL_SEASONS = [
  e('ferias-verao-australia', 'Férias de verão · Austrália', 'Gold Coast, Sunshine Coast, Cairns e Hobart', 'OOL MCY CNS HBA', .25, f(12, 16, 1, 31), australia, holiday),
  e('ferias-julho-australia', 'Recesso de julho · Austrália', 'Cairns, Gold Coast e Darwin', 'CNS OOL DRW', .20, f(7, 1, 7, 21), australia, holiday),
  e('ferias-verao-nz', 'Férias de verão · Nova Zelândia', 'Queenstown, Nelson, Rotorua e Auckland', 'ZQN NSN ROT AKL', .25, f(12, 16, 1, 31), nz, holiday),
  e('ferias-julho-nz', 'Recesso de inverno · Nova Zelândia', 'Queenstown e Christchurch', 'ZQN CHC', .22, f(7, 1, 7, 21), nz, holiday),
  e('ferias-verao-espanha', 'Verão · litoral continental espanhol', 'Málaga, Alicante, Valência e Costa Dourada', 'AGP ALC VLC REU', .25, f(7, 1, 8, 31), 'https://www.spain.info/en/discover-spain/spain-summer/', holiday),
  e('ferias-obon', 'Recesso de Obon', 'Japão · viagens de reencontro familiar', 'CTS FUK OKA HIJ NGS KOJ SDJ', .25, f(8, 13, 8, 16), 'https://www.japan.travel/en/guide/august/',
    { ...holiday, note: 'Janela tradicional de meados de agosto, com demanda de visitas familiares e férias. Não é um feriado nacional uniforme e algumas regiões celebram em outra época.' }),
  e('ferias-verao-hokkaido', 'Verão · Hokkaido', 'Sapporo, Asahikawa e Hakodate, Japão', 'CTS AKJ HKD', .22, f(7, 1, 8, 31), 'https://www.japan.travel/en/guide/summer-guide/', holiday),
  e('spring-break-florida', 'Spring break · Flórida', 'Orlando, Miami, Fort Lauderdale e praias da Flórida', 'MCO MIA FLL TPA RSW ECP PNS', .22, f(3, 1, 4, 30), florida, holiday),
  e('verao-praias-florida', 'Férias de verão · praias da Flórida', 'Miami, Fort Lauderdale, Tampa e costa do Golfo', 'MIA FLL TPA RSW ECP PNS', .22, f(6, 1, 8, 31), florida, holiday),
  e('spring-break-canada', 'Spring break · Canadá', 'Vancouver, Calgary, Kelowna e Whitehorse', 'YVR YYC YLW YXY', .18, f(3, 1, 3, 31), 'https://travel.destinationcanada.com/en-ca/things-to-do/where-travel-spring-break-canada', holiday),
  e('verao-patagonia-chile', 'Verão · Patagônia e lagos chilenos', 'Punta Arenas, Puerto Natales, Puerto Montt e Temuco', 'PUQ PNT PMC ZCO', .30, f(12, 16, 2, 28), chile, holiday),
  e('verao-litoral-chile', 'Férias de verão · litoral central chileno', 'Zapallar, Papudo e Maitencillo · acesso por Santiago', 'SCL', .15, f(1, 1, 2, 28), 'https://chile.travel/destinos/maitencillo-zapallar-y-papudo/', holiday),
  e('verao-patagonia-argentina', 'Verão · Patagônia argentina', 'El Calafate, Ushuaia e Bariloche', 'FTE USH BRC', .30, f(12, 16, 3, 15), 'https://www.argentina.travel/novedades/calendario-viajero-2024-a-donde-viajar-en-argentina-segun-el-mes-del-ano', holiday),
]
