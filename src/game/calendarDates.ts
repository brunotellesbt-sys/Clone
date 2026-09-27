/** Datas da simulação em UTC: nenhuma regra depende do fuso do navegador. */
export const DAY_MS = 86400000
export const utcDate = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)
export const gameDayDate = (day: number, startYear = 2027) => utcDate(startYear, 1, 1) + day * DAY_MS
export const mondayOf = (date: number) => date - ((new Date(date).getUTCDay() + 6) % 7) * DAY_MS
export const sundayOf = (date: number) => mondayOf(date) + 6 * DAY_MS
export const dayOfYearAt = (day: number, startYear = 2027) => {
  const date = gameDayDate(day, startYear)
  return (date - utcDate(new Date(date).getUTCFullYear(), 1, 1)) / DAY_MS
}

/** Calendário gregoriano (Meeus/Jones/Butcher), inclusive anos bissextos. */
export function easterDate(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  return utcDate(year, Math.floor((h + l - 7 * m + 114) / 31), (h + l - 7 * m + 114) % 31 + 1)
}

/** weekday segue UTC: domingo=0. nth=-1 escolhe a última ocorrência do mês. */
export function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  if (nth === -1) {
    const last = utcDate(year, month + 1, 0)
    return last - ((new Date(last).getUTCDay() - weekday + 7) % 7) * DAY_MS
  }
  const first = utcDate(year, month, 1)
  return first + (((weekday - new Date(first).getUTCDay() + 7) % 7) + 7 * (nth - 1)) * DAY_MS
}
