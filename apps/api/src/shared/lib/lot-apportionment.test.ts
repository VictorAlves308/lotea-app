import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.ts';
import { apportionAmountByWeight } from './lot-apportionment';

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

describe('apportionAmountByWeight', () => {
  it('gives a single lot the full amount, cent for cent, with no rounding artifact', () => {
    const result = apportionAmountByWeight(decimal('123.45'), [
      { key: 'lot-a', weight: decimal('999.00') },
    ]);
    expect(result.get('lot-a')?.toFixed(2)).toBe('123.45');
  });

  it('splits proportionally by weight when there is no rounding remainder', () => {
    // R$300 sale, R$150 paid, R$150 outstanding — lot 30 (R$100 of items,
    // 33.33%) and lot 32 (R$200 of items, 66.67%).
    const result = apportionAmountByWeight(decimal('150.00'), [
      { key: 'lot-30', weight: decimal('100.00') },
      { key: 'lot-32', weight: decimal('200.00') },
    ]);
    expect(result.get('lot-30')?.toFixed(2)).toBe('50.00');
    expect(result.get('lot-32')?.toFixed(2)).toBe('100.00');
  });

  it('resolves a full 3-way fraction tie deterministically: fraction desc, then weight desc, then key asc', () => {
    // amountCents=10, total weight=6: every lot's raw share ends in the same
    // .6666... fraction (weight 4 = weight 1 + total 3-multiple), so the two
    // leftover cents must be assigned by weight, then by key.
    const result = apportionAmountByWeight(decimal('0.10'), [
      { key: 'zzz-a', weight: decimal('1') },
      { key: 'mmm-b', weight: decimal('4') },
      { key: 'aaa-c', weight: decimal('1') },
    ]);
    expect(result.get('mmm-b')?.toFixed(2)).toBe('0.07'); // heaviest weight — first extra cent
    expect(result.get('aaa-c')?.toFixed(2)).toBe('0.02'); // tied weight with zzz-a, wins on key
    expect(result.get('zzz-a')?.toFixed(2)).toBe('0.01'); // no extra cent left
  });

  it('splits an equal 3-way tie by ascending key when weights also tie', () => {
    // R$100.00 across 3 equal-weight lots: 33.33... each — one leftover cent
    // must go to exactly one lot, deterministically the lowest key.
    const result = apportionAmountByWeight(decimal('100.00'), [
      { key: 'lot-c', weight: decimal('10.00') },
      { key: 'lot-a', weight: decimal('10.00') },
      { key: 'lot-b', weight: decimal('10.00') },
    ]);
    expect(result.get('lot-a')?.toFixed(2)).toBe('33.34');
    expect(result.get('lot-b')?.toFixed(2)).toBe('33.33');
    expect(result.get('lot-c')?.toFixed(2)).toBe('33.33');
  });

  it('never loses or duplicates a cent across many randomized weight sets', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      const lotCount = 1 + Math.floor(Math.random() * 5);
      const weights = Array.from({ length: lotCount }, (_, index) => ({
        key: `lot-${index}`,
        weight: decimal((1 + Math.floor(Math.random() * 10000) / 100).toFixed(2)),
      }));
      const amount = decimal((Math.floor(Math.random() * 10000000) / 100).toFixed(2));

      const result = apportionAmountByWeight(amount, weights);
      const sum = [...result.values()].reduce(
        (acc, value) => acc.plus(value),
        new Prisma.Decimal(0),
      );
      expect(sum.toFixed(2)).toBe(amount.toFixed(2));
    }
  });

  it('is deterministic — identical input always produces identical output', () => {
    const weights = [
      { key: 'lot-a', weight: decimal('37.00') },
      { key: 'lot-b', weight: decimal('41.00') },
      { key: 'lot-c', weight: decimal('19.00') },
    ];
    const amount = decimal('61.11');

    const toPlainObject = (map: Map<string, Prisma.Decimal>) =>
      Object.fromEntries([...map].map(([key, value]) => [key, value.toFixed(2)]));

    expect(toPlainObject(apportionAmountByWeight(amount, weights))).toEqual(
      toPlainObject(apportionAmountByWeight(amount, weights)),
    );
  });

  it('returns zero for every lot when the amount is zero', () => {
    const result = apportionAmountByWeight(decimal('0.00'), [
      { key: 'lot-a', weight: decimal('10.00') },
      { key: 'lot-b', weight: decimal('20.00') },
    ]);
    expect(result.get('lot-a')?.toFixed(2)).toBe('0.00');
    expect(result.get('lot-b')?.toFixed(2)).toBe('0.00');
  });
});
