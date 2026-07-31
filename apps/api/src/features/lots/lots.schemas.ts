import { idSchema, lotSchema, moneySchema, paginatedResponseSchema } from '@lotea/shared';
import { z } from 'zod';

export const lotParamsSchema = z.object({ id: idSchema });

export const lotFinancialsSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  soldCount: z.number().int().nonnegative(),
  totalCost: moneySchema,
  revenue: moneySchema,
  realizedProfit: moneySchema,
  hasRecoveredInvestment: z.boolean(),
  /** How much of `revenue` has actually been collected — see DATABASE.md, "Lot composition". */
  totalReceived: moneySchema,
  /** `revenue - totalReceived` — this lot's own "ainda a receber". */
  outstanding: moneySchema,
});

/** "Clientes com saldo referente ao lote" — a derived, read-only breakdown, never a per-lot debt entity. */
export const lotCustomerBalanceSchema = z.object({
  customerId: idSchema,
  name: z.string(),
  outstanding: moneySchema,
});

/** One (product, acquisition cost) group actually added to the lot — see inventory.repository.ts's getLotItemRows. */
export const lotItemSchema = z.object({
  productId: idSchema,
  productName: z.string(),
  acquisitionCost: moneySchema,
  quantity: z.number().int().nonnegative(),
  inStockCount: z.number().int().nonnegative(),
  soldCount: z.number().int().nonnegative(),
});

export const lotResponseSchema = lotSchema;
export const lotListResponseSchema = paginatedResponseSchema(lotSchema);
export const lotDetailsResponseSchema = z.object({
  lot: lotSchema,
  financials: lotFinancialsSchema,
  customerBalances: z.array(lotCustomerBalanceSchema),
  items: z.array(lotItemSchema),
});
