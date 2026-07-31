import { Prisma, type PaymentMethod, type PrismaClient, type SaleStatus } from '../../generated/prisma/client.ts';
import * as customersService from '../customers/customers.service';
import * as inventoryService from '../inventory/inventory.service';
import {
  CustomerRequiredError,
  InventoryItemUnavailableError,
  InvalidPaymentAmountError,
  NotFoundError,
  SaleHasActivePaymentsError,
} from '../../shared/errors/app-error';
import { isUniqueConstraintViolation } from '../../shared/lib/prisma-errors';
import { computeSaleStatus } from './sale-status';
import * as salesRepository from './sales.repository';
import type { SaleWithItems } from './sales.repository';

type PrismaOrTx = Prisma.TransactionClient;

export interface CreateSaleItemInput {
  inventoryItemId: string;
  salePrice: string;
}

/** Fetch-or-throw — always scoped by userId. */
export async function getSale(db: PrismaOrTx, params: { id: string; userId: string }): Promise<SaleWithItems> {
  const sale = await salesRepository.findById(db, params);
  if (!sale) {
    throw new NotFoundError(`Sale ${params.id} not found`);
  }
  return sale;
}

export interface CreateSaleParams {
  userId: string;
  actingUserId: string;
  idempotencyKey?: string | null;
  items: CreateSaleItemInput[];
  /**
   * "Valor recebido agora". Optional and defaults to the computed total when
   * omitted — this is what keeps every pre-existing caller (seed.ts, and
   * tenant-isolation.test.ts/soft-delete.test.ts/inventory.service.test.ts,
   * none of which pass this field) compiling and passing unchanged, since
   * "omitted" reproduces exactly today's always-fully-paid behavior. New
   * callers (the real HTTP route) always pass it explicitly — see
   * sale.schema.ts's createSaleInputSchema, where it's required.
   */
  receivedAmount?: string;
  customerId?: string | null;
  paymentMethod?: PaymentMethod | null;
}

/**
 * Creates a sale: validates every InventoryItem is IN_STOCK, marks each SOLD,
 * snapshots its acquisition cost onto the SaleItem, and records a SALE
 * movement — all in one transaction. Also resolves `receivedAmount`/
 * `customerId` into a computed `status`/`paidAmount` and, when money was
 * actually received, a real CustomerPayment + PaymentAllocation targeting
 * only this new sale — see DATABASE.md, "Accounts receivable".
 *
 * Idempotency (DATABASE.md §7): when `idempotencyKey` is provided, a
 * pre-check returns an existing Sale with the same (userId, idempotencyKey)
 * pair if one already exists. Under a genuine concurrent duplicate (two
 * requests racing past the pre-check), the `Sale_userId_idempotencyKey_key`
 * unique constraint rejects the second insert with a Postgres
 * unique-violation (Prisma P2002); that violation is caught here and the
 * already-committed sale is fetched and returned instead — the caller never
 * sees a duplicate-sale error, and a retried/duplicated offline submission
 * always converges on the same one sale. This also covers the initial
 * payment: since it's created inside the same transaction as the Sale, a
 * retried request that hits the pre-check never creates a second payment.
 *
 * Double-selling the same unit is prevented the same way, one layer down:
 * the `SaleItem_active_inventoryItemId_key` partial unique index rejects a
 * second active SaleItem for the same InventoryItem even if two transactions
 * both raced past the `status === 'IN_STOCK'` check below.
 */
export async function createSale(
  prisma: PrismaClient,
  params: CreateSaleParams,
): Promise<SaleWithItems> {
  const { userId, actingUserId, items } = params;
  const idempotencyKey = params.idempotencyKey ?? null;
  const customerId = params.customerId ?? null;

  if (idempotencyKey) {
    const existing = await salesRepository.findByIdempotencyKey(prisma, { userId, idempotencyKey });
    if (existing) return existing;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      let total = new Prisma.Decimal(0);
      const resolvedItems = [];

      for (const item of items) {
        const inventoryItem = await inventoryService.getItemForSale(tx, {
          id: item.inventoryItemId,
          userId,
        });
        if (!inventoryItem) {
          throw new NotFoundError(`Inventory item ${item.inventoryItemId} not found`);
        }
        if (inventoryItem.status !== 'IN_STOCK') {
          throw new InventoryItemUnavailableError(item.inventoryItemId);
        }

        total = total.plus(item.salePrice);
        resolvedItems.push({ input: item, inventoryItem });
      }

      const receivedAmount =
        params.receivedAmount !== undefined ? new Prisma.Decimal(params.receivedAmount) : total;

      if (receivedAmount.lessThan(0)) {
        throw new InvalidPaymentAmountError('Received amount must not be negative.');
      }
      if (receivedAmount.greaterThan(total)) {
        throw new InvalidPaymentAmountError('Received amount cannot exceed the sale total.');
      }
      // App-level fast path — the Sale_customer_required_when_outstanding
      // CHECK constraint is the DB-level backstop, not the primary guard,
      // mirroring the existing double-selling prevention philosophy.
      if (receivedAmount.lessThan(total) && !customerId) {
        throw new CustomerRequiredError();
      }
      if (customerId) {
        // 404s if missing/soft-deleted/wrong tenant — the sanctioned
        // cross-feature service-to-service read, matching how
        // inventory.service.ts resolves a productId via productsService.
        await customersService.getCustomer(tx, { id: customerId, userId });
      }

      const status = computeSaleStatus({ total, paidAmount: receivedAmount });

      const sale = await salesRepository.createSale(tx, {
        userId,
        total: total.toFixed(2),
        paidAmount: receivedAmount.toFixed(2),
        status,
        customerId,
        paymentMethod: params.paymentMethod ?? null,
        idempotencyKey,
        actingUserId,
      });

      for (const { input, inventoryItem } of resolvedItems) {
        await salesRepository.createSaleItem(tx, {
          userId,
          saleId: sale.id,
          inventoryItemId: input.inventoryItemId,
          salePrice: input.salePrice,
          acquisitionCostSnapshot: inventoryItem.acquisitionCost.toFixed(2),
          actingUserId,
        });

        await inventoryService.markSold(tx, { id: input.inventoryItemId, actingUserId });

        await inventoryService.recordMovement(tx, {
          userId,
          inventoryItemId: input.inventoryItemId,
          type: 'SALE',
          saleId: sale.id,
          actingUserId,
        });
      }

      // The initial "recebido agora" payment — targets only this new sale,
      // never any other open sale of this customer. That FIFO fan-out is
      // registerPayment's job (customers.service.ts), not this one's.
      if (receivedAmount.greaterThan(0)) {
        await customersService.recordInitialSalePayment(tx, {
          userId,
          customerId,
          saleId: sale.id,
          amount: receivedAmount.toFixed(2),
          paymentMethod: params.paymentMethod,
          actingUserId,
        });
      }

      const created = await salesRepository.findById(tx, { id: sale.id, userId });
      return created!;
    });
  } catch (error) {
    // Whatever failed, if this was a duplicate offline submission a twin
    // request may have already committed the real sale in the meantime —
    // not only via a unique-constraint violation on the Sale insert itself,
    // but also via the plain `status !== 'IN_STOCK'` check above: under
    // READ COMMITTED, if the twin transaction fully commits (marking the
    // item SOLD) in the gap between this request's idempotency pre-check
    // and its InventoryItem read, this request sees a perfectly ordinary
    // "already sold" — which is, in fact, its own duplicate having won the
    // race. Re-checking here (regardless of which error surfaced) catches
    // that case; if no such sale exists, this was a real, unrelated failure
    // and the original error is rethrown unchanged.
    if (idempotencyKey) {
      const existing = await salesRepository.findByIdempotencyKey(prisma, {
        userId,
        idempotencyKey,
      });
      if (existing) return existing;
    }
    if (isUniqueConstraintViolation(error, 'SaleItem_active_inventoryItemId_key')) {
      throw new InventoryItemUnavailableError('one of the requested items');
    }
    throw error;
  }
}

/**
 * Cancels a sale: voids every active SaleItem (excluding it from future
 * revenue/profit reads), restores each InventoryItem to IN_STOCK, and records
 * a SALE_CANCELLATION movement per item — all in one transaction. Idempotent:
 * cancelling an already-cancelled (or refunded) sale is a no-op that returns
 * it unchanged. The Sale row itself is never deleted — see DATABASE.md.
 *
 * Cancellation and an active payment can never coexist: a sale with
 * `paidAmount > 0` (partially OR fully paid) is blocked with
 * `SaleHasActivePaymentsError` — cancelling it would otherwise return items
 * to stock while money stays marked as received, with no refund/credit
 * mechanism (banned) to reconcile it. The only path forward is voiding every
 * payment allocated to this sale first (`customersService.voidPayment`),
 * which brings `paidAmount` back to 0; a second call to this function then
 * succeeds via the unchanged path below. Historical (pre-migration) sales
 * have `paidAmount = total > 0` with no payment to void — they are
 * permanently, intentionally uncancellable. See DATABASE.md, "Accounts
 * receivable" and "Historical (pre-migration) sales".
 */
export async function cancelSale(
  prisma: PrismaClient,
  params: { userId: string; saleId: string; actingUserId: string },
): Promise<SaleWithItems> {
  const { userId, saleId, actingUserId } = params;

  return prisma.$transaction(async (tx) => {
    const sale = await salesRepository.findById(tx, { id: saleId, userId });
    if (!sale) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }
    if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
      return sale;
    }
    if (sale.paidAmount.greaterThan(0)) {
      throw new SaleHasActivePaymentsError();
    }

    const voidedAt = new Date();
    const activeItems = sale.items.filter((item) => item.voidedAt === null);

    await salesRepository.voidActiveSaleItems(tx, { saleId, voidedAt });

    for (const item of activeItems) {
      await inventoryService.markInStock(tx, { id: item.inventoryItemId, actingUserId });
      await inventoryService.recordMovement(tx, {
        userId,
        inventoryItemId: item.inventoryItemId,
        type: 'SALE_CANCELLATION',
        saleId,
        actingUserId,
      });
    }

    return salesRepository.updateStatus(tx, { id: saleId, status: 'CANCELLED', actingUserId });
  });
}

// --- Dashboard aggregates — called only by dashboard.service.ts. See
// ARCHITECTURE.md §5/§6: this is Sale's own feature, so these live here
// rather than in a cross-feature dashboard.repository.ts.

export interface SalesByStatus {
  paid: number;
  partiallyPaid: number;
  pending: number;
  cancelled: number;
}

/** Zero-fills every bucket — a status with no sales in the period is 0, not absent. `REFUNDED` stays unused, per this codebase's convention. */
export async function getSalesByStatusCounts(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date },
): Promise<SalesByStatus> {
  const rows = await salesRepository.getStatusCounts(db, params);
  const result: SalesByStatus = { paid: 0, partiallyPaid: 0, pending: 0, cancelled: 0 };
  for (const row of rows) {
    if (row.status === 'PAID') result.paid = row._count._all;
    else if (row.status === 'PARTIALLY_PAID') result.partiallyPaid = row._count._all;
    else if (row.status === 'PENDING') result.pending = row._count._all;
    else if (row.status === 'CANCELLED') result.cancelled = row._count._all;
  }
  return result;
}

/** Non-cancelled sales only. */
export async function getAverageTicket(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date },
): Promise<{ averageTicket: string; count: number }> {
  const aggregate = await salesRepository.getAverageTicketAggregate(db, params);
  return {
    averageTicket: (aggregate._avg.total ?? new Prisma.Decimal(0)).toFixed(2),
    count: aggregate._count._all,
  };
}

export async function getSoldTimeline(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date; granularity: 'day' | 'week' | 'month' },
): Promise<Array<{ bucket: Date; sold: string }>> {
  return salesRepository.getSoldTimeline(db, params);
}

export async function getCostOfGoodsSold(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date },
): Promise<{ totalCost: string }> {
  return salesRepository.getCostOfGoodsSold(db, params);
}

/** The Vendas screen's list — most-recent-first, optionally filtered by status. */
export async function listSales(
  db: PrismaOrTx,
  params: { userId: string; page: number; limit: number; status?: SaleStatus },
) {
  const { items, total } = await salesRepository.listSales(db, params);
  return { items, page: params.page, limit: params.limit, total };
}
