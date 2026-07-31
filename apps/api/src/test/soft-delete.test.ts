import { beforeEach, describe, expect, it } from 'vitest';

import * as inventoryService from '../features/inventory/inventory.service';
import * as productsService from '../features/products/products.service';
import * as salesService from '../features/sales/sales.service';
import { createTestLot, createTestUser, resetDatabase, testPrisma } from './db';

beforeEach(async () => {
  await resetDatabase();
});

/**
 * Soft-deleting a Product or Lot (setting deletedAt) must never break the
 * sales, inventory movements, or profit history already built on top of it —
 * see DATABASE.md's "Historical integrity" section. There's no delete route
 * yet (no routes exist at all), so these tests simulate the soft-delete
 * directly and assert the invariant a future delete endpoint must uphold.
 */
describe('soft-delete historical integrity', () => {
  it('a soft-deleted Product keeps its InventoryItems, Sales, and profit history intact', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Kaiak Tradicional Masculino',
    });

    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '38.00',
      actingUserId: user.id,
    });
    const sale = await salesService.createSale(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      items: [{ inventoryItemId: item!.id, salePrice: '65.00' }],
    });

    // Simulate soft-deleting the product (e.g. the seller no longer stocks it).
    await testPrisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    // The product disappears from active catalog search...
    const searchResults = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'kaiak',
    });
    expect(searchResults).toHaveLength(0);

    // ...but every historical record built on top of it is untouched.
    const stillThereItem = await testPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: item!.id },
    });
    expect(stillThereItem.productId).toBe(product.id);
    expect(stillThereItem.status).toBe('SOLD');

    const stillThereSale = await testPrisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { items: true },
    });
    expect(stillThereSale.status).toBe('PAID');
    expect(stillThereSale.items[0]!.acquisitionCostSnapshot.toFixed(2)).toBe('38.00');

    // Lot-level financials (profit derived from sale history) are unaffected
    // by the product's soft-deletion — the numbers are still there.
    const financials = await inventoryService.getLotFinancials(testPrisma, {
      userId: user.id,
      lotId: lot.id,
    });
    expect(financials.revenue).toBe('65.00');
    expect(financials.realizedProfit).toBe('27.00');
  });

  it('a soft-deleted Lot keeps its InventoryItems and their movement history intact', async () => {
    const user = await createTestUser();
    const lot = await createTestLot({ userId: user.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Batom Ultra Color',
    });
    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: user.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '12.00',
      actingUserId: user.id,
    });

    await testPrisma.lot.update({
      where: { id: lot.id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    const movements = await testPrisma.inventoryMovement.findMany({
      where: { inventoryItemId: item!.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe('PURCHASE_ENTRY');

    const stillThereItem = await testPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: item!.id },
    });
    expect(stillThereItem.lotId).toBe(lot.id);
  });

  it('never hard-deletes a User even when simulating account deactivation', async () => {
    const user = await createTestUser();

    await testPrisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    const stillThere = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stillThere.deletedAt).not.toBeNull();
  });
});
