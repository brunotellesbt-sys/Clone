import { event as e, fixed as f, weekday as w, easter as p, recurring as r, edition as c } from './travelEventHelpers'

const quebec = 'https://www.quebec-cite.com/en/what-to-do-quebec-city/events'
const argentina = 'https://argentina.travel/novedades/4-fiestas-populares-que-hay-que-vivir-al-menos-una-vez-en-la-vida-en-argentina'
const newOrleans = 'https://www.neworleans.com/things-to-do/festivals/music-festivals/'
export const AMERICAS_EVENTS = [
  e('nola-jazz', 'New Orleans Jazz & Heritage Festival', 'Nova Orleans, Estados Unidos', 'MSY', .30, w(4, 4, -1, 11), newOrleans),
  e('nola-essence', 'ESSENCE Festival', 'Nova Orleans, Estados Unidos', 'MSY', .30, f(7, 3, 7, 5), newOrleans),
  e('french-quarter', 'French Quarter Festival', 'Nova Orleans, Estados Unidos', 'MSY', .25, w(4, 4, 3, 4), 'https://www.neworleans.com/articles/post/french-quarter-festival-2026-unveils-full-music-lineup-culinary-delights-and-exciting-highlights/', c(2026, '04-16', '04-19')),
  e('albuquerque-balloons', 'Albuquerque Balloon Fiesta', 'Albuquerque, Estados Unidos', 'ABQ', .40, w(10, 6, 1, 9), 'https://www.balloonfiesta.com/latest-news-and-updates/balloon-fiesta-tickets-to-go-on-sale-april-3/', c(2026, '10-03', '10-11')),
  e('boston-marathon', 'Maratona de Boston', 'Boston, Estados Unidos', 'BOS', .18, w(4, 1, 3), 'https://www.baa.org/news/bib-numbers-start-assignments-wave-times-announced-for-130th-boston-marathon-presented-by-bank-of-america/', c(2026, '04-20')),
  e('sxsw', 'SXSW', 'Austin, Estados Unidos', 'AUS', .30, f(3, 12, 3, 18), 'https://www.sxsw.com/wp-content/uploads/2025/10/SXSW-2026-Season-Launch-Press-Release-1.pdf', c(2026, '03-12', '03-18')),
  e('san-diego-comic-con', 'San Diego Comic-Con', 'San Diego, Estados Unidos', 'SAN', .28, w(7, 4, 4, 5, -1), 'https://www.comic-con.org/exclusives-portal-faq/', c(2026, '07-22', '07-26')),
  e('calgary-stampede', 'Calgary Stampede', 'Calgary, Canadá', 'YYC', .30, w(7, 5, 1, 10), 'https://www.calgarystampede.com/stampede/parade', c(2026, '07-03', '07-12')),
  e('winterlude', 'Winterlude / Bal de Neige', 'Ottawa e Gatineau, Canadá', 'YOW', .25, w(1, 5, -1, 18), 'https://www.canada.ca/en/canadian-heritage/news/2026/01/winterlude-2026-programming-has-been-unveiled.html', c(2026, '01-30', '02-16')),
  e('quebec-carnaval', 'Carnaval de Québec', 'Québec, Canadá', 'YQB', .35, w(2, 5, 1, 10), quebec, c(2027, '02-05', '02-14')),
  e('quebec-peewee', 'Torneio Internacional Pee-Wee de Québec', 'Québec, Canadá', 'YQB', .20, w(2, 3, 2, 12), quebec, c(2027, '02-10', '02-21')),
  e('wendake-powwow', 'Wendake International Pow Wow', 'Wendake, Canadá', 'YQB', .20, w(7, 5, 1, 3), quebec, c(2027, '07-02', '07-04')),
  e('quebec-ete', 'Festival d’été de Québec', 'Québec, Canadá', 'YQB', .35, w(7, 4, 2, 11), quebec, c(2027, '07-08', '07-18')),
  e('nouvelle-france', 'Fêtes de la Nouvelle-France', 'Québec, Canadá', 'YQB', .22, w(8, 4, 1, 4), quebec, c(2027, '08-05', '08-08')),
  e('quebec-cycliste', 'Grand Prix Cycliste de Québec', 'Québec, Canadá', 'YQB', .18, w(9, 5, 2), quebec, c(2027, '09-10')),
  e('montreal-jazz', 'Festival International de Jazz de Montréal', 'Montreal, Canadá', 'YUL', .25, f(6, 25, 7, 4), 'https://www.mtl.org/en/experience/jazz-festival', c(2026, '06-25', '07-04')),
  e('cervantino', 'Festival Internacional Cervantino', 'Guanajuato, México', 'BJX', .30, f(10, 3, 10, 18), 'https://festivalcervantino.gob.mx/20260720/directorio/', c(2026, '10-03', '10-18')),
  e('guelaguetza', 'Guelaguetza', 'Oaxaca, México', 'OAX', .45, f(7, 18, 7, 31), 'https://www.oaxaca.gob.mx/comunicacion/invita-gobierno-del-estado-a-vivir-julio-mes-de-la-guelaguetza-2026-con-multiples-actividades/'),
  e('san-marcos', 'Feria Nacional de San Marcos', 'Aguascalientes, México', 'AGU', .35, f(4, 18, 5, 10), 'https://informacion.aguascalientes.gob.mx/news/circuito-sanmarque%C3%B1o-y-taxi-seguro-facilitan-traslados-en-la-feria', c(2026, '04-18', '05-10')),
  e('cosquin-folklore', 'Festival Nacional de Folklore de Cosquín', 'Cosquín, Argentina', 'COR', .25, w(1, 6, 4, 9), 'https://www.argentina.travel/sobre-argentina/eventos/festival-nacional-de-folklore-de-cosquin'),
  e('cosquin-rock', 'Cosquín Rock', 'Santa María de Punilla, Argentina', 'COR', .25, w(2, 6, 2, 2), 'https://www.argentina.travel/novedades/festival-cosquin-rock-musica-cultura-y-turismo-en-cordoba'),
  e('chamame', 'Fiesta Nacional del Chamamé', 'Corrientes, Argentina', 'CNQ', .35, f(1, 16, 1, 25), argentina),
  e('mendoza-vendimia', 'Fiesta Nacional de la Vendimia', 'Mendoza, Argentina', 'MDZ', .35, f(2, 26, 3, 9), 'https://www.argentina.travel/sobre-argentina/eventos/festa-nacional-da-vendimia'),
  e('barranquilla-carnaval', 'Carnaval de Barranquilla', 'Barranquilla, Colômbia', 'BAQ', .45, p(-50, -47), 'https://colombia.travel/en/fairs-and-festivals/carnival-barranquilla', r),
  e('pasto-carnaval', 'Carnaval de Negros y Blancos', 'Pasto, Colômbia', 'PSO', .45, f(1, 2, 1, 6), 'https://colombia.travel/es/pasto/carnaval-de-negros-y-blancos', r),
  e('cali-feria', 'Feria de Cali', 'Cali, Colômbia', 'CLO', .35, f(12, 25, 12, 30), 'https://colombia.travel/es/cali/disfruta-de-la-feria-de-cali', r),
  e('medellin-flores', 'Feria de las Flores', 'Medellín, Colômbia', 'MDE EOH', .30, f(8, 1, 8, 10), 'https://colombia.travel/es/ferias-y-fiestas/feria-de-las-flores'),
  e('petronio-alvarez', 'Festival Petronio Álvarez', 'Cali, Colômbia', 'CLO', .25, f(8, 14, 8, 19), 'https://colombia.travel/es/ferias-y-fiestas/festival-petronio-alvarez', c(2026, '08-14', '08-19')),
  e('puno-candelaria', 'Virgen de la Candelaria', 'Puno, Peru', 'JUL', .45, f(2, 1, 2, 14), 'https://www.peru.travel/events/virgin-of-candelaria-festival'),
  e('tapati', 'Tapati Rapa Nui', 'Rapa Nui, Chile', 'IPC', .45, f(2, 1, 2, 14), 'https://chile.travel/blog/competencias-ancestrales-en-tapati-tradicion-fuerza-y-cultura/'),
  e('crop-over', 'Crop Over', 'Bridgetown, Barbados', 'BGI', .30, f(7, 3, 8, 4), 'https://www.visitbarbados.org/crop-over-festival-2026', c(2026, '07-03', '08-04')),
  e('trinidad-carnaval', 'Carnaval de Trinidad', 'Port of Spain, Trinidad e Tobago', 'POS', .45, p(-48, -47), 'https://visittrinidad.tt/things-to-do/carnival/', { ...r, ...c(2027, '02-08', '02-09') }),
]
