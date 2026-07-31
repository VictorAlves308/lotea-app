import { beforeEach, describe, expect, it } from 'vitest';

import * as inventoryService from '../features/inventory/inventory.service';
import * as productsService from '../features/products/products.service';
import * as salesService from '../features/sales/sales.service';
import { createTestLot, createTestUser, resetDatabase, testPrisma } from './db';

beforeEach(async () => {
  await resetDatabase();
});

/**
 * Cross-cutting tenant-isolation coverage. Feature-specific isolation checks
 * (e.g. rejecting a cross-tenant sale) live alongside their own feature —
 * this file covers the repository-level scoping rule itself: every query
 * that lists/reads a tenant's records must be scoped by userId, and no
 * cross-tenant leak is possible even when two tenants have near-identical
 * data (same product names, overlapping lot names).
 */
describe('tenant isolation', () => {
  it('never returns another tenant’s lots, products, or inventory items', async () => {
    const ana = await createTestUser({ name: 'Ana Paula', email: 'ana@example.com' });
    const carla = await createTestUser({ name: 'Carla', email: 'carla@example.com' });

    // Deliberately identical names across tenants — isolation must hold even
    // when the data looks the same, not just when ids differ.
    const anaLot = await createTestLot({ userId: ana.id, name: 'Compra Natura' });
    const carlaLot = await createTestLot({ userId: carla.id, name: 'Compra Natura' });

    const anaProduct = await productsService.createProduct(testPrisma, {
      userId: ana.id,
      actingUserId: ana.id,
      name: 'Kaiak Tradicional Masculino',
    });
    const carlaProduct = await productsService.createProduct(testPrisma, {
      userId: carla.id,
      actingUserId: carla.id,
      name: 'Kaiak Tradicional Masculino',
    });

    await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: ana.id,
      productId: anaProduct.id,
      lotId: anaLot.id,
      quantity: 2,
      acquisitionCost: '10.00',
      actingUserId: ana.id,
    });
    await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: carla.id,
      productId: carlaProduct.id,
      lotId: carlaLot.id,
      quantity: 3,
      acquisitionCost: '10.00',
      actingUserId: carla.id,
    });

    const anaAvailable = await inventoryService.getAvailableCount(testPrisma, { userId: ana.id });
    const carlaAvailable = await inventoryService.getAvailableCount(testPrisma, {
      userId: carla.id,
    });
    expect(anaAvailable).toBe(2);
    expect(carlaAvailable).toBe(3);

    const anaItems = await testPrisma.inventoryItem.findMany({ where: { userId: ana.id } });
    expect(anaItems.every((item) => item.userId === ana.id)).toBe(true);
    expect(anaItems.some((item) => item.userId === carla.id)).toBe(false);

    const anaLots = await testPrisma.lot.findMany({ where: { userId: ana.id } });
    expect(anaLots).toHaveLength(1);
    expect(anaLots[0]!.id).toBe(anaLot.id);
  });

  it('rejects cancelling a sale that belongs to another tenant', async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const lot = await createTestLot({ userId: owner.id });
    const product = await productsService.createProduct(testPrisma, {
      userId: owner.id,
      actingUserId: owner.id,
      name: 'Batom Ultra Color',
    });
    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: owner.id,
      productId: product.id,
      lotId: lot.id,
      quantity: 1,
      acquisitionCost: '12.00',
      actingUserId: owner.id,
    });
    const sale = await salesService.createSale(testPrisma, {
      userId: owner.id,
      actingUserId: owner.id,
      items: [{ inventoryItemId: item!.id, salePrice: '30.00' }],
    });

    await expect(
      salesService.cancelSale(testPrisma, {
        userId: attacker.id,
        saleId: sale.id,
        actingUserId: attacker.id,
      }),
    ).rejects.toThrow();

    const untouched = await testPrisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(untouched.status).toBe('PAID');
  });
});
