const MONTH_ABBREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

/** e.g. "15 jul" — the compact day+month format used across lists (Clientes, Vendas). */
export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTH_ABBREV[date.getMonth()]}`;
}

/** "hoje" / "ontem" / "15 jul" — used for "Última compra: {{...}}"-style subtitles. */
export function formatRelativeDayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'hoje';
  if (isYesterday(date, now)) return 'ontem';
  return formatShortDate(date);
}
