import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { generateId } from '../lib/id';
import {
  idSchema,
  inventoryItemStatusSchema,
  inventoryMovementTypeSchema,
  moneySchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  saleStatusSchema,
} from './common.schema';

describe('idSchema', () => {
  it('accepts a generated UUIDv7', () => {
    expect(idSchema.safeParse(generateId()).success).toBe(true);
  });

  it('rejects a non-uuid string', () => {
    expect(idSchema.safeParse('not-an-id').success).toBe(false);
  });
});

describe('moneySchema', () => {
  it('accepts a two-decimal wire-format string', () => {
    expect(moneySchema.safeParse('149.90').success).toBe(true);
  });

  it('rejects a bare number', () => {
    expect(moneySchema.safeParse(149.9).success).toBe(false);
  });

  it('rejects a string with the wrong number of decimal places', () => {
    expect(moneySchema.safeParse('149.9').success).toBe(false);
  });
});

describe('inventoryItemStatusSchema', () => {
  it('accepts every documented lifecycle state', () => {
    for (const status of ['IN_STOCK', 'RESERVED', 'SOLD', 'WRITTEN_OFF']) {
      expect(inventoryItemStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects a loose string', () => {
    expect(inventoryItemStatusSchema.safeParse('in_stock').success).toBe(false);
  });
});

describe('inventoryMovementTypeSchema', () => {
  it('accepts every documented movement type', () => {
    for (const type of [
      'PURCHASE_ENTRY',
      'SALE',
      'RESERVATION',
      'RESERVATION_RELEASE',
      'RETURN',
      'MANUAL_ADJUSTMENT',
      'SALE_CANCELLATION',
      'WRITE_OFF',
    ]) {
      expect(inventoryMovementTypeSchema.safeParse(type).success).toBe(true);
    }
  });
});

describe('saleStatusSchema', () => {
  it('accepts every documented sale state', () => {
    for (const status of ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED']) {
      expect(saleStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});

describe('paginationQuerySchema', () => {
  it('defaults page and limit when omitted', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('coerces string query params to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '2', limit: '50' });
    expect(result).toEqual({ page: 2, limit: 50 });
  });

  it('rejects a limit above the cap', () => {
    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('paginatedResponseSchema', () => {
  it('wraps an item schema with pagination metadata', () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }));
    const result = schema.safeParse({ items: [{ id: 'a' }], page: 1, limit: 20, total: 1 });
    expect(result.success).toBe(true);
  });
});
