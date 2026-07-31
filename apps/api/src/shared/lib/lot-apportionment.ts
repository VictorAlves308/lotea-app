import { Prisma } from '../../generated/prisma/client.ts';

/**
 * A locally-scoped, higher-precision Decimal flavor for the intermediate
 * proportional-share math below — 40 significant digits comfortably clears
 * the ~20-digit product of two Decimal(10,2)-bounded values (an amount in
 * cents times a lot's weight), so the floor/fraction computation can never be
 * thrown off by precision truncation landing just short of an exact integer.
 * Cloned rather than a global `Decimal.set()` change, so it can never affect
 * money math anywhere else in the app.
 */
const HighPrecisionDecimal = Prisma.Decimal.clone({ precision: 40 });

export interface WeightEntry {
  key: string;
  weight: Prisma.Decimal;
}

/**
 * Splits `amount` (a real money value, e.g. a sale's outstanding balance)
 * across `weights` (e.g. that sale's lots, weighted by each lot's share of
 * the sale's items) using the largest-remainder method — the parts always
 * sum back to exactly `amount`, to the cent, never floating point.
 *
 * Used only in read-only query/presentation code (see DATABASE.md, "Lot
 * composition"): it never changes FIFO, never associates a payment with a
 * lot, and creates no new financial entity — it only decides how an already-
 * computed amount is broken out for display.
 *
 * Tie-break when the leftover cents can't be split evenly: the entry whose
 * exact share was rounded down the *most* (largest fractional remainder)
 * gets the next cent first — the standard Hamilton/largest-remainder
 * apportionment rule. A tie on that is broken by the larger weight, and a
 * full tie by ascending `key` (expected to be a UUID — a total order), so
 * the result is always fully deterministic: the same inputs always produce
 * the same output.
 */
export function apportionAmountByWeight(
  amount: Prisma.Decimal,
  weights: WeightEntry[],
): Map<string, Prisma.Decimal> {
  const result = new Map<string, Prisma.Decimal>();
  if (weights.length === 0) return result;

  if (amount.lessThanOrEqualTo(0)) {
    for (const { key } of weights) result.set(key, new Prisma.Decimal(0));
    return result;
  }

  const totalWeight = weights.reduce(
    (sum, entry) => sum.plus(entry.weight),
    new HighPrecisionDecimal(0),
  );
  if (totalWeight.lessThanOrEqualTo(0)) {
    // No meaningful basis to apportion by — every weight is zero. Callers
    // should never hit this in practice (a sale's weights sum to its own
    // total, which is > 0 whenever there's a nonzero amount to apportion).
    for (const { key } of weights) result.set(key, new Prisma.Decimal(0));
    return result;
  }

  const amountCents = new HighPrecisionDecimal(amount).times(100);

  const shares = weights.map((entry) => {
    const rawShareCents = amountCents.times(entry.weight).dividedBy(totalWeight);
    const floorShareCents = rawShareCents.floor();
    return {
      key: entry.key,
      weight: entry.weight,
      floorShareCents,
      fraction: rawShareCents.minus(floorShareCents),
    };
  });

  const sumFloors = shares.reduce(
    (sum, share) => sum.plus(share.floorShareCents),
    new HighPrecisionDecimal(0),
  );
  // Always a small non-negative integer, strictly less than weights.length —
  // flooring never loses a whole cent per entry.
  const remainderCents = amountCents.minus(sumFloors).round().toNumber();

  const sorted = [...shares].sort((a, b) => {
    const fractionOrder = b.fraction.comparedTo(a.fraction);
    if (fractionOrder !== 0) return fractionOrder;
    const weightOrder = b.weight.comparedTo(a.weight);
    if (weightOrder !== 0) return weightOrder;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  const getsExtraCent = new Set(sorted.slice(0, remainderCents).map((share) => share.key));

  for (const share of shares) {
    const finalCents = getsExtraCent.has(share.key)
      ? share.floorShareCents.plus(1)
      : share.floorShareCents;
    result.set(share.key, new Prisma.Decimal(finalCents.dividedBy(100).toFixed(2)));
  }

  return result;
}
