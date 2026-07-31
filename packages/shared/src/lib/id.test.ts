import { describe, expect, it } from 'vitest';

import { generateId } from './id';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('returns a valid UUIDv7 string', () => {
    expect(generateId()).toMatch(UUID_V7_PATTERN);
  });

  it('returns time-ordered ids: a later call sorts lexicographically after an earlier one', () => {
    const first = generateId();
    const second = generateId();
    expect(first < second).toBe(true);
  });

  it('never returns the same id twice', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});
