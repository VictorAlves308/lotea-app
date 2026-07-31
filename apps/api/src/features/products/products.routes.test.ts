import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestCatalogProduct, resetDatabase, testPrisma } from '../../test/db';
import { authHeader, createTestApp, registerTestActor, type TestActor } from '../../test/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase();
});

async function createProduct(actor: TestActor, payload: Record<string, unknown>) {
  const response = await app.inject({
    method: 'POST',
    url: '/products',
    headers: authHeader(actor),
    payload: { defaultSalePrice: '29.90', minStockAlert: 5, ...payload },
  });
  return response;
}

describe('POST /products', () => {
  it('creates a product', async () => {
    const actor = await registerTestActor(app);

    const response = await createProduct(actor, {
      name: 'Kaiak Tradicional Masculino',
      brand: 'Natura',
      volume: '100ml',
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Kaiak Tradicional Masculino');
    expect(body.searchTerms).toBe('kaiak tradicional masculino natura 100ml');
  });

  it('returns duplicate candidates instead of creating, when a similar product already exists', async () => {
    const actor = await registerTestActor(app);
    await createProduct(actor, { name: 'Kaiak Tradicional Masculino', brand: 'Natura' });

    const response = await createProduct(actor, { name: 'Kaiak Tradiiconal' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.duplicateCandidates).toHaveLength(1);
    expect(body.duplicateCandidates[0].name).toBe('Kaiak Tradicional Masculino');
  });

  it('creates anyway when confirmDuplicate is set', async () => {
    const actor = await registerTestActor(app);
    await createProduct(actor, { name: 'Kaiak Tradicional Masculino' });

    const response = await createProduct(actor, {
      name: 'Kaiak Tradicional Masculino Edição Especial',
      confirmDuplicate: true,
    });

    expect(response.statusCode).toBe(201);
  });
});

describe('POST /products — from the global catalog', () => {
  it('creates a product from a catalogProductId, copying its fields', async () => {
    const actor = await registerTestActor(app);
    const catalogProduct = await createTestCatalogProduct({
      brand: 'Natura',
      name: 'Kaiak Clássico',
      category: 'Perfumaria',
      volume: '100ml',
    });

    const response = await createProduct(actor, { catalogProductId: catalogProduct.id });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Kaiak Clássico');
    expect(body.brand).toBe('Natura');
    expect(body.catalogProductId).toBe(catalogProduct.id);
  });

  it('rejects the request when neither catalogProductId nor name is provided', async () => {
    const actor = await registerTestActor(app);

    const response = await createProduct(actor, { brand: 'Natura' });

    expect(response.statusCode).toBe(400);
  });

  it('rejects the request when catalogProductId is sent together with manual brand/category/volume', async () => {
    const actor = await registerTestActor(app);
    const catalogProduct = await createTestCatalogProduct({ name: 'Kaiak Clássico' });

    const response = await createProduct(actor, {
      catalogProductId: catalogProduct.id,
      brand: 'Outra Marca',
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for an unknown catalogProductId', async () => {
    const actor = await registerTestActor(app);

    const response = await createProduct(actor, {
      catalogProductId: '00000000-0000-7000-8000-000000000000',
    });

    expect(response.statusCode).toBe(404);
  });

  it('never lets a personalized product leak into the global catalog search', async () => {
    const owner = await registerTestActor(app);
    const otherTenant = await registerTestActor(app);
    await createProduct(owner, { name: 'Kaiak Especial Promoção', brand: 'Natura' });

    const response = await app.inject({
      method: 'GET',
      url: '/catalog/search?query=kaiak',
      headers: authHeader(otherTenant),
    });

    expect(response.json().items).toHaveLength(0);
  });
});

describe('GET /products/search', () => {
  async function seedCatalog(actor: TestActor) {
    await createProduct(actor, {
      name: 'Água de Cheiro Talco',
      brand: 'Natura',
      category: 'Perfumaria',
      volume: '100ml',
    });
    await createProduct(actor, { name: 'Batom Ultra Color', brand: 'Avon', category: 'Maquiagem' });
  }

  it('ignores accents', async () => {
    const actor = await registerTestActor(app);
    await seedCatalog(actor);

    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=agua de cheiro',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((p: { name: string }) => p.name)).toContain(
      'Água de Cheiro Talco',
    );
  });

  it('matches a partial term', async () => {
    const actor = await registerTestActor(app);
    await seedCatalog(actor);

    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=batom',
      headers: authHeader(actor),
    });

    expect(response.json().items.map((p: { name: string }) => p.name)).toContain(
      'Batom Ultra Color',
    );
  });

  it('tolerates a small spelling mistake', async () => {
    const actor = await registerTestActor(app);
    await seedCatalog(actor);

    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=agoa de cheiro',
      headers: authHeader(actor),
    });

    expect(response.json().items.map((p: { name: string }) => p.name)).toContain(
      'Água de Cheiro Talco',
    );
  });

  it('returns a concise suggestion shape, not the full Product', async () => {
    const actor = await registerTestActor(app);
    await seedCatalog(actor);

    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=batom',
      headers: authHeader(actor),
    });

    const [suggestion] = response.json().items;
    expect(Object.keys(suggestion).sort()).toEqual(
      ['id', 'name', 'brand', 'category', 'sku', 'volume', 'variant'].sort(),
    );
  });

  it('never returns another tenant’s products', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    await seedCatalog(owner);

    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=batom',
      headers: authHeader(attacker),
    });

    expect(response.json().items).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/search?query=batom' });
    expect(response.statusCode).toBe(401);
  });

  it('accepts an explicit numeric limit query param', async () => {
    const actor = await registerTestActor(app);
    await seedCatalog(actor);

    // Querystring values always arrive as strings over HTTP — this pins
    // that `limit` is coerced, not just left to its default.
    const response = await app.inject({
      method: 'GET',
      url: '/products/search?query=batom&limit=5',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('GET /products/:id', () => {
  it('returns 404 for another tenant’s product', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const createResponse = await createProduct(owner, { name: 'Produto Privado' });
    const productId = createResponse.json().id;

    const response = await app.inject({
      method: 'GET',
      url: `/products/${productId}`,
      headers: authHeader(attacker),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('GET /products', () => {
  async function addStock(actor: TestActor, productId: string, quantity: number) {
    const lotResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Lote' },
    });
    await app.inject({
      method: 'POST',
      url: `/lots/${lotResponse.json().id}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity, acquisitionCost: '10.00' },
    });
  }

  it('lists a tenant’s products with a derived stock status', async () => {
    const actor = await registerTestActor(app);
    const wellStocked = (
      await createProduct(actor, { name: 'Kaiak Tradicional Masculino', minStockAlert: 2 })
    ).json();
    const low = (await createProduct(actor, { name: 'Batom Ultra Color', minStockAlert: 5 })).json();
    // Gets zero units — never entered into inventory at all.
    await createProduct(actor, { name: 'Água de Cheiro Talco', minStockAlert: 1 });
    await addStock(actor, wellStocked.id, 10);
    await addStock(actor, low.id, 3);

    const response = await app.inject({ method: 'GET', url: '/products', headers: authHeader(actor) });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(3);
    const byName = new Map(body.items.map((item: { name: string }) => [item.name, item]));
    expect((byName.get('Kaiak Tradicional Masculino') as { stockStatus: string }).stockStatus).toBe(
      'IN_STOCK',
    );
    expect((byName.get('Batom Ultra Color') as { stockStatus: string }).stockStatus).toBe('LOW');
    expect((byName.get('Água de Cheiro Talco') as { stockStatus: string }).stockStatus).toBe('OUT');
  });

  it('filters by brand', async () => {
    const actor = await registerTestActor(app);
    await createProduct(actor, { name: 'Kaiak Tradicional Masculino', brand: 'Natura' });
    await createProduct(actor, { name: 'Batom Ultra Color', brand: 'Avon' });

    const response = await app.inject({
      method: 'GET',
      url: '/products?brand=Avon',
      headers: authHeader(actor),
    });

    const names = response.json().items.map((item: { name: string }) => item.name);
    expect(names).toEqual(['Batom Ultra Color']);
  });

  it('never returns another tenant’s products', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    await createProduct(owner, { name: 'Produto Privado' });

    const response = await app.inject({ method: 'GET', url: '/products', headers: authHeader(attacker) });

    expect(response.json().items).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /products/brands', () => {
  it('returns distinct brands already used by this tenant', async () => {
    const actor = await registerTestActor(app);
    await createProduct(actor, { name: 'Kaiak Tradicional Masculino', brand: 'Natura' });
    await createProduct(actor, { name: 'Kaiak Clássico', brand: 'Natura' });
    await createProduct(actor, { name: 'Batom Ultra Color', brand: 'Avon' });
    await createProduct(actor, { name: 'Produto Sem Marca' });

    const response = await app.inject({
      method: 'GET',
      url: '/products/brands',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().brands).toEqual(['Avon', 'Natura']);
  });

  it('never returns another tenant’s brands', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    await createProduct(owner, { name: 'Kaiak Tradicional Masculino', brand: 'Natura' });

    const response = await app.inject({
      method: 'GET',
      url: '/products/brands',
      headers: authHeader(attacker),
    });

    expect(response.json().brands).toEqual([]);
  });
});

describe('GET /products/:id/available-inventory', () => {
  async function addStock(actor: TestActor, productId: string, quantity: number, acquisitionCost = '10.00') {
    const lotResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Lote' },
    });
    await app.inject({
      method: 'POST',
      url: `/lots/${lotResponse.json().id}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity, acquisitionCost },
    });
  }

  it('lists IN_STOCK units for the product, oldest first, with the true total', async () => {
    const actor = await registerTestActor(app);
    const product = (await createProduct(actor, { name: 'Kaiak Tradicional Masculino' })).json();
    await addStock(actor, product.id, 3, '12.00');

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}/available-inventory`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
    expect(body.items[0].acquisitionCost).toBe('12.00');
  });

  it('excludes SOLD units', async () => {
    const actor = await registerTestActor(app);
    const product = (await createProduct(actor, { name: 'Kaiak Tradicional Masculino' })).json();
    await addStock(actor, product.id, 1);
    const [item] = await testPrisma.inventoryItem.findMany({ where: { productId: product.id } });

    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: item!.id, salePrice: '20.00' }], receivedAmount: '20.00' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}/available-inventory`,
      headers: authHeader(actor),
    });

    expect(response.json().total).toBe(0);
  });

  it('respects the limit query param while still reporting the true total', async () => {
    const actor = await registerTestActor(app);
    const product = (await createProduct(actor, { name: 'Kaiak Tradicional Masculino' })).json();
    await addStock(actor, product.id, 5);

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}/available-inventory?limit=2`,
      headers: authHeader(actor),
    });

    const body = response.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it('returns 404 for another tenant’s product', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const product = (await createProduct(owner, { name: 'Produto Privado' })).json();

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}/available-inventory`,
      headers: authHeader(attacker),
    });

    expect(response.statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/products/00000000-0000-7000-8000-000000000000/available-inventory',
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /products/recent', () => {
  it('lists products used in the most recent purchase entries first', async () => {
    const actor = await registerTestActor(app);
    // Deliberately dissimilar names — two near-identical ones (e.g. "Produto
    // A" / "Produto B") would trip the duplicate-candidate check in POST
    // /products itself and never actually create the second one.
    const productA = (await createProduct(actor, { name: 'Kaiak Tradicional Masculino' })).json();
    const productB = (await createProduct(actor, { name: 'Batom Ultra Color' })).json();
    const lotResponse = await app.inject({
      method: 'POST',
      url: '/lots',
      headers: authHeader(actor),
      payload: { name: 'Lote' },
    });
    const lotId = lotResponse.json().id;

    // B used more recently than A. A small real delay between them, since
    // "most recently used" is only as precise as the millisecond timestamp
    // column backing it — two inserts in the same millisecond would make the
    // ordering ambiguous, which never happens in real usage (a seller can't
    // tap two purchase entries within the same millisecond).
    const entryA = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId: productA.id, quantity: 1, acquisitionCost: '10.00' },
    });
    expect(entryA.statusCode).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const entryB = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId: productB.id, quantity: 1, acquisitionCost: '10.00' },
    });
    expect(entryB.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/products/recent',
      headers: authHeader(actor),
    });

    const names = response.json().items.map((p: { name: string }) => p.name);
    expect(names[0]).toBe('Batom Ultra Color');
    expect(names[1]).toBe('Kaiak Tradicional Masculino');
  });
});
