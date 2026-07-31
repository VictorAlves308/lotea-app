import { beforeEach, describe, expect, it } from 'vitest';

import * as inventoryService from '../inventory/inventory.service';
import * as salesService from '../sales/sales.service';
import {
  createTestCatalogProduct,
  createTestCustomer,
  createTestLot,
  createTestUser,
  resetDatabase,
  testPrisma,
} from '../../test/db';
import { CatalogProductNotFoundError } from '../../shared/errors/app-error';
import * as productsService from './products.service';

beforeEach(async () => {
  await resetDatabase();
});

describe('createProduct', () => {
  it('computes searchTerms from name/brand/category/sku/volume/variant, normalized', async () => {
    const user = await createTestUser();

    const product = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Água de Cheiro Talco',
      brand: 'Natura',
      category: 'Perfumaria',
      sku: 'NAT-AGCH-100',
      volume: '100ml',
      variant: 'Unissex',
    });

    expect(product.name).toBe('Água de Cheiro Talco'); // display name is never replaced
    expect(product.searchTerms).toBe(
      'agua de cheiro talco natura perfumaria nat-agch-100 100ml unissex',
    );
  });
});

describe('searchProducts', () => {
  async function seedCatalog(userId: string) {
    await productsService.createProduct(testPrisma, {
      userId,
      actingUserId: userId,
      name: 'Kaiak Tradicional Masculino',
      brand: 'Natura',
      category: 'Perfumaria',
      sku: 'NAT-KAIAK-100',
      volume: '100ml',
      variant: 'Masculino',
    });
    await productsService.createProduct(testPrisma, {
      userId,
      actingUserId: userId,
      name: 'Água de Cheiro Talco',
      brand: 'Natura',
      category: 'Perfumaria',
      sku: 'NAT-AGCH-100',
      volume: '100ml',
      variant: 'Unissex',
    });
    await productsService.createProduct(testPrisma, {
      userId,
      actingUserId: userId,
      name: 'Batom Ultra Color',
      brand: 'Avon',
      category: 'Maquiagem',
      sku: 'AVON-BAT-UC',
      variant: 'Feminino',
    });
  }

  it('ignores accents', async () => {
    const user = await createTestUser();
    await seedCatalog(user.id);

    const results = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'agua de cheiro',
    });
    expect(results.map((p) => p.name)).toContain('Água de Cheiro Talco');
  });

  it('ignores capitalization', async () => {
    const user = await createTestUser();
    await seedCatalog(user.id);

    const results = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'KAIAK',
    });
    expect(results.map((p) => p.name)).toContain('Kaiak Tradicional Masculino');
  });

  it('tolerates a small spelling mistake', async () => {
    const user = await createTestUser();
    await seedCatalog(user.id);

    // "kaiac" instead of "kaiak" — one substituted letter.
    const results = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'kaiac',
    });
    expect(results.map((p) => p.name)).toContain('Kaiak Tradicional Masculino');
  });

  it('matches a partial term', async () => {
    const user = await createTestUser();
    await seedCatalog(user.id);

    const results = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'batom',
    });
    expect(results.map((p) => p.name)).toContain('Batom Ultra Color');
  });

  it('matches on brand, category, sku, volume, and variant — not only name', async () => {
    const user = await createTestUser();
    await seedCatalog(user.id);

    const byBrand = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'avon',
    });
    expect(byBrand.map((p) => p.name)).toContain('Batom Ultra Color');

    const byCategory = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'maquiagem',
    });
    expect(byCategory.map((p) => p.name)).toContain('Batom Ultra Color');

    const bySku = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'NAT-KAIAK-100',
    });
    expect(bySku.map((p) => p.name)).toContain('Kaiak Tradicional Masculino');

    const byVariant = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'masculino',
    });
    expect(byVariant.map((p) => p.name)).toContain('Kaiak Tradicional Masculino');
  });

  it('never returns another tenant’s catalog products', async () => {
    const owner = await createTestUser();
    const otherTenant = await createTestUser();
    await seedCatalog(owner.id);

    const results = await productsService.searchProducts(testPrisma, {
      userId: otherTenant.id,
      query: 'kaiak',
    });
    expect(results).toHaveLength(0);
  });

  it('surfaces a near-duplicate before creating a new product — the duplicate-prevention flow', async () => {
    const user = await createTestUser();
    await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Kaiak Tradicional Masculino',
      brand: 'Natura',
      volume: '100ml',
    });

    // A user about to register "Kaiak Tradiiconal" (typo) should see the
    // existing product surfaced instead of creating a duplicate catalog entry.
    const candidates = await productsService.searchProducts(testPrisma, {
      userId: user.id,
      query: 'Kaiak Tradiiconal',
    });

    expect(candidates.map((p) => p.name)).toContain('Kaiak Tradicional Masculino');
  });
});

describe('createProductWithDuplicateCheck — catalog-based creation', () => {
  it('copies name/brand/category/volume from the catalog entry and sets catalogProductId', async () => {
    const user = await createTestUser();
    const catalogProduct = await createTestCatalogProduct({
      brand: 'Natura',
      name: 'Kaiak Clássico',
      category: 'Perfumaria',
      volume: '100ml',
    });

    const result = await productsService.createProductWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      catalogProductId: catalogProduct.id,
      confirmDuplicate: false,
    });

    expect(result.created).toBe(true);
    expect(result.product?.name).toBe('Kaiak Clássico');
    expect(result.product?.brand).toBe('Natura');
    expect(result.product?.category).toBe('Perfumaria');
    expect(result.product?.volume).toBe('100ml');
    expect(result.product?.catalogProductId).toBe(catalogProduct.id);
  });

  it('still allows sku/variant/notes alongside catalogProductId', async () => {
    const user = await createTestUser();
    const catalogProduct = await createTestCatalogProduct({ name: 'Kaiak Clássico' });

    const result = await productsService.createProductWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      catalogProductId: catalogProduct.id,
      sku: 'MEU-SKU-01',
      variant: 'Masculino',
      confirmDuplicate: false,
    });

    expect(result.product?.sku).toBe('MEU-SKU-01');
    expect(result.product?.variant).toBe('Masculino');
  });

  it('throws for an unknown catalogProductId', async () => {
    const user = await createTestUser();

    await expect(
      productsService.createProductWithDuplicateCheck(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        catalogProductId: '00000000-0000-7000-8000-000000000000',
        confirmDuplicate: false,
      }),
    ).rejects.toThrow(CatalogProductNotFoundError);
  });

  it('throws for a deactivated catalogProductId', async () => {
    const user = await createTestUser();
    const catalogProduct = await createTestCatalogProduct({ active: false });

    await expect(
      productsService.createProductWithDuplicateCheck(testPrisma, {
        userId: user.id,
        actingUserId: user.id,
        catalogProductId: catalogProduct.id,
        confirmDuplicate: false,
      }),
    ).rejects.toThrow(CatalogProductNotFoundError);
  });

  it('still runs the duplicate-check for catalog-originated creation', async () => {
    const user = await createTestUser();
    const catalogProduct = await createTestCatalogProduct({ name: 'Kaiak Clássico' });

    await productsService.createProductWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      catalogProductId: catalogProduct.id,
      confirmDuplicate: false,
    });

    // Picking the same catalog entry again surfaces the existing Product as a
    // near-duplicate instead of silently creating a second one.
    const second = await productsService.createProductWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      catalogProductId: catalogProduct.id,
      confirmDuplicate: false,
    });

    expect(second.created).toBe(false);
    expect(second.duplicateCandidates).toHaveLength(1);
  });

  it("does not retroactively change a Product when its source CatalogProduct is later edited or deactivated", async () => {
    const user = await createTestUser();
    const catalogProduct = await createTestCatalogProduct({
      brand: 'Natura',
      name: 'Kaiak Clássico',
      category: 'Perfumaria',
      volume: '100ml',
    });

    const result = await productsService.createProductWithDuplicateCheck(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      catalogProductId: catalogProduct.id,
      confirmDuplicate: false,
    });
    const productId = result.product!.id;

    await testPrisma.catalogProduct.update({
      where: { id: catalogProduct.id },
      data: { name: 'Nome Alterado', category: 'Outra Categoria', active: false },
    });

    const product = await productsService.getProductById(testPrisma, { id: productId, userId: user.id });
    expect(product?.name).toBe('Kaiak Clássico');
    expect(product?.category).toBe('Perfumaria');
  });
});

describe('dashboard aggregates', () => {
  /** One InventoryItem sold in a single-item Sale — backdates the SaleItem's own createdAt (what the ranking queries filter on). */
  async function seedSoldItem(params: {
    userId: string;
    productId: string;
    salePrice: string;
    createdAt: Date;
    receivedAmount?: string;
    customerId?: string;
  }) {
    const lot = await createTestLot({ userId: params.userId });
    const [item] = await inventoryService.registerPurchaseEntry(testPrisma, {
      userId: params.userId,
      productId: params.productId,
      lotId: lot.id,
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
    await testPrisma.saleItem.updateMany({
      where: { saleId: sale.id },
      data: { createdAt: params.createdAt },
    });
    return sale;
  }

  const from = new Date(Date.UTC(2026, 0, 1));
  const toExclusive = new Date(Date.UTC(2026, 0, 10));
  const inWindow = new Date(Date.UTC(2026, 0, 5));

  it('getTopSellingProducts ranks by revenue in the period, excluding cancelled items and out-of-window sales', async () => {
    const user = await createTestUser();
    const customer = await createTestCustomer({ userId: user.id });
    const productA = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Kaiak Tradicional',
    });
    const productB = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Batom Matte',
    });

    await seedSoldItem({ userId: user.id, productId: productA.id, salePrice: '100.00', createdAt: inWindow });
    await seedSoldItem({ userId: user.id, productId: productB.id, salePrice: '40.00', createdAt: inWindow });
    // Out of the query window entirely — must not count.
    await seedSoldItem({
      userId: user.id,
      productId: productA.id,
      salePrice: '9999.00',
      createdAt: new Date(Date.UTC(2020, 0, 1)),
    });
    // In-window but cancelled — must not count either.
    const cancelledSale = await seedSoldItem({
      userId: user.id,
      productId: productB.id,
      salePrice: '5000.00',
      createdAt: inWindow,
      receivedAmount: '0.00',
      customerId: customer.id,
    });
    await salesService.cancelSale(testPrisma, {
      userId: user.id,
      saleId: cancelledSale.id,
      actingUserId: user.id,
    });

    const result = await productsService.getTopSellingProducts(testPrisma, {
      userId: user.id,
      from,
      toExclusive,
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      productId: productA.id,
      name: 'Kaiak Tradicional',
      quantity: 1,
      revenue: '100.00',
    });
    expect(result[1]).toMatchObject({
      productId: productB.id,
      name: 'Batom Matte',
      quantity: 1,
      revenue: '40.00',
    });
  });

  it('getTopSellingBrands ranks by revenue, excluding products with no brand set', async () => {
    const user = await createTestUser();
    const branded = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Kaiak Tradicional',
      brand: 'Natura',
    });
    const unbranded = await productsService.createProduct(testPrisma, {
      userId: user.id,
      actingUserId: user.id,
      name: 'Produto Genérico',
    });

    await seedSoldItem({ userId: user.id, productId: branded.id, salePrice: '70.00', createdAt: inWindow });
    await seedSoldItem({ userId: user.id, productId: unbranded.id, salePrice: '500.00', createdAt: inWindow });

    const result = await productsService.getTopSellingBrands(testPrisma, {
      userId: user.id,
      from,
      toExclusive,
      limit: 10,
    });

    expect(result).toEqual([{ brand: 'Natura', quantity: 1, revenue: '70.00' }]);
  });
});

