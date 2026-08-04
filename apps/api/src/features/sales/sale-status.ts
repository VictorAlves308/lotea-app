import type { Prisma, SaleStatus } from '../../generated/prisma/client';

/**
 * The single source of truth for a Sale's status — always derived from
 * (total, paidAmount, cancelled), never accepted as direct API input.
 * Recomputed and rewritten every time paidAmount changes: at creation, on
 * FIFO payment registration, and on payment void. A standalone leaf module
 * (not part of sales.service.ts) so customers.service.ts can import it
 * without creating a sales<->customers circular import — the same reason
 * lots.service.ts avoids importing inventory.service.ts. See DATABASE.md,
 * "Accounts receivable".
 */
export function computeSaleStatus(params: {
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  cancelled?: boolean;
}): SaleStatus {
  if (params.cancelled) return 'CANCELLED';
  if (params.paidAmount.lessThanOrEqualTo(0)) return 'PENDING';
  if (params.paidAmount.greaterThanOrEqualTo(params.total)) return 'PAID';
  return 'PARTIALLY_PAID';
}
