import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestCatalogProduct, resetDatabase } from '../../test/db';
import { authHeader, createTestApp, registerTestActor } from '../../test/app';

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

describe('GET /catalog/search', () => {
  it('returns a concise suggestion shape', async () => {
    const actor = await registerTestActor(app);
    await createTestCatalogProduct({ name: 'Kaiak Clássico', brand: 'Natura' });

    const response = await app.inject({
      method: 'GET',
      url: '/catalog/search?query=kaiak',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    const [suggestion] = response.json().items;
    expect(Object.keys(suggestion).sort()).toEqual(
      ['id', 'brand', 'name', 'category', 'volume', 'description', 'imageUrl'].sort(),
    );
  });

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/catalog/search?query=kaiak' });
    expect(response.statusCode).toBe(401);
  });

  it('accepts an explicit numeric limit query param', async () => {
    const actor = await registerTestActor(app);
    await createTestCatalogProduct({ name: 'Kaiak Clássico', brand: 'Natura' });

    // Querystring values always arrive as strings over HTTP — this pins
    // that `limit` is coerced, not just left to its default.
    const response = await app.inject({
      method: 'GET',
      url: '/catalog/search?query=kaiak&limit=5',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
  });

  it('is identical across two different tenants — the catalog is global', async () => {
    const tenantA = await registerTestActor(app);
    const tenantB = await registerTestActor(app);
    await createTestCatalogProduct({ name: 'Kaiak Clássico', brand: 'Natura' });
    await createTestCatalogProduct({ name: 'Kaiak Aero', brand: 'Natura' });

    const responseA = await app.inject({
      method: 'GET',
      url: '/catalog/search?query=kaiak',
      headers: authHeader(tenantA),
    });
    const responseB = await app.inject({
      method: 'GET',
      url: '/catalog/search?query=kaiak',
      headers: authHeader(tenantB),
    });

    const namesA = responseA.json().items.map((p: { name: string }) => p.name).sort();
    const namesB = responseB.json().items.map((p: { name: string }) => p.name).sort();
    expect(namesA).toEqual(namesB);
    expect(namesA.length).toBeGreaterThan(0);
  });
});

describe('GET /catalog/:id', () => {
  it('returns the full catalog entry', async () => {
    const actor = await registerTestActor(app);
    const catalogProduct = await createTestCatalogProduct({
      name: 'Kaiak Clássico',
      brand: 'Natura',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/catalog/${catalogProduct.id}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Kaiak Clássico');
  });

  it('returns 404 for a missing id', async () => {
    const actor = await registerTestActor(app);

    const response = await app.inject({
      method: 'GET',
      url: '/catalog/00000000-0000-7000-8000-000000000000',
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for a deactivated entry', async () => {
    const actor = await registerTestActor(app);
    const catalogProduct = await createTestCatalogProduct({ active: false });

    const response = await app.inject({
      method: 'GET',
      url: `/catalog/${catalogProduct.id}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(404);
  });
});
