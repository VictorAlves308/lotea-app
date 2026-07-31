/** Accepts "29,90", "29.9", "R$ 29,90" — normalizes to the "29.90" wire format `moneySchema` requires. Returns null if unparseable. */
export function normalizeMoneyInput(raw: string): string | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value >= 0 ? value.toFixed(2) : null;
}
