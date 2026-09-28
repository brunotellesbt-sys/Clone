import { event as e, fixed as f, weekday as w, edition as c } from './travelEventHelpers'

const australia = 'https://www.australia.com/en-us/events/australias-events-calendar.html'
const wellington = 'https://www.newzealand.com/int/wellington/'
export const AFRICA_OCEANIA_EVENTS = [
  e('gnaoua', 'Festival Gnaoua', 'Essaouira, Marrocos', 'ESU', .45, w(6, 4, -1, 3), 'https://www.festival-gnaoua.net/wp-content/uploads/2026/06/lineup-festival-gnaoua-et-musique-du-monde-2026.pdf', c(2026, '06-25', '06-27')),
  e('fes-sacred', 'Festival de Músicas Sacras de Fès', 'Fès, Marrocos', 'FEZ', .30, w(6, 4, 1, 4), 'https://fesfestival.com/2026-/programme/', c(2026, '06-04', '06-07')),
  e('mawazine', 'Mawazine', 'Rabat, Marrocos', 'RBA', .35, w(6, 5, 3, 9), 'https://www.mawazine.ma/fr', c(2026, '06-19', '06-27')),
  e('jazzablanca', 'Jazzablanca', 'Casablanca, Marrocos', 'CMN', .20, w(7, 4, 1, 10), 'https://www.jazzablanca.com/programme', c(2026, '07-02', '07-11')),
  e('carthage', 'Festival Internacional de Cartago', 'Cartago, Tunísia', 'TUN', .22, f(7, 16, 8, 17), 'https://festivaldecarthage.tn/dix-ans-apres-cheb-khaled-retrouve-la-scene-de-carthage-pour-la-60%E1%B5%89-edition-du-festival-international-de-carthage/'),
  e('sauti-busara', 'Sauti za Busara', 'Zanzibar, Tanzânia', 'ZNZ', .35, w(2, 4, 1, 4), 'https://busaramusic.org/Newsletters/20251231-ENG.html', c(2026, '02-05', '02-08')),
  e('saint-louis-jazz', 'Saint-Louis Jazz', 'Saint-Louis, Senegal · acesso terrestre por Dakar', 'DSS', .10, w(5, 3, 2, 5), 'https://www.saintlouisjazz.org/', c(2026, '05-13', '05-17')),
  e('asa-baako', 'Asa Baako', 'Busua, Gana', 'TKD', .30, f(3, 5, 3, 8), 'https://visitghana.com/events/list/?tribe-bar-date=2026-03-08', c(2026, '03-05', '03-08')),
  e('akple', 'Akple Festival', 'Accra, Gana', 'ACC', .15, f(3, 6), 'https://visitghana.com/events/list/?tribe-bar-date=2026-03-03', c(2026, '03-06')),
  e('cape-town-jazz', 'Cape Town International Jazz Festival', 'Cidade do Cabo, África do Sul', 'CPT', .25, w(3, 5, -1, 2), 'https://www.capetown.travel/where-to-see-live-jazz-in-cape-town/', c(2026, '03-27', '03-28')),
  e('knysna-oyster', 'Knysna Oyster Festival', 'Knysna, África do Sul', 'GRJ', .30, w(7, 5, 1, 10), 'https://www.capetown.travel/event/knysna-oyster-festival-2026/', c(2026, '07-03', '07-12')),
  e('franschhoek-bastille', 'Franschhoek Bastille Festival', 'Franschhoek, África do Sul', 'CPT', .15, w(7, 6, 2, 2), 'https://www.capetown.travel/whats-on-in-cape-town-in-july-2026/', c(2026, '07-11', '07-12')),
  e('national-arts-sa', 'National Arts Festival', 'Makhanda, África do Sul', 'PLZ', .25, w(6, 4, -1, 11), 'https://nationalartsfestival.co.za/home-26/', c(2026, '06-25', '07-05')),
  e('shinju-matsuri', 'Shinju Matsuri', 'Broome, Austrália', 'BME', .35, f(8, 21, 9, 6), australia, c(2026, '08-21', '09-06')),
  e('taste-bundaberg', 'Taste Bundaberg Festival', 'Bundaberg, Austrália', 'BDB', .25, w(9, 5, 1, 10), australia, c(2026, '09-04', '09-13')),
  e('brisbane-festival', 'Brisbane Festival', 'Brisbane, Austrália', 'BNE', .20, w(9, 5, 1, 23), australia, c(2026, '09-04', '09-26')),
  e('birdsville-races', 'Birdsville Races', 'Birdsville, Austrália', 'BVI', .60, w(9, 5, 1, 2), australia, c(2026, '09-04', '09-05')),
  e('desert-mob', 'Desert Mob', 'Alice Springs, Austrália', 'ASP', .25, f(9, 10, 10, 25), australia, c(2026, '09-10', '10-25')),
  e('afl-final', 'AFL Grand Final', 'Melbourne, Austrália', 'MEL AVV', .20, w(9, 6, -1), australia, c(2026, '09-26')),
  e('vivid-sydney', 'Vivid Sydney', 'Sydney, Austrália', 'SYD', .20, f(5, 22, 6, 13), 'https://www.vividsydney.com/info/contact-us', c(2026, '05-22', '06-13')),
  e('adelaide-fringe', 'Adelaide Fringe', 'Adelaide, Austrália', 'ADL', .35, f(2, 19, 3, 21), 'https://avr.adelaidefringe.com.au/support/articles/plan/key-dates', c(2027, '02-19', '03-21')),
  e('australian-open', 'Australian Open', 'Melbourne, Austrália', 'MEL AVV', .30, w(1, 1, 2, 21), 'https://ausopen.com/articles/news/australian-open-2027-dates-announced', c(2027, '01-11', '01-31')),
  e('floriade-canberra', 'Floriade Canberra', 'Canberra, Austrália', 'CBR', .25, w(9, 6, 2, 30), 'https://floriadeaustralia.com/faqs/', c(2026, '09-12', '10-11')),
  e('wellington-loemis', 'Lōemis', 'Wellington, Nova Zelândia', 'WLG', .18, f(6, 9, 6, 21), wellington, c(2026, '06-09', '06-21')),
  e('wellington-beervana', 'Beervana', 'Wellington, Nova Zelândia', 'WLG', .22, w(8, 5, 3, 2), wellington, c(2026, '08-21', '08-22')),
  e('wellington-plate', 'Wellington On a Plate', 'Wellington, Nova Zelândia', 'WLG', .22, f(8, 1, 8, 31), wellington, c(2026, '08-01', '08-31')),
  e('wearable-art', 'World of WearableArt', 'Wellington, Nova Zelândia', 'WLG', .30, f(9, 17, 10, 4), wellington, c(2026, '09-17', '10-04')),
  e('auckland-writers', 'Auckland Writers Festival', 'Auckland, Nova Zelândia', 'AKL', .18, w(5, 2, 2, 6), 'https://traveltrade.newzealand.com/news/autumn-events-new-zealand-2026/', c(2026, '05-12', '05-17')),
]
