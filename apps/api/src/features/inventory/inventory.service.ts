import type { StockWriteOffReason } from '@lotea/shared';

import { Prisma, type InventoryMovementType, type PrismaClient } from '../../generated/prisma/client';
import * as lotsService from '../lots/lots.service';
import * as productsService from '../products/products.service';
import { InsufficientStockError, LotNotActiveError, NotFoundError } from '../../shared/errors/app-error';
import { apportionAmountByWeight } from '../../shared/lib/lot-apportionment';
import * as inventoryRepository from './inventory.repository';

type PrismaOrTx = Prisma.TransactionClient;

/**
 * Registers an "Entrada": verifies the lot and product both belong to the
 * tenant (and the lot is still ACTIVE — you can't add stock to a lot you've
 * already closed out), then creates `quantity` individual InventoryItem rows
 * plus one PURCHASE_ENTRY movement each, all inside one transaction — a
 * failure on unit N rolls back units 1..N-1 too, never leaving a partial
 * entry committed. `quantity` is only ever an input — it's never persisted
 * anywhere. See ARCHITECTURE.md §6.6.
 *
 * Returns the full array of created items — useful to callers that need them
 * (the seed script, tests). The HTTP layer never serializes this array
 * as-is; inventory.controller.ts shapes it into a summary response instead,
 * per the "don't return an unnecessarily large response" requirement.
 */
export async function registerPurchaseEntry(
  prisma: PrismaClient,
  params: {
    userId: string;
    productId: string;
    lotId: string;
    quantity: number;
    acquisitionCost: string;
    expiresAt?: Date | null;
    actingUserId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const lot = await lotsService.getLot(tx, { id: params.lotId, userId: params.userId });
    if (lot.status !== 'ACTIVE') {
      throw new LotNotActiveError(lot.status);
    }

    const product = await productsService.getProductById(tx, {
      id: params.productId,
      userId: params.userId,
    });
    if (!product) {
      throw new NotFoundError(`Product ${params.productId} not found`);
    }

    const items = [];
    for (let i = 0; i < params.quantity; i += 1) {
      const item = await inventoryRepository.createItem(tx, params);
      await inventoryRepository.createMovement(tx, {
        userId: params.userId,
        inventoryItemId: item.id,
        type: 'PURCHASE_ENTRY',
        actingUserId: params.actingUserId,
      });
      items.push(item);
    }
    return items;
  });
}

const REASON_TO_MOVEMENT_TYPE: Record<StockWriteOffReason, InventoryMovementType> = {
  // Both leave stock for good and never come back — see writeOffInputSchema's
  // comment on why DEVOLUCAO isn't the `RETURN` movement type.
  DEVOLUCAO: 'WRITE_OFF',
  PERDA: 'WRITE_OFF',
  AJUSTE: 'MANUAL_ADJUSTMENT',
};

/**
 * Registers a manual "Saída de estoque": picks the oldest `quantity`
 * IN_STOCK units for the product (same FIFO order Nova Venda's cart claims
 * from), marks each `WRITTEN_OFF`, and records one movement per unit — all
 * inside one transaction, same shape as `registerPurchaseEntry`. Throws
 * `InsufficientStockError` rather than partially writing off what's
 * available; the caller decides whether to retry with a smaller quantity.
 */
export async function registerWriteOff(
  prisma: PrismaClient,
  params: {
    userId: string;
    productId: string;
    quantity: number;
    reason: StockWriteOffReason;
    notes?: string | null;
    actingUserId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const product = await productsService.getProductById(tx, {
      id: params.productId,
      userId: params.userId,
    });
    if (!product) {
      throw new NotFoundError(`Product ${params.productId} not found`);
    }

    const items = await inventoryRepository.findAvailableForProduct(tx, {
      userId: params.userId,
      productId: params.productId,
      limit: params.quantity,
    });
    if (items.length < params.quantity) {
      throw new InsufficientStockError(params.productId, items.length, params.quantity);
    }

    const movementType = REASON_TO_MOVEMENT_TYPE[params.reason];
    for (const item of items) {
      await inventoryRepository.updateStatus(tx, {
        id: item.id,
        status: 'WRITTEN_OFF',
        actingUserId: params.actingUserId,
      });
      await inventoryRepository.createMovement(tx, {
        userId: params.userId,
        inventoryItemId: item.id,
        type: movementType,
        actingUserId: params.actingUserId,
        notes: params.notes ?? undefined,
      });
    }
    return items;
  });
}

/** Available stock is IN_STOCK count only — never RESERVED or SOLD. */
export async function getAvailableCount(
  db: PrismaOrTx,
  params: { userId: string; productId?: string; lotId?: string },
) {
  return inventoryRepository.countByStatus(db, { ...params, status: 'IN_STOCK' });
}

/**
 * Sellable units for one product — backs the Nova Venda cart, which needs
 * concrete `inventoryItemId`s (never productId + quantity) to build a
 * `createSaleInputSchema` payload. Returns up to `limit` items plus the true
 * total available count, so the cart can show "12 disponíveis" even when
 * only a handful are fetched.
 */
export async function listAvailableForProduct(
  db: PrismaOrTx,
  params: { userId: string; productId: string; limit: number },
) {
  const [items, total] = await Promise.all([
    inventoryRepository.findAvailableForProduct(db, params),
    getAvailableCount(db, { userId: params.userId, productId: params.productId }),
  ]);
  return { items, total };
}

// --- The rest of these exist so other features (namely `sales`) never reach
// into `inventory.repository` directly — this module is inventory's public
// interface for cross-feature transactional writes. See ARCHITECTURE.md §5.

/** Looks up an item for a prospective sale — scoped by userId, regardless of its current status. */
export async function getItemForSale(db: PrismaOrTx, params: { id: string; userId: string }) {
  return inventoryRepository.findById(db, params);
}

export async function markSold(db: PrismaOrTx, params: { id: string; actingUserId: string }) {
  return inventoryRepository.updateStatus(db, { ...params, status: 'SOLD' });
}

export async function markInStock(db: PrismaOrTx, params: { id: string; actingUserId: string }) {
  return inventoryRepository.updateStatus(db, { ...params, status: 'IN_STOCK' });
}

export const recordMovement = inventoryRepository.createMovement;

export interface LotFinancials {
  itemCount: number;
  soldCount: number;
  totalCost: string;
  revenue: string;
  realizedProfit: string;
  hasRecoveredInvestment: boolean;
  /** How much of `revenue` has actually been collected — derived below, never a second independent apportionment. */
  totalReceived: string;
  /** `revenue - totalReceived` — the lot's own "ainda a receber". */
  outstanding: string;
}

/** Revenue, cost, and profit for a lot — always derived, never stored. See DATABASE.md. */
export async function getLotFinancials(
  db: PrismaOrTx,
  params: { userId: string; lotId: string },
): Promise<LotFinancials> {
  const aggregates = await inventoryRepository.getLotFinancialAggregates(db, params);

  const totalCost = aggregates.totalCost ?? new Prisma.Decimal(0);
  const revenue = aggregates.revenue ?? new Prisma.Decimal(0);
  const realizedCostOfGoodsSold = aggregates.realizedCostOfGoodsSold ?? new Prisma.Decimal(0);
  const realizedProfit = revenue.minus(realizedCostOfGoodsSold);

  // Unlimited — the true total needs every customer with a balance on this
  // lot, not just the top N shown in a "clientes com saldo" list.
  const customerBalances = await getLotCustomerBalances(db, {
    userId: params.userId,
    lotId: params.lotId,
  });
  const outstanding = customerBalances.reduce(
    (sum, row) => sum.plus(row.outstanding),
    new Prisma.Decimal(0),
  );
  const totalReceived = revenue.minus(outstanding);

  return {
    itemCount: aggregates.itemCount,
    soldCount: aggregates.soldCount,
    totalCost: totalCost.toFixed(2),
    revenue: revenue.toFixed(2),
    realizedProfit: realizedProfit.toFixed(2),
    hasRecoveredInvestment: revenue.gte(totalCost),
    totalReceived: totalReceived.toFixed(2),
    outstanding: outstanding.toFixed(2),
  };
}

export type { LotItemRow } from './inventory.repository';

/** What was actually added to a lot, one row per (product, acquisition cost) — see inventory.repository.ts's getLotItemRows. */
export async function getLotItems(db: PrismaOrTx, params: { userId: string; lotId: string }) {
  return inventoryRepository.getLotItemRows(db, params);
}

export interface LotCustomerBalance {
  customerId: string;
  name: string;
  outstanding: string;
}

/**
 * "Clientes com saldo referente ao lote" — a derived, read-only grouping of
 * every currently-open sale that touches this lot, by customer. A sale
 * spanning multiple lots has its outstanding balance split across them
 * proportionally (see shared/lib/lot-apportionment.ts) — this never creates
 * a per-lot debt entity, never touches CustomerPayment/PaymentAllocation,
 * and never changes FIFO; it only decides how an already-computed balance is
 * broken out for display. See DATABASE.md, "Lot composition".
 *
 * `limit` is omitted (unbounded) by getLotFinancials, which needs every
 * customer to compute the lot's true outstanding total — a caller building a
 * "top customers" display list should pass one.
 */
export async function getLotCustomerBalances(
  db: PrismaOrTx,
  params: { userId: string; lotId: string; limit?: number },
): Promise<LotCustomerBalance[]> {
  const rows = await inventoryRepository.getOpenSaleLotWeightsForLot(db, params);

  const saleWeightsById = new Map<
    string,
    {
      total: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
      customerId: string;
      customerName: string;
      weights: Array<{ key: string; weight: Prisma.Decimal }>;
    }
  >();
  for (const row of rows) {
    let sale = saleWeightsById.get(row.saleId);
    if (!sale) {
      sale = {
        total: row.total,
        paidAmount: row.paidAmount,
        customerId: row.customerId,
        customerName: row.customerName,
        weights: [],
      };
      saleWeightsById.set(row.saleId, sale);
    }
    sale.weights.push({ key: row.lotId, weight: row.weight });
  }

  const balanceByCustomer = new Map<string, { name: string; outstanding: Prisma.Decimal }>();
  for (const sale of saleWeightsById.values()) {
    const outstanding = sale.total.minus(sale.paidAmount);
    if (outstanding.lessThanOrEqualTo(0)) continue; // fully paid — nothing to attribute

    const shares = apportionAmountByWeight(outstanding, sale.weights);
    const thisLotShare = shares.get(params.lotId) ?? new Prisma.Decimal(0);
    if (thisLotShare.lessThanOrEqualTo(0)) continue;

    const existing = balanceByCustomer.get(sale.customerId);
    if (existing) {
      existing.outstanding = existing.outstanding.plus(thisLotShare);
    } else {
      balanceByCustomer.set(sale.customerId, { name: sale.customerName, outstanding: thisLotShare });
    }
  }

  const ranked = [...balanceByCustomer.entries()].sort((a, b) =>
    b[1].outstanding.comparedTo(a[1].outstanding),
  );
  const limited = params.limit ? ranked.slice(0, params.limit) : ranked;

  return limited.map(([customerId, value]) => ({
    customerId,
    name: value.name,
    outstanding: value.outstanding.toFixed(2),
  }));
}
