import { z } from 'zod';

import {
  idSchema,
  immutableAuditFieldsSchema,
  mutableAuditFieldsSchema,
  moneySchema,
  nonNegativeMoneySchema,
  paymentMethodSchema,
  saleStatusSchema,
} from './common.schema';

/**
 * A SaleItem is an immutable snapshot of one sold InventoryItem: the price it
 * sold for and the acquisition cost it carried at that moment, so profit stays
 * accurate forever even if the InventoryItem record is later corrected.
 * `voidedAt` is set when the parent Sale is cancelled — it excludes the item
 * from revenue/profit queries and frees the InventoryItem to be resold. See
 * DATABASE.md.
 */
export const saleItemSchema = z.object({
  id: idSchema,
  userId: idSchema,
  saleId: idSchema,
  inventoryItemId: idSchema,
  /** Joined in from the sold InventoryItem's Product at read time — never stored on SaleItem itself, since the product is reachable via inventoryItemId. */
  productId: idSchema,
  productName: z.string(),
  salePrice: moneySchema,
  acquisitionCostSnapshot: moneySchema,
  voidedAt: z.coerce.date().nullable(),
  ...immutableAuditFieldsSchema.shape,
});
export type SaleItem = z.infer<typeof saleItemSchema>;

/**
 * `total` is an immutable snapshot (sum of item sale prices at creation
 * time) — a Sale's items never change after creation, so it can never drift.
 * A Sale is never deleted; cancellation is a status, not a deletion — see
 * `mutableAuditFieldsSchema` (no `deletedAt`).
 */
export const saleSchema = z.object({
  id: idSchema,
  userId: idSchema,
  status: saleStatusSchema,
  total: moneySchema,
  paidAmount: moneySchema,
  /**
   * Nullable — a fully-paid sale never needs one. Required whenever
   * `paidAmount < total` (enforced by the `Sale_customer_required_when_outstanding`
   * DB constraint, and checked before that at the service layer). Fixed at
   * creation — never changed afterward. See DATABASE.md, "Accounts receivable".
   */
  customerId: idSchema.nullable(),
  /** How the initial payment (if any) was received — null for a pure fiado sale or a historical row. */
  paymentMethod: paymentMethodSchema.nullable(),
  /** Client-generated key from the mobile offline outbox; unique per user. See DATABASE.md §7. */
  idempotencyKey: z.string().max(120).nullable(),
  items: z.array(saleItemSchema),
  ...mutableAuditFieldsSchema.shape,
});
export type Sale = z.infer<typeof saleSchema>;

/**
 * References specific InventoryItem units sold — never a product + quantity
 * pair. `customerId` is required whenever `receivedAmount` is less than the
 * items' total — that's a cross-field rule depending on `total`, which is
 * only known once the items' prices are summed server-side, so it can't be
 * expressed as a Zod refinement here. Enforced by the service layer
 * (`CustomerRequiredError`) and backstopped by the
 * `Sale_customer_required_when_outstanding` DB constraint. See DATABASE.md,
 * "Accounts receivable".
 */
export const createSaleInputSchema = z.object({
  idempotencyKey: z.string().max(120).nullish(),
  items: z
    .array(
      z.object({
        inventoryItemId: idSchema,
        salePrice: moneySchema,
      }),
    )
    .min(1),
  /** "Valor recebido agora" — may be less than the items' total (fiado) or 0. Never negative, never more than the total. */
  receivedAmount: nonNegativeMoneySchema,
  customerId: idSchema.nullish(),
  /** Null when receivedAmount is 0 (fiado) — nothing was actually received yet. */
  paymentMethod: paymentMethodSchema.nullish(),
});
export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

/** One row of the Vendas list — a lighter shape than the full Sale, with the customer name and a representative brand already joined in. */
export const saleListItemSchema = z.object({
  id: idSchema,
  status: saleStatusSchema,
  total: moneySchema,
  paidAmount: moneySchema,
  customerId: idSchema.nullable(),
  customerName: z.string().nullable(),
  paymentMethod: paymentMethodSchema.nullable(),
  itemCount: z.number().int().nonnegative(),
  /** The first item's brand, in creation order — just enough for a "3 produtos · Natura"-style subtitle, not a rigorous aggregate. */
  brand: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type SaleListItem = z.infer<typeof saleListItemSchema>;

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: saleStatusSchema.optional(),
});
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
