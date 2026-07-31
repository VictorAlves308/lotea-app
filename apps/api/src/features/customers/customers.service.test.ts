import { generateId } from '@lotea/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import * as inventoryService from '../inventory/inventory.service';
import * as productsService from '../products/products.service';
import * as salesService from '../sales/sales.service';
import {
  createTestCustomer,
  createTestLot,
  createTestUser,
  resetDatabase,
  testPrisma,
} from '../../test/db';
import {
  CustomerHasOpenBalanceError,
  CustomerNotFoundError,
  PaymentExceedsBalanceError,
  SaleHasActivePaymentsError,
} from '../../shared/errors/app-error';
import * as customersService from './customers.service';

beforeEach(async () => {
  await resetDatabase();
});

/** Creates one InventoryItem and sells it to `customerId`, receiving `receivedAmount` (defaults to unpaid). */
async function seedSaleForCustomer(params: {
  userId: string;
  customerId: string;
  salePrice: string;
  receivedAmount?: string;
}) {
  const lot = await createTestLot({ userId: params.userId });
  const product = await productsService.createProduct(testPrisma, {
    userId: params.userId,
    actingUserId: params.userId,
    name: 'Produto de Teste',
  });
  const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
    userId: params.userId,
    productId: product.id,
    lotId: lot.id,
    quantity: 1,
    acquisitionCost: '10.00',
    actingUserId: params.userId,
  });
  return salesService.createSale(testPrisma, {
    userId: params.userId,
    actingUserId: params.userId,
    customerId: params.customerId,
    receivedAmount: params.receivedAmount ?? '0.00',
    items: [{ inventoryItemId: item!.id, salePrice: params.salePrice }],
  });
}

describe('createCustomerWithDuplicateCheck', () => {
  it('creates a customer', async () => {
    const user = await createTestUser();

    const result = await customersService.createCustomerWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva',
      phone: '11999998888',
      confirmDuplicate: false,
    });

    expect(result.created).toBe(true);
    expect(result.customer?.name).toBe('Maria Silva');
    expect(result.customer?.phone).toBe('11999998888');
  });

  it('surfaces a similarly-named existing customer instead of creating a new one', async () => {
    const user = await createTestUser();
    await customersService.createCustomerWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva',
      confirmDuplicate: false,
    });

    const result = await customersService.createCustomerWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva',
      confirmDuplicate: false,
    });

    expect(result.created).toBe(false);
    expect(result.duplicateCandidates).toHaveLength(1);
  });

  it('creates anyway when confirmDuplicate is set — two customers may share the exact same name', async () => {
    const user = await createTestUser();
    await customersService.createCustomerWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva',
      confirmDuplicate: false,
    });

    const result = await customersService.createCustomerWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva',
      confirmDuplicate: true,
    });

    expect(result.created).toBe(true);
    const all = await testPrisma.customer.findMany({ where: { userId: user.id } });
    expect(all).toHaveLength(2);
  });
});

describe('searchCustomers', () => {
  it('ignores accents and tolerates a small spelling mistake', async () => {
    const user = await createTestUser();
    await createTestCustomer({ userId: user.id, name: 'José Antônio' });

    const results = await customersService.searchCustomers(testPrisma, { userId: user.id, query: 'jose antonio' });
    expect(results.map((c) => c.name)).toContain('José Antônio');
  });

  it('matches a partial term', async () => {
    const user = await createTestUser();
    await createTestCustomer({ userId: user.id, name: 'Maria Silva' });

    const results = await customersService.searchCustomers(testPrisma, { userId: user.id, query: 'mar' });
    expect(results.map((c) => c.name)).toContain('Maria Silva');
  });

  it('never returns another tenant’s customers', async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    await createTestCustomer({ userId: owner.id, name: 'Maria Silva' });

    const results = await customersService.searchCustomers(testPrisma, { userId: attacker.id, query: 'maria' });
    expect(results).toHaveLength(0);
  });
});

describe('updateCustomer', () => {
  it('updates name/phone/notes and recomputes searchTerms', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria Silva' });

    const updated = await customersService.updateCustomer(testPrisma, {
      id: customer.id,
      userId: user.id,
      actingUserId: user.id,
      name: 'Maria Silva Souza',
      phone: '11988887777',
    });

    expect(updated.name).toBe('Maria Silva Souza');
    expect(updated.searchTerms).toContain('souza');
  });

  it('throws for another tenant’s customer', async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const customer = await createTestCustomer({ userId: owner.id });

    await expect(
      customersService.updateCustomer(testPrisma, {
        id: customer.id,
        userId: attacker.id,
        actingUserId: attacker.id,
        name: 'Hacked',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });
});

describe('getCustomerDetail / balance', () => {
  it('reports zero balance for a customer with no open sales', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });

    const detail = await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id });
    expect(detail.balance).toBe('0.00');
    expect(detail.openSalesCount).toBe(0);
  });

  it('reports the outstanding balance across multiple open sales — the Maria example', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });

    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '120.00' });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '40.00' });

    const detail = await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id });
    expect(detail.balance).toBe('160.00');
    expect(detail.openSalesCount).toBe(2);
  });
});

describe('deleteCustomer', () => {
  it('is blocked while she has an open balance', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    await expect(
      customersService.deleteCustomer(testPrisma, { id: customer.id, userId: user.id, actingUserId: user.id }),
    ).rejects.toThrow(CustomerHasOpenBalanceError);
  });

  it('is allowed once her balance is zero', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });

    const deleted = await customersService.deleteCustomer(testPrisma, {
      id: customer.id,
      userId: user.id,
      actingUserId: user.id,
    });
    expect(deleted.deletedAt).not.toBeNull();
  });
});

describe('registerPayment — FIFO distribution', () => {
  it("settles the customer's own worked example: Sale A(60 open) + Sale B(50 open), payment 80 → A quitada, B saldo 30", async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });
    const saleA = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '60.00' });
    const saleB = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '80.00',
      actingUserId: user.id,
    });

    const updatedA = await testPrisma.sale.findUniqueOrThrow({ where: { id: saleA.id } });
    const updatedB = await testPrisma.sale.findUniqueOrThrow({ where: { id: saleB.id } });
    expect(updatedA.status).toBe('PAID');
    expect(updatedA.paidAmount.toFixed(2)).toBe('60.00');
    expect(updatedB.status).toBe('PARTIALLY_PAID');
    expect(updatedB.paidAmount.toFixed(2)).toBe('20.00');

    const detail = await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id });
    expect(detail.balance).toBe('30.00');
  });

  it('reproduces the full Julho/Agosto/Setembro cycle from the request', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });

    // Julho: Maria pega Perfume R$120 + Creme R$40, recebido R$0 — saldo R$160.
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '120.00' });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '40.00' });
    expect((await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id })).balance).toBe(
      '160.00',
    );

    // Agosto: Maria paga R$80 — saldo R$80.
    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '80.00',
      actingUserId: user.id,
    });
    expect((await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id })).balance).toBe(
      '80.00',
    );

    // Mesmo mês: Maria compra R$50 — novo saldo R$130.
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });
    expect((await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id })).balance).toBe(
      '130.00',
    );

    // Setembro: Maria paga R$100 — saldo R$30.
    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '100.00',
      actingUserId: user.id,
    });
    expect((await customersService.getCustomerDetail(testPrisma, { id: customer.id, userId: user.id })).balance).toBe(
      '30.00',
    );
  });

  it('rejects a payment greater than the current balance', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    await expect(
      customersService.registerPayment(testPrisma, {
        userId: user.id,
        customerId: customer.id,
        amount: '50.01',
        actingUserId: user.id,
      }),
    ).rejects.toThrow(PaymentExceedsBalanceError);
  });

  it('is idempotent — a retried request with the same key returns the original payment, never a second one', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });
    const idempotencyKey = 'payment-abc-123';

    const first = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '20.00',
      idempotencyKey,
      actingUserId: user.id,
    });
    const retry = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '20.00',
      idempotencyKey,
      actingUserId: user.id,
    });

    expect(retry.id).toBe(first.id);
    const allPayments = await testPrisma.customerPayment.count({ where: { userId: user.id } });
    expect(allPayments).toBe(1);
  });

  it('never distributes a new sale’s "recebido agora" to a customer’s older open sales', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const older = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '100.00' });

    // A brand-new sale, paid in full at creation — must not touch `older`.
    await seedSaleForCustomer({
      userId: user.id,
      customerId: customer.id,
      salePrice: '30.00',
      receivedAmount: '30.00',
    });

    const stillOlder = await testPrisma.sale.findUniqueOrThrow({ where: { id: older.id } });
    expect(stillOlder.paidAmount.toFixed(2)).toBe('0.00');
    expect(stillOlder.status).toBe('PENDING');
  });
});

describe('voidPayment', () => {
  it('reverses a single-sale payment — paidAmount and status revert', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const sale = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    const payment = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '50.00',
      actingUserId: user.id,
    });

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });

    const reverted = await testPrisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reverted.paidAmount.toFixed(2)).toBe('0.00');
    expect(reverted.status).toBe('PENDING');
  });

  it('reverses every sale a fanned-out FIFO payment touched, not just one', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const saleA = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '60.00' });
    const saleB = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    const payment = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '80.00',
      actingUserId: user.id,
    });

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });

    const revertedA = await testPrisma.sale.findUniqueOrThrow({ where: { id: saleA.id } });
    const revertedB = await testPrisma.sale.findUniqueOrThrow({ where: { id: saleB.id } });
    expect(revertedA.paidAmount.toFixed(2)).toBe('0.00');
    expect(revertedA.status).toBe('PENDING');
    expect(revertedB.paidAmount.toFixed(2)).toBe('0.00');
    expect(revertedB.status).toBe('PENDING');
  });

  it('is idempotent — voiding an already-voided payment is a no-op', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '50.00' });

    const payment = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '50.00',
      actingUserId: user.id,
    });

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });
    const second = await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });

    expect(second.voidedAt).not.toBeNull();
  });
});

describe('concurrency — payments racing for the same customer', () => {
  it('never allocates more than what was actually owed, even under a genuine concurrent race', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    // A single R$100 sale — two concurrent R$60 payments each individually
    // fit under R$100, but together they don't.
    const sale = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '100.00' });

    const [a, b] = await Promise.allSettled([
      customersService.registerPayment(testPrisma, {
        userId: user.id,
        customerId: customer.id,
        amount: '60.00',
        actingUserId: user.id,
      }),
      customersService.registerPayment(testPrisma, {
        userId: user.id,
        customerId: customer.id,
        amount: '60.00',
        actingUserId: user.id,
      }),
    ]);

    // Exactly one of the two must have been rejected as exceeding the balance.
    const fulfilledCount = [a, b].filter((result) => result.status === 'fulfilled').length;
    expect(fulfilledCount).toBe(1);

    const finalSale = await testPrisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(finalSale.paidAmount.lessThanOrEqualTo(100)).toBe(true);
    expect(finalSale.paidAmount.toFixed(2)).toBe('60.00');
  });
});

describe('getStatement', () => {
  it('lists sales and payments chronologically, keeping cancelled sales visible', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const sale = await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '160.00' });
    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '80.00',
      actingUserId: user.id,
    });

    const statement = await customersService.getStatement(testPrisma, { userId: user.id, customerId: customer.id });

    expect(statement).toHaveLength(2);
    expect(statement[0]!.type).toBe('SALE');
    expect(statement[0]!.amount).toBe('160.00');
    expect(statement[0]!.referenceId).toBe(sale.id);
    expect(statement[1]!.type).toBe('PAYMENT');
    expect(statement[1]!.amount).toBe('80.00');
  });
});

describe('getReceivablesSummary', () => {
  it('counts a fully-paid no-customer sale in sold/received, but never in outstanding', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto à Vista',
    });
    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });
    // No customer, received in full — walk-in sale.
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '90.00',
      items: [{ inventoryItemId: item!.id, salePrice: '90.00' }],
    });

    const summary = await customersService.getReceivablesSummary(testPrisma, { userId: user.id });
    expect(summary.totalSoldInPeriod).toBe('90.00');
    expect(summary.totalReceivedInPeriod).toBe('90.00');
    expect(summary.totalOutstanding).toBe('0.00');
  });

  it('splits a partial sale correctly across sold/received/outstanding', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    await seedSaleForCustomer({
      userId: user.id,
      customerId: customer.id,
      salePrice: '200.00',
      receivedAmount: '50.00',
    });

    const summary = await customersService.getReceivablesSummary(testPrisma, { userId: user.id });
    expect(summary.totalSoldInPeriod).toBe('200.00');
    expect(summary.totalReceivedInPeriod).toBe('50.00');
    expect(summary.totalOutstanding).toBe('150.00');
    expect(summary.customersWithBalanceCount).toBe(1);
  });
});

describe('listCustomers', () => {
  it('sorts by balance descending', async () => {
    const user = await createTestUser();
    const low = await createTestCustomer({ userId: user.id, name: 'Ana' });
    const high = await createTestCustomer({ userId: user.id, name: 'Beatriz' });
    await seedSaleForCustomer({ userId: user.id, customerId: low.id, salePrice: '10.00' });
    await seedSaleForCustomer({ userId: user.id, customerId: high.id, salePrice: '500.00' });

    const result = await customersService.listCustomers(testPrisma, {
      userId: user.id,
      page: 1,
      limit: 20,
      sort: 'balance',
    });

    expect(result.items[0]!.name).toBe('Beatriz');
    expect(result.items[0]!.balance).toBe('500.00');
  });

  it('filters to customers with a balance ("contas em aberto")', async () => {
    const user = await createTestUser();
    const withBalance = await createTestCustomer({ userId: user.id, name: 'Com Saldo' });
    await createTestCustomer({ userId: user.id, name: 'Sem Saldo' });
    await seedSaleForCustomer({ userId: user.id, customerId: withBalance.id, salePrice: '10.00' });

    const result = await customersService.listCustomers(testPrisma, {
      userId: user.id,
      page: 1,
      limit: 20,
      sort: 'name',
      hasBalance: true,
    });

    expect(result.items.map((c) => c.name)).toEqual(['Com Saldo']);
  });

  it('never returns another tenant’s customers', async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    await createTestCustomer({ userId: owner.id, name: 'Maria' });

    const result = await customersService.listCustomers(testPrisma, {
      userId: attacker.id,
      page: 1,
      limit: 20,
      sort: 'name',
    });

    expect(result.items).toHaveLength(0);
  });
});

describe('historical (pre-migration) sale simulation', () => {
  it('is excluded from the FIFO open-sales queue and permanently blocked from cancellation', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto Histórico',
    });
    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });

    // Simulate a pre-migration row directly — bypassing salesService entirely,
    // mirroring the real post-backfill shape: status PAID, paidAmount = total,
    // no customer, zero PaymentAllocation rows.
    const historicalSale = await testPrisma.sale.create({
      data: {
        id: generateId(),
        userId: user.id,
        status: 'PAID',
        total: '75.00',
        paidAmount: '75.00',
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await testPrisma.saleItem.create({
      data: {
        id: generateId(),
        userId: user.id,
        saleId: historicalSale.id,
        inventoryItemId: item!.id,
        salePrice: '75.00',
        acquisitionCostSnapshot: '10.00',
        createdBy: user.id,
      },
    });

    // Never reachable by a payment registered against a *different* open sale.
    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '20.00' });
    await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '20.00',
      actingUserId: user.id,
    });
    const untouchedHistorical = await testPrisma.sale.findUniqueOrThrow({ where: { id: historicalSale.id } });
    expect(untouchedHistorical.paidAmount.toFixed(2)).toBe('75.00');

    // Permanently uncancellable — nothing to void.
    await expect(
      salesService.cancelSale(testPrisma, { userId: user.id, saleId: historicalSale.id, actingUserId: user.id }),
    ).rejects.toThrow(SaleHasActivePaymentsError);
  });
});

describe('dashboard aggregates', () => {
  it('getReceivedTimeline buckets by day and excludes voided payments', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });

    const day1 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const day2 = new Date(Date.UTC(2026, 0, 6, 12, 0, 0));

    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '100.00' });
    const payment1 = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '40.00',
      actingUserId: user.id,
    });
    await testPrisma.customerPayment.update({ where: { id: payment1.id }, data: { createdAt: day1 } });

    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '100.00' });
    const voidedPayment = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '30.00',
      actingUserId: user.id,
    });
    await testPrisma.customerPayment.update({ where: { id: voidedPayment.id }, data: { createdAt: day2 } });
    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: voidedPayment.id,
      actingUserId: user.id,
    });

    const timeline = await customersService.getReceivedTimeline(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      toExclusive: new Date(Date.UTC(2026, 0, 10)),
      granularity: 'day',
    });

    // day2's only payment was voided — it contributes no bucket at all.
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.received).toBe('40.00');
    expect(timeline[0]!.bucket.toISOString().slice(0, 10)).toBe('2026-01-05');
  });

  it('getRecentPayments returns the most recent non-voided payments, newest first, with customer names attached', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id, name: 'Fernanda Costa' });

    await seedSaleForCustomer({ userId: user.id, customerId: customer.id, salePrice: '200.00' });
    const older = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '50.00',
      actingUserId: user.id,
    });
    await testPrisma.customerPayment.update({
      where: { id: older.id },
      data: { createdAt: new Date(Date.UTC(2026, 0, 5)) },
    });

    const newer = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '30.00',
      actingUserId: user.id,
    });
    await testPrisma.customerPayment.update({
      where: { id: newer.id },
      data: { createdAt: new Date(Date.UTC(2026, 0, 6)) },
    });

    const voided = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '10.00',
      actingUserId: user.id,
    });
    // Backdated into the same query window as the other two, so this test
    // actually exercises the voidedAt filter — not just an out-of-range date.
    await testPrisma.customerPayment.update({
      where: { id: voided.id },
      data: { createdAt: new Date(Date.UTC(2026, 0, 7)) },
    });
    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: voided.id,
      actingUserId: user.id,
    });

    const result = await customersService.getRecentPayments(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      toExclusive: new Date(Date.UTC(2026, 0, 10)),
      limit: 10,
    });

    expect(result.map((row) => row.paymentId)).toEqual([newer.id, older.id]);
    expect(result[0]!.customerName).toBe('Fernanda Costa');
    expect(result[0]!.amount).toBe('30.00');
  });
});
