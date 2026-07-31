const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats the API's fixed-2-decimal wire string (e.g. "1234.50") as pt-BR
 * currency (e.g. "R$ 1.234,50") — the dashboard previously concatenated
 * "R$ " onto the raw dot-decimal string ("R$ 1234.50"), which is not valid
 * pt-BR formatting. Every money value on screen goes through this.
 */
export function formatBRL(value: string): string {
  return formatter.format(Number(value));
}
