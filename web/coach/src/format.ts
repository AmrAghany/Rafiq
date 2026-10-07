/** "October 2026" for a YYYY-MM-01 period. */
export function monthName(period: string, language: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(language, { month: 'long', year: 'numeric' });
}

/** "7 Oct" for an ISO date or timestamp. */
export function shortDate(value: string, language: string) {
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

export const dash = (v: number | null | undefined, unit = '') =>
  v == null ? '–' : `${Number(v).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;
