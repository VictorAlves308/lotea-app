import { normalizeSearchText } from '@lotea/shared';

import { computeSaleStatus } from '../sales/sale-status';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import type { Customer, CustomerPayment, PaymentAllocation, PaymentMethod } from '../../generated/prisma/client';
import {
  CustomerHasOpenBalanceError,
  CustomerNotFoundError,
  InvalidPaymentAmountError,
  PaymentExceedsBalanceError,
} from '../../shared/errors/app-error';
import { retrySerializationFailures } from '../../shared/lib/retry';
import * as customersRepository from './customers.repository';
import type { CustomerListRow, CustomerPaymentWithAllocations } from './customers.repository';

type PrismaOrTx = Prisma.TransactionClient;

export interface CreateCustomerParams {
  userId: string;
  actingUserId: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
}

/** Unconditional creation — used by the duplicate-check flow below once confirmed, and directly by tests/seed. */
export async function createCustomer(db: PrismaOrTx, params: CreateCustomerParams): Promise<Customer> {
  const searchTerms = normalizeSearchText(params.name);
  return customersRepository.createCustomer(db, { ...params, searchTerms });
}

/**
 * Typo-tolerant, accent-insensitive name search — the same function backs
 * both as-you-type autocomplete (during the sale flow) and the "check for
 * duplicates before creating" flow, exactly mirroring
 * products.service.ts's searchProducts.
 */
export async function searchCustomers(
  db: PrismaOrTx,
  params: { userId: string; query: string; limit?: number },
): Promise<Customer[]> {
  const normalizedQuery = normalizeSearchText(params.query);
  if (!normalizedQuery) return [];

  return customersRepository.searchBySearchTerms(db, {
    userId: params.userId,
    normalizedQuery,
    limit: params.limit ?? 10,
  });
}

export interface CreateCustomerResult {
  created: boolean;
  customer?: Customer;
  duplicateCandidates?: Customer[];
}

/**
 * The route-facing creation flow: unless the caller has already reviewed
 * candidates and set `confirmDuplicate`, this searches for similarly-named
 * existing customers first and, if any are found, returns them instead of
 * creating. Never blocks on identical names — duplicate names are expected
 * and allowed; this is a UX nudge, never a DB constraint. Mirrors
 * products.service.ts's createProductWithDuplicateCheck.
 */
export async function createCustomerWithDuplicateCheck(
  db: PrismaOrTx,
  params: CreateCustomerParams & { confirmDuplicate: boolean },
): Promise<CreateCustomerResult> {
  if (!params.confirmDuplicate) {
    const candidates = await searchCustomers(db, { userId: params.userId, query: params.name, limit: 5 });
    if (candidates.length > 0) {
      return { created: false, duplicateCandidates: candidates };
    }
  }

  const customer = await createCustomer(db, params);
  return { created: true, customer };
}

/** Fetch-or-throw — the cross-feature read `sales.service.ts` uses to resolve a `customerId`. */
export async function getCustomer(db: PrismaOrTx, params: { id: string; userId: string }): Promise<Customer> {
  const customer = await customersRepository.findById(db, params);
  if (!customer) {
    throw new CustomerNotFoundError();
  }
  return customer;
}

/**
 * Records the initial "recebido agora" payment at sale creation — a single
 * CustomerPayment + PaymentAllocation targeting exactly one sale, customer
 * optional. Called by `sales.service.ts`'s `createSale`, inside its own
 * creation transaction — the sanctioned cross-feature service-to-service
 * call, not a repository reach-through. Never touches `Sale` itself:
 * `sales.repository.ts` already writes that sale's `paidAmount`/`status`
 * directly as part of the same creation — this only creates the payment
 * trail so it's visible in the customer's extrato and the receivables
 * indicators. See DATABASE.md, "Accounts receivable".
 */
export async function recordInitialSalePayment(
  db: PrismaOrTx,
  params: {
    userId: string;
    customerId: string | null;
    saleId: string;
    amount: string;
    paymentMethod?: PaymentMethod | null;
    actingUserId: string;
  },
): Promise<void> {
  const payment = await customersRepository.createPayment(db, {
    userId: params.userId,
    customerId: params.customerId,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    actingUserId: params.actingUserId,
  });
  await customersRepository.createAllocation(db, {
    userId: params.userId,
    customerPaymentId: payment.id,
    saleId: params.saleId,
    amount: params.amount,
    actingUserId: params.actingUserId,
  });
}

export async function updateCustomer(
  db: PrismaOrTx,
  params: {
    id: string;
    userId: string;
    actingUserId: string;
    name?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
): Promise<Customer> {
  await getCustomer(db, params); // 404 if missing/soft-deleted/wrong tenant
  return customersRepository.updateCustomer(db, {
    id: params.id,
    actingUserId: params.actingUserId,
    name: params.name ?? undefined,
    phone: params.phone,
    notes: params.notes,
    searchTerms: params.name ? normalizeSearchText(params.name) : undefined,
  });
}

async function getBalanceInfo(
  db: PrismaOrTx,
  params: { userId: string; customerId: string },
): Promise<{ balance: string; openSalesCount: number }> {
  const aggregate = await customersRepository.getBalanceAggregate(db, {
    userId: params.userId,
    customerId: params.customerId,
  });
  const totalSum = aggregate.totalSum ?? new Prisma.Decimal(0);
  const paidSum = aggregate.paidSum ?? new Prisma.Decimal(0);
  return { balance: totalSum.minus(paidSum).toFixed(2), openSalesCount: aggregate.openSalesCount };
}

export async function getCustomerDetail(
  db: PrismaOrTx,
  params: { id: string; userId: string },
): Promise<Customer & { balance: string; openSalesCount: number }> {
  const customer = await getCustomer(db, params);
  const balanceInfo = await getBalanceInfo(db, { userId: params.userId, customerId: params.id });
  return { ...customer, ...balanceInfo };
}

export async function listCustomers(
  db: PrismaOrTx,
  params: {
    userId: string;
    page: number;
    limit: number;
    sort: 'name' | 'balance' | 'recent';
    hasBalance?: boolean;
  },
): Promise<{ items: CustomerListRow[]; page: number; limit: number; total: number }> {
  const { items, total } = await customersRepository.listWithBalance(db, params);
  return { items, total, page: params.page, limit: params.limit };
}

/** Blocked while she has any open balance — otherwise the debt becomes unreachable from the normal customer UI. */
export async function deleteCustomer(
  db: PrismaOrTx,
  params: { id: string; userId: string; actingUserId: string },
): Promise<Customer> {
  await getCustomer(db, params);
  const balanceInfo = await getBalanceInfo(db, { userId: params.userId, customerId: params.id });
  if (new Prisma.Decimal(balanceInfo.balance).greaterThan(0)) {
    throw new CustomerHasOpenBalanceError();
  }
  return customersRepository.softDelete(db, { id: params.id, actingUserId: params.actingUserId });
}

/**
 * "A cliente me pagou X" — distributed automatically (FIFO) across her
 * oldest open sales first. Locks the open sales for update before reading
 * their balances, so a concurrent payment for the same customer serializes
 * instead of racing past a stale balance read — see DATABASE.md, "Accounts
 * receivable" for the full concurrency design. Idempotent via the same
 * pre-check/race-safe-fallback mechanism Sale.idempotencyKey already uses.
 */
export async function registerPayment(
  prisma: PrismaClient,
  params: {
    userId: string;
    customerId: string;
    amount: string;
    paymentMethod?: PaymentMethod | null;
    notes?: string | null;
    idempotencyKey?: string | null;
    actingUserId: string;
  },
): Promise<CustomerPaymentWithAllocations> {
  const idempotencyKey = params.idempotencyKey ?? null;

  if (idempotencyKey) {
    const existing = await customersRepository.findPaymentByIdempotencyKey(prisma, {
      userId: params.userId,
      idempotencyKey,
    });
    if (existing) return existing;
  }

  const amount = new Prisma.Decimal(params.amount);
  if (amount.lessThanOrEqualTo(0)) {
    throw new InvalidPaymentAmountError('Payment amount must be greater than zero.');
  }

  await getCustomer(prisma, { id: params.customerId, userId: params.userId });

  try {
    return await retrySerializationFailures(() =>
      prisma.$transaction(async (tx) => {
        const openSales = await customersRepository.lockOpenSalesForCustomer(tx, {
          userId: params.userId,
          customerId: params.customerId,
        });

        const balance = openSales.reduce(
          (sum, sale) => sum.plus(sale.total.minus(sale.paidAmount)),
          new Prisma.Decimal(0),
        );
        if (amount.greaterThan(balance)) {
          throw new PaymentExceedsBalanceError();
        }

        const payment = await customersRepository.createPayment(tx, {
          userId: params.userId,
          customerId: params.customerId,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          notes: params.notes,
          idempotencyKey,
          actingUserId: params.actingUserId,
        });

        let remaining = amount;
        for (const sale of openSales) {
          if (remaining.lessThanOrEqualTo(0)) break;
          const saleBalance = sale.total.minus(sale.paidAmount);
          if (saleBalance.lessThanOrEqualTo(0)) continue;

          const allocation = Prisma.Decimal.min(remaining, saleBalance);
          await customersRepository.createAllocation(tx, {
            userId: params.userId,
            customerPaymentId: payment.id,
            saleId: sale.id,
            amount: allocation.toFixed(2),
            actingUserId: params.actingUserId,
          });

          const newPaidAmount = sale.paidAmount.plus(allocation);
          await customersRepository.updateSalePaymentState(tx, {
            id: sale.id,
            paidAmount: newPaidAmount.toFixed(2),
            status: computeSaleStatus({ total: sale.total, paidAmount: newPaidAmount }),
            actingUserId: params.actingUserId,
          });

          remaining = remaining.minus(allocation);
        }

        const created = await customersRepository.findPaymentById(tx, { id: payment.id, userId: params.userId });
        return created!;
      }),
    );
  } catch (error) {
    // Same race-safe-fallback shape as sales.service.ts's createSale: a
    // losing concurrent request under the same idempotencyKey may see any
    // failure (not just a unique-violation) if its twin already committed —
    // re-check before rethrowing.
    if (idempotencyKey) {
      const existing = await customersRepository.findPaymentByIdempotencyKey(prisma, {
        userId: params.userId,
        idempotencyKey,
      });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * Reverses a payment completely — every sale it funded, in one transaction,
 * never partially. Idempotent: voiding an already-voided payment is a no-op
 * that returns it unchanged, mirroring cancelSale's own idempotent no-op.
 */
export async function voidPayment(
  prisma: PrismaClient,
  params: { userId: string; customerId: string; paymentId: string; actingUserId: string },
): Promise<CustomerPaymentWithAllocations> {
  return retrySerializationFailures(() =>
    prisma.$transaction(async (tx) => {
      const payment = await customersRepository.findPaymentById(tx, { id: params.paymentId, userId: params.userId });
      if (!payment || payment.customerId !== params.customerId) {
        throw new CustomerNotFoundError(`Payment ${params.paymentId} not found`);
      }
      if (payment.voidedAt) return payment;

      const saleIds = payment.allocations.map((allocation) => allocation.saleId);
      const sales = await customersRepository.lockSalesByIds(tx, { userId: params.userId, ids: saleIds });
      const salesById = new Map(sales.map((sale) => [sale.id, sale]));

      for (const allocation of payment.allocations) {
        const sale = salesById.get(allocation.saleId);
        if (!sale) continue;

        const newPaidAmount = sale.paidAmount.minus(allocation.amount);
        await customersRepository.updateSalePaymentState(tx, {
          id: sale.id,
          paidAmount: newPaidAmount.toFixed(2),
          status: computeSaleStatus({
            total: sale.total,
            paidAmount: newPaidAmount,
            cancelled: sale.status === 'CANCELLED' || sale.status === 'REFUNDED',
          }),
          actingUserId: params.actingUserId,
        });
      }

      const voidedAt = new Date();
      await customersRepository.markPaymentVoided(tx, { id: payment.id, voidedAt });
      return { ...payment, voidedAt };
    }),
  );
}

export interface StatementLine {
  type: 'SALE' | 'PAYMENT';
  date: Date;
  amount: string;
  referenceId: string;
  saleStatus: string | null;
}

/** Chronological "conta corrente" view — Sale ("Entrega", +) and non-voided CustomerPayment ("Pagamento", -) rows merged and sorted. */
export async function getStatement(
  db: PrismaOrTx,
  params: { userId: string; customerId: string },
): Promise<StatementLine[]> {
  await getCustomer(db, { id: params.customerId, userId: params.userId });

  const [sales, payments] = await Promise.all([
    customersRepository.getStatementSales(db, params),
    customersRepository.getStatementPayments(db, params),
  ]);

  const saleLines: StatementLine[] = sales.map((sale) => ({
    type: 'SALE',
    date: sale.createdAt,
    amount: sale.total.toFixed(2),
    referenceId: sale.id,
    saleStatus: sale.status,
  }));
  const paymentLines: StatementLine[] = payments.map((payment) => ({
    type: 'PAYMENT',
    date: payment.createdAt,
    amount: payment.amount.toFixed(2),
    referenceId: payment.id,
    saleStatus: null,
  }));

  return [...saleLines, ...paymentLines].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface ReceivablesSummary {
  totalOutstanding: string;
  customersWithBalanceCount: number;
  totalSoldInPeriod: string;
  totalReceivedInPeriod: string;
}

/**
 * Four independent, derived numbers — never conflated. See DATABASE.md,
 * "Accounts receivable", "Financial indicators".
 */
export async function getReceivablesSummary(
  db: PrismaOrTx,
  params: { userId: string; from?: Date; to?: Date },
): Promise<ReceivablesSummary> {
  const aggregates = await customersRepository.getReceivablesAggregates(db, params);

  const outstandingTotal = aggregates.outstandingTotal ?? new Prisma.Decimal(0);
  const outstandingPaid = aggregates.outstandingPaid ?? new Prisma.Decimal(0);

  return {
    totalOutstanding: outstandingTotal.minus(outstandingPaid).toFixed(2),
    customersWithBalanceCount: aggregates.customersWithBalanceCount,
    totalSoldInPeriod: (aggregates.soldTotal ?? new Prisma.Decimal(0)).toFixed(2),
    totalReceivedInPeriod: (aggregates.receivedTotal ?? new Prisma.Decimal(0)).toFixed(2),
  };
}

// --- Dashboard aggregates — called only by dashboard.service.ts. See
// ARCHITECTURE.md §5/§6: CustomerPayment is this feature's own model, so
// these live here rather than in a cross-feature dashboard.repository.ts.

export async function getReceivedTimeline(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date; granularity: 'day' | 'week' | 'month' },
): Promise<Array<{ bucket: Date; received: string }>> {
  return customersRepository.getReceivedTimeline(db, params);
}

export interface RecentPayment {
  paymentId: string;
  customerId: string | null;
  customerName: string | null;
  amount: string;
  createdAt: Date;
}

export async function getRecentPayments(
  db: PrismaOrTx,
  params: { userId: string; from: Date; toExclusive: Date; limit: number },
): Promise<RecentPayment[]> {
  return customersRepository.getRecentPayments(db, params);
}

export type { CustomerPayment, PaymentAllocation };
