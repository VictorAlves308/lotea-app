import { z } from 'zod';

import { fullAuditFieldsSchema, idSchema, moneySchema } from './common.schema';

/**
 * A seller's own customer, for tracking "fiado" (buy-now-pay-later) sales.
 * Duplicate names are expected and allowed — there is no natural-key
 * uniqueness on `name` at all; see DATABASE.md, "Accounts receivable".
 */
export const customerSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string().min(1).max(120),
  phone: z.string().max(30).nullable(),
  notes: z.string().max(2000).nullable(),
  searchTerms: z.string(),
  ...fullAuditFieldsSchema.shape,
});
export type Customer = z.infer<typeof customerSchema>;

/** User-facing input only — `searchTerms` is derived, never supplied directly. */
export const createCustomerInputSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(30).nullish(),
  notes: z.string().max(2000).nullish(),
  /** Set once the caller has already seen duplicate candidates and confirmed a new customer anyway. */
  confirmDuplicate: z.boolean().default(false),
});
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export const updateCustomerInputSchema = z.object({
  name: z.string().min(1).max(120).nullish(),
  phone: z.string().max(30).nullish(),
  notes: z.string().max(2000).nullish(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

/** Typo-tolerant name lookup — used both for sale-flow autocomplete and the duplicate-check. */
export const searchCustomersInputSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type SearchCustomersInput = z.infer<typeof searchCustomersInputSchema>;

/** Concise shape for autocomplete/duplicate-candidates — no balance, no audit fields. */
export const customerSuggestionSchema = z.object({
  id: idSchema,
  name: z.string(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
});
export type CustomerSuggestion = z.infer<typeof customerSuggestionSchema>;

/** A customer's current balance and how many of her sales are still open. */
export const customerBalanceSchema = z.object({
  balance: moneySchema,
  openSalesCount: z.number().int().nonnegative(),
});
export type CustomerBalance = z.infer<typeof customerBalanceSchema>;

/** Full customer detail — identity + audit fields + her current balance. */
export const customerDetailSchema = z.object({
  ...customerSchema.shape,
  ...customerBalanceSchema.shape,
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

/** One row of the customer list — sortable/filterable by balance, not stored on Customer itself. */
export const customerListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  phone: z.string().nullable(),
  balance: moneySchema,
  openSalesCount: z.number().int().nonnegative(),
  lastActivityAt: z.coerce.date().nullable(),
});
export type CustomerListItem = z.infer<typeof customerListItemSchema>;

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['name', 'balance', 'recent']).default('name'),
  /** Filters to customers with (true) or without (false) an open balance — "contas em aberto" is `hasBalance=true`. */
  hasBalance: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
    .optional(),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

/** One line of a customer's extrato — a Sale ("Entrega", +) or a CustomerPayment ("Pagamento", -). */
export const customerStatementLineSchema = z.object({
  type: z.enum(['SALE', 'PAYMENT']),
  date: z.coerce.date(),
  /** Always the magnitude — the client renders the sign based on `type`. */
  amount: moneySchema,
  referenceId: idSchema,
  /** Only present for SALE lines — lets the client style a cancelled sale distinctly, per "preservar histórico". */
  saleStatus: z.string().nullable(),
});
export type CustomerStatementLine = z.infer<typeof customerStatementLineSchema>;

export const receivablesSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ReceivablesSummaryQuery = z.infer<typeof receivablesSummaryQuerySchema>;

/**
 * Four independent, derived numbers — never conflated. See DATABASE.md,
 * "Accounts receivable" for exactly what each one does and doesn't count.
 */
export const receivablesSummarySchema = z.object({
  totalOutstanding: moneySchema,
  customersWithBalanceCount: z.number().int().nonnegative(),
  totalSoldInPeriod: moneySchema,
  totalReceivedInPeriod: moneySchema,
});
export type ReceivablesSummary = z.infer<typeof receivablesSummarySchema>;
