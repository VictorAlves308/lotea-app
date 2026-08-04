import { generateId } from '@lotea/shared';

import type {
  InventoryItem,
  InventoryItemStatus,
  InventoryMovementType,
  Prisma,
} from '../../generated/prisma/client';

/** Anything with Prisma's query API — the main client or an open `$transaction` client. */
type Db = Prisma.TransactionClient;

export async function createItem(
  db: Db,
  params: {
    userId: string;
    productId: string;
    lotId: string;
    acquisitionCost: string;
    expiresAt?: Date | null;
    actingUserId: string;
  },
): Promise<InventoryItem> {
  return db.inventoryItem.create({
    data: {
      id: generateId(),
      userId: params.userId,
      productId: params.productId,
      lotId: params.lotId,
      acquisitionCost: params.acquisitionCost,
      expiresAt: params.expiresAt ?? null,
      createdBy: params.actingUserId,
      updatedBy: params.actingUserId,
    },
  });
}

export async function createMovement(
  db: Db,
  params: {
    userId: string;
    inventoryItemId: string;
    type: InventoryMovementType;
    actingUserId: string;
    saleId?: string;
    notes?: string;
  },
) {
  return db.inventoryMovement.create({
    data: {
      id: generateId(),
      userId: params.userId,
      inventoryItemId: params.inventoryItemId,
      type: params.type,
      saleId: params.saleId ?? null,
      notes: params.notes ?? null,
      createdBy: params.actingUserId,
    },
  });
}

/** Always scoped by userId — see ARCHITECTURE.md's tenant-isolation rule. */
export async function findById(
  db: Db,
  params: { id: string; userId: string },
): Promise<InventoryItem | null> {
  return db.inventoryItem.findFirst({ where: { id: params.id, userId: params.userId } });
}

export async function updateStatus(
  db: Db,
  params: { id: string; status: InventoryItemStatus; actingUserId: string },
): Promise<InventoryItem> {
  return db.inventoryItem.update({
    where: { id: params.id },
    data: { status: params.status, updatedBy: params.actingUserId },
  });
}

export async function countByStatus(
  db: Db,
  params: { userId: string; status: InventoryItemStatus; productId?: string; lotId?: string },
): Promise<number> {
  return db.inventoryItem.count({
    where: {
      userId: params.userId,
      status: params.status,
      productId: params.productId,
      lotId: params.lotId,
    },
  });
}

/** Oldest-first — encourages clearing older stock first when a sale doesn't care which physical unit it gets. */
export async function findAvailableForProduct(
  db: Db,
  params: { userId: string; productId: string; limit: number },
): Promise<InventoryItem[]> {
  return db.inventoryItem.findMany({
    where: { userId: params.userId, productId: params.productId, status: 'IN_STOCK' },
    orderBy: { createdAt: 'asc' },
    take: params.limit,
  });
}

/**
 * Raw aggregates only — no derived profit math here, that's a business rule
 * and belongs in the service layer. Revenue/cost are always computed on read
 * from SaleItem — never stored — so they can never drift from the sales that
 * actually make them up. `voidedAt: null` excludes cancelled sale items. See
 * DATABASE.md, "Financial invariants".
 */
export async function getLotFinancialAggregates(db: Db, params: { userId: string; lotId: string }) {
  const [costAgg, salesAgg] = await Promise.all([
    db.inventoryItem.aggregate({
      where: { userId: params.userId, lotId: params.lotId },
      _sum: { acquisitionCost: true },
      _count: { _all: true },
    }),
    db.saleItem.aggregate({
      where: {
        userId: params.userId,
        voidedAt: null,
        inventoryItem: { lotId: params.lotId },
      },
      _sum: { salePrice: true, acquisitionCostSnapshot: true },
      _count: { _all: true },
    }),
  ]);

  return {
    itemCount: costAgg._count._all,
    soldCount: salesAgg._count._all,
    totalCost: costAgg._sum.acquisitionCost,
    revenue: salesAgg._sum.salePrice,
    realizedCostOfGoodsSold: salesAgg._sum.acquisitionCostSnapshot,
  };
}

export interface LotItemRow {
  productId: string;
  productName: string;
  acquisitionCost: string;
  quantity: number;
  inStockCount: number;
  soldCount: number;
}

/**
 * What was actually added to a lot — grouped by (product, acquisition cost)
 * since that pair is exactly one purchase-entry line (see RegisterEntryInput);
 * a lot with the same product bought twice at different costs shows as two
 * rows, not one blended average. Ordered by first-added, oldest first.
 */
export async function getLotItemRows(db: Db, params: { userId: string; lotId: string }): Promise<LotItemRow[]> {
  return db.$queryRaw<LotItemRow[]>`
    SELECT
      ii."productId",
      p.name AS "productName",
      ii."acquisitionCost"::text AS "acquisitionCost",
      COUNT(*)::int AS "quantity",
      COUNT(*) FILTER (WHERE ii.status = 'IN_STOCK')::int AS "inStockCount",
      COUNT(*) FILTER (WHERE ii.status = 'SOLD')::int AS "soldCount"
    FROM "InventoryItem" ii
    JOIN "Product" p ON p.id = ii."productId"
    WHERE ii."userId" = ${params.userId}::uuid
      AND ii."lotId" = ${params.lotId}::uuid
    GROUP BY ii."productId", p.name, ii."acquisitionCost"
    ORDER BY MIN(ii."createdAt") ASC
  `;
}

export interface OpenSaleLotWeightRow {
  saleId: string;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  customerId: string;
  customerName: string;
  lotId: string;
  weight: Prisma.Decimal;
}

/**
 * Raw per-(sale, lot) weight rows for every currently-open sale that touches
 * `lotId` — a "lot dashboard" aggregate. Fetches **every** lot a matching
 * sale touches (not just `lotId`'s own row), because attributing a share of
 * that sale's outstanding balance to one lot requires knowing every lot's
 * weight in it (see shared/lib/lot-apportionment.ts). `customerId` is always
 * non-null here — the `Sale_customer_required_when_outstanding` CHECK
 * guarantees it for any open sale — so the inner join to Customer is safe.
 * See DATABASE.md, "Lot composition".
 */
export async function getOpenSaleLotWeightsForLot(
  db: Db,
  params: { userId: string; lotId: string },
): Promise<OpenSaleLotWeightRow[]> {
  return db.$queryRaw<OpenSaleLotWeightRow[]>`
    WITH relevant_sales AS (
      SELECT DISTINCT s.id
      FROM "Sale" s
      JOIN "SaleItem" si ON si."saleId" = s.id AND si."voidedAt" IS NULL
      JOIN "InventoryItem" ii ON ii.id = si."inventoryItemId"
      WHERE s."userId" = ${params.userId}::uuid
        AND ii."lotId" = ${params.lotId}::uuid
        AND s.status IN ('PENDING', 'PARTIALLY_PAID')
    )
    SELECT s.id AS "saleId", s.total, s."paidAmount", s."customerId", c.name AS "customerName",
           ii."lotId", SUM(si."salePrice") AS weight
    FROM relevant_sales rs
    JOIN "Sale" s ON s.id = rs.id
    JOIN "SaleItem" si ON si."saleId" = s.id AND si."voidedAt" IS NULL
    JOIN "InventoryItem" ii ON ii.id = si."inventoryItemId"
    JOIN "Customer" c ON c.id = s."customerId"
    GROUP BY s.id, s.total, s."paidAmount", s."customerId", c.name, ii."lotId"
  `;
}
