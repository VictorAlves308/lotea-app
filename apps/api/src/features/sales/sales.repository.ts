import { generateId } from '@lotea/shared';

import { Prisma } from '../../generated/prisma/client.ts';
import type { PaymentMethod, Product, Sale, SaleItem, SaleStatus } from '../../generated/prisma/client.ts';

type Db = Prisma.TransactionClient;

/** Every SaleItem carries its sold InventoryItem's Product joined in — see toWireSale, which flattens this into productId/productName for the wire response. */
export type SaleItemWithProduct = SaleItem & { inventoryItem: { product: Product } };
export type SaleWithItems = Sale & { items: SaleItemWithProduct[] };

const ITEMS_WITH_PRODUCT_INCLUDE = { items: { include: { inventoryItem: { include: { product: true } } } } } as const;

export async function findByIdempotencyKey(
  db: Db,
  params: { userId: string; idempotencyKey: string },
): Promise<SaleWithItems | null> {
  return db.sale.findUnique({
    where: {
      userId_idempotencyKey: { userId: params.userId, idempotencyKey: params.idempotencyKey },
    },
    include: ITEMS_WITH_PRODUCT_INCLUDE,
  });
}

/** Always scoped by userId — see ARCHITECTURE.md's tenant-isolation rule. */
export async function findById(
  db: Db,
  params: { id: string; userId: string },
): Promise<SaleWithItems | null> {
  return db.sale.findFirst({
    where: { id: params.id, userId: params.userId },
    include: ITEMS_WITH_PRODUCT_INCLUDE,
  });
}

export async function createSale(
  db: Db,
  params: {
    userId: string;
    total: string;
    /** Set once at creation — the service layer computes this from receivedAmount. */
    paidAmount: string;
    /** Computed by the service layer (sale-status.ts's computeSaleStatus) — never accepted as direct input. */
    status: SaleStatus;
    customerId: string | null;
    paymentMethod: PaymentMethod | null;
    idempotencyKey: string | null;
    actingUserId: string;
  },
): Promise<Sale> {
  return db.sale.create({
    data: {
      id: generateId(),
      userId: params.userId,
      status: params.status,
      total: params.total,
      paidAmount: params.paidAmount,
      customerId: params.customerId,
      paymentMethod: params.paymentMethod,
      idempotencyKey: params.idempotencyKey,
      createdBy: params.actingUserId,
      updatedBy: params.actingUserId,
    },
  });
}

export async function createSaleItem(
  db: Db,
  params: {
    userId: string;
    saleId: string;
    inventoryItemId: string;
    salePrice: string;
    acquisitionCostSnapshot: string;
    actingUserId: string;
  },
): Promise<SaleItem> {
  return db.saleItem.create({
    data: {
      id: generateId(),
      userId: params.userId,
      saleId: params.saleId,
      inventoryItemId: params.inventoryItemId,
      salePrice: params.salePrice,
      acquisitionCostSnapshot: params.acquisitionCostSnapshot,
      createdBy: params.actingUserId,
    },
  });
}

export async function voidActiveSaleItems(
  db: Db,
  params: { saleId: string; voidedAt: Date },
): Promise<Prisma.BatchPayload> {
  return db.saleItem.updateMany({
    where: { saleId: params.saleId, voidedAt: null },
    data: { voidedAt: params.voidedAt },
  });
}

export async function updateStatus(
  db: Db,
  params: { id: string; status: SaleStatus; actingUserId: string },
): Promise<SaleWithItems> {
  return db.sale.update({
    where: { id: params.id },
    data: { status: params.status, updatedBy: params.actingUserId },
    include: ITEMS_WITH_PRODUCT_INCLUDE,
  });
}

export interface SaleListRow {
  id: string;
  status: SaleStatus;
  total: string;
  paidAmount: string;
  customerId: string | null;
  customerName: string | null;
  paymentMethod: PaymentMethod | null;
  itemCount: number;
  brand: string | null;
  createdAt: Date;
}

/**
 * The Vendas screen's list — most-recent-first, with the customer's name and
 * a representative brand already joined in (never a second round-trip per
 * row). Uses LEFT JOINs throughout: a cancelled sale has every SaleItem
 * voided, and an INNER JOIN there would silently drop it from the list
 * entirely instead of showing it (struck through, per the prototype) like
 * every other sale.
 */
export async function listSales(
  db: Db,
  params: { userId: string; page: number; limit: number; status?: SaleStatus },
): Promise<{ items: SaleListRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;
  const statusFilter = params.status ? Prisma.sql`AND s.status = ${params.status}::"SaleStatus"` : Prisma.empty;

  // Shared by both queries below — every JOIN needed for filtering comes
  // before this, so it must not itself contain any JOIN that only the item
  // query needs (that one goes between FROM and this fragment instead — see
  // `itemsQuery`, which composes `whereClause` after its own extra join, not
  // before it).
  const whereClause = Prisma.sql`
    WHERE s."userId" = ${params.userId}::uuid
    ${statusFilter}
  `;

  const [items, countResult] = await Promise.all([
    db.$queryRaw<SaleListRow[]>(Prisma.sql`
      SELECT
        s.id, s.status, s.total::text AS total, s."paidAmount"::text AS "paidAmount",
        s."customerId", c.name AS "customerName", s."paymentMethod", s."createdAt",
        COALESCE(agg."itemCount", 0)::int AS "itemCount",
        agg.brand
      FROM "Sale" s
      LEFT JOIN "Customer" c ON c.id = s."customerId"
      LEFT JOIN (
        SELECT si."saleId",
               COUNT(si.id) AS "itemCount",
               (array_agg(p.brand ORDER BY si."createdAt"))[1] AS brand
        FROM "SaleItem" si
        JOIN "InventoryItem" ii ON ii.id = si."inventoryItemId"
        JOIN "Product" p ON p.id = ii."productId"
        GROUP BY si."saleId"
      ) agg ON agg."saleId" = s.id
      ${whereClause}
      ORDER BY s."createdAt" DESC
      LIMIT ${params.limit} OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Sale" s
      ${whereClause}
    `),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

// --- Dashboard aggregates. See ARCHITECTURE.md §6/§5: these live here (not
// in a dashboard.repository.ts) because Sale is this feature's own model —
// dashboard.service.ts only ever calls sales.service.ts's wrappers below.

/** Raw per-status counts in the period — the service layer zero-fills every SaleStatus. */
export async function getStatusCounts(db: Db, params: { userId: string; from: Date; toExclusive: Date }) {
  return db.sale.groupBy({
    by: ['status'],
    where: { userId: params.userId, createdAt: { gte: params.from, lt: params.toExclusive } },
    orderBy: { status: 'asc' },
    _count: { _all: true },
  });
}

/** Non-cancelled sales only — "ticket médio" excludes a sale that never happened. */
export async function getAverageTicketAggregate(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date },
) {
  return db.sale.aggregate({
    where: {
      userId: params.userId,
      status: { not: 'CANCELLED' },
      createdAt: { gte: params.from, lt: params.toExclusive },
    },
    _avg: { total: true },
    _count: { _all: true },
  });
}

/**
 * Accrual timeline (sold, not received) bucketed by day/week/month via
 * Postgres's own `date_trunc` — the caller (dashboard.service.ts) must
 * zero-fill missing buckets using a JS cursor snapped to the exact same
 * truncation boundary `date_trunc` produces, or generated keys won't match
 * these rows' `bucket` values. Cancelled sales excluded, same as every other
 * revenue-facing query in this codebase.
 */
export async function getSoldTimeline(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date; granularity: 'day' | 'week' | 'month' },
): Promise<Array<{ bucket: Date; sold: string }>> {
  return db.$queryRaw<Array<{ bucket: Date; sold: string }>>`
    SELECT date_trunc(${params.granularity}, "createdAt") AS bucket,
           COALESCE(SUM("total"), 0)::text AS sold
    FROM "Sale"
    WHERE "userId" = ${params.userId}::uuid
      AND "status" != 'CANCELLED'
      AND "createdAt" >= ${params.from}
      AND "createdAt" < ${params.toExclusive}
    GROUP BY bucket
    ORDER BY bucket
  `;
}

/**
 * Period cost of goods sold — `acquisitionCostSnapshot` is the frozen cost
 * each SaleItem carried at sale time (see sale.schema.ts), so this can never
 * drift even if a product's/lot's cost is edited later. `voidedAt: null`
 * excludes cancelled-sale items, same filter every other revenue-facing
 * query in this codebase uses (never a join to Sale's own `status`).
 */
export async function getCostOfGoodsSold(
  db: Db,
  params: { userId: string; from: Date; toExclusive: Date },
): Promise<{ totalCost: string }> {
  const result = await db.saleItem.aggregate({
    where: {
      userId: params.userId,
      voidedAt: null,
      createdAt: { gte: params.from, lt: params.toExclusive },
    },
    _sum: { acquisitionCostSnapshot: true },
  });
  return { totalCost: (result._sum.acquisitionCostSnapshot ?? new Prisma.Decimal(0)).toFixed(2) };
}
