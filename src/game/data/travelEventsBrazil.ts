import { event as e, fixed as f, weekday as w, easter as p, edition as c } from './travelEventHelpers'

const gramado = 'https://gramadotur.rs.gov.br/'
const barretos = 'https://turismo.barretos.sp.gov.br/agenda-de-eventos'
const joinville = 'https://www.joinville.sc.gov.br/noticias/festival-de-danca-de-joinville-e-62a-festa-do-colono-sao-destaques-da-agenda-cultural/'
export const BRAZIL_EVENTS = [
  e('joinville-danca', 'Festival de Dança de Joinville', 'Joinville, Santa Catarina', 'JOI', .45, f(7, 20, 8, 1), 'https://www.joinville.sc.gov.br/noticias/palcos-abertos-em-espacos-publicos-espalham-danca-por-joinville-durante-o-43o-festival-de-danca/', c(2026, '07-20', '08-01')),
  e('joinville-colono', 'Festa do Colono de Joinville', 'Joinville, Santa Catarina', 'JOI', .15, w(7, 5, 3, 3), joinville, c(2026, '07-17', '07-19')),
  e('campos-inverno', 'Festival de Inverno de Campos do Jordão', 'Campos do Jordão, São Paulo', 'SJK', .25, f(7, 1, 7, 31), 'https://camposdojordao.sp.gov.br/noticias/?c=21&i=2874'),
  e('gramado-cinema', 'Festival de Cinema de Gramado', 'Gramado, Rio Grande do Sul', 'CXJ POA', .22, f(8, 7, 8, 21), gramado, c(2027, '08-07', '08-21')),
  e('gramado-concert', 'Gramado in Concert', 'Gramado, Rio Grande do Sul', 'CXJ POA', .16, f(1, 18, 1, 30), gramado, c(2027, '01-18', '01-30')),
  e('gramado-vindima', 'Vindima de Gramado', 'Gramado, Rio Grande do Sul', 'CXJ POA', .15, f(1, 8, 2, 28), gramado, c(2027, '01-08', '02-28')),
  e('gramado-chocopascoa', 'Chocopáscoa Gramado', 'Gramado, Rio Grande do Sul', 'CXJ POA', .22, p(-17, 24), gramado, c(2027, '03-11', '04-21')),
  e('gramado-colonia', 'Festa da Colônia de Gramado', 'Gramado, Rio Grande do Sul', 'CXJ POA', .18, f(4, 30, 5, 30), gramado, c(2027, '04-30', '05-30')),
  e('lages-pinhao', 'Festa Nacional do Pinhão', 'Lages, Santa Catarina', 'LAJ', .35, f(5, 22, 6, 7), 'https://www.lages.sc.gov.br/noticia-descricao/9390/confira-a-programacao-completa-da-36%C2%AA-festa-nacional-do-pinhao', c(2026, '05-22', '06-07')),
  e('fenarreco', 'Fenarreco', 'Brusque, Santa Catarina', 'NVT', .25, f(10, 8, 10, 18), 'https://www.brusque.sc.gov.br/cidadao/noticia/faltam-100-dias-para-a-39-fenarreco', c(2026, '10-08', '10-18')),
  e('barretos-peao', 'Festa do Peão de Barretos', 'Barretos, São Paulo', 'SJP RAO', .22, f(8, 20, 8, 30), barretos),
  e('barretos-motor', 'Barretos Motorcycles', 'Barretos, São Paulo', 'SJP RAO', .12, f(4, 30, 5, 2), barretos, c(2026, '04-30', '05-02')),
  e('trindade-romaria', 'Romaria do Divino Pai Eterno', 'Trindade, Goiás', 'GYN', .35, w(7, 0, 1, 10, -9), 'https://trindade.go.gov.br/romaria-do-divino-pai-eterno-2026-entra-na-reta-final-com-grandes-shows-tradicoes-e-manifestacoes-de-fe/'),
  e('pirenopolis-cavalhadas', 'Cavalhadas de Pirenópolis', 'Pirenópolis, Goiás', 'GYN', .20, p(49, 51), 'https://goias.gov.br/cultura/circuito-cavalhadas/', c(2026, '05-24', '05-26')),
  e('garanhuns-inverno', 'Festival de Inverno de Garanhuns', 'Garanhuns, Pernambuco', 'REC', .12, f(7, 9, 7, 26), 'https://garanhuns.pe.gov.br/festival-de-inverno-de-garanhuns-inicia-sua-34a-edicao-nesta-quinta-feira-09/',
    { note: 'Projeção da temporada de julho. Recife é acesso terrestre regional; o bônus é menor que o de um aeroporto no destino.' }),
  e('fortal', 'Fortal', 'Fortaleza, Ceará', 'FOR', .25, w(7, 4, 4, 4), 'https://fortal.com.br/2026/', c(2026, '07-23', '07-26')),
  e('mossoro-junina', 'Mossoró Cidade Junina', 'Mossoró, Rio Grande do Norte', 'MVF', .45, f(6, 1, 6, 30), 'https://dom.mossoro.rn.gov.br/dom/ato/33196'),
  e('amazonas-opera', 'Festival Amazonas de Ópera', 'Manaus, Amazonas', 'MAO', .18, f(4, 19, 5, 31), 'https://cultura.am.gov.br/wp-content/uploads/2026/04/01-PROGRAMACAO-EXTERNA-ABRIL-2026-atual.-31.03.2026-1.pdf'),
  e('flip', 'FLIP · Festa Literária de Paraty', 'Paraty, Rio de Janeiro', 'GIG', .10, w(7, 3, 4, 5), 'https://flip.org.br/evento/flip-2026/', { ...c(2026, '07-22', '07-26'), note: 'Galeão é acesso aéreo seguido de deslocamento terrestre a Paraty. Datas futuras projetadas.' }),
  e('bonito-inverno', 'Festival de Inverno de Bonito', 'Bonito, Mato Grosso do Sul', 'BYO', .45, w(8, 3, -1, 5), 'https://www.bonito.ms.gov.br/2026/08/26/festival-de-inverno-de-bonito-comeca-hoje-com-abertura-oficial-e-grandes-atracoes/', c(2026, '08-26', '08-30')),
  e('expointer', 'Expointer', 'Esteio, Rio Grande do Sul', 'POA', .22, w(8, 6, -1, 9), 'https://www.expointer.rs.gov.br/edicao-49-da-expointer-e-lancada-no-palacio-piratini', c(2026, '08-29', '09-06')),
]
