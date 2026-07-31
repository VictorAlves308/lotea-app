import { generateId } from '@lotea/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import * as customersService from '../customers/customers.service';
import * as productsService from '../products/products.service';
import * as salesService from '../sales/sales.service';
import { createTestCustomer, createTestLot, createTestUser, resetDatabase, testPrisma } from '../../test/db';
import * as inventoryService from './inventory.service';

beforeEach(async () => {
  await resetDatabase();
});

async function seedProduct(userId: string) {
  return productsService.createProduct(testPrisma, {
    userId,
    actingUserId: userId,
    name: 'Kaiak Tradicional Masculino',
    brand: 'Natura',
  });
}

describe('registerPurchaseEntry', () => {
  it('creates one InventoryItem row per unit — never a stored quantity', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 5,
      acquisitionCost: '38.00',
      actingUserId: user.id,
    });

    expect(items).toHaveLength(5);
    expect(new Set(items.map((item) => item.id)).size).toBe(5);

    const movements = await testPrisma.inventoryMovement.findMany({ where: { userId: user.id } });
    expect(movements).toHaveLength(5);
    expect(movements.every((m) => m.type === 'PURCHASE_ENTRY')).toBe(true);
  });
});

describe('getAvailableCount', () => {
  it('counts only IN_STOCK items — never RESERVED, SOLD, or WRITTEN_OFF', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 4,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });

    // Sell one, reserve one, leave two IN_STOCK.
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: items[0]!.id, salePrice: '20.00' }],
    });
    await testPrisma.inventoryItem.update({
      where: { id: items[1]!.id },
      data: { status: 'RESERVED', updatedBy: user.id },
    });

    const available = await inventoryService.getAvailableCount(testPrisma, { userId: user.id });
    expect(available).toBe(2);
  });
});

describe('getLotFinancials', () => {
  it('flags a lot that has recovered more revenue than it cost as recovered', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 3,
      acquisitionCost: '12.00', // total cost 36.00
      actingUserId: user.id,
    });

    for (const item of items) {
      await salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        items: [{ inventoryItemId: item.id, salePrice: '30.00' }], // revenue 90.00
      });
    }

    const financials = await inventoryService.getLotFinancials(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });

    expect(financials.itemCount).toBe(3);
    expect(financials.soldCount).toBe(3);
    expect(financials.totalCost).toBe('36.00');
    expect(financials.revenue).toBe('90.00');
    expect(financials.realizedProfit).toBe('54.00');
    expect(financials.hasRecoveredInvestment).toBe(true);
    expect(financials.totalReceived).toBe('90.00'); // every sale defaulted to fully paid
    expect(financials.outstanding).toBe('0.00');
  });

  it('flags a mostly-unsold lot as not having recovered its investment', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 10,
      acquisitionCost: '25.00', // total cost 250.00
      actingUserId: user.id,
    });

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: items[0]!.id, salePrice: '32.00' }], // revenue 32.00
    });

    const financials = await inventoryService.getLotFinancials(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });

    expect(financials.totalCost).toBe('250.00');
    expect(financials.revenue).toBe('32.00');
    expect(financials.hasRecoveredInvestment).toBe(false);
  });

  it('excludes cancelled sale items from revenue and profit', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '12.00',
      actingUserId: user.id,
    });

    // Cancellation requires paidAmount = 0 — see sales.service.ts's
    // cancelSale — so this sale is created unpaid (and therefore with a
    // customer) specifically so the cancel below is legal.
    const customer = await createTestCustomer({ userId: user.id });
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      receivedAmount: '0.00',
      customerId: customer.id,
      items: [{ inventoryItemId: items[0]!.id, salePrice: '30.00' }],
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: sale.id,
      actingUserId: user.id,
    });

    const financials = await inventoryService.getLotFinancials(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });

    expect(financials.revenue).toBe('0.00');
    expect(financials.realizedProfit).toBe('0.00');
    expect(financials.totalReceived).toBe('0.00');
    expect(financials.outstanding).toBe('0.00');
  });

  it('never loses cents to floating-point drift across many small sales', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    // 0.1 + 0.2 !== 0.3 in native JS floats; ten 0.10 sales must sum to exactly 1.00.
    const items = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 10,
      acquisitionCost: '0.10',
      actingUserId: user.id,
    });

    for (const item of items) {
      await salesService.createSale(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        items: [{ inventoryItemId: item.id, salePrice: '0.20' }],
      });
    }

    const financials = await inventoryService.getLotFinancials(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });
    expect(financials.totalCost).toBe('1.00');
    expect(financials.revenue).toBe('2.00');
    expect(financials.realizedProfit).toBe('1.00');
  });
});

describe('getLotCustomerBalances', () => {
  it('gives a single-lot sale its full outstanding balance, cent for cent', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id, name: 'Lote 30' });
    const product = await seedProduct(user.id);
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });

    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item!.id, salePrice: '100.00' }],
      receivedAmount: '40.00',
      customerId: customer.id,
    });

    const balances = await inventoryService.getLotCustomerBalances(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });
    expect(balances).toEqual([{ customerId: customer.id, name: 'Maria', outstanding: '60.00' }]);
  });

  it('splits a multi-lot sale proportionally, exact to the cent, and agrees with the lot dashboard totals', async () => {
    const user = await createTestUser();
    const lotA = await createTestLot({ userId: user.id, name: 'Lote 30' });
    const lotB = await createTestLot({ userId: user.id, name: 'Lote 32' });
    const product = await seedProduct(user.id);
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });

    const [itemA] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lotA.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });
    const [itemB] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lotB.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });

    // R$300 sale: R$100 of items from lot A, R$200 from lot B. R$150 paid, R$150 outstanding.
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [
        { inventoryItemId: itemA!.id, salePrice: '100.00' },
        { inventoryItemId: itemB!.id, salePrice: '200.00' },
      ],
      receivedAmount: '150.00',
      customerId: customer.id,
    });

    const balancesA = await inventoryService.getLotCustomerBalances(testPrisma, {
      userId: user.id,
      lotId: lotA.id,
    });
    const balancesB = await inventoryService.getLotCustomerBalances(testPrisma, {
      userId: user.id,
      lotId: lotB.id,
    });
    expect(balancesA).toEqual([{ customerId: customer.id, name: 'Maria', outstanding: '50.00' }]);
    expect(balancesB).toEqual([{ customerId: customer.id, name: 'Maria', outstanding: '100.00' }]);

    // The lot dashboard's own totals must agree exactly with this breakdown.
    const financialsA = await inventoryService.getLotFinancials(testPrisma, { userId: user.id, lotId: lotA.id });
    const financialsB = await inventoryService.getLotFinancials(testPrisma, { userId: user.id, lotId: lotB.id });
    expect(financialsA.revenue).toBe('100.00');
    expect(financialsA.outstanding).toBe('50.00');
    expect(financialsA.totalReceived).toBe('50.00');
    expect(financialsB.revenue).toBe('200.00');
    expect(financialsB.outstanding).toBe('100.00');
    expect(financialsB.totalReceived).toBe('100.00');
  });

  it('a fully paid sale contributes nothing', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item!.id, salePrice: '50.00' }], // defaults to fully paid
    });

    const balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances).toEqual([]);
  });

  it('a lot with no open sales returns an empty list', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });

    const balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances).toEqual([]);
  });

  it('voiding a payment increases outstanding on the next read — never a stale value', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);
    const customer = await createTestCustomer({ userId: user.id, name: 'Maria' });

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item!.id, salePrice: '100.00' }],
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    const payment = await customersService.registerPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      amount: '40.00',
      actingUserId: user.id,
    });

    let balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances[0]!.outstanding).toBe('60.00');

    await customersService.voidPayment(testPrisma, {
      userId: user.id,
      customerId: customer.id,
      paymentId: payment.id,
      actingUserId: user.id,
    });

    balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances[0]!.outstanding).toBe('100.00');
  });

  it('a historical sale (paidAmount = total, zero allocations) never contributes', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });

    // Bypasses salesService entirely — mirrors the real post-migration shape
    // of a pre-existing sale (paidAmount = total, no customer, no allocations).
    const historicalSaleId = generateId();
    await testPrisma.sale.create({
      data: {
        id: historicalSaleId,
        userId: user.id,
        status: 'PAID',
        total: '80.00',
        paidAmount: '80.00',
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await testPrisma.saleItem.create({
      data: {
        id: generateId(),
        userId: user.id,
        saleId: historicalSaleId,
        inventoryItemId: item!.id,
        salePrice: '80.00',
        acquisitionCostSnapshot: '10.00',
        createdBy: user.id,
      },
    });

    const balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances).toEqual([]);

    const financials = await inventoryService.getLotFinancials(testPrisma, { userId: user.id, lotId: lot.id });
    expect(financials.outstanding).toBe('0.00');
    expect(financials.totalReceived).toBe('80.00'); // fully received — matches revenue exactly
  });

  it('a soft-deleted lot with an open balance still shows correctly', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await seedProduct(user.id);
    const customer = await createTestCustomer({ userId: user.id });

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: user.id,
    });
    await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item!.id, salePrice: '50.00' }],
      receivedAmount: '20.00',
      customerId: customer.id,
    });

    await testPrisma.lot.update({ where: { id: lot.id }, data: { deletedAt: new Date() } });

    const balances = await inventoryService.getLotCustomerBalances(testPrisma, { userId: user.id, lotId: lot.id });
    expect(balances).toEqual([{ customerId: customer.id, name: customer.name, outstanding: '30.00' }]);
  });

  it('tenant isolation — a second tenant’s identically-shaped data never appears', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const lotA = await createTestLot({ userId: userA.id, name: 'Lote Compartilhado' });
    const lotB = await createTestLot({ userId: userB.id, name: 'Lote Compartilhado' });
    const productA = await seedProduct(userA.id);
    const productB = await seedProduct(userB.id);
    const customerA = await createTestCustomer({ userId: userA.id, name: 'Cliente Igual' });
    const customerB = await createTestCustomer({ userId: userB.id, name: 'Cliente Igual' });

    const [itemA] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: userA.id,
      productId: productA.id,
      lotId: lotA.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: userA.id,
    });
    const [itemB] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: userB.id,
      productId: productB.id,
      lotId: lotB.id,
      quantity: 1,
      acquisitionCost: '10.00',
      actingUserId: userB.id,
    });
    await salesService.createSale(testPrisma, {
      userId: userA.id,
      actingUserId: userA.id,
      items: [{ inventoryItemId: itemA!.id, salePrice: '100.00' }],
      receivedAmount: '10.00',
      customerId: customerA.id,
    });
    await salesService.createSale(testPrisma, {
      userId: userB.id,
      actingUserId: userB.id,
      items: [{ inventoryItemId: itemB!.id, salePrice: '999.00' }],
      receivedAmount: '10.00',
      customerId: customerB.id,
    });

    const balancesA = await inventoryService.getLotCustomerBalances(testPrisma, {
      userId: userA.id,
      lotId: lotA.id,
    });
    expect(balancesA).toEqual([{ customerId: customerA.id, name: 'Cliente Igual', outstanding: '90.00' }]);
  });
});
