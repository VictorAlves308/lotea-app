import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { testPrisma, resetDatabase } from '../../test/db';
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

/**
 * Full HTTP-level setup for one sellable InventoryItem — see
 * inventory.routes.test.ts for why the item id is read back via the DB.
 * `productName` defaults to a random one; pass explicit, clearly dissimilar
 * names when calling this twice in the same test — two random base36
 * strings are short enough that the duplicate-candidate similarity check
 * can flag them as "similar" purely by chance, turning the second call's
 * 201 into a 200 (see products.routes.test.ts's "recent" test for the same
 * defensive pattern).
 */
async function seedInventoryItem(actor: TestActor, productName?: string) {
  const lotResponse = await app.inject({
    method: 'POST',
    url: '/lots',
    headers: authHeader(actor),
    payload: { name: 'Lote' },
  });
  const productResponse = await app.inject({
    method: 'POST',
    url: '/products',
    headers: authHeader(actor),
    payload: {
      name: productName ?? `Produto ${Math.random().toString(36).slice(2)}`,
      defaultSalePrice: '29.90',
      minStockAlert: 5,
    },
  });
  const lotId = lotResponse.json().id as string;
  const productId = productResponse.json().id as string;

  await app.inject({
    method: 'POST',
    url: `/lots/${lotId}/inventory-entries`,
    headers: authHeader(actor),
    payload: { productId, quantity: 1, acquisitionCost: '10.00' },
  });

  const [item] = await testPrisma.inventoryItem.findMany({ where: { lotId, productId } });
  return item!.id as string;
}

async function createCustomer(actor: TestActor, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: authHeader(actor),
    payload: { name },
  });
  return response.json().id as string;
}

describe('POST /sales', () => {
  it('creates a fully-paid sale with no customer', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '65.00' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('PAID');
    expect(body.paidAmount).toBe('65.00');
    expect(body.customerId).toBeNull();
  });

  it('creates a partially-paid sale with a customer', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const customerId = await createCustomer(actor, 'Maria Silva');

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
        receivedAmount: '20.00',
        customerId,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('PARTIALLY_PAID');
    expect(body.paidAmount).toBe('20.00');
  });

  it('rejects an outstanding sale with no customer', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '0.00' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CUSTOMER_REQUIRED');
  });

  it('rejects receivedAmount greater than the total', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const customerId = await createCustomer(actor, 'Maria Silva');

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
        receivedAmount: '70.00',
        customerId,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a negative receivedAmount at the validation boundary', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);

    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '-5.00' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sales',
      payload: { items: [{ inventoryItemId: '00000000-0000-7000-8000-000000000000', salePrice: '65.00' }], receivedAmount: '65.00' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /sales', () => {
  it('lists sales most-recent-first, with customer name, item count, and brand joined in', async () => {
    const actor = await registerTestActor(app);
    const customerId = await createCustomer(actor, 'Maria Silva');
    const itemId = await seedInventoryItem(actor);

    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: {
          items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
          receivedAmount: '65.00',
          customerId,
          paymentMethod: 'PIX',
        },
      })
    ).json();

    const response = await app.inject({ method: 'GET', url: '/sales', headers: authHeader(actor) });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    const [sale] = body.items;
    expect(sale.id).toBe(created.id);
    expect(sale.customerName).toBe('Maria Silva');
    expect(sale.itemCount).toBe(1);
    expect(sale.paymentMethod).toBe('PIX');
    expect(sale.status).toBe('PAID');
  });

  it('still includes a cancelled sale — voiding every item must not drop it from the list', async () => {
    const actor = await registerTestActor(app);
    const customerId = await createCustomer(actor, 'Maria Silva');
    const itemId = await seedInventoryItem(actor);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: {
          items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
          receivedAmount: '0.00',
          customerId,
        },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/sales/${created.id}/cancel`, headers: authHeader(actor) });

    const response = await app.inject({ method: 'GET', url: '/sales', headers: authHeader(actor) });

    const body = response.json();
    expect(body.items.map((s: { id: string }) => s.id)).toContain(created.id);
    expect(body.items.find((s: { id: string }) => s.id === created.id).status).toBe('CANCELLED');
  });

  it('filters by status', async () => {
    const actor = await registerTestActor(app);
    const paidItemId = await seedInventoryItem(actor, 'Kaiak Tradicional Masculino');
    const pendingItemId = await seedInventoryItem(actor, 'Batom Ultra Color');
    const customerId = await createCustomer(actor, 'Maria Silva');
    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: { items: [{ inventoryItemId: paidItemId, salePrice: '65.00' }], receivedAmount: '65.00' },
    });
    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(actor),
      payload: {
        items: [{ inventoryItemId: pendingItemId, salePrice: '65.00' }],
        receivedAmount: '0.00',
        customerId,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/sales?status=PENDING',
      headers: authHeader(actor),
    });

    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe('PENDING');
  });

  it('never returns another tenant’s sales', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const itemId = await seedInventoryItem(owner);
    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: authHeader(owner),
      payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '65.00' },
    });

    const response = await app.inject({ method: 'GET', url: '/sales', headers: authHeader(attacker) });

    expect(response.json().items).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/sales' });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /sales/:id', () => {
  it('returns the sale', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '65.00' },
      })
    ).json();

    const response = await app.inject({
      method: 'GET',
      url: `/sales/${created.id}`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(created.id);
  });

  it('returns 404 for another tenant’s sale', async () => {
    const owner = await registerTestActor(app);
    const attacker = await registerTestActor(app);
    const itemId = await seedInventoryItem(owner);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(owner),
        payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '65.00' },
      })
    ).json();

    const response = await app.inject({
      method: 'GET',
      url: `/sales/${created.id}`,
      headers: authHeader(attacker),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /sales/:id/cancel', () => {
  it('cancels a sale with no payment', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const customerId = await createCustomer(actor, 'Maria Silva');
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: {
          items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
          receivedAmount: '0.00',
          customerId,
        },
      })
    ).json();

    const response = await app.inject({
      method: 'POST',
      url: `/sales/${created.id}/cancel`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('CANCELLED');
  });

  it('blocks cancelling a sale with an active payment', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: { items: [{ inventoryItemId: itemId, salePrice: '65.00' }], receivedAmount: '65.00' },
      })
    ).json();

    const response = await app.inject({
      method: 'POST',
      url: `/sales/${created.id}/cancel`,
      headers: authHeader(actor),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SALE_HAS_ACTIVE_PAYMENTS');
  });

  it('is idempotent — cancelling an already-cancelled sale is a no-op', async () => {
    const actor = await registerTestActor(app);
    const itemId = await seedInventoryItem(actor);
    const customerId = await createCustomer(actor, 'Maria Silva');
    const created = (
      await app.inject({
        method: 'POST',
        url: '/sales',
        headers: authHeader(actor),
        payload: {
          items: [{ inventoryItemId: itemId, salePrice: '65.00' }],
          receivedAmount: '0.00',
          customerId,
        },
      })
    ).json();

    await app.inject({ method: 'POST', url: `/sales/${created.id}/cancel`, headers: authHeader(actor) });
    const second = await app.inject({
      method: 'POST',
      url: `/sales/${created.id}/cancel`,
      headers: authHeader(actor),
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe('CANCELLED');
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sales/00000000-0000-7000-8000-000000000000/cancel',
    });
    expect(response.statusCode).toBe(401);
  });
});
