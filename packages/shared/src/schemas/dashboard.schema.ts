import { z } from 'zod';

import { idSchema, moneySchema, paymentMethodSchema } from './common.schema';

/** Timeline bucket size for the dashboard's sold/received series. */
export const dashboardGranularitySchema = z.enum(['day', 'week', 'month']);
export type DashboardGranularity = z.infer<typeof dashboardGranularitySchema>;

export const financialDashboardQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  granularity: dashboardGranularitySchema.default('day'),
  /** Bounds how many rows each ranking (top customers/products/brands) returns. */
  rankingLimit: z.coerce.number().int().positive().max(20).default(5),
});
export type FinancialDashboardQuery = z.infer<typeof financialDashboardQuerySchema>;

export const salesByStatusSchema = z.object({
  paid: z.number().int().nonnegative(),
  partiallyPaid: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});
export type SalesByStatus = z.infer<typeof salesByStatusSchema>;

/** One point of the sold/received timeline — `bucket` is the truncated period start (day/week/month). */
export const dashboardTimelineBucketSchema = z.object({
  bucket: z.coerce.date(),
  sold: moneySchema,
  received: moneySchema,
});
export type DashboardTimelineBucket = z.infer<typeof dashboardTimelineBucketSchema>;

export const dashboardTopCustomerSchema = z.object({
  customerId: idSchema,
  name: z.string(),
  outstanding: moneySchema,
});
export type DashboardTopCustomer = z.infer<typeof dashboardTopCustomerSchema>;

export const dashboardTopProductSchema = z.object({
  productId: idSchema,
  name: z.string(),
  brand: z.string().nullable(),
  quantity: z.number().int().nonnegative(),
  revenue: moneySchema,
});
export type DashboardTopProduct = z.infer<typeof dashboardTopProductSchema>;

export const dashboardTopBrandSchema = z.object({
  brand: z.string(),
  quantity: z.number().int().nonnegative(),
  revenue: moneySchema,
});
export type DashboardTopBrand = z.infer<typeof dashboardTopBrandSchema>;

export const dashboardRecentPaymentSchema = z.object({
  paymentId: idSchema,
  customerId: idSchema.nullable(),
  customerName: z.string().nullable(),
  amount: moneySchema,
  paymentMethod: paymentMethodSchema.nullable(),
  createdAt: z.coerce.date(),
});
export type DashboardRecentPayment = z.infer<typeof dashboardRecentPaymentSchema>;

/**
 * The single consolidated financial dashboard response — see DATABASE.md,
 * "Financial dashboard". Deliberately one endpoint, not one-per-indicator.
 */
export const financialDashboardSchema = z.object({
  totalSoldInPeriod: moneySchema,
  totalReceivedInPeriod: moneySchema,
  /** Current position — ignores `from`/`to`, same as customers.getReceivablesSummary. */
  totalOutstanding: moneySchema,
  customersWithBalanceCount: z.number().int().nonnegative(),
  salesByStatus: salesByStatusSchema,
  /** Non-cancelled sales only. */
  averageTicket: moneySchema,
  /** SUM(SaleItem.acquisitionCostSnapshot) in the period — the frozen cost each sold unit carried, never re-derived from the product/lot's current cost. */
  totalCostInPeriod: moneySchema,
  /** `totalSoldInPeriod - totalCostInPeriod` — accrual profit (goods sold, whether or not collected yet), distinct from `totalReceivedInPeriod`. */
  netProfitInPeriod: moneySchema,
  timeline: z.array(dashboardTimelineBucketSchema),
  topCustomersByBalance: z.array(dashboardTopCustomerSchema),
  topProducts: z.array(dashboardTopProductSchema),
  topBrands: z.array(dashboardTopBrandSchema),
  recentPayments: z.array(dashboardRecentPaymentSchema),
});
export type FinancialDashboard = z.infer<typeof financialDashboardSchema>;
