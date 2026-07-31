import Decimal from 'decimal.js';

/**
 * The API's wire format for every monetary value: a plain decimal string with
 * exactly two places, e.g. "149.90". Never scientific notation, never a bare
 * JSON number. See ARCHITECTURE.md §6.4.
 */
export const MONEY_STRING_PATTERN = /^-?\d+\.\d{2}$/;

/** Parses a wire-format money string into a Decimal for safe arithmetic. Throws on anything else, including a plain JS number. */
export function toMoney(value: string): Decimal {
  if (!MONEY_STRING_PATTERN.test(value)) {
    throw new Error(
      `Invalid money string: "${value}". Expected a plain decimal with 2 places, e.g. "149.90".`,
    );
  }
  return new Decimal(value);
}

/** Formats a Decimal (or a value that can be parsed into one) back into the wire format. */
export function formatMoney(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}

export { Decimal };
