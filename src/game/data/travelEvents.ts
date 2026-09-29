import { ASIA_EVENTS } from './travelEventsAsia'
import { EUROPE_EVENTS } from './travelEventsEurope'
import { BRAZIL_EVENTS } from './travelEventsBrazil'
import { AMERICAS_EVENTS } from './travelEventsAmericas'
import { AFRICA_OCEANIA_EVENTS } from './travelEventsAfricaOceania'
import { TRAVEL_SEASONS } from './travelSeasons'
import { EXPANSION_EVENTS } from './travelEventsExpansion'
/** Pesquisa revisada em 28/09/2026. Fontes sustentam datas/lugares, não os bônus do jogo. */
export type EventRule =
  | { kind: 'fixed'; start: [number, number]; end: [number, number] }
  | { kind: 'easter'; startOffset: number; endOffset: number }
  | { kind: 'chinese'; month: number; day: number; duration: number }
  | { kind: 'weekday'; month: number; weekday: number; nth: number; duration: number; offset?: number }
  | { kind: 'oktoberfest' }
export interface TravelEvent {
  id: string
  name: string
  place: string
  category: 'ferias' | 'evento'
  basis: 'recorrencia' | 'projecao' | 'regra-do-jogo'
  rule: EventRule
  /** Acréscimo na econômica. Outras classes recebem uma fração, sem criar classe inexistente. */
  airports: { iata: string; boost: number }[]
  /** Acesso por conexão: nenhum bônus indiscriminado na demanda local desses hubs. */
  gateways?: string[]
  afterDays?: number
  confirmed?: Record<number, [string, string]>
  note: string
  sources: { title: string; url: string }[]
}

const fixed = (m: number, d: number, em = m, ed = d): EventRule =>
  ({ kind: 'fixed', start: [m, d], end: [em, ed] })
const airports = (codes: string, boost: number) => codes.split(' ').map(iata => ({ iata, boost }))
const school = { title: 'Calendário escolar paulista de 2026',
  url: 'https://atendimento.educacao.sp.gov.br/knowledgebase/article/SED-08404/pt-br' }
const summerSC = { title: 'Prefeitura de Navegantes · temporada de verão 2025/2026',
  url: 'https://navegantes.sc.gov.br/2025/12/22/o-verao-chegou-navegantes-espera-receber-mais-de-300-mil-turistas-nesta-temporada-veja-como-curtir-com-seguranca/' }
const holidaysNE = { title: 'Maceió · procura nas férias de janeiro, fevereiro e julho',
  url: 'https://maceio.al.gov.br/noticias/semtur/maceio-conquista-lideranca-nacional-em-vendas-de-turismo-e-amplia-protagonismo-no-mercado-internacional' }
const july = { title: 'Ministério do Turismo · férias de julho',
  url: 'https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/partiu-ferias' }

export const TRAVEL_EVENTS: TravelEvent[] = [
  ...EXPANSION_EVENTS,
  ...ASIA_EVENTS,
  ...EUROPE_EVENTS,
  ...BRAZIL_EVENTS,
  ...AMERICAS_EVENTS,
  ...AFRICA_OCEANIA_EVENTS,
  ...TRAVEL_SEASONS,
  {
    id: 'ferias-verao-sc', name: 'Férias de verão · litoral catarinense', place: 'Navegantes, Florianópolis e litoral de SC',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(12, 16, 2, 15),
    airports: [...airports('NVT FLN', .35), ...airports('JJG JOI', .15)],
    note: 'Janela do jogo: segunda quinzena de dezembro, janeiro e primeira quinzena de fevereiro. As redes escolares têm calendários diferentes.',
    sources: [summerSC, school, { title: 'SC · Operação Estação Verão nos municípios do litoral',
      url: 'https://portal.doe.sea.sc.gov.br/repositorio/2025/20251119/Jornal/22645.pdf' }],
  },
  {
    id: 'ferias-verao-ne', name: 'Férias de verão · praias do Nordeste', place: 'Maceió, Porto de Galinhas, Porto Seguro, Natal e Fortaleza',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(12, 16, 2, 15),
    airports: airports('MCZ REC BPS NAT FOR', .30),
    note: 'Aeroporto do Recife atende também Porto de Galinhas. O período é a janela uniforme de férias adotada pelo jogo.',
    sources: [holidaysNE, july, school],
  },
  {
    id: 'ferias-julho-ne', name: 'Férias de julho · Nordeste', place: 'Maceió, Fortaleza, Porto Seguro e litoral baiano',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(7, 1, 7, 31),
    airports: [...airports('MCZ FOR BPS', .28), ...airports('SSA REC NAT', .20)],
    note: 'Julho é tratado como temporada turística. Não significa que todas as escolas tenham um mês inteiro de recesso.',
    sources: [july, holidaysNE, { title: 'Setur-BA · destinos procurados nas férias de julho',
      url: 'https://www.ba.gov.br/turismo/noticia/2024-07/4278/destinos-baianos-tem-destaque-em-ranking-de-agencia-de-viagens-para-ferias-de' }],
  },
  {
    id: 'ferias-julho-sul', name: 'Férias de julho · destinos do Sul', place: 'Gramado, Canela, Foz do Iguaçu, Penha e Balneário Camboriú',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(7, 1, 7, 31),
    airports: [...airports('CXJ IGU', .28), ...airports('NVT', .22), ...airports('POA', .14)],
    note: 'Caxias e Porto Alegre dão acesso à Serra Gaúcha. Navegantes atende Penha/Beto Carrero e Balneário Camboriú, com turismo familiar também em julho.',
    sources: [holidaysNE, july,
      { title: 'Beto Carrero · temporada de férias de julho', url: 'https://destino.betocarrero.com.br/5-motivos-para-passar-as-ferias-de-julho-no-beto-carrero/' },
      { title: 'Beto Carrero · acesso pelo aeroporto de Navegantes', url: 'https://destino.betocarrero.com.br/conheca-os-3-aeroportos-mais-proximos-do-beto-carrero/' },
      { title: 'Itaipu Parquetec · pesquisa turística de Foz em julho de 2025',
      url: 'https://www.itaipuparquetec.org.br/wp-content/uploads/2025/11/Relatorio-FInal-Pesquisa-de-Demanda-de-Foz-Julho25.pdf' }],
  },
  {
    id: 'parintins', name: 'Festival de Parintins', place: 'Parintins, Amazonas',
    category: 'evento', basis: 'recorrencia', rule: { kind: 'weekday', month: 6, weekday: 5, nth: -1, duration: 3 },
    airports: airports('PIN', 1), gateways: ['MAO', 'BEL', 'STM'], afterDays: 3,
    confirmed: { 2026: ['2026-06-26', '2026-06-28'] },
    note: 'Último fim de semana de junho; inclui o retorno na semana seguinte. Manaus, Belém e Santarém se beneficiam das ligações com PIN e das conexões efetivamente vendidas.',
    sources: [
      { title: 'Ministério do Turismo · recorrência do festival', url: 'https://www.turismo.gov.br/agenda-eventos/views/detalhe-evento.php?id=21894' },
      { title: 'Prefeitura de Parintins · datas de 2026', url: 'https://parintins.am.gov.br/noticia/lancamento-do-festival-de-parintins-2026-reune-multidao-shows-nacionais-e-espetaculo-de-caprichoso-e-garantido' },
      { title: 'Azul · ligações extras de Belém e Santarém', url: 'https://www.voeazul.com.br/content/dam/azul/voe-azul/imprensa/Azul%20dobra%20oferta%20de%20assentos%20para%20o%20Festival%20de%20Parintins%20%20.pdf' },
      { title: 'Azul · operação até 2 de julho de 2026', url: 'https://www.voeazul.com.br/content/dam/azul/voe-azul/imprensa/Azul%20amplia%20opera%C3%A7%C3%A3o%20para%20o%C2%A0Festival%20de%20Parintins%C2%A0com%C2%A0178%C2%A0vo.pdf' },
    ],
  },
  {
    id: 'cirio', name: 'Círio de Nazaré', place: 'Belém, Pará',
    category: 'evento', basis: 'recorrencia', rule: { kind: 'weekday', month: 10, weekday: 0, nth: 2, duration: 1 },
    airports: airports('BEL', .50), afterDays: 1,
    note: 'Procissão principal no segundo domingo de outubro; a janela de viagem inclui a semana seguinte para o retorno.',
    sources: [{ title: 'Fapespa · Círio no segundo domingo de outubro', url: 'https://www.fapespa.pa.gov.br/wp-content/uploads/2024/03/Belem.pdf' }],
  },
  {
    id: 'carnaval', name: 'Carnaval', place: 'Rio, Salvador, Recife/Olinda, São Paulo e Belo Horizonte',
    category: 'evento', basis: 'recorrencia', rule: { kind: 'easter', startOffset: -52, endOffset: -46 },
    airports: [...airports('SSA REC', .45), ...airports('GIG SDU', .35), ...airports('CNF PLU', .20), ...airports('GRU CGH VCP', .12)],
    note: 'Da quinta-feira anterior até a Quarta-feira de Cinzas, calculadas pela Páscoa de cada ano e ampliadas para semanas completas.',
    sources: [{ title: 'Ministério do Turismo · cidades beneficiadas pelo Carnaval',
      url: 'https://www.gov.br/turismo/pt-br/assuntos/ultimas-noticia/carnaval-beneficia-turismo-em-todo-o-brasil' },
      { title: 'Prefeitura do Recife · programação de 2026', url: 'https://www2.recife.pe.gov.br/node/299925' }],
  },
  {
    id: 'sao-joao-campina', name: 'São João de Campina Grande', place: 'Campina Grande, Paraíba',
    category: 'evento', basis: 'projecao', rule: fixed(6, 3, 7, 5),
    airports: [...airports('CPV', .60), ...airports('JPA', .12)],
    confirmed: { 2026: ['2026-06-03', '2026-07-05'] },
    note: 'Nas edições futuras, a temporada é projetada com base em 2026. João Pessoa é uma alternativa de acesso terrestre, com efeito menor.',
    sources: [{ title: 'Prefeitura de Campina Grande · programação oficial de 2026',
      url: 'https://campinagrande.pb.gov.br/o-maior-sao-joao-do-mundo-prefeitura-de-campina-grande-e-arte-producoes-divulgam-programacao-oficial-da-edicao-2026/' }],
  },
  {
    id: 'sao-joao-caruaru', name: 'São João de Caruaru', place: 'Caruaru, Pernambuco',
    category: 'evento', basis: 'projecao', rule: fixed(5, 30, 6, 27),
    airports: [...airports('CAU', .55), ...airports('REC', .12)],
    confirmed: { 2026: ['2026-05-30', '2026-06-27'] },
    note: 'Projeção anual da temporada principal; datas futuras dependem da edição. Recife funciona também como acesso terrestre a Caruaru.',
    sources: [{ title: 'Empetur · São João de Caruaru 2026', url: 'https://www.empetur.pe.gov.br/evento/2230-sao-joao-de-caruaru-2026' }],
  },
  {
    id: 'sao-joao-maranhao', name: 'São João do Maranhão', place: 'São Luís, Maranhão',
    category: 'evento', basis: 'projecao', rule: fixed(6, 1, 6, 30),
    airports: airports('SLZ', .35),
    note: 'Junho é a temporada central modelada. Programações de cada edição podem começar antes ou terminar depois.',
    sources: [{ title: 'Setur-MA · lançamento da temporada junina de 2026',
      url: 'https://turismo.ma.gov.br/noticias/maranhao-promove-evento-de-lancamento-do-sao-joao-2026-para-imprensa-e-agentes-de-viagens-em-sao-paulo' }],
  },
  {
    id: 'forro-caju', name: 'Forró Caju', place: 'Aracaju, Sergipe',
    category: 'evento', basis: 'projecao', rule: fixed(6, 20, 6, 28),
    airports: airports('AJU', .35), confirmed: { 2026: ['2026-06-20', '2026-06-28'] },
    note: 'Janela da programação principal na Praça dos Mercados; futuras edições são projeções, sem incluir cada prévia de bairro.',
    sources: [{ title: 'Funcaju · edital com datas da edição 2026',
      url: 'https://transparencia.aracaju.se.gov.br/funcaju/wp-content/uploads/sites/6/2026/04/8.-Aviso-e-Edital-005.2026-Patrocinio-Forro-Caju-2026-3-1.pdf' }],
  },
  {
    id: 'saire', name: 'Sairé e Festival dos Botos', place: 'Alter do Chão, Santarém',
    category: 'evento', basis: 'projecao', rule: { kind: 'weekday', month: 9, weekday: 4, nth: 3, duration: 5 },
    airports: airports('STM', .45), confirmed: { 2026: ['2026-09-17', '2026-09-21'] },
    note: 'A terceira quinta-feira de setembro projeta a programação principal observada em 2025/2026; cada edição pode alterar a data.',
    sources: [{ title: 'Prefeitura de Santarém · programação oficial do Sairé 2026',
      url: 'https://santarem.pa.gov.br/noticias/saire-2026/prefeitura-divulga-programacao-oficial-do-saire-2026-f34s5s' }],
  },
  {
    id: 'oktoberfest-blumenau', name: 'Oktoberfest de Blumenau', place: 'Blumenau, Santa Catarina',
    category: 'evento', basis: 'projecao', rule: fixed(10, 7, 10, 25),
    airports: [...airports('NVT', .40), ...airports('FLN JOI', .08)],
    confirmed: { 2026: ['2026-10-07', '2026-10-25'] },
    note: 'Navegantes é o principal acesso aéreo modelado; Florianópolis e Joinville são alternativas terrestres com efeito menor. Datas futuras projetadas.',
    sources: [{ title: 'Prefeitura de Blumenau · Oktoberfest 2026', url: 'https://www.blumenau.sc.gov.br/secao/noticias/125481' }],
  },
  {
    id: 'natal-luz', name: 'Natal Luz', place: 'Gramado, Rio Grande do Sul',
    category: 'evento', basis: 'projecao', rule: fixed(10, 22, 1, 17),
    airports: [...airports('CXJ', .28), ...airports('POA', .12)],
    confirmed: { 2026: ['2026-10-22', '2027-01-17'] },
    note: 'A temporada cruza o ano. Caxias e Porto Alegre dão acesso terrestre à Serra; futuras edições usam uma projeção da temporada anunciada.',
    sources: [{ title: 'Natal Luz · calendário oficial 2026/2027', url: 'https://www.natalluzdegramado.com.br/' }],
  },
  {
    id: 'iemanja', name: 'Festa de Iemanjá', place: 'Salvador, Bahia',
    category: 'evento', basis: 'recorrencia', rule: fixed(2, 2), airports: airports('SSA', .20),
    note: 'Celebração anual de 2 de fevereiro, no Rio Vermelho, aplicada à semana inteira.',
    sources: [{ title: 'Ministério do Turismo · calendário cultural de Salvador',
      url: 'https://www.gov.br/turismo/pt-br/assuntos/noticias/salvador-reune-historia-cultura-gastronomia-e-tradicoes-que-encantam-visitantes-durante-todo-o-ano' }],
  },
  {
    id: 'reveillon-rio', name: 'Réveillon do Rio', place: 'Rio de Janeiro',
    category: 'evento', basis: 'recorrencia', rule: fixed(12, 31, 1, 1),
    airports: airports('GIG SDU', .30),
    note: 'Viagens para a virada do ano, de 31 de dezembro para 1º de janeiro.',
    sources: [{ title: 'Prefeitura do Rio · operação do Réveillon',
      url: 'https://prefeitura.rio/cidade/prefeitura-apresenta-o-planejamento-operacional-para-o-reveillon-2026/' }],
  },
  {
    id: 'santo-antonio-lisboa', name: 'Santo António', place: 'Lisboa, Portugal',
    category: 'evento', basis: 'recorrencia', rule: fixed(6, 12, 6, 13), airports: airports('LIS', .18),
    note: 'Noite de 12 para 13 de junho; o jogo agrupa as datas em semanas inteiras.',
    sources: [{ title: 'Visit Lisboa · Santo António', url: 'https://www.visitlisboa.com/pt-pt/eventos/noite-de-santo-antonio-12-13-de-junho' }],
  },
  {
    id: 'sao-joao-porto', name: 'São João do Porto', place: 'Porto, Portugal',
    category: 'evento', basis: 'recorrencia', rule: fixed(6, 23, 6, 24), airports: airports('OPO', .22),
    note: 'Festa de 23 para 24 de junho.',
    sources: [{ title: 'Visit Porto · São João', url: 'https://backoffice.visitporto.travel/pt-PT/sao-joao-the-porto-celebration' }],
  },
  {
    id: 'san-fermin', name: 'San Fermín', place: 'Pamplona, Espanha',
    category: 'evento', basis: 'recorrencia', rule: fixed(7, 6, 7, 14), airports: airports('PNA', .50),
    note: 'De 6 a 14 de julho, conforme o calendário permanente da prefeitura.',
    sources: [{ title: 'Prefeitura de Pamplona · abertura e encerramento', url: 'https://www.pamplona.es/en/turismo/sanfermin/chupinazo' }],
  },
  {
    id: 'inti-raymi', name: 'Inti Raymi', place: 'Cusco, Peru',
    category: 'evento', basis: 'recorrencia', rule: fixed(6, 24), airports: airports('CUZ', .40), gateways: ['LIM'],
    note: 'Festa do Sol em 24 de junho; Lima participa como possível conexão, sem bônus em todas as suas rotas.',
    sources: [{ title: 'EMUFEC · data anual do Inti Raymi', url: 'https://www.emufec.gob.pe/inti-raymi' }],
  },
  {
    id: 'oktoberfest-munich', name: 'Oktoberfest de Munique', place: 'Munique, Alemanha',
    category: 'evento', basis: 'projecao', rule: { kind: 'oktoberfest' }, airports: airports('MUC', .25),
    confirmed: { 2026: ['2026-09-19', '2026-10-04'], 2027: ['2027-09-18', '2027-10-03'] },
    note: 'Regra usual: sábado após 15 de setembro até o primeiro domingo de outubro. Extensões futuras por 3 de outubro dependem de decisão municipal.',
    sources: [{ title: 'Organização da Oktoberfest · recorrência e datas de 2027',
      url: 'https://www.oktoberfest.de/en/information/service-for-visitors/faqs-for-wiesn-visitors' }],
  },
  {
    id: 'edinburgh-fringe', name: 'Edinburgh Festival Fringe', place: 'Edimburgo, Reino Unido',
    category: 'evento', basis: 'projecao', rule: { kind: 'weekday', month: 8, weekday: 5, nth: 1, duration: 25 },
    airports: airports('EDI', .35),
    confirmed: { 2027: ['2027-08-06', '2027-08-30'] },
    note: '2027 tem datas anunciadas. Nos demais anos, agosto é projetado a partir da primeira sexta-feira.',
    sources: [{ title: 'Edinburgh Festival Fringe · edição 2027', url: 'https://www.edfringe.com/experience/explore-the-fringe/what-is-the-edinburgh-festival-fringe/' }],
  },
  {
    id: 'songkran', name: 'Songkran', place: 'Tailândia',
    category: 'evento', basis: 'recorrencia', rule: fixed(4, 13, 4, 15),
    airports: [...airports('CNX', .35), ...airports('BKK DMK HKT', .20)],
    note: 'Ano-novo tailandês, de 13 a 15 de abril. A programação ampliada de cada cidade varia por edição.',
    sources: [{ title: 'Autoridade de Turismo da Tailândia · datas fixas de Songkran',
      url: 'https://www.tatnews.org/2021/03/thailands-songkran-festival-its-origins-history-and-modern-day-observance/' }],
  },
  {
    id: 'golden-week', name: 'Golden Week', place: 'Japão',
    category: 'ferias', basis: 'recorrencia', rule: fixed(4, 29, 5, 5),
    airports: airports('HND NRT KIX ITM CTS FUK OKA', .25),
    note: 'Núcleo anual de 29 de abril a 5 de maio. Dias substitutivos e folgas específicas são absorvidos pela janela semanal do jogo.',
    sources: [{ title: 'JNTO · Golden Week', url: 'https://www.japan.travel/pt/spot/1834/' }],
  },
  {
    id: 'dia-muertos', name: 'Día de Muertos', place: 'Cidade do México, Oaxaca e Michoacán',
    category: 'evento', basis: 'recorrencia', rule: fixed(11, 1, 11, 2),
    airports: [...airports('OAX MLM', .35), ...airports('MEX', .18)],
    note: 'Celebrações tradicionais de 1 e 2 de novembro. Não fixa a data do desfile da Cidade do México, que muda a cada edição.',
    sources: [{ title: 'Secretaría de Cultura · datas e tradições do Día de Muertos',
      url: 'https://www.gob.mx/cultura/prensa/mexico-se-prepara-para-celebrar-a-sus-muertos' },
      { title: 'Visit México · Oaxaca e região de Pátzcuaro', url: 'https://visitmexico.sectur.gob.mx/blog/post/dia-de-muertos' }],
  },
  {
    id: 'verao-europa', name: 'Verão · litoral e ilhas da Europa', place: 'Croácia, ilhas gregas, Baleares, Algarve, Córsega e sul da Itália',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(7, 1, 8, 31),
    airports: [...airports('DBV SPU PUY HER RHO CFU JTR JMK KGS', .30), ...airports('PMI IBZ FAO', .28), ...airports('AJA BIA SUF BRI BDS OLB CAG', .25)],
    note: 'Julho e agosto concentram o turismo nessas regiões. A seleção de aeroportos traduz as regiões turísticas para o mapa do jogo; não representa um calendário escolar único europeu.',
    sources: [{ title: 'Eurostat · sazonalidade turística regional, incluindo litoral e ilhas',
      url: 'https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/111235.pdf' },
      { title: 'Eurostat · pico turístico de julho e agosto', url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260707-1' }],
  },
  {
    id: 'inverno-alpes', name: 'Férias de inverno · Alpes austríacos', place: 'Tirol e Salzburgo, Áustria',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(2, 1, 3, 0), airports: airports('INN SZG', .25),
    note: 'Fevereiro é o pico turístico documentado nessas regiões. A janela inclui todo fevereiro, inclusive dia 29, sem tratar todas as escolas como se tivessem as mesmas férias.',
    sources: [{ title: 'Eurostat · pico de fevereiro em Tirol e Salzburgo', url: 'https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/111235.pdf' }],
  },
  {
    id: 'verao-orlando', name: 'Férias de verão · Orlando', place: 'Orlando, Estados Unidos',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(6, 1, 8, 31), airports: airports('MCO SFB', .25),
    note: 'Temporada familiar dos parques, modelada entre junho e agosto. As datas dos recessos variam entre distritos escolares; não replica eventos esportivos que ocorreram somente em 2026.',
    sources: [{ title: 'Visit Orlando · temporada turística de verão',
      url: 'https://www.visitorlando.org/media/press-releases/post/orlando-delivers-a-summer-filled-with-headline-concerts-vibrant-festivals-and-new-attractions/' }],
  },
  {
    id: 'mardi-gras', name: 'Mardi Gras', place: 'Nova Orleans, Estados Unidos',
    category: 'evento', basis: 'recorrencia', rule: { kind: 'easter', startOffset: -54, endOffset: -47 }, airports: airports('MSY', .40),
    note: 'Semana que antecede a terça-feira de Carnaval, 47 dias antes da Páscoa. O calendário do jogo destaca o pico, embora a temporada cultural comece em 6 de janeiro.',
    sources: [{ title: 'New Orleans & Company · regra anual e pico dos desfiles',
      url: 'https://www.neworleans.com/events/holidays-seasonal/mardi-gras/the-ultimate-mardi-gras-guide/' }],
  },
  {
    id: 'inverno-argentina', name: 'Férias de inverno · Argentina', place: 'Bariloche, Ushuaia, Iguazú, Salta e Mendoza',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(7, 1, 7, 31),
    airports: [...airports('BRC USH', .30), ...airports('IGR SLA MDZ', .20)],
    note: 'Julho é a janela turística modelada. As províncias distribuem seus recessos em datas distintas; o bônus não afirma um calendário escolar nacional uniforme.',
    sources: [{ title: 'Secretaria de Turismo da Argentina · resultados das férias de inverno de 2026',
      url: 'https://www.argentina.gob.ar/noticias/vacaciones-de-invierno-212-billones-de-impacto-economico-un-25-mas-que-en-2025' }],
  },
  {
    id: 'verao-cabo', name: 'Férias de verão · Cidade do Cabo', place: 'Cidade do Cabo, África do Sul',
    category: 'ferias', basis: 'regra-do-jogo', rule: fixed(12, 1, 1, 31), airports: airports('CPT', .25),
    note: 'Pico de dezembro e janeiro da temporada de verão, que tem movimento também nos meses adjacentes. A janela é uma simplificação turística para a malha semanal.',
    sources: [{ title: 'Cape Town Tourism · temporadas ao longo do ano', url: 'https://www.capetown.travel/the-best-time-of-year-to-visit-cape-town/' },
      { title: 'Cape Town Tourism · procura nas férias de dezembro', url: 'https://www.capetown.travel/cape-town-tourism-reflects-on-a-vibrant-festive-season-awaiting-final-performance-metrics/' }],
  },
  {
    id: 'sinulog', name: 'Sinulog', place: 'Cebu, Filipinas',
    category: 'evento', basis: 'recorrencia', rule: { kind: 'weekday', month: 1, weekday: 0, nth: 3, duration: 1 },
    airports: airports('CEB', .40), afterDays: 1, confirmed: { 2026: ['2026-01-18', '2026-01-18'] },
    note: 'Celebração principal no terceiro domingo de janeiro, com a semana seguinte incluída para o retorno.',
    sources: [{ title: 'Sinulog Foundation · recorrência no terceiro domingo de janeiro', url: 'https://www.sinulogfoundationinc.com/' },
      { title: 'Governo de Cebu · desfile oficial de 2026', url: 'https://www.cebu.gov.ph/9118/cebu-officials-open-grand-sinulog-parade-2026-at-cebu-city-sports-center/' }],
  },
  {
    id: 'reveillon-sydney', name: 'Réveillon de Sydney', place: 'Sydney, Austrália',
    category: 'evento', basis: 'recorrencia', rule: fixed(12, 31, 1, 1), airports: airports('SYD', .25),
    note: 'Virada de 31 de dezembro para 1º de janeiro, aplicada às semanas envolvidas.',
    sources: [{ title: 'City of Sydney · programação oficial do Réveillon', url: 'https://www.sydneynewyearseve.com/fireworks' },
      { title: 'Governo de NSW · Réveillon de 31 de dezembro', url: 'https://www.nsw.gov.au/visiting-and-exploring-nsw/nsw-events/new-years-eve-sydney' }],
  },
]
