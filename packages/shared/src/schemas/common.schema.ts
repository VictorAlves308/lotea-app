import { z } from 'zod';

import { MONEY_STRING_PATTERN } from '../lib/decimal';

/** Every entity id is a UUIDv7 string. See ARCHITECTURE.md §6.2. */
export const idSchema = z.string().uuid();

/** Matches the wire format for monetary values — see lib/decimal.ts. */
export const moneySchema = z
  .string()
  .regex(MONEY_STRING_PATTERN, 'Expected a decimal string with 2 places, e.g. "149.90"');

/**
 * Money that must never be negative — `moneySchema`'s own pattern permits a
 * leading `-` (needed elsewhere), but nothing about a payment or an amount
 * received should ever accept one. Zero is allowed (e.g. "received now: 0.00").
 */
export const nonNegativeMoneySchema = moneySchema.refine((value) => !value.startsWith('-'), {
  message: 'Must not be negative',
});

/** Money that must be strictly greater than zero — e.g. a registered payment. */
export const positiveMoneySchema = nonNegativeMoneySchema.refine(
  (value) => !/^0+\.00$/.test(value),
  { message: 'Must be greater than zero' },
);

/**
 * Audit fields, graduated by how a model is actually allowed to change — see
 * DATABASE.md's "Audit field policy" and ARCHITECTURE.md §6.3.
 *
 * - `fullAuditFieldsSchema`: mutable entities where soft-delete is a real
 *   lifecycle operation (User, Lot, Product, InventoryItem).
 * - `mutableAuditFieldsSchema`: mutable but never deleted — cancellation is a
 *   status, not a deletion (Sale).
 * - `immutableAuditFieldsSchema`: created once, never updated or deleted
 *   (InventoryMovement, SaleItem).
 */
export const fullAuditFieldsSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  createdBy: idSchema,
  updatedBy: idSchema,
});

export const mutableAuditFieldsSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: idSchema,
  updatedBy: idSchema,
});

export const immutableAuditFieldsSchema = z.object({
  createdAt: z.coerce.date(),
  createdBy: idSchema,
});

/** See ARCHITECTURE.md §6.5 — a real enum, never a loose string. */
export const lotStatusSchema = z.enum(['ACTIVE', 'FINISHED', 'ARCHIVED']);
export type LotStatus = z.infer<typeof lotStatusSchema>;

/**
 * The state of one physical InventoryItem unit. See ARCHITECTURE.md §6.6 and
 * DATABASE.md's inventory lifecycle section.
 */
export const inventoryItemStatusSchema = z.enum(['IN_STOCK', 'RESERVED', 'SOLD', 'WRITTEN_OFF']);
export type InventoryItemStatus = z.infer<typeof inventoryItemStatusSchema>;

/**
 * Every state change to an InventoryItem is recorded as one immutable
 * InventoryMovement row of one of these types. See DATABASE.md.
 */
export const inventoryMovementTypeSchema = z.enum([
  'PURCHASE_ENTRY',
  'SALE',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'RETURN',
  'MANUAL_ADJUSTMENT',
  'SALE_CANCELLATION',
  'WRITE_OFF',
]);
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;

/** See DATABASE.md's Sale section. */
export const saleStatusSchema = z.enum([
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'REFUNDED',
]);
export type SaleStatus = z.infer<typeof saleStatusSchema>;

/**
 * How a payment was actually received — set independently on `Sale` (its
 * initial payment, if any) and `CustomerPayment` (each later receipt).
 * Absent/null means no payment was recorded at all (a pure fiado sale) or a
 * historical row from before this field existed.
 */
export const paymentMethodSchema = z.enum(['PIX', 'CARD', 'CASH']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Shared query params for every list endpoint. Page-based rather than
 * cursor-based — simple, and sufficient for the per-tenant list sizes this
 * app deals with (one seller's own lots/products, not a global feed).
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Wraps any list response with the pagination metadata the client needs to page further. */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });
}
