import { beforeEach, describe, expect, it } from 'vitest';

import * as inventoryService from '../inventory/inventory.service';
import * as productsService from '../products/products.service';
import * as salesService from '../sales/sales.service';
import { createTestCustomer, createTestLot, createTestUser, resetDatabase, testPrisma } from '../../test/db';
import * as dashboardService from './dashboard.service';

beforeEach(async () => {
  await resetDatabase();
});

/**
 * One InventoryItem sold in a single-item Sale, backdated (Sale, its
 * SaleItem, and any resulting initial-payment CustomerPayment) to
 * `createdAt` — every dashboard aggregate is period-scoped, so tests need
 * full control over exactly which "day" a sale/payment falls on.
 */
async function seedSoldItem(params: {
  userId: string;
  productId: string;
  lotId: string;
  salePrice: string;
  createdAt: Date;
  receivedAmount?: string;
  customerId?: string;
}) {
  const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
    userId: params.userId,
    productId: params.productId,
    lotId: params.lotId,
    quantity: 1,
    acquisitionCost: '5.00',
    actingUserId: params.userId,
  });
  const sale = await salesService.createSale(testPrisma, {
    userId: params.userId,
    actingUserId: params.userId,
    items: [{ inventoryItemId: item!.id, salePrice: params.salePrice }],
    receivedAmount: params.receivedAmount,
    customerId: params.customerId,
  });
  await testPrisma.sale.update({ where: { id: sale.id }, data: { createdAt: params.createdAt } });
  await testPrisma.saleItem.updateMany({ where: { saleId: sale.id }, data: { createdAt: params.createdAt } });

  const allocations = await testPrisma.paymentAllocation.findMany({ where: { saleId: sale.id } });
  const paymentIds = [...new Set(allocations.map((allocation) => allocation.customerPaymentId))];
  if (paymentIds.length > 0) {
    await testPrisma.customerPayment.updateMany({
      where: { id: { in: paymentIds } },
      data: { createdAt: params.createdAt },
    });
  }
  return sale;
}

describe('getFinancialDashboard', () => {
  it('keeps sold, received, and outstanding independent for a partially-paid sale', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto A',
    });
    const customer = await createTestCustomer({ userId: user.id });

    const day = new Date(Date.UTC(2026, 0, 5));
    await seedSoldItem({
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      salePrice: '100.00',
      createdAt: day,
      receivedAmount: '40.00',
      customerId: customer.id,
    });

    const dashboard = await dashboardService.getFinancialDashboard(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 0, 10)),
      granularity: 'day',
      rankingLimit: 10,
    });

    expect(dashboard.totalSoldInPeriod).toBe('100.00'); // full total, accrual
    expect(dashboard.totalReceivedInPeriod).toBe('40.00'); // only what's actually been collected
    expect(dashboard.totalOutstanding).toBe('60.00'); // the remainder — never conflated with the other two
  });

  it('excludes cancelled sales from sold total, average ticket, and product/brand rankings', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const customer = await createTestCustomer({ userId: user.id });
    const productA = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto Legítimo',
      brand: 'Marca X',
    });
    const productB = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto Cancelado',
      brand: 'Marca Y',
    });

    const day = new Date(Date.UTC(2026, 0, 5));
    await seedSoldItem({ userId: user.id, productId: productA.id, lotId: lot.id, salePrice: '50.00', createdAt: day });

    const cancelledSale = await seedSoldItem({
      userId: user.id,
      productId: productB.id,
      lotId: lot.id,
      salePrice: '9999.00',
      createdAt: day,
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: cancelledSale.id,
      actingUserId: user.id,
    });

    const dashboard = await dashboardService.getFinancialDashboard(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 0, 10)),
      granularity: 'day',
      rankingLimit: 10,
    });

    expect(dashboard.totalSoldInPeriod).toBe('50.00');
    expect(dashboard.averageTicket).toBe('50.00');
    expect(dashboard.salesByStatus).toEqual({ paid: 1, partiallyPaid: 0, pending: 0, cancelled: 1 });
    expect(dashboard.topProducts.map((product) => product.name)).toEqual(['Produto Legítimo']);
    expect(dashboard.topBrands.map((brand) => brand.brand)).toEqual(['Marca X']);
  });

  it('zero-fills empty buckets and aligns bucket keys across a multi-day window', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto',
    });

    const day1 = new Date(Date.UTC(2026, 0, 1));
    const day3 = new Date(Date.UTC(2026, 0, 3));
    await seedSoldItem({ userId: user.id, productId: product.id, lotId: lot.id, salePrice: '30.00', createdAt: day1 });
    await seedSoldItem({ userId: user.id, productId: product.id, lotId: lot.id, salePrice: '70.00', createdAt: day3 });

    const dashboard = await dashboardService.getFinancialDashboard(testPrisma, {
      userId: user.id,
      from: day1,
      to: day3,
      granularity: 'day',
      rankingLimit: 10,
    });

    expect(dashboard.timeline).toHaveLength(3);
    expect(dashboard.timeline[0]!.bucket.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(dashboard.timeline[0]!.sold).toBe('30.00');
    // the middle day has no sales or payments at all — it must still appear, zero-filled.
    expect(dashboard.timeline[1]!.bucket.toISOString().slice(0, 10)).toBe('2026-01-02');
    expect(dashboard.timeline[1]!.sold).toBe('0.00');
    expect(dashboard.timeline[1]!.received).toBe('0.00');
    expect(dashboard.timeline[2]!.bucket.toISOString().slice(0, 10)).toBe('2026-01-03');
    expect(dashboard.timeline[2]!.sold).toBe('70.00');
  });

  it('includes a sale exactly on `to` and excludes one the day after', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto',
    });

    const to = new Date(Date.UTC(2026, 0, 10));
    const dayAfter = new Date(Date.UTC(2026, 0, 11));
    await seedSoldItem({ userId: user.id, productId: product.id, lotId: lot.id, salePrice: '40.00', createdAt: to });
    await seedSoldItem({
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      salePrice: '999.00',
      createdAt: dayAfter,
    });

    const dashboard = await dashboardService.getFinancialDashboard(testPrisma, {
      userId: user.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      to,
      granularity: 'day',
      rankingLimit: 10,
    });

    expect(dashboard.totalSoldInPeriod).toBe('40.00');
  });

  it('tenant isolation — a second tenant’s sales never appear in this dashboard', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const lotA = await createTestLot({ userId: userA.id });
    const lotB = await createTestLot({ userId: userB.id });
    const productA = await productsService.createProduct(testPrisma, {
      userId: userA.id,
      actingUserId: userA.id,
      name: 'Produto A',
    });
    const productB = await productsService.createProduct(testPrisma, {
      userId: userB.id,
      actingUserId: userB.id,
      name: 'Produto B',
    });

    const day = new Date(Date.UTC(2026, 0, 5));
    await seedSoldItem({ userId: userA.id, productId: productA.id, lotId: lotA.id, salePrice: '20.00', createdAt: day });
    await seedSoldItem({ userId: userB.id, productId: productB.id, lotId: lotB.id, salePrice: '999.00', createdAt: day });

    const dashboard = await dashboardService.getFinancialDashboard(testPrisma, {
      userId: userA.id,
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2026, 0, 10)),
      granularity: 'day',
      rankingLimit: 10,
    });

    expect(dashboard.totalSoldInPeriod).toBe('20.00');
    expect(dashboard.topProducts.map((product) => product.name)).toEqual(['Produto A']);
  });
});
