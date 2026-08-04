import { generateId } from '@lotea/shared';

import { Prisma } from '../../generated/prisma/client';
import type {
  Customer,
  CustomerPayment,
  PaymentAllocation,
  PaymentMethod,
  Sale,
  SaleStatus,
} from '../../generated/prisma/client';

type Db = Prisma.TransactionClient;

export async function createCustomer(
  db: Db,
  params: {
    userId: string;
    name: string;
    phone?: string | null;
    notes?: string | null;
    searchTerms: string;
    actingUserId: string;
  },
): Promise<Customer> {
  return db.customer.create({
    data: {
      id: generateId(),
      userId: params.userId,
      name: params.name,
      phone: params.phone ?? null,
      notes: params.notes ?? null,
      searchTerms: params.searchTerms,
      createdBy: params.actingUserId,
      updatedBy: params.actingUserId,
    },
  });
}

/** Always scoped by userId, excludes soft-deleted — see ARCHITECTURE.md's tenant-isolation rule. */
export async function findById(
  db: Db,
  params: { id: string; userId: string },
): Promise<Customer | null> {
  return db.customer.findFirst({ where: { id: params.id, userId: params.userId, deletedAt: null } });
}

export async function updateCustomer(
  db: Db,
  params: {
    id: string;
    name?: string;
    phone?: string | null;
    notes?: string | null;
    searchTerms?: string;
    actingUserId: string;
  },
): Promise<Customer> {
  return db.customer.update({
    where: { id: params.id },
    data: {
      name: params.name,
      phone: params.phone,
      notes: params.notes,
      searchTerms: params.searchTerms,
      updatedBy: params.actingUserId,
    },
  });
}

export async function softDelete(db: Db, params: { id: string; actingUserId: string }): Promise<Customer> {
  return db.customer.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), updatedBy: params.actingUserId },
  });
}

/**
 * Typo-tolerant, accent-insensitive name search — mirrors
 * products.repository.ts's searchBySearchTerms exactly (same word_similarity
 * + ILIKE combination, same GIN trigram index shape), scoped by tenant.
 * `normalizedQuery` must already be produced by normalizeSearchText. See
 * DATABASE.md, "Accounts receivable".
 */
export async function searchBySearchTerms(
  db: Db,
  params: { userId: string; normalizedQuery: string; limit: number },
): Promise<Customer[]> {
  return db.$queryRaw<Customer[]>`
    SELECT *
    FROM "Customer"
    WHERE "userId" = ${params.userId}::uuid
      AND "deletedAt" IS NULL
      AND (
        word_similarity(${params.normalizedQuery}, "searchTerms") > 0.4
        OR "searchTerms" ILIKE ${'%' + params.normalizedQuery + '%'}
      )
    ORDER BY word_similarity(${params.normalizedQuery}, "searchTerms") DESC
    LIMIT ${params.limit}
  `;
}

/**
 * Raw aggregate only — SUM(total)/SUM(paidAmount) over this customer's open
 * sales; the service layer subtracts to get the actual balance. Same
 * "aggregate two columns, subtract in application code" pattern as
 * inventory.repository.ts's getLotFinancialAggregates.
 */
export async function getBalanceAggregate(db: Db, params: { userId: string; customerId: string }) {
  const agg = await db.sale.aggregate({
    where: {
      userId: params.userId,
      customerId: params.customerId,
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
    },
    _sum: { total: true, paidAmount: true },
    _count: { _all: true },
  });
  return { totalSum: agg._sum.total, paidSum: agg._sum.paidAmount, openSalesCount: agg._count._all };
}

export interface CustomerListRow {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  openSalesCount: number;
  lastActivityAt: Date | null;
}

/**
 * Sortable/filterable list — balance and "last activity" aren't stored
 * columns (derived, per "evitar redundância"), so sorting/paginating by them
 * needs a raw aggregate query rather than fetching every customer and
 * sorting in JS, which would break correct pagination. Same tagged-template
 * $queryRaw style as products.repository.ts's search.
 */
export async function listWithBalance(
  db: Db,
  params: {
    userId: string;
    page: number;
    limit: number;
    sort: 'name' | 'balance' | 'recent';
    hasBalance?: boolean;
  },
): Promise<{ items: CustomerListRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;

  const balanceFilter =
    params.hasBalance === true
      ? Prisma.sql`AND COALESCE(balance_agg.balance, 0.00) > 0`
      : params.hasBalance === false
        ? Prisma.sql`AND COALESCE(balance_agg.balance, 0.00) <= 0`
        : Prisma.empty;

  const orderBy =
    params.sort === 'balance'
      ? Prisma.sql`ORDER BY COALESCE(balance_agg.balance, 0.00) DESC, c."name" ASC`
      : params.sort === 'recent'
        ? Prisma.sql`ORDER BY GREATEST(last_sale.at, last_payment.at) DESC NULLS LAST, c."name" ASC`
        : Prisma.sql`ORDER BY c."name" ASC`;

  const baseFrom = Prisma.sql`
    FROM "Customer" c
    LEFT JOIN (
      SELECT "customerId", SUM("total" - "paidAmount") AS balance, COUNT(*) AS open_count
      FROM "Sale"
      WHERE "userId" = ${params.userId}::uuid AND "status" IN ('PENDING', 'PARTIALLY_PAID')
      GROUP BY "customerId"
    ) balance_agg ON balance_agg."customerId" = c.id
    LEFT JOIN (
      SELECT "customerId", MAX("createdAt") AS at
      FROM "Sale"
      WHERE "userId" = ${params.userId}::uuid
      GROUP BY "customerId"
    ) last_sale ON last_sale."customerId" = c.id
    LEFT JOIN (
      SELECT "customerId", MAX("createdAt") AS at
      FROM "CustomerPayment"
      WHERE "userId" = ${params.userId}::uuid AND "voidedAt" IS NULL
      GROUP BY "customerId"
    ) last_payment ON last_payment."customerId" = c.id
    WHERE c."userId" = ${params.userId}::uuid AND c."deletedAt" IS NULL
    ${balanceFilter}
  `;

  const [items, countResult] = await Promise.all([
    db.$queryRaw<CustomerListRow[]>(Prisma.sql`
      SELECT
        c.id,
        c.name,
        c.phone,
        COALESCE(balance_agg.balance, 0.00)::text AS balance,
        COALESCE(balance_agg.open_count, 0)::int AS "openSalesCount",
        GREATEST(last_sale.at, last_payment.at) AS "lastActivityAt"
      ${baseFrom}
      ${orderBy}
      LIMIT ${params.limit} OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      ${baseFrom}
    `),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function createPayment(
  db: Db,
  params: {
    userId: string;
    customerId: string | null;
    amount: string;
    paymentMethod?: PaymentMethod | null;
    notes?: string | null;
    idempotencyKey?: string | null;
    actingUserId: string;
  },
): Promise<CustomerPayment> {
  return db.customerPayment.create({
    data: {
      id: generateId(),
      userId: params.userId,
      customerId: params.customerId,
      amount: params.amount,
      paymentMethod: params.paymentMethod ?? null,
      notes: params.notes ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      createdBy: params.actingUserId,
    },
  });
}

export async function createAllocation(
  db: Db,
  params: { userId: string; customerPaymentId: string; saleId: string; amount: string; actingUserId: string },
): Promise<PaymentAllocation> {
  return db.paymentAllocation.create({
    data: {
      id: generateId(),
      userId: params.userId,
      customerPaymentId: params.customerPaymentId,
      saleId: params.saleId,
      amount: params.amount,
      createdBy: params.actingUserId,
    },
  });
}

export type CustomerPaymentWithAllocations = CustomerPayment & { allocations: PaymentAllocation[] };

export async function findPaymentByIdempotencyKey(
  db: Db,
  params: { userId: string; idempotencyKey: string },
): Promise<CustomerPaymentWithAllocations | null> {
  return db.customerPayment.findUnique({
    where: { userId_idempotencyKey: { userId: params.userId, idempotencyKey: params.idempotencyKey } },
    include: { allocations: true },
  });
}

/** Always scoped by userId. */
export async function findPaymentById(
  db: Db,
  params: { id: string; userId: string },
): Promise<CustomerPaymentWithAllocations | null> {
  return db.customerPayment.findFirst({
    where: { id: params.id, userId: params.userId },
    include: { allocations: true },
  });
}

// This file reads and writes `Sale.paidAmount`/`Sale.status` directly
// (below), even though `Sale` otherwise belongs to the `sales` feature — a
// deliberate, narrow exception. `sales.service.ts` already needs to call
// `customersService` at creation time (to resolve a customerId and record
// the initial payment), so having `customers` call back into `salesService`
// for payment-driven Sale mutations would create the exact circular
// service-to-service dependency this codebase's own convention avoids (see
// lots.service.ts's decision not to import inventory.service.ts). Since
// `sales.repository.ts` independently owns paidAmount/status at CREATION
// time, and this file independently owns them for every mutation AFTER
// creation (payment registration, payment void), the two never write the
// same field in the same code path. See DATABASE.md, "Accounts receivable".

/**
 * Locks a customer's open sales for a payment-distribution transaction —
 * `SELECT ... FOR UPDATE`, deterministic `ORDER BY "createdAt" ASC, "id" ASC`
 * (never bare createdAt, which can tie at millisecond resolution) so
 * concurrent transactions always request locks in the same order and
 * serialize instead of deadlocking. Prisma's query builder has no row-lock
 * API, hence raw SQL. See DATABASE.md, "Accounts receivable".
 */
export async function lockOpenSalesForCustomer(
  db: Db,
  params: { userId: string; customerId: string },
): Promise<Sale[]> {
  return db.$queryRaw<Sale[]>`
    SELECT * FROM "Sale"
    WHERE "userId" = ${params.userId}::uuid
      AND "customerId" = ${params.customerId}::uuid
      AND "status" IN ('PENDING', 'PARTIALLY_PAID')
    ORDER BY "createdAt" ASC, "id" ASC
    FOR UPDATE
  `;
}

/** Locks the specific sales a payment's allocations reference — used when voiding a payment, same deterministic order. */
export async function lockSalesByIds(db: Db, params: { userId: string; ids: string[] }): Promise<Sale[]> {
  if (params.ids.length === 0) return [];
  return db.$queryRaw<Sale[]>(Prisma.sql`
    SELECT * FROM "Sale"
    WHERE "userId" = ${params.userId}::uuid AND "id" IN (${Prisma.join(params.ids)})
    ORDER BY "createdAt" ASC, "id" ASC
    FOR UPDATE
  `);
}

export async function updateSalePaymentState(
  db: Db,
  params: { id: string; paidAmount: string; status: SaleStatus; actingUserId: string },
): Promise<Sale> {
  return db.sale.update({
    where: { id: params.id },
    data: { paidAmount: params.paidAmount, status: params.status, updatedBy: params.actingUserId },
  });
}

export async function markPaymentVoided(db: Db, params: { id: string; voidedAt: Date }): Promise<CustomerPayment> {
  return db.customerPayment.update({ where: { id: params.id }, data: { voidedAt: params.voidedAt } });
}

export async function getStatementSales(db: Db, params: { userId: string; customerId: string }): Promise<Sale[]> {
  return db.sale.findMany({
    where: { userId: params.userId, customerId: params.customerId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getStatementPayments(
  db: Db,
  params: { userId: string; customerId: string },
): Promise<CustomerPayment[]> {
  return db.customerPayment.findMany({
    where: { userId: params.userId, customerId: params.customerId, voidedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Raw aggregates only, per customer/tenant-wide receivables indicators —
 * the service layer does the subtraction (outstanding = total - paid). See
 * DATABASE.md, "Accounts receivable", "Financial indicators".
 */
export async function getReceivablesAggregates(
  db: Db,
  params: { userId: string; from?: Date; to?: Date },
) {
  // `to` names the LAST calendar day to include, but arrives as a bare date
  // — parsed as UTC midnight, i.e. the very start of that day — so a naive
  // `lte: to` would exclude everything that actually happened ON that day
  // (in practice: "today" never counts toward "this month" until tomorrow).
  // Converted here to an exclusive "start of the next UTC day" bound
  // instead, the same fix dashboard.service.ts's other period queries
  // already apply to their own `to` parameter.
  const toExclusive = params.to
    ? new Date(Date.UTC(params.to.getUTCFullYear(), params.to.getUTCMonth(), params.to.getUTCDate() + 1))
    : undefined;

  const [outstandingAgg, distinctCustomers, soldAgg, receivedAgg] = await Promise.all([
    db.sale.aggregate({
      where: { userId: params.userId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { total: true, paidAmount: true },
    }),
    db.sale.findMany({
      where: {
        userId: params.userId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
    db.sale.aggregate({
      where: {
        userId: params.userId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: params.from, lt: toExclusive },
      },
      _sum: { total: true },
    }),
    db.customerPayment.aggregate({
      where: { userId: params.userId, voidedAt: null, createdAt: { gte: params.from, lt: toExclusive } },
      _sum: { amount: true },
    }),
  ]);

  return {
    outstandingTotal: outstandingAgg._sum.total,
    outstandingPaid: outstandingAgg._sum.paidAmount,
    customersWithBalanceCount: distinctCustomers.length,
    soldTotal: soldAgg._sum.total,
    receivedTotal: receivedAgg._sum.amount,
  };
}

// --- Dashboard aggregates. See ARCHITECTURE.md §6/§5: these live here (not
// in a dashboard.repository.ts) because CustomerPayment is this feature's own
// model — dashboard.service.ts only ever calls customers.service.ts's
// wrappers below. Neither query reaches into any other feature's table.

/**
 * Cash timeline (received, not sold) bucketed by day/week/month via
 * Postgres's own `date_trunc` — the caller (dashboard.service.ts) must
 * zero-fill missing buckets using a JS cursor snapped to the exact same
 * truncation boundary, or generated keys won't match these rows' `bucket`
 * values. Voided payments excluded, same as every other receivables query.
 */
export async function getReceivedTimeline(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date; granularity: 'day' | 'week' | 'month' },
): Promise<Array<{ bucket: Date; received: string }>> {
  return db.$queryRaw<Array<{ bucket: Date; received: string }>>`
    SELECT date_trunc(${params.granularity}, "createdAt") AS bucket,
           COALESCE(SUM("amount"), 0)::text AS received
    FROM "CustomerPayment"
    WHERE "userId" = ${params.userId}::uuid
      AND "voidedAt" IS NULL
      AND "createdAt" >= ${params.from}
      AND "createdAt" < ${params.toExclusive}
    GROUP BY bucket
    ORDER BY bucket
  `;
}

export interface RecentPaymentRow {
  paymentId: string;
  customerId: string | null;
  customerName: string | null;
  amount: string;
  paymentMethod: PaymentMethod | null;
  createdAt: Date;
}

/** Most recent non-voided payments in the period — `customerName` is null for a walk-in (no-customer) payment. */
export async function getRecentPayments(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<RecentPaymentRow[]> {
  return db.$queryRaw<RecentPaymentRow[]>`
    SELECT cp.id AS "paymentId",
           cp."customerId" AS "customerId",
           c.name AS "customerName",
           cp.amount::text AS amount,
           cp."paymentMethod" AS "paymentMethod",
           cp."createdAt" AS "createdAt"
    FROM "CustomerPayment" cp
    LEFT JOIN "Customer" c ON c.id = cp."customerId"
    WHERE cp."userId" = ${params.userId}::uuid
      AND cp."voidedAt" IS NULL
      AND cp."createdAt" >= ${params.from}
      AND cp."createdAt" < ${params.toExclusive}
    ORDER BY cp."createdAt" DESC
    LIMIT ${params.limit}
  `;
}
