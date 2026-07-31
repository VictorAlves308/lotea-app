import { describe, expect, it } from 'vitest';

import { formatMoney, toMoney } from './decimal';

describe('toMoney', () => {
  it('parses a valid wire-format money string', () => {
    expect(toMoney('149.90').toString()).toBe('149.9');
  });

  it('rejects a bare integer without decimal places', () => {
    expect(() => toMoney('150')).toThrow(/Invalid money string/);
  });

  it('rejects scientific notation', () => {
    expect(() => toMoney('1.5e2')).toThrow(/Invalid money string/);
  });

  it('never loses precision the way a JS float would', () => {
    // 0.1 + 0.2 !== 0.3 in native JS floating point; Decimal must not repeat that mistake.
    const total = toMoney('0.10').plus(toMoney('0.20'));
    expect(formatMoney(total)).toBe('0.30');
  });
});

describe('formatMoney', () => {
  it('always renders exactly two decimal places', () => {
    expect(formatMoney(10)).toBe('10.00');
    expect(formatMoney('10.5')).toBe('10.50');
  });
});
