import { z } from 'zod';

import {
  idSchema,
  immutableAuditFieldsSchema,
  moneySchema,
  paymentMethodSchema,
  positiveMoneySchema,
} from './common.schema';

/**
 * One immutable row of "this much of this payment went to this sale." Never
 * updated or deleted, even when the parent CustomerPayment is later voided
 * — the reversal is represented entirely by CustomerPayment.voidedAt. See
 * DATABASE.md, "Accounts receivable".
 */
export const paymentAllocationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  customerPaymentId: idSchema,
  saleId: idSchema,
  amount: moneySchema,
  ...immutableAuditFieldsSchema.shape,
});
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;

/**
 * One payment/receipt event. `customerId` is nullable: a fully-paid sale
 * with no customer still produces one of these, so "total received" stays
 * correct for walk-in sales too — see DATABASE.md, "Accounts receivable".
 * `voidedAt` marks a reversal (estorno) — the row is never deleted.
 */
export const customerPaymentSchema = z.object({
  id: idSchema,
  userId: idSchema,
  customerId: idSchema.nullable(),
  amount: moneySchema,
  notes: z.string().max(2000).nullable(),
  /** How this specific receipt was received. Null only for historical rows. */
  paymentMethod: paymentMethodSchema.nullable(),
  voidedAt: z.coerce.date().nullable(),
  idempotencyKey: z.string().max(120).nullable(),
  allocations: z.array(paymentAllocationSchema),
  ...immutableAuditFieldsSchema.shape,
});
export type CustomerPayment = z.infer<typeof customerPaymentSchema>;

/**
 * Input for "a cliente me pagou X" — distributed automatically (FIFO) across
 * her oldest open sales first. `idempotencyKey` mirrors Sale's own field
 * exactly: a retried request with the same key returns the original
 * payment instead of creating a second one.
 */
export const registerPaymentInputSchema = z.object({
  amount: positiveMoneySchema,
  paymentMethod: paymentMethodSchema.nullish(),
  notes: z.string().max(2000).nullish(),
  idempotencyKey: z.string().max(120).nullish(),
});
export type RegisterPaymentInput = z.infer<typeof registerPaymentInputSchema>;
