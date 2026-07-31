import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { testPrisma, resetDatabase } from '../../test/db';
import { authHeader, createTestApp, registerTestActor, type TestActor } from '../../test/app';
import * as inventoryRepository from './inventory.repository';

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

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup(actor: TestActor) {
  const lotResponse = await app.inject({
    method: 'POST',
    url: '/lots',
    headers: authHeader(actor),
    payload: { name: 'Compra Natura' },
  });
  const productResponse = await app.inject({
    method: 'POST',
    url: '/products',
    headers: authHeader(actor),
    payload: { name: 'Kaiak Tradicional Masculino', defaultSalePrice: '29.90', minStockAlert: 5 },
  });
  return { lotId: lotResponse.json().id as string, productId: productResponse.json().id as string };
}

describe('POST /lots/:lotId/inventory-entries', () => {
  it('creates one InventoryItem per unit, each with the given acquisition cost, and returns a summary', async () => {
    const actor = await registerTestActor(app);
    const { lotId, productId } = await setup(actor);

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 5, acquisitionCost: '38.00' },
    });

    expect(response.statusCode).toBe(201);
    const summary = response.json();
    // The response is a summary, not one row per unit — never the raw item array.
    expect(summary).toEqual({
      lotId,
      productId,
      quantity: 5,
      acquisitionCost: '38.00',
      expiresAt: null,
      createdAt: expect.any(String),
    });

    const items = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
    expect(items).toHaveLength(5);
    expect(new Set(items.map((item) => item.id)).size).toBe(5);
    expect(items.every((item) => item.acquisitionCost.toFixed(2) === '38.00')).toBe(true);
    expect(items.every((item) => item.status === 'IN_STOCK')).toBe(true);
  });

  it('records one PURCHASE_ENTRY movement per created item', async () => {
    const actor = await registerTestActor(app);
    const { lotId, productId } = await setup(actor);

    await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 3, acquisitionCost: '12.50' },
    });

    const items = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
    const movements = await testPrisma.inventoryMovement.findMany({
      where: { inventoryItemId: { in: items.map((item) => item.id) } },
    });
    expect(movements).toHaveLength(3);
    expect(movements.every((m) => m.type === 'PURCHASE_ENTRY')).toBe(true);
    // Each item gets its own distinct movement — not one movement shared across units.
    expect(new Set(movements.map((m) => m.inventoryItemId)).size).toBe(3);
  });

  it('accepts an optional expiresAt', async () => {
    const actor = await registerTestActor(app);
    const { lotId, productId } = await setup(actor);
    const expiresAt = '2027-01-01T00:00:00.000Z';

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 1, acquisitionCost: '10.00', expiresAt },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().expiresAt).toBe(expiresAt);
    const [item] = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
    expect(item!.expiresAt?.toISOString()).toBe(expiresAt);
  });

  it('rejects a purchase entry against another tenant’s lot', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const { lotId } = await setup(owner);
    const { productId } = await setup(attacker);

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(attacker),
      payload: { productId, quantity: 1, acquisitionCost: '10.00' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a purchase entry referencing another tenant’s product', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const { productId } = await setup(owner);
    const { lotId } = await setup(attacker);

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(attacker),
      payload: { productId, quantity: 1, acquisitionCost: '10.00' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a purchase entry against a non-ACTIVE lot', async () => {
    const actor = await registerTestActor(app);
    const { lotId, productId } = await setup(actor);
    await app.inject({
      method: 'PATCH',
      url: `/lots/${lotId}/status`,
      headers: authHeader(actor),
      payload: { status: 'ARCHIVED' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 1, acquisitionCost: '10.00' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('LOT_NOT_ACTIVE');
  });

  it('rolls back the entire entry if creation fails partway through', async () => {
    const actor = await registerTestActor(app);
    const { lotId, productId } = await setup(actor);

    // Force the 3rd unit's movement insert to fail, simulating a mid-loop
    // failure — the whole entry (units 1 and 2 included) must not persist.
    const realCreateMovement = inventoryRepository.createMovement;
    let attempt = 0;
    vi.spyOn(inventoryRepository, 'createMovement').mockImplementation(async (db, params) => {
      attempt += 1;
      if (attempt === 3) {
        throw new Error('Simulated failure on the 3rd movement');
      }
      return realCreateMovement(db, params);
    });

    const response = await app.inject({
      method: 'POST',
      url: `/lots/${lotId}/inventory-entries`,
      headers: authHeader(actor),
      payload: { productId, quantity: 5, acquisitionCost: '10.00' },
    });

    expect(response.statusCode).toBe(500);

    const items = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
    const movements = await testPrisma.inventoryMovement.findMany({
      where: { userId: actor.userId },
    });
    expect(items).toHaveLength(0);
    expect(movements).toHaveLength(0);
  });
});
