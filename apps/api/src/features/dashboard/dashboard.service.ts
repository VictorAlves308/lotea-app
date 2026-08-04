import type { DashboardGranularity } from '@lotea/shared';

import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import * as customersService from '../customers/customers.service';
import * as productsService from '../products/products.service';
import * as salesService from '../sales/sales.service';

/**
 * Snaps a date down to the exact same bucket boundary Postgres's own
 * `date_trunc('day'|'week'|'month', ...)` produces — UTC, ISO week (Monday
 * start) for `'week'` — so the JS-generated zero-fill cursor below always
 * lands on the same instant as a real data row's `bucket` value. All-UTC
 * arithmetic throughout; never a local-time Date constructor.
 */
function truncateToBucketStart(date: Date, granularity: DashboardGranularity): Date {
  if (granularity === 'day') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  if (granularity === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay(); // Mon=1..Sun=7
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (isoWeekday - 1)),
  );
}

function addOneBucket(date: Date, granularity: DashboardGranularity): Date {
  const next = new Date(date);
  if (granularity === 'day') next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export interface DashboardTimelineBucket {
  bucket: Date;
  sold: string;
  received: string;
}

/**
 * Merges the sold and received timelines (each queried independently — see
 * ARCHITECTURE.md §6/§5, sales owns one, customers owns the other) and
 * zero-fills every bucket in `[from, to]`, even ones with no sales or
 * payments at all.
 */
function buildTimeline(params: {
  from: Date;
  to: Date;
  granularity: DashboardGranularity;
  soldRows: Array<{ bucket: Date; sold: string }>;
  receivedRows: Array<{ bucket: Date; received: string }>;
}): DashboardTimelineBucket[] {
  const soldByBucket = new Map(params.soldRows.map((row) => [row.bucket.getTime(), row.sold]));
  const receivedByBucket = new Map(
    params.receivedRows.map((row) => [row.bucket.getTime(), row.received]),
  );

  const timeline: DashboardTimelineBucket[] = [];
  let cursor = truncateToBucketStart(params.from, params.granularity);
  const lastBucket = truncateToBucketStart(params.to, params.granularity);
  while (cursor.getTime() <= lastBucket.getTime()) {
    timeline.push({
      bucket: new Date(cursor),
      sold: soldByBucket.get(cursor.getTime()) ?? '0.00',
      received: receivedByBucket.get(cursor.getTime()) ?? '0.00',
    });
    cursor = addOneBucket(cursor, params.granularity);
  }
  return timeline;
}

export interface FinancialDashboardParams {
  userId: string;
  /** Inclusive on both ends. */
  from: Date;
  to: Date;
  granularity: DashboardGranularity;
  rankingLimit: number;
}

/**
 * The single consolidated `GET /dashboard/financial` aggregate. Pure
 * orchestration — no query of its own: every figure comes from the owning
 * feature's own service function (see ARCHITECTURE.md §5/§6's rule that
 * cross-feature reads go through services, never repositories directly).
 * `totalOutstanding`/`customersWithBalanceCount`/`totalSoldInPeriod`/
 * `totalReceivedInPeriod` all reuse customers.getReceivablesSummary
 * unchanged — it already computes exactly these four numbers, so there is
 * no second, independent computation of "total sold" that could ever
 * disagree with it. See DATABASE.md, "Financial dashboard".
 */
export async function getFinancialDashboard(prisma: PrismaClient, params: FinancialDashboardParams) {
  const { userId, from, to, granularity, rankingLimit } = params;
  // Every query below effectively uses `>= from AND < toExclusive` —
  // getReceivablesSummary is passed the raw `to` (a bare calendar date), but
  // computes the same exclusive next-day bound internally; see
  // customers.repository.ts's getReceivablesAggregates.
  const toExclusive = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1));

  const [
    receivablesSummary,
    salesByStatus,
    averageTicket,
    costOfGoodsSold,
    soldTimelineRows,
    receivedTimelineRows,
    topCustomers,
    topProducts,
    topBrands,
    recentPayments,
  ] = await Promise.all([
    customersService.getReceivablesSummary(prisma, { userId, from, to }),
    salesService.getSalesByStatusCounts(prisma, { userId, from, toExclusive }),
    salesService.getAverageTicket(prisma, { userId, from, toExclusive }),
    salesService.getCostOfGoodsSold(prisma, { userId, from, toExclusive }),
    salesService.getSoldTimeline(prisma, { userId, from, toExclusive, granularity }),
    customersService.getReceivedTimeline(prisma, { userId, from, toExclusive, granularity }),
    customersService.listCustomers(prisma, {
      userId,
      page: 1,
      limit: rankingLimit,
      sort: 'balance',
      hasBalance: true,
    }),
    productsService.getTopSellingProducts(prisma, { userId, from, toExclusive, limit: rankingLimit }),
    productsService.getTopSellingBrands(prisma, { userId, from, toExclusive, limit: rankingLimit }),
    customersService.getRecentPayments(prisma, { userId, from, toExclusive, limit: rankingLimit }),
  ]);

  // Cash-basis, not accrual: a fiado sale that hasn't been paid yet must not
  // read as profit the moment it's made — see DATABASE.md, "Accounts
  // receivable" and the identical rule applied to a lot's own "Lucro"
  // (inventory.service.ts's getLotFinancials, revenue minus totalReceived).
  const netProfitInPeriod = new Prisma.Decimal(receivablesSummary.totalReceivedInPeriod).minus(
    costOfGoodsSold.totalCost,
  );

  return {
    totalSoldInPeriod: receivablesSummary.totalSoldInPeriod,
    totalReceivedInPeriod: receivablesSummary.totalReceivedInPeriod,
    totalOutstanding: receivablesSummary.totalOutstanding,
    customersWithBalanceCount: receivablesSummary.customersWithBalanceCount,
    salesByStatus,
    averageTicket: averageTicket.averageTicket,
    totalCostInPeriod: costOfGoodsSold.totalCost,
    netProfitInPeriod: netProfitInPeriod.toFixed(2),
    timeline: buildTimeline({
      from,
      to,
      granularity,
      soldRows: soldTimelineRows,
      receivedRows: receivedTimelineRows,
    }),
    topCustomersByBalance: topCustomers.items.map((item) => ({
      customerId: item.id,
      name: item.name,
      outstanding: item.balance,
    })),
    topProducts,
    topBrands,
    recentPayments,
  };
}
