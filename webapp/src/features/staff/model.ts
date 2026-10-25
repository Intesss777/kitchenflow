export type CalendarCell = { date: string; day: number } | null

export function calendarCells(month: string): CalendarCell[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year!, monthNumber! - 1, 1))
  const days = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate()
  const mondayOffset = (first.getUTCDay() + 6) % 7
  const cells: CalendarCell[] = Array.from({ length: mondayOffset }, () => null)
  for (let day = 1; day <= days; day += 1) {
    cells.push({ day, date: `${month}-${String(day).padStart(2, '0')}` })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1)).toISOString().slice(0, 7)
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00.000Z`))
}
