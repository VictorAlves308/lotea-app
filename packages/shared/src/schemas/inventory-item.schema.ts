import { z } from 'zod';

import {
  fullAuditFieldsSchema,
  idSchema,
  inventoryItemStatusSchema,
  moneySchema,
} from './common.schema';

/** One row per physical unit. Stock is never a stored quantity — see ARCHITECTURE.md §6.6. */
export const inventoryItemSchema = z.object({
  id: idSchema,
  userId: idSchema,
  productId: idSchema,
  lotId: idSchema,
  status: inventoryItemStatusSchema,
  /** Frozen from the lot's cost at creation time; never recalculated retroactively. */
  acquisitionCost: moneySchema,
  /** Perishable goods only — nullable, set at purchase-entry time. */
  expiresAt: z.coerce.date().nullable(),
  ...fullAuditFieldsSchema.shape,
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

/**
 * Input for registering an "Entrada". `quantity` is only ever an input to this
 * one action — it fans out into that many individual InventoryItem rows and is
 * never itself persisted. Capped at 10,000 per entry: high enough for any
 * realistic reseller purchase, low enough that one request can't be used to
 * spawn an unbounded number of rows.
 */
export const registerEntryInputSchema = z.object({
  productId: idSchema,
  lotId: idSchema,
  quantity: z.number().int().positive().max(10_000),
  acquisitionCost: moneySchema,
  expiresAt: z.coerce.date().nullable().optional(),
});
export type RegisterEntryInput = z.infer<typeof registerEntryInputSchema>;

/** Response for a purchase entry — a summary, never one row per created unit. */
export const registerEntrySummarySchema = z.object({
  lotId: idSchema,
  productId: idSchema,
  quantity: z.number().int().positive(),
  acquisitionCost: moneySchema,
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type RegisterEntrySummary = z.infer<typeof registerEntrySummarySchema>;

/**
 * One sellable unit — just enough for the Nova Venda cart to resolve
 * "2 units of this product" into concrete `inventoryItemId`s to submit with
 * `createSaleInputSchema`. Never the full InventoryItem (no userId/status).
 */
export const availableInventoryItemSchema = z.object({
  id: idSchema,
  lotId: idSchema,
  acquisitionCost: moneySchema,
  expiresAt: z.coerce.date().nullable(),
});
export type AvailableInventoryItem = z.infer<typeof availableInventoryItemSchema>;

export const availableInventoryResponseSchema = z.object({
  items: z.array(availableInventoryItemSchema),
  total: z.number().int().nonnegative(),
});
export type AvailableInventoryResponse = z.infer<typeof availableInventoryResponseSchema>;

/**
 * Manual "Saída de estoque" reasons — every one removes units from
 * `IN_STOCK`. `DEVOLUCAO` means returned to the supplier (stock leaves for
 * good), not a customer returning a sold unit — that's the existing `RETURN`
 * movement type (see DATABASE.md), which goes the opposite direction and
 * isn't reachable from this endpoint. `DEVOLUCAO`/`PERDA` both record as the
 * `WRITE_OFF` movement type; `AJUSTE` records as `MANUAL_ADJUSTMENT`.
 */
export const stockWriteOffReasonSchema = z.enum(['DEVOLUCAO', 'PERDA', 'AJUSTE']);
export type StockWriteOffReason = z.infer<typeof stockWriteOffReasonSchema>;

export const writeOffInputSchema = z.object({
  productId: idSchema,
  quantity: z.number().int().positive().max(10_000),
  reason: stockWriteOffReasonSchema,
  notes: z.string().max(500).nullish(),
});
export type WriteOffInput = z.infer<typeof writeOffInputSchema>;

/** Response for a write-off — a summary, never one row per affected unit (same reasoning as registerEntrySummarySchema). */
export const writeOffSummarySchema = z.object({
  productId: idSchema,
  quantity: z.number().int().positive(),
  reason: stockWriteOffReasonSchema,
  createdAt: z.coerce.date(),
});
export type WriteOffSummary = z.infer<typeof writeOffSummarySchema>;
